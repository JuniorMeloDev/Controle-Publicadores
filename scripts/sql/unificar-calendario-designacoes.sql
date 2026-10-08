-- Additive, repeatable migration. Unmatched or ambiguous historical records remain intact.
BEGIN;
ALTER TABLE public.reunioes_registro ADD COLUMN IF NOT EXISTS cancelada BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.reunioes_registro ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;
ALTER TABLE public.reunioes_dados ADD COLUMN IF NOT EXISTS reuniao_id INTEGER REFERENCES public.reunioes_registro(id) ON DELETE SET NULL;
ALTER TABLE public.designacoes_reuniao ADD COLUMN IF NOT EXISTS reuniao_id INTEGER REFERENCES public.reunioes_registro(id) ON DELETE SET NULL;
ALTER TABLE public.discursos_publicos ADD COLUMN IF NOT EXISTS reuniao_id INTEGER REFERENCES public.reunioes_registro(id) ON DELETE SET NULL;
ALTER TABLE public.limpeza_semanal ADD COLUMN IF NOT EXISTS reuniao_id INTEGER REFERENCES public.reunioes_registro(id) ON DELETE SET NULL;

UPDATE public.reunioes_dados d SET reuniao_id = r.id FROM public.reunioes_registro r
WHERE d.reuniao_id IS NULL AND d.data_reuniao = r.data AND r.tipo = 'Meio de Semana';
UPDATE public.designacoes_reuniao d SET reuniao_id = r.id FROM public.reunioes_registro r
WHERE d.reuniao_id IS NULL AND d.data_reuniao = r.data AND r.tipo = 'Meio de Semana';
UPDATE public.discursos_publicos d SET reuniao_id = r.id FROM public.reunioes_registro r
WHERE d.reuniao_id IS NULL AND d.data = r.data AND r.tipo = 'Fim de Semana'
AND (SELECT count(*) FROM public.discursos_publicos x WHERE x.data = d.data) = 1;
UPDATE public.limpeza_semanal d SET reuniao_id = r.id FROM public.reunioes_registro r
WHERE d.reuniao_id IS NULL AND d.data = r.data
AND (SELECT count(*) FROM public.limpeza_semanal x WHERE x.data = d.data) = 1;

CREATE UNIQUE INDEX IF NOT EXISTS reunioes_dados_reuniao_unique ON public.reunioes_dados(reuniao_id);
CREATE UNIQUE INDEX IF NOT EXISTS discursos_reuniao_unique ON public.discursos_publicos(reuniao_id);
CREATE UNIQUE INDEX IF NOT EXISTS limpeza_reuniao_unique ON public.limpeza_semanal(reuniao_id);
CREATE INDEX IF NOT EXISTS designacoes_reuniao_vinculo ON public.designacoes_reuniao(reuniao_id);
COMMIT;
