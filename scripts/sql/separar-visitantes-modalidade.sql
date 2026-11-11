-- Also executed automatically by the meeting/report APIs.
-- Legacy counts remain presencial through COALESCE(visitantes_presencial, visitantes, 0).
ALTER TABLE reunioes_registro
    ADD COLUMN IF NOT EXISTS visitantes INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS visitantes_presencial INTEGER CHECK (visitantes_presencial >= 0),
    ADD COLUMN IF NOT EXISTS visitantes_zoom INTEGER NOT NULL DEFAULT 0 CHECK (visitantes_zoom >= 0);
