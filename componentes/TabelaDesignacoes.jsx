'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronsUpDown } from 'lucide-react';

// --- FUNÇÕES AUXILIARES ---
const normalizeText = (text) => {
  return text
    ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    : "";
};

// --- SUB-COMPONENTE: Formata o texto com cores ---
const ConteudoParteEstilizado = ({ text, section }) => {
  if (!text) return null;

  // Garante que "MIN" ou "Min" virem "min" minúsculo em todo o texto
  const normalizeMinutes = (str) => {
    return str.replace(/(\d+)\s*MIN/g, '$1 min').replace(/(\d+)\s*Min/g, '$1 min');
  };

  // Formata fontes entre parênteses em Azul Claro (Cyan)
  const formatSource = (str) => {
    const parts = str.split(/(\([^)]+\))/g);
    return parts.map((part, i) => {
      if (part.startsWith('(') && part.endsWith(')')) {
        // Se for apenas o tempo (ex: (10 min)), não colore de azul claro, deixa preto
        if (part.includes('min')) return part; 
        return <span key={i} className="text-cyan-700 font-normal">{part}</span>;
      }
      return part;
    });
  };

  const textFixed = normalizeMinutes(text);

  // 1. TESOUROS: Azul Escuro (Padrão: "1. Título (10 min)")
  if (section === 'treasures') {
    // Procura: Título + (Tempo) + Resto
    const match = textFixed.match(/^(.*?)(\(\d+\s*min\))(.*)$/i);
    if (match) {
      const titulo = match[1];
      const tempo = match[2];
      const resto = match[3];
      
      // Se tiver número no início, colore ele junto com o título
      const numMatch = titulo.match(/^(\d+\.)\s*(.*)$/);
      
      return (
        <span className="font-bold">
          {numMatch ? (
            <>
              <span className="text-blue-900">{numMatch[1]} </span>
              <span className="text-blue-900">{numMatch[2]}</span>
            </>
          ) : (
             <span className="text-blue-900">{titulo}</span>
          )}
          <span className="text-black font-extrabold"> {tempo}</span>
          <span className="text-black font-bold">{resto}</span>
        </span>
      );
    }
    return <span className="text-blue-900 font-bold">{textFixed}</span>;
  }

  // 2. MINISTÉRIO: Amarelo Escuro (Título) + Preto (Resto)
  if (section === 'ministry') {
    // Regex flexível: Pega tudo até encontrar o tempo "(x min)"
    const match = textFixed.match(/^(.*?)(\(\d+\s*min\))(:?)\s*(.*)$/i);

    if (match) {
      const titulo = match[1]; // "4. INICIANDO CONVERSAS"
      const tempo = match[2];  // "(3 min)"
      const doisPontos = match[3]; // ":"
      const resto = match[4];  // "De casa em casa..."

      return (
        <span className="leading-tight block">
          <span className="text-amber-700 font-bold uppercase">{titulo}</span>
          <span className="text-black font-extrabold"> {tempo}{doisPontos}</span>
          <span className="font-bold text-black ml-1">
            {formatSource(resto)}
          </span>
        </span>
      );
    }

    // Fallback se não achar tempo (raro, mas previne erro)
    return <span className="text-amber-700 font-bold uppercase">{textFixed}</span>;
  }

  // 3. VIDA CRISTÃ: Vermelho (Título) + Preto (Resto)
  if (section === 'living') {
    if (textFixed.toLowerCase().includes('cântico')) {
      return <span className="text-blue-800 font-bold">{textFixed}</span>;
    }
    
    // Regex flexível: Pega tudo até encontrar o tempo "(x min)"
    // Não exige mais que comece com número "7."
    const match = textFixed.match(/^(.*?)(\(\d+\s*min\))(:?)\s*(.*)$/i);

    if (match) {
       const titlePart = match[1]; // "Torne-se Amigo..."
       const timePart = match[2];  // "(15 min)"
       const colon = match[3];     // ":"
       const restPart = match[4];  // "Consideração..."

       return (
        <span className="leading-tight block">
          <span className="text-red-800 font-bold">{titlePart}</span>
          <span className="text-black font-extrabold"> {timePart}{colon}</span>
          <span className="font-bold text-black ml-1">
             {formatSource(restPart)}
          </span>
        </span>
       );
    }

    // Se não achar tempo, tenta colorir tudo de vermelho como fallback
    return <span className="text-red-800 font-bold">{textFixed}</span>;
  }

  return <span className="font-bold text-black">{textFixed}</span>;
};

