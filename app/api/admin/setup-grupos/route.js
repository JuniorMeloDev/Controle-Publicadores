import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function POST(request) {
  const client = await pool.connect();
  try {
    // Adiciona coluna 'ativo' à tabela grupos se não existir
    await client.query(`
      ALTER TABLE grupos
      ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE
    `);

    return NextResponse.json(
      { message: 'Coluna ativo adicionada com sucesso!' },
      { status: 200 }
    );
  } catch (err) {
    console.error('Erro ao adicionar coluna:', err);
    return NextResponse.json(
      { message: 'Erro ao adicionar coluna.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
