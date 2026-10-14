const civilDate = value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const labelDate = value => civilDate(value).split('-').reverse().join('/');

export function overviewSnapshot(meetings, assignments) {
  return {
    meetings: meetings.map(item => ({ id: String(item.id), date: civilDate(item.data), title: item.tipo,
      cancelled: item.cancelado === true, reason: item.motivo_cancelamento || '' })),
    assignments: assignments.map(item => ({ id: String(item.id), date: civilDate(item.data_reuniao), title: item.nome_parte,
      details: item.descricao_semana || '', category: item.categoria, meetingId: item.reuniao_id == null ? null : String(item.reuniao_id) })),
  };
}

// The first visit establishes a baseline. Only changes to previously seen items are alerts.
export function detectOverviewChanges(previous, next, today, detectedAt = new Date().toISOString()) {
  if (!previous) return [];
  const changes = [];
  for (const type of ['meetings', 'assignments']) {
    const current = new Map(next[type].map(item => [item.id, item]));
    const previousIds = new Set((previous[type] || []).map(item => item.id));
    const matched = new Set();
    for (const before of previous[type] || []) {
      let after = current.get(before.id);
      if (!after && type === 'assignments') {
        // Imports may recreate rows. A new database ID alone is not a changed responsibility.
        const candidates = next.assignments.filter(item => !matched.has(item.id) && !previousIds.has(item.id) && item.category === before.category &&
          (before.meetingId ? item.meetingId === before.meetingId : item.date === before.date));
        after = candidates.find(item => item.title === before.title) || (candidates.length === 1 ? candidates[0] : undefined);
      }
      if (after) matched.add(after.id);
      if (before.date < today && (!after || after.date < today)) continue;
      // Items that naturally fall outside the observation window are not removals.
      if (!after && type === 'meetings') continue;
      const isMeeting = type === 'meetings';
      const changed = after && (before.date !== after.date || before.title !== after.title ||
        (isMeeting ? before.cancelled !== after.cancelled || before.reason !== after.reason : before.details !== after.details));
      if (!changed && after) continue;
      const title = isMeeting ? after.cancelled ? 'Reunião cancelada' : before.cancelled ? 'Reunião reativada' : 'Reunião alterada'
        : after ? 'Sua designação foi alterada' : 'Sua designação foi removida';
      const description = !after ? `${before.title} · ${labelDate(before.date)}. Confira suas designações.`
        : isMeeting && after.cancelled ? `${after.title} · ${labelDate(after.date)}. ${after.reason}`
          : before.date !== after.date ? `${after.title}: de ${labelDate(before.date)} para ${labelDate(after.date)}.`
            : `${after.title} · ${labelDate(after.date)}.${before.title !== after.title ? ` Antes: ${before.title}.` : ''}${!isMeeting && after.details ? ` ${after.details}` : ''}`;
      changes.push({ id: `${type}:${before.id}:${detectedAt}`, title, description, date: after?.date || before.date,
        detectedAt, href: isMeeting ? null : '/admin/minhas-designacoes' });
    }
  }
  return changes;
}

export function mergeOverviewChanges(existing, incoming, today) {
  const cutoff = new Date(`${today}T00:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - 14);
  return [...incoming, ...existing].filter(item => item.date >= today && item.detectedAt >= cutoff.toISOString()).slice(0, 20);
}
