'use client';

import { useState, useEffect } from 'react';
import { Loader2, Printer, UploadCloud, ArrowLeft, Save, ChevronLeft, ChevronRight, Calendar, RefreshCw, History, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import TabelaDesignacoes from '@/app/componentes/TabelaDesignacoes';

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
    
    // Limpa espaços extras e coloca em maiúsculo
    const cleanStr = weekString.trim().toUpperCase();
    
    // Lista de meses
    const meses = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    
    // 1. Encontrar qual mês está escrito no texto
    let mesIndex = -1;
    for (let i = 0; i < meses.length; i++) {
      if (cleanStr.includes(meses[i])) {
        mesIndex = i;
        break;
      }
    }
    
    if (mesIndex === -1) return '';

    // 2. Encontrar o dia
    const matchDia = cleanStr.match(/(\d{1,2})/);
    if (!matchDia) return '';
    const dia = parseInt(matchDia[1], 10);

    // 3. Encontrar o ano
    const matchAno = cleanStr.match(/(\d{4})/);
    let ano;

    if (matchAno) {
      ano = parseInt(matchAno[1], 10);
    } else {
      const hoje = new Date();
      ano = hoje.getFullYear();
      // Ajuste para virada de ano
      if (hoje.getMonth() >= 10 && mesIndex <= 1) ano = ano + 1;
      else if (hoje.getMonth() <= 1 && mesIndex >= 10) ano = ano - 1;
    }

    const data = new Date(ano, mesIndex, dia);
    const yyyy = data.getFullYear();
    const mm = String(data.getMonth() + 1).padStart(2, '0');
    const dd = String(data.getDate()).padStart(2, '0');
    
    return `${yyyy}-${mm}-${dd}`;

  } catch (e) { 
    console.error("Erro ao processar data:", e);
    return ''; 
  }
}

