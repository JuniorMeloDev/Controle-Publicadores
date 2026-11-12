import { automaticTerritoryDrawing } from './automatic-territory-drawing.js';

export function territoryReferenceOptions(boundary, savedLayout) {
  const drawing=automaticTerritoryDrawing(boundary);
  const ring=boundary.coordinates[0].slice(0,-1);
  const cosine=Math.cos(ring.reduce((sum,p)=>sum+p[1],0)/ring.length*Math.PI/180);
  const west=Math.min(...ring.map(p=>p[0]*cosine)),north=Math.min(...ring.map(p=>-p[1]));
  const width=Math.max(...ring.map(p=>p[0]*cosine))-west,height=Math.max(...ring.map(p=>-p[1]))-north;
  const scale=Math.min(700/width,480/height);
  const markers=new Map(drawing.landmarks.map(marker=>[marker.id,marker]));
  for(const marker of savedLayout?.landmarks||[])if(!marker.id.startsWith('osm-point-')&&!markers.has(marker.id))markers.set(marker.id,marker);
  return [...markers.values()].slice(0,100).map(marker=>({...marker,location:{
    lng:((marker.position[0]-150-(700-width*scale)/2)/scale+west)/cosine,
    lat:-((marker.position[1]-110-(480-height*scale)/2)/scale+north),
  }}));
}

export function applyTerritoryReferenceSelection(drawing, options, ids) {
  if(!Array.isArray(ids)||ids.length>100||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw new Error('Seleção de referências inválida.');
  const available=new Map(options.map(option=>[option.id,option]));
  if(ids.some(id=>!available.has(id)))throw new Error('Uma referência não está disponível neste território. Atualize a lista.');
  return {...drawing,selectedReferenceIds:[...ids],landmarks:ids.map(id=>{
    const {location: _location,...marker}=available.get(id);
    return marker;
  })};
}
