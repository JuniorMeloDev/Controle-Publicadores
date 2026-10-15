export function territoryNumberFromFilename(name) {
  const match = /^(\d+)\.pdf$/i.exec(name.trim());
  if (!match) return '';
  const number = Number(match[1]);
  return Number.isInteger(number) && number > 0 && number <= 2147483647 ? String(number) : '';
}

export function fieldImportError(item, items, territories) {
  if (!/\.pdf$/i.test(item.file.name) || !item.file.size || item.file.size > 10 * 1024 * 1024) return 'Selecione um PDF de até 10 MB.';
  const number = Number(item.numero);
  if (!/^\d+$/.test(String(item.numero)) || !Number.isInteger(number) || number < 1 || number > 2147483647) return 'Informe um número de território válido.';
  if (items.some(other => other !== item && Number(other.numero) === number)) return 'Número repetido no lote.';
  if (territories.some(territory => Number(territory.numero) === number)) return 'Território já cadastrado. Use a edição para anexar ou substituir o PDF.';
  return '';
}
