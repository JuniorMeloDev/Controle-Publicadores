'use client';

// Imports (sem mudança)
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
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

export default function CadastrarPublicador() {
  const [gruposList, setGruposList] = useState([]);
  
  const [formData, setFormData] = useState({
    nome_completo: '',
    data_nascimento: '',
    nome_grupo: '',
    senha: '',
    privilegios: [], 
    designacoes: [],
    telefone: '',
    email: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  const numeroInputRef = useRef(null);

  useEffect(() => {
    const fetchGrupos = async () => {
      try {
        const response = await fetch('/api/get-grupos');
        if (!response.ok) throw new Error('Falha ao carregar grupos');
        const data = await response.json();
        setGruposList(data);
      } catch (err) {
        console.error(err);
        setMessage('Erro ao carregar lista de grupos.');
        setIsError(true);
      }
    };
    fetchGrupos();
  }, []);

  // Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleMaskChange = (value, name) => {
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
    
    if (name === 'cep') {
      setCepError('');
    }
  };

  const handleCepBlur = async () => {
    const cep = formData.cep.replace(/\D/g, ''); // Limpa máscara

    if (cep.length !== 8) {
      setCepError('');
      return; 
    }

    setIsCepLoading(true);
    setCepError('');
    try {
      // --- MUDANÇA AQUI: Adicione { cache: 'no-store' } ---
      const response = await fetch(`/api/get-cep/${cep}`, {
         cache: 'no-store' 
      });
      
      const data = await response.json();

      if (!response.ok || data.erro) {
        throw new Error(data.message || 'CEP não encontrado.');
      }

      setFormData(prev => ({
        ...prev,
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        estado: data.uf,
        complemento: '',
        cepError: ''
      }));
      
      numeroInputRef.current?.focus();

    } catch (err) {
      setCepError(err.message);
      setFormData(prev => ({
        ...prev,
        logradouro: '',
        bairro: '',
        cidade: '',
        estado: '',
      }));
    } finally {
      setIsCepLoading(false);
    }
  };
  
  const handlePrivilegioChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prevData => {
      if (checked) {
        return { ...prevData, privilegios: [...prevData.privilegios, value] };
      }
      return { ...prevData, privilegios: prevData.privilegios.filter(p => p !== value) };
    });
  };

  const handleDesignacaoChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prevData => {
      if (checked) {
        return { ...prevData, designacoes: [...prevData.designacoes, value] };
      }
      return { ...prevData, designacoes: prevData.designacoes.filter(d => d !== value) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setIsError(false);
    
    if (formData.privilegios.length > 0 && formData.senha.trim() === '') {
      setMessage('É obrigatório definir uma senha para usuários com privilégios (Ancião ou Servo).');
      setIsError(true);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/criar-publicador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData) 
      });
      
      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setIsError(false);
        setFormData({
          nome_completo: '', data_nascimento: '', nome_grupo: '',
          senha: '', privilegios: [], designacoes: [],
          telefone: '', email: '', cep: '', logradouro: '',
          numero: '', complemento: '', bairro: '', cidade: '', estado: ''
        });
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

  // --- Classes de Estilo (sem mudança) ---
  const labelClass = "block text-sm font-medium text-neutral-300";
  const baseInputClass = "mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 placeholder-neutral-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50";
  const checkboxLabelClass = "ml-2 text-sm text-neutral-100 select-none";
  const checkboxClass = "h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-neutral-900";

  return (
    <main className="min-h-screen w-full p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-neutral-900 p-6 md:p-8 rounded-xl shadow-2xl border border-neutral-800">

        <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-700">
          <h2 className="text-3xl font-bold text-white">
            Cadastrar Publicador
          </h2>
          <Link 
            href="/admin/gerenciar"
            className="flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold text-neutral-100 bg-neutral-700 hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-neutral-900 transition-colors"
          >
            <ArrowLeft size={16} />
            Voltar
          </Link>
        </div>
        
        {message && (
          <div className={`p-3 rounded-md mb-6 text-sm ${isError 
            ? 'bg-red-900 bg-opacity-30 text-red-300 border border-red-800' 
            : 'bg-green-900 bg-opacity-30 text-green-300 border border-green-800'}`
          }>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
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
                  mask="00/00/0000"
                  id="data_nascimento"
                  name="data_nascimento"
                  value={formData.data_nascimento}
                  onAccept={(value) => handleMaskChange(value, 'data_nascimento')}
                  className={baseInputClass}
                  placeholder="dd/mm/aaaa"
                  required
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
                  mask="(00) 00000-0000"
                  id="telefone"
                  name="telefone"
                  value={formData.telefone}
                  onAccept={(value) => handleMaskChange(value, 'telefone')}
                  className={baseInputClass}
                  placeholder="(99) 99999-9999"
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
                    mask="00000-000"
                    id="cep"
                    name="cep"
                    value={formData.cep}
                    onAccept={(value) => handleMaskChange(value, 'cep')}
                    onBlur={handleCepBlur}
                    className={`${baseInputClass} ${isCepLoading ? 'pr-10' : ''}`}
                    placeholder="12345-678"
                    disabled={isCepLoading}
                  />
                  {isCepLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-5 animate-spin text-neutral-400" />
                  )}
                </div>
                {cepError && <p className="text-xs text-red-400 mt-1">{cepError}</p>}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="logradouro" className={labelClass}>Logradouro (Rua, Av.)</label>
                <input type="text" id="logradouro" name="logradouro" value={formData.logradouro} onChange={handleChange} className={baseInputClass} disabled={isCepLoading} placeholder="Rua das Flores" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="numero" className={labelClass}>Número</label>
                <input type="text" id="numero" name="numero" value={formData.numero} onChange={handleChange} className={baseInputClass} disabled={isCepLoading} placeholder="123" ref={numeroInputRef} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="complemento" className={labelClass}>Complemento</label>
                <input type="text" id="complemento" name="complemento" value={formData.complemento} onChange={handleChange} className={baseInputClass} disabled={isCepLoading} placeholder="Apto 4B" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="bairro" className={labelClass}>Bairro</label>
                <input type="text" id="bairro" name="bairro" value={formData.bairro} onChange={handleChange} className={baseInputClass} disabled={isCepLoading} placeholder="Centro" />
              </div>
              <div>
                <label htmlFor="cidade" className={labelClass}>Cidade</label>
                <input type="text" id="cidade" name="cidade" value={formData.cidade} onChange={handleChange} className={baseInputClass} disabled={isCepLoading} placeholder="São Paulo" />
              </div>
              <div>
                <label htmlFor="estado" className={labelClass}>Estado (UF)</label>
                <input type="text" id="estado" name="estado" value={formData.estado} onChange={handleChange} className={baseInputClass} disabled={isCepLoading} placeholder="SP" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white border-b border-neutral-700 pb-2">
              Acesso e Designações
            </h3>
            
            <div>
              <label htmlFor="senha" className={labelClass}>Senha (Obrigatório para Admin)</label>
              <div className="relative mt-1">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  id="senha" name="senha" value={formData.senha} onChange={handleChange} 
                  className={`${baseInputClass} pr-10`}
                  placeholder="Deixe em branco se for publicador comum" 
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
                    <input id={priv.id} name="privilegios" type="checkbox" value={priv.id} checked={formData.privilegios.includes(priv.id)} onChange={handlePrivilegioChange} className={checkboxClass} />
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
                    <input id={desig.id} name="designacoes" type="checkbox" value={desig.id} checked={formData.designacoes.includes(desig.id)} onChange={handleDesignacaoChange} className={checkboxClass} />
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
            {isLoading ? 'Cadastrando...' : 'Cadastrar Publicador'}
          </button>
        </form>
      </div>
    </main>
  );
}