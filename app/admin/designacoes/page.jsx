'use client';

import { useState, useEffect, Suspense } from 'react'; // Importa Suspense
import { Loader2, Printer, UploadCloud, ArrowLeft } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation'; // Importa useSearchParams

// Componente de Fallback para o Suspense
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-900">
      <Loader2 className="size-8 animate-spin text-neutral-400" />
    </div>
  );
}

// Componente principal movido para dentro para usar useSearchParams
function DesignacoesContent() {
  const [publicadores, setPublicadores] = useState([]);
  const [scheduleData, setScheduleData] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  // const printRef = useRef(null); // Não é mais necessário com a correção de CSS

  // Buscar a lista de publicadores
  useEffect(() => {
    async function fetchPublicadores() {
      try {
        const res = await fetch('/api/admin/get-publicadores');
        if (!res.ok) throw new Error('Falha ao buscar publicadores');
        const data = await res.json();
        setPublicadores(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPublicadores();
  }, []);

  // Ler o arquivo RTF e chamar a API interna
  const handleFileParse = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsParsing(true);
    setError('');
    setScheduleData(null);
    setAssignments({});

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const textContent = e.target.result;

        const response = await fetch('/api/admin/parse-rtf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ textContent })
        });

        if (!response.ok) {
          const errData = await response.json();
          const errorMessage = errData.error?.message || errData.message || 'Falha no servidor ao processar o arquivo.';
          throw new Error(errorMessage);
        }

        const parsedData = await response.json();
        setScheduleData(parsedData);
      } catch (err) {
        setError(`Falha ao processar o arquivo: ${err.message}`);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(file, 'ISO-8859-1');
  };

  // Atualiza o state quando um publicador é selecionado
  const handleAssignmentChange = (partId, name) => {
    setAssignments(prev => ({ ...prev, [partId]: name }));
  };

  // Função de impressão (usa o print do navegador)
  const handlePrint = () => {
    window.print();
  };

  // ----- Classes de Estilo -----
  const tdTime = "border border-gray-600 p-2 font-semibold w-20 align-top";
  const tdPart = "border border-gray-600 p-2 align-top";
  
  // CORREÇÃO 1: A célula <td> que contém o nome. Removido o p-0.
  const tdName = "border border-gray-600 p-0 w-2/5 md:w-1/3 name-cell align-top";
  
  // CORREÇÃO 1: O <select> agora tem p-2 para ter padding.
  const selectClass = "w-full bg-neutral-100 border-none p-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 print:hidden";
  
  const printedNameClass = "hidden print:block p-2 text-black font-medium";
  const headerClass = "bg-blue-800 text-white p-2 text-center font-bold text-lg";

  // CORREÇÃO 1: Componente de seleção foi simplificado para não incluir o <td>
  const AssignmentSelect = ({ partId }) => (
    <>
      <select
        value={assignments[partId] || ''}
        onChange={(e) => handleAssignmentChange(partId, e.target.value)}
        className={selectClass}
      >
        <option value="" disabled>Selecione...</option>
        {publicadores.map(p => (
          <option key={p.id} value={p.nome_completo}>{p.nome_completo}</option>
        ))}
      </select>
      <div className={printedNameClass}>
        {assignments[partId] || '...'}
      </div>
    </>
  );
  
  // Renderização
  if (isLoading) {
    return <LoadingFallback />; // Usa o fallback
  }

  return (
    // CORREÇÃO 2: Removido print:bg-white e print:text-black daqui.
    <main className="min-h-screen w-full bg-neutral-900 text-neutral-100 p-4 md:p-8">
      
      {/* === CABEÇALHO DE CONTROLE === */}
      {/* CORREÇÃO 2: Adicionado 'print:hidden' para esconder este bloco na impressão */}
      <div className="max-w-4xl mx-auto mb-6 p-6 bg-neutral-800 rounded-lg shadow-md print:hidden">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Designações da Reunião</h2>
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold text-neutral-100 bg-neutral-700 hover:bg-neutral-600"
          >
            <ArrowLeft size={16} /> Voltar ao Painel
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-md mb-4 bg-red-900/30 text-red-300 border border-red-800 text-sm">
            {error}
          </div>
        )}

        <label 
          htmlFor="rtf-upload" 
          className="cursor-pointer w-full p-6 border-2 border-dashed border-neutral-600 rounded-lg flex flex-col items-center justify-center text-center hover:bg-neutral-700 transition"
        >
          <UploadCloud size={40} className="text-neutral-400 mb-2" />
          <span className="font-semibold">Clique para carregar o arquivo .RTF</span>
          <span className="text-xs text-neutral-400">Envie o arquivo RTF da semana (ex: mwb_T_202511_02.rtf)</span>
        </label>
        <input id="rtf-upload" type="file" accept=".rtf, .txt" className="hidden" onChange={handleFileParse} />
        
        {isParsing && (
          <div className="flex items-center justify-center gap-2 text-blue-300 mt-4">
            <Loader2 className="size-5 animate-spin" />
            Processando arquivo com IA...
          </div>
        )}
      </div>

      {/* === PROGRAMA GERADO (SÓ APARECE DEPOIS DE PROCESSAR) === */}
      {scheduleData && (
        // CORREÇÃO 2: Adicionada a classe 'printable-content' que o seu globals.css espera.
        <div className="printable-content bg-white text-black rounded-lg shadow-lg overflow-hidden border border-gray-300 max-w-4xl mx-auto" id="schedule-container">
          <div className="p-4 md:p-6">
            
            {/* TÍTULOS DA SEMANA */}
            <div className="mb-4 text-center">
              <h2 className="text-xl md:text-2xl font-bold text-blue-700">{scheduleData.weekDate}</h2>
              <h3 className="text-lg md:text-xl font-semibold text-gray-800">{scheduleData.bibleReading}</h3>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Nossa Vida e Ministério Cristão</h1>
            </div>

            {/* CAIXA DO SALÃO PRINCIPAL */}
            <div className="flex justify-end mb-2 print:justify-end">
              <div className="w-full md:w-2/5 lg:w-1/3 border-2 border-gray-700 rounded-lg p-3">
                <h3 className="text-center font-bold text-lg mb-2">Salão Principal</h3>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="font-semibold text-gray-700">Presidente:</label>
                    {/* CORREÇÃO 1: O div w-2/3 agora contém o <AssignmentSelect> */}
                    <div className="w-2/3">
                      <AssignmentSelect partId="presidente" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="font-semibold text-gray-700">Ajudante:</label>
                    <div className="w-2/3">
                      <AssignmentSelect partId="ajudante" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TABELA DE DESIGNAÇÕES */}
            <table className="w-full border-collapse border-2 border-gray-700">
              <tbody className="text-gray-900">
                
                {/* CORREÇÃO 1: O <AssignmentSelect> está agora DENTRO do <td> */}
                <tr>
                  <td className={tdTime}></td>
                  <td className={tdPart}>
                    {scheduleData.initialSong}
                    <span className="float-right font-bold text-gray-700">Oração</span>
                  </td>
                  <td className={tdName}>
                    <AssignmentSelect partId="oracao_inicial" />
                  </td>
                </tr>
                
                <tr>
                  <td className={tdTime}></td>
                  <td className={tdPart}>{scheduleData.openingComments}</td>
                  <td className={tdName}>
                    <AssignmentSelect partId="comentarios_iniciais" />
                  </td>
                </tr>

                {/* Tesouros */}
                <tr><td colSpan="3" className={headerClass}>TESOUROS DA PALAVRA DE DEUS</td></tr>
                {scheduleData.treasures?.map((part, index) => (
                  <tr key={`t-${index}`}>
                    <td className={tdTime}></td>
                    <td className={tdPart}>{part.title}</td>
                    <td className={tdName}>
                      <AssignmentSelect partId={`tesouro_${index}`} />
                    </td>
                  </tr>
                ))}
                
                {/* Ministério */}
                <tr><td colSpan="3" className={headerClass}>FAÇA SEU MELHOR NO MINISTÉRIO</td></tr>
                {scheduleData.ministry?.map((part, index) => (
                  <tr key={`m-${index}`}>
                    <td className={tdTime}></td>
                    <td className={tdPart}>{part.title}</td>
                    <td className={tdName}>
                      <AssignmentSelect partId={`ministerio_${index}`} />
                    </td>
                  </tr>
                ))}

                {/* Nossa Vida */}
                <tr><td colSpan="3" className={headerClass}>NOSSA VIDA CRISTÃ</td></tr>
                {scheduleData.living?.map((part, index) => (
                  <tr key={`v-${index}`}>
                    <td className={tdTime}></td>
                    <td className={tdPart}>{part.title}</td>
                    <td className={tdName}>
                      <AssignmentSelect partId={`vida_${index}`} />
                    </td>
                  </tr>
                ))}

                {/* Finais */}
                <tr>
                  <td className={tdTime}></td>
                  <td className={tdPart}>{scheduleData.finalComments}</td>
                  <td className={tdName}>
                    <AssignmentSelect partId="comentarios_finais" />
                  </td>
                </tr>
                
                <tr>
                  <td className={tdTime}></td>
                  <td className={tdPart}>
                    {scheduleData.finalSong}
                    <span className="float-right font-bold text-gray-700">Oração</span>
                  </td>
                  <td className={tdName}>
                    <AssignmentSelect partId="oracao_final" />
                  </td>
                </tr>

              </tbody>
            </table>
            
            {/* Botão de Impressão */}
            {/* CORREÇÃO 2: Adicionado 'print:hidden' */}
            <div className="mt-6 flex justify-center print:hidden">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                <Printer size={18} />
                Imprimir Programa
              </button>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}

// Componente da página principal que "suspende" o conteúdo
export default function DesignacoesPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DesignacoesContent />
    </Suspense>
  );
}