// Unicode escapes keep emoji code points intact regardless of the source editor's encoding.
const icons = {
    hall: '\u{1F3E0}', song: '\u{1F3B5}', prayer: '\u{1F64F}', comments: '\u{1F3A4}',
    treasures: '\u{1F48E}', ministry: '\u{1F33E}', living: '\u{1F411}',
    student: '\u{1F464}', assistant: '\u{1F91D}', reading: '\u{1F4D6}'
};

export const lifeMinistryWhatsAppUrl = message => `https://api.whatsapp.com/send/?text=${encodeURIComponent(message)}`;

export function buildLifeMinistryWhatsAppMessage(weekText, schedule, assignments = {}, publishers = []) {
    const normalizeName = name => typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
    const byName = new Map(publishers.map(p => [normalizeName(p.nome_completo), p]));
    const displayName = value => {
        const fullName = normalizeName(value);
        if (!fullName) return '';
        const publisher = byName.get(fullName);
        const preferred = [publisher?.nome_chamado, publisher?.apelido, publisher?.nome_curto].map(normalizeName).find(Boolean);
        if (preferred) return preferred;
        const parts = fullName.split(' ');
        return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : fullName;
    };
    assignments = Object.fromEntries(Object.entries(assignments).map(([part, name]) => [part, displayName(name)]));
    let text = `*DESIGNAÇÕES: ${weekText}*\n_Nossa Vida e Ministério Cristão_\n\n`;
    text += `${icons.hall} *SALÃO PRINCIPAL*\nPresidente: *${assignments.presidente || '---'}*\nAjudante: ${assignments.ajudante || '---'}\n\n`;
    text += `${icons.song} Cântico inicial: *${schedule.initialSong || '---'}*\n${icons.prayer} Oração: *${assignments.oracao_inicial || '---'}*\n${icons.comments} ${schedule.openingComments || 'Comentários iniciais'}: *${assignments.comentarios_iniciais || '---'}*\n\n`;
    const titleOf = part => part.title.replace(/\(.*\)/, '').trim().replace(/[:\s]+$/, '');
    text += `${icons.treasures} *TESOUROS DA PALAVRA DE DEUS*\n`;
    schedule.treasures?.forEach((part, idx) => {
        text += `• ${titleOf(part)}: *${assignments[`tesouro_${idx}`] || '---'}*\n`;
    });
    text += `\n${icons.ministry} *FAÇA SEU MELHOR NO MINISTÉRIO*\n`;
    schedule.ministry?.forEach((part, idx) => {
        if (part.title.toLowerCase().includes('discurso')) {
            text += `• ${titleOf(part)}: *${assignments[`ministerio_${idx}`] || '---'}*\n`;
        } else {
            text += `• ${titleOf(part)}:\n   ${icons.student} *${assignments[`ministerio_${idx}_1`] || '---'}* / ${icons.assistant} ${assignments[`ministerio_${idx}_2`] || '---'}\n`;
        }
    });
    text += `\n${icons.living} *NOSSA VIDA CRISTÃ*\n${icons.song} ${schedule.middleSong || '---'}: *${assignments.cantico_meio || '---'}*\n`;
    schedule.living?.forEach((part, idx) => {
        const normalized = part.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (normalized.includes('estudo biblico')) {
            text += `• ${titleOf(part)}:\n   ${icons.student} *${assignments[`vida_${idx}_1`] || '---'}* / ${icons.reading} ${assignments[`vida_${idx}_2`] || '---'}\n`;
        } else {
            text += `• ${titleOf(part)}: *${assignments[`vida_${idx}`] || '---'}*\n`;
        }
    });
    text += `\n${icons.comments} ${schedule.finalComments || 'Comentários finais'}: *${assignments.comentarios_finais || '---'}*\n${icons.song} ${schedule.finalSong || '---'}\n${icons.prayer} Oração final: *${assignments.oracao_final || '---'}*`;
    return text;
}
