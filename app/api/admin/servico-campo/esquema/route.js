import { Pool } from 'pg';
import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/app/lib/request-authorization';
import { fieldId } from '@/app/lib/field-service';
import { readPreparedSchematic, preparedSchematicInfo } from '@/app/lib/territory-schematic-server';
export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export async function GET(request) {
  const denied = await authorizeRequest(request, 'GET'); if (denied) return denied;
  const value = new URL(request.url).searchParams.get('territorio');
  let key;
  try { key = value === null ? 'geral' : `territorio-${fieldId(value)}`; }
  catch { return NextResponse.json({ message: 'Território inválido.' }, { status: 400 }); }
  let client;
  try {
    client = await pool.connect();
    const map = (await client.query('SELECT md5(conteudo) AS hash FROM campo_mapas WHERE chave = $1', [key])).rows[0];
    if (!map) return NextResponse.json({ message: 'Mapa não encontrado.' }, { status: 404 });
    if (new URL(request.url).searchParams.get('meta') === '1') return NextResponse.json(await preparedSchematicInfo(client, key, map.hash), { headers: { 'Cache-Control': 'private, no-store' } });
    const image = await readPreparedSchematic(client, key, map.hash);
    return new NextResponse(image, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return NextResponse.json({ message: error.status ? error.message : 'Não foi possível abrir o esquema.' }, { status: error.status || 500 }); }
  finally { client?.release(); }
}
