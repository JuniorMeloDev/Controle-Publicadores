-- Consolida a reunião de 28/10/2026 na reunião de visita de 27/10/2026.
-- O bloco é atômico e recusa a operação se a terça já tiver dados próprios.
DO $$
DECLARE
    origem reunioes_registro%ROWTYPE;
    destino reunioes_registro%ROWTYPE;
BEGIN
    SELECT * INTO destino FROM reunioes_registro
    WHERE data = DATE '2026-10-27' AND tipo = 'Meio de Semana' FOR UPDATE;
    IF destino.id IS NULL THEN
        RAISE EXCEPTION 'Reunião de terça-feira não encontrada.';
    END IF;

    SELECT * INTO origem FROM reunioes_registro
    WHERE data = DATE '2026-10-28' AND tipo = 'Meio de Semana' FOR UPDATE;
    IF origem.id IS NULL THEN
        RETURN; -- Correção já aplicada.
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM eventos_especiais
        WHERE data = DATE '2026-10-27' AND tipo = 'Visita do Superintendente'
    ) THEN
        RAISE EXCEPTION 'Visita de 27/10 não encontrada.';
    END IF;

    IF destino.leitor_id IS NOT NULL
        OR destino.indicador_interno_id IS NOT NULL
        OR destino.indicador_externo_volante_id IS NOT NULL
        OR destino.indicador_externo_id IS NOT NULL
        OR destino.volante_id IS NOT NULL
        OR destino.anciao_apoio_id IS NOT NULL
        OR COALESCE(destino.visitantes, 0) <> 0
        OR NULLIF(destino.observacoes, '') IS NOT NULL
        OR EXISTS (SELECT 1 FROM reunioes_privilegios WHERE reuniao_id = destino.id)
        OR EXISTS (SELECT 1 FROM assistencia_detalhe WHERE reuniao_id IN (origem.id, destino.id))
    THEN
        RAISE EXCEPTION 'Existem dados que precisam ser conciliados antes de transferir a reunião.';
    END IF;

    UPDATE reunioes_registro SET
        leitor_id = origem.leitor_id,
        indicador_interno_id = origem.indicador_interno_id,
        indicador_externo_volante_id = origem.indicador_externo_volante_id,
        indicador_externo_id = origem.indicador_externo_id,
        volante_id = origem.volante_id,
        anciao_apoio_id = origem.anciao_apoio_id,
        visitantes = origem.visitantes,
        observacoes = origem.observacoes
    WHERE id = destino.id;

    UPDATE reunioes_privilegios SET reuniao_id = destino.id WHERE reuniao_id = origem.id;
    DELETE FROM reunioes_registro WHERE id = origem.id;
END;
$$;
