import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserAccess } from '@/app/lib/server-access';
import { canManageBoard, validateBoardPost } from '@/app/lib/congregation-board';
import { ensureBoardTables, getVisiblePosts } from '@/app/lib/congregation-board-server';
import { registerAuditLog } from '@/app/lib/audit-log';
import { prepareAttachment } from '@/app/lib/board-attachment';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export const dynamic = 'force-dynamic';
const reply = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(req) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return reply({ message: 'Não autenticado.' }, 401);
  let client;
  try {
    client = await pool.connect();
    const access = await getUserAccess(client, userId);
    if (!access) return reply({ message: 'Conta não encontrada.' }, 401);
    const manage = new URL(req.url).searchParams.get('manage') === '1';
    if (manage && !canManageBoard(access)) return reply({ message: 'Somente anciãos e super admin podem gerenciar o mural.' }, 403);
    await ensureBoardTables(client);
    if (!manage) return reply({ posts: await getVisiblePosts(client, userId) });
    const posts = await client.query(`SELECT m.*, m.inicio::text, m.fim::text, m.data::text,
      g.nome_grupo, a.nome AS anexo_nome FROM mural_congregacao m LEFT JOIN grupos g ON g.id = m.grupo_id
      LEFT JOIN mural_anexos a ON a.publicacao_id = m.id
      ORDER BY m.criado_em DESC`);
    const groups = await client.query('SELECT id, nome_grupo FROM grupos ORDER BY nome_grupo');
    return reply({ posts: posts.rows, groups: groups.rows });
  } catch { return reply({ message: 'Não foi possível carregar o mural.' }, 500); }
  finally { client?.release(); }
}

export async function POST(req) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return reply({ message: 'Não autenticado.' }, 401);
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return reply({ message: 'Origem da solicitação inválida.' }, 403);
  let client;
  let transaction = false;
  try {
    client = await pool.connect();
    const access = await getUserAccess(client, userId);
    if (!access) return reply({ message: 'Conta não encontrada.' }, 401);
    let body;
    let upload = null;
    try {
      if (req.headers.get('content-type')?.includes('multipart/form-data')) {
        if (!canManageBoard(access)) return reply({ message: 'Acesso negado.' }, 403);
        if (Number(req.headers.get('content-length')) > 4 * 1024 * 1024 + 65536) return reply({ message: 'Envie um arquivo de até 4 MB.' }, 413);
        const form = await req.formData();
        body = JSON.parse(form.get('publicacao'));
        const file = form.get('anexo');
        if (file && typeof file !== 'string') upload = await prepareAttachment(file);
      } else body = await req.json();
    } catch (error) { return reply({ message: error instanceof SyntaxError ? 'Dados inválidos.' : error.message || 'Arquivo inválido.' }, 400); }
    if (!body || typeof body !== 'object') return reply({ message: 'Dados inválidos.' }, 400);
    if (body.action !== 'read' && !canManageBoard(access)) return reply({ message: 'Somente anciãos e super admin podem gerenciar o mural.' }, 403);
    const id = Number(body.id);
    if (['read', 'delete'].includes(body.action) || body.id != null) {
      if (!Number.isSafeInteger(id) || id <= 0) return reply({ message: 'Publicação inválida.' }, 400);
    }
    if (!['read', 'delete', 'save'].includes(body.action)) return reply({ message: 'Ação inválida.' }, 400);
    let post;
    await ensureBoardTables(client);
    if (body.action === 'save') {
      let hasAttachment = Boolean(upload);
      if (!hasAttachment && body.tipo === 'material' && body.id != null && body.remover_anexo !== true) {
        hasAttachment = (await client.query('SELECT 1 FROM mural_anexos WHERE publicacao_id = $1', [id])).rows.length > 0;
      }
      try { post = validateBoardPost(body, { hasAttachment }); } catch (error) { return reply({ message: error.message }, 400); }
      if (post.grupo_id && !(await client.query('SELECT id FROM grupos WHERE id = $1', [post.grupo_id])).rows.length) return reply({ message: 'Grupo não encontrado.' }, 400);
    }
    if (body.action === 'read') {
      const visible = await getVisiblePosts(client, userId);
      if (!visible.some(item => item.id === id && item.tipo === 'anuncio')) return reply({ message: 'Anúncio não encontrado.' }, 404);
      await client.query(`INSERT INTO mural_leituras (publicacao_id, publicador_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, userId]);
      return reply({ message: 'Leitura confirmada.' });
    }
    await client.query('BEGIN'); transaction = true;
    let savedId = id;
    if (body.action === 'delete') {
      const result = await client.query('DELETE FROM mural_congregacao WHERE id = $1 RETURNING id', [id]);
      if (!result.rows.length) { await client.query('ROLLBACK'); transaction = false; return reply({ message: 'Publicação não encontrada.' }, 404); }
    } else {
      const fields = Object.keys(post);
      const values = Object.values(post);
      let result;
      if (body.id != null) {
        result = await client.query(`UPDATE mural_congregacao SET ${fields.map((field, index) => `${field} = $${index + 1}`).join(', ')}, atualizado_em = NOW() WHERE id = $${values.length + 1} RETURNING id`, [...values, id]);
        if (!result.rows.length) { await client.query('ROLLBACK'); transaction = false; return reply({ message: 'Publicação não encontrada.' }, 404); }
        // An edited announcement requires a fresh reading confirmation.
        await client.query('DELETE FROM mural_leituras WHERE publicacao_id = $1', [id]);
      } else {
        result = await client.query(`INSERT INTO mural_congregacao (${fields.join(', ')}, autor_id) VALUES (${fields.map((_, index) => `$${index + 1}`).join(', ')}, $${values.length + 1}) RETURNING id`, [...values, userId]);
      }
      savedId = result.rows[0].id;
      if (upload) await client.query(`INSERT INTO mural_anexos (publicacao_id, nome, mime, tamanho, conteudo, previa_html)
        VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (publicacao_id) DO UPDATE SET
        nome = EXCLUDED.nome, mime = EXCLUDED.mime, tamanho = EXCLUDED.tamanho, conteudo = EXCLUDED.conteudo, previa_html = EXCLUDED.previa_html`,
        [savedId, upload.name, upload.mime, upload.buffer.length, upload.buffer, upload.preview]);
      else if (body.remover_anexo === true) await client.query('DELETE FROM mural_anexos WHERE publicacao_id = $1', [savedId]);
    }
    await registerAuditLog(client, { userId, action: body.action === 'delete' ? 'mural_excluido' : 'mural_salvo', entity: 'mural', entityId: savedId });
    await client.query('COMMIT'); transaction = false;
    return reply({ message: body.action === 'delete' ? 'Publicação excluída.' : 'Publicação salva.', id: savedId });
  } catch { if (transaction) await client.query('ROLLBACK'); return reply({ message: 'Não foi possível salvar a publicação.' }, 500); }
  finally { client?.release(); }
}
