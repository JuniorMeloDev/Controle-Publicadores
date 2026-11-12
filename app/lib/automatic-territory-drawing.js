import streets from './territory-street-data.json' with { type: 'json' };
import { layoutFromBoundary, boundaryStreetPoints, boundaryFingerprint, validateEditableLayout } from './editable-territory.js';

export const AUTOMATIC_DRAWING_REVISION = 3;

const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const vector = (a, b) => [b[0] - a[0], b[1] - a[1]];
const along = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function segmentDistance(p, a, b) {
  const v = vector(a, b), length = v[0] ** 2 + v[1] ** 2;
  return distance(p, along(a, b, length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / length)) : 0));
}
function inside(p, ring) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (segmentDistance(p, a, b) < 0.001) return true;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
function clipSegment(a, b, ring) {
  const cuts = [0, 1], r = vector(a, b);
  for (let i = 0; i < ring.length; i++) {
    const c = ring[i], d = ring[(i + 1) % ring.length], s = vector(c, d), denominator = cross(r, s);
    if (Math.abs(denominator) < 1e-8) continue;
    const delta = vector(a, c), t = cross(delta, s) / denominator, u = cross(delta, r) / denominator;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
  }
  cuts.sort((x, y) => x - y);
  return cuts.slice(1).flatMap((end, i) => end - cuts[i] > 1e-6 && inside(along(a, b, (cuts[i] + end) / 2), ring)
    ? [[along(a, b, cuts[i]), along(a, b, end)]] : []);
}
function readable(points) {
  const a = points[0], b = points.at(-1);
  return a[0] > b[0] + 1 || (Math.abs(a[0] - b[0]) <= 1 && a[1] < b[1]) ? [...points].reverse() : points;
}

function joinStreetFragments(roads, maxGap) {
  const result=[];
  for(const road of roads){
    if(road.kind==='boundary'){result.push(road);continue;}
    let joined=false;
    for(const previous of result){
      if(previous.kind==='boundary'||previous.name!==road.name)continue;
      for(const a of [previous.points,[...previous.points].reverse()]){
        for(const b of [road.points,[...road.points].reverse()]){
          const gap=vector(a.at(-1),b[0]),gapLength=distance(a.at(-1),b[0]);
          const incoming=vector(a.at(-2),a.at(-1)),outgoing=vector(b[0],b[1]);
          const cosine=(u,v)=>(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)||1);
          if(gapLength>maxGap||cosine(incoming,outgoing)<0.9)continue;
          if(gapLength>0.01&&(cosine(incoming,gap)<0.85||cosine(outgoing,gap)<0.85))continue;
          if(a.length+b.length>50)continue;
          previous.points=readable([...a,...(gapLength<0.01?b.slice(1):b)]);joined=true;break;
        }
        if(joined)break;
      }
      if(joined)break;
    }
    if(!joined)result.push({...road});
  }
  return result;
}

function pointAlong(points, fraction) {
  const lengths=points.slice(1).map((p,i)=>distance(points[i],p));
  let remaining=lengths.reduce((sum,length)=>sum+length,0)*fraction;
  for(let i=0;i<lengths.length;i++){
    if(remaining<=lengths[i]&&lengths[i]>0)return along(points[i],points[i+1],remaining/lengths[i]);
    remaining-=lengths[i];
  }
  return points.at(-1);
}

// Opposite carriageways are one avenue in the simplified card, not two streets.
function collapseParallelCarriageways(roads, maxSeparation) {
  const result=[];
  for(const road of roads){
    if(road.kind==='boundary'){result.push(road);continue;}
    const samples=Array.from({length:21},(_,i)=>pointAlong(road.points,i/20));
    const previous=result.find(other=>{
      if(other.kind==='boundary'||other.name!==road.name)return false;
      const direction=vector(road.points[0],road.points.at(-1)),peer=vector(other.points[0],other.points.at(-1));
      const cosine=(direction[0]*peer[0]+direction[1]*peer[1])/(Math.hypot(...direction)*Math.hypot(...peer)||1);
      return cosine>0.98&&samples.every((point,i)=>distance(point,pointAlong(other.points,i/20))<=maxSeparation);
    });
    if(previous)previous.points=samples.map((point,i)=>along(point,pointAlong(previous.points,i/20),0.5));
    else result.push({...road});
  }
  return result;
}

