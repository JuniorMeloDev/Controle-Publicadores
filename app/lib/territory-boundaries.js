import { polygon, featureCollection } from '@turf/helpers';
import kinks from '@turf/kinks';
import booleanWithin from '@turf/boolean-within';
import intersect from '@turf/intersect';
import area from '@turf/area';

export function validateBoundary(value) {
  if (!value || value.type !== 'Polygon' || !Array.isArray(value.coordinates) || value.coordinates.length !== 1) throw new Error('Desenhe uma área única, sem recortes internos.');
  const ring = value.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4 || ring.length > 1001) throw new Error('O limite precisa de 3 a 1000 pontos.');
  for (const point of ring) {
    if (!Array.isArray(point) || point.length !== 2 || point.some(n => typeof n !== 'number' || !Number.isFinite(n)) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 85) throw new Error('Coordenadas inválidas.');
  }
  if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) throw new Error('Feche o contorno da área.');
  if (new Set(ring.slice(0, -1).map(p => p.join(','))).size !== ring.length - 1) throw new Error('O limite possui pontos repetidos.');
  const feature = polygon([ring]);
  const planarArea = Math.abs(ring.slice(0, -1).reduce((sum, p, i) => sum + p[0] * ring[i + 1][1] - ring[i + 1][0] * p[1], 0));
  if (planarArea < 1e-12 || area(feature) < 1 || kinks(feature).features.length) throw new Error('O limite precisa formar uma área válida, sem cruzamentos.');
  return { type: 'Polygon', coordinates: [ring.map(p => [...p])] };
}

export function checkBoundaryPlacement(boundary, general, others = []) {
  const feature = polygon(boundary.coordinates);
  if (!general || !booleanWithin(feature, polygon(general.coordinates))) throw new Error('O território precisa ficar dentro do limite geral da congregação.');
  const clipped = intersect(featureCollection([feature, polygon(general.coordinates)]));
  if (!clipped || area(feature) - area(clipped) > 0.1) throw new Error('O território precisa ficar dentro do limite geral da congregação.');
  for (const other of others) {
    const overlap = intersect(featureCollection([feature, polygon(other.limites.coordinates)]));
    if (overlap && area(overlap) > 0.1) throw new Error(`O limite sobrepõe o território ${other.numero}. Ajuste as divisas.`);
  }
}
