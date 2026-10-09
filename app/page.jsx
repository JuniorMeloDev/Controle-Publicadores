// app/page.jsx

'use client'; 

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

  // --- Classes do Tailwind (sem mudança) ---
  const labelClass = "block text-sm font-medium text-neutral-300";
  const inputClass = "mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 placeholder-neutral-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50";

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-900 p-8 rounded-xl shadow-2xl border border-neutral-800">
        <h2 className="text-3xl font-bold text-center mb-6 text-white">
          {recovering ? 'Recuperar senha' : 'Acesso Restrito'}
        </h2>
        
        {error && (
          <div className="p-3 rounded-md mb-4 bg-red-900 bg-opacity-30 text-red-300 border border-red-800 text-sm">
            {error}
          </div>
        )}

        {recovering && <p className="mb-6 text-sm text-neutral-300">Informe seu e-mail para receber um link e definir uma nova senha.</p>}
        {message && <p role="status" className="mb-4 rounded-md border border-green-800 bg-green-950 p-3 text-sm text-green-300">{message}</p>}
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
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-100"
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
            className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 transition-colors"
          >
            {isLoading ? (recovering ? 'Enviando...' : 'Verificando...') : (recovering ? 'Enviar link por e-mail' : 'Entrar')}
          </button>
        </form>
        <button type="button" disabled={isLoading} onClick={() => { setRecovering(!recovering); setError(''); setMessage(''); setSenha(''); }} className="mt-5 w-full text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50">
          {recovering ? 'Voltar para o login' : 'Esqueci minha senha'}
        </button>
      </div>
    </main>
  );
}
