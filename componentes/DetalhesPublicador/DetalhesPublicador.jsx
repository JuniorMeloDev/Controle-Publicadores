'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Printer } from 'lucide-react';
import FormularioInformacoes from '@/componentes/DetalhesPublicador/FormularioInformacoes';
import AtividadesTeocráticas from '@/componentes/DetalhesPublicador/AtividadesTeocraticas';
import RelatorioImprimivel from './RelatorioImprimivel';
import HistoricoPublicador from './HistoricoPublicador'; 

// --- FUNÇÃO AUXILIAR DE DATA ATUALIZADA ---
/**
 * Tenta formatar a data para DD/MM/YYYY, mas preserva a string DD/MM/YYYY se já existir (dados legados).
 */
function formatDateForForm(date) {
  if (!date) return ''; 
  const dateString = String(date).trim();
  
  // 1. CHECA FORMATO LEGADO (DD/MM/YYYY) - Retorna a string original, pois a máscara aceita.
  if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    return dateString;
  }
  
  // 2. PROCESSA FORMATO NOVO (YYYY-MM-DD ou objeto Date)
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return ''; // Se não for uma data válida, retorna vazio.
    
    // Timezone adjustment para garantir que a data não volte um dia.
    const dLocal = new Date(d.valueOf() + d.getTimezoneOffset() * 60000);

    const year = dLocal.getFullYear();
    const month = String(dLocal.getMonth() + 1).padStart(2, '0');
    const day = String(dLocal.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  } catch (e) {
    return ''; 
  }
}
// --- FIM DA FUNÇÃO ---


