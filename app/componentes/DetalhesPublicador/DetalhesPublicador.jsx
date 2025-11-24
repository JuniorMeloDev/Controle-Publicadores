'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Printer, X, Lock } from 'lucide-react';
import FormularioInformacoes from '@/app/componentes/DetalhesPublicador/FormularioInformacoes';
import AtividadesTeocraticas from '@/app/componentes/DetalhesPublicador/AtividadesTeocraticas';
import RelatorioImprimivel from './RelatorioImprimivel';
import HistoricoPublicador from './HistoricoPublicador'; 

function formatDateForForm(date) {
  if (!date) return ''; 
  const dateString = String(date).trim();
  if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) return dateString;
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return ''; 
    const dLocal = new Date(d.valueOf() + d.getTimezoneOffset() * 60000);
    const year = dLocal.getFullYear();
    const month = String(dLocal.getMonth() + 1).padStart(2, '0');
    const day = String(dLocal.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  } catch (e) { return ''; }
}

export default function DetalhesPublicador({ 
    publicadorId, onSaveSuccess, onClose,
    persistedMessage, 
    persistedError, 
    onMessageDismiss 
}) {
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
  
  // --- ESTADOS DE PERMISSÃO ---
  // Inicializa com null para diferenciar "não carregado" de "sem permissão"
  const [currentUser, setCurrentUser] = useState(null);

  const [showPassword, setShowPassword] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  
  const numeroInputRef = useRef(null);
  
  const message = persistedMessage;
  const isError = persistedError;

  // Busca dados do usuário logado
  useEffect(() => {
    const checkPermission = async () => {
        try {
            const res = await fetch('/api/usuario-atual');
            if (res.ok) {
                const data = await res.json();
                // Garante que o ID no estado seja string para facilitar comparação
                setCurrentUser({ ...data, id: String(data.id) });
            } else {
                // Se falhar, define um usuário vazio para não travar
                setCurrentUser({ isAnciao: false, isServo: false, id: '' });
            }
        } catch (error) {
            console.error("Erro ao verificar permissões", error);
            setCurrentUser({ isAnciao: false, isServo: false, id: '' });
        }
    };
    checkPermission();
  }, []);

  // --- LÓGICA DE PERMISSÃO ROBUSTA ---
  
  // Só calcula se o usuário já foi carregado
  let canViewActivities = false;
  let canEditActivities = false;

  if (currentUser) {
      const currentUserIdStr = String(currentUser.id || '').trim();
      const publicadorIdStr = String(publicadorId || '').trim();

      // Debug no console para verificar o que está chegando
      console.log('[PERMISSÃO] Validando acesso:', {
          EuSou: currentUserIdStr,
          EstouVendo: publicadorIdStr,
          SouAnciao: currentUser.isAnciao,
          SouServo: currentUser.isServo
      });

      canViewActivities = 
        currentUser.isAnciao || // Ancião vê tudo
        (currentUser.isServo && currentUserIdStr === publicadorIdStr); // Servo vê apenas a sua

      canEditActivities = currentUser.isAnciao; // Apenas Ancião edita
  }
  // --------------------------------------

  const fetchTudo = useCallback(async (isRefresh = false) => {
    if (!publicadorId) { setIsPageLoading(false); return; }
    if (isRefresh) { setIsLoading(true); } else { setIsPageLoading(true); }
    
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
        data_nascimento: formatDateForForm(pubData.data_nascimento) || '',
        data_batismo: formatDateForForm(pubData.data_batismo) || '',
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
      onSaveSuccess({ 
          message: 'Erro ao recarregar dados: ' + err.message, 
          isError: true, 
          keepOpen: true
      });
    } finally {
      setIsPageLoading(false);
      setIsLoading(false); 
    }
  }, [publicadorId, onSaveSuccess]);

  useEffect(() => {
    if (publicadorId) fetchTudo(false);
  }, [publicadorId, fetchTudo]);
  
  const handleCepBlur = async () => { if (message) onMessageDismiss(); };
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
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    onMessageDismiss();
    try {
      const response = await fetch(`/api/admin/update-publicador/${publicadorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData) 
      });
      const data = await response.json();
      if (response.ok) {
        await fetchTudo(true); 
        onSaveSuccess({ message: 'Publicador alterado com sucesso', isError: false, keepOpen: true });
      } else {
        onSaveSuccess({ message: data?.message || 'Erro ao salvar', isError: true, keepOpen: true });
      }
    } catch (err) {
      onSaveSuccess({ message: 'Não foi possível conectar ao servidor.', isError: true, keepOpen: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  if (isPageLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 h-full bg-white">
        <Loader2 className="size-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      
      {/* CABEÇALHO */}
      <div className="shrink-0 p-6 border-b border-gray-200 flex items-center justify-between bg-white">
        <div className="flex-1 min-w-0 mr-4">
          <h2 className="text-2xl font-bold text-gray-900 truncate">
            {formData.nome_completo || 'Editar Publicador'}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500 text-xs">ID: {publicadorId}</p>
            <span className="text-gray-300">•</span>
            <span className="text-gray-500 text-xs">{formData.nome_grupo || 'Sem grupo'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Imprimir Ficha"
            >
              <Printer size={18} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
        </div>
      </div>
      
      {/* CONTEÚDO ROLÁVEL */}
      <div className="flex-1 overflow-y-auto p-6">
        {message && (
          <div 
            className={`p-3 rounded-md mb-6 text-sm cursor-pointer flex items-center justify-between ${isError 
              ? 'bg-red-900/30 text-red-300 border border-red-800' 
              : 'bg-green-900/30 text-green-300 border border-green-800'}`
            }
            onClick={onMessageDismiss}
          >
            <span>{message}</span>
            <X size={14} className="opacity-50" />
          </div>
        )}

        {/* ABAS */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-6" aria-label="Abas">
            <button
              onClick={() => setActiveTab('informacoes')}
              className={`${activeTab === 'informacoes' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Informações Pessoais
            </button>
            
            {/* --- BOTÃO DE ATIVIDADES --- */}
            {canViewActivities ? (
              <button
                onClick={() => setActiveTab('atividades')}
                className={`${activeTab === 'atividades' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Atividades Teocráticas
              </button>
            ) : (
              // Botão desativado (Com tooltip do motivo)
              <div className="flex items-center text-gray-300 py-3 px-1 border-b-2 border-transparent text-sm cursor-not-allowed" title="Acesso restrito a Anciãos ou ao próprio titular">
                  <Lock size={12} className="mr-1" /> Atividades
              </div>
            )}
            
            <button
              onClick={() => setActiveTab('historico')}
              className={`${activeTab === 'historico' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Linha do Tempo
            </button>
          </nav>
        </div>
        
        {/* PAINÉIS DAS ABAS */}
        <div className="pb-10">
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

            {activeTab === 'atividades' && canViewActivities && (
              <AtividadesTeocraticas 
                  publicadorId={publicadorId} 
                  publicadorNome={formData.nome_completo}
                  relatorios={relatorios}
                  publicador={formData}
                  onRefreshData={() => fetchTudo(true)}
                  readOnly={!canEditActivities} // <-- Define se pode editar ou não
              />
            )}

            {activeTab === 'historico' && (
              <HistoricoPublicador 
                  publicadorId={publicadorId}
              />
            )}
        </div>
      </div>

      {/* ÁREA DE IMPRESSÃO */}
      <div className="printable-content">
        <RelatorioImprimivel 
          publicador={formData} 
          relatorios={relatorios} 
          isEditing={false}
        />
      </div>
    </div>
  );
}