export async function getCadastroProgress(client) {
  const result = await client.query(`SELECT p.id, p.nome_completo, g.nome_grupo,
    c.enviado_em, COALESCE(a.pendentes, 0)::int AS pendentes
    FROM publicadores p LEFT JOIN grupos g ON g.id = p.grupo_id
    LEFT JOIN cadastro_confirmacoes c ON c.publicador_id = p.id
    LEFT JOIN (SELECT publicador_id, COUNT(*)::int AS pendentes FROM cadastro_alteracoes
      WHERE status = 'pendente' GROUP BY publicador_id) a ON a.publicador_id = p.id
    WHERE g.id IS NULL OR g.ativo = TRUE ORDER BY p.nome_completo, p.id`);
  const enviados = result.rows.filter(row => row.enviado_em).length;
  return { publicadores: result.rows, total: result.rows.length, enviados, faltam: result.rows.length - enviados };
}