export default function DetalhesPublicador({ 
    publicadorId, onSaveSuccess, onClose,
    persistedMessage, 
    persistedError, 
    onMessageDismiss 
}) {
  // --- LOG: Renderização do Componente ---
  console.log(`[R] DetalhesPublicador Render: ID ${publicadorId}. Mensagem Persistida: ${persistedMessage}`);

  const [activeTab, setActiveTab] = useState('informacoes');
  const [gruposList, setGruposList] = useState([]);  
  const [formData, setFormData] = useState({
    nome_completo: '', nome_chamado: '',
    data_nascimento: '', data_batismo: '', nome_grupo: '',
    sexo: '', esperanca: '',
    senha: '', privilegios: [], designacoes: [],
    telefone: '', email: '', cep: '', logradouro: '',
    numero: '', complemento: '', bairro: '', cidade: '', estado: ''
  });
  
  const [relatorios, setRelatorios] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  
  const [showPassword, setShowPassword] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  
  const numeroInputRef = useRef(null);
  const printRef = useRef(null);
  
  const message = persistedMessage;
  const isError = persistedError;


  // --- FUNÇÃO DE BUSCA ATUALIZADA ---
  const fetchTudo = useCallback(async (isRefresh = false) => {
    console.log(`[LOG] fetchTudo - Chamado para ID ${publicadorId}, isRefresh: ${isRefresh}`);

    if (!publicadorId) {
      setIsPageLoading(false);
      return;
    }
    
    if (isRefresh) {
      setIsLoading(true); 
    } else {
      setIsPageLoading(true);
    }
    
    try {
      const [gruposRes, pubRes] = await Promise.all([
        fetch('/api/get-grupos'),
        fetch(`/api/admin/get-publicador/${publicadorId}`)
      ]);
      
      if (!gruposRes.ok) throw new Error('Falha ao carregar grupos.');
      const gruposData = await gruposRes.json();
      setGruposList(gruposData);

      if (!pubRes.ok) throw new Error('Falha ao carregar dados do publicador.');
      const pubData = await pubRes.json();

      setFormData({
        ...pubData,
        // --- APLICANDO NOVA FUNÇÃO ---
        data_nascimento: formatDateForForm(pubData.data_nascimento) || '',
        data_batismo: formatDateForForm(pubData.data_batismo) || '',
        // --- FIM DA APLICAÇÃO ---
        nome_chamado: pubData.nome_chamado || '',
        sexo: pubData.sexo || '',
        esperanca: pubData.esperanca || '',
        telefone: pubData.telefone || '',
        email: pubData.email || '',
        cep: pubData.cep || '',
        logradouro: pubData.logradouro || '',
        numero: pubData.numero || '',
        complemento: pubData.complemento || '',
        bairro: pubData.bairro || '',
        cidade: pubData.cidade || '',
        estado: pubData.estado || '',
        senha: '', 
        privilegios: pubData.privilegios || [],
        designacoes: pubData.designacoes || [],
      });

      const relRes = await fetch(`/api/admin/get-relatorios/${publicadorId}`);
      if (!relRes.ok) throw new Error('Falha ao buscar relatórios');
      const relData = await relRes.json();
      setRelatorios(relData);

    } catch (err) {
      console.error(`[ERRO] fetchTudo - Falha ao carregar dados: ${err.message}`);
      onSaveSuccess({ 
          message: 'Erro ao recarregar dados: ' + err.message, 
          isError: true, 
          keepOpen: true
      });
    } finally {
      console.log("[LOG] fetchTudo - Finalizado.");
      setIsPageLoading(false);
      setIsLoading(false); 
    }
  }, [publicadorId, onSaveSuccess]);

  // useEffect de carregamento inicial
  useEffect(() => {
    console.log(`[UE] DetalhesPublicador - Executando useEffect para ID ${publicadorId}`);
    
    if (publicadorId) {
      fetchTudo(false);
    }
  }, [publicadorId, fetchTudo]);
  
  // Handlers (a maioria chama onMessageDismiss)
  const handleCepBlur = async () => {
    // ... (lógica de CEP) ...
    if (message) onMessageDismiss(); 
    // ... (rest of the logic) ...
  };
  const handleChange = (e) => {
    if (message) onMessageDismiss(); 
    const { name, value } = e.target;
    setFormData(prevData => ({ ...prevData, [name]: value }));
  };
  const handleMaskChange = (value, name) => {
    if (message) onMessageDismiss(); 
    setFormData(prevData => ({ ...prevData, [name]: value }));
    if (name === 'cep') setCepError('');
  };
  const handlePrivilegioChange = (e) => {
    if (message) onMessageDismiss(); 
    const { value, checked } = e.target;
    setFormData(prevData => {
      if (checked) return { ...prevData, privilegios: [...prevData.privilegios, value] };
      return { ...prevData, privilegios: prevData.privilegios.filter(p => p !== value) };
    });
  };
  const handleDesignacaoChange = (e) => {
    if (message) onMessageDismiss(); 
    const { value, checked } = e.target;
    setFormData(prevData => {
      if (checked) return { ...prevData, designacoes: [...prevData.designacoes, value] };
      return { ...prevData, designacoes: prevData.designacoes.filter(d => d !== value) };
    });
  };
  
  // --- FUNÇÃO handleSubmit (comunicação com o pai) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("[LOG] handleSubmit - Iniciado.");
    setIsLoading(true);
    onMessageDismiss();
    
    try {
      const response = await fetch(`/api/admin/update-publicador/${publicadorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData) 
      });
      
      const data = await response.json();
      console.log("[LOG] handleSubmit - Resposta da API:", response.status, data);

      if (response.ok) {
        await fetchTudo(true); 
        
        onSaveSuccess({ 
            message: 'Publicador alterado com sucesso', 
            isError: false, 
            keepOpen: true 
        });
        
      } else {
        onSaveSuccess({ 
            message: data?.message || 'Erro ao salvar', 
            isError: true, 
            keepOpen: true 
        });
      }
    } catch (err) {
      onSaveSuccess({ 
          message: 'Não foi possível conectar ao servidor.', 
          isError: true, 
          keepOpen: true 
      });
    } finally {
      setIsLoading(false);
      console.log("[LOG] handleSubmit - Finalizado. isLoading: false");
    }
  };
  // --- FIM DA FUNÇÃO ---

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

  // Loading da página inteira
  if (isPageLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 h-full">
        <Loader2 className="size-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      
      {/* CABEÇALHO */}
      <div className="shrink-0 p-6 md:p-8 pb-6 border-b border-neutral-700">
        <div className="flex items-center justify-between">
          {onClose && (
            <button
              onClick={onClose}
              className="mr-4 text-neutral-400 hover:text-neutral-100 md:hidden"
              aria-label="Voltar para a lista"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            </button>
          )}

          <div className="flex-1 min-w-0">
            <h2 className="text-2xl md:text-3xl font-bold text-white truncate">
              {formData.nome_completo || 'Editar Publicador'}
            </h2>
            <p className="text-neutral-400 text-sm mt-1">
              ID do Publicador: {publicadorId}
            </p>
          </div>

          <button
            onClick={handlePrint}
            className="hidden md:flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold text-neutral-100 bg-neutral-700 hover:bg-neutral-600 transition-colors ml-4"
          >
            <Printer size={18} />
            Imprimir
          </button>
        </div>
      </div>
      
      {/* CONTEÚDO ROLÁVEL */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        {/* EXIBIÇÃO DA MENSAGEM */}
        {message && (
          <div 
            className={`p-3 rounded-md mb-6 text-sm ${isError 
              ? 'bg-red-900 bg-opacity-30 text-red-300 border border-red-800' 
              : 'bg-green-900 bg-opacity-30 text-green-300 border border-green-800'}`
            }
            onClick={onMessageDismiss}
          >
            {message}
          </div>
        )}

        {/* Navegação das Abas */}
        <div className="border-b border-neutral-700">
          <nav className="-mb-px flex space-x-6" aria-label="Abas">
            
            <button
              onClick={() => setActiveTab('informacoes')}
              className={`${activeTab === 'informacoes' 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-neutral-400 hover:border-neutral-500 hover:text-neutral-300'}
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Informações Pessoais
            </button>
            
            <button
              onClick={() => setActiveTab('atividades')}
              className={`${activeTab === 'atividades' 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-neutral-400 hover:border-neutral-500 hover:text-neutral-300'}
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Atividades Teocráticas
            </button>

            <button
              onClick={() => setActiveTab('historico')}
              className={`${activeTab === 'historico' 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-neutral-400 hover:border-neutral-500 hover:text-neutral-300'}
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Linha do Tempo
            </button>

          </nav>
        </div>
        
        {/* Conteúdo das Abas */}
        {activeTab === 'informacoes' && (
          <FormularioInformacoes
            formData={formData}
            setFormData={setFormData}
            handleSubmit={handleSubmit}
            handleChange={handleChange}
            handleMaskChange={handleMaskChange}
            handlePrivilegioChange={handlePrivilegioChange}
            handleDesignacaoChange={handleDesignacaoChange}
            handleCepBlur={handleCepBlur}
            gruposList={gruposList}
            isLoading={isLoading}
            isCepLoading={isCepLoading}
            cepError={cepError}
            numeroInputRef={numeroInputRef}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
          />
        )}

        {activeTab === 'atividades' && (
          <AtividadesTeocráticas 
            publicadorId={publicadorId} 
            publicadorNome={formData.nome_completo}
            relatorios={relatorios}
            publicador={formData}
            onRefreshData={() => fetchTudo(true)}
          />
        )}

        {activeTab === 'historico' && (
          <HistoricoPublicador 
            publicadorId={publicadorId}
          />
        )}

      </div>

      {/* Componente de Impressão (oculto) */}
      <div className="printable-content">
        <div ref={printRef}>
          <RelatorioImprimivel 
            publicador={formData} 
            relatorios={relatorios} 
            isEditing={false}
          />
        </div>
      </div>
    </div>
  );
}