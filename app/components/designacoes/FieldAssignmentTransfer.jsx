'use client';

import { useState } from 'react';
import { PublisherCombobox } from '@/app/components/reunioes/PublisherCombobox';
import { BatchField, FieldBatchDialog, fieldControl, saveFieldBatch } from './FieldBatchDialog';
import { assignmentContinuationNotes } from '@/app/lib/field-service';

export function PendingTerritoryNotice({ assignment, data, children }) {
  const name = data.publicadores.find(p => p.id === assignment.publicador_id)?.nome || assignment.responsavel_nome || 'Responsável anterior';
  const notes = assignmentContinuationNotes(assignment, data.resultados);
  return <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
    <p>Território {data.territorios.find(t => t.id === assignment.territorio_id)?.numero} pendente com {name}, entregue em {assignment.data_designacao.split('-').reverse().join('/')}.</p>
    {notes && <p className="whitespace-pre-wrap break-words">O que falta trabalhar: {notes}</p>}
    {children}
  </div>;
}

export function FieldAssignmentTransfer({ assignment, data, onClose, onSaved }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const [publisher, setPublisher] = useState('');
  const [date, setDate] = useState(today < assignment.data_designacao ? assignment.data_designacao : today);
  const [notes, setNotes] = useState('');
  return <FieldBatchDialog title="Transferir território pendente" description="A entrega anterior será marcada como transferida. O novo responsável receberá o território com as observações do trabalho que falta. A transferência não registra uma conclusão."
    onClose={onClose} disabled={!publisher} saveLabel="Transferir território" onSave={async () => {
      await saveFieldBatch({ entity: 'designacoes', action: 'transfer', id: assignment.id, publicador_id: publisher, data_transferencia: date, observacoes: notes });
      await onSaved('Território transferido. As observações e o histórico anterior foram preservados.');
      onClose();
    }}>
    <PendingTerritoryNotice assignment={assignment} data={data} />
    <PublisherCombobox label="Novo responsável" value={publisher} onChange={setPublisher} publishers={data.publicadores.map(p => ({ id: p.id, nome_completo: p.nome }))} placeholder="Selecione o novo responsável" />
    <BatchField label="Data da transferência"><input type="date" required min={assignment.data_designacao} value={date} className={fieldControl} onChange={event => setDate(event.target.value)} /></BatchField>
    <BatchField label="Observações da transferência (opcional)"><textarea value={notes} maxLength={2000} className={fieldControl} onChange={event => setNotes(event.target.value)} /></BatchField>
  </FieldBatchDialog>;
}
