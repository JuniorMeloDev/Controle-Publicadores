'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';

const control = 'w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';
export function CadastroProgressModal({ onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState('todos');
  const [group, setGroup] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError('');
      try {
        const response = await fetch('/api/admin/atualizacoes-cadastrais?acompanhamento=1', { signal: controller.signal, cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Não foi possível carregar o acompanhamento.');
        if (!controller.signal.aborted) setData(body);
      } catch (err) { if (!controller.signal.aborted) setError(err.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    load(); return () => controller.abort();
  }, [revision]);
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const rows = (data?.publicadores || []).filter(row => (status === 'todos' || Boolean(row.enviado_em) === (status === 'enviados')) && (!group || (row.nome_grupo || 'Sem grupo') === group) && normalize(row.nome_completo).includes(normalize(search)));
  const groups = [...new Set((data?.publicadores || []).map(row => row.nome_grupo || 'Sem grupo'))].sort();
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="w-[calc(100%-2rem)] max-w-3xl max-h-[90dvh] overflow-y-auto bg-white text-gray-900">
    <DialogHeader><DialogTitle>Acompanhamento das atualizações cadastrais</DialogTitle><DialogDescription>Quem já enviou o cadastro e quem ainda falta. Envios sem alterações também contam. O envio não significa aprovação.</DialogDescription></DialogHeader>
    {loading ? <p role="status" className="py-6 text-sm text-gray-500">Carregando acompanhamento…</p> : error ? <p role="alert" className="text-sm text-red-700">{error}</p> : data && <>
      <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-gray-50 p-3"><p className="text-lg font-semibold">{data.total}</p><p className="text-xs text-gray-600">Publicadores</p></div><div className="rounded-lg bg-green-50 p-3"><p className="text-lg font-semibold text-green-800">{data.enviados}</p><p className="text-xs text-green-800">Já enviaram</p></div><div className="rounded-lg bg-amber-50 p-3"><p className="text-lg font-semibold text-amber-800">{data.faltam}</p><p className="text-xs text-amber-800">Ainda faltam</p></div></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><label className="grid gap-1 text-sm">Buscar publicador<input type="search" className={control} value={search} onChange={e => setSearch(e.target.value)} /></label><label className="grid gap-1 text-sm">Situação<select className={control} value={status} onChange={e => setStatus(e.target.value)}><option value="todos">Todos</option><option value="enviados">Já enviaram</option><option value="faltam">Ainda faltam</option></select></label><label className="grid gap-1 text-sm">Grupo<select className={control} value={group} onChange={e => setGroup(e.target.value)}><option value="">Todos os grupos</option>{groups.map(name => <option key={name}>{name}</option>)}</select></label></div>
      <div className="divide-y divide-gray-100">{rows.length ? rows.map(row => <div key={row.id} className="py-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium break-words">{row.nome_completo}</p><p className="text-xs text-gray-500">{row.nome_grupo || 'Sem grupo'}</p></div><div className="text-sm sm:text-right"><p className={row.enviado_em ? 'text-green-700' : 'text-amber-700'}>{row.enviado_em ? 'Já enviou' : 'Ainda não enviou'}</p>{row.enviado_em && <p className="text-xs text-gray-500">Último envio: {new Date(row.enviado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>}{row.pendentes > 0 && <p className="text-xs text-gray-500">{row.pendentes} alteração(ões) aguardando aprovação</p>}</div></div>) : <p className="py-6 text-center text-sm text-gray-500">Nenhum publicador encontrado.</p>}</div>
    </>}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={loading} onClick={() => setRevision(value => value + 1)}>Atualizar</Button><Button onClick={onClose} className="bg-purple-700 hover:bg-purple-800 text-white">Fechar</Button></div>
  </DialogContent></Dialog>;
}
