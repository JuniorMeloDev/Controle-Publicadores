import assert from 'node:assert/strict';
import test from 'node:test';
import {lookupPoint,streetCandidates,geocodingMessage} from '../app/lib/google-boundary-streets.js';
import {boundaryFingerprint,boundaryStreetPoints,validateEditableLayout,addGoogleBoundaryStreet} from '../app/lib/editable-territory.js';
const boundary={type:'Polygon',coordinates:[[[-35,-9],[-34.99,-9],[-34.99,-8.99],[-35,-9]]]};
test('street lookup uses the selected saved geographical edge and rejects nonexistent edges',()=>{
  const point=lookupPoint(boundary,0);assert.equal(point.lat,-9);assert.equal(point.lng,(-35-34.99)/2);
  assert.throws(()=>lookupPoint(boundary,3));assert.throws(()=>lookupPoint(null,0));
  assert.notEqual(boundaryFingerprint(boundary),boundaryFingerprint({coordinates:[]}));
});
test('Google results supply actual route names, prioritize road-level place IDs and remove duplicate names',()=>{
  const component=name=>[{long_name:name,types:['route']}];
  const result=streetCandidates([{types:['street_address'],place_id:'address',address_components:component('Rua A')},{types:['route'],place_id:'street',address_components:component('Rua A')},{place_id:'empty',address_components:[]}]);
  assert.deepEqual(result,[{name:'Rua A',placeId:'street'}]);
  assert.match(geocodingMessage('REQUEST_DENIED'),/mesmo projeto/);assert.match(geocodingMessage('OVER_QUERY_LIMIT'),/cota/);
});
test('boundary street is placed outside the drawing and retains its Google association when saved',()=>{
  const outline=[[100,100],[800,100],[800,600],[100,600]];
  const points=boundaryStreetPoints(outline,0);assert.ok(points.every(p=>p[1]<100));
  const road={id:'boundary-road-0',kind:'boundary',name:'Rua obtida no Google',points,googlePlaceId:'ChIJtest',boundaryFingerprint:boundaryFingerprint(boundary)};
  const layout=validateEditableLayout({version:1,outline,roads:[road],landmarks:[]});assert.deepEqual(layout.roads[0],road);
  assert.throws(()=>boundaryStreetPoints(outline,4));assert.throws(()=>validateEditableLayout({...layout,roads:[{...road,googlePlaceId:'<script>'}]}));
});

test('adjacent sides of the same Google street form one editable road, while changing a side preserves its neighbours',()=>{
  const initial={version:1,outline:[[100,100],[800,100],[800,600],[100,600]],roads:[],landmarks:[]};
  const a={name:'Rua A',placeId:'ChIJA'},b={name:'Rua B',placeId:'ChIJB'};
  let result=addGoogleBoundaryStreet(initial,a,0,'abc').layout;
  result=addGoogleBoundaryStreet(result,a,1,'abc').layout;
  assert.equal(result.roads.length,1);assert.deepEqual(result.roads[0].boundarySides,[0,1]);assert.equal(result.roads[0].points.length,3);
  result=addGoogleBoundaryStreet(result,b,1,'abc').layout;
  assert.equal(result.roads.length,2);assert.ok(result.roads.some(r=>r.name==='Rua A'&&r.boundarySides.includes(0)));
  assert.equal(validateEditableLayout(result).roads.length,2);assert.equal(initial.roads.length,0);
});
