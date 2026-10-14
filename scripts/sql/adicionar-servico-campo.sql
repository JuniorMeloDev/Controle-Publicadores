BEGIN;
CREATE TABLE IF NOT EXISTS campo_locais (
  id SERIAL PRIMARY KEY, nome VARCHAR(120) NOT NULL,
  endereco TEXT NOT NULL DEFAULT '', mapa_url TEXT NOT NULL DEFAULT '',
  grupos INTEGER[] NOT NULL DEFAULT '{}', observacoes TEXT NOT NULL DEFAULT '', ativo BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX IF NOT EXISTS campo_locais_nome ON campo_locais (LOWER(nome));
CREATE TABLE IF NOT EXISTS campo_dirigentes (
  id SERIAL PRIMARY KEY, publicador_id INTEGER NOT NULL UNIQUE REFERENCES publicadores(id) ON DELETE RESTRICT,
  local_id INTEGER REFERENCES campo_locais(id) ON DELETE RESTRICT,
  grupos INTEGER[] NOT NULL DEFAULT '{}', disponibilidade TEXT NOT NULL DEFAULT '', ativo BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS campo_territorios (
  id SERIAL PRIMARY KEY, numero INTEGER NOT NULL UNIQUE CHECK (numero > 0),
  descricao TEXT NOT NULL DEFAULT '', fim_semana BOOLEAN NOT NULL DEFAULT FALSE, ativo BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS campo_saidas (
  id SERIAL PRIMARY KEY, data DATE NOT NULL, horario VARCHAR(40) NOT NULL,
  dirigente_id INTEGER REFERENCES campo_dirigentes(id) ON DELETE RESTRICT,
  local_id INTEGER REFERENCES campo_locais(id) ON DELETE RESTRICT,
  grupos INTEGER[] NOT NULL DEFAULT '{}', territorios INTEGER[] NOT NULL DEFAULT '{}',
  modalidade VARCHAR(20) NOT NULL CHECK (modalidade IN ('territorio', 'cartas', 'revisitas')),
  observacoes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE campo_territorios ADD COLUMN IF NOT EXISTS mapa_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS referencias TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS campo_saidas_data ON campo_saidas(data);
-- Preserve legacy leader registrations while linking outings directly to publishers.
ALTER TABLE campo_saidas ADD COLUMN IF NOT EXISTS dirigente_publicador_id INTEGER REFERENCES publicadores(id) ON DELETE RESTRICT;
UPDATE campo_saidas s SET dirigente_publicador_id = d.publicador_id
FROM campo_dirigentes d WHERE s.dirigente_id = d.id AND s.dirigente_publicador_id IS NULL;
CREATE TABLE IF NOT EXISTS campo_designacoes (
  id SERIAL PRIMARY KEY, territorio_id INTEGER NOT NULL REFERENCES campo_territorios(id) ON DELETE RESTRICT,
  publicador_id INTEGER NOT NULL REFERENCES publicadores(id) ON DELETE RESTRICT,
  data_designacao DATE NOT NULL, data_conclusao DATE,
  observacoes TEXT NOT NULL DEFAULT '', CHECK (data_conclusao IS NULL OR data_conclusao >= data_designacao)
);
CREATE UNIQUE INDEX IF NOT EXISTS campo_designacao_aberta ON campo_designacoes(territorio_id) WHERE data_conclusao IS NULL;
CREATE INDEX IF NOT EXISTS campo_designacoes_data ON campo_designacoes(data_designacao);
CREATE TABLE IF NOT EXISTS campo_mapas (
  chave TEXT PRIMARY KEY,
  territorio_id INTEGER UNIQUE REFERENCES campo_territorios(id) ON DELETE RESTRICT,
  nome VARCHAR(180) NOT NULL, conteudo BYTEA NOT NULL,
  tamanho INTEGER NOT NULL CHECK (tamanho > 0 AND tamanho <= 10485760),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((territorio_id IS NULL AND chave = 'geral') OR (territorio_id IS NOT NULL AND chave = 'territorio-' || territorio_id::text))
);
ALTER TABLE campo_mapas DROP CONSTRAINT IF EXISTS campo_mapas_tamanho_check;
ALTER TABLE campo_mapas ADD CONSTRAINT campo_mapas_tamanho_check CHECK (tamanho > 0 AND tamanho <= 10485760);
COMMIT;