// --- SUB-COMPONENTE: Seleção (Mantido) ---
const SelecaoPublicador = ({ partId, publicadores, assignments, handleAssignmentChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);
  
  const currentValue = assignments[partId] || ""; 
  const selectedPublicador = publicadores.find(
    (p) => p.nome_completo.toLowerCase() === currentValue.toLowerCase()
  );

  const filteredPublicadores = useMemo(() => {
    const search = normalizeText(searchTerm);
    if (!search) return publicadores;
    return publicadores.filter((p) => {
      const nomeCompleto = normalizeText(p.nome_completo);
      const nomeCurto = normalizeText(p.nome_curto);
      return nomeCompleto.includes(search) || nomeCurto.includes(search);
    });
  }, [publicadores, searchTerm]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHighlightedIndex(0); }, [filteredPublicadores]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false); setSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, [wrapperRef]);

  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeItem = listRef.current.children[highlightedIndex];
      if (activeItem) activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        setIsOpen(true); e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setHighlightedIndex(prev => prev < filteredPublicadores.length - 1 ? prev + 1 : prev); break;
      case "ArrowUp": e.preventDefault(); setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0); break;
      case "Enter": e.preventDefault(); if (filteredPublicadores.length > 0) handleSelect(filteredPublicadores[highlightedIndex].nome_completo); break;
      case "Escape": setIsOpen(false); setSearchTerm(""); break;
    }
  };

  const handleSelect = (nomeCompleto) => {
    handleAssignmentChange(partId, nomeCompleto);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <>
      <div ref={wrapperRef} className="relative w-full print:hidden">
        <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-center items-center bg-transparent hover:bg-neutral-100 border-none py-1 px-1 text-black font-bold text-center focus:outline-none cursor-pointer text-base">
          <span className="truncate">{selectedPublicador ? selectedPublicador.nome_curto : "Selecione..."}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
        </button>
        {isOpen && (
          <div className="absolute z-50 w-64 left-1/2 -translate-x-1/2 mt-1 bg-white border border-gray-300 rounded-md shadow-2xl flex flex-col max-h-80">
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={handleKeyDown} className="w-full py-3 px-3 text-black border-b border-gray-200 outline-none text-base" autoFocus />
            <ul ref={listRef} className="overflow-y-auto flex-1">
              {filteredPublicadores.map((publicador, index) => (
                <li key={publicador.id}>
                  <button type="button" className={`w-full text-left py-2 px-3 text-black truncate text-base ${index === highlightedIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`} onClick={() => handleSelect(publicador.nome_completo)} onMouseEnter={() => setHighlightedIndex(index)}>
                    {publicador.nome_curto}
                  </button>
                </li>
              ))}
              {filteredPublicadores.length === 0 && <li className="py-2 px-3 text-gray-500 text-sm text-center">Nenhum encontrado</li>}
            </ul>
          </div>
        )}
      </div>
      <div className="hidden print:block text-center font-bold text-black text-base">
        {selectedPublicador ? selectedPublicador.nome_curto : ''}
      </div>
    </>
  );
};

