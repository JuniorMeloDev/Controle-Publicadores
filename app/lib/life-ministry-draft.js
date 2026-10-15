export function updateDraftAssignments(assignments, partId, name) {
  const changes = typeof partId === 'object' && partId !== null ? partId : { [partId]: name };
  const next = { ...assignments, ...changes };
  if (Object.hasOwn(changes, 'presidente')) {
    for (const key of ['comentarios_iniciais', 'comentarios_finais', 'cantico_meio']) next[key] = changes.presidente;
  }
  return next;
}

export function updateDraftSchedule(schedule, section, index, title) {
  if (!(section in schedule)) return schedule;
  if (typeof index !== 'number') return { ...schedule, [section]: title };
  return { ...schedule, [section]: schedule[section].map((part, i) => i === index ? { ...part, title } : part) };
}
