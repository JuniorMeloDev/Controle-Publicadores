'use client';
import { useEffect, useState } from 'react';

const labels = { sim: 'Confirmada', nao: 'Recusada — aguardando substituição', sem_resposta: 'Sem resposta — designação válida' };
export default function ConfirmAssignment() {
  const [token, setToken] = useState('');
  const [answer, setAnswer] = useState('sim');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const tokenValue = params.get('token') || '';
    setToken(tokenValue); setAnswer(params.get('resposta') === 'nao' ? 'nao' : 'sim');
    fetch('/api/designacoes/resposta', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenValue }), cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.message); setData(result); })
      .catch(err => setError(err.message)).finally(() => setBusy(false));
  }, []);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/designacoes/resposta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, resposta: answer }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message); setData(result);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-lg p-6 text-gray-900"><meta name="referrer" content="no-referrer" /><h1 className="mb-4 text-2xl font-bold">Confirma sua designação?</h1>
    {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
    {data && <><p className="font-semibold">{data.assignment.nome_parte}</p><p>{String(data.assignment.data_reuniao).slice(0, 10)} · {data.assignment.categoria}</p><p role="status" className="my-4">{labels[data.resposta]}</p>
      {data.resposta === 'sem_resposta' && <form onSubmit={submit}><fieldset disabled={busy} className="space-y-4"><legend className="mb-3">Sem resposta, sua designação continua válida.</legend>
        <label className="mr-6"><input type="radio" name="answer" checked={answer === 'sim'} onChange={() => setAnswer('sim')} /> Sim</label>
        <label><input type="radio" name="answer" checked={answer === 'nao'} onChange={() => setAnswer('nao')} /> Não</label>
        <button className="block rounded-lg bg-purple-700 px-4 py-2 text-white">{busy ? 'Salvando...' : 'Registrar resposta'}</button></fieldset></form>}</>}
    {busy && !data && <p role="status">Carregando designação...</p>}
  </main>;
}
