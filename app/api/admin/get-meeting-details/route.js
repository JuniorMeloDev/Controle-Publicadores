import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { reconstructLifeMinistryAssignments } from '@/app/lib/life-ministry-parts';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ message: 'Data inválida.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // 1. Fetch Schedule JSON
    const resData = await client.query('SELECT dados_json, descricao_texto FROM reunioes_dados WHERE data_reuniao = $1', [date]);
    if (resData.rows.length === 0) {
      return NextResponse.json({ message: 'Dados não encontrados.' }, { status: 404 });
    }
    const scheduleData = resData.rows[0].dados_json;
    const weekDescription = resData.rows[0].descricao_texto;

    // 2. Fetch Assignments
    const resAssign = await client.query(`
      SELECT d.nome_parte, p.nome_completo, p.nome_chamado
      FROM designacoes_reuniao d
      JOIN publicadores p ON d.publicador_id = p.id
      WHERE d.data_reuniao = $1
      ORDER BY d.id ASC
    `, [date]);

    const assignments = reconstructLifeMinistryAssignments(scheduleData, resAssign.rows);

    return NextResponse.json({
        schedule: scheduleData,
        assignments: assignments,
        weekDescription: weekDescription
    }, { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar detalhes da reunião:', err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
