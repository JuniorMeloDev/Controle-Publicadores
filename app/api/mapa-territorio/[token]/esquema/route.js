import { Pool } from 'pg';
import { NextResponse } from 'next/server';
import { findSharedSchematic, readPreparedSchematic } from '@/app/lib/territory-schematic-server';
export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export async function GET(_request, { params }) {
  const { token } = await params;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return NextResponse.json({ message: 'Link inválido.' }, { status: 404 });
  let client;
  try {
    client = await pool.connect(); const map = await findSharedSchematic(client, token);
    if (!map) return NextResponse.json({ message: 'Mapa não encontrado.' }, { status: 404 });
    const image = await readPreparedSchematic(client, map.imagem_chave, map.imagem_hash);
    return new NextResponse(image, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return NextResponse.json({ message: error.status ? error.message : 'Não foi possível abrir o mapa.' }, { status: error.status || 500 }); }
  finally { client?.release(); }
}
