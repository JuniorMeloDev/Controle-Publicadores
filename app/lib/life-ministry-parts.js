export function normalizePartTitle(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

export function truncatePartTitle(title) {
    if (!title) return '';
    const normalized = normalizePartTitle(title);
    if (normalized.includes('cantico') || normalized.startsWith('cantemos')) return title;
    const match = title.match(/^(.*?\(\d+\s*min\))/i);
    if (match) {
        let base = match[1].trim();
        if (title.substring(match[0].length).match(/^[:\s]*Considera/i)) base += ': Consideração';
        return base;
    }
    const dot = title.indexOf('.');
    return dot > 0 && dot < 100 ? title.substring(0, dot).trim() : title.substring(0, 100).trim();
}

export function getPartTitles(schedule, shorten = true) {
    const title = value => shorten ? truncatePartTitle(value) : value;
    const titles = {
        presidente: 'Presidente', ajudante: 'Ajudante', oracao_inicial: 'Oração Inicial', oracao_final: 'Oração Final',
        comentarios_iniciais: schedule.openingComments || 'Comentários Iniciais',
        comentarios_finais: schedule.finalComments || 'Comentários Finais', cantico_meio: schedule.middleSong || 'Cântico do Meio'
    };
    schedule.treasures?.forEach((part, index) => { titles[`tesouro_${index}`] = title(part.title); });
    schedule.ministry?.forEach((part, index) => {
        if (normalizePartTitle(part.title).includes('discurso')) titles[`ministerio_${index}`] = title(part.title);
        else {
            titles[`ministerio_${index}_1`] = title(part.title);
            titles[`ministerio_${index}_2`] = title(part.title);
        }
    });
    schedule.living?.forEach((part, index) => {
        if (normalizePartTitle(part.title).includes('estudo biblico')) {
            titles[`vida_${index}_1`] = title(part.title);
            titles[`vida_${index}_2`] = title(part.title);
        } else titles[`vida_${index}`] = title(part.title);
    });
    return titles;
}

export function reconstructLifeMinistryAssignments(schedule, rows) {
    const assignments = {};
    const byTitle = new Map();
    const titles = getPartTitles(schedule);
    // Both title formats occur in saved records. Preserve slot order for students and assistants.
    for (const map of [titles, getPartTitles(schedule, false)]) {
        for (const [key, title] of Object.entries(map)) {
            const normalized = normalizePartTitle(title);
            if (!byTitle.has(normalized)) byTitle.set(normalized, []);
            if (!byTitle.get(normalized).includes(key)) byTitle.get(normalized).push(key);
        }
    }
    const external = schedule.participantes_externos || [];
    for (const participant of external) {
        if (Object.hasOwn(titles, participant.parte_id)) assignments[participant.parte_id] = participant.nome_completo;
    }
    for (const row of rows) {
        if (external.some(p => p.nome_parte === row.nome_parte && p.nome_completo === row.nome_completo)) continue;
        const keys = byTitle.get(normalizePartTitle(row.nome_parte)) || byTitle.get(normalizePartTitle(truncatePartTitle(row.nome_parte))) || [];
        const key = keys.find(candidate => !Object.hasOwn(assignments, candidate));
        if (key) assignments[key] = row.nome_chamado?.trim() || row.nome_completo;
    }
    return assignments;
}
