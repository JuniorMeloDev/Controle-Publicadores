import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserAccess } from '@/app/lib/server-access';
import { getActiveAssignments } from '@/app/lib/alert-service';
import { todayInBrazil, meaningfulAssignments } from '@/app/lib/alerts';
import { withAssignmentResponses } from '@/app/lib/assignment-response';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  const client = await pool.connect();
  try {
    const access = await getUserAccess(client, userId);
    if (!access?.permissions?.actions?.designacoes_confirmacoes) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    const assignments = await getActiveAssignments(client, { today: todayInBrazil() });
    return NextResponse.json({ assignments: await withAssignmentResponses(client, meaningfulAssignments(assignments)) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ message: 'Não foi possível carregar as confirmações.' }, { status: 500 }); }
  finally { client.release(); }
}
