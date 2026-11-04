import { fieldServiceYear } from './field-service.js';
import { territoryPeriod } from './field-planner.js';

export function territoryHistoryReport(data, serviceYear) {
  const year = Number(serviceYear);
  if (!Number.isInteger(year) || year < 1901 || year > 2200) throw new Error('Escolha um ano de serviço válido.');
  const start = `${year - 1}-09-01`, end = `${year}-08-31`;
  const names = new Map(data.publicadores.map(p => [p.id, p.nome]));
  const assignments = data.designacoes.filter(d => d.data_designacao <= end && (!d.data_conclusao || d.data_conclusao >= start));
  const territories = data.territorios.filter(t => t.ativo || assignments.some(d => d.territorio_id === t.id)).sort((a, b) => a.numero - b.numero);
  return { year, start, end, count: assignments.filter(d => territories.some(t => t.id === d.territorio_id)).length,
    territories: territories.map(t => ({ numero: t.numero, weekend: territoryPeriod(t) === 'fim_semana',
      // Derive the latest conclusion as of the end of this report, including
      // older history but excluding conclusions from a later service year.
      latest: data.designacoes.filter(d => d.territorio_id === t.id && d.data_conclusao && d.data_conclusao <= end).map(d => d.data_conclusao).sort().at(-1) || '',
      assignments: assignments.filter(d => d.territorio_id === t.id).sort((a, b) => a.data_designacao.localeCompare(b.data_designacao) || a.id - b.id).map(d => ({
        name: d.responsavel_nome || names.get(d.publicador_id) || 'Responsável não informado', start: d.data_designacao, end: d.data_conclusao || ''
      }))
    })) };
}

export function territoryHistoryYears(data, today) {
  const current = fieldServiceYear(today);
  return [...new Set([current, ...data.designacoes.flatMap(d => {
    const first = fieldServiceYear(d.data_designacao), last = Math.max(first, d.data_conclusao ? fieldServiceYear(d.data_conclusao) : current);
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  })])].sort((a, b) => b - a);
}

const dateLabel = value => value ? value.split('-').reverse().join('/') : '';

export function writeTerritoryHistoryPdf(doc, data, serviceYear) {
  const report = territoryHistoryReport(data, serviceYear);
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
  const margin = 10, total = width - margin * 2;
  const flagWidth = 10, numberWidth = 13, latestWidth = 25, slots = 5;
  const firstSlot = margin + flagWidth + numberWidth + latestWidth;
  const slotWidth = (total - flagWidth - numberWidth - latestWidth) / slots;
  const font = (size, bold = false) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(25); };
  doc.setLineWidth(0.15); doc.setDrawColor(100);
  doc.setProperties({ title: `Registro de Designação de Território - Ano de Serviço ${report.year}` });
  let y;
  function cell(text, x, top, w, h, { bold = false, size = 7, fill, align = 'center' } = {}) {
    if (fill) { doc.setFillColor(...fill); doc.rect(x, top, w, h, 'F'); }
    doc.rect(x, top, w, h);
    font(size, bold);
    const lines = Array.isArray(text) ? text : [text];
    const step = size * 0.3528 * 1.12;
    const baseline = top + (h - lines.length * step) / 2 + size * 0.3528 * 0.85;
    lines.forEach((line, index) => { if (line) doc.text(line, align === 'left' ? x + 1.3 : x + w / 2, baseline + index * step, { align }); });
  }
  function pageHeader() {
    font(13, true); doc.text('REGISTRO DE DESIGNAÇÃO DE TERRITÓRIO', width / 2, 15, { align: 'center' });
    font(9, true); doc.text(`Ano de serviço: ${report.year}`, margin, 23);
    font(8); doc.text(`${dateLabel(report.start)} a ${dateLabel(report.end)}`, width - margin, 23, { align: 'right' });
    const top = 28, header = 13, fill = [242, 242, 242];
    cell('FDS', margin, top, flagWidth, header, { bold: true, fill });
    cell(['Terr.', 'nº'], margin + flagWidth, top, numberWidth, header, { bold: true, fill });
    cell(['Última data', 'concluída'], margin + flagWidth + numberWidth, top, latestWidth, header, { bold: true, fill });
    for (let slot = 0; slot < slots; slot++) {
      const x = firstSlot + slot * slotWidth;
      cell('Designado para', x, top, slotWidth, 5, { bold: true, fill });
      cell(['Data da', 'designação'], x, top + 5, slotWidth / 2, 8, { bold: true, size: 6.5, fill });
      cell(['Data da', 'conclusão'], x + slotWidth / 2, top + 5, slotWidth / 2, 8, { bold: true, size: 6.5, fill });
    }
    y = top + header;
  }
  pageHeader();
  for (const territory of report.territories) {
    for (let offset = 0; offset < Math.max(1, territory.assignments.length); offset += slots) {
      const entries = territory.assignments.slice(offset, offset + slots);
      font(7);
      const names = entries.map(entry => doc.splitTextToSize(entry.name, slotWidth - 3));
      const lineCount = Math.max(1, ...names.map(lines => lines.length));
      // Names are bounded by the field-service validation (up to 2000 chars
      // for legacy publisher names). Split exceptional names across pages too.
      for (let nameOffset = 0; nameOffset < lineCount;) {
        if (y + 9.5 > height - 15) { doc.addPage(); pageHeader(); }
        const capacity = Math.max(1, Math.floor((height - 15 - y - 7) / 2.8));
        const take = Math.min(lineCount - nameOffset, capacity);
        const nameHeight = Math.max(5, take * 2.8 + 2), rowHeight = nameHeight + 4.5;
        const continuation = offset > 0 || nameOffset > 0;
        cell(territory.weekend ? 'FDS' : '', margin, y, flagWidth, rowHeight, { size: 6.5, fill: territory.weekend ? [255, 230, 196] : undefined });
        cell(continuation ? [String(territory.numero), '(cont.)'] : String(territory.numero), margin + flagWidth, y, numberWidth, rowHeight, { bold: true, size: 7 });
        cell(dateLabel(territory.latest), margin + flagWidth + numberWidth, y, latestWidth, rowHeight, { size: 7 });
        for (let slot = 0; slot < slots; slot++) {
          const x = firstSlot + slot * slotWidth, entry = entries[slot];
          cell(names[slot]?.slice(nameOffset, nameOffset + take) || '', x, y, slotWidth, nameHeight, { size: 7 });
          cell(entry ? dateLabel(entry.start) : '', x, y + nameHeight, slotWidth / 2, 4.5, { size: 6.5 });
          cell(entry ? dateLabel(entry.end) || 'Pendente' : '', x + slotWidth / 2, y + nameHeight, slotWidth / 2, 4.5, { size: 6.5 });
        }
        y += rowHeight; nameOffset += take;
      }
    }
  }
  if (!report.territories.length) { font(9); doc.text('Nenhum território cadastrado para este período.', margin, y + 10); }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); font(7);
    doc.text('FDS = fim de semana | Datas de entrega e conclusão conforme o histórico registrado.', margin, height - 8);
    doc.text(`${page} / ${pages}`, width - margin, height - 8, { align: 'right' });
  }
  return doc;
}
