import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBoundary, checkBoundaryPlacement } from '../app/lib/territory-boundaries.js';
import { saveTerritoryBoundary, findPublicTerritory } from '../app/lib/territory-boundaries-server.js';
import { loadRoute } from './helpers/load-source.mjs';

const box = (x, y, w = 0.01, h = w) => ({ type: 'Polygon', coordinates: [[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]] });
const general = box(-35, -9, 0.1);
const territory = box(-34.99, -8.99);

test('boundaries reject unclosed, degenerate, duplicate and self-crossing geometry', () => {
  assert.deepEqual(validateBoundary(territory), territory);
  for (const value of [null, {}, { type:'Point',coordinates:[1,2] }, { ...territory, coordinates: [] }, { type:'Polygon',coordinates:[[[0,0],[1,1],[0,1],[1,0],[0,0]]] }, { type:'Polygon',coordinates:[[[0,0],[1,1],[2,2],[0,0]]] }, { type:'Polygon',coordinates:[[[0,0],[1,0],[1,0],[0,0]]] }, { type:'Polygon',coordinates:[[[0,0],[1,0],[0,100],[0,0]]] }]) assert.throws(() => validateBoundary(value));
});
test('territories must fit the general boundary, cannot overlap and can share a border', () => {
  checkBoundaryPlacement(territory, general);
  assert.throws(() => checkBoundaryPlacement(territory, null), /geral/);
  assert.throws(() => checkBoundaryPlacement(box(-36,-9),general), /dentro/);
  assert.throws(() => checkBoundaryPlacement(territory,general,[{numero:1,limites:territory}]), /sobrepõe/);
  checkBoundaryPlacement(box(-34.98,-8.99),general,[{numero:1,limites:territory}]);
  assert.throws(() => checkBoundaryPlacement(box(-34.995,-8.995,0.03),general,[{numero:1,limites:territory}]), /sobrepõe/);
});
function clientFixture(revision = 0) {
  const calls = [];
  return { calls, async query(sql, values) {
    calls.push({sql,values});
    if(sql.includes('FROM campo_mapa_geral')) return {rows:[{limites:general,revisao:0}]};
    if(sql.includes('FROM campo_territorios')) return {rows:[{id:1,numero:1,mapa_revisao:revision,ativo:true}]};
    return {rows:[]};
  } };
}
test('boundary updates reject stale revisions and persist a stable public token', async () => {
  const client = clientFixture();
  await saveTerritoryBoundary(client,{territorio:1,revisao:0,limites:territory});
  const update = client.calls.find(c => c.sql.startsWith('UPDATE campo_territorios'));
  assert.match(update.values[2], /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(JSON.parse(update.values[1]),territory);
  assert.match(update.sql,/COALESCE\(mapa_share_token/);
  const stale = clientFixture(1);
  await assert.rejects(saveTerritoryBoundary(stale,{territorio:1,revisao:0,limites:territory}), /Outra pessoa/);
  assert.ok(!stale.calls.some(c=>c.sql.startsWith('UPDATE')));
  await assert.rejects(saveTerritoryBoundary(client,{territorio:'invalid',revisao:0,limites:territory}),e=>e.status===400);
});
test('public links reject malformed tokens and select only active published territory details', async () => {
  const client = clientFixture();
  assert.equal(await findPublicTerritory(client,'invalid'),null);
  assert.equal(client.calls.length,0);
  await findPublicTerritory(client,'a'.repeat(43));
  assert.match(client.calls[0].sql,/ativo = TRUE AND limites IS NOT NULL/);
  assert.ok(!client.calls[0].sql.includes('publicadores'));
  assert.ok(!client.calls[0].sql.includes('conteudo'));
});
test('boundary API authorizes before database access and rolls back when audit fails', async () => {
  let connects = 0; const calls=[];
  const dependencies={
    Pool:class { async connect(){ connects++; return {release(){},query:async sql=>{calls.push(sql);return {rows:[]};}}; } },
    authorizeRequest:async()=>({status:403}),
    readTerritoryBoundaries:async()=>({}), saveTerritoryBoundary:async()=>({id:1,revisao:1}),
    getUserIdFromRequest:()=>1,registerAuditLog:async()=>{throw new Error('audit');}
  };
  let handlers=loadRoute('../../app/api/admin/servico-campo/limites/route.js',dependencies);
  assert.equal((await handlers.POST({})).status,403);assert.equal(connects,0);
  handlers=loadRoute('../../app/api/admin/servico-campo/limites/route.js',{...dependencies,authorizeRequest:async()=>null});
  assert.equal((await handlers.POST({json:async()=>({})})).status,500);
  assert.ok(calls.includes('ROLLBACK'));assert.ok(!calls.includes('COMMIT'));
});
