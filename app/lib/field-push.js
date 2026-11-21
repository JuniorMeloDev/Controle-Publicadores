import { sendNotification } from 'web-push';

export function fieldPushVapid(env = process.env) {
  const { VAPID_SUBJECT: subject, VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = env;
  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

export async function deliverFieldPushes(db, notificationIds, {
  vapid = fieldPushVapid(), send = sendNotification,
} = {}) {
  if (!vapid || !notificationIds.length) return;
  await db.query('DELETE FROM web_push_inscricoes WHERE expira_em <= NOW() OR (publicador_id IS NULL AND NOT avisos_gerais)');
  const { rows } = await db.query(`SELECT n.id::text AS aviso_id, n.saida_id, s.aparelho_id,
      s.endpoint, s.chaves
    FROM campo_saida_notificacoes n JOIN web_push_inscricoes s USING (publicador_id)
    WHERE n.id = ANY($1::bigint[]) AND s.chave_vapid = $2`, [notificationIds, vapid.publicKey]);
  await deliverPushRows(db, rows, row => ({
    payload: { noticeId: row.aviso_id, outingId: row.saida_id },
    topic: `campo-${row.saida_id}`,
  }), vapid, send);
}

export async function deliverGeneralPushes(db, notice, {
  vapid = fieldPushVapid(), send = sendNotification,
} = {}) {
  if (!vapid) return;
  await db.query('DELETE FROM web_push_inscricoes WHERE expira_em <= NOW() OR (publicador_id IS NULL AND NOT avisos_gerais)');
  const { rows } = await db.query(`SELECT aparelho_id, endpoint, chaves
    FROM web_push_inscricoes WHERE avisos_gerais AND chave_vapid = $1`, [vapid.publicKey]);
  await deliverPushRows(db, rows, () => ({ payload: {
    generalId: notice.id, title: notice.titulo, body: notice.mensagem,
  } }), vapid, send);
}

async function deliverPushRows(db, rows, message, vapid, send) {
  let failures = 0;
  for (let i = 0; i < rows.length; i += 10) {
    const results = await Promise.allSettled(rows.slice(i, i + 10).map(async row => {
      try {
        const { payload, topic } = message(row);
        await send({ endpoint: row.endpoint, keys: row.chaves }, JSON.stringify(payload),
          { vapidDetails: vapid, TTL: 3600, ...(topic && { topic }), timeout: 2500 });
      } catch (error) {
        if (![404, 410].includes(error.statusCode)) throw error;
        await db.query(`DELETE FROM web_push_inscricoes
          WHERE aparelho_id = $1 AND endpoint = $2 AND chaves = $3::jsonb`,
        [row.aparelho_id, row.endpoint, JSON.stringify(row.chaves)]);
      }
    }));
    failures += results.filter(result => result.status === 'rejected').length;
  }
  if (failures) console.warn('Falhas na entrega de Web Push:', failures);
}
