'use client';

import { useEffect, useState } from 'react';
import { Check, Circle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { ConfirmationDialog } from '@/app/components/ui/confirmation-dialog';
import { formatDateBR } from '@/app/lib/date-format';
import { EditableTerritoryView } from './EditableTerritoryCanvas';
import { SchematicMap } from './SchematicMap';

function checkDrawing(data, version) {
  if (data.drawingVersion !== version) throw new Error('O desenho do território mudou. Recarregue a página para consultar a versão atual.');
  return data;
}

export function TerritoryProgressMap({ territory, image, color, token }) {
  const [progress, setProgress] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [reload, setReload] = useState(0);
  const url = `/api/mapa-territorio/${token}/progresso`;
  const drawingVersion = `${territory.mapa_revisao}:${territory.mapa_layout_revisao}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'O progresso está indisponível.');
      setProgress(checkDrawing(data, drawingVersion));
      setDraft(null);
    }).catch(error => {
      if (error.name !== 'AbortError') setError(error.message);
    });
    return () => controller.abort();
  }, [url, reload, drawingVersion]);

  const blocks = progress?.blocks || [];
  const completed = draft ?? progress?.completed ?? [];
  const remaining = blocks.length - completed.length;
  const canToggle = progress?.canEdit && !busy;

  function toggle(id) {
    setFeedback('');
    setDraft(current => {
      const selection = current ?? progress.completed;
      return selection.includes(id) ? selection.filter(item => item !== id) : [...selection, id];
    });
  }

  async function save(action) {
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, completed, version: progress.version }),
      });
      const data = await response.json();
      if (!response.ok) {
        if ([401, 403, 409].includes(response.status)) {
          setProgress(null);
          setDraft(null);
          setReload(value => value + 1);
        }
        throw new Error(data.message || 'O progresso não pôde ser salvo.');
      }
      setProgress(checkDrawing(data, drawingVersion));
      setDraft(null);
      setFeedback(action === 'complete' ? 'Conclusão registrada no Histórico.' : 'Marcações salvas.');
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  return <div className="space-y-4">
    {territory.mapa_layout
      ? <EditableTerritoryView layout={territory.mapa_layout} number={territory.numero} color={color}
          blocks={blocks} completedBlocks={completed} onToggleBlock={canToggle ? toggle : undefined} />
      : <SchematicMap {...image} alt={`Cartão original do Território ${territory.numero}, com ruas e pontos de referência`} />}
    <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4" aria-labelledby="territory-progress">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="territory-progress" className="text-sm font-bold">Progresso do território</h2>
        {progress?.completedOn
          ? <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Concluído em {formatDateBR(progress.completedOn)}</p>
          : blocks.length > 0 && <p className="text-sm text-slate-700">{completed.length} de {blocks.length} concluídas · {remaining} {remaining === 1 ? 'pendente' : 'pendentes'}</p>}
      </div>
      {!progress && !error && <p role="status" className="text-sm text-slate-600">Carregando o progresso…</p>}
      {progress?.canEdit && blocks.length > 0 && <p className="text-sm text-slate-600">Toque nas quadras trabalhadas no mapa ou na lista e salve as marcações.</p>}
      {progress && !blocks.length && <p className="text-sm text-slate-600">Este cartão permite registrar a conclusão do território inteiro.</p>}
      {blocks.length > 0 && <ul className="grid gap-2 sm:grid-cols-2">
        {blocks.map((block, index) => {
          const done = completed.includes(block.id);
          const content = <><span className="font-semibold">Quadra {index + 1}</span>
            {block.referenceNumbers.length > 0 && <span className="text-xs text-slate-600">{block.referenceNumbers.length === 1 ? 'Referência' : 'Referências'} {block.referenceNumbers.join(', ')}</span>}
            <span className={`ml-auto inline-flex items-center gap-1 text-xs font-medium ${done ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600'}`}>
              {done ? <Check size={15} /> : <Circle size={13} />}{done ? 'Concluída' : 'Pendente'}
            </span></>;
          const rowStyle = 'flex min-h-11 w-full flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm';
          return <li key={block.id}>{progress.canEdit
            ? <button type="button" className={`${rowStyle} hover:border-slate-500 disabled:opacity-60`} aria-pressed={done} disabled={busy} onClick={() => toggle(block.id)}>{content}</button>
            : <div className={rowStyle}>{content}</div>}</li>;
        })}
      </ul>}
      {progress?.canEdit && <div className="flex flex-wrap gap-2">
        {blocks.length > 0 && <Button type="button" variant="outline" disabled={busy || !draft} onClick={() => save('save')}>Salvar marcações</Button>}
        <Button type="button" disabled={busy} onClick={() => setConfirm(true)}>Concluir território</Button>
      </div>}
      {progress && !progress.signedIn && !progress.completedOn && <a className="inline-flex min-h-9 items-center text-sm font-semibold underline" href={`/#mapa-territorio=${token}`}>Entrar para registrar o progresso</a>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {!progress && error && <Button type="button" variant="outline" onClick={() => { setError(''); setReload(value => value + 1); }}>Tentar novamente</Button>}
      {feedback && <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{feedback}</p>}
    </section>
    {confirm && <ConfirmationDialog title="Concluir território?" confirmLabel="Registrar conclusão"
      description={remaining > 0
        ? 'Confirme apenas se todas as quadras foram trabalhadas. A conclusão será registrada no Histórico e todas as quadras serão marcadas como concluídas.'
        : 'A conclusão será registrada no Histórico do Serviço de Campo.'}
      onConfirm={() => save('complete')} onCancel={() => setConfirm(false)} />}
  </div>;
}
