'use client';
import { useState, useEffect, useRef } from 'react';
import { Loader2, Printer } from 'lucide-react';
import RelatorioImprimivel from './RelatorioImprimivel';

export default function AtividadesTeocraticas({ publicadorId, publicadorNome, relatorios: relatoriosInicial, publicador }) {
  const [activeSubTab, setActiveSubTab] = useState('relatorios');
  const [relatorios, setRelatorios] = useState(relatoriosInicial || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const printRef = useRef(null);

  useEffect(() => {
    if (!publicadorId || relatoriosInicial) return;
    
    const fetchRelatorios = async () => {
      setIsLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/get-relatorios/${publicadorId}`);
        if (!res.ok) throw new Error('Falha ao buscar relatórios');
        const data = await res.json();
        setRelatorios(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRelatorios();
  }, [publicadorId, relatoriosInicial]);

  // Função de impressão
 const handlePrint = () => {
    const el = document.querySelector('.printable-content');
    if (!el) {
      console.error('handlePrint: container imprimível não encontrado');
      return;
    }

    // garante que o DOM esteja atualizado antes de abrir o diálogo de impressão
    // (pequeno delay ajuda em casos de render assíncrona)
    setTimeout(() => {
      window.focus();
      window.print();
    }, 100);
  };

  return (
    <div className="mt-6">
      <div className="border-b border-neutral-700">
        <nav className="-mb-px flex space-x-4" aria-label="Abas">
          <button
            onClick={() => setActiveSubTab('relatorios')}
            className={`
              ${activeSubTab === 'relatorios' 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-neutral-400 hover:border-neutral-500 hover:text-neutral-300'}
              whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
            `}
          >
            Relatório de Serviço de Campo
          </button>
        </nav>
      </div>

      <div className="mt-6">
        {activeSubTab === 'relatorios' && (
          <div>
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-neutral-400" />
              </div>
            )}
            
            {error && (
              <div className="p-4 bg-red-900/30 text-red-300 border border-red-800 rounded-lg">
                {error}
              </div>
            )}
            
            {!isLoading && !error && relatorios.length === 0 && (
              <div className="p-6 bg-neutral-800/50 border border-neutral-700 rounded-lg text-center">
                <p className="text-neutral-400 italic">Nenhum relatório de serviço encontrado.</p>
              </div>
            )}

            {!isLoading && !error && relatorios.length > 0 && (
              <div className="space-y-6">
                {/* Exibe o relatório imprimível */}
                <div className="bg-white text-black rounded-lg border border-neutral-300 overflow-hidden shadow-lg">
                  <div ref={printRef} className="p-8">
                    <RelatorioImprimivel 
                      publicador={publicador || {
                        nome_completo: publicadorNome,
                        data_nascimento: '',
                        data_batismo: '',
                        privilegios: [],
                        designacoes: []
                      }}
                      relatorios={relatorios} 
                    />
                  </div>
                </div>

                {/* Botão de Impressão */}
                <div className="flex justify-center gap-3">
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                  >
                    <Printer size={18} />
                    Imprimir Registro de Publicador
                  </button>
                  
                  <button
                    onClick={() => {
                      window.location.href = `/relatorio-mensal?publicadorId=${publicadorId}`
                    }}
                    className="flex items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-500 transition-colors"
                  >
                    Enviar Relatório Manual
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}