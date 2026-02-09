import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { registerAuditLog } from '@/app/lib/audit-log';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-de-teste-mude-depois';

async function ensureAccessTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS acessos_app (
      publicador_id INTEGER PRIMARY KEY REFERENCES publicadores(id) ON DELETE CASCADE,
      permissoes JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getUserRole(client, userId) {
  const res = await client.query(
    'SELECT privilegios FROM publicadores WHERE id = $1',
    [userId]
  );
  const privilegios = Array.isArray(res.rows[0]?.privilegios) ? res.rows[0].privilegios : [];
  return {
    isAnciao: privilegios.includes('anciao'),
    isServo: privilegios.includes('servo_ministerial'),
  };
}

export async function GET(req) {
  const client = await pool.connect();
  try {
    const token = req.cookies.get('auth_token');
    if (!token) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

    const decoded = verify(token.value, JWT_SECRET);
    const role = await getUserRole(client, decoded.userId);
    if (!role.isAnciao) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    await ensureAccessTable(client);

    const publicadoresRes = await client.query(`
      SELECT id, nome_completo, nome_chamado, privilegios
      FROM publicadores
      ORDER BY nome_completo ASC
    `);

    const acessosRes = await client.query(
      'SELECT publicador_id, permissoes FROM acessos_app'
    );

    return NextResponse.json({
      publicadores: publicadoresRes.rows,
      acessos: acessosRes.rows
    });
  } catch (err) {
    console.error('Erro na gestão de acessos (GET):', err);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req) {
  const client = await pool.connect();
  try {
    const token = req.cookies.get('auth_token');
    if (!token) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

    const decoded = verify(token.value, JWT_SECRET);
    const role = await getUserRole(client, decoded.userId);
    if (!role.isAnciao) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    await ensureAccessTable(client);
    const body = await req.json();
    const { publicadorId, permissoes } = body;

    if (!publicadorId || !permissoes) {
      return NextResponse.json({ message: 'Dados inválidos' }, { status: 400 });
    }

    await client.query(
      `
        INSERT INTO acessos_app (publicador_id, permissoes, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (publicador_id)
        DO UPDATE SET permissoes = EXCLUDED.permissoes, updated_at = NOW()
      `,
      [publicadorId, JSON.stringify(permissoes)]
    );

    await registerAuditLog(client, {
      userId: decoded.userId,
      action: 'acesso_atualizado',
      entity: 'publicador',
      entityId: publicadorId,
      details: { permissoes }
    });

    return NextResponse.json({ message: 'Permissões atualizadas' });
  } catch (err) {
    console.error('Erro na gestão de acessos (POST):', err);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  } finally {
    client.release();
  }
}
