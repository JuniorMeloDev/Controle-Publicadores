import test from 'node:test';
import assert from 'node:assert/strict';
import { territoryNumberPosition } from '../app/lib/territory-number-position.js';
import { automaticTerritoryDrawing } from '../app/lib/automatic-territory-drawing.js';
import { territoryBoundaryProposals } from '../app/lib/territory-boundary-proposal-data.js';

const layout={outline:[[100,100],[900,100],[900,600],[100,600]],roads:[{id:'horizontal',points:[[100,285],[900,285]]},{id:'vertical',points:[[500,100],[500,600]]}],landmarks:[]};

function distance(point,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)||0));
  return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);
}

test('number badge avoids the street beneath the former fixed position',()=>{
  const point=territoryNumberPosition(layout);
  assert.equal(distance([420,285],...layout.roads[0].points),0);
  for(const road of layout.roads)assert.ok(distance(point,...road.points)>26+13.5+10);
  assert.ok(point[0]>126&&point[0]<874&&point[1]>126&&point[1]<574);
  assert.deepEqual(territoryNumberPosition(layout),point);
});

test('badge finds another space when a reference occupies its preferred position',()=>{
  const initial=territoryNumberPosition(layout);
  const occupied={...layout,landmarks:[{id:'manual',name:'Reference\nSecond line',kind:'reference',position:initial,labelRotation:60,labelFontSize:32}]};
  for(const editing of [false,true]){
    const point=territoryNumberPosition(occupied,editing);
    assert.ok(Math.hypot(point[0]-initial[0],point[1]-initial[1])>26+20+10);
  }
});

test('badge remains within a concave territory whose average lies outside',()=>{
  const point=territoryNumberPosition({outline:[[100,100],[800,100],[800,250],[250,250],[250,600],[100,600]],roads:[],landmarks:[]});
  assert.ok(point[0]>=126&&point[0]<=774&&point[1]>=126&&point[1]<=574);
  assert.ok(point[0]<224||point[1]<224);
});

test('all available territory cards leave room between the number and streets',()=>{
  for(const [number,proposal] of Object.entries(territoryBoundaryProposals)){
    const drawing=automaticTerritoryDrawing(proposal.limites);
    const point=territoryNumberPosition(drawing);
    for(const road of drawing.roads)for(let i=1;i<road.points.length;i++){
      assert.ok(distance(point,road.points[i-1],road.points[i])>26+13.5+8,`Territory ${number}: number too close to ${road.name}`);
    }
  }
});
