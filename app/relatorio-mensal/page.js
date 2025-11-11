'use client';

// 1. Importe o useEffect
import { useState, useEffect } from 'react';

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const mesAtual = meses[new Date().getMonth()];

export default function RelatorioMensal() {
  
  // 2. Crie um state para a lista de grupos
  const [gruposList, setGruposList] = useState([]); // Inicia como um array vazio

  const [formData, setFormData] = useState({
    nome_completo: '',
    data_nascimento: '',
    nome_grupo: '', // Inicia vazio
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

  // 3. Use o useEffect para buscar os grupos quando a página carregar
  useEffect(() => {
    // Função assíncrona para buscar os dados
    const fetchGrupos = async () => {
      try {
        const response = await fetch('/api/get-grupos');
        if (!response.ok) {
          throw new Error('Falha ao carregar grupos');
        }
        const data = await response.json();
        setGruposList(data); // Salva a lista de grupos no state
        
        // Opcional: define o primeiro grupo da lista como padrão
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, nome_grupo: data[0] }));
        }

      } catch (err) {
        console.error(err);
        // Você pode mostrar uma mensagem de erro para o usuário aqui
      }
    };

    fetchGrupos(); // Chama a função
  }, []); // O array vazio [] significa que isso roda apenas UMA VEZ

  // --- Lógica de Handlers e Submit (Não muda) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validação para garantir que um grupo foi selecionado
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
  // --- Fim da Lógica ---

  // ----- O VISUAL ATUALIZADO (Tailwind Puro) -----

  const labelClass = "block text-sm font-medium text-gray-700";
  const inputClass = "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500";
  const checkboxLabelClass = "ml-2 text-sm text-gray-900";
  const checkboxClass = "h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500";
  
  return (
    <main className="min-h-screen w-full bg-gray-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-lg">

        <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">
          Enviar Relatório Mensal
        </h2>
        
        {message && (
          <div className={`p-3 rounded-md mb-6 text-sm ${isError ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-700 border-b pb-2">
              Identificação
            </h3>
            <div>
              <label htmlFor="nome_completo" className={labelClass}>Nome Completo</label>
              <input type="text" id="nome_completo" name="nome_completo" value={formData.nome_completo} onChange={handleChange} className={inputClass} required />
            </div>

            {/* --- CAMPO DE GRUPO ATUALIZADO PARA DROPDOWN --- */}
            <div>
              <label htmlFor="nome_grupo" className={labelClass}>Grupo de Campo</label>
              <select 
                id="nome_grupo" 
                name="nome_grupo" 
                value={formData.nome_grupo} 
                onChange={handleChange} 
                className={inputClass}
                required
              >
                <option value="" disabled>Selecione seu grupo...</option>
                {/* Popula os grupos dinamicamente */}
                {gruposList.map(grupo => (
                  <option key={grupo} value={grupo}>
                    {grupo}
                  </option>
                ))}
              </select>
            </div>
            {/* --- FIM DA MUDANÇA --- */}
            
            <div>
              <label htmlFor="data_nascimento" className={labelClass}>Data de Nascimento</label>
              <input type="text" id="data_nascimento" name="data_nascimento" value={formData.data_nascimento} onChange={handleChange} className={inputClass} placeholder="dd/mm/aaaa" required />
            </div>
          </div>

          {/* ... (Resto do formulário não muda) ... */}
          
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-700 border-b pb-2">
              Relatório
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="mes" className={labelClass}>Mês</label>
                <select id="mes" name="mes" value={formData.mes} onChange={handleChange} className={inputClass}>
                  <option value="Janeiro">Janeiro</option>
                  <option value="Fevereiro">Fevereiro</option>
                  <option value="Março">Março</option>
                  <option value="Abril">Abril</option>
                  <option value="Maio">Maio</option>
                  <option value="Junho">Junho</option>
                  <option value="Julho">Julho</option>
                  <option value="Agosto">Agosto</option>
                  <option value="Setembro">Setembro</option>
                  <option value="Outubro">Outubro</option>
                  <option value="Novembro">Novembro</option>
                  <option value="Dezembro">Dezembro</option>
                </select>
              </div>
              <div>
                <label htmlFor="ano_servico" className={labelClass}>Ano de Serviço</label>
                <input type="number" id="ano_servico" name="ano_servico" placeholder="Ex: 2025" value={formData.ano_servico} onChange={handleChange} className={inputClass} required />
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
                <input type="number" min="0" id="estudos_biblicos" name="estudos_biblicos" value={formData.estudos_biblicos} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label htmlFor="horas" className={labelClass}>Horas (Pioneiros/Missionários)</label>
                <input type="number" min="0" id="horas" name="horas" value={formData.horas} onChange={handleChange} className={inputClass} />
              </div>
            </div>
            <div>
              <label htmlFor="observacoes" className={labelClass}>Observações</label>
              <textarea id="observacoes" name="observacoes" rows="3" value={formData.observacoes} onChange={handleChange} className={inputClass}></textarea>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading} 
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? 'Enviando...' : 'Enviar Relatório'}
          </button>
        </form>
      </div>
    </main>
  );
}