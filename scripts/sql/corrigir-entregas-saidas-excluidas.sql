BEGIN;
SELECT pg_advisory_xact_lock(73428191);

CREATE TABLE IF NOT EXISTS auditoria_logs (
  id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES publicadores(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL, entity VARCHAR(80), entity_id VARCHAR(80), details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Only the exact automatic source marker identifies a deleted outing.
-- Completed work, results and independently entered history remain intact.
WITH removidas AS (
  DELETE FROM campo_designacoes d
  WHERE d.data_conclusao IS NULL AND d.data_transferencia IS NULL
    AND d.designacao_anterior_id IS NULL AND NOT d.origem_importacao
    AND cardinality(d.quadras_concluidas) = 0
    AND d.observacoes ~ '^Entrega registrada pela saída [1-9][0-9]*[.]$'
    AND NOT EXISTS (
      SELECT 1 FROM campo_saidas s
      WHERE d.observacoes = 'Entrega registrada pela saída ' || s.id::text || '.'
    )
    AND NOT EXISTS (SELECT 1 FROM campo_saida_resultados r WHERE r.designacao_id = d.id)
  RETURNING d.*
)
INSERT INTO auditoria_logs (action, entity, details)
SELECT 'campo_entregas_orfas_corrigidas', 'campo_designacoes',
  jsonb_build_object('entregas_anteriores_removidas', jsonb_agg(to_jsonb(removidas)))
FROM removidas HAVING COUNT(*) > 0;

COMMIT;
