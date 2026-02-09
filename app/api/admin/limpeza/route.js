import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { registerAuditLog } from '@/app/lib/audit-log';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const group = searchParams.get('group');

  const client = await pool.connect();

  try {
    let query = `SELECT * FROM limpeza_semanal WHERE 1=1`;
    const params = [];

    if (start) {
      query += ` AND data >= $${params.length + 1}`;
      params.push(start);
    }
    if (end) {
      query += ` AND data <= $${params.length + 1}`;
      params.push(end);
    }
    if (group) {
        query += ` AND grupo ILIKE $${params.length + 1}`;
        params.push(`%${group}%`);
    }

    query += ` ORDER BY data ASC`;

    const res = await client.query(query, params);
    return NextResponse.json(res.rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request) {
  const client = await pool.connect();
  try {
    const userId = getUserIdFromRequest(request);
    const perms = await getUserPermissions(client, userId);
    if (!isAllowed(perms, 'limpeza_semanal_editar', 'actions')) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }
    const body = await request.json();
    const { data, tarefas, grupo, responsaveis } = body;

    const query = `
      INSERT INTO limpeza_semanal (data, tarefas, grupo, responsaveis)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [data, tarefas, grupo, responsaveis];

    const res = await client.query(query, values);
    await registerAuditLog(client, {
      userId,
      action: 'limpeza_criada',
      entity: 'limpeza',
      entityId: res.rows[0]?.id,
      details: { data, grupo }
    });
    return NextResponse.json(res.rows[0]);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(request) {
  const client = await pool.connect();
  try {
    const userId = getUserIdFromRequest(request);
    const perms = await getUserPermissions(client, userId);
    if (!isAllowed(perms, 'limpeza_semanal_editar', 'actions')) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }
    const body = await request.json();
    const { id, data, tarefas, grupo, responsaveis } = body;

    const query = `
      UPDATE limpeza_semanal
      SET data = $1, tarefas = $2, grupo = $3, responsaveis = $4
      WHERE id = $5
      RETURNING *
    `;
    const values = [data, tarefas, grupo, responsaveis, id];

    const res = await client.query(query, values);
    await registerAuditLog(client, {
      userId,
      action: 'limpeza_atualizada',
      entity: 'limpeza',
      entityId: id,
      details: { data, grupo }
    });
    return NextResponse.json(res.rows[0]);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  const client = await pool.connect();
  try {
    const userId = getUserIdFromRequest(request);
    const perms = await getUserPermissions(client, userId);
    if (!isAllowed(perms, 'limpeza_semanal_editar', 'actions')) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }
    await client.query('DELETE FROM limpeza_semanal WHERE id = $1', [id]);
    await registerAuditLog(client, {
      userId,
      action: 'limpeza_excluida',
      entity: 'limpeza',
      entityId: id
    });
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
