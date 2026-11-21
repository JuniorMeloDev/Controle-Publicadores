CREATE TABLE IF NOT EXISTS campo_saida_notificacoes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  saida_id INTEGER NOT NULL REFERENCES campo_saidas(id) ON DELETE CASCADE,
  publicador_id INTEGER NOT NULL REFERENCES publicadores(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  conteudo JSONB NOT NULL,
  UNIQUE (saida_id, publicador_id)
);
CREATE INDEX IF NOT EXISTS campo_saida_notificacoes_publicador
  ON campo_saida_notificacoes (publicador_id, data DESC, id DESC);
