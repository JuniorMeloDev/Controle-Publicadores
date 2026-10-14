export async function ensureGroupLeadership(client) {
  await client.query(`ALTER TABLE grupos ADD COLUMN IF NOT EXISTS superintendente_id INTEGER REFERENCES publicadores(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS ajudante_id INTEGER REFERENCES publicadores(id) ON DELETE SET NULL`);
}

export async function getOwnFieldGroup(client, userId) {
  await ensureGroupLeadership(client);
  const result = await client.query(`SELECT g.id, g.nome_grupo, g.ativo,
    s.id AS super_id, COALESCE(NULLIF(TRIM(s.nome_chamado), ''), s.nome_completo) AS super_nome, s.telefone AS super_telefone,
    a.id AS ajudante_id, COALESCE(NULLIF(TRIM(a.nome_chamado), ''), a.nome_completo) AS ajudante_nome, a.telefone AS ajudante_telefone
    FROM publicadores me JOIN grupos g ON g.id = me.grupo_id
    LEFT JOIN publicadores s ON s.id = g.superintendente_id AND s.grupo_id = g.id AND 'anciao' = ANY(s.privilegios)
    LEFT JOIN publicadores a ON a.id = g.ajudante_id AND a.grupo_id = g.id AND a.privilegios && ARRAY['anciao', 'servo_ministerial']::varchar[]
    WHERE me.id = $1`, [userId]);
  const row = result.rows[0];
  if (!row) return null;
  const members = await client.query(`SELECT p.id, p.nome_completo, p.nome_chamado FROM publicadores p
    JOIN publicadores me ON me.grupo_id = p.grupo_id WHERE me.id = $1 AND p.grupo_id = $2
    ORDER BY COALESCE(NULLIF(TRIM(p.nome_chamado), ''), p.nome_completo), p.id`, [userId, row.id]);
  return { id: row.id, name: row.nome_grupo, active: row.ativo !== false,
    superintendent: row.super_id ? { id: row.super_id, name: row.super_nome, phone: row.super_telefone || '' } : null,
    assistant: row.ajudante_id ? { id: row.ajudante_id, name: row.ajudante_nome, phone: row.ajudante_telefone || '' } : null,
    members: members.rows.map(member => ({ id: member.id, name: member.nome_chamado?.trim() || member.nome_completo, shortName: member.nome_chamado?.trim() || '', isSelf: member.id === userId })) };
}
