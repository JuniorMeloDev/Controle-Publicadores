export async function ensureBoardTables(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS mural_congregacao (
    id SERIAL PRIMARY KEY, tipo TEXT NOT NULL CHECK (tipo IN ('anuncio', 'saida', 'material')),
    titulo VARCHAR(160) NOT NULL, mensagem TEXT NOT NULL, inicio DATE NOT NULL, fim DATE,
    data DATE, horario VARCHAR(5), local VARCHAR(250), link TEXT,
    grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
    fixado BOOLEAN NOT NULL DEFAULT FALSE, confirmar_leitura BOOLEAN NOT NULL DEFAULT FALSE,
    autor_id INTEGER REFERENCES publicadores(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await client.query(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'mural_congregacao'::regclass
      AND conname = 'mural_congregacao_tipo_check' AND pg_get_constraintdef(oid) NOT LIKE '%material%') THEN
      ALTER TABLE mural_congregacao DROP CONSTRAINT mural_congregacao_tipo_check;
      ALTER TABLE mural_congregacao ADD CONSTRAINT mural_congregacao_tipo_check CHECK (tipo IN ('anuncio', 'saida', 'material'));
    END IF;
  END $$`);
  await client.query(`CREATE TABLE IF NOT EXISTS mural_leituras (
    publicacao_id INTEGER REFERENCES mural_congregacao(id) ON DELETE CASCADE,
    publicador_id INTEGER REFERENCES publicadores(id) ON DELETE CASCADE,
    lido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (publicacao_id, publicador_id)
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS mural_anexos (
    publicacao_id INTEGER PRIMARY KEY REFERENCES mural_congregacao(id) ON DELETE CASCADE,
    nome VARCHAR(180) NOT NULL, mime TEXT NOT NULL, tamanho INTEGER NOT NULL,
    conteudo BYTEA NOT NULL, previa_html TEXT
  )`);
}

export async function getVisiblePosts(client, userId) {
  const result = await client.query(`SELECT m.id, m.tipo, m.titulo, m.mensagem,
    m.inicio::text, m.fim::text, m.data::text, m.horario, m.local, m.link,
    m.fixado, m.confirmar_leitura, m.criado_em, g.nome_grupo,
    l.lido_em IS NOT NULL AS lido, a.nome AS anexo_nome
    FROM mural_congregacao m
    JOIN publicadores p ON p.id = $1
    LEFT JOIN grupos g ON g.id = m.grupo_id
    LEFT JOIN mural_leituras l ON l.publicacao_id = m.id AND l.publicador_id = p.id
    LEFT JOIN mural_anexos a ON a.publicacao_id = m.id
    WHERE (m.grupo_id IS NULL OR m.grupo_id = p.grupo_id)
      AND m.inicio <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
      AND (m.fim IS NULL OR m.fim >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date)
      AND (m.tipo <> 'saida' OR (m.data + m.horario::time) >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'))
    ORDER BY m.fixado DESC, m.data ASC NULLS LAST, m.criado_em DESC`, [userId]);
  return result.rows;
}
