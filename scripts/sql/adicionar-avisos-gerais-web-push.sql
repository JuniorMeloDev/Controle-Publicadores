BEGIN;

ALTER TABLE web_push_inscricoes
  ADD COLUMN IF NOT EXISTS avisos_gerais BOOLEAN NOT NULL DEFAULT FALSE,
  ALTER COLUMN publicador_id DROP NOT NULL;

ALTER TABLE web_push_inscricoes
  DROP CONSTRAINT IF EXISTS web_push_inscricoes_publicador_id_fkey,
  ADD CONSTRAINT web_push_inscricoes_publicador_id_fkey
    FOREIGN KEY (publicador_id) REFERENCES publicadores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS web_push_inscricoes_avisos_gerais
  ON web_push_inscricoes (chave_vapid) WHERE avisos_gerais;

CREATE TABLE IF NOT EXISTS web_push_avisos_gerais (
  id UUID PRIMARY KEY,
  titulo VARCHAR(80) NOT NULL,
  mensagem VARCHAR(240) NOT NULL,
  publicado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
