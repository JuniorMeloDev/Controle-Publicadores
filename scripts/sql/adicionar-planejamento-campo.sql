BEGIN;
ALTER TABLE campo_territorios ADD COLUMN IF NOT EXISTS periodo TEXT;
UPDATE campo_territorios SET periodo = CASE WHEN fim_semana THEN 'fim_semana' ELSE 'ambos' END WHERE periodo IS NULL;
ALTER TABLE campo_territorios ALTER COLUMN periodo SET DEFAULT 'ambos', ALTER COLUMN periodo SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campo_territorios_periodo') THEN
    ALTER TABLE campo_territorios ADD CONSTRAINT campo_territorios_periodo CHECK (periodo IN ('semana', 'fim_semana', 'ambos'));
  END IF;
END $$;
ALTER TABLE campo_designacoes ADD COLUMN IF NOT EXISTS responsavel_nome TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS origem_importacao BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE campo_designacoes ALTER COLUMN publicador_id DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campo_designacoes_responsavel') THEN
    ALTER TABLE campo_designacoes ADD CONSTRAINT campo_designacoes_responsavel CHECK (publicador_id IS NOT NULL OR origem_importacao);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS campo_saida_resultados (
  id SERIAL PRIMARY KEY,
  saida_id INTEGER REFERENCES campo_saidas(id) ON DELETE SET NULL,
  territorio_id INTEGER NOT NULL REFERENCES campo_territorios(id) ON DELETE RESTRICT,
  designacao_id INTEGER REFERENCES campo_designacoes(id) ON DELETE RESTRICT,
  resultado TEXT NOT NULL CHECK (resultado IN ('concluido', 'parcial', 'nao_trabalhado')),
  data DATE NOT NULL, observacoes TEXT NOT NULL DEFAULT '',
  UNIQUE (saida_id, territorio_id)
);
COMMIT;
