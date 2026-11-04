BEGIN;
ALTER TABLE campo_territorios ADD COLUMN IF NOT EXISTS limites JSONB;
ALTER TABLE campo_territorios ADD COLUMN IF NOT EXISTS mapa_share_token TEXT;
ALTER TABLE campo_territorios ADD COLUMN IF NOT EXISTS mapa_revisao INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS campo_territorios_mapa_token ON campo_territorios(mapa_share_token) WHERE mapa_share_token IS NOT NULL;
CREATE TABLE IF NOT EXISTS campo_mapa_geral (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  limites JSONB,
  revisao INTEGER NOT NULL DEFAULT 0
);
INSERT INTO campo_mapa_geral (id) VALUES (1) ON CONFLICT DO NOTHING;
COMMIT;
