// Read each assignment from its owning table so edits and removals are reflected immediately.
const normalizeName = expression => `lower(translate(regexp_replace(trim(${expression}), '\\s+', ' ', 'g'),
    'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'))`;

export async function getPublisherAssignments(client, { publisherId, futureOnly = false, since } = {}) {
    const params = [];
    const filters = [];
    if (publisherId) {
        params.push(publisherId);
        filters.push(`a.publicador_id = $${params.length}`);
    }
    if (futureOnly) {
        filters.push("a.data_reuniao >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date");
        filters.push('NOT EXISTS (SELECT 1 FROM reunioes_registro cancelled WHERE cancelled.id = a.reuniao_id AND cancelled.cancelada = TRUE)');
    }
    if (since) {
        params.push(since);
        filters.push(`a.data_reuniao >= $${params.length}::date`);
    }

    const result = await client.query(`
        WITH assignments AS (
            SELECT 'vida-' || d.id AS id, d.publicador_id, d.data_reuniao,
                d.nome_parte, d.descricao_semana, 'Vida e Ministério'::text AS categoria,
                'vida_ministerio'::text AS origem, d.reuniao_id
            FROM designacoes_reuniao d

            UNION ALL
            SELECT 'mecanico-' || rp.id, rp.publicador_id, r.data,
                pt.nome, r.tipo, 'Privilégios Mecânicos', 'privilegios_mecanicos', r.id
            FROM reunioes_privilegios rp
            JOIN reunioes_registro r ON r.id = rp.reuniao_id
            JOIN privilegios_tipos pt ON pt.id = rp.privilegio_tipo_id
            WHERE rp.publicador_id IS NOT NULL

            UNION ALL
            SELECT 'presidente-' || d.id, d.presidente_id, d.data,
                'Presidente do discurso público', d.tema, 'Discursos Públicos', 'discursos_publicos', d.reuniao_id
            FROM discursos_publicos d WHERE d.presidente_id IS NOT NULL

            UNION ALL
            SELECT 'orador-' || d.id, p.id, d.data,
                'Orador: ' || COALESCE(NULLIF(d.tema, ''), 'Discurso público'), d.congregacao,
                'Discursos Públicos', 'discursos_publicos', d.reuniao_id
            FROM discursos_publicos d
            JOIN publicadores p ON ${normalizeName('d.orador')} = ${normalizeName('p.nome_completo')}
                OR (${normalizeName('d.orador')} = ${normalizeName('p.nome_chamado')}
                    AND NULLIF(trim(p.nome_chamado), '') IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1 FROM publicadores outro WHERE outro.id <> p.id
                            AND ${normalizeName('outro.nome_chamado')} = ${normalizeName('p.nome_chamado')}
                    ))

            UNION ALL
            SELECT 'limpeza-' || l.id || '-' || p.id, p.id, l.data,
                'Limpeza semanal', concat_ws(' — ', l.grupo, l.tarefas),
                'Limpeza Semanal', 'limpeza_semanal', l.reuniao_id
            FROM limpeza_semanal l
            JOIN publicadores p ON EXISTS (
                SELECT 1 FROM grupos g WHERE g.id = p.grupo_id
                    AND ${normalizeName('g.nome_grupo')} = ${normalizeName('l.grupo')}
            ) OR EXISTS (
                SELECT 1 FROM regexp_split_to_table(COALESCE(l.responsaveis, ''),
                    '[,;\\n]|[[:space:]]+e[[:space:]]+') AS responsavel(nome)
                WHERE ${normalizeName('responsavel.nome')} = ${normalizeName('p.nome_completo')}
                    OR (${normalizeName('responsavel.nome')} = ${normalizeName('p.nome_chamado')}
                        AND NULLIF(trim(p.nome_chamado), '') IS NOT NULL)
            )
        )
        SELECT a.*, p.nome_completo, p.nome_chamado
        FROM assignments a JOIN publicadores p ON p.id = a.publicador_id
        ${filters.length ? 'WHERE ' + filters.join(' AND ') : ''}
        ORDER BY a.data_reuniao ASC, a.categoria, a.nome_parte, a.id
    `, params);
    return result.rows;
}
