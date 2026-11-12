import assert from 'node:assert/strict';
import test from 'node:test';
import { findSharedSchematic, preparedSchematicInfo, readPreparedSchematic } from '../app/lib/territory-schematic-server.js';
import { loadRoute } from './helpers/load-source.mjs';

test('prepared map rejects traversal and a PDF changed since the image was prepared', async () => {
  const client={query:async()=>({rows:[]})};
  await assert.rejects(preparedSchematicInfo(client,'../geral','anything'),e=>e.status===503);
  await assert.rejects(readPreparedSchematic(client,'geral','old-pdf-hash'),e=>e.status===503);
});
test('shared schematic uses active territory tokens and requires no geographical boundary', async () => {
  const calls=[];const client={query:async(sql,values)=>{calls.push({sql,values});return {rows:[]};}};
  assert.equal(await findSharedSchematic(client,'bad'),null);assert.equal(calls.length,0);
  await findSharedSchematic(client,'a'.repeat(43));
  assert.match(calls[0].sql,/JOIN campo_mapas/);assert.match(calls[0].sql,/t.ativo\s*=\s*TRUE/);
  assert.match(calls[0].sql, /AND \(t\.mapa_layout IS NOT NULL OR t\.limites IS NOT NULL OR m\.chave IS NOT NULL\)/);
  assert.ok(!calls[0].sql.includes('publicadores'));
  assert.deepEqual(calls[0].values,['a'.repeat(43)]);
});
test('private diagram authorizes before database access and validates territory selection', async () => {
  let connects=0;
  const Pool=class {async connect(){connects++;throw new Error('Unexpected connection');}};
  let {GET}=loadRoute('../../app/api/admin/servico-campo/esquema/route.js',{Pool,authorizeRequest:async()=>({status:403})});
  assert.equal((await GET({})).status,403);assert.equal(connects,0);
  ({GET}=loadRoute('../../app/api/admin/servico-campo/esquema/route.js',{Pool,authorizeRequest:async()=>null,fieldId:()=>{throw new Error('invalid');}}));
  assert.equal((await GET({url:'https://example.test/api/admin/servico-campo/esquema?territorio=invalid'})).status,400);assert.equal(connects,0);
});
test('public image returns PNG only for an active prepared map and never caches revoked content', async () => {
  let connects=0;const image=Buffer.from('png');
  class Response {constructor(body,options={}){this.body=body;this.headers=options.headers||{};this.status=options.status||200;}static json(body,options={}){return {body,status:options.status||200};}}
  const {GET}=loadRoute('../../app/api/mapa-territorio/[token]/esquema/route.js',{
    Pool:class {async connect(){connects++;return {release(){}};}},NextResponse:Response,
    findSharedSchematic:async()=>({imagem_chave:'territorio-6',imagem_hash:'hash'}),readPreparedSchematic:async()=>image
  });
  assert.equal((await GET({}, {params:Promise.resolve({token:'bad'})})).status,404);assert.equal(connects,0);
  const response=await GET({}, {params:Promise.resolve({token:'a'.repeat(43)})});
  assert.equal(response.status,200);assert.equal(response.headers['Content-Type'],'image/png');assert.equal(response.headers['Cache-Control'],'private, no-store');assert.equal(response.body,image);
});
