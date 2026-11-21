BEGIN;
SELECT pg_advisory_xact_lock(73428191);
ALTER TABLE campo_designacoes
  ADD COLUMN IF NOT EXISTS data_transferencia DATE,
  ADD COLUMN IF NOT EXISTS designacao_anterior_id INTEGER REFERENCES campo_designacoes(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS orientacoes_continuacao TEXT NOT NULL DEFAULT '';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campo_designacoes_transferencia_valida') THEN
    ALTER TABLE campo_designacoes ADD CONSTRAINT campo_designacoes_transferencia_valida
      CHECK (data_transferencia IS NULL OR (data_conclusao IS NULL AND data_transferencia >= data_designacao));
  END IF;
END $$;
DROP INDEX IF EXISTS campo_designacao_aberta;
CREATE UNIQUE INDEX campo_designacao_aberta ON campo_designacoes(territorio_id)
  WHERE data_conclusao IS NULL AND data_transferencia IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS campo_designacao_continuacao ON campo_designacoes(designacao_anterior_id)
  WHERE designacao_anterior_id IS NOT NULL;
COMMIT;
