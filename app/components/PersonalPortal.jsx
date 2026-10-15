'use client';

import { StatusToast } from '@/app/components/ui/status-toast';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import S21Preview from './relatorios/S21Preview';
import EmergencyContactsFields from './EmergencyContactsFields';
import { useUserSession } from './UserSessionProvider';
import { CADASTRO_FIELDS } from '@/app/lib/cadastro-update';
import CongregationOverview from './CongregationOverview';

const cardClass = 'rounded-xl border border-gray-200 bg-white p-5';
const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';
const formatDate = value => value ? new Date(String(value).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não informado';

export default function PersonalPortal({ section = 'overview' }) {
  const { personalData: data, personalError, loadPersonalData, user } = useUserSession();
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const now = new Date();
  const currentYear = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
  const [year, setYear] = useState(currentYear);
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (user) loadPersonalData();
  }, [loadPersonalData, user]);

  useEffect(() => {
    if (!user || section !== 'assignments') return;
    const refresh = () => { if (document.visibilityState === 'visible') loadPersonalData({ force: true }); };
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(timer); };
  }, [user, section, loadPersonalData]);

  async function respond(item, resposta) {
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/designacoes/resposta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ versao: item.versao, resposta }) });
      const result = await response.json();
      await loadPersonalData({ force: true });
      if (!response.ok) throw new Error(result.message);
      setMessage(resposta === 'sim' ? 'Designação confirmada.' : 'Recusa registrada. Os responsáveis serão avisados.');
      window.dispatchEvent(new Event('notifications:changed'));
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function startEdit() {
    setError(''); setMessage(''); setSaving(true);
    try {
      const response = await fetch('/api/minha-conta', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setEditing(result);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function save(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const response = await fetch('/api/atualizacao-cadastral/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMessage(result.pendentes ? `${result.pendentes} alteração(ões) enviada(s) para aprovação do super admin.` : 'Nenhuma alteração foi necessária.');
      setEditing(null);
      await loadPersonalData({ force: true });
      window.dispatchEvent(new Event('session:changed'));
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  if (!data) return <p role="status" className="p-6 text-gray-600">{error || personalError || 'Carregando seus dados...'}</p>;
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonth = previous.toLocaleDateString('pt-BR', { month: 'long' });
  const previousYear = previous.getMonth() >= 8 ? previous.getFullYear() + 1 : previous.getFullYear();
  const submitted = data.reports.some(report => Number(report.ano_servico) === previousYear && report.mes.toLowerCase() === previousMonth);
  const years = [...new Set([currentYear, ...data.reports.map(report => Number(report.ano_servico))])].sort((a, b) => b - a);
  const titles = { overview: 'Meu painel', data: 'Meus dados', assignments: 'Minhas designações', s21: 'Meu S-21' };
  const invalidPeriod = Boolean(startDate && endDate && startDate > endDate);
  const upcoming = data.assignments.filter(item => String(item.data_reuniao).slice(0, 10) >= today);
  const assignments = invalidPeriod ? [] : data.assignments.filter(item => {
    const date = String(item.data_reuniao).slice(0, 10);
    return (!startDate || date >= startDate) && (!endDate || date <= endDate);
  });
  return <div className="w-full min-w-0 space-y-4 p-3 sm:p-4 print:p-0 print:space-y-0">
    <div className="print:hidden"><h1 className="text-2xl font-bold text-gray-900">{titles[section]}</h1><p className="mt-1 text-sm text-gray-600">Olá, {data.info.nome_chamado || data.info.nome_completo}.</p></div>
    {(error || personalError) && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error || personalError}</p>}
    <StatusToast message={message} type="success" onClose={() => setMessage('')} />
    {section === 'overview' && <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/minhas-designacoes" className={`${cardClass} block transition-colors hover:border-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500`}><p className="text-sm text-gray-500">Próximas designações</p><p className="mt-2 text-3xl font-bold text-purple-700">{upcoming.length}</p><p className="mt-3 text-sm text-purple-700">Ver minhas designações</p></Link>
        <div className={cardClass}><p className="text-sm text-gray-500">Relatório de {previousMonth}</p><p className="mt-2 font-semibold text-gray-900">{submitted ? 'Enviado' : 'Aguardando envio'}</p><Link href="/relatorio-mensal" className="mt-3 inline-block text-sm text-purple-700">Enviar relatório</Link></div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-purple-700"><Link href="/admin/minhas-designacoes">Minhas designações</Link><Link href="/admin/meu-s21">Meu S-21</Link></div>
    </>}
    {section === 'assignments' && <section className={cardClass}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900">{`Designações (${assignments.length})`}</h2>
        {section === 'assignments' && <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-700">Data inicial<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className={inputClass} /></label>
          <label className="text-sm text-gray-700">Data final<input type="date" min={startDate || undefined} value={endDate} onChange={event => setEndDate(event.target.value)} className={inputClass} /></label>
          <button type="button" onClick={() => { setStartDate(''); setEndDate(''); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">Limpar filtros</button>
        </div>}
      </div>
      {invalidPeriod && section === 'assignments' && <p role="alert" className="mb-3 text-sm text-red-600">A data final deve ser igual ou posterior à inicial.</p>}
      {!assignments.length ? <p className="text-gray-500">Nenhuma designação neste período.</p> : <ul className="grid gap-3 lg:grid-cols-2">{assignments.map(item => <li key={item.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3"><p className="text-sm font-semibold text-gray-900">{item.nome_parte}</p><p className="mt-1 text-sm text-gray-600">{formatDate(item.data_reuniao)} · {item.categoria}</p>{item.descricao_semana && <p className="mt-2 text-sm text-gray-500">{item.descricao_semana}</p>}<p className="mt-3 text-sm font-medium text-gray-900">{item.resposta === 'sim' ? 'Confirmada' : item.resposta === 'nao' ? 'Recusada — aguardando substituição' : 'Sem resposta — designação válida'}</p>{String(item.data_reuniao).slice(0, 10) >= today && (!item.resposta || item.resposta === 'sem_resposta') && <div className="mt-3"><p className="text-sm text-gray-700">Confirma sua designação?</p><div className="mt-2 flex gap-3"><button disabled={saving} onClick={() => respond(item, 'sim')} className="rounded-lg bg-purple-700 px-4 py-2 text-sm text-white disabled:opacity-50">Sim</button><button disabled={saving} onClick={() => respond(item, 'nao')} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50">Não</button></div></div>}</li>)}</ul>}
    </section>}
    {section === 'overview' && <CongregationOverview />}
    {section === 'data' && <section className={cardClass}>
      {editing ? <form onSubmit={save} className="space-y-5"><p className="text-sm text-gray-600">Todas as alterações precisam da aprovação de um super admin. Seus dados atuais serão mantidos até a aprovação.</p>
        <div className="grid gap-4 sm:grid-cols-2">{CADASTRO_FIELDS.filter(([, , type]) => type !== 'contacts').map(([key, label, type]) => <label key={key} className="text-sm text-gray-700">{label}<input type={type === 'date' ? 'date' : type === 'email' ? 'email' : 'text'} value={editing.dados[key] || ''} onChange={event => setEditing(prev => ({ ...prev, dados: { ...prev.dados, [key]: event.target.value } }))} className={inputClass} /></label>)}</div>
        <EmergencyContactsFields value={editing.dados.contatos_emergencia || []} onChange={contacts => setEditing(prev => ({ ...prev, dados: { ...prev.dados, contatos_emergencia: contacts } }))} disabled={saving} />
        <div className="flex gap-3"><button disabled={saving} className="rounded-lg bg-purple-600 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Enviando...' : 'Enviar atualização'}</button><button type="button" disabled={saving} onClick={() => setEditing(null)} className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700">Cancelar</button></div>
      </form> : <><dl className="grid gap-4 sm:grid-cols-2">{CADASTRO_FIELDS.filter(([, , type]) => type !== 'contacts').map(([key, label, type]) => <div key={key}><dt className="text-sm text-gray-500">{label}</dt><dd className="break-words text-gray-900">{type === 'date' ? formatDate(data.info[key]) : data.info[key] || 'Não informado'}</dd></div>)}</dl>
        <div className="mt-5"><h3 className="font-semibold text-gray-900">Contatos de emergência</h3>{(data.info.contatos_emergencia || []).map((contact, index) => <p key={index} className="mt-2 text-sm text-gray-600">{contact.nome} · {contact.telefone}</p>)}</div>
        <button disabled={saving} onClick={startEdit} className="mt-5 rounded-lg bg-purple-600 px-4 py-2 text-white disabled:opacity-50">Atualizar meus dados</button></>}
    </section>}
    {section === 's21' && <><div className="flex flex-wrap items-center gap-3 print:hidden"><label htmlFor="personal-service-year" className="text-gray-700">Ano de serviço</label><select id="personal-service-year" value={year} onChange={event => setYear(Number(event.target.value))} className="rounded-lg border border-gray-300 bg-white p-2 text-gray-900">{years.map(value => <option key={value}>{value}</option>)}</select><button onClick={() => window.print()} className="rounded-lg bg-purple-600 px-4 py-2 text-white print:hidden">Imprimir S-21</button></div><S21Preview publisherData={{ info: data.info, reports: data.reports }} serviceYear={year} /></>}
  </div>;
}
