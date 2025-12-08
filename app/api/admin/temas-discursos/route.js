
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS temas_discursos (
      id SERIAL PRIMARY KEY,
      numero INTEGER UNIQUE NOT NULL,
      tema VARCHAR(255) NOT NULL
    );
  `);
}

export async function GET(request) {
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const { rows } = await client.query('SELECT * FROM temas_discursos ORDER BY numero ASC');
    return NextResponse.json(rows);
  } catch (err) {
    console.error('Erro ao buscar temas:', err);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  } finally {
    client.release();
  }
}
