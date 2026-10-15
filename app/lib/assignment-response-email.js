import nodemailer from 'nodemailer';
import { createResponseLink, ensureResponseTables, assignmentVersion } from './assignment-response';
import { escapeEmailHtml, emailSender } from './email-layout';
import { getActiveAssignments } from './alert-service';
import { todayInBrazil } from './alerts';

export function applicationOrigin() {
  const value = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : '');
  if (!value) throw new Error('Configure APP_URL para enviar confirmações.');
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('APP_URL inválida.');
  return url.origin;
}

export async function confirmationEmailContent(client, assignments) {
  if (!assignments.length) return { html: '', text: '' };
  const origin = applicationOrigin();
  let html = '', text = '';
  for (const assignment of assignments) {
    const link = await createResponseLink(client, assignment, origin);
    const label = `${assignment.nome_parte} — ${String(assignment.data_reuniao instanceof Date ? assignment.data_reuniao.toISOString() : assignment.data_reuniao).slice(0, 10)}`;
    const separator = link.includes('#') ? '&' : '?';
    html += `<p><strong>${escapeEmailHtml(label)}</strong><br>Confirma sua designação?<br><a href="${escapeEmailHtml(link + separator + 'resposta=sim')}">Sim</a> &nbsp; <a href="${escapeEmailHtml(link + separator + 'resposta=nao')}">Não</a></p>`;
    text += `\n${label}\nConfirma sua designação?\nSim: ${link + separator + 'resposta=sim'}\nNão: ${link + separator + 'resposta=nao'}\n`;
  }
  if (assignments.length) { html += '<p>Sem resposta, sua designação continua válida. Abra o link e conclua sua resposta.</p>'; text += '\nSem resposta, sua designação continua válida.\n'; }
  return { html, text };
}

export async function deliverRefusalEmails(client) {
  await ensureResponseTables(client);
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  const currentVersions = (await getActiveAssignments(client, { today: todayInBrazil() })).map(assignmentVersion);
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
  const { rows } = await client.query(`UPDATE designacoes_recusas_avisos n SET tentativa_em=NOW() FROM publicadores p, acessos_app a, designacoes_respostas r
    WHERE n.destinatario_id=p.id AND a.publicador_id=p.id AND r.versao=n.versao AND n.enviado_em IS NULL
    AND (n.tentativa_em IS NULL OR n.tentativa_em < NOW()-INTERVAL '15 minutes')
    AND n.versao=ANY($1::text[])
    AND (a.super_admin=TRUE OR a.permissoes->'actions'->'designacoes_confirmacoes'='true'::jsonb)
    AND NULLIF(trim(p.email),'') IS NOT NULL
    RETURNING n.id, p.email, r.dados`, [currentVersions]);
  for (const row of rows) {
    try {
      const a = row.dados;
      const text = `${a.nome_completo || a.nome_chamado || 'Publicador'} não poderá cumprir a designação ${a.nome_parte} em ${String(a.data_reuniao).slice(0, 10)}. É necessário escolher um substituto.`;
      const result = await transport.sendMail({ from: emailSender(process.env.EMAIL_USER), to: row.email, subject: 'Designação recusada — substituição necessária', text });
      if (result.rejected?.length) throw new Error('Email rejeitado');
      await client.query('UPDATE designacoes_recusas_avisos SET enviado_em=NOW() WHERE id=$1', [row.id]);
    } catch { /* The durable notification remains available; cron retries failed email deliveries. */ }
  }
}
