// Network access happens outside a transaction; the meeting is locked again before saving.
export async function importMeetingProgram(client, id, { lockMeeting, fetchProgram, audit, userId }) {
    let meeting;
    await client.query('BEGIN');
    try {
        meeting = await lockMeeting(client, id, 'Meio de Semana');
        const saved = await client.query('SELECT 1 FROM reunioes_dados WHERE data_reuniao = $1 OR reuniao_id = $2', [meeting.data, meeting.id]);
        await client.query('COMMIT');
        if (saved.rowCount) return { status: 'preserved', message: 'Programação existente preservada.' };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    const schedule = await fetchProgram(meeting.data);
    await client.query('BEGIN');
    try {
        const current = await lockMeeting(client, id, 'Meio de Semana');
        if (current.data !== meeting.data) throw new Error('A data da reunião mudou. Tente novamente.');
        const saved = await client.query('SELECT 1 FROM reunioes_dados WHERE data_reuniao = $1 OR reuniao_id = $2', [current.data, current.id]);
        // Protect legacy assignments as well as complete programmes.
        const assignments = await client.query('SELECT 1 FROM designacoes_reuniao WHERE data_reuniao = $1 OR reuniao_id = $2 LIMIT 1', [current.data, current.id]);
        if (saved.rowCount || assignments.rowCount) {
            await client.query('COMMIT');
            return { status: 'preserved', message: 'Programação ou participantes existentes preservados.' };
        }
        const result = await client.query(`INSERT INTO reunioes_dados (data_reuniao, dados_json, descricao_texto, reuniao_id)
            VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING data_reuniao`,
        [current.data, JSON.stringify(schedule), schedule.weekDate, current.id]);
        if (result.rowCount) await audit(client, { userId, action: 'programacao_jw_importada', entity: 'reuniao', entityId: current.data,
            details: { source: schedule.source.url, week: schedule.source.weekStart } });
        await client.query('COMMIT');
        return { status: result.rowCount ? 'imported' : 'preserved', message: result.rowCount ? 'Programação importada. Escolha os participantes.' : 'Programação existente preservada.' };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
}
