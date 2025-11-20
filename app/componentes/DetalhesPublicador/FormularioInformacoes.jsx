'use client';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { IMaskInput } from 'react-imask';

// Listas estáticas
const LISTA_PRIVILEGIOS = [
  { id: 'anciao', label: 'Ancião' },
  { id: 'servo_ministerial', label: 'Servo Ministerial' },
];
const LISTA_DESIGNACOES = [
  { id: 'pioneiro_regular', label: 'Pioneiro Regular' },
  { id: 'pioneiro_especial', label: 'Pioneiro Especial' },
  { id: 'missionario', label: 'Missionário em Campo' },
];

export default function FormularioInformacoes({ 
  formData, setFormData, handleSubmit, handleChange, handleMaskChange, 
  handlePrivilegioChange, handleDesignacaoChange, handleCepBlur, 
  gruposList, isLoading, isCepLoading, cepError, numeroInputRef, 
  showPassword, setShowPassword 
}) {
  
  // --- ESTILOS CORRIGIDOS (Sem Uppercase) ---
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5"; // Removido 'uppercase'
  
  const baseInputClass = `
    w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 
    placeholder-gray-400 shadow-sm transition-all
    focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 
    disabled:opacity-50 disabled:bg-gray-100
  `;
  
  const checkboxLabelClass = "ml-2 text-sm text-gray-700 select-none cursor-pointer";
  const checkboxClass = "h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer";
  // ------------------------------------------
  
  return (
    <form onSubmit={handleSubmit} className="space-y-8 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* === LINHA 1: PESSOAIS === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA 1 */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2">
            Pessoais
          </h3>
          
          <div>
            <label htmlFor="nome_completo" className={labelClass}>Nome Completo</label>
            <input 
              type="text" id="nome_completo" name="nome_completo" 
              value={formData.nome_completo} onChange={handleChange} 
              className={baseInputClass} required 
            />
          </div>

          <div>
            <label htmlFor="nome_chamado" className={labelClass}>Nome Chamado (Apelido)</label>
            <input 
              type="text" id="nome_chamado" name="nome_chamado" 
              value={formData.nome_chamado || ''} onChange={handleChange} 
              className={baseInputClass} placeholder="Ex: João Júnior"
            />
          </div>

          <div>
            <label htmlFor="sexo" className={labelClass}>Sexo</label>
            <select 
              id="sexo" name="sexo" value={formData.sexo || ''} onChange={handleChange} 
              className={baseInputClass} required
            >
              <option value="" disabled>Selecione...</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </select>
          </div>

          <div>
            <label htmlFor="data_nascimento" className={labelClass}>Nascimento</label>
            <IMaskInput
              mask="00/00/0000" id="data_nascimento" name="data_nascimento"
              value={formData.data_nascimento} onAccept={(value) => handleMaskChange(value, 'data_nascimento')}
              className={baseInputClass} placeholder="dd/mm/aaaa" required
            />
          </div>

          <div>
            <label htmlFor="data_batismo" className={labelClass}>Batismo</label>
            <IMaskInput
              mask="00/00/0000" id="data_batismo" name="data_batismo"
              value={formData.data_batismo || ''} onAccept={(value) => handleMaskChange(value, 'data_batismo')}
              className={baseInputClass} placeholder="dd/mm/aaaa"
            />
          </div>

          <div>
            <label htmlFor="esperanca" className={labelClass}>Esperança</label>
            <select 
              id="esperanca" name="esperanca" value={formData.esperanca || ''} onChange={handleChange} 
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
              id="nome_grupo" name="nome_grupo" value={formData.nome_grupo} onChange={handleChange} 
              className={baseInputClass} required
            >
              <option value="" disabled>Selecione...</option>
              {gruposList.map(grupo => (
                <option key={grupo} value={grupo}>{grupo}</option>
              ))}
            </select>
          </div>
        </div>

        {/* COLUNA 2: CONTATO */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2">
            Contato
          </h3>

          <div>
            <label htmlFor="telefone" className={labelClass}>Telefone</label>
            <IMaskInput
              mask="(00) 00000-0000" id="telefone" name="telefone"
              value={formData.telefone} onAccept={(value) => handleMaskChange(value, 'telefone')}
              className={baseInputClass} placeholder="(99) 99999-9999"
            />
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>Email</label>
            <input 
              type="email" id="email" name="email" 
              value={formData.email} onChange={handleChange} 
              className={baseInputClass} placeholder="email@exemplo.com" 
            />
          </div>

          <div>
            <label htmlFor="cep" className={labelClass}>CEP</label>
            <div className="relative">
              <IMaskInput
                mask="00000-000" id="cep" name="cep" 
                value={formData.cep} onAccept={(value) => handleMaskChange(value, 'cep')} onBlur={handleCepBlur}
                className={`${baseInputClass} ${isCepLoading ? 'pr-8' : ''}`}
                placeholder="12345-678" disabled={isCepLoading}
              />
              {isCepLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-purple-500" />
              )}
            </div>
            {cepError && <p className="text-xs text-red-500 mt-1">{cepError}</p>}
          </div>
        </div>

        {/* COLUNA 3: ENDEREÇO */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2">
            Endereço
          </h3>

          <div>
            <label htmlFor="logradouro" className={labelClass}>Rua/Avenida</label>
            <input 
              type="text" id="logradouro" name="logradouro" 
              value={formData.logradouro} onChange={handleChange} 
              className={baseInputClass} disabled={isCepLoading} 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="numero" className={labelClass}>Nº</label>
              <input 
                type="text" id="numero" name="numero" 
                value={formData.numero} onChange={handleChange} 
                className={baseInputClass} disabled={isCepLoading} ref={numeroInputRef} 
              />
            </div>
            <div>
              <label htmlFor="complemento" className={labelClass}>Compl</label>
              <input 
                type="text" id="complemento" name="complemento" 
                value={formData.complemento} onChange={handleChange} 
                className={baseInputClass} disabled={isCepLoading} 
              />
            </div>
          </div>

          <div>
            <label htmlFor="bairro" className={labelClass}>Bairro</label>
            <input 
              type="text" id="bairro" name="bairro" 
              value={formData.bairro} onChange={handleChange} 
              className={baseInputClass} disabled={isCepLoading} 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cidade" className={labelClass}>Cidade</label>
              <input 
                type="text" id="cidade" name="cidade" 
                value={formData.cidade} onChange={handleChange} 
                className={baseInputClass} disabled={isCepLoading} 
              />
            </div>
            <div>
              <label htmlFor="estado" className={labelClass}>UF</label>
              <input 
                type="text" id="estado" name="estado" 
                value={formData.estado} onChange={handleChange} 
                className={baseInputClass} disabled={isCepLoading} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* === LINHA 2: ACESSO E DESIGNAÇÕES === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
        {/* COLUNA 1: ACESSO */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2">
            Acesso e Privilégios
          </h3>

          <div>
            <label htmlFor="senha" className={labelClass}>Redefinir Senha</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'}
                id="senha" name="senha" 
                value={formData.senha} onChange={handleChange} 
                className={`${baseInputClass} pr-10`}
                placeholder="••••••••" 
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <label className={labelClass}>Privilégios</label>
            <div className="space-y-2 mt-2">
              {LISTA_PRIVILEGIOS.map(priv => (
                <div key={priv.id} className="flex items-center p-2 rounded-md hover:bg-gray-50 transition-colors">
                  <input 
                    id={priv.id} name="privilegios" type="checkbox" value={priv.id} 
                    checked={Array.isArray(formData.privilegios) && formData.privilegios.includes(priv.id)} 
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
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2">
            Designações Especiais
          </h3>

          <div className="space-y-2 mt-2">
            {LISTA_DESIGNACOES.map(desig => (
              <div key={desig.id} className="flex items-center p-2 rounded-md hover:bg-gray-50 transition-colors">
                <input 
                  id={desig.id} name="designacoes" type="checkbox" value={desig.id} 
                  checked={Array.isArray(formData.designacoes) && formData.designacoes.includes(desig.id)} 
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
            className="w-full mt-8 py-3 px-4 rounded-md text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </div>
            ) : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </form>
  );
}