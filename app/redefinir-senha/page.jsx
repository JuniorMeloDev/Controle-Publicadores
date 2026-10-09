'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const [senha, setSenha] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (senha !== confirmation) { setError('As senhas não coincidem.'); return; }
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setError('Link inválido. Solicite um novo link na tela de acesso.'); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/redefinir-senha', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, novaSenha: senha }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.message); return; }
      setSuccess(data.message);
      setSenha(''); setConfirmation('');
      window.history.replaceState(null, '', '/redefinir-senha');
    } catch { setError('Não foi possível conectar ao servidor.'); }
    finally { setLoading(false); }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">Redefinir senha</h1>
        {error && <p role="alert" className="mb-4 rounded-md border border-red-800 bg-red-950 p-3 text-sm text-red-300">{error}</p>}
        {success ? <p role="status" className="text-sm text-green-300">{success}</p> : (
          <form onSubmit={submit} className="space-y-5">
            <p className="text-sm text-neutral-300">Use pelo menos 8 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.</p>
            <div>
              <label htmlFor="new-password" className="text-sm text-neutral-300">Nova senha</label>
              <div className="relative">
                <input id="new-password" autoComplete="new-password" type={visible ? 'text' : 'password'} required minLength={8} value={senha} onChange={e => setSenha(e.target.value)} className={`${inputClass} pr-10`} />
                <button type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible(!visible)} className="absolute inset-y-0 right-3 text-neutral-400">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm-password" className="text-sm text-neutral-300">Confirmar nova senha</label>
              <input id="confirm-password" autoComplete="new-password" type={visible ? 'text' : 'password'} required minLength={8} value={confirmation} onChange={e => setConfirmation(e.target.value)} className={inputClass} />
            </div>
            <button disabled={loading} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{loading ? 'Salvando...' : 'Salvar nova senha'}</button>
          </form>
        )}
        <Link href="/" className="mt-5 block text-center text-sm text-blue-400 hover:text-blue-300">Voltar para o login</Link>
      </div>
    </main>
  );
}
