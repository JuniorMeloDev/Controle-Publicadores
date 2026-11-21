import { confirmationEmailContent, deliverRefusalEmails } from '@/app/lib/assignment-response-email';
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getAlertSettings, getActiveAssignments, deliverReminders } from '@/app/lib/alert-service';
import { todayInBrazil, buildEmailReminders, reminderMessage } from '@/app/lib/alerts';
import { getEmailLogoAttachment } from '@/app/lib/email-brand';
import { emailSender } from '@/app/lib/email-layout';
import { deliverAbsenceEmails } from '@/app/lib/meeting-absence-service';
import { deliverBellPushes } from '@/app/lib/bell-push';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function GET(request) {
    // Fail closed: the scheduler's identity is a secret, never a caller-provided flag.
    if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
    }
    const client = await pool.connect();
    try {
        const settings = await getAlertSettings(client);
        const today = todayInBrazil();
        let push;
        try { push = await deliverBellPushes(client, { today, settings }); }
        catch (error) {
            console.error('Falha ao processar notificações push:', error.code || error.name);
            push = { error: 'Não foi possível processar as notificações no aparelho.' };
        }
        await deliverRefusalEmails(client);
        const pushResult = push ? { push } : {};
        const pushFailed = push?.error || push?.failed;
        if (!settings.emailEnabled && !settings.absenceEmailEnabled) return NextResponse.json(
            { message: push ? 'Notificações no aparelho processadas.' : 'Lembretes por e-mail desativados.', ...pushResult },
            { status: pushFailed ? 503 : 200 });
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            return NextResponse.json({ message: 'Envio de e-mail não configurado.', ...pushResult }, { status: 503 });
        }
        const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
            connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
        let logo;
        const absence = await deliverAbsenceEmails(client, { settings, today, sendMail: async message => {
            logo ||= await getEmailLogoAttachment();
            return transporter.sendMail({ from: emailSender(process.env.EMAIL_USER), ...message, attachments: [logo] });
        } });
        if (!settings.emailEnabled) return NextResponse.json({ message: 'Relatórios de ausentes processados.', absence, ...pushResult }, { status: absence.failed || pushFailed ? 503 : 200 });
        const assignments = await getActiveAssignments(client, { today });
        const { rows: publishers } = await client.query(`SELECT p.id, p.nome_completo, p.nome_chamado, p.email,
            COALESCE(pref.email_designacoes, TRUE) AS email_reminders_enabled
            FROM publicadores p LEFT JOIN grupos g ON g.id = p.grupo_id
            LEFT JOIN alertas_preferencias pref ON pref.publicador_id = p.id
            WHERE NULLIF(trim(p.email), '') IS NOT NULL AND (g.id IS NULL OR g.ativo = TRUE)
                AND COALESCE(pref.email_designacoes, TRUE)`);
        const { rows: retries } = await client.query(`SELECT publicador_id, data_designacao, antecedencia
            FROM alertas_email_envios WHERE data_designacao >= $1 AND
            (status = 'falhou' OR (status = 'processando' AND atualizado_em < NOW() - INTERVAL '15 minutes'))
            ORDER BY antecedencia`, [today]);
        const reminders = buildEmailReminders({ assignments, publishers, settings, today, retries });
        if (reminders.length) logo ||= await getEmailLogoAttachment();
        const totals = await deliverReminders(client, reminders, async reminder => {
            reminder.confirmation = await confirmationEmailContent(client, reminder.assignments);
            return transporter.sendMail({
                from: emailSender(process.env.EMAIL_USER), to: reminder.email, ...reminderMessage(reminder), attachments: [logo],
            });
        });
        return NextResponse.json({ message: 'Lembretes processados.', ...totals, absence, ...pushResult }, { status: totals.failed || absence.failed || pushFailed ? 503 : 200 });
    } catch (error) {
        console.error('Falha ao processar lembretes:', error.message);
        return NextResponse.json({ message: 'Não foi possível processar os lembretes.' }, { status: 500 });
    } finally { client.release(); }
}
