"use client";
import { useEffect, useRef, useState } from 'react';
import { IMaskInput } from 'react-imask';
import EmergencyContactsFields from '@/app/components/EmergencyContactsFields';
import { CADASTRO_FIELDS, CADASTRO_LIMITS } from '@/app/lib/cadastro-update';
const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500';
const buttonClass = 'rounded-lg bg-purple-700 px-5 py-3 font-medium text-white disabled:opacity-50 hover:bg-purple-800';
export default function AtualizacaoCadastral() {
  const nomeCongregacao = process.env.NEXT_PUBLIC_NOME_CONGREGACAO || 'Minha Congregação';
  const [nome, setNome] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [dados, setDados] = useState(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  const cepRequest = useRef(null);
  useEffect(() => () => cepRequest.current?.abort(), []);
  function cancelarBuscaCep() {
    cepRequest.current?.abort();
    cepRequest.current = null;
    setCepLoading(false);
    setCepError('');
  }
  async function buscarCep(value) {
    cancelarBuscaCep();
    const cep = value.replace(/\D/g, '');
    if (!cep) return;
    if (cep.length !== 8) { setCepError('Informe um CEP com 8 dígitos.'); return; }
    const controller = new AbortController();
    cepRequest.current = controller;
    setCepLoading(true);
    try {
      const response = await fetch(`/api/get-cep/${cep}`, { cache: 'no-store', signal: controller.signal });
      const body = await response.json();
      if (!response.ok || body.erro) throw new Error(body.message || 'CEP não encontrado.');
      if (controller.signal.aborted || cepRequest.current !== controller) return;
      setDados(prev => {
        if (!prev || prev.cep.replace(/\D/g, '') !== cep) return prev;
        return {
          ...prev,
          logradouro: body.logradouro || prev.logradouro,
          bairro: body.bairro || prev.bairro,
          cidade: body.localidade || prev.cidade,
          estado: body.uf || prev.estado,
        };
      });
    } catch (err) {
      if (!controller.signal.aborted && cepRequest.current === controller) setCepError(err.message || 'Não foi possível buscar o CEP. Preencha o endereço manualmente.');
    } finally {
      if (cepRequest.current === controller) { cepRequest.current = null; setCepLoading(false); }
    }
  }
  async function buscar(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/atualizacao-cadastral/buscar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, nascimento }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      setDados(body.dados); setToken(body.token);
    } catch (err) { setError(err.message || 'Falha na busca. Tente novamente.'); }
    finally { setBusy(false); }
  }
  async function enviar(event) {
    event.preventDefault();
    if (cepRequest.current) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/atualizacao-cadastral/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dados, token }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      setResult(body); setDados(null); setToken('');
    } catch (err) { setError(err.message || 'Falha no envio. Tente novamente.'); }
    finally { setBusy(false); }
  }
  function reiniciar() { cancelarBuscaCep(); setDados(null); setResult(null); setToken(''); setError(''); setNome(''); setNascimento(''); }
  return <main className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900">
    <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold">Atualização cadastral — Congregação {nomeCongregacao}</h1>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
      {result ? <div className="mt-6 space-y-4" role="status">
        <h2 className="text-xl font-semibold">Dados enviados com sucesso!</h2>
        <p>Campos preenchidos automaticamente: {result.automaticos}. Alterações aguardando validação do responsável: {result.pendentes}.</p>
        {!result.automaticos && !result.pendentes && <p>Seus dados já estão atualizados. Nenhuma alteração foi necessária.</p>}
        <button onClick={reiniciar} className={buttonClass}>Voltar ao início</button>
      </div> : !dados ? <form onSubmit={buscar} className="mt-6 space-y-5">
        <p className="text-gray-600">Informe seu nome completo ou partes do nome e sua data de nascimento para localizar seu cadastro.</p>
        <label className="block space-y-2"><span className="font-medium">Nome</span><input autoComplete="name" className={inputClass} value={nome} onChange={e => setNome(e.target.value)} maxLength={200} required disabled={busy} /></label>
        <label className="block space-y-2"><span className="font-medium">Data de nascimento</span><input type="date" className={inputClass} value={nascimento} onChange={e => setNascimento(e.target.value)} required disabled={busy} /></label>
        <button className={buttonClass} disabled={busy}>{busy ? 'Buscando...' : 'Buscar meu cadastro'}</button>
        <p className="text-sm text-gray-500">Se não encontrar seu cadastro ou a data registrada estiver incorreta, procure o responsável pelo cadastro.</p>
      </form> : <form onSubmit={enviar} className="mt-6 space-y-6">
        <div className="rounded-lg bg-purple-50 p-4"><h2 className="font-semibold">Verifique seus dados cadastrais.</h2><p className="mt-1">Insira as informações que faltam ou corrija os dados incorretos.</p></div>
        <p className="text-sm text-gray-600">Campos vazios no cadastro serão preenchidos automaticamente. Correções de dados existentes serão enviadas para validação. Deixar um campo em branco não apaga o dado atual.</p>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          {CADASTRO_FIELDS.filter(([, , type]) => type !== 'contacts').map(([key, label, type]) => <label key={key} className={`block space-y-2 ${key === 'nome_completo' || key === 'logradouro' ? 'sm:col-span-2' : ''}`}>
            <span className="text-sm font-medium">{label}</span>
            {key === 'sexo' ? <select className={inputClass} value={dados[key]} onChange={e => { const value = e.target.value; setDados(prev => ({ ...prev, [key]: value })); }}><option value="">Selecione</option><option>Masculino</option><option>Feminino</option></select>
            : key === 'cep' ? <>
              <IMaskInput mask="00000-000" inputMode="numeric" autoComplete="postal-code" aria-label="CEP" className={inputClass} value={dados.cep} placeholder="00000-000" aria-invalid={Boolean(cepError)} aria-describedby="cep-status" onAccept={value => { if (value !== dados.cep) { cancelarBuscaCep(); setDados(prev => ({ ...prev, cep: value })); } }} onBlur={e => buscarCep(e.target.value)} />
              <span id="cep-status" className={`block text-xs ${cepError ? 'text-red-700' : 'text-gray-500'}`} role={cepError ? 'alert' : 'status'}>{cepLoading ? 'Buscando endereço...' : cepError || 'Ao sair do campo, o endereço será preenchido pelo CEP.'}</span>
            </>
            : <input type={type || (key === 'telefone' ? 'tel' : 'text')} className={inputClass} value={dados[key]} maxLength={CADASTRO_LIMITS[key]} placeholder={key === 'estado' ? 'UF' : undefined} disabled={cepLoading && ['logradouro', 'bairro', 'cidade', 'estado'].includes(key)} onChange={e => { const value = e.target.value; setDados(prev => ({ ...prev, [key]: value })); }} />}
          </label>)}
          <div className="sm:col-span-2"><EmergencyContactsFields value={dados.contatos_emergencia || []} onChange={contatos => setDados(prev => ({ ...prev, contatos_emergencia: contatos }))} disabled={busy} /></div>
        </fieldset>
        <div className="flex flex-wrap gap-3"><button disabled={busy || cepLoading} className={buttonClass}>{busy ? 'Enviando...' : 'Enviar atualização'}</button><button type="button" disabled={busy} onClick={reiniciar} className="rounded-lg border px-5 py-3">Buscar outro cadastro</button></div>
      </form>}
    </div>
  </main>;
}
