// These CTEs shadow the application tables. All rows are fictitious, and no table is modified.
export const assignmentFixtureCtes = `
    publicadores(id, nome_completo, nome_chamado, grupo_id) AS (VALUES
        (900001, 'Publicador Fictício Alfa', 'Fictício Alfa', 930001),
        (900002, 'Publicador Fictício Beta', 'Fictício Beta', NULL::int)),
    grupos(id, nome_grupo) AS (VALUES (930001, 'Grupo Fictício')),
    designacoes_reuniao(id, publicador_id, data_reuniao, nome_parte, descricao_semana) AS (VALUES
        (940001, 900001, DATE '2030-01-10', 'Parte fictícia', 'Semana fictícia'),
        (940002, 900001, DATE '2001-01-10', 'Parte fictícia antiga', 'Semana fictícia antiga')),
    reunioes_registro(id, data, tipo) AS (VALUES
        (910001, DATE '2030-01-09', 'Meio de Semana')),
    privilegios_tipos(id, nome) AS (VALUES (920001, 'Volante')),
    reunioes_privilegios(id, reuniao_id, privilegio_tipo_id, publicador_id) AS (VALUES
        (950001, 910001, 920001, 900001),
        (950002, 910001, 920001, NULL::int)),
    discursos_publicos(id, presidente_id, data, tema, orador, congregacao) AS (VALUES
        (960001, 900001, DATE '2030-01-13', 'Tema fictício', 'Ficticio Beta', 'Congregação Fictícia'),
        (960002, NULL::int, DATE '2030-01-20', 'Outro tema fictício', 'Fictício Alfa', 'Congregação Fictícia')),
    limpeza_semanal(id, data, grupo, tarefas, responsaveis) AS (VALUES
        (970001, DATE '2030-01-12', 'Grupo Fictício', 'Tarefa fictícia', 'Ficticio Alfa e Fictício Beta'))
`;
