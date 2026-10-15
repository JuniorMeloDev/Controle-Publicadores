'use client';
import { useEffect, useState } from 'react';
import { useUserSession } from '../UserSessionProvider';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { ClipboardCheck } from 'lucide-react';

export function AssignmentConfirmationsButton() {
  const { user } = useUserSession();
  if (!user?.permissions?.actions?.designacoes_confirmacoes) return null;
  return <Dialog>
    <DialogTrigger asChild>
      <button type="button" className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-md border border-purple-200 bg-purple-50 px-4 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100 sm:w-auto">
        <ClipboardCheck className="h-4 w-4" aria-hidden="true" /> Confirmações
      </button>
    </DialogTrigger>
    <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl border-gray-200 bg-white text-gray-900 sm:max-w-2xl">
      <DialogHeader className="pr-6">
        <DialogTitle>Confirmações das designações</DialogTitle>
        <DialogDescription className="text-gray-600">Acompanhe as respostas e identifique as designações que precisam de substituição.</DialogDescription>
      </DialogHeader>
      <AssignmentConfirmations embedded />
    </DialogContent>
  </Dialog>;
}

export default function AssignmentConfirmations({ embedded = false }) {
  const { user } = useUserSession();
  const [data, setData] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('nao');
  const allowed = user?.permissions?.actions?.designacoes_confirmacoes;
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/designacoes/confirmacoes', { cache: 'no-store' });
        const result = await response.json(); if (!response.ok) throw new Error(result.message);
        if (active) { setData(result.assignments); setError(''); }
      } catch (err) { if (active) setError(err.message); }
    };
    refresh(); const timer = window.setInterval(refresh, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [allowed]);
  if (!allowed) return null;
  const labels = { sim: 'Confirmada', nao: 'Recusada — aguardando substituição', sem_resposta: 'Sem resposta — designação válida' };
  return <section className={embedded ? 'min-w-0' : 'rounded-xl border border-gray-200 bg-white p-4'}>{!embedded && <h2 className="mb-3 text-lg font-semibold text-gray-900">Confirmações das designações</h2>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <label className="text-sm text-gray-700">Resposta <select value={filter} onChange={e => setFilter(e.target.value)} className="mb-3 rounded border border-gray-300 bg-white p-2 text-gray-900 [color-scheme:light] dark:[color-scheme:dark]"><option className="bg-white text-gray-900" value="nao">Recusadas</option><option className="bg-white text-gray-900" value="sim">Confirmadas</option><option className="bg-white text-gray-900" value="sem_resposta">Sem resposta</option><option className="bg-white text-gray-900" value="">Todas</option></select></label>
    <ul className="max-h-80 space-y-2 overflow-auto">{data.filter(a => !filter || a.resposta === filter).map(a => <li key={a.versao} className="rounded border p-3 text-sm text-gray-800"><strong>{a.nome_completo}</strong> · {a.nome_parte}<p>{String(a.data_reuniao).slice(0, 10)} · {a.categoria}</p><p>{labels[a.resposta]}</p></li>)}</ul>
    {!data.some(a => !filter || a.resposta === filter) && <p className="text-sm text-gray-600">Nenhuma designação neste filtro.</p>}
  </section>;
}
