import { FIELD_MODES } from './field-service.js';

export function fieldLeadersReport(data, year, month) {
  const y = Number(year), m = Number(month);
  if (!Number.isInteger(y) || y < 1900 || y > 2200 || !Number.isInteger(m) || m < 1 || m > 12) throw new Error('Escolha um mês e ano válidos.');
  const prefix = `${y}-${String(m).padStart(2, '0')}`;
  const findName = (entity, id, fallback = 'A definir') => data[entity].find(item => item.id === id)?.nome || fallback;
  const rows = data.saidas.filter(row => row.data.startsWith(`${prefix}-`)).sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario) || a.id - b.id).map(row => ({
    date: row.data, weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${row.data}T12:00:00Z`)),
    time: row.horario, leader: findName('publicadores', row.dirigente_publicador_id), leaderId: row.dirigente_publicador_id,
    place: findName('locais', row.local_id), groups: row.grupos.length ? row.grupos.map(id => findName('grupos', id, 'Grupo removido')).join(', ') : 'Congregação',
    territories: row.modalidade !== 'territorio' ? FIELD_MODES[row.modalidade] || 'A definir' : row.territorios.map(id => data.territorios.find(t => t.id === id)?.numero ?? '?').join(', ') || 'A definir'
  }));
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${prefix}-01T12:00:00Z`));
  return { year: y, month: m, prefix, label: label[0].toUpperCase() + label.slice(1), rows,
    leaders: new Set(rows.map(row => row.leaderId).filter(Boolean)).size, pending: rows.filter(row => !row.leaderId).length };
}

export function writeFieldLeadersPdf(doc, data, year, month) {
  const report = fieldLeadersReport(data, year, month);
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
  const margin = 16, contentWidth = width - margin * 2;
  const weights = [26, 24, 22, 52, 53, 38, 50], widths = weights.map(w => w / 265 * contentWidth);
  const headers = ['DATA', 'DIA', 'HORÁRIO', 'DIRIGENTE', 'LOCAL', 'GRUPOS', 'TERRITÓRIOS'];
  const purple = [76, 29, 110], ink = [39, 39, 47], muted = [105, 105, 119];
  const font = (size, bold = false, color = ink) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color); };
  doc.setProperties({ title: `Dirigentes do serviço de campo - ${report.label}` });
  let y;
  function pageHeader() {
    doc.setFillColor(...purple); doc.rect(0, 0, width, 37, 'F');
    font(8, true, [220, 200, 239]); doc.text('CONGREGAÇÃO PRAIA DOS CORAIS', margin, 11);
    font(20, true, [255, 255, 255]); doc.text('Dirigentes do serviço de campo', margin, 23);
    font(10, false, [238, 227, 246]); doc.text(report.label, margin, 32);
    y = 45;
    doc.setFillColor(...purple); doc.rect(margin, y, contentWidth, 9, 'F');
    font(7.5, true, [255, 255, 255]);
    let x = margin;
    headers.forEach((header, i) => { doc.text(header, x + 3, y + 5.8); x += widths[i]; });
    y += 9;
  }
  pageHeader();
  report.rows.forEach((row, index) => {
    const values = [row.date.split('-').reverse().join('/'), row.weekday, row.time, row.leader, row.place, row.groups, row.territories];
    font(8.5);
    const lines = values.map((value, i) => doc.splitTextToSize(value, widths[i] - 6));
    const lineCount = Math.max(1, ...lines.map(value => value.length));
    for (let offset = 0; offset < lineCount;) {
      if (y + 14 > height - 23) { doc.addPage(); pageHeader(); }
      const capacity = Math.max(1, Math.floor((height - 23 - y - 8) / 4));
      const count = Math.min(capacity, lineCount - offset), rowHeight = Math.max(14, count * 4 + 8);
      doc.setFillColor(...(index % 2 ? [255, 255, 255] : [248, 248, 251])); doc.rect(margin, y, contentWidth, rowHeight, 'F');
      let x = margin;
      lines.forEach((value, i) => {
        font(8.5, i === 3, i === 3 ? row.leaderId ? purple : [157, 104, 24] : ink);
        const part = value.slice(offset, offset + count);
        if (part.length) doc.text(part, x + 3, y + 6, { lineHeightFactor: 4 / (8.5 * 0.3528) });
        x += widths[i];
      });
      doc.setDrawColor(229, 229, 236); doc.setLineWidth(0.2); doc.line(margin, y + rowHeight, width - margin, y + rowHeight);
      y += rowHeight; offset += count;
    }
  });
  if (!report.rows.length) { font(10, false, muted); doc.text('Nenhuma saída cadastrada para este mês.', margin + 3, y + 12); }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setDrawColor(229, 229, 236); doc.line(margin, height - 17, width - margin, height - 17);
    font(8, false, muted); doc.text(`Controle de Publicadores | Serviço de Campo | ${report.label}`, margin, height - 11);
    doc.text(`${page} / ${pages}`, width - margin, height - 11, { align: 'right' });
  }
  return doc;
}
