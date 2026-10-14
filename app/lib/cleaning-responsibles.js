export function getCleaningResponsibles(group) {
  return [...new Set([group?.superintendente_nome, group?.ajudante_nome]
    .map(name => name?.trim()).filter(Boolean))].join('\n');
}

export function changeCleaningGroup(currentText, previousDefaults, nextDefaults) {
  return !currentText.trim() || currentText === previousDefaults ? nextDefaults : currentText;
}
