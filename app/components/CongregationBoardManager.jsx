'use client';

import { useEffect, useState } from 'react';
import { useUserSession } from './UserSessionProvider';
import { Megaphone, Plus, Pencil, Trash2 } from 'lucide-react';
import { ATTACHMENT_ACCEPT, ATTACHMENT_HELP, MAX_ATTACHMENT_BYTES } from '@/app/lib/attachment-info';

const input = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';
const blank = () => ({ tipo: 'anuncio', titulo: '', mensagem: '', inicio: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), fim: '', data: '', horario: '', local: '', link: '', grupo_id: '', fixado: false, confirmar_leitura: false });

export default function CongregationBoardManager() {
  const { user } = useUserSession();
  const [open, setOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const allowed = user?.isAnciao || user?.isSuperAdmin;

  async function load(signal) {
    setLoading(true);
    try {
      const response = await fetch('/api/mural?manage=1', { cache: 'no-store', signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setPosts(data.posts); setGroups(data.groups); setError('');
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => {
    setOpen(false); setPosts([]); setGroups([]); setForm(null); setError(''); setMessage(''); setDeleting(null);
    setAttachment(null);
  }, [user?.id]);
  useEffect(() => {
    if (!open || !allowed) return;
    const controller = new AbortController(); load(controller.signal);
    return () => controller.abort();
  }, [open, allowed, user?.id]);

  async function mutate(body) {
    setBusy(true); setError(''); setMessage('');
    try {
      let options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
      if (attachment && body.action === 'save') {
        const payload = new FormData(); payload.append('publicacao', JSON.stringify(body)); payload.append('anexo', attachment);
        options = { method: 'POST', body: payload };
      }
      const response = await fetch('/api/mural', options);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setMessage(data.message); setForm(null); setDeleting(null);
      setAttachment(null);
      window.dispatchEvent(new Event('mural:changed'));
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const field = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  if (!allowed) return null;
  return <section className="mb-5 rounded-xl border border-purple-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold text-gray-900"><Megaphone className="h-5 w-5 text-purple-600" />Mural da congregação</h2><p className="mt-1 text-sm text-gray-500">Publique anúncios, saídas de campo e materiais úteis para os publicadores.</p></div><button type="button" onClick={() => setOpen(!open)} className="rounded-lg border border-purple-200 px-3 py-2 text-sm font-medium text-purple-700">{open ? 'Fechar gerenciamento' : 'Gerenciar publicações'}</button></div>
    {open && <div className="mt-5 space-y-4">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}<button type="button" onClick={() => load()} className="ml-2 underline">Tentar novamente</button></p>}
      {message && <p role="status" className="text-sm text-green-700">{message}</p>}
      {form ? <form onSubmit={event => { event.preventDefault(); mutate({ ...form, action: 'save' }); }} className="space-y-4 rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900">{form.id ? 'Editar publicação' : 'Nova publicação'}</h3>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
          <label className="text-sm text-gray-700">Tipo<select aria-label="Tipo" className={input} value={form.tipo} onChange={event => field('tipo', event.target.value)}><option value="anuncio">Anúncio</option><option value="saida">Saída de campo</option><option value="material">Material útil</option></select></label>
          <label className="text-sm text-gray-700">Público<select className={input} value={form.grupo_id ?? ''} onChange={event => field('grupo_id', event.target.value)}><option value="">Toda a congregação</option>{groups.map(group => <option key={group.id} value={group.id}>{group.nome_grupo}</option>)}</select></label>
          <label className="text-sm text-gray-700 sm:col-span-2">Título<input required maxLength={160} className={input} value={form.titulo} onChange={event => field('titulo', event.target.value)} /></label>
          <label className="text-sm text-gray-700 sm:col-span-2">Mensagem<textarea required maxLength={5000} rows={4} className={input} value={form.mensagem} onChange={event => field('mensagem', event.target.value)} /></label>
          <label className="text-sm text-gray-700">Exibir a partir de<input required type="date" className={input} value={form.inicio} onChange={event => field('inicio', event.target.value)} /></label>
          <label className="text-sm text-gray-700">Exibir até (opcional)<input type="date" min={form.inicio} className={input} value={form.fim || ''} onChange={event => field('fim', event.target.value)} /></label>
          {form.tipo === 'saida' && <><label className="text-sm text-gray-700">Data da saída<input required type="date" min={form.inicio} max={form.fim || undefined} className={input} value={form.data || ''} onChange={event => field('data', event.target.value)} /></label><label className="text-sm text-gray-700">Horário<input required type="time" className={input} value={form.horario || ''} onChange={event => field('horario', event.target.value)} /></label><label className="text-sm text-gray-700 sm:col-span-2">Local de encontro<input required maxLength={250} className={input} value={form.local || ''} onChange={event => field('local', event.target.value)} /></label></>}
          <label className="text-sm text-gray-700 sm:col-span-2">{form.tipo === 'material' ? 'Link do material (opcional com anexo)' : 'Link de material ou orientações (opcional)'}<input required={form.tipo === 'material' && !attachment && (!form.anexo_nome || form.remover_anexo)} type="url" maxLength={2000} placeholder="https://" className={input} value={form.link || ''} onChange={event => field('link', event.target.value)} /></label>
          <div className="sm:col-span-2"><label className="text-sm text-gray-700">Anexar arquivo<input type="file" accept={ATTACHMENT_ACCEPT} className={input} onChange={event => {
            const file = event.target.files?.[0];
            if (file && file.size > MAX_ATTACHMENT_BYTES) { setError('Envie um arquivo de até 4 MB.'); event.target.value = ''; setAttachment(null); return; }
            setAttachment(file || null); setError('');
          }} /></label><p className="mt-1 text-xs text-gray-500">{ATTACHMENT_HELP} Um anexo por publicação; um novo arquivo substitui o anterior.</p>
          {form.anexo_nome && <div className="mt-2 space-y-2 text-sm text-gray-700"><a href={`/api/mural/anexo/${form.id}`} target="_blank" rel="noopener noreferrer" className="text-purple-700">Abrir anexo atual: {form.anexo_nome}</a><label className="flex items-center gap-2"><input type="checkbox" checked={form.remover_anexo === true} onChange={event => field('remover_anexo', event.target.checked)} />Remover anexo atual</label></div>}</div>
          {form.tipo === 'anuncio' && <><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.fixado} onChange={event => field('fixado', event.target.checked)} />Fixar anúncio importante</label><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.confirmar_leitura} onChange={event => field('confirmar_leitura', event.target.checked)} />Solicitar confirmação de leitura</label></>}
        </fieldset>
        {form.id && <p className="text-xs text-gray-500">Ao salvar alterações, as confirmações de leitura serão reiniciadas.</p>}
        <div className="flex gap-3"><button disabled={busy} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Salvando...' : 'Salvar publicação'}</button><button type="button" disabled={busy} onClick={() => { setForm(null); setAttachment(null); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700">Cancelar</button></div>
      </form> : <button type="button" disabled={busy || loading} onClick={() => { setForm(blank()); setAttachment(null); setDeleting(null); setMessage(''); }} className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm text-white disabled:opacity-50"><Plus className="h-4 w-4" />Nova publicação</button>}
      {loading ? <p role="status" className="text-sm text-gray-500">Carregando publicações...</p> : !posts.length ? <p className="text-sm text-gray-500">Nenhuma publicação cadastrada.</p> : <ul className="space-y-2">{posts.map(post => <li key={post.id} className="rounded-lg border border-gray-200 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium text-gray-900">{post.titulo}</p><p className="mt-1 text-xs text-gray-500">{post.tipo === 'saida' ? 'Saída de campo' : post.tipo === 'material' ? 'Material útil' : 'Anúncio'} · {post.nome_grupo || 'Toda a congregação'} · {post.inicio.split('-').reverse().join('/')}{post.fim ? ` até ${post.fim.split('-').reverse().join('/')}` : ' · Sem expiração'}</p></div><div className="flex gap-2"><button type="button" disabled={busy} aria-label={`Editar ${post.titulo}`} onClick={() => { setAttachment(null); setForm({ ...post, fim: post.fim || '', link: post.link || '' }); setDeleting(null); }} className="rounded-lg p-2 text-purple-700 hover:bg-purple-50"><Pencil className="h-4 w-4" /></button><button type="button" disabled={busy} aria-label={`Excluir ${post.titulo}`} onClick={() => setDeleting(post.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></div>{deleting === post.id && <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-700"><span>Excluir esta publicação?</span><button type="button" disabled={busy} onClick={() => mutate({ action: 'delete', id: post.id })} className="font-medium text-red-600">Confirmar exclusão</button><button type="button" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button></div>}</li>)}</ul>}
    </div>}
  </section>;
}
