'use client';

import { useState } from 'react';
import { FIELD_RESULTS } from '@/app/lib/field-planner';
import { usesSingleFieldLeader, fieldOutingTerritorySummary } from '@/app/lib/field-service';
import { Button } from '@/app/components/ui/button';
import { BatchField, FieldBatchDialog, fieldControl, saveFieldBatch } from './FieldBatchDialog';
import { PendingTerritoryNotice } from './FieldAssignmentTransfer';

export function FieldOutingResults({ outing, data, onClose, onSaved }) {
  const previous = (data.resultados || []).filter(row => row.saida_id === outing.id);
  const [date, setDate] = useState(outing.data);
  const [rows, setRows] = useState(outing.territorios.filter(id => !previous.some(row => row.territorio_id === id)).map(id => ({ territorio_id: id, resultado: '', observacoes: '' })));
  const update = (id, patch) => setRows(current => current.map(row => row.territorio_id === id ? { ...row, ...patch } : row));
  const pendingFor = territoryId => data.designacoes.find(d => d.territorio_id === territoryId && !d.data_conclusao && !d.data_transferencia
    && d.observacoes !== `Entrega registrada pela saída ${outing.id}.`);
  return <FieldBatchDialog title="Registrar resultado da saída" description="Confira o resultado de cada território. Concluídos atualizam o histórico; parciais permanecem pendentes. Resultados já registrados são preservados."
    onClose={onClose} disabled={!rows.length} saveLabel="Salvar resultados" onSave={async () => {
      if (rows.some(row => !row.resultado)) throw new Error('Escolha o resultado de todos os territórios pendentes.');
      if (rows.some(row => row.resultado !== 'nao_trabalhado' && pendingFor(row.territorio_id) && row.transferir_de !== pendingFor(row.territorio_id).id)) {
        throw new Error('Confirme a transferência das pendências para o responsável pelo território nesta saída antes de registrar o trabalho.');
      }
      const result = await saveFieldBatch({ entity: 'saidas', action: 'result', id: outing.id, data: date, resultados: rows });
      await onSaved(`${result.resultados} resultado(s) registrado(s).`); onClose();
    }}>
    {usesSingleFieldLeader(outing) && outing.grupos.length > 0 && <p className="whitespace-pre-line text-sm text-gray-600">{fieldOutingTerritorySummary(outing, data)}</p>}
    <BatchField label="Data do resultado"><input className={fieldControl} type="date" min={outing.data} required value={date} onChange={event => setDate(event.target.value)} /></BatchField>
    {!!rows.length && <Button type="button" variant="outline" onClick={() => setRows(current => current.map(row => ({ ...row, resultado: 'concluido' })))}>Marcar todos como concluídos</Button>}
    {previous.map(row => <p key={row.id} className="rounded-lg bg-gray-50 p-3 text-sm">Território {data.territorios.find(t => t.id === row.territorio_id)?.numero}: {FIELD_RESULTS[row.resultado]} em {row.data.split('-').reverse().join('/')} {row.observacoes && `— ${row.observacoes}`}</p>)}
    {rows.map(row => <div key={row.territorio_id} className="grid gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-2">
      {pendingFor(row.territorio_id) && <div className="sm:col-span-2"><PendingTerritoryNotice assignment={pendingFor(row.territorio_id)} data={data}>
        {row.resultado !== 'nao_trabalhado' && <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 accent-purple-600" checked={row.transferir_de === pendingFor(row.territorio_id).id} onChange={event => update(row.territorio_id, { transferir_de: event.target.checked ? pendingFor(row.territorio_id).id : undefined })} />Transferir a pendência para o responsável pelo território nesta saída e registrar a continuação.</label>}
      </PendingTerritoryNotice></div>}
      {data.designacoes.filter(d => d.territorio_id === row.territorio_id && d.observacoes === `Entrega registrada pela saída ${outing.id}.` && d.orientacoes_continuacao).map(d => <p key={d.id} className="whitespace-pre-wrap break-words text-sm text-gray-600 sm:col-span-2">Continuação — o que falta trabalhar: {d.orientacoes_continuacao}</p>)}
      <BatchField label={`Território ${data.territorios.find(t => t.id === row.territorio_id)?.numero}`}><select className={fieldControl} required value={row.resultado} onChange={event => update(row.territorio_id, { resultado: event.target.value })}><option value="">Selecione o resultado</option>{Object.entries(FIELD_RESULTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></BatchField>
      <BatchField label={row.resultado === 'parcial' ? 'O que falta trabalhar?' : 'Observações'}><textarea className={fieldControl} maxLength={2000} required={row.resultado === 'parcial'} value={row.observacoes} onChange={event => update(row.territorio_id, { observacoes: event.target.value })} /></BatchField>
    </div>)}
  </FieldBatchDialog>;
}
