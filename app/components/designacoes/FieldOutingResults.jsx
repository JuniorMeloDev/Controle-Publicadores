'use client';

import { useState } from 'react';
import { FIELD_RESULTS } from '@/app/lib/field-planner';
import { Button } from '@/app/components/ui/button';
import { BatchField, FieldBatchDialog, fieldControl, saveFieldBatch } from './FieldBatchDialog';

export function FieldOutingResults({ outing, data, onClose, onSaved }) {
  const previous = (data.resultados || []).filter(row => row.saida_id === outing.id);
  const [date, setDate] = useState(outing.data);
  const [rows, setRows] = useState(outing.territorios.filter(id => !previous.some(row => row.territorio_id === id)).map(id => ({ territorio_id: id, resultado: '', observacoes: '' })));
  const update = (id, patch) => setRows(current => current.map(row => row.territorio_id === id ? { ...row, ...patch } : row));
  return <FieldBatchDialog title="Registrar resultado da saída" description="Confira o resultado de cada território. Concluídos atualizam o histórico; parciais permanecem pendentes. Resultados já registrados são preservados."
    onClose={onClose} disabled={!rows.length} saveLabel="Salvar resultados" onSave={async () => {
      if (rows.some(row => !row.resultado)) throw new Error('Escolha o resultado de todos os territórios pendentes.');
      const result = await saveFieldBatch({ entity: 'saidas', action: 'result', id: outing.id, data: date, resultados: rows });
      await onSaved(`${result.resultados} resultado(s) registrado(s).`); onClose();
    }}>
    <BatchField label="Data do resultado"><input className={fieldControl} type="date" min={outing.data} required value={date} onChange={event => setDate(event.target.value)} /></BatchField>
    {!!rows.length && <Button type="button" variant="outline" onClick={() => setRows(current => current.map(row => ({ ...row, resultado: 'concluido' })))}>Marcar todos como concluídos</Button>}
    {previous.map(row => <p key={row.id} className="rounded-lg bg-gray-50 p-3 text-sm">Território {data.territorios.find(t => t.id === row.territorio_id)?.numero}: {FIELD_RESULTS[row.resultado]} em {row.data.split('-').reverse().join('/')} {row.observacoes && `— ${row.observacoes}`}</p>)}
    {rows.map(row => <div key={row.territorio_id} className="grid gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-2">
      <BatchField label={`Território ${data.territorios.find(t => t.id === row.territorio_id)?.numero}`}><select className={fieldControl} required value={row.resultado} onChange={event => update(row.territorio_id, { resultado: event.target.value })}><option value="">Selecione o resultado</option>{Object.entries(FIELD_RESULTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></BatchField>
      <BatchField label={row.resultado === 'parcial' ? 'O que falta trabalhar?' : 'Observações'}><textarea className={fieldControl} maxLength={2000} required={row.resultado === 'parcial'} value={row.observacoes} onChange={event => update(row.territorio_id, { observacoes: event.target.value })} /></BatchField>
    </div>)}
  </FieldBatchDialog>;
}
