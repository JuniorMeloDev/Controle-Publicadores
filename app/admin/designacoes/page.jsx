'use client';

// Importações do React e Lucide (sem shadcn)
import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Loader2, 
  Printer, 
  UploadCloud, 
  ArrowLeft,
  ChevronsUpDown // Ícone para o botão
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// --- ATUALIZADO: Componente Combobox (NÃO RENDERIZA MAIS O <td>) ---
const AssignmentSelect = ({ partId, publicadores, assignments, handleAssignmentChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef(null); // Ref para detectar clique fora

  const currentValue = assignments[partId] || "";
  const selectedPublicador = publicadores.find(
    (p) => p.nome_completo.toLowerCase() === currentValue.toLowerCase()
  );

  // Filtra a lista de publicadores com base na busca
  const filteredPublicadores = useMemo(() => {
    if (!searchTerm) {
      return publicadores;
    }
    return publicadores.filter((p) =>
      p.nome_completo.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [publicadores, searchTerm]);

  // Efeito para fechar o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm(""); // Limpa a busca ao fechar
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  // Classe para o nome impresso
  const printedNameClass = "hidden print:block p-2 text-black font-medium";
  
  // O <td> foi REMOVIDO daqui. O componente agora retorna os <div>s diretamente.
  return (
    <>
      {/* 1. O Wrapper e o Dropdown (para a tela) */}
      <div ref={wrapperRef} className="relative w-full print:hidden">
        {/* 1a. O Botão que abre o dropdown */}
        <button
          type="button"
          // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
          role="combobox"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex justify-between items-center bg-neutral-100 border-none p-2 text-black font-normal hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span className="truncate">
            {selectedPublicador ? selectedPublicador.nome_completo : "Selecione..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>

        {/* 1b. O Dropdown Pesquisável (só aparece se isOpen) */}
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
            {/* O Campo de Busca */}
            <input
              type="text"
              placeholder="Buscar publicador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 text-black border-b border-gray-200 outline-none"
              autoFocus
            />
            {/* A Lista de Resultados */}
            <ul className="max-h-60 overflow-y-auto">
              {filteredPublicadores.length > 0 ? (
                filteredPublicadores.map((publicador) => (
                  <li key={publicador.id}>
                    <button
                      type="button"
                      className="w-full text-left p-2 text-black hover:bg-neutral-100 truncate"
                      onClick={() => {
                        handleAssignmentChange(partId, publicador.nome_completo);
                        setIsOpen(false);
                        setSearchTerm("");
                      }}
                    >
                      {publicador.nome_completo}
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

      {/* 2. O nome que aparece na impressão (sem alteração) */}
      <div className={printedNameClass}>
        {currentValue || '...'}
      </div>
    </>
  );
};
// --- FIM DO COMPONENTE ATUALIZADO ---


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

  // 1. Buscar a lista de publicadores (sem alteração)
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

  // 2. Função para ler o arquivo RTF (sem alteração)
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

  // ----- Classes de Estilo -----
  const tdTime = "border border-gray-600 p-2 font-semibold w-20 align-top";
  const tdPart = "border border-gray-600 p-2 align-top";
  // A classe do <td> de nome agora é definida aqui
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
                    {/* AQUI ESTÁ CORRETO: O componente é filho de um <div> */}
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
                    {/* AQUI ESTÁ CORRETO: O componente é filho de um <div> */}
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

            {/* TABELA DE DESIGNAÇÕES */}
            <table className="w-full border-collapse border-2 border-gray-700">
              <tbody className="text-gray-900">
                
                <tr>
                  <td className={tdTime}></td>
                  <td className={tdPart}>
                    {scheduleData.initialSong}
                    <span className="float-right font-bold text-gray-700">Oração</span>
                  </td>
                  {/* --- ATUALIZADO: O <td> agora envolve o componente --- */}
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
                  {/* --- ATUALIZADO: O <td> agora envolve o componente --- */}
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
                    {/* --- ATUALIZADO: O <td> agora envolve o componente --- */}
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
                {scheduleData.ministry?.map((part, index) => (
                  <tr key={`m-${index}`}>
                    <td className={tdTime}></td>
                    <td className="border border-gray-600 p-2 align-top">{part.title}</td>
                    {/* --- ATUALIZADO: O <td> agora envolve o componente --- */}
                    <td className={tdName}>
                      <AssignmentSelect 
                        partId={`ministerio_${index}`}
                        publicadores={publicadores}
                        assignments={assignments}
                        handleAssignmentChange={handleAssignmentChange}
                      />
                    </td>
                  </tr>
                ))}

                {/* Nossa Vida */}
                <tr><td colSpan="3" className={headerClass}>NOSSA VIDA CRISTÃ</td></tr>
                {scheduleData.living?.map((part, index) => (
                  <tr key={`v-${index}`}>
                    <td className={tdTime}></td>
                    <td className={tdPart}>{part.title}</td>
                    {/* --- ATUALIZADO: O <td> agora envolve o componente --- */}
                    <td className={tdName}>
                      <AssignmentSelect 
                        partId={`vida_${index}`}
                        publicadores={publicadores}
                        assignments={assignments}
                        handleAssignmentChange={handleAssignmentChange}
                      />
                    </td>
                  </tr>
                ))}

                {/* Finais */}
                <tr>
                  <td className={tdTime}></td>
                  <td className={tdPart}>{scheduleData.finalComments}</td>
                  {/* --- ATUALIZADO: O <td> agora envolve o componente --- */}
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
                  {/* --- ATUALIZADO: O <td> agora envolve o componente --- */}
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