// --- COMPONENTE PRINCIPAL DA TABELA ---
export default function TabelaDesignacoes({ schedule, assignments, weekText, publicadores, onAssignmentChange, isPrintView = false }) {
  
  const widthNameCol = "w-1/3"; 
  const tdTime = "bg-gray-200 border border-gray-600 py-2 px-1 font-bold text-center w-16 align-middle text-base text-black print:bg-gray-200 print:text-black";
  const tdPart = "bg-white border border-gray-600 py-2 px-3 align-middle text-left text-base text-black";
  const tdName = `bg-white border border-gray-600 p-0 ${widthNameCol} align-middle text-center text-base text-black`;
  const sectionHeader = "bg-blue-800 text-white py-2 px-2 text-center font-bold text-base uppercase border border-gray-600 print:bg-blue-800 print:text-white print-color-adjust-exact";

  const handleChange = (partId, val) => {
    if (!isPrintView && onAssignmentChange) onAssignmentChange(partId, val);
  };

  return (
    <div className="
      bg-white text-black w-full max-w-5xl mx-auto mb-8 
      border-[3px] border-black 
      print:border-[3px] print:border-black 
      print:h-full print:w-full print:mb-0 
      print:flex print:flex-col print:justify-between 
      page-break-inside-avoid p-4
    ">
      
      {/* Cabeçalho */}
      <div className="flex border-b-[3px] border-black mb-0.5 shrink-0">
        <div className="flex-1 flex flex-col justify-center items-center p-4 text-center border-r-[3px] border-black bg-gray-100 print:bg-gray-100">
          <h2 className="text-xl font-bold text-blue-900 uppercase leading-tight mb-2 print:text-blue-900">
            {weekText}
          </h2>
          <h1 className="text-2xl font-extrabold text-black uppercase leading-none">
            Nossa Vida e Ministério Cristão
          </h1>
        </div>

        <div className={`${widthNameCol} flex flex-col bg-white`}>
          <div className="bg-gray-100 border-b-2 border-black p-2 text-center font-bold text-base print:bg-gray-100">Salão Principal</div>
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center border-b border-gray-400 py-2">
              <div className="w-1/3 text-sm font-bold text-right pr-3 text-black">Presidente:</div>
              <div className="w-2/3 pl-1"><SelecaoPublicador partId="presidente" publicadores={publicadores} assignments={assignments} handleAssignmentChange={handleChange} /></div>
            </div>
            <div className="flex items-center py-2">
              <div className="w-1/3 text-sm font-bold text-right pr-3 text-black">Ajudante:</div>
              <div className="w-2/3 pl-1"><SelecaoPublicador partId="ajudante" publicadores={publicadores} assignments={assignments} handleAssignmentChange={handleChange} /></div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela (CORRIGIDO: Colgroup sem espaços para evitar erro de hydration) */}
      <table className="w-full border-collapse border-2 border-black text-base flex-1 h-full table-fixed">
        <colgroup><col className="w-16" /><col /><col className={widthNameCol} /></colgroup>
        <tbody>
          <tr>
            <td className={tdTime}>19:30</td>
            <td className={tdPart}>
              <div className="flex justify-between items-center">
                <span className="text-blue-800 font-bold">{schedule.initialSong}</span>
                <span className="font-bold mr-4 text-black">Oração ---&gt;</span>
              </div>
            </td>
            <td className={tdName}><SelecaoPublicador partId="oracao_inicial" publicadores={publicadores} assignments={assignments} handleAssignmentChange={handleChange} /></td>
          </tr>
          <tr>
            <td className={tdTime}>19:35</td>
            <td className={tdPart}><span className="font-bold text-black">{schedule.openingComments}</span></td>
            <td className={tdName}><SelecaoPublicador partId="comentarios_iniciais" publicadores={publicadores} assignments={assignments} handleAssignmentChange={handleChange} /></td>
          </tr>

          <tr><td colSpan="3" className={sectionHeader}>TESOUROS DA PALAVRA DE DEUS</td></tr>
          {schedule.treasures?.map((part, index) => (
            <tr key={`t-${index}`}>
              <td className={tdTime}></td>
              <td className={tdPart}><ConteudoParteEstilizado text={part.title} section="treasures" /></td>
              <td className={tdName}><SelecaoPublicador partId={`tesouro_${index}`} publicadores={publicadores} assignments={assignments} handleAssignmentChange={handleChange} /></td>
            </tr>
          ))}

          <tr><td colSpan="3" className={sectionHeader}>FAÇA SEU MELHOR NO MINISTÉRIO</td></tr>
          {schedule.ministry?.map((part, index) => {
            const isDiscurso = part.title.toLowerCase().includes('discurso:');
            return (
              <tr key={`m-${index}`}>
                <td className={tdTime}></td>
                <td className={tdPart}><ConteudoParteEstilizado text={part.title} section="ministry" /></td>
                <td className={tdName}>
                  {isDiscurso ? (
                    <SelecaoPublicador partId={`ministerio_${index}`} publicadores={publicadores} assignments={assignments} handleAssignmentChange={handleChange} />
                  ) : (
                    <div className="flex flex-col justify-center min-h-16">
                      <SelecaoPublicador partId={`ministerio_${index}_1`} publicadores={publicadores} assignments={assignments} handleAssignmentChange={handleChange} />
                      <div className="border-t border-dashed border-gray-400 my-1"></div>
                      <SelecaoPublicador partId={`ministerio_${index}_2`} publicadores={publicadores} assignments={assignments} handleAssignmentChange={handleChange} />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}

          <tr><td colSpan="3" className={sectionHeader}>NOSSA VIDA CRISTÃ</td></tr>
          {schedule.living?.map((part, index) => {
             const isBibleStudy = part.title.toLowerCase().includes('estudo bíblico');
             return (
              <tr key={`v-${index}`}>
                <td className={tdTime}></td>
                <td className={tdPart}><ConteudoParteEstilizado text={part.title} section="living" /></td>
                <td className={tdName}>
                  {isBibleStudy ? (
                    <div className="flex flex-col justify-center min-h-16">
                      <SelecaoPublicador partId={`vida_${index}_1`} publicadores={publicadores} assignments={assignments} handleAssignmentChange={handleChange} />
                       <div className="border-t border-dashed border-gray-400 my-1"></div>
                      <SelecaoPublicador partId={`vida_${index}_2`} publicadores={publicadores} assignments={assignments} handleAssignmentChange={handleChange} />
                    </div>
                  ) : (
                    <SelecaoPublicador partId={`vida_${index}`} publicadores={publicadores} assignments={assignments} handleAssignmentChange={handleChange} />
                  )}
                </td>
              </tr>
            );
          })}

          <tr>
            <td className={tdTime}>20:50</td>
            <td className={tdPart}><span className="font-bold text-black">{schedule.finalComments}</span></td>
            <td className={tdName}><SelecaoPublicador partId="comentarios_finais" publicadores={publicadores} assignments={assignments} handleAssignmentChange={handleChange} /></td>
          </tr>
          <tr>
            <td className={tdTime}>21:00</td>
            <td className={tdPart}>
               <div className="flex justify-between items-center">
                <span className="text-blue-800 font-bold">{schedule.finalSong}</span>
                <span className="font-bold mr-4 text-black">Oração ---&gt;</span>
              </div>
            </td>
            <td className={tdName}><SelecaoPublicador partId="oracao_final" publicadores={publicadores} assignments={assignments} handleAssignmentChange={handleChange} /></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}