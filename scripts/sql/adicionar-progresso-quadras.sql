BEGIN;
ALTER TABLE campo_designacoes
  ADD COLUMN IF NOT EXISTS quadras_concluidas TEXT[] NOT NULL DEFAULT '{}';
COMMIT;
