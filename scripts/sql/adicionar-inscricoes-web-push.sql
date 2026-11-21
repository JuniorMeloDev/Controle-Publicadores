CREATE TABLE IF NOT EXISTS web_push_inscricoes (
  aparelho_id UUID PRIMARY KEY,
  publicador_id INTEGER NOT NULL REFERENCES publicadores(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  chaves JSONB NOT NULL,
  chave_vapid TEXT NOT NULL,
  expira_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS web_push_inscricoes_publicador
  ON web_push_inscricoes (publicador_id);
