import { authorizeRequest } from '@/app/lib/request-authorization';
import { emergencyContactsValue } from '@/app/lib/emergency-contacts';
import { NextResponse } from 'next/server';
import { cadastroPool, ensureCadastroTables, applyCadastroField } from '@/app/lib/cadastro-update-server';
import { personalData } from '@/app/lib/cadastro-update';
import { getUserIdFromRequest, getUserAccess } from '@/app/lib/server-access';
import { registerAuditLog } from '@/app/lib/audit-log';
import { getCadastroProgress } from '@/app/lib/cadastro-progress';
export const dynamic = 'force-dynamic';
async function access(client, request) {
  const userId = getUserIdFromRequest(request);
  const role = await getUserAccess(client, userId);
  return userId && role?.isSuperAdmin === true ? userId : null;
}
export async function GET(request) {
  const denied = await authorizeRequest(request, 'GET');
  if (denied) return denied;
  const client = await cadastroPool.connect();
  try {
    if (!await access(client, request)) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    await ensureCadastroTables(client);
    if (request.url && new URL(request.url).searchParams.get('acompanhamento') === '1') {
      return NextResponse.json(await getCadastroProgress(client), { headers: { 'Cache-Control': 'private, no-store' } });
    }
    const result = await client.query(`SELECT a.*, p.nome_completo,
      to_jsonb(p) ->> a.campo AS valor_atual FROM cadastro_alteracoes a JOIN publicadores p ON p.id = a.publicador_id
      WHERE a.status = 'pendente' OR a.id IN (SELECT id FROM cadastro_alteracoes WHERE status <> 'pendente' ORDER BY criado_em DESC, id DESC LIMIT 1000)
      ORDER BY (a.status = 'pendente') DESC, a.criado_em DESC, a.id DESC`);
    return NextResponse.json(result.rows, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { console.error('Atualizações cadastrais:', error); return NextResponse.json({ message: 'Erro ao carregar atualizações.' }, { status: 500 }); }
  finally { client.release(); }
}
export async function POST(request) {
  const denied = await authorizeRequest(request, 'POST');
  if (denied) return denied;
  let body;
  try {
    body = await request.json();
    if (!['aprovar', 'rejeitar'].includes(body.acao) || !Array.isArray(body.ids) || !body.ids.length || body.ids.length > 100 || body.ids.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(body.ids).size !== body.ids.length) throw new Error();
  } catch { return NextResponse.json({ message: 'Solicitação inválida.' }, { status: 400 }); }
  const client = await cadastroPool.connect();
  try {
    const userId = await access(client, request);
    if (!userId) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    await ensureCadastroTables(client);
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(72904123)');
    if (!await access(client, request)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: 'Somente super admins podem validar alterações.' }, { status: 403 });
    }
    // Lock publishers first: same order used by public submissions, avoiding races and deadlocks.
    const publishers = await client.query(`SELECT * FROM publicadores WHERE id IN
      (SELECT publicador_id FROM cadastro_alteracoes WHERE id = ANY($1::int[])) ORDER BY id FOR UPDATE`, [body.ids]);
    const rows = await client.query(`SELECT * FROM cadastro_alteracoes WHERE id = ANY($1::int[]) AND status = 'pendente' ORDER BY id FOR UPDATE`, [body.ids]);
    if (rows.rows.length !== body.ids.length) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: 'Uma solicitação já foi revisada. Atualize a lista.' }, { status: 409 });
    }
    const current = new Map(publishers.rows.map(row => [row.id, personalData(row)]));
    for (const change of rows.rows) {
      if (body.acao === 'aprovar') {
        const data = current.get(change.publicador_id);
        const oldValue = change.campo === 'contatos_emergencia' ? emergencyContactsValue(data[change.campo]) : data[change.campo];
        if (oldValue !== (change.valor_antigo || '')) {
          await client.query('ROLLBACK');
          return NextResponse.json({ message: 'O cadastro mudou desde este envio. Confira o valor atual e rejeite a proposta antiga ou faça a correção diretamente no cadastro.' }, { status: 409 });
        }
        await applyCadastroField(client, change.publicador_id, change.campo, oldValue, change.valor_novo);
        data[change.campo] = change.campo === 'contatos_emergencia' ? JSON.parse(change.valor_novo) : change.valor_novo;
      }
      await client.query(`UPDATE cadastro_alteracoes SET status = $1, revisado_em = NOW(), revisado_por = $2 WHERE id = $3`, [body.acao === 'aprovar' ? 'aprovado' : 'rejeitado', userId, change.id]);
    }
    await registerAuditLog(client, { userId, action: 'cadastro_atualizacao_' + body.acao, entity: 'publicadores', details: { ids: body.ids } });
    await client.query('COMMIT');
    return NextResponse.json({ message: 'Revisão salva.' });
  } catch (error) {
    await client.query('ROLLBACK'); console.error('Revisão cadastral:', error);
    return NextResponse.json({ message: 'Não foi possível salvar a revisão.' }, { status: 500 });
  } finally { client.release(); }
}
