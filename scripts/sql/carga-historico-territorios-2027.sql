-- Carga inicial conferida nas duas páginas do PDF:
-- Registro de Designação de Território - Ano de Serviço_ 2027.xlsx - Controle.pdf
-- SHA-256: 0160bacb16ff36856624f03c52dc88472229281e0469ae5628ea38df7917e073
-- Ano de serviço 2027: setembro/2026 a agosto/2027.
-- Datas de setembro e outubro no documento correspondem a 2026.
-- 51 designações; 31 territórios; sem histórico: 21, 23 e 30.
-- Nomes preservados literalmente. “Visita” não foi atribuída a um publicador.
-- Revise os dados e, se desejar, preencha os IDs dos responsáveis na coluna publicador_id.
-- Pré-requisito: npm run migrate:field-service
-- Carga separada da migração automática; nenhuma saída antiga é criada na Agenda.
BEGIN;
SELECT pg_advisory_xact_lock(73428191);

CREATE TEMP TABLE carga_campo_territorios (
  numero INTEGER PRIMARY KEY, fim_semana BOOLEAN NOT NULL, ultima_conclusao DATE
) ON COMMIT DROP;
INSERT INTO carga_campo_territorios (numero, fim_semana, ultima_conclusao) VALUES
  (1, FALSE, '2026-10-28'),
  (2, FALSE, '2026-10-28'),
  (3, FALSE, '2026-10-28'),
  (4, FALSE, '2026-10-28'),
  (5, FALSE, '2026-10-31'),
  (6, FALSE, '2026-10-29'),
  (7, FALSE, '2026-10-31'),
  (8, FALSE, '2026-10-30'),
  (9, FALSE, '2026-10-30'),
  (10, FALSE, '2026-10-30'),
  (11, FALSE, '2026-10-29'),
  (12, FALSE, '2026-10-29'),
  (13, FALSE, '2026-10-21'),
  (14, FALSE, '2026-10-31'),
  (15, FALSE, '2026-10-03'),
  (16, FALSE, '2026-10-17'),
  (17, TRUE, '2026-09-12'),
  (18, FALSE, '2026-10-31'),
  (19, FALSE, '2026-09-05'),
  (20, TRUE, '2026-10-24'),
  (21, TRUE, NULL),
  (22, TRUE, '2026-09-12'),
  (23, TRUE, NULL),
  (24, FALSE, '2026-10-11'),
  (25, FALSE, '2026-10-24'),
  (26, FALSE, '2026-10-03'),
  (27, FALSE, '2026-10-17'),
  (28, TRUE, '2026-09-05'),
  (29, TRUE, '2026-10-24'),
  (30, TRUE, NULL),
  (31, TRUE, '2026-09-12');

