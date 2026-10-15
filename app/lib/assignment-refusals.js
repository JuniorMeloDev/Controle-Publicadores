import { ensureResponseTables, assignmentVersion } from './assignment-response';
import { getActiveAssignments } from './alert-service';
import { getUserAccess } from './server-access';
import { todayInBrazil } from './alerts';

export async function getRefusalNotifications(client, userId) {
  const access = await getUserAccess(client, userId);
  if (!access?.permissions?.actions?.designacoes_confirmacoes) return [];
  await ensureResponseTables(client);
  const active = await getActiveAssignments(client, { today: todayInBrazil() });
  const versions = active.map(assignmentVersion);
  const { rows } = await client.query(`SELECT n.id, r.dados FROM designacoes_recusas_avisos n
    JOIN designacoes_respostas r ON r.versao=n.versao
    WHERE n.destinatario_id=$1 AND n.versao=ANY($2::text[]) ORDER BY n.criado_em DESC`, [userId, versions]);
  return rows.map(row => ({ id: `recusa:${row.id}`, title: 'Designação recusada',
    detail: `${row.dados.nome_completo || 'Publicador'} — ${row.dados.nome_parte}. Escolha um substituto.`,
    date: String(row.dados.data_reuniao).slice(0, 10), category: 'designacao', href: '/admin/minhas-designacoes', overdue: true }));
}
