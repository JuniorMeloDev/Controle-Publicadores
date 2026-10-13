'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import S21Card from './relatorios/S21Card';
import EmergencyContactsFields from './EmergencyContactsFields';
import { useUserSession } from './UserSessionProvider';
import { CADASTRO_FIELDS } from '@/app/lib/cadastro-update';

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

  useEffect(() => {
    if (user) loadPersonalData();
  }, [loadPersonalData, user]);

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
      setMessage(`Atualização enviada: ${result.automaticos} campo(s) preenchido(s) e ${result.pendentes} alteração(ões) aguardando aprovação.`);
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
  return <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
    <div><h1 className="text-2xl font-bold text-gray-900">{titles[section]}</h1><p className="mt-1 text-gray-600">Olá, {data.info.nome_chamado || data.info.nome_completo}.</p></div>
    {(error || personalError) && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error || personalError}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-700">{message}</p>}
    {section === 'overview' && <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={cardClass}><p className="text-sm text-gray-500">Próximas designações</p><p className="mt-2 text-3xl font-bold text-purple-700">{data.assignments.length}</p></div>
        <div className={cardClass}><p className="text-sm text-gray-500">Relatório de {previousMonth}</p><p className="mt-2 font-semibold text-gray-900">{submitted ? 'Enviado' : 'Aguardando envio'}</p><Link href="/relatorio-mensal" className="mt-3 inline-block text-sm text-purple-700">Enviar relatório</Link></div>
        <div className={cardClass}><p className="text-sm text-gray-500">Atualizações cadastrais</p><p className="mt-2 font-semibold text-gray-900">{data.pendingChanges ? `${data.pendingChanges} aguardando aprovação` : 'Nenhuma alteração pendente'}</p><Link href="/admin/meus-dados" className="mt-3 inline-block text-sm text-purple-700">Conferir meus dados</Link></div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-purple-700"><Link href="/admin/minhas-designacoes">Minhas designações</Link><Link href="/admin/meu-s21">Meu S-21</Link></div>
    </>}
    {(section === 'overview' || section === 'assignments') && <section className={cardClass}>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Próximas designações</h2>
      {!data.assignments.length ? <p className="text-gray-500">Você não tem designações futuras.</p> : <ul className="divide-y divide-gray-200">{data.assignments.map(item => <li key={item.id} className="py-3"><p className="font-semibold text-gray-900">{item.nome_parte}</p><p className="text-sm text-gray-600">{formatDate(item.data_reuniao)} · {item.categoria}</p></li>)}</ul>}
    </section>}
    {section === 'data' && <section className={cardClass}>
      {editing ? <form onSubmit={save} className="space-y-5"><p className="text-sm text-gray-600">Alterações em dados já preenchidos serão revisadas pelo responsável pelo cadastro.</p>
        <div className="grid gap-4 sm:grid-cols-2">{CADASTRO_FIELDS.filter(([, , type]) => type !== 'contacts').map(([key, label, type]) => <label key={key} className="text-sm text-gray-700">{label}<input type={type === 'date' ? 'date' : type === 'email' ? 'email' : 'text'} value={editing.dados[key] || ''} onChange={event => setEditing(prev => ({ ...prev, dados: { ...prev.dados, [key]: event.target.value } }))} className={inputClass} /></label>)}</div>
        <EmergencyContactsFields value={editing.dados.contatos_emergencia || []} onChange={contacts => setEditing(prev => ({ ...prev, dados: { ...prev.dados, contatos_emergencia: contacts } }))} disabled={saving} />
        <div className="flex gap-3"><button disabled={saving} className="rounded-lg bg-purple-600 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Enviando...' : 'Enviar atualização'}</button><button type="button" disabled={saving} onClick={() => setEditing(null)} className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700">Cancelar</button></div>
      </form> : <><dl className="grid gap-4 sm:grid-cols-2">{CADASTRO_FIELDS.filter(([, , type]) => type !== 'contacts').map(([key, label, type]) => <div key={key}><dt className="text-sm text-gray-500">{label}</dt><dd className="break-words text-gray-900">{type === 'date' ? formatDate(data.info[key]) : data.info[key] || 'Não informado'}</dd></div>)}</dl>
        <div className="mt-5"><h3 className="font-semibold text-gray-900">Contatos de emergência</h3>{(data.info.contatos_emergencia || []).map((contact, index) => <p key={index} className="mt-2 text-sm text-gray-600">{contact.nome} · {contact.telefone}</p>)}</div>
        <button disabled={saving} onClick={startEdit} className="mt-5 rounded-lg bg-purple-600 px-4 py-2 text-white disabled:opacity-50">Atualizar meus dados</button></>}
    </section>}
    {section === 's21' && <><div className="flex items-center gap-3"><label htmlFor="personal-service-year" className="text-gray-700">Ano de serviço</label><select id="personal-service-year" value={year} onChange={event => setYear(Number(event.target.value))} className="rounded-lg border border-gray-300 bg-white p-2 text-gray-900">{years.map(value => <option key={value}>{value}</option>)}</select><button onClick={() => window.print()} className="rounded-lg bg-purple-600 px-4 py-2 text-white print:hidden">Imprimir S-21</button></div><div className="overflow-x-auto"><S21Card publisherData={{ info: data.info, reports: data.reports }} serviceYear={year} /></div></>}
  </div>;
}
