'use client';

// Corrigido: Importa o React corretamente
import { useState, useEffect, useRef } from 'react';
import { Loader2, Printer, UploadCloud, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Componente principal da página
export default function DesignacoesPage() {
  const [publicadores, setPublicadores] = useState([]);
  const [scheduleData, setScheduleData] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const printRef = useRef(null);

  // 1. Buscar a lista de publicadores da sua API existente
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

  // 2. Função para ler o arquivo RTF e chamar a NOSSA API INTERNA
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

        // --- MUDANÇA PRINCIPAL ---
        // Agora chamamos a NOSSA API interna, que é segura (server-side)
        const response = await fetch('/api/admin/parse-rtf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ textContent }) // Enviamos o texto lido
        });

        if (!response.ok) {
          const errData = await response.json();
          // O errData.message virá da nossa API, que pode incluir o erro da Gemini
          // Corrigido para verificar se o erro da Gemini está aninhado
          const errorMessage = errData.error || errData.message || 'Falha no servidor ao processar o arquivo.';
          throw new Error(errorMessage);
        }

        // A resposta já é o JSON processado
        const parsedData = await response.json();
        // --- FIM DA MUDANÇA ---
        
        setScheduleData(parsedData);
      } catch (err) {
        // O erro agora será mais claro
        setError(`Falha ao processar o arquivo: ${err.message}`);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(file, 'ISO-8859-1'); // Encoding para ler RTF
  };

  // 3. A função callGeminiToParse() FOI REMOVIDA DAQUI
  //    Ela agora vive no arquivo /api/admin/parse-rtf/route.js

  // 4. Atualiza o state quando um publicador é selecionado
  const handleAssignmentChange = (partId, name) => {
    setAssignments(prev => ({ ...prev, [partId]: name }));
  };

  // 5. Função de impressão
  const handlePrint = () => {
    window.print();
  };

  // ----- Classes de Estilo -----
  const tdTime = "border border-gray-600 p-2 font-semibold w-20 align-top";
  const tdPart = "border border-gray-600 p-2 align-top";
  const tdName = "border border-gray-600 p-0 w-2/5 md:w-1/3 name-cell align-top";
  const selectClass = "w-full bg-neutral-100 border-none p-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 print:hidden";
  const printedNameClass = "hidden print:block p-2 text-black font-medium"; // Mostra o nome selecionado ao imprimir
  const headerClass = "bg-blue-800 text-white p-2 text-center font-bold text-lg";

  // Componente para o dropdown de seleção
  const AssignmentSelect = ({ partId }) => (
    <div className={tdName}>
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
      {/* Isso só aparece na impressão */}
      <div className={printedNameClass}>
        {assignments[partId] || '...'}
      </div>
    </div>
  );
  
  // Renderização
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-900">
        <Loader2 className="size-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full bg-neutral-900 text-neutral-100 p-4 md:p-8 print:bg-white print:text-black">
      
      {/* === CABEÇALHO DE CONTROLE (NÃO IMPRIME) === */}
      <div className="no-print max-w-4xl mx-auto mb-6 p-6 bg-neutral-800 rounded-lg shadow-md">
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
        <div ref={printRef} className="print-container bg-white text-black rounded-lg shadow-lg overflow-hidden border border-gray-300 max-w-4xl mx-auto" id="schedule-container">
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
                
                <tr>
                  <td className={tdTime}></td>
                  <td className={tdPart}>
                    {scheduleData.initialSong}
                    <span className="float-right font-bold text-gray-700">Oração</span>
                  </td>
                  <AssignmentSelect partId="oracao_inicial" />
                </tr>
                
                <tr>
                  <td className={tdTime}></td>
                  <td className={tdPart}>{scheduleData.openingComments}</td>
                  <AssignmentSelect partId="comentarios_iniciais" />
                </tr>

                {/* Tesouros */}
                <tr><td colSpan="3" className={headerClass}>TESOUROS DA PALAVRA DE DEUS</td></tr>
                {scheduleData.treasures?.map((part, index) => (
                  <tr key={`t-${index}`}>
                    <td className={tdTime}></td>
                    <td className={tdPart}>{part.title}</td>
                    <AssignmentSelect partId={`tesouro_${index}`} />
                  </tr>
                ))}
                
                {/* Ministério */}
                <tr><td colSpan="3" className={headerClass}>FAÇA SEU MELHOR NO MINISTÉRIO</td></tr>
                {scheduleData.ministry?.map((part, index) => (
                  <tr key={`m-${index}`}>
                    <td className={tdTime}></td>
                    <td className="border border-gray-600 p-2 align-top">{part.title}</td>
                    <AssignmentSelect partId={`ministerio_${index}`} />
                  </tr>
                ))}

                {/* Nossa Vida */}
                <tr><td colSpan="3" className={headerClass}>NOSSA VIDA CRISTÃ</td></tr>
                {scheduleData.living?.map((part, index) => (
                  <tr key={`v-${index}`}>
                    <td className={tdTime}></td>
                    <td className={tdPart}>{part.title}</td>
                    <AssignmentSelect partId={`vida_${index}`} />
                  </tr>
                ))}

                {/* Finais */}
                <tr>
                  <td className={tdTime}></td>
                  <td className={tdPart}>{scheduleData.finalComments}</td>
                  <AssignmentSelect partId="comentarios_finais" />
                </tr>
                
                <tr>
                  <td className={tdTime}></td>
                  <td className={tdPart}>
                    {scheduleData.finalSong}
                    <span className="float-right font-bold text-gray-700">Oração</span>
                  </td>
                  <AssignmentSelect partId="oracao_final" />
                </tr>

              </tbody>
            </table>
            
            {/* Botão de Impressão */}
            <div className="mt-6 flex justify-center no-print">
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