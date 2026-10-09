-- Preserva todos os cadastros existentes; contatos opcionais e repetíveis.
ALTER TABLE publicadores
  ADD COLUMN IF NOT EXISTS contatos_emergencia JSONB NOT NULL DEFAULT '[]'::jsonb;
