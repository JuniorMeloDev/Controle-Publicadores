import { normalizePermissions } from './access-control.js';
import { getUserAccess, ensureAccessTable } from './server-access.js';
import { registerAuditLog } from './audit-log.js';

export async function updateAccess(client, actorId, { publicadorId, permissoes, superAdmin, mode = 'replace' }) {
  const targetId = Number(publicadorId);
  if (!['add', 'remove', 'replace'].includes(mode) || !Number.isInteger(targetId) || targetId <= 0 || !permissoes || typeof permissoes !== 'object' || Array.isArray(permissoes) || (superAdmin !== undefined && typeof superAdmin !== 'boolean')) {
    return { status: 400, message: 'Dados inválidos.' };
  }
  await ensureAccessTable(client);
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(72904123)');
    const actor = await getUserAccess(client, actorId);
    if (!actor?.isSuperAdmin) { await client.query('ROLLBACK'); return { status: 403, message: 'Somente super admins podem gerenciar acessos.' }; }
    const target = await client.query(`SELECT p.id, a.permissoes, COALESCE(a.super_admin, FALSE) AS super_admin
      FROM publicadores p LEFT JOIN acessos_app a ON a.publicador_id = p.id WHERE p.id = $1`, [targetId]);
    if (!target.rows.length) { await client.query('ROLLBACK'); return { status: 404, message: 'Publicador não encontrado.' }; }
    const nextRole = superAdmin === undefined ? target.rows[0].super_admin : superAdmin;
    if (target.rows[0].super_admin && !nextRole) {
      const count = await client.query('SELECT COUNT(*)::int AS total FROM acessos_app WHERE super_admin = TRUE');
      if (count.rows[0].total <= 1) { await client.query('ROLLBACK'); return { status: 409, message: 'Não é possível remover o último super admin.' }; }
    }
    const permissions = normalizePermissions(permissoes);
    if (mode !== 'replace') {
      const previous = normalizePermissions(target.rows[0].permissoes);
      for (const group of ['pages', 'actions']) {
        for (const key of Object.keys(permissions[group])) {
          permissions[group][key] = permissions[group][key] ? mode === 'add' : previous[group][key];
        }
      }
    }
    await client.query(`INSERT INTO acessos_app (publicador_id, permissoes, super_admin, updated_at)
      VALUES ($1, $2, $3, NOW()) ON CONFLICT (publicador_id) DO UPDATE SET
      permissoes = EXCLUDED.permissoes, super_admin = EXCLUDED.super_admin, updated_at = NOW()`,
    [targetId, JSON.stringify(permissions), nextRole]);
    await registerAuditLog(client, { userId: actorId, action: 'acesso_atualizado', entity: 'publicador', entityId: targetId,
      details: { permissoes: permissions, super_admin: nextRole, mode } });
    await client.query('COMMIT');
    return { status: 200, message: 'Acesso atualizado.', permissions };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
