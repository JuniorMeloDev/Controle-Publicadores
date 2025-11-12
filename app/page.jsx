'use client'; 

import { useState } from 'react';
import { useRouter } from 'next/navigation'; 
import { Eye, EyeOff } from 'lucide-react'; 

export default function LoginPage() {
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // --- MUDANÇA 2: Adiciona o state para o "olho" ---
  const [showPassword, setShowPassword] = useState(false);
  
  const router = useRouter(); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nome_completo: nome, 
          senha: senha 
        }),
      });

      if (response.ok) {
        // Redireciona para o dashboard após login (o middleware vai pegar)
        router.push('/admin/dashboard'); 
      } else {
        const data = await response.json();
        setError(data.message || 'Nome de usuário ou senha inválidos.');
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
          Acesso Restrito
        </h2>
        
        {error && (
          <div className="p-3 rounded-md mb-4 bg-red-900 bg-opacity-30 text-red-300 border border-red-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label htmlFor="nome_completo" className={labelClass}>
              Nome de Usuário (Nome Completo)
            </label>
            <input 
              type="text" 
              id="nome_completo" 
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={inputClass} 
              required 
            />
          </div>

          {/* --- MUDANÇA 3: Bloco de senha ATUALIZADO --- */}
          <div>
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
          </div>
          {/* --- FIM DA MUDANÇA --- */}

          <button 
            type="submit" 
            disabled={isLoading} 
            className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}