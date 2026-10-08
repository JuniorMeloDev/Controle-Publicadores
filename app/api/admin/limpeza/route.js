import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { registerAuditLog } from '@/app/lib/audit-log';
import { getCalendarContext, withCalendarState, lockAssignmentMeeting } from '@/app/lib/meeting-calendar-service';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const group = searchParams.get('group');
  const month = searchParams.get('month');

  const client = await pool.connect();

  try {
    const context = await getCalendarContext(client);
    let query = `SELECT l.*, COALESCE(r.data, l.data) AS data, r.id AS reuniao_id,
        r.tipo, r.cancelada, r.motivo_cancelamento
        FROM reunioes_registro r FULL OUTER JOIN (
          SELECT l.*, COALESCE(l.reuniao_id, legacy.id) AS calendario_id
          FROM limpeza_semanal l LEFT JOIN reunioes_registro legacy ON legacy.data = l.data
        ) l ON l.calendario_id = r.id WHERE 1=1`;
    const params = [];

    if (start) {
      query += ` AND COALESCE(r.data, l.data) >= $${params.length + 1}`;
      params.push(start);
    }
    if (end) {
      query += ` AND COALESCE(r.data, l.data) <= $${params.length + 1}`;
      params.push(end);
    }
    if (group) {
        query += ` AND l.grupo ILIKE $${params.length + 1}`;
        params.push(`%${group}%`);
    }
    if (month) {
      query += ` AND EXTRACT(MONTH FROM COALESCE(r.data, l.data)) = $${params.length + 1}`;
      params.push(Number(month));
    }

    query += ` ORDER BY COALESCE(r.data, l.data) ASC`;

    const res = await client.query(query, params);
    return NextResponse.json(res.rows.map(row => withCalendarState(row, context)));
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
    const { tarefas, grupo, responsaveis } = body;
    let { data, reuniao_id } = body;
    await client.query('BEGIN');
    if (!tarefas?.trim() || !grupo?.trim()) throw new Error('Informe as tarefas e o grupo.');
    if (!reuniao_id) {
      const match = await client.query('SELECT id FROM reunioes_registro WHERE data = $1', [data]);
      reuniao_id = match.rows[0]?.id;
    }
    if (reuniao_id) {
      const meeting = await lockAssignmentMeeting(client, reuniao_id);
      data = meeting.data;
      const existing = await client.query('SELECT id FROM limpeza_semanal WHERE reuniao_id = $1 OR (reuniao_id IS NULL AND data = $2)', [reuniao_id, data]);
      if (existing.rows.length) throw new Error('Esta reunião já possui uma designação de limpeza. Atualize a lista antes de editar.');
    }

    const query = `
      INSERT INTO limpeza_semanal (data, tarefas, grupo, responsaveis, reuniao_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [data, tarefas, grupo, responsaveis, reuniao_id || null];

    const res = await client.query(query, values);
    await registerAuditLog(client, {
      userId,
      action: 'limpeza_criada',
      entity: 'limpeza',
      entityId: res.rows[0]?.id,
      details: { data, grupo }
    });
    await client.query('COMMIT');
    return NextResponse.json(res.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: error.code ? 'Erro ao salvar limpeza.' : error.message }, { status: error.code ? 500 : 400 });
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
    const { id, tarefas, grupo, responsaveis } = body;
    let { data, reuniao_id } = body;
    await client.query('BEGIN');
    if (!tarefas?.trim() || !grupo?.trim()) throw new Error('Informe as tarefas e o grupo.');
    const existing = await client.query('SELECT * FROM limpeza_semanal WHERE id = $1', [id]);
    if (!existing.rows.length) throw new Error('Designação de limpeza não encontrada.');
    reuniao_id = existing.rows[0].reuniao_id || reuniao_id;
    if (reuniao_id) data = (await lockAssignmentMeeting(client, reuniao_id)).data;

    const query = `
      UPDATE limpeza_semanal
      SET data = $1, tarefas = $2, grupo = $3, responsaveis = $4, reuniao_id = $6
      WHERE id = $5
      RETURNING *
    `;
    const values = [data, tarefas, grupo, responsaveis, id, reuniao_id || null];

    const res = await client.query(query, values);
    await registerAuditLog(client, {
      userId,
      action: 'limpeza_atualizada',
      entity: 'limpeza',
      entityId: id,
      details: { data, grupo }
    });
    await client.query('COMMIT');
    return NextResponse.json(res.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: error.code ? 'Erro ao salvar limpeza.' : error.message }, { status: error.code ? 500 : 400 });
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
