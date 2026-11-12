const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];

// Reserve the junction itself, then distribute whole words along its free sides.
export function roadLabelLayout(road, roads, measure = text => text.length * 9) {
  const length = road.points.slice(1).reduce((sum, point, i) => sum + distance(road.points[i], point), 0);
  if (!length) return [];
  const gaps = [];
  let travelled = 0;
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i];
    const r = [b[0] - a[0], b[1] - a[1]], segmentLength = distance(a, b);
    for (const other of roads) {
      if (other.id === road.id) continue;
      for (let j = 1; j < other.points.length; j++) {
        const c = other.points[j - 1], d = other.points[j];
        const s = [d[0] - c[0], d[1] - c[1]], denominator = cross(r, s);
        if (Math.abs(denominator) < 0.001) continue;
        const delta = [c[0] - a[0], c[1] - a[1]];
        const t = cross(delta, s) / denominator, u = cross(delta, r) / denominator;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue;
        const offset = travelled + t * segmentLength;
        if (offset < 1 || offset > length - 1) continue;
        const sine = Math.abs(denominator) / (segmentLength * distance(c, d));
        const clearance = Math.min(90, 21 / sine);
        gaps.push([Math.max(0, offset - clearance), Math.min(length, offset + clearance)]);
      }
    }
    travelled += segmentLength;
  }
  const part = (text, start, end, alignment = 'center') => {
    const width = Math.min(measure(text), end - start);
    const offset = alignment === 'end' ? end - width / 2 : alignment === 'start' ? start + width / 2 : (start + end) / 2;
    return { text, offset, width };
  };
  const fullWidth = measure(road.name);
  if (!gaps.some(([start, end]) => start < (length + fullWidth) / 2 && end > (length - fullWidth) / 2)) {
    return [part(road.name, 0, length)];
  }
  const free = [];
  let cursor = 0;
  for (const [start, end] of gaps.sort((a, b) => a[0] - b[0])) {
    if (start - cursor >= 24) free.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (length - cursor >= 24) free.push([cursor, length]);
  if (!free.length) return [part(road.name, 0, length)];
  const words = road.name.trim().split(/\s+/);
  // A one-word name stays intact on one side of the junction.
  const intervals = free.length <= words.length ? free : free
    .sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, words.length).sort((a, b) => a[0] - b[0]);
  const parts = [];
  let wordIndex = 0;
  for (let i = 0; i < intervals.length; i++) {
    const [start, end] = intervals[i];
    const remainingSpace = intervals.slice(i).reduce((sum, [a, b]) => sum + b - a, 0);
    const target = measure(words.slice(wordIndex).join(' ')) * (end - start) / remainingSpace;
    const maxEnd = words.length - (intervals.length - i - 1);
    let next = wordIndex + 1;
    if (i === intervals.length - 1) next = words.length;
    else for (let candidate = next + 1; candidate <= maxEnd; candidate++) {
      if (Math.abs(measure(words.slice(wordIndex, candidate).join(' ')) - target)
        < Math.abs(measure(words.slice(wordIndex, next).join(' ')) - target)) next = candidate;
    }
    // Bring the outer fragments up to the reserved junction margin.
    parts.push(part(words.slice(wordIndex, next).join(' '), start, end,
      start === 0 ? 'end' : end === length ? 'start' : 'center'));
    wordIndex = next;
  }
  return parts;
}
