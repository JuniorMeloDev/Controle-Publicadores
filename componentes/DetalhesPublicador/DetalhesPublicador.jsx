'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Printer } from 'lucide-react';
import FormularioInformacoes from '@/componentes/DetalhesPublicador/FormularioInformacoes';
import AtividadesTeocraticas from '@/componentes/DetalhesPublicador/AtividadesTeocraticas';
import RelatorioImprimivel from './RelatorioImprimivel';
import HistoricoPublicador from './HistoricoPublicador'; 

// --- 1. NOVA FUNÇÃO AUXILIAR DE DATA ---
/**
 * Converte 'yyyy-mm-dd' (ou Date object) para 'dd/mm/yyyy' ou "".
 */
function isoToDMY(date) {
  if (!date) return ''; // Retorna string vazia se a data for nula
  try {
    const d = new Date(date);
    // Ajusta o fuso para evitar erro de "dia anterior"
    const dLocal = new Date(d.valueOf() + d.getTimezoneOffset() * 60000);
    const year = dLocal.getFullYear();
    // Se o ano for muito antigo, é provável que a data seja inválida
    if (year < 1900) return ''; 
    
    const month = String(dLocal.getMonth() + 1).padStart(2, '0');
    const day = String(dLocal.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  } catch (e) {
    return ''; // Retorna string vazia se a data for inválida
  }
}
// --- FIM DA FUNÇÃO ---


export default function DetalhesPublicador({ publicadorId, onSaveSuccess, onClose }) {
  // ... (states permanecem os mesmos) ...
  const [activeTab, setActiveTab] = useState('informacoes');
  const [gruposList, setGruposList] = useState([]);  
  const [formData, setFormData] = useState({
    nome_completo: '', data_nascimento: '', data_batismo: '', nome_grupo: '',
    sexo: '', esperanca: '',
    senha: '', privilegios: [], designacoes: [],
    telefone: '', email: '', cep: '', logradouro: '',
    numero: '', complemento: '', bairro: '', cidade: '', estado: ''
  });
  
  const [relatorios, setRelatorios] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  
  const numeroInputRef = useRef(null);
  const printRef = useRef(null);

  const fetchTudo = useCallback(async (isRefresh = false) => {
    if (!publicadorId) {
      setIsPageLoading(false);
      return;
    }
    
    if (isRefresh) {
      setIsLoading(true); 
    } else {
      setIsPageLoading(true);
    }
    
    setMessage('');
    setIsError(false);
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

      // --- 2. APLICA A CORREÇÃO AQUI ---
      setFormData({
        ...pubData,
        // Converte de volta para DD/MM/YYYY para o formulário
        data_nascimento: isoToDMY(pubData.data_nascimento) || '',
        data_batismo: isoToDMY(pubData.data_batismo) || '',
        // O resto dos dados
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
      // --- FIM DA CORREÇÃO ---

      const relRes = await fetch(`/api/admin/get-relatorios/${publicadorId}`);
      if (!relRes.ok) throw new Error('Falha ao buscar relatórios');
      const relData = await relRes.json();
      setRelatorios(relData);

    } catch (err) {
      console.error(err);
      setMessage('Erro ao carregar dados. ' + err.message);
      setIsError(true);
    } finally {
      setIsPageLoading(false);
      setIsLoading(false); 
    }
  }, [publicadorId]);

  // ... (Resto do arquivo: useEffect, Handlers, return()... permanece o mesmo) ...
  // useEffect de carregamento inicial
  useEffect(() => {
    if (publicadorId) {
      fetchTudo(false); // Chama com 'isRefresh = false'
    }
  }, [publicadorId, fetchTudo]);
  
  // Handlers (sem alteração)
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({ ...prevData, [name]: value }));
  };
  const handleMaskChange = (value, name) => {
    setFormData(prevData => ({ ...prevData, [name]: value }));
    if (name === 'cep') setCepError('');
  };
  const handlePrivilegioChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prevData => {
      if (checked) return { ...prevData, privilegios: [...prevData.privilegios, value] };
      return { ...prevData, privilegios: prevData.privilegios.filter(p => p !== value) };
    });
  };
  const handleDesignacaoChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prevData => {
      if (checked) return { ...prevData, designacoes: [...prevData.designacoes, value] };
      return { ...prevData, designacoes: prevData.designacoes.filter(d => d !== value) };
    });
  };
  const handleCepBlur = async () => {
    const cep = formData.cep.replace(/\D/g, ''); 
    if (cep.length !== 8) { setCepError(''); return; }
    setIsCepLoading(true);
    setCepError('');
    try {
      const response = await fetch(`/api/get-cep/${cep}`, { cache: 'no-store' }); 
      const data = await response.json();
      if (!response.ok || data.erro) throw new Error(data.message || 'CEP não encontrado.');
      setFormData(prev => ({
        ...prev, logradouro: data.logradouro, bairro: data.bairro,
        cidade: data.localidade, estado: data.uf, complemento: ''
      }));
      numeroInputRef.current?.focus();
    } catch (err) {
      setCepError(err.message);
      setFormData(prev => ({
        ...prev, logradouro: '', bairro: '', cidade: '', estado: '',
      }));
    } finally {
      setIsCepLoading(false);
    }
  };
  
  // handleSubmit (agora chama fetchTudo(true))
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true); // Usa o spinner interno
    setMessage('');
    setIsError(false);
    
    try {
      const response = await fetch(`/api/admin/update-publicador/${publicadorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData) 
      });
      
      const data = await response.json();

      if (response.ok) {
        setMessage('Publicador alterado com sucesso');
        setIsError(false);
        onSaveSuccess(true); // Mantém o drawer aberto
        fetchTudo(true); // Chama um refresh interno (spinner pequeno)
      } else {
        setMessage(data?.message || 'Erro ao salvar');
        setIsError(true);
      }
    } catch (err) {
      setMessage('Não foi possível conectar ao servidor.');
      setIsError(true);
    } finally {
      setIsLoading(false); // Desliga o spinner interno
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
        {message && (
          <div className={`p-3 rounded-md mb-6 text-sm ${isError 
            ? 'bg-red-900 bg-opacity-30 text-red-300 border border-red-800' 
            : 'bg-green-900 bg-opacity-30 text-green-300 border border-green-800'}`
          }>
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
        
        {/* Aba 1: Informações Pessoais */}
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
            isLoading={isLoading} // Passa o spinner interno
            isCepLoading={isCepLoading}
            cepError={cepError}
            numeroInputRef={numeroInputRef}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
          />
        )}

        {/* Aba 2: Atividades Teocráticas (agora chama fetchTudo(true)) */}
        {activeTab === 'atividades' && (
          <AtividadesTeocraticas 
            publicadorId={publicadorId} 
            publicadorNome={formData.nome_completo}
            relatorios={relatorios}
            publicador={formData}
            onRefreshData={() => fetchTudo(true)} 
          />
        )}

        {/* Aba 3: Histórico */}
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