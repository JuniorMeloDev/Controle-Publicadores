'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Megaphone, MapPin, Clock, Pin, Check, ExternalLink, Users, FileText, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useUserSession } from './UserSessionProvider';

const card = 'rounded-xl border border-gray-200 bg-white p-5';
const dateLabel = value => new Date(`${String(value).slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' });

function AttachmentLink({ post }) {
  return post.anexo_nome ? <a href={`/api/mural/anexo/${post.id}`} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-2 break-all text-sm font-medium text-purple-700"><FileText className="h-4 w-4 shrink-0" />Abrir anexo: {post.anexo_nome}</a> : null;
}

function Section({ title, icon: Icon, items, empty, render }) {
  const [expanded, setExpanded] = useState(false);
  return <section className={card}>
    <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900"><Icon className="h-5 w-5 text-purple-600" />{title}</h2>
    {!items.length ? <p className="text-sm text-gray-500">{empty}</p> : <ul className="space-y-3">{(expanded ? items : items.slice(0, 3)).map(render)}</ul>}
    {items.length > 3 && <button type="button" onClick={() => setExpanded(!expanded)} className="mt-4 text-sm font-medium text-purple-700">{expanded ? 'Mostrar menos' : `Ver todos (${items.length})`}</button>}
  </section>;
}

export default function CongregationOverview() {
  const { user } = useUserSession();
  const userId = user?.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(null);
  const [dismissing, setDismissing] = useState(false);
  const load = useCallback(async signal => {
    try {
      const response = await fetch('/api/visao-geral', { cache: 'no-store', signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setData(result); setError('');
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
  }, []);
  useEffect(() => {
    setData(null); setError('');
    if (!userId) return;
    const controller = new AbortController();
    load(controller.signal);
    const refresh = () => { if (document.visibilityState === 'visible') load(controller.signal); };
    window.addEventListener('focus', refresh);
    window.addEventListener('mural:changed', refresh);
    return () => { controller.abort(); window.removeEventListener('focus', refresh); window.removeEventListener('mural:changed', refresh); };
  }, [load, userId]);

  async function confirmRead(id) {
    setReading(id); setError('');
    try {
      const response = await fetch('/api/mural', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read', id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setData(previous => ({ ...previous, posts: previous.posts.map(post => post.id === id ? { ...post, lido: true } : post) }));
    } catch (err) { setError(err.message); }
    finally { setReading(null); }
  }

  async function dismissChanges() {
    const ids = (data.changes || []).map(item => item.id);
    setDismissing(true); setError('');
    try {
      const response = await fetch('/api/visao-geral', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setData(previous => ({ ...previous, changes: (previous.changes || []).filter(item => !ids.includes(item.id)) }));
    } catch (err) { setError(err.message); }
    finally { setDismissing(false); }
  }

  return <div className="space-y-4">
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}<button type="button" onClick={() => load()} className="ml-3 underline">Tentar novamente</button></div>}
    {!data ? <p role="status" className="text-sm text-gray-500">{error ? 'Agenda indisponível no momento.' : 'Carregando agenda e anúncios...'}</p> : <>
      {data.changes?.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold text-amber-900"><RefreshCw className="h-5 w-5" />Mudanças recentes</h2><button type="button" disabled={dismissing} onClick={dismissChanges} className="text-sm font-medium text-amber-900 underline disabled:opacity-50">{dismissing ? 'Registrando...' : 'Marcar como vistas'}</button></div>
        <ul className="space-y-3">{data.changes.map(change => <li key={change.id}><h3 className="text-sm font-semibold text-amber-900">{change.title}</h3><p className="mt-1 break-words text-sm text-amber-800">{change.description}</p>{change.href && <Link href={change.href} className="mt-1 inline-block text-sm font-medium text-amber-900 underline">Conferir designações</Link>}</li>)}</ul>
      </section>}
      <Section title="Anúncios da congregação" icon={Megaphone} items={data.posts.filter(post => post.tipo === 'anuncio')} empty="Nenhum anúncio publicado no momento." render={post => <li key={post.id} className={`rounded-lg border p-4 ${post.fixado ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex flex-wrap items-center gap-2">{post.fixado && <Pin className="h-4 w-4 text-purple-600" aria-label="Anúncio fixado" />}<h3 className="font-semibold text-gray-900">{post.titulo}</h3>{!post.lido && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">Novo</span>}</div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700">{post.mensagem}</p>
        <p className="mt-3 text-xs text-gray-500">Publicado em {dateLabel(post.inicio)} · {post.nome_grupo || 'Toda a congregação'}</p>
        {post.link && <a href={post.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-purple-700">Abrir material <ExternalLink className="h-3 w-3" /></a>}
        <AttachmentLink post={post} />
        <div className="mt-3">{post.lido ? <span className="inline-flex items-center gap-1 text-xs text-green-700"><Check className="h-4 w-4" />Leitura registrada</span> : <button type="button" disabled={reading !== null} onClick={() => confirmRead(post.id)} className="text-sm font-medium text-purple-700 disabled:opacity-50">{reading === post.id ? 'Registrando...' : post.confirmar_leitura ? 'Confirmar leitura' : 'Marcar como lido'}</button>}</div>
      </li>} />
      {data.cancelled.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-semibold text-amber-900">Alterações nesta semana</h2>{data.cancelled.map(meeting => <p key={meeting.id} className="mt-2 text-sm text-amber-800">{dateLabel(meeting.data)} · {meeting.tipo}: {meeting.motivo_cancelamento}</p>)}</div>}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title="Próximas reuniões" icon={CalendarDays} items={data.meetings} empty="Nenhuma reunião agendada nos próximos 90 dias." render={meeting => <li key={meeting.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="font-semibold text-gray-900">{meeting.tipo === 'Meio de Semana' ? 'Vida e Ministério' : meeting.tipo === 'Fim de Semana' ? 'Reunião do fim de semana' : meeting.tipo}</h3>
          <p className="mt-1 text-sm text-gray-600">{dateLabel(meeting.data)}</p>
          {meeting.tema && <p className="mt-2 text-sm text-gray-700">Discurso: {meeting.tema}</p>}
          {meeting.programacao ? <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium text-purple-700">Ver programação</summary><div className="mt-3 space-y-3 text-gray-700">{meeting.programacao.leitura && <p>Leitura da Bíblia: {meeting.programacao.leitura}</p>}{meeting.programacao.secoes.map(section => <div key={section.titulo}><h4 className="font-semibold">{section.titulo}</h4><ul className="mt-1 space-y-2">{section.partes.map((part, index) => <li key={index}>{part.titulo}{part.duracao ? ` (${part.duracao} min)` : ''}</li>)}</ul></div>)}</div></details> : meeting.tipo === 'Meio de Semana' && <p className="mt-2 text-xs text-gray-500">Programação ainda não disponibilizada.</p>}
        </li>} />
        <Section title="Eventos especiais" icon={CalendarDays} items={data.events} empty="Nenhum próximo evento especial cadastrado." render={event => <li key={event.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4"><span className="text-xs font-medium text-purple-700">{event.tipo}</span><h3 className="mt-1 font-semibold text-gray-900">{event.nome}</h3><p className="mt-1 text-sm text-gray-600">{dateLabel(event.data)}</p></li>} />
      </div>
      <Section title="Saídas de campo" icon={Users} items={data.posts.filter(post => post.tipo === 'saida')} empty="Nenhuma próxima saída de campo publicada." render={post => <li key={post.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4"><h3 className="font-semibold text-gray-900">{post.titulo}</h3><p className="mt-2 flex items-center gap-2 text-sm text-gray-600"><Clock className="h-4 w-4" />{dateLabel(post.data)} às {post.horario}</p><p className="mt-1 flex items-start gap-2 text-sm text-gray-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{post.local}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700">{post.mensagem}</p><p className="mt-2 text-xs text-gray-500">{post.nome_grupo || 'Toda a congregação'}</p>{post.link && <a href={post.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-purple-700">Ver orientações</a>}<AttachmentLink post={post} /></li>} />
      <Section title="Materiais úteis" icon={FileText} items={data.posts.filter(post => post.tipo === 'material')} empty="Nenhum material disponibilizado no momento." render={post => <li key={post.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4"><h3 className="font-semibold text-gray-900">{post.titulo}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700">{post.mensagem}</p><p className="mt-2 text-xs text-gray-500">{post.nome_grupo || 'Toda a congregação'}</p>{post.link && <a href={post.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-purple-700">Abrir material <ExternalLink className="h-4 w-4" /></a>}<AttachmentLink post={post} /></li>} />
    </>}
  </div>;
}
