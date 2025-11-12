'use client';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function AtividadesTeocraticas({ publicadorId, publicadorNome }) {
  const [activeSubTab, setActiveSubTab] = useState('relatorios');
  const [relatorios, setRelatorios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!publicadorId) return;
    
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
  }, [publicadorId]); // Recarrega se o ID do publicador mudar

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

      <div className="mt-4">
        {activeSubTab === 'relatorios' && (
          <div>
            {isLoading && <Loader2 className="size-6 animate-spin text-neutral-400" />}
            {error && <p className="text-red-400">{error}</p>}
            
            {!isLoading && !error && relatorios.length === 0 && (
              <p className="text-neutral-500 italic">Nenhum relatório de serviço encontrado.</p>
            )}

            {!isLoading && !error && relatorios.length > 0 && (
              <div className="flow-root">
                <ul role="list" className="-mb-8">
                  {relatorios.map((relatorio, relatorioIdx) => (
                    <li key={relatorio.id}>
                      <div className="relative pb-8">
                        {relatorioIdx !== relatorios.length - 1 ? (
                          <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-neutral-700" aria-hidden="true" />
                        ) : null}
                        
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full bg-neutral-700 flex items-center justify-center ring-8 ring-neutral-900">
                              <svg className="h-5 w-5 text-neutral-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.59l-2.1-2.1a.75.75 0 00-1.06 1.06l3.5 3.5a.75.75 0 001.06 0l3.5-3.5a.75.75 0 10-1.06-1.06l-2.1 2.1V6.75z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col justify-center space-y-1 pt-1.5">
                            <div>
                              <p className="text-sm text-neutral-300">
                                Relatório de <span className="font-medium text-white">{relatorio.mes} {relatorio.ano_servico}</span>
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
                              {relatorio.pioneiro_auxiliar && (
                                <span className="bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">Pioneiro Auxiliar</span>
                              )}
                              {relatorio.horas > 0 && (
                                <span><span className="font-medium">{relatorio.horas}</span> horas</span>
                              )}
                              <span><span className="font-medium">{relatorio.estudos_biblicos || 0}</span> estudos</span>
                            </div>
                            {/* Incluindo as observações */}
                            {relatorio.observacoes && (
                              <p className="text-sm text-neutral-500 italic mt-1">
                                &ldquo;{relatorio.observacoes}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}