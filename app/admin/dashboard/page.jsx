'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Dashboard() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
      router.push('/');
    } catch (err) {
      console.error('Erro ao fazer logout', err);
      // Removido o alert()
      setIsLoggingOut(false);
    }
  };

  return (
    <main className="min-h-screen w-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-neutral-900 p-6 md:p-8 rounded-xl shadow-2xl border border-neutral-800">
        
        <div className="flex justify-between items-center mb-6 border-b border-neutral-700 pb-4">
          <h1 className="text-3xl font-bold text-white">
            Painel de Controle
          </h1>
          <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="py-2 px-4 rounded-lg text-sm font-semibold text-neutral-100 bg-red-600 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 transition-colors"
          >
            {isLoggingOut ? 'Saindo...' : 'Sair'}
          </button>
        </div>

        <p className="text-neutral-300 mb-6">
          Bem-vindo à área administrativa.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* --- CARD GERENCIAR PUBLICADORES --- */}
          <Link 
            href="/admin/gerenciar"
            className="block p-6 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors shadow-lg"
          >
            <h2 className="text-xl font-semibold text-white mb-2">
              Gerenciar Publicadores
            </h2>
            <p className="text-neutral-400">
              Visualizar, editar e adicionar novos publicadores ao sistema.
            </p>
          </Link>

          {/* --- NOVO CARD ADICIONADO --- */}
          <Link 
            href="/admin/designacoes"
            className="block p-6 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors shadow-lg"
          >
            <h2 className="text-xl font-semibold text-white mb-2">
              Designações da Reunião
            </h2>
            <p className="text-neutral-400">
              Criar o programa da reunião importando o .RTF da semana.
            </p>
          </Link>
          {/* --- FIM DO NOVO CARD --- */}

          {/* Card de Exemplo Futuro */}
          <div className="block p-6 bg-neutral-800 border border-neutral-700 rounded-lg opacity-50 cursor-not-allowed">
            <h2 className="text-xl font-semibold text-white mb-2">Ver Relatórios (Em breve)</h2>
            <p className="text-neutral-400">
              Visualizar e filtrar todos os relatórios mensais enviados.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}