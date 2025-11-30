// app/admin/designacoes/page.jsx

'use client';

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout'; 
import { Loader2, Printer, UploadCloud, Save, ChevronLeft, ChevronRight, Calendar, RefreshCw, History, FileText, Filter, X } from 'lucide-react';
import TabelaDesignacoes from '@/app/componentes/TabelaDesignacoes';
import { Button } from '@/app/components/ui/button';

// --- CONSTANTES ---
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// --- FUNÇÕES AUXILIARES ---
function getShortName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';
  const parts = fullName.split(' ').filter(Boolean);
  if (parts.length === 1) return fullName;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function parseDateFromWeekString(weekString) {
  try {
    if (!weekString) return '';
    const cleanStr = weekString.trim().toUpperCase();
    
    // Procura pelo nome do mês na string
    let mesIndex = -1;
    for (let i = 0; i < MESES.length; i++) {
      if (cleanStr.includes(MESES[i].toUpperCase())) {
        mesIndex = i;
        break;
      }
    }
    if (mesIndex === -1) return '';

    // Extrai o dia (primeiro número)
    const matchDia = cleanStr.match(/(\d{1,2})/);
    if (!matchDia) return '';
    const dia = parseInt(matchDia[1], 10);

    // Extrai o ano (se houver)
    const matchAno = cleanStr.match(/(\d{4})/);
    let ano;
    if (matchAno) {
      ano = parseInt(matchAno[1], 10);
    } else {
      // Se não tiver ano, tenta adivinhar baseado na data atual
      const hoje = new Date();
      ano = hoje.getFullYear();
      if (hoje.getMonth() >= 10 && mesIndex <= 1) ano = ano + 1;
      else if (hoje.getMonth() <= 1 && mesIndex >= 10) ano = ano - 1;
    }

    const data = new Date(ano, mesIndex, dia);
    const yyyy = data.getFullYear();
    const mm = String(data.getMonth() + 1).padStart(2, '0');
    const dd = String(data.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch (e) { return ''; }
}

const mapSavedToAssignments = (savedRows, schedule) => {
  const newAssignments = {};
  if (!savedRows || savedRows.length === 0) return newAssignments;

  const rowsByPart = {};
  savedRows.forEach(row => {
    if (!rowsByPart[row.nome_parte]) rowsByPart[row.nome_parte] = [];
    rowsByPart[row.nome_parte].push(row.nome_completo);
  });

  const popAssignment = (partName) => {
    if (rowsByPart[partName] && rowsByPart[partName].length > 0) return rowsByPart[partName].shift();
    return "";
  };

  newAssignments['presidente'] = popAssignment('Presidente');
  newAssignments['ajudante'] = popAssignment('Ajudante');
  newAssignments['oracao_inicial'] = popAssignment('Oração Inicial');
  newAssignments['oracao_final'] = popAssignment('Oração Final');
  newAssignments['comentarios_iniciais'] = popAssignment(schedule.openingComments || 'Comentários Iniciais');
  newAssignments['comentarios_finais'] = popAssignment(schedule.finalComments || 'Comentários Finais');
  newAssignments['cantico_meio'] = popAssignment(schedule.middleSong || 'Cântico do Meio');

  schedule.treasures?.forEach((part, idx) => {
    newAssignments[`tesouro_${idx}`] = popAssignment(part.title);
  });
  schedule.ministry?.forEach((part, idx) => {
    const isDiscurso = part.title.toLowerCase().includes('discurso');
    if (isDiscurso) {
      newAssignments[`ministerio_${idx}`] = popAssignment(part.title);
    } else {
      newAssignments[`ministerio_${idx}_1`] = popAssignment(part.title);
      newAssignments[`ministerio_${idx}_2`] = popAssignment(part.title);
    }
  });
  schedule.living?.forEach((part, idx) => {
    const isBibleStudy = part.title.toLowerCase().includes('estudo bíblico');
    if (isBibleStudy) {
      newAssignments[`vida_${idx}_1`] = popAssignment(part.title);
      newAssignments[`vida_${idx}_2`] = popAssignment(part.title);
    } else {
      newAssignments[`vida_${idx}`] = popAssignment(part.title);
    }
  });

  return newAssignments;
};

export default function DesignacoesPage() {
  const [publicadores, setPublicadores] = useState([]);
  const [savedMeetingsList, setSavedMeetingsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [schedules, setSchedules] = useState([]); 
  const [assignmentsList, setAssignmentsList] = useState([]); 
  const [weekDescriptions, setWeekDescriptions] = useState([]); 
  const [meetingDates, setMeetingDates] = useState([]); 
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ text: '', isError: false });

  // --- ESTADOS DE FILTRO ---
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [pubRes, meetingsRes] = await Promise.all([
          fetch('/api/admin/get-publicadores'),
          fetch('/api/admin/get-reunioes')
        ]);

        if (!pubRes.ok) throw new Error('Falha ao buscar publicadores');
        const pubData = await pubRes.json();
        
        const publicadoresComNomeCurto = pubData.map(p => ({
          ...p,
          nome_curto: p.nome_chamado ? p.nome_chamado : getShortName(p.nome_completo)
        }));
        setPublicadores(publicadoresComNomeCurto);

        if (meetingsRes.ok) {
          setSavedMeetingsList(await meetingsRes.json());
        }
      } catch (err) { 
        setError(err.message); 
      } finally { 
        setIsLoading(false); 
      }
    }
    fetchData();
  }, []);

  const refreshSavedMeetings = async () => {
    try {
      const res = await fetch('/api/admin/get-reunioes');
      if(res.ok) setSavedMeetingsList(await res.json());
    } catch(e) { console.error(e); }
  };

  // --- LÓGICA DE FILTRO E AGRUPAMENTO ---
  const { listaFiltrada, anosDisponiveis } = useMemo(() => {
    // 1. Extrair anos únicos para o select
    const anosSet = new Set();
    savedMeetingsList.forEach(m => {
      if(m.dataSQL) anosSet.add(m.dataSQL.split('-')[0]);
    });
    const anos = Array.from(anosSet).sort().reverse();

    // 2. Filtrar a lista
    let lista = savedMeetingsList;
    if (filtroAno) {
      lista = lista.filter(m => m.dataSQL.startsWith(filtroAno));
    }
    if (filtroMes) {
      lista = lista.filter(m => {
        const mes = m.dataSQL.split('-')[1]; // '01' a '12'
        return mes === filtroMes;
      });
    }

    return { listaFiltrada: lista, anosDisponiveis: anos };
  }, [savedMeetingsList, filtroMes, filtroAno]);

  // Helper para pegar o label do grupo (Ex: "NOVEMBRO 2025")
  const getGroupLabel = (dataSQL) => {
    if (!dataSQL) return 'Outros';
    const [ano, mes] = dataSQL.split('-');
    const nomeMes = MESES[parseInt(mes, 10) - 1];
    return `${nomeMes} ${ano}`;
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, 'ISO-8859-1');
    });
  };

  const handleLoadSavedMeeting = async (meeting) => {
    setIsParsing(true); 
    setError(''); 
    setSaveMessage({text:'', isError: false});

    try {
      const structRes = await fetch(`/api/admin/get-reuniao-dados?date=${meeting.dataSQL}`);
      if (!structRes.ok) throw new Error('Erro ao carregar estrutura.');
      const scheduleData = await structRes.json();

      const assignRes = await fetch(`/api/recuperar-designacoes?date=${meeting.dataSQL}`);
      if (!assignRes.ok) throw new Error('Erro ao carregar designações.');
      const savedRows = await assignRes.json();

      const reconstructedAssignments = mapSavedToAssignments(savedRows, scheduleData);

      setSchedules([scheduleData]);
      setWeekDescriptions([meeting.descricao]);
      setMeetingDates([meeting.dataSQL]);
      setAssignmentsList([reconstructedAssignments]);
      setCurrentIndex(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFilesParse = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    files.sort((a, b) => a.name.localeCompare(b.name));

    setIsParsing(true); setError(''); setSaveMessage({ text: '', isError: false });
    
    const newSchedules = [];
    const newAssignments = [];
    const newDescriptions = [];
    const newDates = [];

    try {
      for (const file of files) {
        const textContent = await readFileAsText(file);
        const response = await fetch('/api/admin/parse-rtf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ textContent })
        });
        if (!response.ok) throw new Error(`Erro em ${file.name}`);
        const parsedData = await response.json();
        
        newSchedules.push(parsedData);
        
        const autoDateSQL = parseDateFromWeekString(parsedData.weekDate);
        newDates.push(autoDateSQL);
        
        let yearStr = '';
        if (autoDateSQL) yearStr = ` ${autoDateSQL.split('-')[0]}`;
        newDescriptions.push((parsedData.weekDate || 'Semana') + yearStr);

        let retrievedAssignments = {};
        if (autoDateSQL) {
          try {
            const dbRes = await fetch(`/api/recuperar-designacoes?date=${autoDateSQL}`);
            if (dbRes.ok) {
              const savedRows = await dbRes.json();
              if (savedRows && savedRows.length > 0) {
                retrievedAssignments = mapSavedToAssignments(savedRows, parsedData);
              }
            }
          } catch (e) { console.error(e); }
        }
        newAssignments.push(retrievedAssignments);
      }

      setSchedules(newSchedules);
      setAssignmentsList(newAssignments);
      setWeekDescriptions(newDescriptions);
      setMeetingDates(newDates);
      setCurrentIndex(0);

    } catch (err) {
      setError(`Falha: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleAssignmentChange = (partId, name) => {
    setAssignmentsList(prevList => {
      const newList = [...prevList];
      const currentAssignments = { ...newList[currentIndex] };
      currentAssignments[partId] = name;
      
      // Regra de automação: Presidente preenche comentários e cântico do meio
      if (partId === 'presidente') {
        currentAssignments['comentarios_iniciais'] = name;
        currentAssignments['comentarios_finais'] = name;
        currentAssignments['cantico_meio'] = name;
      }

      newList[currentIndex] = currentAssignments;
      return newList;
    });
  };

  const handleDescriptionChange = async (newText) => {
    setWeekDescriptions(prev => { const n = [...prev]; n[currentIndex] = newText; return n; });
    const newDateSQL = parseDateFromWeekString(newText);
    setMeetingDates(prev => { const n = [...prev]; n[currentIndex] = newDateSQL; return n; });

    if (newDateSQL && newDateSQL.length === 10) {
      try {
        const dbRes = await fetch(`/api/recuperar-designacoes?date=${newDateSQL}`);
        if (dbRes.ok) {
          const savedRows = await dbRes.json();
          if (savedRows && savedRows.length > 0) {
            const mergedAssignments = mapSavedToAssignments(savedRows, schedules[currentIndex]);
            setAssignmentsList(prev => {
              const n = [...prev];
              n[currentIndex] = { ...n[currentIndex], ...mergedAssignments };
              return n;
            });
          }
        }
      } catch(e) { console.error(e); }
    }
  };

  const handleSaveCurrent = async () => {
    const currentSchedule = schedules[currentIndex];
    const currentAssignments = assignmentsList[currentIndex];
    const currentDescription = weekDescriptions[currentIndex];
    const currentDateSQL = meetingDates[currentIndex];

    if (!currentDateSQL) { setSaveMessage({ text: 'Data inválida. Verifique o título da semana.', isError: true }); return; }
    
    setIsSaving(true); setSaveMessage({ text: '', isError: false });
    try {
      await fetch('/api/admin/salvar-designacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleData: { ...currentSchedule, weekDate: currentDescription },
          assignments: currentAssignments,
          meetingDate: currentDateSQL
        })
      });
      setSaveMessage({ text: `Salvo com sucesso!`, isError: false });
      refreshSavedMeetings();
    } catch (err) { setSaveMessage({ text: err.message, isError: true }); } finally { setIsSaving(false); }
  };

  const handlePrintAll = () => { window.print(); };

  if (isLoading) return (
    <DashboardLayout>
       <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-purple-600" /></div>
    </DashboardLayout>
  );  
  const hasData = schedules.length > 0;

  return (
    <DashboardLayout>
      {/* Container Principal */}
      <div className="flex h-[calc(100vh-7rem)] bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        
        {/* 1. SIDEBAR HISTÓRICO - RESPONSIVIDADE: Visível apenas em MD+ */}
        <aside className="hidden md:flex w-full md:w-60 border-r border-gray-200 shadow-sm shrink-0 flex-col overflow-hidden no-print bg-white">
          
          {/* Cabeçalho + Filtros */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                <History size={16} className="text-purple-600" />
                Histórico
                </h3>
                {(filtroMes || filtroAno) && (
                    <button onClick={() => { setFiltroMes(''); setFiltroAno(''); }} className="text-[10px] text-red-500 flex items-center hover:underline">
                        <X size={10} className="mr-1"/> Limpar
                    </button>
                )}
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-2 gap-2">
                <select 
                  value={filtroMes} 
                  onChange={(e) => setFiltroMes(e.target.value)}
                  className="text-[11px] border border-gray-200 rounded p-1 bg-white focus:ring-1 focus:ring-purple-500 outline-none text-gray-700"
                >
                   <option value="">Mês</option>
                   {MESES.map((m, i) => <option key={i} value={String(i+1).padStart(2, '0')}>{m.substring(0, 3)}</option>)}
                </select>

                <select 
                  value={filtroAno} 
                  onChange={(e) => setFiltroAno(e.target.value)}
                  className="text-[11px] border border-gray-200 rounded p-1 bg-white focus:ring-1 focus:ring-purple-500 outline-none text-gray-700"
                >
                   <option value="">Ano</option>
                   {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>
          </div>

          {/* Lista de Reuniões */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {listaFiltrada.length === 0 && (
              <p className="text-xs text-gray-500 p-4 text-center">Nenhuma reunião encontrada.</p>
            )}
            
            {/* Renderização com Agrupamento por Mês */}
            {listaFiltrada.map((m, index) => {
               const currentGroup = getGroupLabel(m.dataSQL);
               const prevGroup = index > 0 ? getGroupLabel(listaFiltrada[index - 1].dataSQL) : null;
               const showGroupHeader = currentGroup !== prevGroup;

               return (
                 <div key={m.dataSQL}>
                   {/* Cabeçalho do Grupo (Separador Visual) */}
                   {showGroupHeader && (
                      <div className="px-2 pt-3 pb-1 text-[10px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-100 mb-1 mt-1">
                        {currentGroup}
                      </div>
                   )}

                   <button
                    onClick={() => handleLoadSavedMeeting(m)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors border border-transparent flex flex-col mb-0.5
                        ${meetingDates[currentIndex] === m.dataSQL && hasData 
                        ? 'bg-purple-50 text-purple-900 border-purple-100 font-medium' 
                        : 'hover:bg-gray-50 text-gray-600 bg-transparent'
                        }`}
                    >
                    <span className="truncate w-full text-xs">{m.descricao}</span>
                   </button>
                 </div>
               );
            })}
          </div>
        </aside>

        {/* 2. ÁREA PRINCIPAL (EDITOR) - Ocupa toda a largura em mobile */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden relative no-print min-w-0">
            
            {/* CABEÇALHO DO EDITOR - Ajustado para ser responsivo */}
            <div className="p-4 border-b border-gray-200 flex flex-wrap justify-between items-center bg-white z-10 gap-2">
                <div className="flex items-center gap-2 shrink-0">
                   <FileText size={20} className="text-purple-600" />
                   <h2 className="font-bold text-gray-900 text-base">Editor de Reunião</h2>
                </div>

                <div className="flex items-center gap-2 ml-auto shrink-0">
                    {hasData && (
                      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mr-2 shrink-0">
                         <button onClick={() => { setCurrentIndex(c => Math.max(0, c - 1)); setSaveMessage({text:'', isError:false}); }} disabled={currentIndex === 0} className="p-1.5 hover:bg-white rounded-md disabled:opacity-30"><ChevronLeft size={16}/></button>
                         <span className="text-xs font-medium px-2 w-20 text-center text-gray-600">Semana {currentIndex + 1}</span>
                         <button onClick={() => { setCurrentIndex(c => Math.min(schedules.length - 1, c + 1)); setSaveMessage({text:'', isError:false}); }} disabled={currentIndex === schedules.length - 1} className="p-1.5 hover:bg-white rounded-md disabled:opacity-30"><ChevronRight size={16}/></button>
                      </div>
                    )}
                    {/* BOTÃO DE IMPORTAR - Visível em todas as telas */}
                    <label className="flex items-center gap-2 py-2 px-3 rounded-md text-sm bg-purple-600 hover:bg-purple-700 text-white cursor-pointer transition font-medium shadow-sm shrink-0">
                        <UploadCloud size={16} /> 
                        <span className="hidden sm:inline">{hasData ? 'Importar Outro' : 'Importar RTF'}</span>
                        <span className="sm:hidden">{hasData ? 'Trocar' : 'RTF'}</span> {/* Texto menor para mobile */}
                        <input type="file" multiple accept=".rtf, .txt" className="hidden" onChange={handleFilesParse} />
                    </label>
                </div>
            </div>

            {/* CONTEÚDO COM ROLAGEM */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50/30 scroll-smooth">
                {/* ... (Conteúdo do editor TabelaDesignacoes) ... */}
                
                {isParsing ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 animate-in fade-in duration-300">
                     <div className="bg-white p-6 rounded-full shadow-lg border border-gray-100">
                        <Loader2 className="animate-spin text-purple-600 w-10 h-10" />
                     </div>
                     <p className="text-sm font-medium text-gray-500">Processando arquivo...</p>
                  </div>
                ) : !hasData ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8 border-2 border-dashed border-gray-200 rounded-lg m-4">
                    <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4 text-purple-300">
                       <UploadCloud size={32} />
                    </div>
                    <p className="text-gray-900 font-medium">Nenhuma reunião carregada</p>
                    <p className="text-sm text-gray-400 mt-1">Selecione um item do histórico ou importe um arquivo RTF.</p>
                  </div>
                ) : (
                  <div className="max-w-5xl mx-auto space-y-6 pb-10">
                      {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                          {error}
                        </div>
                      )}

                      {/* Edição de Data */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                             <Calendar size={16} className="text-gray-400" />
                             <span className="text-sm font-medium text-gray-600">Data da Reunião:</span>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 justify-end">
                             <input 
                                type="text" 
                                value={weekDescriptions[currentIndex] || ''} 
                                onChange={(e) => handleDescriptionChange(e.target.value)} 
                                className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-900 w-full sm:w-64 text-center font-bold uppercase focus:border-purple-500 focus:ring-0 outline-none transition-all" 
                              />
                              <button onClick={() => handleDescriptionChange(weekDescriptions[currentIndex])} className="p-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-600" title="Recarregar"><RefreshCw size={14}/></button>
                          </div>
                      </div>

                      {/* Tabela */}
                      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-x-auto"> {/* Adicionado overflow-x-auto */}
                          <TabelaDesignacoes 
                              schedule={schedules[currentIndex]}
                              assignments={assignmentsList[currentIndex]}
                              weekText={weekDescriptions[currentIndex]}
                              publicadores={publicadores}
                              onAssignmentChange={handleAssignmentChange}
                          />
                      </div>

                      {/* Ações */}
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
                         <div className="text-sm">
                            {saveMessage.text && (
                               <span className={`flex items-center gap-2 px-3 py-1 rounded-full ${saveMessage.isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                  {saveMessage.isError ? null : <Save size={12} />} {saveMessage.text}
                               </span>
                            )}
                         </div>
                         <div className="flex gap-3 w-full sm:w-auto">
                            <Button variant="outline" onClick={handlePrintAll} className=" bg-blue-600 flex-1 sm:flex-none border-gray-300 text-white  hover:bg-blue-500">
                               <Printer className="w-4 h-4 mr-2"/> Imprimir
                            </Button>
                            <Button onClick={handleSaveCurrent} disabled={isSaving} className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none text-white">
                               {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>}
                               Salvar Alterações
                            </Button>
                         </div>
                      </div>
                  </div>
                )}
            </div>
        </div>

      </div>

      {/* COMPONENTE DE IMPRESSÃO */}
      <div className="designacoes-print-wrapper printable-content">
        {schedules.map((schedule, idx) => (
          <div key={idx} className="print-page-break">
             <TabelaDesignacoes 
               schedule={schedule}
               assignments={assignmentsList[idx]} 
               weekText={weekDescriptions[idx]}
               publicadores={publicadores}
               isPrintView={true} 
             />
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}