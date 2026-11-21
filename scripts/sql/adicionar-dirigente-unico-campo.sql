BEGIN;
ALTER TABLE campo_saidas
  ADD COLUMN IF NOT EXISTS dirigente_unico BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS territorios_por_grupo JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(territorios_por_grupo) = 'object');
COMMIT;
