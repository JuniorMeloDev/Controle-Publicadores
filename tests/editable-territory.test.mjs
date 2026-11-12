import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEditableLayout,layoutFromBoundary,editableDrawingBounds } from '../app/lib/editable-territory.js';
import { saveEditableTerritory, readEditableTerritory } from '../app/lib/editable-territory-server.js';
import { loadRoute } from './helpers/load-source.mjs';
const layout={version:1,outline:[[100,100],[800,100],[800,600],[100,600]],roads:[{id:'road',name:'Rua A',points:[[100,300],[800,300]]}],landmarks:[{id:'school',name:'Escola',position:[600,200],kind:'school'}]};
test('editable map validates geometry and bounded content without fixed group or territory counts',()=>{
  assert.deepEqual(validateEditableLayout(layout),layout);
  for(const value of [null,{...layout,outline:[[0,0],[900,600],[0,600],[900,0]]},{...layout,outline:[[0,0],[1001,0],[0,50]]},{...layout,roads:[{...layout.roads[0],name:'',points:[[1,2]]}]},{...layout,landmarks:[{...layout.landmarks[0],id:'road'}]}])assert.throws(()=>validateEditableLayout(value));
  const initial=layoutFromBoundary({coordinates:[[[-35,-9],[-34.99,-9],[-34.99,-8.99],[-35,-9]]]},'Referência');
  assert.equal(initial.landmarks[0].name,'Referência');assert.equal(initial.outline.length,3);
});
function fixture({revision=0,pilot=true,groupRevision=0}={}){const calls=[];return{calls,async query(sql,values){calls.push({sql,values});if(sql.includes('FROM campo_territorios'))return{rows:[{id:41,mapa_prototipo:pilot,mapa_layout_revisao:revision,mapa_grupo_id:9}]};if(sql.includes('FROM grupos'))return{rows:[{id:9,ativo:true,cor_mapa:'#0284c7',cor_mapa_revisao:groupRevision}]};return{rows:[]};}};}
const body={territorio:41,numero:77,grupo_id:9,cor:'#ff0000',grupo_revisao:0,revisao:0,layout};
test('street font sizes survive saving and reject invalid values',async()=>{
  const drawing={...layout,roads:[{...layout.roads[0],labelFontSize:12}]};
  const client=fixture();
  await saveEditableTerritory(client,{...body,layout:drawing});
  const update=client.calls.find(call=>call.sql.startsWith('UPDATE campo_territorios'));
  const stored=JSON.parse(update.values.find(value=>typeof value==='string'&&value.startsWith('{')));
  assert.equal(stored.roads[0].labelFontSize,12);
  for(const labelFontSize of [NaN,Infinity,7,33,'12',null]){
    assert.throws(()=>validateEditableLayout({...layout,roads:[{...layout.roads[0],labelFontSize}]}));
  }
});
test('reference icon categories survive saving',async()=>{
  const kinds=['reference','school','shop','square','pharmacy','supermarket','restaurant','bakery','church','hairdresser','hospital'];
  const drawing={...layout,landmarks:kinds.map(kind=>({...layout.landmarks[0],id:kind,kind}))};
  const client=fixture();
  await saveEditableTerritory(client,{...body,layout:drawing});
  const update=client.calls.find(call=>call.sql.startsWith('UPDATE campo_territorios'));
  const stored=JSON.parse(update.values.find(value=>typeof value==='string'&&value.startsWith('{')));
  assert.deepEqual(stored.landmarks.map(marker=>marker.kind),kinds);
});
test('reference label rotation survives saving and rejects invalid angles',async()=>{
  const rotated={...layout,landmarks:[{...layout.landmarks[0],labelRotation:-75}]};
  assert.equal(validateEditableLayout(rotated).landmarks[0].labelRotation,-75);
  const client=fixture();
  await saveEditableTerritory(client,{...body,layout:rotated});
  const update=client.calls.find(call=>call.sql.startsWith('UPDATE campo_territorios'));
  const stored=update.values.find(value=>typeof value==='string'&&value.startsWith('{'));
  assert.equal(JSON.parse(stored).landmarks[0].labelRotation,-75);
  for(const labelRotation of [NaN,Infinity,-181,181,'90',null]){
    assert.throws(()=>validateEditableLayout({...layout,landmarks:[{...layout.landmarks[0],labelRotation}]}));
  }
});
test('drawing bounds include reference labels rotated beyond the drawing edge',()=>{
  const rotated={...layout,landmarks:[{...layout.landmarks[0],name:'Referência longa próxima da borda',position:[600,100],labelRotation:-90}]};
  const bounds=editableDrawingBounds(rotated);
  assert.ok(bounds.top < -200);
  assert.ok(bounds.top+bounds.height >= 600);
});
test('multiline reference names and font sizes survive saving with rotation',async()=>{
  const marker={...layout.landmarks[0],name:'Lab Marcelo\nMagalhães',labelRotation:-75,labelFontSize:24};
  const drawing={...layout,landmarks:[marker]};
  assert.deepEqual(validateEditableLayout(drawing).landmarks[0],marker);
  const client=fixture();
  await saveEditableTerritory(client,{...body,layout:drawing});
  const update=client.calls.find(call=>call.sql.startsWith('UPDATE campo_territorios'));
  const stored=JSON.parse(update.values.find(value=>typeof value==='string'&&value.startsWith('{')));
  assert.deepEqual(stored.landmarks[0],marker);
  for(const labelFontSize of [NaN,Infinity,7,33,'16',null]){
    assert.throws(()=>validateEditableLayout({...layout,landmarks:[{...marker,labelFontSize}]}));
  }
  for(const labelFontSize of [8,16,32]){
    assert.equal(validateEditableLayout({...layout,landmarks:[{...marker,labelFontSize}]}).landmarks[0].labelFontSize,labelFontSize);
  }
});
test('drawing bounds follow font size and multiline label height',()=>{
  const boundsFor=(name,labelFontSize)=>editableDrawingBounds({...layout,landmarks:[{...layout.landmarks[0],position:[800,600],name,labelFontSize}]});
  const small=boundsFor('Reference',8),large=boundsFor('Reference',32),multiline=boundsFor('Reference\nSecond line\nThird line',32);
  assert.ok(large.width>small.width);
  assert.ok(multiline.height>large.height);
});
test('editable map uses permanent IDs, real groups and audited transaction caller without editing geographic limits',async()=>{
  const client=fixture();await saveEditableTerritory(client,body);
  const update=client.calls.find(c=>c.sql.startsWith('UPDATE campo_territorios'));
  assert.equal(update.values[0],41);assert.equal(update.values[1],77);assert.equal(update.values[2],9);assert.ok(!update.sql.includes('limites='));
  assert.ok(client.calls.some(c=>c.sql.startsWith('UPDATE grupos')));
  await assert.rejects(saveEditableTerritory(fixture({revision:1}),body),e=>e.status===409);
  await assert.rejects(saveEditableTerritory(fixture({pilot:false}),body),e=>e.status===409);
  await assert.rejects(saveEditableTerritory(fixture({groupRevision:2}),body),e=>e.status===409);
});
test('editable map endpoint authorizes before reading and rolls back if auditing fails',async()=>{
  const calls=[];let connects=0;
  const dependencies={Pool:class{async connect(){connects++;return{release(){},async query(sql){calls.push(sql);return{rows:[]};}};}},authorizeRequest:async()=>({status:403}),saveEditableTerritory:async()=>({id:41,revisao:1}),getUserIdFromRequest:()=>1,registerAuditLog:async()=>{throw new Error('audit');}};
  let route=loadRoute('../../app/api/admin/servico-campo/desenho/route.js',dependencies);assert.equal((await route.POST({})).status,403);assert.equal(connects,0);
  route=loadRoute('../../app/api/admin/servico-campo/desenho/route.js',{...dependencies,authorizeRequest:async()=>null});assert.equal((await route.POST({json:async()=>body})).status,500);assert.ok(calls.includes('ROLLBACK'));assert.ok(!calls.includes('COMMIT'));
});

test('validated non-pilot territories can open and save drawings without changing saved boundaries', async () => {
  const boundary = { type: 'Polygon', coordinates: [[[-35,-9],[-34.99,-9],[-34.99,-8.99],[-35,-8.99],[-35,-9]]] };
  const calls = [];
  const client = { query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('FROM campo_territorios')) return { rows: [{ id: 41, numero: 2, limites: boundary, mapa_prototipo: false, mapa_layout: null, mapa_layout_revisao: 0 }] };
    if (sql.includes('FROM grupos')) return { rows: [] };
    return { rows: [] };
  } };
  const result = await readEditableTerritory(client, 41);
  assert.equal(result.territory.mapa_layout.outline.length, 4);
  assert.deepEqual(result.territory.limites, boundary);
  assert.ok(!calls.some(call => /UPDATE|INSERT/.test(call.sql)));
  await saveEditableTerritory(client, { ...body, grupo_id: null, layout: result.territory.mapa_layout });
  const update = calls.find(call => call.sql.startsWith('UPDATE campo_territorios'));
  assert.ok(update.sql.includes('mapa_prototipo=TRUE'));
  assert.ok(!update.sql.includes('limites='));
});
