// app/page.jsx

'use client';

import { StatusToast } from '@/app/components/ui/status-toast'; 

import { useState } from 'react';
import { useRouter } from 'next/navigation'; 
import { Eye, EyeOff } from 'lucide-react'; 

export default function LoginPage() {
  const [email, setEmail] = useState(''); // ALTERADO: nome para email
  const [senha, setSenha] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [message, setMessage] = useState('');
  
  // --- MUDANÇA 2: Adiciona o state para o "olho" ---
  const [showPassword, setShowPassword] = useState(false);
  
  const router = useRouter(); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(recovering ? '/api/esqueci-senha' : '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email, // ALTERADO: nome_completo para email
          senha: senha 
        }),
      });

      if (response.ok) {
        if (recovering) {
          const data = await response.json();
          setMessage(data.message);
          return;
        }
        // Redireciona para o dashboard após login (o middleware vai pegar)
        router.push('/admin/dashboard'); 
      } else {
        const data = await response.json();
        setError(data.message || 'Email ou senha inválidos.');
      }
    } catch (err) {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const labelClass = "block text-sm font-medium text-gray-700";
  const inputClass = "mt-1 block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-colors";

  return (
    <main className="min-h-dvh w-full flex items-center justify-center bg-[#f5f3f8] dark:bg-[#101014] p-4 sm:p-6">
      <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-2xl shadow-xl shadow-purple-950/10 dark:shadow-black/30 border border-gray-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Congregação Praia dos Corais" width={96} height={96} className="mx-auto mb-5 object-contain" />
        <h2 className="text-3xl font-bold text-center mb-6 text-gray-900">
          {recovering ? 'Recuperar senha' : 'Acesso Restrito'}
        </h2>
        
        {error && (
          <div role="alert" className="p-3 rounded-md mb-4 bg-red-50 text-red-700 border border-red-200 dark:border-red-900 text-sm">
            {error}
          </div>
        )}

        {recovering && <p className="mb-6 text-sm text-gray-600">Informe seu e-mail para receber um link e definir uma nova senha.</p>}
        <StatusToast message={message} type="success" onClose={() => setMessage('')} />
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input 
              type="email" 
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)} 
              className={inputClass} 
              required 
            />
          </div>

          {/* --- MUDANÇA 3: Bloco de senha ATUALIZADO --- */}
          {!recovering && <div>
            <label htmlFor="senha" className={labelClass}>
              Senha
            </label>
            {/* Wrapper relativo para o ícone */}
            <div className="relative mt-1">
              <input 
                type={showPassword ? 'text' : 'password'} // Tipo dinâmico
                id="senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className={`${inputClass} pr-10`} // Adiciona padding à direita
                required 
              />
              {/* Botão do "olho" */}
              <button
                type="button" // Impede o submit do formulário
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-purple-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-lg"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>}
          {/* --- FIM DA MUDANÇA --- */}

          <button 
            type="submit" 
            disabled={isLoading} 
            className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-900 disabled:opacity-50 transition-colors"
          >
            {isLoading ? (recovering ? 'Enviando...' : 'Verificando...') : (recovering ? 'Enviar link por e-mail' : 'Entrar')}
          </button>
        </form>
        <button type="button" disabled={isLoading} onClick={() => { setRecovering(!recovering); setError(''); setMessage(''); setSenha(''); }} className="mt-5 w-full rounded-md text-sm text-purple-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50">
          {recovering ? 'Voltar para o login' : 'Esqueci minha senha'}
        </button>
      </div>
    </main>
  );
}
