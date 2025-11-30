// app/relatorio-mensal/page.jsx

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { IMaskInput } from 'react-imask';
import { CheckCircle, X } from 'lucide-react'; 

// --- NOVO COMPONENTE: SuccessToast ---
function SuccessToast({ message, onClose }) {
  // O Toast flutuante usa animação slide-in do Tailwind CSS
  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-500">
      <div 
        className="bg-green-600 text-white p-4 rounded-lg shadow-xl flex items-center justify-between min-w-[300px]"
        role="alert"
      >
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5" />
          <span className="font-semibold">{message}</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-green-700 rounded-full ml-4">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
// --------------------------------------

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const getPreviousMonth = () => {
  const data = new Date();
  const diaAtual = data.getDate();
  
  if (diaAtual <= 5) {
    // Estamos nos primeiros 5 dias do mês, o relatório é para o mês anterior.
    data.setMonth(data.getMonth() - 1); 
  }
  // Se estamos do dia 6 em diante, o relatório é para o mês atual.
  
  return meses[data.getMonth()];
};

const mesAnterior = getPreviousMonth();

const getServiceYearForMonth = (nomeMes) => {
  const dataAtual = new Date();
  const anoAtual = dataAtual.getFullYear();
  const mesIndex = meses.indexOf(nomeMes);
  
  if (mesIndex >= 8) {
    if (dataAtual.getMonth() >= 8) {
      return anoAtual + 1;
    }
    return anoAtual;
  }
  
  return anoAtual;
};

function RelatorioForm() {
  
  // REMOVIDO: [gruposList, setGruposList]
  const [formData, setFormData] = useState({
    nome_completo: '',
    data_nascimento: '',
    // REMOVIDO: nome_grupo
    mes: mesAnterior, 
    ano_servico: getServiceYearForMonth(mesAnterior), 
    participou_ministerio: null, 
    pioneiro_auxiliar: false,
    pioneiro_regular_local: false, // Campo local e clicável
    estudos_biblicos: '',
    horas: '',
    observacoes: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(''); 
  const [isError, setIsError] = useState(false); 
  
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');


  const searchParams = useSearchParams();
  const publicadorId = searchParams.get('publicadorId');
  
  const [isManualEntry, setIsManualEntry] = useState(!!publicadorId);

  // REMOVIDO: Efeito para carregar grupos

  // Efeito para carregar dados do publicador (Modo Manual)
  useEffect(() => {
    
    if (publicadorId) {
      setIsLoading(true);
      setErrorMessage('Carregando dados do publicador...');
      
      const fetchPublicadorData = async () => {
        try {
          const res = await fetch(`/api/enviar-relatorio-mensal/manual?publicadorId=${publicadorId}`);
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || 'Não foi possível encontrar os dados do publicador.');
          }
          const data = await res.json();
          
          const dataNascFormatada = data.data_nascimento ? 
            new Date(data.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }) 
            : '';
            
          const isPioneiroRegular = data.designacoes?.includes('pioneiro_regular');

          setFormData(prev => ({
            ...prev,
            nome_completo: data.nome_completo,
            data_nascimento: dataNascFormatada, 
            pioneiro_regular_local: isPioneiroRegular || false,
          }));
          
          setErrorMessage(''); 
          setIsError(false);
          
        } catch (err) {
          console.error(err);
          setErrorMessage(err.message);
          setIsError(true);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchPublicadorData();
    } 
  }, [publicadorId]); 
  
  // NOVO EFEITO: Gerenciar a duração do Toast de sucesso
  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => {
        setShowSuccessToast(false);
        // Se a intenção for recarregar a página após a notificação:
        // window.location.reload(); 
      }, 10000); // 10 segundos
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  // Handler de Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.participou_ministerio === null) {
        setErrorMessage('Por favor, indique se participou ou não no ministério.');
        setIsError(true);
        return;
    }
    
    setIsLoading(true);
    setErrorMessage('');
    setIsError(false);
    setShowSuccessToast(false);
    
    try {
      let finalApiUrl;
      let finalBody;
      
      const anoServicoFinal = getServiceYearForMonth(formData.mes);
      const participouMinisterioBooleano = formData.participou_ministerio === 'sim';
      
      const relatorioData = {
          mes: formData.mes,
          ano_servico: anoServicoFinal,
          participou_ministerio: participouMinisterioBooleano, 
          pioneiro_auxiliar: formData.pioneiro_auxiliar,
          // O CAMPO PIONEIRO_REGULAR_LOCAL NÃO É INCLUÍDO NO relatorioData
          estudos_biblicos: formData.estudos_biblicos || null,
          horas: formData.horas || null,
          observacoes: formData.observacoes || null
      };

      if (isManualEntry) {
        finalApiUrl = '/api/enviar-relatorio-mensal/manual';
        finalBody = JSON.stringify({
          publicadorId: publicadorId,
          ...relatorioData
        });
      } else {
        finalApiUrl = '/api/enviar-relatorio-mensal';
        finalBody = JSON.stringify({
          nome_completo: formData.nome_completo.trim(),
          data_nascimento: formData.data_nascimento,
          ...relatorioData
        });
      }

      const response = await fetch(finalApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: finalBody
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccessMessage(data.message || 'Relatório enviado com sucesso!');
        setShowSuccessToast(true);
        
        // Limpar o formulário
        setFormData(prev => ({
          ...prev,
          nome_completo: isManualEntry ? prev.nome_completo : '',
          data_nascimento: isManualEntry ? prev.data_nascimento : '',
          participou_ministerio: null, 
          pioneiro_auxiliar: false,
          pioneiro_regular_local: prev.pioneiro_regular_local, // Mantém o estado local PR
          estudos_biblicos: '',
          horas: '',
          observacoes: ''
        }));
      } else {
        setErrorMessage(data.message || 'Ocorreu um erro.');
        setIsError(true);
      }
    } catch (err) {
      setErrorMessage('Não foi possível conectar ao servidor.');
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
  
  const handleMaskChange = (value, name) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };


  // ----- CLASSES DO TAILWIND (Layout Claro - Dashboard Style) -----
  const labelClass = "block text-sm font-medium text-gray-700";
  const baseInputClass = "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 disabled:opacity-50"; 
  const checkboxLabelClass = "ml-2 text-sm text-gray-700 select-none"; 
  const checkboxClass = "h-4 w-4 rounded border-gray-300 bg-white text-purple-600 focus:ring-purple-500 focus:ring-offset-white"; 

  
  return (
    // Estilo principal: Container branco.
    <div className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-lg border border-gray-200 text-gray-900">
      
      {/* RENDERIZAÇÃO CONDICIONAL DO TOAST DE SUCESSO */}
      {showSuccessToast && (
          <SuccessToast 
            message={successMessage} 
            onClose={() => setShowSuccessToast(false)} 
          />
      )}

      <h2 className="text-3xl font-bold text-center mb-6 text-gray-900">
        {isManualEntry ? 'Enviar Relatório (Manual)' : 'Enviar Relatório Mensal'}
      </h2>
      
      {/* MENSAGENS DE ERRO */}
      {errorMessage && isError && (
        <div className={`p-3 rounded-md mb-6 text-sm bg-red-50 text-red-700 border border-red-200`}>
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
            Identificação
          </h3>
          <div>
            <label htmlFor="nome_completo" className={labelClass}>Nome Completo (ou parte dele)</label>
            <input 
              type="text" id="nome_completo" name="nome_completo" 
              value={formData.nome_completo} onChange={handleChange} 
              className={baseInputClass} required 
              disabled={isManualEntry}
              readOnly={isManualEntry}
            />
          </div>

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
              disabled={isManualEntry}
              readOnly={isManualEntry}
            />
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
            Relatório
          </h3>
          
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="mes" className={labelClass}>Mês</label>
              <select id="mes" name="mes" value={formData.mes} onChange={handleChange} className={baseInputClass}>
                {meses.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="space-y-3 pt-2">
            
            {/* --- RADIO BUTTONS DE PARTICIPAÇÃO --- */}
            <p className='font-medium text-gray-900'>
              Você participou em alguma modalidade de pregação, do testemunho por cartas ou deu testemunho informal?
            </p>
            <div className="flex gap-6">
              <div className="flex items-center">
                <input 
                  id="participou_sim" name="participou_ministerio" type="radio" 
                  value="sim" 
                  checked={formData.participou_ministerio === 'sim'} 
                  onChange={handleChange} 
                  className={checkboxClass} 
                />
                <label htmlFor="participou_sim" className={checkboxLabelClass}>Sim</label>
              </div>
              <div className="flex items-center">
                <input 
                  id="participou_nao" name="participou_ministerio" type="radio" 
                  value="nao" 
                  checked={formData.participou_ministerio === 'nao'} 
                  onChange={handleChange} 
                  className={checkboxClass} 
                />
                <label htmlFor="participou_nao" className={checkboxLabelClass}>Não</label>
              </div>
            </div>
            
            <div className="pt-2 space-y-2">
            
                {/* --- CHECKBOX PIONEIRO REGULAR (LOCAL E CLICÁVEL) --- */}
                <div className="flex items-center">
                    <input 
                        id="pioneiro_regular_local" name="pioneiro_regular_local" type="checkbox" 
                        checked={formData.pioneiro_regular_local} 
                        onChange={handleChange} // Clicável
                        className={checkboxClass} 
                    />
                    <label htmlFor="pioneiro_regular_local" className={`${checkboxLabelClass} text-gray-700`}>
                        Pioneiro Regular
                    </label>
                </div>
                
                {/* CHECKBOX PIONEIRO AUXILIAR */}
                <div className="flex items-center">
                  <input id="pioneiro_auxiliar" name="pioneiro_auxiliar" type="checkbox" checked={formData.pioneiro_auxiliar} onChange={handleChange} className={checkboxClass} />
                  <label htmlFor="pioneiro_auxiliar" className={checkboxLabelClass}>Pioneiro Auxiliar</label>
                </div>
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
            <textarea id="observacoes" name="observacoes" rows="3" value={formData.observacoes} onChange={handleChange} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 disabled:opacity-50"></textarea>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isLoading} 
          className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 transition-colors"
        >
          {isLoading ? (isManualEntry ? 'Carregando...' : 'Enviando...') : 'Enviar Relatório'}
        </button>
      </form>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-lg border border-gray-200">
      <div className="flex justify-center items-center h-96">
        <p className="text-gray-400">A carregar...</p>
      </div>
    </div>
  );
}

export default function RelatorioMensal() {
  return (
    <main className="min-h-screen w-full p-4 md:p-8">
      <Suspense fallback={<LoadingFallback />}>
        <RelatorioForm />
      </Suspense>
    </main>
  );
}