export async function ensureSpecialParticipants(client) {
    await client.query(`CREATE TABLE IF NOT EXISTS pessoas_especiais (
        papel TEXT PRIMARY KEY CHECK (papel IN ('superintendente', 'esposa')),
        nome_completo VARCHAR(255) NOT NULL
    )`);
}

export async function getSpecialParticipants(client) {
    await ensureSpecialParticipants(client);
    const result = await client.query('SELECT papel, nome_completo FROM pessoas_especiais ORDER BY papel DESC');
    return result.rows;
}
