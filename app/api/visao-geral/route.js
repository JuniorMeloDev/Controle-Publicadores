import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserAccess } from '@/app/lib/server-access';
import { getCalendarContext, withCalendarState } from '@/app/lib/meeting-calendar-service';
import { addCalendarDays } from '@/app/lib/meeting-calendar';
import { ensureBoardTables, getVisiblePosts } from '@/app/lib/congregation-board-server';
import { getPublisherAssignments } from '@/app/lib/publisher-assignments';
import { recordOverviewChanges, ensureOverviewState } from '@/app/lib/overview-changes-server';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export const dynamic = 'force-dynamic';
const reply = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(req) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return reply({ message: 'Não autenticado.' }, 401);
  let client;
  try {
    client = await pool.connect();
    if (!await getUserAccess(client, userId)) return reply({ message: 'Conta não encontrada.' }, 401);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const context = await getCalendarContext(client);
    const result = await client.query(`SELECT id, data::text, tipo, cancelada, motivo_cancelamento
      FROM reunioes_registro WHERE data >= $1 AND data <= $2 ORDER BY data, id`, [today, addCalendarDays(today, 90)]);
    const calendar = result.rows.map(row => withCalendarState(row, context));
    const meetings = calendar.filter(row => !row.cancelado).slice(0, 6);
    const cancelled = calendar.filter(row => row.cancelado && row.data <= addCalendarDays(today, 7));
    const dates = meetings.map(row => row.data);
    // Publish programme titles only; no contacts, reports or administrative meeting data.
    const programmes = dates.length ? await client.query(`SELECT data_reuniao::text, dados_json FROM reunioes_dados WHERE data_reuniao = ANY($1::date[])`, [dates]) : { rows: [] };
    const speeches = dates.length ? await client.query(`SELECT data::text, tema FROM discursos_publicos WHERE data = ANY($1::date[]) ORDER BY id`, [dates]) : { rows: [] };
    for (const meeting of meetings) {
      const programme = programmes.rows.find(row => row.data_reuniao === meeting.data)?.dados_json;
      meeting.programacao = meeting.tipo === 'Meio de Semana' && programme ? {
        leitura: typeof programme.bibleReading === 'string' ? programme.bibleReading : '',
        secoes: [['treasures', 'Tesouros da Palavra de Deus'], ['ministry', 'Faça Seu Melhor no Ministério'], ['living', 'Nossa Vida Cristã']].map(([key, titulo]) => ({
          titulo, partes: Array.isArray(programme[key]) ? programme[key].map(part => ({ titulo: String(part.title || ''), duracao: Number(part.duration) || null })) : [],
        })),
      } : null;
      meeting.tema = meeting.tipo === 'Fim de Semana' ? speeches.rows.find(row => row.data === meeting.data)?.tema || '' : '';
    }
    const events = await client.query(`SELECT id, data::text, nome, tipo FROM eventos_especiais WHERE data >= $1 ORDER BY data, id LIMIT 6`, [today]);
    await ensureBoardTables(client);
    const assignments = await getPublisherAssignments(client, { publisherId: userId, futureOnly: true });
    const changes = await recordOverviewChanges(client, userId, calendar, assignments, today);
    return reply({ meetings, cancelled, events: events.rows, posts: await getVisiblePosts(client, userId), changes });
  } catch { return reply({ message: 'Não foi possível carregar a agenda da congregação.' }, 500); }
  finally { client?.release(); }
}

export async function POST(req) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return reply({ message: 'Não autenticado.' }, 401);
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return reply({ message: 'Origem da solicitação inválida.' }, 403);
  let body;
  try { body = await req.json(); } catch { return reply({ message: 'Dados inválidos.' }, 400); }
  if (!Array.isArray(body?.ids) || !body.ids.length || body.ids.length > 20 || body.ids.some(id => typeof id !== 'string' || id.length > 200)) return reply({ message: 'Avisos inválidos.' }, 400);
  let client;
  try {
    client = await pool.connect();
    if (!await getUserAccess(client, userId)) return reply({ message: 'Conta não encontrada.' }, 401);
    await ensureOverviewState(client);
    await client.query(`UPDATE visao_geral_estado SET mudancas = COALESCE((
      SELECT jsonb_agg(item) FROM jsonb_array_elements(mudancas) item WHERE NOT (item->>'id' = ANY($2::text[]))
    ), '[]'::jsonb) WHERE publicador_id = $1`, [userId, body.ids]);
    return reply({ message: 'Avisos marcados como vistos.' });
  } catch { return reply({ message: 'Não foi possível marcar os avisos como vistos.' }, 500); }
  finally { client?.release(); }
}
