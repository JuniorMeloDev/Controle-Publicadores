import { Pool } from 'pg';
import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/app/lib/request-authorization';
import { getUserIdFromRequest } from '@/app/lib/server-access';
import { registerAuditLog } from '@/app/lib/audit-log';
import { fieldId } from '@/app/lib/field-service';
import { prepareFieldMap, saveFieldMap } from '@/app/lib/field-map';

export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export async function GET(request) {
  const denied = await authorizeRequest(request, 'GET');
  if (denied) return denied;
  let client;
  try {
    const params = new URL(request.url).searchParams;
    const key = params.get('territorio') ? `territorio-${fieldId(params.get('territorio'))}` : 'geral';
    client = await pool.connect();
    const map = (await client.query('SELECT nome, conteudo FROM campo_mapas WHERE chave = $1', [key])).rows[0];
    if (!map) return NextResponse.json({ message: 'Mapa não encontrado.' }, { status: 404 });
    return new NextResponse(new Uint8Array(map.conteudo), { headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': `${params.get('download') === '1' ? 'attachment' : 'inline'}; filename="mapa.pdf"; filename*=UTF-8''${encodeURIComponent(map.nome).replace(/'/g, '%27')}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'"
    } });
  } catch (error) { return NextResponse.json({ message: error.code ? 'Não foi possível abrir o mapa.' : 'Seleção inválida.' }, { status: error.code ? 500 : 400 }); }
  finally { client?.release(); }
}
export async function POST(request) {
  const denied = await authorizeRequest(request, 'POST');
  if (denied) return denied;
  let client;
  let transaction = false;
  try {
    const form = await request.formData();
    let territoryId;
    try { territoryId = fieldId(form.get('territorio'), true); } catch { return NextResponse.json({ message: 'Território inválido.' }, { status: 400 }); }
    const map = await prepareFieldMap(form.get('arquivo'));
    client = await pool.connect();
    await client.query('BEGIN'); transaction = true;
    await client.query('SELECT pg_advisory_xact_lock(73428191)');
    if (territoryId && !(await client.query('SELECT id FROM campo_territorios WHERE id = $1 FOR SHARE', [territoryId])).rows.length) {
      await client.query('ROLLBACK'); transaction = false;
      return NextResponse.json({ message: 'Território não encontrado.' }, { status: 404 });
    }
    const key = await saveFieldMap(client, territoryId, map);
    await registerAuditLog(client, { userId: getUserIdFromRequest(request), action: 'campo_mapa_salvo', entity: 'campo_mapa', entityId: key, details: { nome: map.name, tamanho: map.buffer.length } });
    await client.query('COMMIT'); transaction = false;
    return NextResponse.json({ message: 'Mapa salvo.' });
  } catch (error) {
    if (transaction) await client.query('ROLLBACK');
    return NextResponse.json({ message: error.status ? error.message : 'Não foi possível salvar o mapa.' }, { status: error.status || 500 });
  } finally { client?.release(); }
}
