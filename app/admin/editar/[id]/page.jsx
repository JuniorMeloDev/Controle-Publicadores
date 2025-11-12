'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation'; 
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { IMaskInput } from 'react-imask';

// Listas (sem mudança)
const LISTA_PRIVILEGIOS = [
  { id: 'anciao', label: 'Ancião' },
  { id: 'servo_ministerial', label: 'Servo Ministerial' },
];
const LISTA_DESIGNACOES = [
  { id: 'pioneiro_regular', label: 'Pioneiro Regular' },
  { id: 'pioneiro_especial', label: 'Pioneiro Especial' },
  { id: 'missionario', label: 'Missionário em Campo' },
];

// --- NOVO: Componente para o formulário de edição ---
// (Movemos o formulário para seu próprio componente para organizar)
function FormularioInformacoes({ 
  formData, setFormData, handleSubmit, handleChange, handleMaskChange, 
  handlePrivilegioChange, handleDesignacaoChange, handleCepBlur, 
  gruposList, isLoading, isCepLoading, cepError, numeroInputRef, 
  showPassword, setShowPassword 
}) {
  
  // As classes de estilo são usadas aqui dentro
  const labelClass = "block text-sm font-medium text-neutral-300";
  const baseInputClass = "mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 placeholder-neutral-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50";
  const checkboxLabelClass = "ml-2 text-sm text-neutral-100 select-none";
  const checkboxClass = "h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-neutral-900";
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6 mt-6">
      {/* Todo o JSX do formulário que já tínhamos vai aqui... */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white border-b border-neutral-700 pb-2">
          Informações Pessoais
        </h3>
        <div>
          <label htmlFor="nome_completo" className={labelClass}>Nome Completo</label>
          <input type="text" id="nome_completo" name="nome_completo" value={formData.nome_completo} onChange={handleChange} className={baseInputClass} required />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="data_nascimento" className={labelClass}>Data de Nascimento</label>
            <IMaskInput
              mask="00/00/0000" id="data_nascimento" name="data_nascimento"
              value={formData.data_nascimento}
              onAccept={(value) => handleMaskChange(value, 'data_nascimento')}
              className={baseInputClass} placeholder="dd/mm/aaaa" required
            />
          </div>

          <div>
            <label htmlFor="data_batismo" className={labelClass}>Data de Batismo</label>
            <IMaskInput
              mask="00/00/0000" id="data_batismo" name="data_batismo"
              value={formData.data_batismo || ''}
              onAccept={(value) => handleMaskChange(value, 'data_batismo')}
              className={baseInputClass} placeholder="dd/mm/aaaa"
            />
          </div>

          <div>
            <label htmlFor="nome_grupo" className={labelClass}>Grupo de Campo</label>
            <select id="nome_grupo" name="nome_grupo" value={formData.nome_grupo} onChange={handleChange} className={baseInputClass} required>
              <option value="" disabled>Selecione...</option>
              {gruposList.map(grupo => (
                <option key={grupo} value={grupo}>{grupo}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white border-b border-neutral-700 pb-2">
          Contato e Endereço
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="telefone" className={labelClass}>Telefone</label>
            <IMaskInput
              mask="(00) 00000-0000" id="telefone" name="telefone"
              value={formData.telefone}
              onAccept={(value) => handleMaskChange(value, 'telefone')}
              className={baseInputClass} placeholder="(99) 99999-9999"
            />
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>Email</label>
            <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className={baseInputClass} placeholder="exemplo@email.com" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label htmlFor="cep" className={labelClass}>CEP</label>
            <div className="relative mt-1">
              <IMaskInput
                mask="00000-000" id="cep" name="cep" value={formData.cep}
                onAccept={(value) => handleMaskChange(value, 'cep')}
                onBlur={handleCepBlur}
                className={`${baseInputClass} ${isCepLoading ? 'pr-10' : ''}`}
                placeholder="12345-678" disabled={isCepLoading}
              />
              {isCepLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-5 animate-spin text-neutral-400" />
              )}
            </div>
            {cepError && <p className="text-xs text-red-400 mt-1">{cepError}</p>}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="logradouro" className={labelClass}>Logradouro (Rua, Av.)</label>
            <input type="text" id="logradouro" name="logradouro" value={formData.logradouro} onChange={handleChange} className={baseInputClass} disabled={isCepLoading} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="numero" className={labelClass}>Número</label>
            <input type="text" id="numero" name="numero" value={formData.numero} onChange={handleChange} className={baseInputClass} disabled={isCepLoading} ref={numeroInputRef} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="complemento" className={labelClass}>Complemento</label>
            <input type="text" id="complemento" name="complemento" value={formData.complemento} onChange={handleChange} className={baseInputClass} disabled={isCepLoading} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="bairro" className={labelClass}>Bairro</label>
            <input type="text" id="bairro" name="bairro" value={formData.bairro} onChange={handleChange} className={baseInputClass} disabled={isCepLoading} />
          </div>
          <div>
            <label htmlFor="cidade" className={labelClass}>Cidade</label>
            <input type="text" id="cidade" name="cidade" value={formData.cidade} onChange={handleChange} className={baseInputClass} disabled={isCepLoading} />
          </div>
          <div>
            <label htmlFor="estado" className={labelClass}>Estado (UF)</label>
            <input type="text" id="estado" name="estado" value={formData.estado} onChange={handleChange} className={baseInputClass} disabled={isCepLoading} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white border-b border-neutral-700 pb-2">
          Acesso e Designações
        </h3>
        <div>
          <label htmlFor="senha" className={labelClass}>Redefinir Senha</label>
          <div className="relative mt-1">
            <input 
              type={showPassword ? 'text' : 'password'}
              id="senha" name="senha" value={formData.senha} onChange={handleChange} 
              className={`${baseInputClass} pr-10`}
              placeholder="Deixe em branco para não alterar" 
            />
            <button
              type="button"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-100"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div>
          <label className={labelClass}>Acesso ao Portal (Privilégios)</label>
          <div className="mt-2 space-y-2">
            {LISTA_PRIVILEGIOS.map(priv => (
              <div key={priv.id} className="flex items-center">
                <input id={priv.id} name="privilegios" type="checkbox" value={priv.id} 
                       checked={formData.privilegios.includes(priv.id)} 
                       onChange={handlePrivilegioChange} className={checkboxClass} />
                <label htmlFor={priv.id} className={checkboxLabelClass}>{priv.label}</label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Outras Designações (Informativo)</label>
          <div className="mt-2 space-y-2">
            {LISTA_DESIGNACOES.map(desig => (
              <div key={desig.id} className="flex items-center">
                <input 
                  id={desig.id} name="designacoes" type="checkbox" value={desig.id} 
                  checked={formData.designacoes.includes(desig.id)} 
                  onChange={handleDesignacaoChange} className={checkboxClass} 
                />
                <label htmlFor={desig.id} className={checkboxLabelClass}>{desig.label}</label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={isLoading || isCepLoading}
        className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 transition-colors"
      >
        {isLoading ? 'Salvando...' : 'Salvar Alterações'}
      </button>
    </form>
  );
}

// --- NOVO: Componente para a aba de Atividades ---
function AtividadesTeocraticas({ publicadorId, publicadorNome }) {
  // State para as sub-abas
  const [activeSubTab, setActiveSubTab] = useState('relatorios');
  const [relatorios, setRelatorios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Busca os relatórios deste publicador
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
  }, [publicadorId]);

  return (
    <div className="mt-6">
      {/* --- Navegação da Sub-Aba --- */}
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
          {/* Você pode adicionar mais botões de sub-abas aqui no futuro */}
        </nav>
      </div>

      {/* --- Conteúdo da Sub-Aba --- */}
      <div className="mt-4">
        {activeSubTab === 'relatorios' && (
          <div>
            {isLoading && <Loader2 className="size-6 animate-spin text-neutral-400" />}
            {error && <p className="text-red-400">{error}</p>}
            
            {!isLoading && !error && relatorios.length === 0 && (
              <p className="text-neutral-500 italic">Nenhum relatório de serviço encontrado para este publicador.</p>
            )}

            {!isLoading && !error && relatorios.length > 0 && (
              <div className="flow-root">
                <ul role="list" className="-mb-8">
                  {relatorios.map((relatorio, relatorioIdx) => (
                    <li key={relatorio.id}>
                      <div className="relative pb-8">
                        {/* Linha vertical (exceto no último item) */}
                        {relatorioIdx !== relatorios.length - 1 ? (
                          <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-neutral-700" aria-hidden="true" />
                        ) : null}
                        
                        <div className="relative flex space-x-3">
                          <div>
                            {/* Ícone */}
                            <span className="h-8 w-8 rounded-full bg-neutral-700 flex items-center justify-center ring-8 ring-neutral-900">
                              <svg className="h-5 w-5 text-neutral-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.59l-2.1-2.1a.75.75 0 00-1.06 1.06l3.5 3.5a.75.75 0 001.06 0l3.5-3.5a.75.75 0 10-1.06-1.06l-2.1 2.1V6.75z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                            <div>
                              <p className="text-sm text-neutral-300">
                                Relatório de <span className="font-medium text-white">{relatorio.mes} {relatorio.ano_servico}</span>
                              </p>
                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
                                {relatorio.pioneiro_auxiliar && (
                                  <span className="bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">Pioneiro Auxiliar</span>
                                )}
                                {relatorio.horas && (
                                  <span><span className="font-medium">{relatorio.horas}</span> horas</span>
                                )}
                                <span><span className="font-medium">{relatorio.estudos_biblicos || 0}</span> estudos</span>
                                 <span><span className="font-medium">{relatorio.observacoes || 0}</span> observacao</span>
                              </div>
                            </div>
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

// --- COMPONENTE PRINCIPAL DA PÁGINA (Atualizado com Abas) ---
export default function EditarPublicadorPage() {
  // State para a ABA PRINCIPAL
  const [activeTab, setActiveTab] = useState('informacoes');

  const [gruposList, setGruposList] = useState([]);
  const [formData, setFormData] = useState({
    nome_completo: '', data_nascimento: '', data_batismo: '',
    nome_grupo: '', senha: '', privilegios: [], designacoes: [],
    telefone: '', email: '', cep: '', logradouro: '',
    numero: '', complemento: '', bairro: '', cidade: '', estado: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  
  const numeroInputRef = useRef(null);
  const router = useRouter();
  const params = useParams();
  const publicadorId = params.id;

  // useEffect: Busca os dados do publicador e a lista de grupos
  useEffect(() => {
    if (!publicadorId) return; 

    const fetchGruposEPublicador = async () => {
      setIsPageLoading(true);
      try {
        const gruposRes = await fetch('/api/get-grupos');
        if (!gruposRes.ok) throw new Error('Falha ao carregar grupos.');
        const gruposData = await gruposRes.json();
        setGruposList(gruposData);

        const pubRes = await fetch(`/api/admin/get-publicador/${publicadorId}`);
        if (!pubRes.ok) throw new Error('Falha ao carregar dados do publicador.');
        const pubData = await pubRes.json();

        setFormData({
          ...pubData,
          data_nascimento: pubData.data_nascimento || '',
          data_batismo: pubData.data_batismo || '',
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

      } catch (err) {
        console.error(err);
        setMessage('Erro ao carregar dados. ' + err.message);
        setIsError(true);
      } finally {
        setIsPageLoading(false);
      }
    };
    fetchGruposEPublicador();
  }, [publicadorId]); 

  // Handlers (passados para o sub-componente)
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
    setIsCepLoading(true); setCepError('');
    try {
      const response = await fetch(`/api/get-cep?cep=${cep}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || data.erro) throw new Error(data.message || 'CEP não encontrado.');
      setFormData(prev => ({
        ...prev, logradouro: data.logradouro, bairro: data.bairro,
        cidade: data.localidade, estado: data.uf, complemento: '', cepError: ''
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
        setTimeout(() => { router.push('/admin/gerenciar'); }, 2000);
      } else {
        setMessage(data.message || 'Ocorreu um erro.');
        setIsError(true);
      }
    } catch (err) {
      setMessage('Não foi possível conectar ao servidor.');
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Tela de Loading Inicial ---
  if (isPageLoading) {
    return (
      <main className="min-h-screen w-full p-4 md:p-8 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-neutral-400" />
      </main>
    );
  }

  // --- JSX do Formulário ---
  return (
    <main className="min-h-screen w-full p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-neutral-900 p-6 md:p-8 rounded-xl shadow-2xl border border-neutral-800">

        <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-700">
          <div>
            <h2 className="text-3xl font-bold text-white">
              {/* Título dinâmico */}
              {formData.nome_completo || 'Editar Publicador'}
            </h2>
            <p className="text-neutral-400 text-sm mt-1">
              ID do Publicador: {publicadorId}
            </p>
          </div>
          <Link 
            href="/admin/gerenciar"
            className="flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold text-neutral-100 bg-neutral-700 hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-neutral-900 transition-colors"
          >
            <ArrowLeft size={16} />
            Voltar
          </Link>
        </div>
        
        {/* Mensagem de sucesso/erro (agora fica acima das abas) */}
        {message && (
          <div className={`p-3 rounded-md mb-6 text-sm ${isError 
            ? 'bg-red-900 bg-opacity-30 text-red-300 border border-red-800' 
            : 'bg-green-900 bg-opacity-30 text-green-300 border border-green-800'}`
          }>
            {message}
          </div>
        )}

        {/* --- NOVO: Navegação das Abas Principais --- */}
        <div className="border-b border-neutral-700">
          <nav className="-mb-px flex space-x-6" aria-label="Abas">
            <button
              onClick={() => setActiveTab('informacoes')}
              className={`
                ${activeTab === 'informacoes' 
                  ? 'border-blue-500 text-blue-400' 
                  : 'border-transparent text-neutral-400 hover:border-neutral-500 hover:text-neutral-300'}
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              `}
            >
              Informações Pessoais
            </button>
            <button
              onClick={() => setActiveTab('atividades')}
              className={`
                ${activeTab === 'atividades' 
                  ? 'border-blue-500 text-blue-400' 
                  : 'border-transparent text-neutral-400 hover:border-neutral-500 hover:text-neutral-300'}
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              `}
            >
              Atividades Teocráticas
            </button>
          </nav>
        </div>

        {/* --- NOVO: Conteúdo das Abas --- */}
        <div>
          {/* Aba 1: Informações Pessoais (o formulário) */}
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

          {/* Aba 2: Atividades Teocráticas */}
          {activeTab === 'atividades' && (
            <AtividadesTeocraticas 
              publicadorId={publicadorId} 
              publicadorNome={formData.nome_completo}
            />
          )}
        </div>

      </div>
    </main>
  );
}