// --- LÓGICA DE RECONSTRUÇÃO ---
const mapSavedToAssignments = (savedRows, schedule) => {
  const newAssignments = {};
  if (!savedRows || savedRows.length === 0) return newAssignments;

  const rowsByPart = {};
  savedRows.forEach(row => {
    if (!rowsByPart[row.nome_parte]) rowsByPart[row.nome_parte] = [];
    rowsByPart[row.nome_parte].push(row.nome_completo);
  });

  const popAssignment = (partName) => {
    if (rowsByPart[partName] && rowsByPart[partName].length > 0) {
      return rowsByPart[partName].shift();
    }
    return "";
  };

  // Mapeamento Manual
  newAssignments['presidente'] = popAssignment('Presidente');
  newAssignments['ajudante'] = popAssignment('Ajudante');
  newAssignments['oracao_inicial'] = popAssignment('Oração Inicial');
  newAssignments['oracao_final'] = popAssignment('Oração Final');
  newAssignments['comentarios_iniciais'] = popAssignment(schedule.openingComments || 'Comentários Iniciais');
  newAssignments['comentarios_finais'] = popAssignment(schedule.finalComments || 'Comentários Finais');
  
  // Mapeamento do Cântico do Meio
  newAssignments['cantico_meio'] = popAssignment(schedule.middleSong || 'Cântico do Meio');

  // Tesouros
  schedule.treasures?.forEach((part, idx) => {
    newAssignments[`tesouro_${idx}`] = popAssignment(part.title);
  });

  // Ministério
  schedule.ministry?.forEach((part, idx) => {
    const isDiscurso = part.title.toLowerCase().includes('discurso');
    if (isDiscurso) {
      newAssignments[`ministerio_${idx}`] = popAssignment(part.title);
    } else {
      newAssignments[`ministerio_${idx}_1`] = popAssignment(part.title);
      newAssignments[`ministerio_${idx}_2`] = popAssignment(part.title);
    }
  });

  // Vida Cristã
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
  const router = useRouter();
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

  // 1. Carrega Publicadores e Histórico
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

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, 'ISO-8859-1');
    });
  };

  // --- CARREGAR REUNIÃO SALVA ---
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

  // --- IMPORTAR NOVO RTF ---
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

  // --- HANDLER DE MUDANÇA DE DESIGNAÇÃO (COM AUTOMAÇÃO) ---
  const handleAssignmentChange = (partId, name) => {
    setAssignmentsList(prevList => {
      const newList = [...prevList];
      // Copia as designações atuais para não mutar diretamente
      const currentAssignments = { ...newList[currentIndex] };

      // Atualiza o campo selecionado
      currentAssignments[partId] = name;

      // --- REGRA DE AUTOMAÇÃO: PRESIDENTE ---
      // Se mudar o Presidente, preenche automaticamente os outros campos dele
      if (partId === 'presidente') {
        currentAssignments['comentarios_iniciais'] = name;
        currentAssignments['comentarios_finais'] = name;
        currentAssignments['cantico_meio'] = name;
      }

      newList[currentIndex] = currentAssignments;
      return newList;
    });
  };
  // --------------------------------------------------------

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

    if (!currentDateSQL) { setSaveMessage({ text: 'Data inválida. Corrija o título da semana.', isError: true }); return; }
    
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

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-neutral-900"><Loader2 className="animate-spin text-white" /></div>;
  
  const hasData = schedules.length > 0;

  return (
    <div className="flex min-h-screen w-full bg-neutral-900 text-neutral-100 print:bg-white print:text-black">
      
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; padding: 0; }
          body * { visibility: hidden; }
          .designacoes-print-wrapper, .designacoes-print-wrapper * { visibility: visible; }
          .designacoes-print-wrapper { position: absolute; top: 0; left: 0; width: 100%; }
          .print-page-break { page-break-after: always; break-after: page; height: 100vh; width: 100%; display: block; padding: 5mm; box-sizing: border-box; overflow: hidden; }
          .print-page-break:last-child { page-break-after: auto; break-after: auto; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* === SIDEBAR DE HISTÓRICO === */}
      <aside className="w-64 bg-neutral-800 border-r border-neutral-700 shrink-0 hidden lg:flex flex-col no-print h-screen sticky top-0">
        <div className="p-4 border-b border-neutral-700">
          <h3 className="font-bold text-neutral-200 flex items-center gap-2">
            <History size={18} />
            Histórico
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {savedMeetingsList.length === 0 && (
            <p className="text-xs text-neutral-500 p-2 text-center">Nenhuma reunião salva.</p>
          )}
          {savedMeetingsList.map((m) => (
            <button
              key={m.dataSQL}
              onClick={() => handleLoadSavedMeeting(m)}
              className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors flex flex-col gap-0.5
                ${meetingDates[currentIndex] === m.dataSQL && hasData 
                  ? 'bg-blue-900/40 text-blue-100 border border-blue-800' 
                  : 'hover:bg-neutral-700 text-neutral-300'
                }`}
            >
              <span className="font-medium">{m.descricao}</span>
              <span className="text-xs text-neutral-500">{m.dataFormatada}</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-neutral-700">
             <button onClick={() => router.push('/admin/dashboard')} className="flex w-full justify-center items-center gap-2 py-2 px-3 rounded-lg text-sm bg-neutral-700 hover:bg-neutral-600">
                <ArrowLeft size={16} /> Voltar ao Painel
              </button>
        </div>
      </aside>

      {/* === ÁREA PRINCIPAL === */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Header Mobile */}
        <div className="lg:hidden p-4 bg-neutral-800 border-b border-neutral-700 flex justify-between items-center no-print">
           <h2 className="font-bold">Designações</h2>
           <button onClick={() => router.push('/admin/dashboard')} className="p-2 bg-neutral-700 rounded"><ArrowLeft size={16}/></button>
        </div>

        {/* CONTROLES */}
        <div className="p-6 no-print">
           <div className="max-w-4xl mx-auto bg-neutral-800 rounded-lg shadow-md overflow-hidden border border-neutral-700">
              <div className="p-6 border-b border-neutral-700">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <FileText size={20} className="text-blue-400" />
                    Editor
                  </h2>
                  
                  <label htmlFor="rtf-upload-change" className="flex items-center gap-2 py-2 px-4 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 cursor-pointer transition font-medium text-white shadow-sm">
                    <UploadCloud size={18} /> 
                    Importar RTF
                    <input id="rtf-upload-change" type="file" multiple accept=".rtf, .txt" className="hidden" onChange={handleFilesParse} />
                  </label>
                </div>

                {!hasData && !isParsing && (
                  <div className="text-center py-10 text-neutral-400 border-2 border-dashed border-neutral-600 rounded-lg">
                    <p>Selecione um histórico ao lado ou importe um arquivo RTF.</p>
                  </div>
                )}

                {isParsing && <div className="py-8 text-center text-blue-300 flex justify-center items-center gap-2"><Loader2 className="animate-spin" /> Processando...</div>}
                {error && <div className="mt-4 p-3 bg-red-900/30 text-red-300 rounded-md text-sm border border-red-800">{error}</div>}
              </div>

              {hasData && (
                <div className="p-4 bg-neutral-700/30 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setCurrentIndex(c => Math.max(0, c - 1)); setSaveMessage({text:'', isError:false}); }} disabled={currentIndex === 0} className="p-2 rounded-full bg-neutral-700 hover:bg-neutral-600 disabled:opacity-30 transition"><ChevronLeft size={20} /></button>
                    <span className="font-mono font-bold text-lg">
                      {schedules.length > 1 ? `Semana ${currentIndex + 1} de ${schedules.length}` : 'Visualização'}
                    </span>
                    <button onClick={() => { setCurrentIndex(c => Math.min(schedules.length - 1, c + 1)); setSaveMessage({text:'', isError:false}); }} disabled={currentIndex === schedules.length - 1} className="p-2 rounded-full bg-neutral-700 hover:bg-neutral-600 disabled:opacity-30 transition"><ChevronRight size={20} /></button>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <Calendar size={18} className="text-neutral-400" />
                    <input 
                      type="text" 
                      value={weekDescriptions[currentIndex] || ''} 
                      onChange={(e) => handleDescriptionChange(e.target.value)} 
                      className="bg-neutral-900 border border-neutral-600 rounded px-3 py-1.5 text-sm text-white w-full md:w-64 text-center font-bold uppercase focus:border-blue-500 outline-none" 
                    />
                    <button onClick={() => handleDescriptionChange(weekDescriptions[currentIndex])} className="p-2 bg-neutral-700 rounded hover:bg-neutral-600 transition text-neutral-300"><RefreshCw size={14} /></button>
                  </div>
                </div>
              )}

              {saveMessage.text && (
                <div className={`mx-6 mb-6 p-3 rounded-md text-sm flex items-center gap-2 ${saveMessage.isError ? 'bg-red-900/30 text-red-300 border border-red-800' : 'bg-green-900/30 text-green-300 border border-green-800'}`}>
                  {saveMessage.isError ? null : <Save size={14} />}
                  {saveMessage.text}
                </div>
              )}
           </div>
        </div>

        {/* TABELA E BOTÕES */}
        {hasData && (
          <div className="flex-1 flex flex-col">
            <div className="print:hidden px-6 pb-10">
              <TabelaDesignacoes 
                schedule={schedules[currentIndex]}
                assignments={assignmentsList[currentIndex]}
                weekText={weekDescriptions[currentIndex]}
                publicadores={publicadores}
                onAssignmentChange={handleAssignmentChange}
              />
              
              <div className="max-w-5xl mx-auto mt-8 flex justify-center gap-4">
                <button 
                  onClick={handleSaveCurrent} 
                  disabled={isSaving} 
                  className="flex items-center gap-2 py-3 px-8 rounded-lg font-bold text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 shadow-lg transition-transform hover:-translate-y-0.5"
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : <Save />} 
                  Salvar
                </button>
                
                <button 
                  onClick={handlePrintAll} 
                  className="flex items-center gap-2 py-3 px-8 rounded-lg font-bold text-white bg-neutral-700 hover:bg-neutral-600 shadow-lg transition-transform hover:-translate-y-0.5"
                >
                  <Printer /> 
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* IMPRESSÃO */}
        <div className="designacoes-print-wrapper hidden print:block">
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

      </main>
    </div>
  );
}