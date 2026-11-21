CREATE TABLE IF NOT EXISTS web_push_alertas_envios (
  aparelho_id UUID NOT NULL REFERENCES web_push_inscricoes(aparelho_id) ON DELETE CASCADE,
  publicador_id INTEGER NOT NULL REFERENCES publicadores(id) ON DELETE CASCADE,
  notificacao_id TEXT NOT NULL,
  PRIMARY KEY (aparelho_id, publicador_id, notificacao_id)
);
