'use client';

// Importações do React e Lucide
import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Loader2, 
  Printer, 
  UploadCloud, 
  ArrowLeft,
  ChevronsUpDown,
  Save 
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// --- 1. FUNÇÃO: Pegar Primeiro e Último Nome ---
function getShortName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';
  const parts = fullName.split(' ').filter(Boolean);
  if (parts.length === 1) return fullName;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}
// --- FIM DA FUNÇÃO ---


// --- Componente AssignmentSelect (ATUALIZADO) ---
const AssignmentSelect = ({ partId, publicadores, assignments, handleAssignmentChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef(null);

  const currentValue = assignments[partId] || ""; // NOME COMPLETO
  
  const selectedPublicador = publicadores.find(
    (p) => p.nome_completo.toLowerCase() === currentValue.toLowerCase()
  );

  const filteredPublicadores = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    if (!searchLower) {
      return publicadores;
    }
    return publicadores.filter((p) =>
      p.nome_completo.toLowerCase().includes(searchLower) ||
      p.nome_curto.toLowerCase().includes(searchLower)
    );
  }, [publicadores, searchTerm]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const printedNameClass = "hidden print:block p-1 text-black font-medium";
  
  return (
    <>
      <div ref={wrapperRef} className="relative w-full print:hidden">
        <button
          type="button"
          // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
          role="combobox"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex justify-between items-center bg-neutral-100 border-none py-1 px-2 text-black font-normal hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span className="truncate">
            {selectedPublicador ? selectedPublicador.nome_curto : "Selecione..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
            <input
              type="text"
              placeholder="Buscar publicador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-1 px-2 text-black border-b border-gray-200 outline-none"
              autoFocus
            />
            <ul className="max-h-60 overflow-y-auto">
              {filteredPublicadores.length > 0 ? (
                filteredPublicadores.map((publicador) => (
                  <li key={publicador.id}>
                    <button
                      type="button"
                      className="w-full text-left py-1 px-2 text-black hover:bg-neutral-100 truncate"
                      onClick={() => {
                        handleAssignmentChange(partId, publicador.nome_completo);
                        setIsOpen(false);
                        setSearchTerm("");
                      }}
                    >
                      {publicador.nome_curto}
                    </button>
                  </li>
                ))
              ) : (
                <li className="p-2 text-sm text-gray-500 text-center">
                  Nenhum publicador encontrado.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className={printedNameClass}>
        {selectedPublicador ? selectedPublicador.nome_curto : '...'}
      </div>
    </>
  );
};
// --- FIM DO COMPONENTE AssignmentSelect ---


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

  const [meetingDate, setMeetingDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ text: '', isError: false });

  // 1. Buscar a lista de publicadores
  useEffect(() => {
    async function fetchPublicadores() {
      try {
        const res = await fetch('/api/admin/get-publicadores');
        if (!res.ok) throw new Error('Falha ao buscar publicadores');
        const data = await res.json();
        
        const publicadoresComNomeCurto = data.map(p => ({
          ...p,
          // Se tiver 'nome_chamado', usa ele. Senão, usa a função getShortName.
          nome_curto: p.nome_chamado ? p.nome_chamado : getShortName(p.nome_completo)
        }));
        setPublicadores(publicadoresComNomeCurto);

      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPublicadores();
  }, []);

  // 2. Função para ler o arquivo RTF (sem alteração)
  const handleFileParse = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsParsing(true);
    setError('');
    setScheduleData(null);
    setAssignments({});
    setSaveMessage({ text: '', isError: false });
    setMeetingDate('');

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
          const errorMessage = errData.error || errData.message || 'Falha no servidor ao processar o arquivo.';
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

  // 3. Atualiza o state (sem alteração)
  const handleAssignmentChange = (partId, name) => {
    setAssignments(prev => ({ ...prev, [partId]: name }));
  };

  // 4. Função de impressão (sem alteração)
  const handlePrint = () => {
    window.print();
  };

  // 5. Função: Salvar Designações (sem alteração)
  const handleSaveAssignments = async () => {
    if (!meetingDate) {
      setSaveMessage({ text: 'Por favor, selecione a data de início da semana da reunião.', isError: true });
      return;
    }
    if (!scheduleData || Object.keys(assignments).length === 0) {
      setSaveMessage({ text: 'Não há dados de programa ou designações para salvar.', isError: true });
      return;
    }

    setIsSaving(true);
    setSaveMessage({ text: '', isError: false });

    try {
      const response = await fetch('/api/admin/salvar-designacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleData,
          assignments,
          meetingDate
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Erro desconhecido ao salvar.');
      }

      setSaveMessage({ text: data.message, isError: false });

    } catch (err) {
      setSaveMessage({ text: err.message, isError: true });
    } finally {
      setIsSaving(false);
    }
  };


  // Classes de Estilo (com padding reduzido)
  const tdTime = "border border-gray-600 py-1 px-2 font-semibold w-20 align-top";
  const tdPart = "border border-gray-600 py-1 px-2 align-top";
  const tdName = "border border-gray-600 p-0 w-2/5 md:w-1/3 name-cell align-top";
  const headerClass = "bg-blue-800 text-white p-2 text-center font-bold text-lg";

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

        {saveMessage.text && (
          <div className={`p-3 rounded-md mb-4 text-sm ${
            saveMessage.isError 
              ? 'bg-red-900/30 text-red-300 border border-red-800' 
              : 'bg-green-900/30 text-green-300 border border-green-800'
          }`}>
            {saveMessage.text}
          </div>
        )}

        <label 
          htmlFor="rtf-upload" 
          className="cursor-pointer w-full p-6 border-2 border-dashed border-neutral-600 rounded-lg flex flex-col items-center justify-center text-center hover:bg-neutral-700 transition"
        >
          <UploadCloud size={40} className="text-neutral-400 mb-2" />
          <span className="font-semibold">Clique para carregar o arquivo .RTF</span>
          <span className="text-xs text-neutral-400">Envie o arquivo RTF da semana</span>
        </label>
        <input id="rtf-upload" type="file" accept=".rtf, .txt" className="hidden" onChange={handleFileParse} />
        
        {isParsing && (
          <div className="flex items-center justify-center gap-2 text-blue-300 mt-4">
            <Loader2 className="size-5 animate-spin" />
            Processando arquivo com IA...
          </div>
        )}

        {scheduleData && (
          <div className="mt-4">
            <label htmlFor="meeting-date" className="block text-sm font-medium text-neutral-300 mb-1">
              Data de Início da Semana (Segunda-feira)
            </label>
            <input
              type="date"
              id="meeting-date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full max-w-xs rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* === PROGRAMA GERADO (SÓ APARECE DEPOIS DE PROCESSAR) === */}
      {scheduleData && (
        <div ref={printRef} className="print-container bg-white text-black rounded-lg shadow-lg overflow-hidden border border-gray-300 max-w-4xl mx-auto" id="schedule-container">
          <div className="p-4 md:p-6">
            
            {/* === CABEÇALHO E CAIXA (NOVO LAYOUT) === */}
            <div className="flex justify-between items-start mb-4">
              
              <div className="flex-1 pr-4 text-center">
                <h2 className="text-lg font-bold text-blue-700">
                  {scheduleData.weekDate} - {scheduleData.bibleReading}
                </h2>
                <h1 className="text-2xl font-bold text-gray-900">
                  Nossa Vida e Ministério Cristão
                </h1>
              </div>

              <div className="w-2/5 lg:w-1/3 border-2 border-gray-700 rounded-lg p-3 shrink-0">
                <h3 className="text-center font-bold text-lg mb-2">Salão Principal</h3>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="font-semibold text-gray-700">Presidente:</label>
                    <div className="w-2/3">
                      <AssignmentSelect 
                        partId="presidente" 
                        publicadores={publicadores}
                        assignments={assignments}
                        handleAssignmentChange={handleAssignmentChange}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="font-semibold text-gray-700">Ajudante:</label>
                    <div className="w-2/3">
                      <AssignmentSelect 
                        partId="ajudante" 
                        publicadores={publicadores}
                        assignments={assignments}
                        handleAssignmentChange={handleAssignmentChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* === FIM DO NOVO LAYOUT DO CABEÇALHO === */}


            {/* TABELA DE DESIGNAÇÕES */}
            <table className="w-full border-collapse border-2 border-gray-700">
              <tbody className="text-gray-900">
                
                <tr>
                  <td className={tdTime}></td>
                  <td className={tdPart}>
                    {scheduleData.initialSong}
                    <span className="float-right font-bold text-gray-700">Oração</span>
                  </td>
                  <td className={tdName}>
                    <AssignmentSelect 
                      partId="oracao_inicial"
                      publicadores={publicadores}
                      assignments={assignments}
                      handleAssignmentChange={handleAssignmentChange}
                    />
                  </td>
                </tr>
                
                <tr>
                  <td className={tdTime}></td>
                  <td className={tdPart}>{scheduleData.openingComments}</td>
                  <td className={tdName}>
                    <AssignmentSelect 
                      partId="comentarios_iniciais"
                      publicadores={publicadores}
                      assignments={assignments}
                      handleAssignmentChange={handleAssignmentChange}
                    />
                  </td>
                </tr>

                {/* Tesouros */}
                <tr><td colSpan="3" className={headerClass}>TESOUROS DA PALAVRA DE DEUS</td></tr>
                {scheduleData.treasures?.map((part, index) => (
                  <tr key={`t-${index}`}>
                    <td className={tdTime}></td>
                    <td className={tdPart}>{part.title}</td>
                    <td className={tdName}>
                      <AssignmentSelect 
                        partId={`tesouro_${index}`}
                        publicadores={publicadores}
                        assignments={assignments}
                        handleAssignmentChange={handleAssignmentChange}
                      />
                    </td>
                  </tr>
                ))}
                
                {/* Ministério */}
                <tr><td colSpan="3" className={headerClass}>FAÇA SEU MELHOR NO MINISTÉRIO</td></tr>
                {scheduleData.ministry?.map((part, index) => {
                  const isDiscurso = part.title.toLowerCase().includes('discurso:');
                  
                  return (
                    <tr key={`m-${index}`}>
                      <td className={tdTime}></td>
                      <td className="border border-gray-600 py-1 px-2 align-top">{part.title}</td>
                      
                      <td className={tdName}>
                        {isDiscurso ? (
                          <AssignmentSelect 
                            partId={`ministerio_${index}`}
                            publicadores={publicadores}
                            assignments={assignments}
                            handleAssignmentChange={handleAssignmentChange}
                          />
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <AssignmentSelect 
                              partId={`ministerio_${index}_1`}
                              publicadores={publicadores}
                              assignments={assignments}
                              handleAssignmentChange={handleAssignmentChange}
                            />
                            <AssignmentSelect 
                              partId={`ministerio_${index}_2`}
                              publicadores={publicadores}
                              assignments={assignments}
                              handleAssignmentChange={handleAssignmentChange}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* --- SEÇÃO NOSSA VIDA CRISTÃ ATUALIZADA --- */}
                <tr><td colSpan="3" className={headerClass}>NOSSA VIDA CRISTÃ</td></tr>
                {scheduleData.living?.map((part, index) => {
                  // --- ATUALIZADO: Verifica se é o Estudo Bíblico ---
                  const isBibleStudy = part.title.toLowerCase().includes('estudo bíblico');
                  
                  return (
                    <tr key={`v-${index}`}>
                      <td className={tdTime}></td>
                      <td className={tdPart}>{part.title}</td>
                      <td className={tdName}>
                        {isBibleStudy ? (
                          // Se for Estudo Bíblico, renderiza DOIS
                          <div className="flex flex-col gap-0.5">
                            <AssignmentSelect 
                              partId={`vida_${index}_1`}
                              publicadores={publicadores}
                              assignments={assignments}
                              handleAssignmentChange={handleAssignmentChange}
                            />
                            <AssignmentSelect 
                              partId={`vida_${index}_2`}
                              publicadores={publicadores}
                              assignments={assignments}
                              handleAssignmentChange={handleAssignmentChange}
                            />
                          </div>
                        ) : (
                          // Senão, renderiza SÓ UM
                          <AssignmentSelect 
                            partId={`vida_${index}`}
                            publicadores={publicadores}
                            assignments={assignments}
                            handleAssignmentChange={handleAssignmentChange}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* --- FIM DA SEÇÃO --- */}

                {/* Finais */}
                <tr>
                  <td className={tdTime}></td>
                  <td className={tdPart}>{scheduleData.finalComments}</td>
                  <td className={tdName}>
                    <AssignmentSelect 
                      partId="comentarios_finais"
                      publicadores={publicadores}
                      assignments={assignments}
                      handleAssignmentChange={handleAssignmentChange}
                    />
                  </td>
                </tr>
                
                <tr>
                  <td className={tdTime}></td>
                  <td className={tdPart}>
                    {scheduleData.finalSong}
                    <span className="float-right font-bold text-gray-700">Oração</span>
                  </td>
                  <td className={tdName}>
                    <AssignmentSelect 
                      partId="oracao_final"
                      publicadores={publicadores}
                      assignments={assignments}
                      handleAssignmentChange={handleAssignmentChange}
                    />
                  </td>
                </tr>

              </tbody>
            </table>
            
            {/* Botões de Ação */}
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-4 no-print">
              <button
                onClick={handleSaveAssignments}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-500 transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {isSaving ? 'Salvando...' : 'Salvar no Histórico'}
              </button>
              
              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
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