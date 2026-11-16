import { featureCollection, polygon } from '@turf/helpers';
import intersect from '@turf/intersect';
import difference from '@turf/difference';
import area from '@turf/area';
import { validateBoundary } from './territory-boundaries.js';

export function boundaryOverlap(boundary, neighbor) {
  if (!boundary || !neighbor) return null;
  const overlap = intersect(featureCollection([polygon(boundary.coordinates), polygon(neighbor.coordinates)]));
  return overlap && area(overlap) > 0.1 ? overlap.geometry : null;
}

export function firstBoundaryConflict(boundary, territories) {
  if (!boundary) return null;
  const valid = validateBoundary(boundary);
  for (const territory of territories) {
    if (!territory.limites) continue;
    const overlap = boundaryOverlap(valid, territory.limites);
    if (overlap) return { territory, overlap, areaM2: area(overlap), percentage: area(overlap) / area(polygon(valid.coordinates)) * 100 };
  }
  return null;
}

// This only prepares the current draft. The neighbor and published maps are unchanged.
export function removeBoundaryOverlap(boundary, neighbor) {
  const current = validateBoundary(boundary);
  const other = validateBoundary(neighbor);
  if (!boundaryOverlap(current, other)) return current;
  const remaining = difference(featureCollection([polygon(current.coordinates), polygon(other.coordinates)]));
  if (!remaining || remaining.geometry.type !== 'Polygon' || remaining.geometry.coordinates.length !== 1) {
    throw new Error('Esse recorte dividiria o território ou criaria um buraco. Ajuste os pontos manualmente no mapa.');
  }
  return validateBoundary(remaining.geometry);
}

export function fitBoundaryToGeneral(boundary, general) {
  const current = validateBoundary(boundary);
  const outer = validateBoundary(general);
  const clipped = intersect(featureCollection([polygon(current.coordinates), polygon(outer.coordinates)]));
  if (!clipped || clipped.geometry.type !== 'Polygon' || clipped.geometry.coordinates.length !== 1) {
    throw new Error('O recorte não forma um território único. Ajuste os pontos ou confira o limite geral da congregação.');
  }
  return validateBoundary(clipped.geometry);
}

// Uncross edges by reversing their connecting sequence (2-opt). All distinct
// vertex coordinates are preserved; this never replaces the outline with a hull.
export function repairBoundaryCrossings(boundary) {
  const ring = boundary?.coordinates?.[0];
  if (boundary?.type !== 'Polygon' || boundary.coordinates.length !== 1 || !Array.isArray(ring) || ring.length < 4 || ring.length > 1001) {
    throw new Error('Não foi possível corrigir este contorno. Confira os pontos no mapa.');
  }
  const vertices = [];
  const seen = new Set();
  for (const point of ring) {
    if (!Array.isArray(point) || point.length !== 2 || point.some(n => !Number.isFinite(n)) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 85) throw new Error('Coordenadas inválidas.');
    const key = point.join(',');
    if (!seen.has(key)) { seen.add(key); vertices.push([...point]); }
  }
  const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let pass = 0; pass < 100; pass++) {
    let changed = false;
    outer: for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 2; j < vertices.length; j++) {
        if (i === 0 && j === vertices.length - 1) continue;
        const a = vertices[i], b = vertices[(i + 1) % vertices.length];
        const c = vertices[j], d = vertices[(j + 1) % vertices.length];
        if (turn(a, b, c) * turn(a, b, d) < 0 && turn(c, d, a) * turn(c, d, b) < 0) {
          vertices.splice(i + 1, j - i, ...vertices.slice(i + 1, j + 1).reverse());
          changed = true;
          break outer;
        }
      }
    }
    if (!changed) return validateBoundary({ type: 'Polygon', coordinates: [[...vertices, [...vertices[0]]]] });
  }
  throw new Error('Há muitos cruzamentos neste contorno. Ajuste os pontos no mapa.');
}