CREATE TEMP TABLE carga_campo_historico (
  numero INTEGER NOT NULL REFERENCES carga_campo_territorios(numero),
  responsavel_nome TEXT NOT NULL,
  data_designacao DATE NOT NULL, data_conclusao DATE NOT NULL,
  publicador_id INTEGER, pagina INTEGER NOT NULL, coluna INTEGER NOT NULL,
  PRIMARY KEY (numero, data_designacao, data_conclusao),
  CHECK (data_conclusao >= data_designacao)
) ON COMMIT DROP;
-- A coluna publicador_id fica NULL quando o vínculo não foi confirmado.
INSERT INTO carga_campo_historico
  (numero, responsavel_nome, data_designacao, data_conclusao, publicador_id, pagina, coluna) VALUES
  (1, 'Ives Duda', '2026-09-17', '2026-09-17', NULL, 1, 1),
  (1, 'Fabricio', '2026-10-01', '2026-10-01', NULL, 1, 2),
  (1, 'Visita', '2026-10-28', '2026-10-28', NULL, 1, 3),
  (2, 'Paulo César', '2026-09-01', '2026-09-01', NULL, 1, 1),
  (2, 'Ives Duda', '2026-10-08', '2026-10-08', NULL, 1, 2),
  (2, 'Visita', '2026-10-28', '2026-10-28', NULL, 1, 3),
  (3, 'Otávio Malucelli', '2026-09-16', '2026-09-16', NULL, 1, 1),
  (3, 'Gilliano M', '2026-10-17', '2026-10-17', NULL, 1, 2),
  (3, 'Visita', '2026-10-28', '2026-10-28', NULL, 1, 3),
  (4, 'Otavio Malucelli', '2026-09-02', '2026-09-02', NULL, 1, 1),
  (4, 'Ives Duda', '2026-10-22', '2026-10-22', NULL, 1, 2),
  (4, 'Visita', '2026-10-28', '2026-10-28', NULL, 1, 3),
  (5, 'Ives Duda', '2026-09-03', '2026-09-03', NULL, 1, 1),
  (5, 'Visita', '2026-10-31', '2026-10-31', NULL, 1, 2),
  (6, 'Paulo César', '2026-10-20', '2026-10-20', NULL, 1, 1),
  (6, 'Visita', '2026-10-29', '2026-10-29', NULL, 1, 2),
  (7, 'Ives Duda', '2026-09-10', '2026-09-10', NULL, 1, 1),
  (7, 'Fabrício', '2026-10-13', '2026-10-13', NULL, 1, 2),
  (7, 'Visita', '2026-10-31', '2026-10-31', NULL, 1, 3),
  (8, 'Paulo César', '2026-09-15', '2026-09-15', NULL, 1, 1),
  (8, 'Visita', '2026-10-30', '2026-10-30', NULL, 1, 2),
  (9, 'Otávio Malucelli', '2026-09-16', '2026-09-16', NULL, 1, 1),
  (9, 'Visita', '2026-10-30', '2026-10-30', NULL, 1, 2),
  (10, 'Paulo César', '2026-09-22', '2026-09-22', NULL, 1, 1),
  (10, 'Gilliano Menezes', '2026-10-24', '2026-10-24', NULL, 1, 2),
  (10, 'Visita', '2026-10-30', '2026-10-30', NULL, 1, 3),
  (11, 'Gilliano Menezes', '2026-09-12', '2026-09-12', NULL, 1, 1),
  (11, 'Visita', '2026-10-29', '2026-10-29', NULL, 1, 2),
  (12, 'Otávio Malucelli', '2026-09-09', '2026-09-09', NULL, 1, 1),
  (12, 'Paulo César', '2026-10-20', '2026-10-20', NULL, 1, 2),
  (12, 'Visita', '2026-10-29', '2026-10-29', NULL, 1, 3),
  (13, 'Luiz Filipe', '2026-09-05', '2026-09-05', NULL, 1, 1),
  (13, 'Luiz Filipe', '2026-10-21', '2026-10-21', NULL, 1, 2),
  (14, 'Paulo César', '2026-09-08', '2026-09-08', NULL, 1, 1),
  (14, 'Ives Duda', '2026-10-01', '2026-10-01', NULL, 1, 2),
  (14, 'Visita', '2026-10-31', '2026-10-31', NULL, 1, 3),
  (15, 'Gilliano Menezes', '2026-10-03', '2026-10-03', NULL, 1, 1),
  (16, 'Junior Melo', '2026-10-17', '2026-10-17', NULL, 1, 1),
  (17, 'Luiz Filipe', '2026-09-12', '2026-09-12', NULL, 1, 1),
  (18, 'Paulo César', '2026-10-17', '2026-10-17', NULL, 1, 1),
  (18, 'Visita', '2026-10-31', '2026-10-31', NULL, 1, 2),
  (19, 'Bruno Barbosa', '2026-09-05', '2026-09-05', NULL, 1, 1),
  (20, 'Paulo César', '2026-10-24', '2026-10-24', NULL, 1, 1),
  (22, 'Paulo César', '2026-09-12', '2026-09-12', NULL, 1, 1),
  (24, 'Danilo Paixão', '2026-10-11', '2026-10-11', NULL, 1, 1),
  (25, 'Junior Melo', '2026-10-24', '2026-10-24', NULL, 1, 1),
  (26, 'Junior Melo', '2026-10-03', '2026-10-03', NULL, 1, 1),
  (27, 'Denisson Freire', '2026-10-17', '2026-10-17', NULL, 1, 1),
  (28, 'Denisson Freire', '2026-09-05', '2026-09-05', NULL, 1, 1),
  (29, 'Denisson Freire', '2026-10-24', '2026-10-24', NULL, 1, 1),
  (31, 'Denisson Freire', '2026-09-12', '2026-09-12', NULL, 2, 1);

DO $$
DECLARE faltantes TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM carga_campo_historico c LEFT JOIN publicadores p ON p.id = c.publicador_id
    WHERE c.publicador_id IS NOT NULL AND p.id IS NULL
  ) THEN RAISE EXCEPTION 'Há um publicador_id inexistente na carga. Confira os vínculos.'; END IF;
  SELECT string_agg(c.numero::text, ', ' ORDER BY c.numero) INTO faltantes
  FROM carga_campo_territorios c LEFT JOIN campo_territorios t ON t.numero = c.numero WHERE t.id IS NULL;
  IF faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'Cadastre os territórios ausentes antes da carga: %', faltantes;
  END IF;
  IF EXISTS (
    SELECT 1 FROM carga_campo_territorios c
    WHERE c.ultima_conclusao IS DISTINCT FROM
      (SELECT MAX(h.data_conclusao) FROM carga_campo_historico h WHERE h.numero = c.numero)
  ) THEN RAISE EXCEPTION 'A última conclusão diverge das designações da carga.'; END IF;
END $$;

