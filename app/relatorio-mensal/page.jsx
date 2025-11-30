// app/relatorio-mensal/page.jsx

'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
// Adiciona AlertTriangle para ícone de erro
import { CheckCircle, X, AlertTriangle } from 'lucide-react'; 
import { IMaskInput } from 'react-imask';

// --- NOVO COMPONENTE: StatusToast (unifica sucesso e erro) ---
function StatusToast({ message, type, onClose }) {
  if (!message) return null;
    
  const isError = type === 'error';
  
  // Define cores e ícones com base no tipo
  const bgColor = isError ? 'bg-red-600' : 'bg-green-600';
  const hoverColor = isError ? 'hover:bg-red-700' : 'hover:bg-green-700';
  const Icon = isError ? AlertTriangle : CheckCircle; 

  // O Toast flutuante usa animação slide-in do Tailwind CSS
  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-500">
      <div 
        className={`${bgColor} text-white p-4 rounded-lg shadow-xl flex items-center justify-between min-w-[300px]`}
        role="alert"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5" />
          <span className="font-semibold">{message}</span>
        </div>
        <button onClick={onClose} className={`p-1 ${hoverColor} rounded-full ml-4`}>
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
  
  // O ano de serviço é o ano de término do ciclo.
  // Se o mês for Jan (0) a Ago (7), o ano de serviço é o ano atual.
  // Se o mês for Set (8) a Dez (11), o ano de serviço é o ano seguinte.
  if (mesIndex >= 8) { // Setembro a Dezembro
    return anoAtual + 1;
  }
  
  return anoAtual;
};

function RelatorioForm() {
  
  const [formData, setFormData] = useState({
    nome_completo: '',
    data_nascimento: '',
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
  
  // NOVO ESTADO UNIFICADO PARA NOTIFICAÇÃO
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState(''); // 'success' or 'error'

  const searchParams = useSearchParams();
  const publicadorId = searchParams.get('publicadorId');
  
  const [isManualEntry, setIsManualEntry] = useState(!!publicadorId);


  // Efeito para carregar dados do publicador (Modo Manual)
  useEffect(() => {
    
    if (publicadorId) {
      setIsLoading(true);
      // Exibe mensagem de loading como toast
      setToastMessage('Carregando dados do publicador...');
      setToastType('success'); 
      setShowToast(true);
      
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
          
          // Limpa mensagem de loading (toast será fechado pelo timeout)
          setToastMessage(''); 
          setToastType('');
          setShowToast(false);
          
        } catch (err) {
          console.error(err);
          // Exibe erro como toast
          setToastMessage(err.message);
          setToastType('error');
          setShowToast(true);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchPublicadorData();
    } 
  }, [publicadorId]); 
  
  // NOVO EFEITO: Gerenciar a duração do Toast
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 10000); // 10 segundos
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Handler de Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.participou_ministerio === null) {
        setToastMessage('Por favor, indique se participou ou não no ministério.');
        setToastType('error');
        setShowToast(true);
        return;
    }
    
    setIsLoading(true);
    setShowToast(false); // Esconde toasts anteriores

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
        // Aqui o trim() deve ser aplicado na página/componente principal (como fizemos)
        finalBody = JSON.stringify({ 
          nome_completo: formData.nome_completo.trim(), // Garantindo trim() aqui também
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
        setToastMessage(data.message || 'Relatório enviado com sucesso!');
        setToastType('success');
        setShowToast(true);
        
        // Limpar o formulário
        setFormData(prev => ({
          ...prev,
          nome_completo: isManualEntry ? prev.nome_completo : '',
          data_nascimento: isManualEntry ? prev.data_nascimento : '',
          participou_ministerio: null, 
          pioneiro_auxiliar: false,
          pioneiro_regular_local: prev.pioneiro_regular_local, 
          estudos_biblicos: '',
          horas: '',
          observacoes: ''
        }));
      } else {
        setToastMessage(data.message || 'Ocorreu um erro.');
        setToastType('error');
        setShowToast(true);
      }
    } catch (err) {
      setToastMessage('Não foi possível conectar ao servidor.');
      setToastType('error');
      setShowToast(true);
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


  // ----- CLASSES DO TAILWIND -----
  const labelClass = "block text-sm font-medium text-gray-700";
  const baseInputClass = "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 disabled:opacity-50"; 
  const checkboxLabelClass = "ml-2 text-sm text-gray-700 select-none"; 
  const checkboxClass = "h-4 w-4 rounded border-gray-300 bg-white text-purple-600 focus:ring-purple-500 focus:ring-offset-white"; 

  
  return (
    // Estilo principal: Container branco.
    <div className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-lg border border-gray-200 text-gray-900">
      
      {/* RENDERIZAÇÃO CONDICIONAL DO TOAST DE STATUS */}
      {showToast && (
          <StatusToast 
            message={toastMessage} 
            type={toastType} 
            onClose={() => setShowToast(false)} 
          />
      )}

      <h2 className="text-3xl font-bold text-center mb-6 text-gray-900">
        {isManualEntry ? 'Enviar Relatório (Manual)' : 'Enviar Relatório Mensal'}
      </h2>
      
      {/* REMOVIDO: Antigo bloco de mensagem de erro estática */}
      {/* NOTA: A mensagem de erro vermelha DENTRO do form (como na imagem original) 
      será substituída pelo toast flutuante */}

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
                    <label htmlFor="pioneiro_regular_local" className={`${checkboxLabelClass} font-medium text-gray-700`}>
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