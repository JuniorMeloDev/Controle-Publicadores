import { Pool } from 'pg';
import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/app/lib/request-authorization';
import { readFieldService, mutateFieldService } from '@/app/lib/field-service-server';
import { registerAuditLog } from '@/app/lib/audit-log';
import { getUserIdFromRequest } from '@/app/lib/server-access';
import { prepareFieldMap, saveFieldMap } from '@/app/lib/field-map';

export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

function failure(error) {
  if (error.code === '42P01') return NextResponse.json({ message: 'O Serviço de Campo precisa da migração do banco de dados.' }, { status: 503 });
  if (error.code === '23505') return NextResponse.json({ message: 'Já existe um cadastro igual ou uma designação aberta para este território.' }, { status: 409 });
  if (error.code === '23503') return NextResponse.json({ message: 'Uma seleção não está mais disponível. Atualize a página.' }, { status: 409 });
  if (error.status) return NextResponse.json({ message: error.message }, { status: error.status });
  console.error('Erro no Serviço de Campo:', error.code || error.name);
  return NextResponse.json({ message: 'Não foi possível concluir a solicitação. Tente novamente.' }, { status: 500 });
}
export async function GET(request) {
  const denied = await authorizeRequest(request, 'GET');
  if (denied) return denied;
  let client;
  try {
    client = await pool.connect();
    return NextResponse.json(await readFieldService(client), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
  finally { client?.release(); }
}
export async function POST(request) {
  const denied = await authorizeRequest(request, 'POST');
  if (denied) return denied;
  let client;
  let transaction = false;
  try {
    let body;
    let map;
    try {
      if (request.headers?.get('content-type')?.includes('multipart/form-data')) {
        const form = await request.formData();
        body = JSON.parse(form.get('dados'));
        if (body.entity !== 'territorios' || body.action !== 'save') return NextResponse.json({ message: 'Anexo não permitido neste cadastro.' }, { status: 400 });
        map = await prepareFieldMap(form.get('arquivo'));
      } else body = await request.json();
    } catch (error) { return NextResponse.json({ message: error.status ? error.message : 'Dados inválidos.' }, { status: 400 }); }
    client = await pool.connect();
    await client.query('BEGIN');
    transaction = true;
    let result;
    try { result = await mutateFieldService(client, body); }
    catch (error) { if (!error.code && !error.status) error.status = 400; throw error; }
    if (map) await saveFieldMap(client, result.id, map);
    await registerAuditLog(client, { userId: getUserIdFromRequest(request), action: `campo_${body.entity}_${body.action}`, entity: `campo_${body.entity}`, entityId: result.id, details: { ...body, ids: result.ids, ...(result.entregas_sincronizadas ? { entregas_anteriores_removidas: result.entregas_anteriores_removidas } : {}), ...(map ? { mapa: map.name } : {}) } });
    await client.query('COMMIT');
    transaction = false;
    return NextResponse.json(result);
  } catch (error) {
    if (transaction) await client.query('ROLLBACK');
    return failure(error);
  } finally { client?.release(); }
}
