import { cache } from 'react';
import { notFound } from 'next/navigation';
import { Pool } from 'pg';
import { findSharedSchematic, preparedSchematicInfo } from '@/app/lib/territory-schematic-server';
import { TerritoryMapCard } from '@/app/components/designacoes/TerritoryMapCard';

export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
const findTerritory = cache(async token => {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const client = await pool.connect();
  try { return await findSharedSchematic(client, token); }
  finally { client.release(); }
});
export async function generateMetadata({ params }) {
  const { token } = await params;
  const territory = await findTerritory(token);
  return { title: territory ? `Território ${territory.numero}` : 'Mapa de território', description: 'Cartão esquemático do território de serviço de campo.', robots: { index: false, follow: false } };
}
export default async function SharedTerritoryMap({ params }) {
  const { token } = await params;
  const result = await findTerritory(token);
  if (!result) notFound();
  const { imagem_chave: _key, imagem_hash: _hash, ...territory } = result;
  if (territory.mapa_prototipo && territory.mapa_layout) return <TerritoryMapCard territory={territory} congregation={process.env.NEXT_PUBLIC_NOME_CONGREGACAO || 'Praia dos Corais'} />;
  let info;
  const client = await pool.connect();
  try { info = await preparedSchematicInfo(client, result.imagem_chave, result.imagem_hash); }
  catch { return <main className="mx-auto max-w-xl space-y-3 p-8 text-gray-900"><h1 className="text-xl font-bold">Território {result.numero}</h1><p>O cartão está sendo atualizado. Solicite a atualização do mapa ao responsável pelos territórios.</p></main>; }
  finally { client.release(); }
  return <TerritoryMapCard territory={territory} image={{ src: `/api/mapa-territorio/${token}/esquema`, width: info.width, height: info.height }} congregation={process.env.NEXT_PUBLIC_NOME_CONGREGACAO || 'Praia dos Corais'} />;
}
