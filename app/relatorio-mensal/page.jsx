'use client';

import { useState, useEffect } from 'react';

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const mesAtual = meses[new Date().getMonth()];

export default function RelatorioMensal() {
  
  const [gruposList, setGruposList] = useState([]); 
  const [formData, setFormData] = useState({
    nome_completo: '',
    data_nascimento: '',
    nome_grupo: '',
    mes: mesAtual, 
    ano_servico: new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
    participou_ministerio: false,
    pioneiro_auxiliar: false,
    estudos_biblicos: '',
    horas: '',
    observacoes: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const fetchGrupos = async () => {
      try {
        const response = await fetch('/api/get-grupos');
        if (!response.ok) {
          throw new Error('Falha ao carregar grupos');
        }
        const data = await response.json();
        setGruposList(data); 
        
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, nome_grupo: data[0] }));
        }

      } catch (err) {
        console.error(err);
      }
    };

    fetchGrupos();
  }, []); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome_grupo) {
      setMessage('Por favor, selecione seu Grupo de Campo.');
      setIsError(true);
      return;
    }
    
    setIsLoading(true);
    setMessage('');
    setIsError(false);
    try {
      const response = await fetch('/api/enviar-relatorio-mensal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          estudos_biblicos: formData.estudos_biblicos || null,
          horas: formData.horas || null,
        })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(data.message);
        setIsError(false);
        setFormData(prev => ({
          ...prev,
          participou_ministerio: false,
          pioneiro_auxiliar: false,
          estudos_biblicos: '',
          horas: '',
          observacoes: ''
        }));
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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // ----- CLASSES DO TAILWIND ATUALIZADAS -----
  const labelClass = "block text-sm font-medium text-neutral-300";
  // Classe base para inputs, selects e textareas
  const baseInputClass = "mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 placeholder-neutral-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50";
  const checkboxLabelClass = "ml-2 text-sm text-neutral-100 select-none";
  const checkboxClass = "h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-neutral-900";
  
  return (
    // Fundo aplicado pelo layout
    <main className="min-h-screen w-full p-4 md:p-8">
      {/* Cartão do formulário com estilo dark */}
      <div className="max-w-2xl mx-auto bg-neutral-900 p-6 md:p-8 rounded-xl shadow-2xl border border-neutral-800">

        <h2 className="text-3xl font-bold text-center mb-6 text-white">
          Enviar Relatório Mensal
        </h2>
        
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
              Identificação
            </h3>
            <div>
              <label htmlFor="nome_completo" className={labelClass}>Nome Completo</label>
              <input type="text" id="nome_completo" name="nome_completo" value={formData.nome_completo} onChange={handleChange} className={baseInputClass} required />
            </div>

            <div>
              <label htmlFor="nome_grupo" className={labelClass}>Grupo de Campo</label>
              <select 
                id="nome_grupo" 
                name="nome_grupo" 
                value={formData.nome_grupo} 
                onChange={handleChange} 
                className={baseInputClass} // Usa a mesma classe base
                required
              >
                <option value="" disabled>Selecione seu grupo...</option>
                {gruposList.map(grupo => (
                  <option key={grupo} value={grupo}>
                    {grupo}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="data_nascimento" className={labelClass}>Data de Nascimento</label>
              <input type="text" id="data_nascimento" name="data_nascimento" value={formData.data_nascimento} onChange={handleChange} className={baseInputClass} placeholder="dd/mm/aaaa" required />
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white border-b border-neutral-700 pb-2">
              Relatório
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="mes" className={labelClass}>Mês</label>
                <select id="mes" name="mes" value={formData.mes} onChange={handleChange} className={baseInputClass}>
                  {meses.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ano_servico" className={labelClass}>Ano de Serviço</label>
                <input type="number" id="ano_servico" name="ano_servico" placeholder="Ex: 2025" value={formData.ano_servico} onChange={handleChange} className={baseInputClass} required />
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <div className="flex items-center">
                <input id="participou_ministerio" name="participou_ministerio" type="checkbox" checked={formData.participou_ministerio} onChange={handleChange} className={checkboxClass} />
                <label htmlFor="participou_ministerio" className={checkboxLabelClass}>Participei no ministério</label>
              </div>
              <div className="flex items-center">
                <input id="pioneiro_auxiliar" name="pioneiro_auxiliar" type="checkbox" checked={formData.pioneiro_auxiliar} onChange={handleChange} className={checkboxClass} />
                <label htmlFor="pioneiro_auxiliar" className={checkboxLabelClass}>Pioneiro Auxiliar</label>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label htmlFor="estudos_biblicos" className={labelClass}>Estudos Bíblicos</label>
                <input type="number" min="0" id="estudos_biblicos" name="estudos_biblicos" value={formData.estudos_biblicos} onChange={handleChange} className={baseInputClass} />
              </div>
              <div>
                <label htmlFor="horas" className={labelClass}>Horas (Pioneiros/Missionários)</label>
                <input type="number" min="0" id="horas" name="horas" value={formData.horas} onChange={handleChange} className={baseInputClass} />
              </div>
            </div>
            <div>
              <label htmlFor="observacoes" className={labelClass}>Observações</label>
              <textarea id="observacoes" name="observacoes" rows="3" value={formData.observacoes} onChange={handleChange} className={baseInputClass}></textarea>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading} 
            className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Enviando...' : 'Enviar Relatório'}
          </button>
        </form>
      </div>
    </main>
  );
}