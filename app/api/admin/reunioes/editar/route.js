import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { isCalendarDate, dateOnly } from '@/app/lib/meeting-calendar';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function POST(request) {
  const body = await request.json();
  const { id, nova_data } = body;

  if (!Number.isInteger(Number(id)) || Number(id) <= 0 || !isCalendarDate(nova_data)) {
    return NextResponse.json({ message: 'ID e data são obrigatórios.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    const permissions = await getUserPermissions(client, getUserIdFromRequest(request));
    if (!isAllowed(permissions, 'configuracoes_editar', 'actions')) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    await client.query('BEGIN');

    // Verify meeting exists
    const meetingRes = await client.query('SELECT * FROM reunioes_registro WHERE id = $1 FOR UPDATE', [id]);
    if (meetingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: 'Reunião não encontrada.' }, { status: 404 });
    }

    const meeting = meetingRes.rows[0];
    const oldDate = dateOnly(meeting.data);
    const conflict = await client.query('SELECT id FROM reunioes_registro WHERE data = $1 AND id <> $2', [nova_data, id]);
    if (conflict.rows.length) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: 'Já existe uma reunião na data de destino.' }, { status: 409 });
    }
    // Synchronize the legacy date columns too: reports and notifications still read them.
    if (meeting.tipo === 'Meio de Semana') {
      await client.query('UPDATE reunioes_dados SET data_reuniao = $1, reuniao_id = $2 WHERE reuniao_id = $2 OR (reuniao_id IS NULL AND data_reuniao = $3)', [nova_data, id, oldDate]);
      await client.query('UPDATE designacoes_reuniao SET data_reuniao = $1, reuniao_id = $2 WHERE reuniao_id = $2 OR (reuniao_id IS NULL AND data_reuniao = $3)', [nova_data, id, oldDate]);
    }
    if (meeting.tipo === 'Fim de Semana') {
      await client.query('UPDATE discursos_publicos SET data = $1, reuniao_id = $2 WHERE reuniao_id = $2 OR (reuniao_id IS NULL AND data = $3)', [nova_data, id, oldDate]);
    }
    await client.query('UPDATE limpeza_semanal SET data = $1, reuniao_id = $2 WHERE reuniao_id = $2 OR (reuniao_id IS NULL AND data = $3)', [nova_data, id, oldDate]);
    await client.query('UPDATE reunioes_registro SET data = $1 WHERE id = $2', [nova_data, id]);

    await client.query('COMMIT');

    return NextResponse.json({ message: 'Data alterada com sucesso.' }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/admin/reunioes/editar] Erro ao editar reunião:', err);
    await client.query('ROLLBACK');
    return NextResponse.json({ message: err.code === '23505' ? 'Existem registros conflitantes na data de destino. Revise a programação antes de mover.' : 'Erro interno ao editar reunião.' }, { status: err.code === '23505' ? 409 : 500 });
  } finally {
    client.release();
  }
}
