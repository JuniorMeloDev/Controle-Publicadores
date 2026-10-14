import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserAccess } from '@/app/lib/server-access';
import { canManageBoard } from '@/app/lib/congregation-board';
import { ensureBoardTables, getVisiblePosts } from '@/app/lib/congregation-board-server';
import { attachmentPreview } from '@/app/lib/board-attachment';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const reply = (message, status) => NextResponse.json({ message }, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(req, { params }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return reply('Não autenticado.', 401);
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return reply('Anexo não encontrado.', 404);
  let client;
  try {
    client = await pool.connect();
    const access = await getUserAccess(client, userId);
    if (!access) return reply('Conta não encontrada.', 401);
    await ensureBoardTables(client);
    if (!canManageBoard(access) && !(await getVisiblePosts(client, userId)).some(post => post.id === id)) return reply('Anexo não encontrado.', 404);
    const result = await client.query('SELECT nome, mime, conteudo, previa_html FROM mural_anexos WHERE publicacao_id = $1', [id]);
    const file = result.rows[0];
    if (!file) return reply('Anexo não encontrado.', 404);
    const download = new URL(req.url).searchParams.get('download') === '1';
    const html = !download && file.previa_html !== null;
    const name = encodeURIComponent(file.nome).replace(/['()*]/g, char => '%' + char.charCodeAt(0).toString(16));
    return new Response(html ? attachmentPreview(file.nome, file.previa_html) : new Uint8Array(file.conteudo), { headers: {
      'Content-Type': html ? 'text/html; charset=utf-8' : file.mime,
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${name}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': html ? "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'; sandbox" : "frame-ancestors 'self'",
    } });
  } catch { return reply('Não foi possível abrir o anexo.', 500); }
  finally { client?.release(); }
}
