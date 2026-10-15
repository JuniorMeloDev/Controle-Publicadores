const dateLabel = value => String(value || '').slice(0, 10).split('-').reverse().join('/');

export function publicSpeechMessage(talk) {
  return ['\u{1F3E0} *DISCURSO PÚBLICO*', '\u{1F4CC} *FIM DE SEMANA*', `\u{1F4C5} ${dateLabel(talk.data)}`, '',
    `\u{1F4D6} Tema: *${talk.tema || 'A definir'}*`,
    `\u{1F3A4} Orador: *${talk.orador || 'A definir'}*`, `\u{1F3E2} Congregação: ${talk.congregacao || 'Não informada'}`, '',
    `\u{1F464} Presidente: *${talk.nome_chamado || talk.nome_completo || 'A definir'}*`, `\u{1F3B5} Cântico: *${talk.cantico || 'A definir'}*`].join('\n');
}

export function cleaningMessage(item) {
  return ['\u{1F9F9} *LIMPEZA*', `\u{1F4C5} ${dateLabel(item.data)}`, '',
    `\u{1F465} Grupo: *${item.grupo || 'A definir'}*`, '',
    `\u{1F9FD} *Tarefas:*\n${item.tarefas || 'A definir'}`, '',
    `\u{1F464} Responsáveis: *${item.responsaveis || 'A definir'}*`].join('\n');
}

export function mechanicalWeekMessage(week, types, assignments, publishers, isApplicable) {
  const names = new Map(publishers.map(p => [String(p.id), p.nome_chamado || p.nome_completo]));
  const meetings = week.meetings.filter(m => !m.cancelado);
  const singleMeeting = meetings.length === 1;
  const lines = singleMeeting
    ? ['\u{1F3E0} *PRIVILÉGIOS MECÂNICOS*', `\u{1F4CC} *${meetings[0].tipo.toUpperCase()}*`, `\u{1F4C5} ${dateLabel(meetings[0].data)}`, '']
    : ['\u{1F3E0} *PRIVILÉGIOS MECÂNICOS*', `\u{1F4C5} Semana de ${dateLabel(week.start)} a ${dateLabel(week.end)}`];
  const roleIcon = name => {
    const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (normalized.includes('leitor')) return '\u{1F4D6}';
    if (normalized.includes('anciao')) return '\u{1F91D}';
    if (normalized.includes('som') || normalized.includes('audio')) return '\u{1F3A7}';
    if (normalized.includes('microfone') || normalized.includes('volante')) return '\u{1F3A4}';
    if (normalized.includes('externo')) return '\u{1F6AA}';
    if (normalized.includes('indicador')) return '\u{1F465}';
    return '\u{1F464}';
  };
  for (const meeting of meetings) {
    if (!singleMeeting) lines.push('', `\u{1F4CC} *${meeting.tipo.toUpperCase()}*`, `\u{1F4C6} ${dateLabel(meeting.data)}`, '');
    for (const type of types.filter(t => isApplicable(t, meeting))) {
      lines.push(`${roleIcon(type.nome)} ${type.nome}: *${names.get(String(assignments[meeting.id]?.[type.id])) || 'A definir'}*`);
    }
  }
  return lines.join('\n');
}

// Plain text keeps accents intact in jsPDF's built-in font. Long lines and notes paginate.
export function writeDesignationPdf(doc, title, message) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 16;
  function header() {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(88, 28, 135);
    const lines = doc.splitTextToSize(title, width - margin * 2);
    doc.text(lines, margin, 20);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(39, 39, 42);
    return 28 + lines.length * 6;
  }
  let y = header();
  // WhatsApp formatting and emoji are omitted from PDFs rendered with the standard font.
  const printableMessage = message.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\*/g, '');
  for (const paragraph of printableMessage.split('\n')) {
    for (const line of doc.splitTextToSize(paragraph || ' ', width - margin * 2)) {
      if (y > height - margin) { doc.addPage(); y = header(); }
      doc.text(line, margin, y); y += 6;
    }
  }
  return doc;
}
