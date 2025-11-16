'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Printer, Edit, Save, AlertCircle, Calendar, ChevronLeft } from 'lucide-react';
import RelatorioImprimivel from './RelatorioImprimivel';

// Define os meses
const MESES_ANO_SERVICO = [
  'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Janeiro', 'Fevereiro',
  'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto'
];

// Função para obter o ano de serviço atual
const getCurrentServiceYear = () => {
  const data = new Date();
  // O ano de serviço começa em Setembro (mês 8)
  return data.getMonth() >= 8 ? data.getFullYear() + 1 : data.getFullYear();
};

export default function AtividadesTeocraticas({ 
  publicadorId, 
  publicadorNome, 
  relatorios: relatoriosInicial, // Esta é a lista COMPLETA de relatórios
  publicador, 
  onRefreshData
}) {
  const [activeSubTab, setActiveSubTab] = useState('relatorios');
  const [isLoading, setIsLoading] = useState(false); // Loading inicial da aba
  const [error, setError] = useState('');
  const printRef = useRef(null); 

  // --- STATES PARA GERENCIAR OS ANOS ---
  const [selectedYear, setSelectedYear] = useState(null); // Ano selecionado (ex: 2025)
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingSave, setIsLoadingSave] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // 1. Agrupa todos os relatórios por ano de serviço
  const { reportsByYear, availableYears } = useMemo(() => {
    const grouped = (relatoriosInicial || []).reduce((acc, rel) => {
      const year = rel.ano_servico;
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(rel);
      return acc;
    }, {});
    
    // Pega os anos disponíveis e ordena do mais novo para o mais antigo
    const years = Object.keys(grouped).map(Number).sort((a, b) => b - a);

    // Garante que o ano de serviço atual esteja na lista, mesmo se não tiver relatórios
    const currentYear = getCurrentServiceYear();
    if (years.length === 0 || !years.includes(currentYear)) {
      years.unshift(currentYear);
    }
    
    return { reportsByYear: grouped, availableYears: years };
  }, [relatoriosInicial]);

  // 2. Define o ano selecionado como o mais recente na primeira vez
  useEffect(() => {
    if (!selectedYear && availableYears.length > 0) {
      setSelectedYear(availableYears[0]); // Seleciona o ano mais recente por padrão
    }
  }, [availableYears, selectedYear]);

  // 3. O estado dos relatórios editáveis agora depende do ano selecionado
  const [editableRelatorios, setEditableRelatorios] = useState([]);
  
  // 4. Efeito que atualiza os relatórios editáveis QUANDO o ano selecionado muda
  useEffect(() => {
    if (!selectedYear) {
      setEditableRelatorios([]);
      return;
    }

    const map = new Map((reportsByYear[selectedYear] || []).map(rel => [rel.mes, rel]));
    
    setEditableRelatorios(MESES_ANO_SERVICO.map(mes => {
      const existente = map.get(mes);
      if (existente) return { ...existente };
      // Cria um registro padrão para um mês em branco
      return {
        mes: mes,
        ano_servico: selectedYear, // Usa o ano selecionado
        participou_ministerio: false,
        pioneiro_auxiliar: false,
        estudos_biblicos: null,
        horas: null,
        observacoes: null
      };
    }));
    // Reseta o modo de edição ao trocar de ano
    setIsEditing(false);
    setMessage({ text: '', type: '' });

  }, [selectedYear, reportsByYear]);

  // Função chamada pelo RelatorioImprimivel
  const handleRelatorioChange = (mes, field, value) => {
    setEditableRelatorios(prevData =>
      prevData.map(row =>
        row.mes === mes ? { ...row, [field]: value } : row
      )
    );
  };

  // Função Salvar
  const handleSave = async () => {
    setIsLoadingSave(true);
    setMessage({ text: '', type: '' });
    try {
      const response = await fetch('/api/admin/batch-update-relatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicadorId: publicadorId,
          relatorios: editableRelatorios // Envia apenas os 12 meses do ano selecionado
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Erro ao salvar');

      setMessage({ text: data.message, type: 'success' });
      setIsEditing(false); 
      if (onRefreshData) onRefreshData(); // Recarrega os dados no componente pai

    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setIsLoadingSave(false);
    }
  };

  // Função de impressão
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
      {/* Navegação da Sub-Aba (Relatórios) */}
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

      {/* Conteúdo da Sub-Aba */}
      <div className="mt-6">
        {activeSubTab === 'relatorios' && (
          <div>
            {/* Mensagens de Loading e Erro Iniciais */}
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

            {/* Mensagem de Salvar (Sucesso ou Erro) */}
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

            {/* --- SELETOR DE ANO DE SERVIÇO --- */}
            <div className="mb-4">
              <label htmlFor="service-year-select" className="block text-xs font-medium text-neutral-400 mb-1">
                Selecione o Ano de Serviço
              </label>
              <select
                id="service-year-select"
                value={selectedYear || ''}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full max-w-xs rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>
                    Ano de Serviço {year}
                  </option>
                ))}
              </select>
            </div>

            {/* --- CONTEÚDO DO ANO SELECIONADO --- */}
            {selectedYear && (
              <div className="space-y-6">
                <div 
                  ref={printRef} 
                  className={`bg-white text-black rounded-lg border border-neutral-300 shadow-lg ${isEditing ? 'ring-2 ring-blue-500' : ''} overflow-x-auto`}
                >
                  <div className="p-4 md:p-8 min-w-[700px]">
                    <RelatorioImprimivel 
                      publicador={publicador || { nome_completo: publicadorNome }}
                      relatorios={editableRelatorios} // Passa os 12 meses do ano selecionado
                      anoServico={selectedYear} // Passa o ano selecionado
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
                </div>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
}