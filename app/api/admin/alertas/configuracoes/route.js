import { authorizeRequest } from '@/app/lib/request-authorization';
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { registerAuditLog } from '@/app/lib/audit-log';
import { getAlertSettings } from '@/app/lib/alert-service';
import { validateAlertSettings } from '@/app/lib/alerts';
import { getAbsenceRecipients } from '@/app/lib/meeting-absence-service';

export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function handle(request, save) {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
    const client = await pool.connect();
    let transaction = false;
    try {
        const permissions = await getUserPermissions(client, userId);
        if (!isAllowed(permissions, save ? 'configuracoes_editar' : 'configuracoes', save ? 'actions' : 'pages')) {
            return NextResponse.json({ message: 'Sem permissão para configurar alertas.' }, { status: 403 });
        }
        const readiness = { email: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS), cron: Boolean(process.env.CRON_SECRET) };
        let settings = await getAlertSettings(client);
        if (save) {
            try { settings = validateAlertSettings(await request.json()); }
            catch (error) { return NextResponse.json({ message: error.message }, { status: 400 }); }
            if ((settings.emailEnabled || settings.absenceEmailEnabled) && (!readiness.email || !readiness.cron)) {
                return NextResponse.json({ message: 'Configure EMAIL_USER, EMAIL_PASS e CRON_SECRET no servidor antes de ativar os e-mails.' }, { status: 400 });
            }
            if ((settings.emailEnabled || settings.absenceEmailEnabled || settings.absenceRecipientIds.length) && !isAllowed(permissions, 'designacoes_email', 'actions')) {
                return NextResponse.json({ message: 'Sem permissão para ativar o envio de e-mails.' }, { status: 403 });
            }
            const eligible = new Set((await getAbsenceRecipients(client)).map(p => Number(p.id)));
            if (settings.absenceRecipientIds.some(id => !eligible.has(id))) {
                return NextResponse.json({ message: 'Selecione destinatários ativos com e-mail válido cadastrado.' }, { status: 400 });
            }
            await client.query('BEGIN'); transaction = true;
            await client.query(`INSERT INTO alertas_configuracao (id, dados) VALUES (1, $1::jsonb)
                ON CONFLICT (id) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = NOW()`, [JSON.stringify(settings)]);
            await registerAuditLog(client, { userId, action: 'alertas_configurados', entity: 'alertas', details: settings });
            await client.query('COMMIT'); transaction = false;
        }
        const { rows } = await client.query(`SELECT
            COUNT(*) FILTER (WHERE status = 'enviado')::int AS enviados,
            COUNT(*) FILTER (WHERE status = 'falhou' AND data_designacao >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date)::int AS falhas,
            MAX(enviado_em) AS ultimo_envio FROM alertas_email_envios`);
        const recipients = isAllowed(permissions, 'designacoes_email', 'actions') ? await getAbsenceRecipients(client) : [];
        return NextResponse.json({ settings, readiness, delivery: rows[0], recipients }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        if (transaction) await client.query('ROLLBACK');
        console.error('Falha ao configurar alertas:', error.message);
        return NextResponse.json({ message: 'Não foi possível configurar os alertas.' }, { status: 500 });
    } finally { client.release(); }
}

export async function GET(request) {
  const denied = await authorizeRequest(request, 'GET');
  if (denied) return denied; return handle(request, false); }
export async function POST(request) {
  const denied = await authorizeRequest(request, 'POST');
  if (denied) return denied; return handle(request, true); }
