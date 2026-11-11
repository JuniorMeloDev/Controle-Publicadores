// Older meetings had a single count; keep it as presencial until edited.
export function meetingVisitors(meeting) {
    const presencial = Number(meeting.visitantes_presencial ?? meeting.visitantes ?? 0);
    const zoom = Number(meeting.visitantes_zoom ?? 0);
    return { visitantes_presencial: presencial, visitantes_zoom: zoom, visitantes: presencial + zoom };
}

export function validateMeetingVisitors(value) {
    if (!value || !['visitantes_presencial', 'visitantes_zoom'].every(key =>
        Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= 2147483647) ||
        value.visitantes_presencial + value.visitantes_zoom > 2147483647) {
        throw new Error('Informe números inteiros não negativos para os visitantes presenciais e por Zoom.');
    }
    return meetingVisitors(value);
}

export async function ensureVisitorColumns(client) {
    await client.query(`ALTER TABLE reunioes_registro
        ADD COLUMN IF NOT EXISTS visitantes INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS visitantes_presencial INTEGER CHECK (visitantes_presencial >= 0),
        ADD COLUMN IF NOT EXISTS visitantes_zoom INTEGER NOT NULL DEFAULT 0 CHECK (visitantes_zoom >= 0)`);
}
