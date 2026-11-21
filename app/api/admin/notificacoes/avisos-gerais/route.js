import { Pool } from 'pg';
import { after, NextResponse } from 'next/server';
import { authorizeRequest } from '@/app/lib/request-authorization';
import { getUserIdFromRequest } from '@/app/lib/server-access';
import { registerAuditLog } from '@/app/lib/audit-log';
import { deliverGeneralPushes, fieldPushVapid } from '@/app/lib/field-push';
import { isPushId } from '@/app/lib/push-subscriptions';

export const maxDuration = 60;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function POST(request) {
  const denied = await authorizeRequest(request, 'POST');
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const id = body?.id;
  if (!isPushId(id) || !title || title.length > 80 || !message || message.length > 240) {
    return NextResponse.json({ message: 'Informe um título de até 80 caracteres e uma mensagem de até 240.' }, { status: 400 });
  }
  const vapid = fieldPushVapid();
  if (!vapid) return NextResponse.json({ message: 'As notificações no aparelho ainda não foram configuradas.' }, { status: 503 });
  let client;
  let transaction = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transaction = true;
    const { rows: [notice] } = await client.query(`INSERT INTO web_push_avisos_gerais (id, titulo, mensagem)
      VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING RETURNING id, titulo, mensagem`, [id, title, message]);
    if (notice) {
      await registerAuditLog(client, { userId: getUserIdFromRequest(request), action: 'aviso_geral_publicado',
        entity: 'web_push_avisos_gerais', entityId: id, details: { titulo: title } });
    }
    await client.query('COMMIT');
    transaction = false;
    if (notice) after(async () => {
      try { await deliverGeneralPushes(pool, notice, { vapid }); }
      catch (error) { console.error('Falha ao enviar aviso geral:', error.code || error.name); }
    });
    return NextResponse.json({ id, published: Boolean(notice) }, { status: notice ? 201 : 200 });
  } catch (error) {
    if (transaction) await client.query('ROLLBACK');
    if (error.code === '42P01') return NextResponse.json({ message: 'Aplique a migração de avisos gerais.' }, { status: 503 });
    console.error('Falha ao publicar aviso geral:', error.code || error.name);
    return NextResponse.json({ message: 'Não foi possível publicar o aviso geral.' }, { status: 500 });
  } finally { client?.release(); }
}
