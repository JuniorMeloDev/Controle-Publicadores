'use client'; 

import { useState } from 'react';
import { useRouter } from 'next/navigation'; 

export default function LoginPage() {
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState(''); // <-- MUDOU DE dataNascimento PARA senha
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter(); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login', { // <-- Vamos criar este arquivo
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nome_completo: nome, 
          senha: senha // <-- MUDOU
        }),
      });

      if (response.ok) {
        // Sucesso! O backend vai criar um cookie e nós redirecionamos
        router.push('/admin/dashboard'); // Redireciona para o painel de admin
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

  // --- Classes do Tailwind ---
  const labelClass = "block text-sm font-medium text-gray-700";
  const inputClass = "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500";

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg">
        <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">
          Acesso Restrito
        </h2>
        
        {error && (
          <div className="p-3 rounded-md mb-4 bg-red-100 text-red-800 text-sm">
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

          {/* --- CAMPO DE SENHA ATUALIZADO --- */}
          <div>
            <label htmlFor="senha" className={labelClass}>
              Senha
            </label>
            <input 
              type="password" // <-- MUDOU PARA 'password'
              id="senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={inputClass} 
              required 
            />
          </div>
          {/* --- FIM DA MUDANÇA --- */}

          <button 
            type="submit" 
            disabled={isLoading} 
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}