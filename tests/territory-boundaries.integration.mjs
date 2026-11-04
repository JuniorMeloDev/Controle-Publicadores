import assert from 'node:assert/strict';
import env from '@next/env';
import pg from 'pg';
import { saveTerritoryBoundary, readTerritoryBoundaries, findPublicTerritory } from '../app/lib/territory-boundaries-server.js';
env.loadEnvConfig(process.cwd());
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
const client = await pool.connect();
const box = (x, y, w) => ({ type:'Polygon',coordinates:[[[x,y],[x+w,y],[x+w,y+w],[x,y+w],[x,y]]] });
try {
  await client.query('BEGIN');
  // Session-local copies exercise the migrated schema without editing congregation data.
  await client.query('CREATE TEMP TABLE campo_territorios (LIKE public.campo_territorios INCLUDING DEFAULTS) ON COMMIT DROP');
  await client.query('CREATE TEMP TABLE campo_mapa_geral (LIKE public.campo_mapa_geral INCLUDING DEFAULTS) ON COMMIT DROP');
  await client.query('INSERT INTO campo_mapa_geral (id) VALUES (1)');
  await client.query('INSERT INTO campo_territorios (id,numero) VALUES (1,1),(2,2)');
  await saveTerritoryBoundary(client,{territorio:null,revisao:0,limites:box(-35,-9,0.1)});
  await saveTerritoryBoundary(client,{territorio:1,revisao:0,limites:box(-34.99,-8.99,0.01)});
  let snapshot = await readTerritoryBoundaries(client);
  const token = snapshot.territorios[0].mapa_share_token;
  assert.match(token,/^[A-Za-z0-9_-]{43}$/);
  const shared = await findPublicTerritory(client,token);
  assert.equal(shared.numero,1);
  assert.deepEqual(Object.keys(shared).sort(),['descricao','limites','numero','referencias']);
  await assert.rejects(saveTerritoryBoundary(client,{territorio:1,revisao:0,limites:box(-34.99,-8.99,0.01)}),e=>e.status===409);
  await assert.rejects(saveTerritoryBoundary(client,{territorio:2,revisao:0,limites:box(-34.99,-8.99,0.01)}),/sobrepõe/);
  await assert.rejects(saveTerritoryBoundary(client,{territorio:null,revisao:1,limites:box(-35,-9,0.005)}),/dentro/);
  await saveTerritoryBoundary(client,{territorio:1,revisao:1,limites:box(-34.98,-8.98,0.01)});
  snapshot = await readTerritoryBoundaries(client);
  assert.equal(snapshot.territorios[0].mapa_share_token,token);
  await client.query('UPDATE campo_territorios SET ativo = FALSE WHERE id = 1');
  assert.equal(await findPublicTerritory(client,token),null);
  console.log('Integração dos limites aprovada: gravação, revisão, sobreposição, link público e desativação.');
} finally {
  await client.query('ROLLBACK');client.release();await pool.end();
  console.log('Dados de teste descartados; mapas e territórios originais preservados.');
}
