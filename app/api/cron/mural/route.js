import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { deliverBoardPushes } from '@/app/lib/board-push';
import { ensureBoardTables } from '@/app/lib/congregation-board-server';
import { fieldPushVapid } from '@/app/lib/field-push';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function GET(request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }
  const vapid = fieldPushVapid();
  if (!vapid) return NextResponse.json({ message: 'Push do mural indisponível.' });
  try {
    await ensureBoardTables(pool);
    const totals = await deliverBoardPushes(pool, { vapid });
    return NextResponse.json(totals, { status: totals.failed ? 503 : 200 });
  } catch (error) {
    console.error('Falha ao processar avisos do mural:', error.code || error.name);
    return NextResponse.json({ message: 'Não foi possível processar os avisos do mural.' }, { status: 500 });
  }
}
