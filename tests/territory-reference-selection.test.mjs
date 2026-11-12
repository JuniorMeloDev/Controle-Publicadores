import test from 'node:test';
import assert from 'node:assert/strict';
import { territoryReferenceOptions,applyTerritoryReferenceSelection } from '../app/lib/territory-reference-selection.js';
import { automaticTerritoryDrawing } from '../app/lib/automatic-territory-drawing.js';
import { territoryBoundaryProposals } from '../app/lib/territory-boundary-proposal-data.js';
import { saveTerritoryBoundary } from '../app/lib/territory-boundaries-server.js';
import { validateEditableLayout } from '../app/lib/editable-territory.js';
import { withTerritoryDrawing } from '../app/lib/territory-map-display.js';

const boundary=territoryBoundaryProposals[2].limites;
const options=territoryReferenceOptions(boundary);

test('review references have geographical locations and match the card markers',()=>{
  assert.ok(options.length>0);
  for(const option of options){
    assert.ok(Number.isFinite(option.location.lat)&&Number.isFinite(option.location.lng));
    assert.ok(option.location.lat<0&&option.location.lng<0);
  }
  assert.deepEqual(options.map(option=>option.id),automaticTerritoryDrawing(boundary).landmarks.map(marker=>marker.id));
});

test('selected references alone survive card reload, group saving and automatic drawing updates',()=>{
  const drawing=automaticTerritoryDrawing(boundary);
  const ids=[options[0].id];
  const selected=applyTerritoryReferenceSelection(drawing,options,ids);
  assert.equal(drawing.landmarks.length,options.length);
  assert.deepEqual(selected.landmarks.map(marker=>marker.id),ids);
  assert.ok(!selected.landmarks[0].location);
  const groupSaved=validateEditableLayout(selected);
  assert.deepEqual(groupSaved.selectedReferenceIds,ids);
  for(const saved of [groupSaved,{...groupSaved,autoDrawingRevision:1}]){
    const publicCard=withTerritoryDrawing({limites:boundary,mapa_layout:saved,mapa_grupo_id:9});
    assert.deepEqual(publicCard.mapa_layout.landmarks.map(marker=>marker.id),ids);
    assert.equal(publicCard.mapa_grupo_id,9);
  }
});

test('an explicit empty selection stays empty even when automatic references are available',()=>{
  const selected=applyTerritoryReferenceSelection(automaticTerritoryDrawing(boundary),options,[]);
  const reloaded=withTerritoryDrawing({limites:boundary,mapa_layout:{...selected,autoDrawingRevision:1}});
  assert.deepEqual(reloaded.mapa_layout.landmarks,[]);
  assert.deepEqual(reloaded.mapa_layout.selectedReferenceIds,[]);
});

test('unknown, repeated or malformed reference IDs are rejected',()=>{
  for(const ids of [null,{},[true],['from-another-territory'],[options[0].id,options[0].id]]){
    assert.throws(()=>applyTerritoryReferenceSelection(automaticTerritoryDrawing(boundary),options,ids));
  }
});

function fixture(layoutRevision=0){
  const calls=[];
  const general={type:'Polygon',coordinates:[[[-34.94,-8.23],[-34.90,-8.23],[-34.90,-8.19],[-34.94,-8.19],[-34.94,-8.23]]]};
  return {calls,query:async(sql,values)=>{
    calls.push({sql,values});
    if(sql.includes('FROM campo_mapa_geral'))return {rows:[{limites:general,revisao:0}]};
    if(sql.includes('FROM campo_territorios'))return {rows:[{id:2,numero:2,limites:boundary,mapa_revisao:3,mapa_layout_revisao:layoutRevision,ativo:true}]};
    return {rows:[]};
  }};
}

test('boundary validation saves references and drawing in the same update and supports saving none',async()=>{
  for(const ids of [[options[0].id],[]]){
    const client=fixture();
    const result=await saveTerritoryBoundary(client,{territorio:2,revisao:3,desenho_revisao:0,limites:boundary,referencia_ids:ids});
    const updates=client.calls.filter(call=>call.sql.startsWith('UPDATE campo_territorios'));
    assert.equal(updates.length,1);
    assert.match(updates[0].sql,/mapa_layout_revisao=mapa_layout_revisao\+1/);
    const stored=JSON.parse(updates[0].values[3]);
    assert.deepEqual(stored.selectedReferenceIds,ids);
    assert.deepEqual(stored.landmarks.map(marker=>marker.id),ids);
    assert.equal(result.desenho_revisao,1);
    assert.equal(result.revisao,4);
  }
});

test('stale drawings and forged references cannot overwrite a newer card',async()=>{
  for(const [client,ids] of [[fixture(1),[]],[fixture(),['forged']]]){
    await assert.rejects(saveTerritoryBoundary(client,{territorio:2,revisao:3,desenho_revisao:0,limites:boundary,referencia_ids:ids}));
    assert.ok(!client.calls.some(call=>call.sql.startsWith('UPDATE')));
  }
});
