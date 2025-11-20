// app/api/admin/get-reuniao-dados/route.js
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ message: 'Data obrigatória' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT dados_json 
      FROM reunioes_dados 
      WHERE data_reuniao = $1
    `, [date]);
    
    if (res.rows.length === 0) {
      return NextResponse.json({ message: 'Reunião não encontrada' }, { status: 404 });
    }

    return NextResponse.json(res.rows[0].dados_json, { status: 200 });
  } catch (err) {
    console.error('Erro ao buscar dados da reunião:', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  } finally {
    client.release();
  }
}