'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

export default function GroupLeadershipDialog({ group, canEdit, onSaved }) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [superintendent, setSuperintendent] = useState('');
  const [assistant, setAssistant] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setReady(false);
    fetch('/api/admin/grupos?leaders=1', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      const members = data.candidates.filter(person => person.grupo_id === group.id);
      setCandidates(members);
      setReady(true);
      setSuperintendent(members.some(person => person.id === group.superintendente_id && person.anciao) ? String(group.superintendente_id) : '');
      setAssistant(members.some(person => person.id === group.ajudante_id) ? String(group.ajudante_id) : '');
    }).catch(err => { if (err.name !== 'AbortError') setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, group.id, group.superintendente_id, group.ajudante_id]);

  async function save(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const response = await fetch('/api/admin/grupos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'leadership', grupo_id: group.id, superintendente_id: superintendent, ajudante_id: assistant }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      await onSaved(); setOpen(false);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  return <><button type="button" disabled={!canEdit} onClick={() => setOpen(true)} title="Configurar responsáveis do grupo" aria-label={`Configurar responsáveis de ${group.nome_grupo}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-purple-600 hover:bg-purple-50 disabled:opacity-50"><Users className="h-4 w-4" /></button>
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Responsáveis de {group.nome_grupo}</DialogTitle><DialogDescription>Escolha os responsáveis entre os membros deste grupo. O telefone cadastrado será exibido aos participantes.</DialogDescription></DialogHeader>
      <form onSubmit={save} className="space-y-4">{error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {loading ? <p role="status" className="text-sm text-gray-500">Carregando membros...</p> : <fieldset disabled={saving || !ready} className="space-y-4">
          <label className="block text-sm text-gray-700">Superintendente<select aria-label="Superintendente" value={superintendent} onChange={event => { setSuperintendent(event.target.value); if (assistant === event.target.value) setAssistant(''); }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900"><option value="">Não informado</option>{candidates.filter(person => person.anciao).map(person => <option key={person.id} value={person.id}>{person.nome_completo}</option>)}</select></label>
          <label className="block text-sm text-gray-700">Ajudante (opcional)<select aria-label="Ajudante" value={assistant} onChange={event => setAssistant(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900"><option value="">Não informado</option>{candidates.filter(person => String(person.id) !== superintendent).map(person => <option key={person.id} value={person.id}>{person.nome_completo}</option>)}</select></label>
          {!candidates.length && <p className="text-xs text-gray-500">Nenhum ancião ou servo ministerial neste grupo. Confira o grupo e os privilégios no cadastro dos publicadores.</p>}
        </fieldset>}
        <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700">Cancelar</button><button disabled={saving || loading || !ready} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar responsáveis'}</button></div>
      </form>
    </DialogContent></Dialog>
  </>;
}
