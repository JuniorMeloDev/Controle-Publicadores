'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, X, Eye, EyeOff } from 'lucide-react';
import { IMaskInput } from 'react-imask';

const LISTA_PRIVILEGIOS = [
  { id: 'anciao', label: 'Ancião' },
  { id: 'servo_ministerial', label: 'Servo Ministerial' },
];
const LISTA_DESIGNACOES = [
  { id: 'pioneiro_regular', label: 'Pioneiro Regular' },
  { id: 'pioneiro_especial', label: 'Pioneiro Especial' },
  { id: 'missionario', label: 'Missionário em Campo' },
];

export default function FormularioCadastro({ onSaveSuccess, onClose }) {
  const [gruposList, setGruposList] = useState([]);
  const [formData, setFormData] = useState({
    nome_completo: '', data_nascimento: '', data_batismo: '', nome_grupo: '',
    sexo: '', esperanca: '',
    senha: '', privilegios: [], designacoes: [],
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

  useEffect(() => {
    const fetchGrupos = async () => {
      try {
        const res = await fetch('/api/get-grupos');
        if (!res.ok) throw new Error('Falha ao carregar grupos.');
        const data = await res.json();
        setGruposList(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsPageLoading(false);
      }
    };

    fetchGrupos();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMaskChange = (value, name) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'cep') setCepError('');
  };

  const handlePrivilegioChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prev => {
      if (checked) return { ...prev, privilegios: [...prev.privilegios, value] };
      return { ...prev, privilegios: prev.privilegios.filter(p => p !== value) };
    });
  };

  const handleDesignacaoChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prev => {
      if (checked) return { ...prev, designacoes: [...prev.designacoes, value] };
      return { ...prev, designacoes: prev.designacoes.filter(d => d !== value) };
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

    if (formData.privilegios.length > 0 && formData.senha.trim() === '') {
      setMessage('É obrigatório definir uma senha para usuários com privilégios.');
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
        setMessage('Publicador criado com sucesso!');
        setIsError(false);
        setTimeout(() => onSaveSuccess(), 1500);
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

  const labelClass = "block text-xs font-semibold text-neutral-300 mb-1";
  const baseInputClass = "w-full rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50";
  const checkboxClass = "h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-blue-600 cursor-pointer";
  const checkboxLabelClass = "ml-2 text-xs text-neutral-100 select-none cursor-pointer";

  if (isPageLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-neutral-900 overflow-hidden">
      {/* HEADER */}
      <div className="shrink-0 border-b border-neutral-800 bg-neutral-800/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-white">Novo Publicador</h2>
            <p className="text-xs text-neutral-400">Preencha os dados abaixo</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-2 p-1 text-neutral-400 hover:text-neutral-100 transition"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {message && (
          <div className={`px-4 py-2 text-xs ${isError 
            ? 'bg-red-900/30 text-red-300 border-t border-red-800' 
            : 'bg-green-900/30 text-green-300 border-t border-green-800'}`
          }>
            {message}
          </div>
        )}
      </div>

      {/* CONTEÚDO COM SCROLL */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4 pb-4">
            {/* === LINHA 1: PESSOAIS === */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* COLUNA 1 */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white border-b border-neutral-700 pb-1.5">
                  Pessoais
                </h3>
                
                <div>
                  <label htmlFor="nome_completo" className={labelClass}>Nome Completo</label>
                  <input 
                    type="text" 
                    id="nome_completo" 
                    name="nome_completo" 
                    value={formData.nome_completo} 
                    onChange={handleChange} 
                    className={baseInputClass} 
                    required 
                  />
                </div>

                <div>
                  <label htmlFor="sexo" className={labelClass}>Sexo</label>
                  <select 
                    id="sexo" 
                    name="sexo" 
                    value={formData.sexo} 
                    onChange={handleChange} 
                    className={baseInputClass} 
                    required
                  >
                    <option value="" disabled>Selecione...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="data_nascimento" className={labelClass}>Nascimento</label>
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
                  <label htmlFor="data_batismo" className={labelClass}>Batismo</label>
                  <IMaskInput
                    mask="00/00/0000" 
                    id="data_batismo" 
                    name="data_batismo"
                    value={formData.data_batismo || ''}
                    onAccept={(value) => handleMaskChange(value, 'data_batismo')}
                    className={baseInputClass} 
                    placeholder="dd/mm/aaaa"
                  />
                </div>

                <div>
                  <label htmlFor="esperanca" className={labelClass}>Esperança</label>
                  <select 
                    id="esperanca" 
                    name="esperanca" 
                    value={formData.esperanca} 
                    onChange={handleChange} 
                    className={baseInputClass}
                  >
                    <option value="" disabled>Selecione...</option>
                    <option value="Outras Ovelhas">Outras Ovelhas</option>
                    <option value="Ungido">Ungido</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="nome_grupo" className={labelClass}>Grupo de Campo</label>
                  <select 
                    id="nome_grupo" 
                    name="nome_grupo" 
                    value={formData.nome_grupo} 
                    onChange={handleChange} 
                    className={baseInputClass} 
                    required
                  >
                    <option value="" disabled>Selecione...</option>
                    {gruposList.map(grupo => (
                      <option key={grupo} value={grupo}>{grupo}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* COLUNA 2: CONTATO */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white border-b border-neutral-700 pb-1.5">
                  Contato
                </h3>

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
                  <input 
                    type="email" 
                    id="email" 
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    className={baseInputClass} 
                    placeholder="email@ex.com" 
                  />
                </div>

                <div>
                  <label htmlFor="cep" className={labelClass}>CEP</label>
                  <div className="relative">
                    <IMaskInput
                      mask="00000-000" 
                      id="cep" 
                      name="cep" 
                      value={formData.cep}
                      onAccept={(value) => handleMaskChange(value, 'cep')}
                      onBlur={handleCepBlur}
                      className={`${baseInputClass} ${isCepLoading ? 'pr-8' : ''}`}
                      placeholder="12345-678" 
                      disabled={isCepLoading}
                    />
                    {isCepLoading && (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neutral-400" />
                    )}
                  </div>
                  {cepError && <p className="text-xs text-red-400 mt-1">{cepError}</p>}
                </div>
              </div>

              {/* COLUNA 3: ENDEREÇO */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white border-b border-neutral-700 pb-1.5">
                  Endereço
                </h3>

                <div>
                  <label htmlFor="logradouro" className={labelClass}>Rua/Avenida</label>
                  <input 
                    type="text" 
                    id="logradouro" 
                    name="logradouro" 
                    value={formData.logradouro} 
                    onChange={handleChange} 
                    className={baseInputClass} 
                    disabled={isCepLoading} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="numero" className={labelClass}>Nº</label>
                    <input 
                      type="text" 
                      id="numero" 
                      name="numero" 
                      value={formData.numero} 
                      onChange={handleChange} 
                      className={baseInputClass} 
                      disabled={isCepLoading} 
                      ref={numeroInputRef} 
                    />
                  </div>
                  <div>
                    <label htmlFor="complemento" className={labelClass}>Compl</label>
                    <input 
                      type="text" 
                      id="complemento" 
                      name="complemento" 
                      value={formData.complemento} 
                      onChange={handleChange} 
                      className={baseInputClass} 
                      disabled={isCepLoading} 
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="bairro" className={labelClass}>Bairro</label>
                  <input 
                    type="text" 
                    id="bairro" 
                    name="bairro" 
                    value={formData.bairro} 
                    onChange={handleChange} 
                    className={baseInputClass} 
                    disabled={isCepLoading} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="cidade" className={labelClass}>Cidade</label>
                    <input 
                      type="text" 
                      id="cidade" 
                      name="cidade" 
                      value={formData.cidade} 
                      onChange={handleChange} 
                      className={baseInputClass} 
                      disabled={isCepLoading} 
                    />
                  </div>
                  <div>
                    <label htmlFor="estado" className={labelClass}>UF</label>
                    <input 
                      type="text" 
                      id="estado" 
                      name="estado" 
                      value={formData.estado} 
                      onChange={handleChange} 
                      className={baseInputClass} 
                      disabled={isCepLoading} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* === LINHA 2: ACESSO E DESIGNAÇÕES === */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* COLUNA 1: ACESSO */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white border-b border-neutral-700 pb-1.5">
                  Acesso
                </h3>

                <div>
                  <label htmlFor="senha" className={labelClass}>Senha</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      id="senha" 
                      name="senha" 
                      value={formData.senha} 
                      onChange={handleChange} 
                      className={`${baseInputClass} pr-10`}
                      placeholder="Digite uma senha" 
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-100"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Privilégios</label>
                  <div className="space-y-2">
                    {LISTA_PRIVILEGIOS.map(priv => (
                      <div key={priv.id} className="flex items-center">
                        <input 
                          id={priv.id} 
                          name="privilegios" 
                          type="checkbox" 
                          value={priv.id} 
                          checked={formData.privilegios.includes(priv.id)} 
                          onChange={handlePrivilegioChange} 
                          className={checkboxClass} 
                        />
                        <label htmlFor={priv.id} className={checkboxLabelClass}>{priv.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* COLUNA 2: DESIGNAÇÕES */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white border-b border-neutral-700 pb-1.5">
                  Designações
                </h3>

                <div className="space-y-2">
                  {LISTA_DESIGNACOES.map(desig => (
                    <div key={desig.id} className="flex items-center">
                      <input 
                        id={desig.id} 
                        name="designacoes" 
                        type="checkbox" 
                        value={desig.id} 
                        checked={formData.designacoes.includes(desig.id)} 
                        onChange={handleDesignacaoChange} 
                        className={checkboxClass} 
                      />
                      <label htmlFor={desig.id} className={checkboxLabelClass}>{desig.label}</label>
                    </div>
                  ))}
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading || isCepLoading}
                  className="w-full mt-6 py-2 px-4 rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Criando...
                    </div>
                  ) : 'Criar Publicador'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}