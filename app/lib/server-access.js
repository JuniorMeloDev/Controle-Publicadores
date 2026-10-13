import { verify } from 'jsonwebtoken';
import { buildAllPermissions, normalizePermissions } from '@/app/lib/access-control';

const JWT_SECRET = process.env.JWT_SECRET;

export const ensureAccessTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS acessos_app (
      publicador_id INTEGER PRIMARY KEY REFERENCES publicadores(id) ON DELETE CASCADE,
      permissoes JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await client.query('ALTER TABLE acessos_app ADD COLUMN IF NOT EXISTS super_admin BOOLEAN NOT NULL DEFAULT FALSE');
};

export const getUserIdFromRequest = (req) => {
  const token = req.cookies.get('auth_token');
  if (!token) return null;
  try {
    const decoded = verify(token.value, JWT_SECRET);
    return Number.isSafeInteger(decoded.userId) && decoded.userId > 0 ? decoded.userId : null;
  } catch {
    return null;
  }
};

export const getUserPermissions = async (client, userId) => {
  if (!userId) return null;

  const access = await getUserAccess(client, userId);
  return access?.permissions || null;
};

export async function getUserAccess(client, userId) {
  if (!Number.isInteger(userId) || userId <= 0) return null;
  // Schema changes belong to setup/management, not permission reads on every request.
  const result = await client.query(`SELECT a.permissoes, a.super_admin, p.id, p.nome_completo, p.nome_chamado, p.privilegios
    FROM publicadores p LEFT JOIN acessos_app a ON a.publicador_id = p.id WHERE p.id = $1`, [userId]);
  const row = result.rows[0];
  if (!row) return null;
  const isSuperAdmin = row.super_admin === true;
  return { isSuperAdmin, permissions: isSuperAdmin ? buildAllPermissions() : normalizePermissions(row.permissoes),
    user: { id: userId, nome_completo: row.nome_completo, nome_chamado: row.nome_chamado, privilegios: row.privilegios } };
}
