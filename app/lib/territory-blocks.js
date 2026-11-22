import { createHash } from 'node:crypto';
import { difference, setPrecision } from 'polyclip-ts';
import { automaticReferenceGroups, TERRITORY_ROAD_WIDTH } from './editable-territory.js';

const radius = TERRITORY_ROAD_WIDTH / 2;
const close = points => [...points, points[0]];
const round = points => points.map(point => point.map(value => Math.round(value * 100) / 100));

function streetSurface({ points }) {
  const strips = points.slice(1).flatMap((end, index) => {
    const start = points[index];
    const dx = end[0] - start[0], dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);
    if (!length) return [];
    const x = -radius * dy / length, y = radius * dx / length;
    return [[close(round([
      [start[0] + x, start[1] + y], [end[0] + x, end[1] + y],
      [end[0] - x, end[1] - y], [start[0] - x, start[1] - y],
    ]))]];
  });
  const joints = points.map(([x, y]) => [close(round(Array.from({ length: 16 }, (_, i) => {
    const angle = i * Math.PI / 8;
    return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
  })))]);
  return [...strips, ...joints];
}

function area(ring) {
  return Math.abs(ring.slice(1).reduce((sum, [x, y], index) =>
    sum + ring[index][0] * y - x * ring[index][1], 0)) / 2;
}

function spansAt(rings, y) {
  const crossings = rings.flatMap(ring => ring.slice(1).flatMap(([x, endY], index) => {
    const [startX, startY] = ring[index];
    if ((startY > y) === (endY > y)) return [];
    return [startX + (x - startX) * (y - startY) / (endY - startY)];
  })).sort((a, b) => a - b);
  return crossings.flatMap((x, index) => index % 2 ? [] : [[x, crossings[index + 1]]]);
}

function labelPosition(rings, references) {
  const heights = rings[0].map(point => point[1]);
  const top = Math.min(...heights), height = Math.max(...heights) - top;
  const candidates = [0.5, 0.35, 0.65, 0.2, 0.8].flatMap(fraction => {
    const y = top + fraction * height;
    return spansAt(rings, y).map(([left, right]) => {
      const x = (left + right) / 2;
      const nearReference = references.some(({ position }) => Math.hypot(x - position[0], y - position[1]) < 35);
      return { point: [x, y], score: right - left - 90 * Math.abs(fraction - 0.5) - (nearReference ? 100 : 0) };
    });
  });
  return candidates.sort((a, b) => b.score - a.score)[0]?.point || rings[0][0];
}

function cutStreets(outline, streets) {
  // Intersections that touch an outline can require snapping nearly coincident coordinates.
  for (const precision of [undefined, 0.001, 0.01, 0.1]) {
    setPrecision(precision);
    try { return difference([outline], ...streets); }
    catch { /* Retry with a wider geometric tolerance. */ }
    finally { setPrecision(undefined); }
  }
  // Clip separately when several street joints meet at the same intersection.
  try {
    return streets.reduce((land, street) => land.length ? difference(land, street) : land, [[outline]]);
  } catch { return []; }
}

export function territoryBlocks(layout) {
  if (!layout?.outline?.length) return [];
  const outline = close(layout.outline);
  const streets = layout.roads.filter(road => road.kind !== 'boundary').flatMap(streetSurface);
  const pieces = streets.length ? cutStreets(outline, streets) : [[outline]];
  const references = automaticReferenceGroups(layout.landmarks);
  const minArea = Math.max(100, area(outline) / 1000);
  return pieces.filter(rings => area(rings[0]) - rings.slice(1).reduce((sum, hole) => sum + area(hole), 0) >= minArea)
    .map(rings => {
      const referenceNumbers = references.filter(({ position: [x, y] }) =>
        spansAt(rings, y).some(([left, right]) => x >= left && x <= right)).map(({ number }) => number);
      const id = createHash('sha256').update(JSON.stringify(rings)).digest('hex').slice(0, 24);
      return { id, rings, referenceNumbers, position: labelPosition(rings, references) };
    }).sort((a, b) => a.position[1] - b.position[1] || a.position[0] - b.position[0]);
}
