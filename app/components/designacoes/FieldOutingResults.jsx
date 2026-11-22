'use client';

import { useEffect, useState } from 'react';
import { FIELD_RESULTS } from '@/app/lib/field-planner';
import { fieldOutingResults, usesSingleFieldLeader, fieldOutingTerritorySummary } from '@/app/lib/field-service';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { BatchField, FieldBatchDialog, fieldControl, saveFieldBatch } from './FieldBatchDialog';
import { EditableTerritoryView } from './EditableTerritoryCanvas';
import { PendingTerritoryNotice } from './FieldAssignmentTransfer';

export function FieldOutingResults({ outing, data, onClose, onSaved }) {
  const previous = fieldOutingResults(outing, data.designacoes, data.resultados);
  const [date, setDate] = useState(outing.data);
  const [drafts, setDrafts] = useState({});
  const [blockOptions, setBlockOptions] = useState(null);
  const [blocksError, setBlocksError] = useState(false);
  const [reloadBlocks, setReloadBlocks] = useState(0);
  const rows = outing.territorios.filter(id => !previous.some(row => row.territorio_id === id))
    .map(id => ({ territorio_id: id, resultado: '', observacoes: '', ...drafts[id] }));
  const update = (id, patch) => setDrafts(current => ({ ...current, [id]: { ...current[id], ...patch } }));
  const pendingFor = territoryId => data.designacoes.find(d => d.territorio_id === territoryId && !d.data_conclusao && !d.data_transferencia
    && d.observacoes !== `Entrega registrada pela saída ${outing.id}.`);
  const hasPartial = rows.some(row => row.resultado === 'parcial');
  useEffect(() => {
    if (!hasPartial || blockOptions) return;
    const controller = new AbortController();
    fetch(`/api/admin/servico-campo?quadrasSaida=${outing.id}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        const options = await response.json();
        if (!controller.signal.aborted) {
          setBlockOptions(options);
          setBlocksError(false);
        }
      })
      .catch(() => { if (!controller.signal.aborted) setBlocksError(true); });
    return () => controller.abort();
  }, [hasPartial, outing.id, reloadBlocks, blockOptions]);

  return <FieldBatchDialog title="Registrar resultado da saída" description="Confira o resultado de cada território. Concluídos atualizam o histórico; parciais permanecem pendentes. Resultados já registrados são preservados."
    onClose={onClose} disabled={!rows.length} saveLabel="Salvar resultados" onSave={async () => {
      if (rows.some(row => !row.resultado)) throw new Error('Escolha o resultado de todos os territórios pendentes.');
      if (rows.some(row => row.resultado !== 'nao_trabalhado' && pendingFor(row.territorio_id) && row.transferir_de !== pendingFor(row.territorio_id).id)) {
        throw new Error('Confirme a transferência das pendências para o responsável pelo território nesta saída antes de registrar o trabalho.');
      }
      const resultados = rows.map(({ quadras_concluidas, ...row }) => {
        const options = blockOptions?.[row.territorio_id];
        if (row.resultado !== 'parcial' || !options?.blocks.length) return row;
        const selected = quadras_concluidas ?? options.completed;
        if (selected.length === options.blocks.length) throw new Error('Se todas as quadras foram trabalhadas, registre o resultado como Concluído.');
        if (quadras_concluidas === undefined && (!selected.length || row.observacoes.trim())) return row;
        return { ...row, quadras_concluidas: selected, quadras_anteriores: options.completed };
      });
      const result = await saveFieldBatch({ entity: 'saidas', action: 'result', id: outing.id, data: date, resultados });
      await onSaved(`${result.resultados} resultado(s) registrado(s).`); onClose();
    }}>
    {usesSingleFieldLeader(outing) && outing.grupos.length > 0 && <p className="whitespace-pre-line text-sm text-gray-600">{fieldOutingTerritorySummary(outing, data)}</p>}
    <BatchField label="Data do resultado"><input className={fieldControl} type="date" min={outing.data} required value={date} onChange={event => setDate(event.target.value)} /></BatchField>
    {!!rows.length && <Button type="button" variant="outline" onClick={() => setDrafts(Object.fromEntries(rows.map(row => [row.territorio_id, { ...row, resultado: 'concluido' }])))}>Marcar todos como concluídos</Button>}
    {previous.map(row => <p key={row.territorio_id} className="rounded-lg bg-gray-50 p-3 text-sm">Território {data.territorios.find(t => t.id === row.territorio_id)?.numero}: {row.resultado === 'transferido' ? 'Transferido' : FIELD_RESULTS[row.resultado]} em {row.data.split('-').reverse().join('/')} {row.observacoes && `— ${row.observacoes}`}</p>)}
    {rows.map(row => {
      const options = blockOptions?.[row.territorio_id];
      const blocks = options?.blocks ?? [];
      const selected = row.quadras_concluidas ?? options?.completed ?? [];
      const remaining = blocks.length - selected.length;
      const partial = row.resultado === 'parcial';
      const number = data.territorios.find(t => t.id === row.territorio_id)?.numero;
      return <div key={row.territorio_id} className="grid gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-2">
        {pendingFor(row.territorio_id) && <div className="sm:col-span-2"><PendingTerritoryNotice assignment={pendingFor(row.territorio_id)} data={data}>
          {row.resultado !== 'nao_trabalhado' && <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 accent-purple-600" checked={row.transferir_de === pendingFor(row.territorio_id).id} onChange={event => update(row.territorio_id, { transferir_de: event.target.checked ? pendingFor(row.territorio_id).id : undefined })} />Transferir a pendência para o responsável pelo território nesta saída e registrar a continuação.</label>}
        </PendingTerritoryNotice></div>}
        {data.designacoes.filter(d => d.territorio_id === row.territorio_id && d.observacoes === `Entrega registrada pela saída ${outing.id}.` && d.orientacoes_continuacao).map(d => <p key={d.id} className="whitespace-pre-wrap break-words text-sm text-gray-600 sm:col-span-2">Continuação — o que falta trabalhar: {d.orientacoes_continuacao}</p>)}
        <BatchField label={`Território ${number}`}><select className={fieldControl} required value={row.resultado} onChange={event => update(row.territorio_id, { resultado: event.target.value })}><option value="">Selecione o resultado</option>{Object.entries(FIELD_RESULTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></BatchField>
        <BatchField label={partial ? 'O que falta trabalhar?' : 'Observações'}><textarea className={fieldControl} maxLength={2000} required={partial && !selected.length} value={row.observacoes} onChange={event => update(row.territorio_id, { observacoes: event.target.value })} /></BatchField>
        {partial && !blockOptions && !blocksError && <p role="status" className="text-sm text-gray-500 sm:col-span-2">Carregando quadras…</p>}
        {partial && blocksError && <p className="text-sm text-gray-600 sm:col-span-2">As quadras estão indisponíveis. <button type="button" className="underline" onClick={() => { setBlocksError(false); setReloadBlocks(value => value + 1); }}>Tentar novamente</button></p>}
        {partial && blocks.length > 0 && <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Dialog>
            <DialogTrigger asChild><Button type="button" variant="outline" aria-label={`Selecionar quadras no mapa do território ${number}`}>Selecionar quadras no mapa</Button></DialogTrigger>
            <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-5xl gap-3 overflow-y-auto rounded-xl bg-white p-4 text-gray-900 sm:p-5">
              <div className="space-y-1 pr-8">
                <DialogTitle>Território {number}</DialogTitle>
                <DialogDescription>Toque nas quadras trabalhadas para marcá-las em verde.</DialogDescription>
              </div>
              <EditableTerritoryView layout={options.layout} number={number} blocks={blocks} completedBlocks={selected}
                showReferences={false} onToggleBlock={id => update(row.territorio_id, {
                  quadras_concluidas: selected.includes(id) ? selected.filter(blockId => blockId !== id) : [...selected, id],
                })} />
              <DialogClose asChild><Button type="button" variant="outline" className="justify-self-end">Voltar ao resultado</Button></DialogClose>
            </DialogContent>
          </Dialog>
          <p className="text-sm text-gray-600" role="status">{selected.length} de {blocks.length} concluídas · {remaining} {remaining === 1 ? 'pendente' : 'pendentes'}</p>
        </div>}
      </div>;
    })}
  </FieldBatchDialog>;
}
