import { createHash } from 'node:crypto';
import { getActiveAssignments } from './alert-service';
import { assignmentVersion } from './assignment-response';
import { getBellNotifications } from './bell-notifications';
import { deliverPushRows, fieldPushVapid } from './field-push';

export async function deliverBellPushes(client, { today, settings, vapid = fieldPushVapid() }) {
  if (!vapid) return null;
  await client.query('DELETE FROM web_push_inscricoes WHERE expira_em <= NOW()');
  const { rows: subscriptions } = await client.query(`SELECT aparelho_id, publicador_id, endpoint, chaves
    FROM web_push_inscricoes WHERE publicador_id IS NOT NULL AND chave_vapid = $1
    AND (expira_em IS NULL OR expira_em > NOW()) ORDER BY publicador_id`, [vapid.publicKey]);
  if (!subscriptions.length) return { sent: 0, failed: 0, skipped: 0 };
  const active = await getActiveAssignments(client, { today });
  const versions = active.map(assignmentVersion);
  const assignments = new Map();
  for (const item of active) {
    const id = Number(item.publicador_id);
    if (!assignments.has(id)) assignments.set(id, []);
    assignments.get(id).push(item);
  }
  const rows = [];
  const notices = new Map();
  for (const device of subscriptions) {
    const id = device.publicador_id;
    if (!notices.has(id)) {
      const items = await getBellNotifications(client, id, today, {
        settings, versions, assignments: assignments.get(id) || [], includeField: false,
      });
      notices.set(id, items.filter(item => !item.read));
    }
    for (const item of notices.get(id)) rows.push({ ...device, item });
  }
  return deliverPushRows(client, rows, ({ item }) => ({
    payload: { alertId: item.id, category: item.category },
    topic: createHash('sha256').update(item.id).digest('base64url').slice(0, 32),
  }), vapid, undefined, async row => {
    const { rows: claimed } = await client.query(`INSERT INTO web_push_alertas_envios (aparelho_id, publicador_id, notificacao_id)
      SELECT s.aparelho_id, s.publicador_id, $4 FROM web_push_inscricoes s
      WHERE s.aparelho_id = $1 AND s.publicador_id = $2 AND s.endpoint = $3 AND s.chave_vapid = $5
        AND (s.expira_em IS NULL OR s.expira_em > NOW())
        AND NOT EXISTS (SELECT 1 FROM alertas_lidos l WHERE l.publicador_id = s.publicador_id AND l.notificacao_id = $4)
      ON CONFLICT DO NOTHING RETURNING aparelho_id`, [row.aparelho_id, row.publicador_id, row.endpoint, row.item.id, vapid.publicKey]);
    return claimed.length > 0;
  });
}
