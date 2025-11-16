'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Printer, Edit, Save, AlertCircle } from 'lucide-react';
import RelatorioImprimivel from './RelatorioImprimivel';

// Define os meses
const MESES_ANO_SERVICO = [
  'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Janeiro', 'Fevereiro',
  'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto'
];

export default function AtividadesTeocraticas({ 
  publicadorId, 
  publicadorNome, 
  relatorios: relatoriosInicial,
  publicador, 
  onRefreshData
}) {
  const [activeSubTab, setActiveSubTab] = useState('relatorios');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const printRef = useRef(null); 

  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingSave, setIsLoadingSave] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const anoServico = useMemo(() => {
    return relatoriosInicial[0]?.ano_servico || 
           (new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear());
  }, [relatoriosInicial]);

  const relatoriosMap = useMemo(() => {
    return new Map(relatoriosInicial.map(rel => [rel.mes, rel]));
  }, [relatoriosInicial]);

  const [editableRelatorios, setEditableRelatorios] = useState(() => 
    MESES_ANO_SERVICO.map(mes => {
      const existente = relatoriosMap.get(mes);
      if (existente) return { ...existente };
      return {
        mes: mes,
        ano_servico: anoServico,
        participou_ministerio: false,
        pioneiro_auxiliar: false,
        estudos_biblicos: null,
        horas: null,
        observacoes: null
      };
    })
  );
  
  useEffect(() => {
    const map = new Map(relatoriosInicial.map(rel => [rel.mes, rel]));
    setEditableRelatorios(MESES_ANO_SERVICO.map(mes => {
      const existente = map.get(mes);
      if (existente) return { ...existente };
      return {
        mes: mes,
        ano_servico: anoServico,
        participou_ministerio: false,
        pioneiro_auxiliar: false,
        estudos_biblicos: null,
        horas: null,
        observacoes: null
      };
    }));
  }, [relatoriosInicial, anoServico]);

  const handleRelatorioChange = (mes, field, value) => {
    setEditableRelatorios(prevData =>
      prevData.map(row =>
        row.mes === mes ? { ...row, [field]: value } : row
      )
    );
  };

  const handleSave = async () => {
    setIsLoadingSave(true);
    setMessage({ text: '', type: '' });
    try {
      const response = await fetch('/api/admin/batch-update-relatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicadorId: publicadorId,
          relatorios: editableRelatorios
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Erro ao salvar');

      setMessage({ text: data.message, type: 'success' });
      setIsEditing(false); 
      if (onRefreshData) onRefreshData(); 

    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setIsLoadingSave(false);
    }
  };

  const handlePrint = () => {
    const el = document.querySelector('.printable-content');
    if (!el) {
      console.error('handlePrint: container imprimível não encontrado');
      return;
    }
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

            {message.text && (
              <div className={`flex items-center gap-2 p-3 rounded-md mb-4 text-sm ${
                message.type === 'error'
                  ? 'bg-red-900/30 text-red-300 border border-red-800'
                  : 'bg-green-900/30 text-green-300 border border-green-800'
              }`}>
                <AlertCircle size={16} />
                {message.text}
              </div>
            )}

            {!isLoading && !error && (
              <div className="space-y-6">

                {/* --- CORREÇÃO 3 AQUI --- */}
                {/* Adicionado 'overflow-x-auto' para criar a rolagem horizontal na tabela */}
                <div 
                  ref={printRef} 
                  className={`bg-white text-black rounded-lg border border-neutral-300 shadow-lg ${isEditing ? 'ring-2 ring-blue-500' : ''} overflow-x-auto`}
                >
                  <div className="p-4 md:p-8 min-w-[700px]"> {/* min-w-[...] garante que a tabela tenha um tamanho mínimo antes de rolar */}
                    <RelatorioImprimivel 
                      publicador={publicador || { nome_completo: publicadorNome }}
                      relatorios={editableRelatorios}
                      isEditing={isEditing}
                      onRelatorioChange={handleRelatorioChange}
                    />
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={isEditing ? handleSave : () => { setIsEditing(true); setMessage({text:'', type:''}); }}
                    disabled={isLoadingSave}
                    className={`flex items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-colors ${
                      isEditing 
                        ? 'bg-green-600 hover:bg-green-500 disabled:opacity-50'
                        : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                  >
                    {isEditing ? (
                      isLoadingSave ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />
                    ) : (
                      <Edit size={18} />
                    )}
                    {isLoadingSave ? 'Salvando...' : (isEditing ? 'Salvar Relatório' : 'Editar Relatório')}
                  </button>

                  <button
                    onClick={handlePrint}
                    disabled={isEditing}
                    className="flex items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-neutral-600 hover:bg-neutral-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Printer size={18} />
                    Imprimir Registro
                  </button>
                  
                  <button
                    onClick={() => {
                      window.location.href = `/relatorio-mensal?publicadorId=${publicadorId}`
                    }}
                    disabled={isEditing}
                    className="flex items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-neutral-800 bg-yellow-400 hover:bg-yellow-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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