import { automaticTerritoryDrawing, AUTOMATIC_DRAWING_REVISION } from './automatic-territory-drawing.js';
import { boundaryFingerprint } from './editable-territory.js';

export function territoryMapDisplay(territory) {
  if (territory?.mapa_layout || territory?.limites) return 'editable';
  return 'original';
}

export function withTerritoryDrawing(territory) {
  if (!territory || territoryMapDisplay(territory) !== 'editable') return territory;
  const saved = territory.mapa_layout;
  // Preserve completed drawings, replacing only the empty starter cards.
  const stale = saved?.autoBoundaryFingerprint && territory.limites && (saved.autoBoundaryFingerprint !== boundaryFingerprint(territory.limites)
    || saved.autoDrawingRevision !== AUTOMATIC_DRAWING_REVISION);
  const useSaved = saved && !stale && (saved.roads?.length || !territory.limites);
  const drawing = useSaved ? saved : automaticTerritoryDrawing(territory.limites);
  if (!useSaved && !stale && saved?.landmarks?.length) {
    drawing.landmarks = [...saved.landmarks, ...drawing.landmarks.filter(marker => !saved.landmarks.some(old => old.name === marker.name))].slice(0, 100);
  }
  const selectedIds=saved?.selectedReferenceIds;
  const visibleDrawing=selectedIds===undefined?drawing:{...drawing,selectedReferenceIds:[...selectedIds],landmarks:drawing.landmarks.filter(marker=>selectedIds.includes(marker.id))};
  return { ...territory, mapa_prototipo: true, mapa_layout: visibleDrawing };
}
