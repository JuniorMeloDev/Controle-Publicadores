'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Printer } from 'lucide-react';
import FormularioInformacoes from '@/componentes/DetalhesPublicador/FormularioInformacoes';
import AtividadesTeocraticas from '@/componentes/DetalhesPublicador/AtividadesTeocraticas';
import RelatorioImprimivel from './RelatorioImprimivel';

export default function DetalhesPublicador({ publicadorId, onSaveSuccess, onClose }) {
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

  // Função de busca (sem o loop infinito)
  const fetchTudo = useCallback(async () => {
    if (!publicadorId) {
      setIsPageLoading(false);
      return;
    }
    
    // Define o loading apenas se não for uma atualização silenciosa
    if (!isPageLoading) setIsLoading(true); 
    
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

      setFormData({
        ...pubData,
        data_nascimento: pubData.data_nascimento || '',
        data_batismo: pubData.data_batismo || '',
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
      console.error(err);
      setMessage('Erro ao carregar dados. ' + err.message);
      setIsError(true);
    } finally {
      setIsPageLoading(false);
      setIsLoading(false); 
    }
  }, [publicadorId]); // Removido 'isPageLoading' da dependência

  useEffect(() => {
    setIsPageLoading(true); 
    fetchTudo();
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
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
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
        onSaveSuccess();
      } else {
        setMessage(data?.message || 'Erro ao salvar');
        setIsError(true);
      }
    } catch (err) {
      setMessage('Não foi possível conectar ao servidor.');
      setIsError(true);
    } finally {
      setIsLoading(false);
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

  // --- MUDANÇA PRINCIPAL NO LAYOUT ---
 // ... (mantenha todo o código de 'use client' até 'if (isPageLoading) { ... }')

  // --- MUDANÇA PRINCIPAL NO LAYOUT ---
  return (
    // 1. Container flex-col para travar o header e deixar o conteúdo rolar
    <div className="flex flex-col h-full overflow-hidden">
      
      {/* 2. CABEÇALHO (agora é 'shrink-0' e tem padding) */}
      <div className="shrink-0 p-6 md:p-8 pb-6 border-b border-neutral-700">
        <div className="flex items-center justify-between">

          {/* --- NOVO: Botão Voltar (Aparece só no Mobile) --- */}
          {onClose && (
            <button
              onClick={onClose}
              className="mr-4 text-neutral-400 hover:text-neutral-100 md:hidden"
              aria-label="Voltar para a lista"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            </button>
          )}

          {/* Conteúdo do Título */}
          <div className="flex-1 min-w-0"> {/* Adicionado flex-1 e min-w-0 para truncar nomes longos */}
            <h2 className="text-2xl md:text-3xl font-bold text-white truncate">
              {formData.nome_completo || 'Editar Publicador'}
            </h2>
            <p className="text-neutral-400 text-sm mt-1">
              ID do Publicador: {publicadorId}
            </p>
          </div>

          {/* Botão Imprimir (Agora esconde no mobile) */}
          <button
            onClick={handlePrint}
            className="hidden md:flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold text-neutral-100 bg-neutral-700 hover:bg-neutral-600 transition-colors ml-4"
          >
            <Printer size={18} />
            Imprimir
          </button>
        </div>
      </div>
      
      {/* 3. CONTEÚDO ROLÁVEL (wrapper de antes, mas agora funciona) */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        {/* ... (o resto do seu JSX com as abas 'Informações Pessoais' e 'Atividades Teocráticas' vai aqui) ... */}
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
            {/* ... seus botões de aba ... */}
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
          </nav>
        </div>

        {/* Conteúdo da Aba 1 */}
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

        {/* Conteúdo da Aba 2 */}
        {activeTab === 'atividades' && (
          <AtividadesTeocraticas 
            publicadorId={publicadorId} 
            publicadorNome={formData.nome_completo}
            relatorios={relatorios}
            publicador={formData}
            onRefreshData={fetchTudo}
          />
        )}
      </div>

      {/* Componente de Impressão (oculto) - Fica fora da área de rolagem */}
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