'use client';
import { useState, useEffect, useMemo } from 'react';
import { Loader2, Printer, Edit, Save, AlertCircle } from 'lucide-react';
import RelatorioImprimivel from './RelatorioImprimivel';
import { Button } from '@/app/components/ui/button';

const MESES_ANO_SERVICO = [
  'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Janeiro', 'Fevereiro',
  'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto'
];

const getCurrentServiceYear = () => {
  const data = new Date();
  return data.getMonth() >= 8 ? data.getFullYear() + 1 : data.getFullYear();
};

export default function AtividadesTeocraticas({ 
  publicadorId, 
  publicadorNome, 
  relatorios: relatoriosInicial, 
  publicador, 
  onRefreshData
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedYear, setSelectedYear] = useState(null); 
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingSave, setIsLoadingSave] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const { reportsByYear, availableYears } = useMemo(() => {
    const grouped = (relatoriosInicial || []).reduce((acc, rel) => {
      const year = rel.ano_servico;
      if (!acc[year]) acc[year] = [];
      acc[year].push(rel);
      return acc;
    }, {});
    
    const years = Object.keys(grouped).map(Number).sort((a, b) => b - a);
    const currentYear = getCurrentServiceYear();
    if (years.length === 0 || !years.includes(currentYear)) {
      years.unshift(currentYear);
    }
    return { reportsByYear: grouped, availableYears: years };
  }, [relatoriosInicial]);

  useEffect(() => {
    if (!selectedYear && availableYears.length > 0) {
      setSelectedYear(availableYears[0]); 
    }
  }, [availableYears, selectedYear]);

  const [editableRelatorios, setEditableRelatorios] = useState([]);
  
  useEffect(() => {
    if (!selectedYear) {
      setEditableRelatorios([]);
      return;
    }
    const map = new Map((reportsByYear[selectedYear] || []).map(rel => [rel.mes, rel]));
    setEditableRelatorios(MESES_ANO_SERVICO.map(mes => {
      const existente = map.get(mes);
      if (existente) return { ...existente };
      return {
        mes: mes,
        ano_servico: selectedYear,
        participou_ministerio: false,
        pioneiro_auxiliar: false,
        estudos_biblicos: null,
        horas: null,
        observacoes: null
      };
    }));
    setIsEditing(false);
    setMessage({ text: '', type: '' });

  }, [selectedYear, reportsByYear]);

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

  // CORREÇÃO DO PRINT: Chama o print do navegador. O CSS global ou a div oculta abaixo cuidará do resto.
  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="mt-6">
      
      {/* Mensagens */}
      {message.text && (
        <div className={`flex items-center gap-2 p-3 rounded-md mb-4 text-sm ${
          message.type === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          <AlertCircle size={16} />
          {message.text}
        </div>
      )}

      {/* SELETOR DE ANO */}
      <div className="mb-6 flex items-center gap-3">
        <label htmlFor="service-year-select" className="text-sm font-medium text-gray-700">
          Ano de Serviço:
        </label>
        <select
          id="service-year-select"
          value={selectedYear || ''}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          {availableYears.map(year => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        {/* BOTÕES DE AÇÃO */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={isEditing ? handleSave : () => { setIsEditing(true); setMessage({text:'', type:''}); }}
              disabled={isLoadingSave}
              className={`
                 ${isEditing ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}
                 text-white shadow-md transition-all
              `}
            >
              {isEditing ? (
                isLoadingSave ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />
              ) : (
                <Edit className="w-4 h-4 mr-2" />
              )}
              {isLoadingSave ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Editar Relatório')}
            </Button>
          </div>
      </div>
      

      {/* CONTEÚDO DO ANO SELECIONADO */}
      {selectedYear && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* VISUALIZAÇÃO DA TABELA (CARD) */}
          <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${isEditing ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}>
            <div className="p-1 overflow-x-auto">
               {/* Reutilizamos o componente de impressão para visualização na tela também.
                   Ele renderiza a tabela formatada.
               */}
               <div className="min-w-[700px] p-4">
                  <RelatorioImprimivel 
                    publicador={publicador || { nome_completo: publicadorNome }}
                    relatorios={editableRelatorios} 
                    anoServico={selectedYear} 
                    isEditing={isEditing}
                    onRelatorioChange={handleRelatorioChange}
                  />
               </div>
            </div>
          </div>

          

          {/* --- ÁREA ESPECÍFICA DE IMPRESSÃO DESTE COMPONENTE --- */}
          {/* O CSS global oculta tudo com .no-print e mostra .print-block.
             Aqui criamos um container que SÓ aparece na impressão para garantir que
             o que o usuário vê (o ano selecionado) é o que sai no papel.
          */}
          <div className="hidden print:block print:absolute print:top-0 print:left-0 print:w-full print:bg-white print:z-50">
             <RelatorioImprimivel 
                publicador={publicador || { nome_completo: publicadorNome }}
                relatorios={editableRelatorios} 
                anoServico={selectedYear} 
                isEditing={false}
             />
          </div>

        </div>
      )}
    </div>
  );
}