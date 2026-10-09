"use client";
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatEmergencyContacts } from '@/app/lib/emergency-contacts';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { CADASTRO_FIELDS } from '@/app/lib/cadastro-update';
const labels = Object.fromEntries(CADASTRO_FIELDS.map(([key, label]) => [key, label]));
const statusLabels = { pendente: 'Pendente', automatico: 'Preenchido automaticamente', aprovado: 'Aprovado', rejeitado: 'Rejeitado' };
function formatValue(field, value) {
  if (field === 'contatos_emergencia') return formatEmergencyContacts(value);
  if (!value) return 'Vazio';
  if (field.startsWith('data_')) { const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value); if (match) return `${match[3]}/${match[2]}/${match[1]}`; }
  return value;
}
export default function AtualizacoesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState(false);
  const [link, setLink] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/atualizacoes-cadastrais', { cache: 'no-store' });
      const body = await response.json(); if (!response.ok) throw new Error(body.message);
      setRows(body);
    } catch (err) { setError(err.message || 'Falha ao carregar.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { setLink(`${window.location.origin}/atualizacao-cadastral`); load(); }, [load]);
  async function review(ids, acao) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/atualizacoes-cadastrais', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, acao }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.message);
      setMessage(body.message);
    } catch (err) { setError(err.message || 'Falha ao revisar.'); }
    finally { await load(); setBusy(false); }
  }
  const groups = Object.values(rows.filter(row => history || row.status === 'pendente').reduce((acc, row) => {
    (acc[row.envio_id] ||= { id: row.envio_id, nome: row.nome_completo, publicador: row.publicador_id, date: row.criado_em, rows: [] }).rows.push(row);
    return acc;
  }, {}));
  return <DashboardLayout><div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 text-gray-900">
    <Link href="/admin/gerenciar" className="text-sm text-purple-700">← Publicadores</Link>
    <h1 className="text-2xl font-bold">Atualizações cadastrais</h1>
    <div className="rounded-xl border bg-white p-4 space-y-3"><p>Envie este mesmo link para todos os publicadores:</p>
      <div className="flex flex-wrap gap-2"><input aria-label="Link público de atualização" readOnly value={link} className="min-w-0 flex-1 rounded-lg border p-2 text-sm" />
      <button className="rounded-lg bg-purple-700 px-4 py-2 text-white" onClick={async () => { try { await navigator.clipboard.writeText(link); setMessage('Link copiado.'); } catch { setError('Selecione o link e copie manualmente.'); } }}>Copiar link</button>
      <a href="/atualizacao-cadastral" target="_blank" rel="noreferrer" className="rounded-lg border px-4 py-2">Abrir formulário</a></div>
      <p className="text-sm text-gray-500">Novos dados em campos vazios entram automaticamente. Correções precisam da sua aprovação.</p>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{message}</p>}
    <div className="flex flex-wrap items-center gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)} />Mostrar também preenchimentos e revisões anteriores</label><button disabled={busy || loading} onClick={load} className="rounded-lg border px-3 py-2">Atualizar lista</button></div>
    {loading ? <p>Carregando...</p> : !groups.length ? <p className="rounded-xl border bg-white p-6">{history ? 'Nenhuma atualização recebida.' : 'Nenhuma alteração pendente.'}</p> : groups.map(group => {
      const pending = group.rows.filter(row => row.status === 'pendente');
      const conflicting = pending.some(row => formatValue(row.campo, row.valor_atual) !== formatValue(row.campo, row.valor_antigo));
      return <section key={group.id} className="rounded-xl border bg-white p-4 space-y-4">
        <div className="flex flex-wrap justify-between gap-3"><div><Link className="font-semibold text-purple-700" href={`/admin/gerenciar?id=${group.publicador}`}>{group.nome}</Link><p className="text-sm text-gray-500">{new Date(group.date).toLocaleString('pt-BR')}</p></div>
        {pending.length > 1 && <button disabled={busy || conflicting} onClick={() => review(pending.map(row => row.id), 'aprovar')} className="rounded-lg bg-purple-700 px-4 py-2 text-white disabled:opacity-50">Aprovar todas deste envio</button>}</div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Campo</th><th className="p-2">Anterior</th><th className="p-2">Informado</th><th className="p-2">Revisão</th></tr></thead><tbody>
          {group.rows.map(row => { const conflict = formatValue(row.campo, row.valor_atual) !== formatValue(row.campo, row.valor_antigo); return <tr key={row.id} className="border-b last:border-0">
            <td className="p-2">{labels[row.campo] || row.campo}</td><td className="p-2 break-words">{formatValue(row.campo, row.valor_antigo)}{row.status === 'pendente' && conflict && <p className="mt-1 text-amber-700">Cadastro mudou. Atual: {formatValue(row.campo, row.valor_atual)}</p>}</td><td className="p-2 break-words">{formatValue(row.campo, row.valor_novo)}</td>
            <td className="p-2">{row.status === 'pendente' ? <div className="flex flex-wrap gap-2"><button disabled={busy || conflict} onClick={() => review([row.id], 'aprovar')} className="rounded border border-green-300 px-3 py-1 text-green-800 disabled:opacity-50">Aprovar</button><button disabled={busy} onClick={() => review([row.id], 'rejeitar')} className="rounded border px-3 py-1 text-red-700 disabled:opacity-50">Rejeitar</button></div> : statusLabels[row.status]}</td>
          </tr>; })}
        </tbody></table></div>
      </section>;
    })}
  </div></DashboardLayout>;
}
