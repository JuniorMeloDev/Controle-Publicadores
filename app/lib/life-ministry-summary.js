import { normalizePartTitle, reconstructLifeMinistryAssignments } from './life-ministry-parts.js';

export function getWeekCompletionStats(schedule, assignments = {}) {
  if (!schedule) return { total: 0, filled: 0, percentage: 0 };
  let total = 0;
  let filled = 0;

  total += 1; if (assignments.presidente) filled += 1;
  total += 1; if (assignments.oracao_inicial) filled += 1;
  total += 1; if (assignments.comentarios_iniciais) filled += 1;

  schedule.treasures?.forEach((_, idx) => {
    total += 1;
    if (assignments[`tesouro_${idx}`]) filled += 1;
  });
  schedule.ministry?.forEach((part, idx) => {
    const isDiscurso = part.title?.toLowerCase().includes('discurso');
    if (isDiscurso) {
      total += 1;
      if (assignments[`ministerio_${idx}`] || assignments[`ministerio_${idx}_1`]) filled += 1;
    } else {
      total += 2;
      if (assignments[`ministerio_${idx}_1`] || assignments[`ministerio_${idx}`]) filled += 1;
      if (assignments[`ministerio_${idx}_2`]) filled += 1;
    }
  });

  total += 1; if (assignments.cantico_meio) filled += 1;
  schedule.living?.forEach((part, idx) => {
    const isBibleStudy = normalizePartTitle(part.title).includes('estudo biblico');
    if (isBibleStudy) {
      total += 2;
      if (assignments[`vida_${idx}_1`] || assignments[`vida_${idx}`]) filled += 1;
      if (assignments[`vida_${idx}_2`]) filled += 1;
    } else {
      total += 1;
      if (assignments[`vida_${idx}`] || assignments[`vida_${idx}_1`]) filled += 1;
    }
  });

  total += 1; if (assignments.comentarios_finais) filled += 1;
  total += 1; if (assignments.oracao_final) filled += 1;

  const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { total, filled, percentage };
}

export function getLifeMinistrySummary(schedule, rows = []) {
  if (!schedule) return null;
  const assignments = reconstructLifeMinistryAssignments(schedule, rows);
  const readingIndex = schedule.treasures?.findIndex(part => normalizePartTitle(part.title).includes('leitura da biblia')) ?? -1;
  return {
    ...getWeekCompletionStats(schedule, assignments),
    presidente: assignments.presidente || '',
    leitorBiblia: readingIndex >= 0 ? assignments[`tesouro_${readingIndex}`] || '' : '',
  };
}
