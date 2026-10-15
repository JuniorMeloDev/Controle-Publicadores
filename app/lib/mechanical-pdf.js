import { isMechanicalTypeApplicable } from './mechanical-assignments.js';

const formatDate = value => String(value).slice(0, 10).split('-').reverse().join('/');

export function mechanicalPdfSections({ week, types, assignments, publishers }) {
  const names = new Map(publishers.map(p => [String(p.id), p.nome_chamado || p.nome_completo]));
  return week.meetings.filter(m => !m.cancelado).map(meeting => ({
    date: formatDate(meeting.data), type: meeting.tipo,
    rows: types.filter(t => t.ativo !== false && isMechanicalTypeApplicable(t, meeting)).map(type => ({
      role: type.nome, name: names.get(String(assignments[meeting.id]?.[type.id])) || 'A definir'
    }))
  }));
}

export function writeMechanicalPdf(doc, input) {
  const sections = mechanicalPdfSections(input);
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 16, contentWidth = width - margin * 2;
  const roleWidth = contentWidth * 0.46;
  const purple = [76, 29, 110], ink = [39, 39, 47], muted = [105, 105, 119];
  const font = (size, bold = false, color = ink) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color); };
  function pageHeader() {
    doc.setFillColor(...purple); doc.rect(0, 0, width, 37, 'F');
    font(8, true, [220, 200, 239]); doc.text('CONGREGAÇÃO PRAIA DOS CORAIS', margin, 12);
    font(20, true, [255, 255, 255]); doc.text('Privilégios mecânicos', margin, 24);
    font(9, false, [238, 227, 246]);
    doc.text(sections.length === 1 ? `Reunião de ${sections[0].date}` : `Semana de ${formatDate(input.week.start)} a ${formatDate(input.week.end)}`, margin, 32);
    return 47;
  }
  let y = pageHeader();
  function sectionHeader(section) {
    doc.setFillColor(244, 238, 250); doc.roundedRect(margin, y, contentWidth, 17, 2, 2, 'F');
    font(11, true, purple); doc.text(section.type, margin + 5, y + 7);
    font(9, false, muted); doc.text(section.date, margin + 5, y + 13);
    y += 22;
    font(8, true, muted); doc.text('PRIVILÉGIO', margin + 4, y); doc.text('PUBLICADOR', margin + roleWidth + 4, y);
    y += 4;
  }
  function newPage(section) { doc.addPage(); y = pageHeader(); sectionHeader(section); }
  for (const section of sections) {
    if (y + 45 > height - 23) { doc.addPage(); y = pageHeader(); }
    sectionHeader(section);
    for (const [index, row] of section.rows.entries()) {
      font(10);
      const roles = doc.splitTextToSize(row.role, roleWidth - 8);
      const names = doc.splitTextToSize(row.name, contentWidth - roleWidth - 8);
      const lineCount = Math.max(roles.length, names.length);
      // Split unusually long custom names or roles across pages without clipping.
      let offset = 0;
      while (offset < lineCount) {
        if (y + 11 > height - 23) newPage(section);
        const capacity = Math.max(1, Math.floor((height - 23 - y - 6) / 5));
        const count = Math.min(capacity, lineCount - offset);
        const rowHeight = Math.max(11, count * 5 + 6);
        doc.setFillColor(...(index % 2 ? [255, 255, 255] : [248, 248, 251]));
        doc.rect(margin, y, contentWidth, rowHeight, 'F');
        font(10, false, muted); doc.text(roles.slice(offset, offset + count), margin + 4, y + 7);
        font(10, true, row.name === 'A definir' ? [157, 104, 24] : ink);
        doc.text(names.slice(offset, offset + count), margin + roleWidth + 4, y + 7);
        doc.setDrawColor(229, 229, 236); doc.setLineWidth(0.2); doc.line(margin, y + rowHeight, width - margin, y + rowHeight);
        y += rowHeight; offset += count;
      }
    }
    if (!section.rows.length) { font(10, false, muted); doc.text('Nenhum privilégio cadastrado para esta reunião.', margin + 4, y + 8); y += 15; }
    y += 12;
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setDrawColor(229, 229, 236); doc.line(margin, height - 17, width - margin, height - 17);
    font(8, false, muted); doc.text('Controle de Publicadores · Privilégios mecânicos', margin, height - 11);
    doc.text(`${page} / ${pages}`, width - margin, height - 11, { align: 'right' });
  }
  return doc;
}