export function automaticTerritoryDrawing(boundary, dataset = streets) {
  const layout = layoutFromBoundary(boundary), ring = boundary.coordinates[0].slice(0, -1);
  const cosine = Math.cos(ring.reduce((sum, p) => sum + p[1], 0) / ring.length * Math.PI / 180);
  const west = Math.min(...ring.map(p => p[0] * cosine)), north = Math.min(...ring.map(p => -p[1]));
  const width = Math.max(...ring.map(p => p[0] * cosine)) - west, height = Math.max(...ring.map(p => -p[1])) - north;
  const scale = Math.min(700 / width, 480 / height), meter = scale / 111320;
  const project = ([lng, lat]) => [150 + (lng * cosine - west) * scale + (700 - width * scale) / 2,
    110 + (-lat - north) * scale + (480 - height * scale) / 2];
  const roads = dataset.roads.map(road => ({ ...road, points: road.points.map(project) }));
  const outline = layout.outline;
  // Match each outer side to an actual nearby street of the same direction.
  const sides = outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length], direction = vector(a, b);
    let best = null, bestScore = Infinity;
    for (const road of roads) for (let n = 1; n < road.points.length; n++) {
      const c = road.points[n - 1], d = road.points[n], other = vector(c, d);
      const lengths = distance(a, b) * distance(c, d);
      if (!lengths) continue;
      const sine = Math.abs(cross(direction, other)) / lengths;
      if (sine > 0.35) continue;
      const average = [0.25, 0.5, 0.75].reduce((sum, t) => sum + segmentDistance(along(a, b, t), c, d), 0) / 3;
      const score = average + sine * 20 * meter;
      if (average <= 22 * meter && score < bestScore) { best = road; bestScore = score; }
    }
    return best;
  });
  // A side may change street name halfway along it. Keep one continuous band
  // when adjacent segments follow the same direction, retaining both names.
  const sameBoundarySide=(a,b)=>{
    if(!sides[a]||!sides[b])return false;
    if(sides[a].name===sides[b].name)return true;
    const first=vector(outline[a],outline[(a+1)%outline.length]);
    const second=vector(outline[b],outline[(b+1)%outline.length]);
    const cosine=(first[0]*second[0]+first[1]*second[1])/(Math.hypot(...first)*Math.hypot(...second)||1);
    return cosine>0.985;
  };
  const visited = new Set();
  for (let i = 0; i < sides.length; i++) {
    if (!sides[i] || visited.has(i)) continue;
    let start = i;
    for (let n = 0; n < sides.length - 1; n++) {
      const previous = (start - 1 + sides.length) % sides.length;
      if (!sameBoundarySide(previous,i) || visited.has(previous)) break;
      start = previous;
    }
    const segments = [];
    const names=[];
    let current = start;
    while (!visited.has(current) && sameBoundarySide(current,start)) {
      visited.add(current);
      if(!names.includes(sides[current].name))names.push(sides[current].name);
      const edge = boundaryStreetPoints(outline, current), a = outline[current];
      segments.push(distance(edge[0], a) <= distance(edge[1], a) ? edge : [...edge].reverse());
      current = (current + 1) % sides.length;
    }
    const points = [segments[0][0]];
    for (let n = 0; n < segments.length - 1; n++) points.push(along(segments[n][1], segments[n + 1][0], 0.5));
    points.push(segments.at(-1)[1]);
    const name=names.length===1?names[0]:names.map(value=>value.replace(/^Rua /,'R. ').replace(/^Avenida /,'Av. ').replace(/\bBacharel\b/,'Bel.')).join(' / ');
    layout.roads.push({ id: `osm-boundary-${i}`, name:name.slice(0, 100), kind: 'boundary', points: readable(points) });
  }
  // Clip the real street geometry to the validated polygon, including inner roads.
  for (const road of roads) {
    const fragments = [];
    for (let n = 1; n < road.points.length; n++) {
      for (const [a, b] of clipSegment(road.points[n - 1], road.points[n], outline)) {
        const midpoint = along(a, b, 0.5);
        if (outline.some((p, i) => sides[i]?.name === road.name && segmentDistance(midpoint, p, outline[(i + 1) % outline.length]) < 14 * meter)) continue;
        const last = fragments.at(-1);
        if (last && distance(last.at(-1), a) < 0.01) last.push(b);
        else fragments.push([a, b]);
      }
    }
    fragments.forEach((points, i) => {
      const length = points.slice(1).reduce((sum, p, n) => sum + distance(points[n], p), 0);
      if (length < 35 || layout.roads.length >= 100) return;
      const simplified = points.length <= 50 ? points : points.filter((_, n) => n === points.length - 1 || n % Math.ceil(points.length / 49) === 0);
      layout.roads.push({ id: `osm-road-${road.id}-${i}`, name: road.name.slice(0, 100), points: readable(simplified) });
    });
  }
  layout.roads=collapseParallelCarriageways(joinStreetFragments(layout.roads,35*meter),30*meter);
  layout.landmarks = (dataset.landmarks || []).filter(marker => inside(project(marker.position), outline)).slice(0, 100)
    .map(marker => ({ id: `osm-point-${marker.id}`, name: marker.name.slice(0, 100), kind: marker.kind, position: project(marker.position) }));
  layout.autoBoundaryFingerprint = boundaryFingerprint(boundary);
  layout.autoDrawingRevision = AUTOMATIC_DRAWING_REVISION;
  return validateEditableLayout(layout);
}
