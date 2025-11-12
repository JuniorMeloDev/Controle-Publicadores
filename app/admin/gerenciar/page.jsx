'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, User, ShieldCheck, Star } from 'lucide-react';

export default function GerenciarPublicadores() {
  const [publicadores, setPublicadores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPublicadores = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/admin/get-publicadores');
        if (!response.ok) throw new Error('Falha ao carregar publicadores.');
        const data = await response.json();
        setPublicadores(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPublicadores();
  }, []);

  return (
    <main className="min-h-screen w-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-neutral-900 p-6 md:p-8 rounded-xl shadow-2xl border border-neutral-800">

        <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-700">
          <div className="flex items-center gap-4">
            <Link 
              href="/admin/dashboard" 
              className="flex items-center justify-center size-9 rounded-lg text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition-colors"
              aria-label="Voltar ao Dashboard"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-3xl font-bold text-white">
              Gerenciar Publicadores
            </h1>
          </div>
          <Link 
            href="/admin/cadastrar" 
            className="flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900 transition-colors"
          >
            <Plus size={16} />
            Novo Publicador
          </Link>
        </div>
        
        {isLoading && <p className="text-center text-neutral-400">Carregando...</p>}
        {error && <p className="text-center text-red-400">{error}</p>}

        {/* --- LISTA ATUALIZADA COM LINKS --- */}
        <div className="space-y-3">
          {!isLoading && !error && publicadores.map(pub => (
            // MUDANÇA AQUI: O <div> agora é um <Link>
            <Link 
              href={`/admin/editar/${pub.id}`} // Link para a página de edição
              key={pub.id} 
              className="flex items-center justify-between p-4 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors cursor-pointer" // Adicionado hover e cursor
            >
              <div className="flex items-center gap-4">
                <User className="size-5 text-neutral-400" />
                <div>
                  <h2 className="text-lg font-semibold text-white">{pub.nome_completo}</h2>
                  <p className="text-sm text-neutral-400">{pub.nome_grupo || 'Sem grupo'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {pub.privilegios?.includes('anciao') && (
                  <span className="flex items-center gap-1.5 text-xs font.medium text-blue-300 bg-blue-900 bg-opacity-50 px-2 py-0.5 rounded-full">
                    <ShieldCheck size={12} />
                    Ancião
                  </span>
                )}
                {pub.designacoes?.includes('pioneiro_regular') && (
                  <span className="flex items-center gap-1.5 text-xs font.medium text-green-300 bg-green-900 bg-opacity-50 px-2 py-0.5 rounded-full">
                    <Star size={12} />
                    Pioneiro
                  </span>
                )}
                {/* Adicione outras tags se desejar */}
              </div>
            </Link>
          ))}
        </div>

      </div>
    </main>
  );
}