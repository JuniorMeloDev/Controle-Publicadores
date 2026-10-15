import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserAccess } from '@/app/lib/server-access';
import { getActiveAssignments } from '@/app/lib/alert-service';
import { todayInBrazil } from '@/app/lib/alerts';
import { assignmentVersion, hashToken, ensureResponseTables, recordAssignmentResponse } from '@/app/lib/assignment-response';
import { deliverRefusalEmails } from '@/app/lib/assignment-response-email';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export const dynamic = 'force-dynamic';
const reply = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });

async function handle(request, save) {
  let client, committed = false;
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return reply({ message: 'Origem inválida.' }, 403);
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ message: 'Dados inválidos.' }, 400);
    if (save && !['sim', 'nao'].includes(body.resposta)) return reply({ message: 'Resposta inválida.' }, 400);
    client = await pool.connect();
    await ensureResponseTables(client);
    let publisherId, version, source;
    if (body.token !== undefined) {
      if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) return reply({ message: 'Link inválido.' }, 400);
      const result = await client.query('SELECT r.publicador_id, r.versao FROM designacoes_respostas r JOIN designacoes_respostas_tokens t ON t.versao=r.versao WHERE t.token_hash=$1 AND r.expira_em > NOW()', [hashToken(body.token)]);
      if (!result.rows.length) return reply({ message: 'Link inválido ou expirado.' }, 410);
      publisherId = result.rows[0].publicador_id; version = result.rows[0].versao; source = 'email';
    } else {
      publisherId = getUserIdFromRequest(request);
      if (!publisherId || !await getUserAccess(client, publisherId)) return reply({ message: 'Entre novamente no aplicativo.' }, 401);
      version = body.versao; source = 'app';
    }
    const assignments = await getActiveAssignments(client, { publisherId, today: todayInBrazil() });
    const assignment = assignments.find(a => assignmentVersion(a) === version);
    if (!assignment) return reply({ message: 'Esta designação foi alterada, cancelada ou já passou. Consulte suas designações atuais.' }, 410);
    if (save) {
      await client.query('BEGIN');
      const recorded = await recordAssignmentResponse(client, assignment, body.resposta, source);
      await client.query('COMMIT'); committed = true;
      if (!recorded) return reply({ message: 'Esta designação já recebeu uma resposta. Atualize a página para consultar.' }, 409);
    }
    const result = await client.query('SELECT resposta FROM designacoes_respostas WHERE versao=$1', [version]);
    if (save && body.resposta === 'nao') {
      try { await deliverRefusalEmails(client); } catch { /* Cron retries; the response is already committed. */ }
    }
    return reply({ assignment, resposta: result.rows[0]?.resposta || 'sem_resposta', message: 'Resposta registrada.' });
  } catch (error) {
    if (client && !committed) await client.query('ROLLBACK').catch(() => {});
    return reply({ message: error instanceof SyntaxError ? 'Dados inválidos.' : 'Não foi possível processar a resposta. Tente novamente.' }, error instanceof SyntaxError ? 400 : 500);
  } finally { client?.release(); }
}
// Both operations use POST so bearer tokens never appear in query strings or request logs.
export async function POST(request) { return handle(request, true); }
export async function PUT(request) { return handle(request, false); }
