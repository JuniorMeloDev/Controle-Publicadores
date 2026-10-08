export async function requestNotifications({ ids, signal, fetcher = fetch } = {}) {
    const response = await fetcher('/api/admin/notificacoes', {
        cache: 'no-store', credentials: 'same-origin', signal,
        ...(ids === undefined ? {} : {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids }),
        }),
    });
    const result = await response.json();
    if (!response.ok) {
        const error = new Error(response.status === 401
            ? 'Sua sessão expirou. Entre novamente para visualizar e marcar suas notificações.'
            : result.message || 'Não foi possível atualizar as notificações.');
        error.status = response.status;
        throw error;
    }
    return result;
}
