export const PROGRAM_SESSION_MESSAGE = 'Sua sessão expirou ou não está válida. Entre novamente e tente buscar a programação. As reuniões já criadas foram preservadas.';

export async function requestMeetingProgram(id, fetcher = fetch) {
    const response = await fetcher('/api/admin/reunioes/importar-programacao', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reuniao_id: id })
    });
    if (response.status === 401) {
        const error = new Error(PROGRAM_SESSION_MESSAGE);
        error.status = 401;
        throw error;
    }
    const result = await response.json();
    if (!response.ok) {
        const error = new Error(result.message || 'Não foi possível buscar a programação.');
        error.status = response.status;
        throw error;
    }
    return result;
}

// One request per meeting keeps long periods within server request time limits.
export async function importCreatedPrograms(meetings = [], onProgress = () => {}) {
    const results = [];
    let sessionRequired = false;
    for (const meeting of meetings) {
        if (sessionRequired) {
            results.push({ ...meeting, status: 'pending', message: PROGRAM_SESSION_MESSAGE });
            continue;
        }
        onProgress(`Buscando programação de ${meeting.data.split('-').reverse().join('/')}…`);
        try {
            const data = await requestMeetingProgram(meeting.id);
            results.push({ ...meeting, status: data.status, message: data.message });
        } catch (error) {
            sessionRequired = error.status === 401;
            results.push({ ...meeting, status: 'pending', message: error.status ? error.message : 'Falha de conexão. Tente buscar novamente em Vida e Ministério.' });
        }
    }
    const imported = results.filter(r => r.status === 'imported').length;
    const pending = results.filter(r => r.status === 'pending');
    const preserved = results.filter(r => r.status === 'preserved').length;
    return { message: `${imported} programações importadas; ${preserved} preservadas; ${pending.length} pendentes.`,
        details: pending.map(r => `${r.data.split('-').reverse().join('/')}: ${r.message}`), sessionRequired };
}
