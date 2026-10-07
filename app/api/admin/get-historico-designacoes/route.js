import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getPublisherAssignments } from '@/app/lib/publisher-assignments';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET() {
  const client = await pool.connect();
  try {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 90);
    const assignments = await getPublisherAssignments(client, { since: since.toISOString().slice(0, 10) });
    
    return NextResponse.json(assignments.reverse(), { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    return NextResponse.json({ message: 'Erro ao buscar histórico.' }, { status: 500 });
  } finally {
    client.release();
  }
}