-- Preserve existing history. Divergences are reported instead of overwritten.
CREATE TEMP TABLE carga_campo_conflitos ON COMMIT DROP AS
SELECT c.numero, c.responsavel_nome AS responsavel_pdf, c.data_designacao, c.data_conclusao,
  d.id AS designacao_existente_id,
  COALESCE(NULLIF(p.nome_chamado, ''), p.nome_completo, d.responsavel_nome) AS responsavel_existente,
  d.data_designacao AS entrega_existente, d.data_conclusao AS conclusao_existente
FROM carga_campo_historico c JOIN campo_territorios t ON t.numero = c.numero
JOIN campo_designacoes d ON d.territorio_id = t.id
  AND d.data_designacao <= c.data_conclusao
  AND COALESCE(d.data_conclusao, 'infinity'::date) >= c.data_designacao
LEFT JOIN publicadores p ON p.id = d.publicador_id
WHERE NOT (d.data_designacao = c.data_designacao AND d.data_conclusao IS NOT DISTINCT FROM c.data_conclusao);

-- Apenas as marcações FDS explícitas alteram as regras; as demais são preservadas.
CREATE TEMP TABLE carga_campo_periodos_alterados ON COMMIT DROP AS
WITH alterados AS (
  UPDATE campo_territorios t SET periodo = 'fim_semana', fim_semana = TRUE
  FROM carga_campo_territorios c WHERE t.numero = c.numero AND c.fim_semana
    AND (t.periodo IS DISTINCT FROM 'fim_semana' OR NOT t.fim_semana)
  RETURNING t.id
) SELECT id FROM alterados;

-- Reexecutar este SQL não duplica as designações.
CREATE TEMP TABLE carga_campo_inseridos ON COMMIT DROP AS
WITH inseridos AS (
  INSERT INTO campo_designacoes
    (territorio_id, publicador_id, responsavel_nome, data_designacao, data_conclusao, observacoes, origem_importacao)
  SELECT t.id, c.publicador_id, c.responsavel_nome, c.data_designacao, c.data_conclusao,
    format('Controle do ano de serviço 2027. PDF conferido, página %s, designação %s.', c.pagina, c.coluna), TRUE
  FROM carga_campo_historico c JOIN campo_territorios t ON t.numero = c.numero
  WHERE NOT EXISTS (
    SELECT 1 FROM campo_designacoes d WHERE d.territorio_id = t.id
      AND d.data_designacao = c.data_designacao AND d.data_conclusao = c.data_conclusao
  ) AND NOT EXISTS (
    SELECT 1 FROM carga_campo_conflitos x WHERE x.numero = c.numero
      AND x.data_designacao = c.data_designacao AND x.data_conclusao = c.data_conclusao
  ) ORDER BY c.numero, c.data_designacao
  RETURNING id
) SELECT id FROM inseridos;

CREATE TABLE IF NOT EXISTS auditoria_logs (
  id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES publicadores(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL, entity VARCHAR(80), entity_id VARCHAR(80), details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO auditoria_logs (action, entity, details)
SELECT 'campo_designacoes_importacao_sql', 'campo_designacoes', jsonb_build_object(
  'origem', 'Controle do ano de serviço 2027',
  'registros_fonte', (SELECT COUNT(*) FROM carga_campo_historico),
  'importados', (SELECT COUNT(*) FROM carga_campo_inseridos),
  'periodos_alterados', (SELECT COUNT(*) FROM carga_campo_periodos_alterados),
  'conflitos_preservados', (SELECT COUNT(DISTINCT (numero, data_designacao, data_conclusao)) FROM carga_campo_conflitos),
  'nomes_preservados_sem_vinculo_automatico', TRUE)
WHERE EXISTS (SELECT 1 FROM carga_campo_inseridos) OR EXISTS (SELECT 1 FROM carga_campo_periodos_alterados);

SELECT
  (SELECT COUNT(*) FROM carga_campo_inseridos) AS importados,
  (SELECT COUNT(*) FROM carga_campo_historico) - (SELECT COUNT(*) FROM carga_campo_inseridos)
    - (SELECT COUNT(DISTINCT (numero, data_designacao, data_conclusao)) FROM carga_campo_conflitos) AS ja_existentes,
  (SELECT COUNT(DISTINCT (numero, data_designacao, data_conclusao)) FROM carga_campo_conflitos) AS conflitos_preservados,
  (SELECT COUNT(*) FROM carga_campo_periodos_alterados) AS regras_fds_alteradas;
-- Review these rows separately. No existing record was changed by this load.
SELECT numero AS territorio, responsavel_pdf, data_designacao AS entrega_pdf, data_conclusao AS conclusao_pdf,
  designacao_existente_id, responsavel_existente, entrega_existente, conclusao_existente
FROM carga_campo_conflitos ORDER BY numero, data_designacao;
COMMIT;
