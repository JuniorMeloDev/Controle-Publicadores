export function validatePublisherHistoryDate(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Informe uma data válida para a alteração de privilégios ou designações.');
  }
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Informe uma data válida para a alteração de privilégios ou designações.');
  }
  // Keep the selected calendar day when stored and read in Brasília time.
  return `${value}T12:00:00-03:00`;
}
