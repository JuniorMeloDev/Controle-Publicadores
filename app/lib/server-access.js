import { verify } from 'jsonwebtoken';
import { buildAllPermissions, normalizePermissions } from '@/app/lib/access-control';

const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-de-teste-mude-depois';

export const ensureAccessTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS acessos_app (
      publicador_id INTEGER PRIMARY KEY REFERENCES publicadores(id) ON DELETE CASCADE,
      permissoes JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

export const getUserIdFromRequest = (req) => {
  const token = req.cookies.get('auth_token');
  if (!token) return null;
  try {
    const decoded = verify(token.value, JWT_SECRET);
    return decoded.userId;
  } catch {
    return null;
  }
};

export const getUserPermissions = async (client, userId) => {
  if (!userId) return null;

  const userRes = await client.query(
    'SELECT privilegios FROM publicadores WHERE id = $1',
    [userId]
  );
  const privilegios = Array.isArray(userRes.rows[0]?.privilegios) ? userRes.rows[0].privilegios : [];
  const isAdmin = privilegios.includes('anciao') || privilegios.includes('servo_ministerial');
  if (isAdmin) return buildAllPermissions();

  await ensureAccessTable(client);
  const accessRes = await client.query(
    'SELECT permissoes FROM acessos_app WHERE publicador_id = $1',
    [userId]
  );
  const storedPerms = accessRes.rows[0]?.permissoes || null;
  return normalizePermissions(storedPerms);
};
