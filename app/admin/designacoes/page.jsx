'use client';

import { DashboardLayout } from '@/app/components/DashboardLayout';
import { useState, useEffect } from 'react';
import { Loader2, Printer, UploadCloud, ArrowLeft, Save, ChevronLeft, ChevronRight, Calendar, RefreshCw, History, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import TabelaDesignacoes from '@/app/componentes/TabelaDesignacoes';
import { Button } from '@/app/components/ui/button';

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

if (isLoading) return (
    <DashboardLayout>
       <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-purple-600" /></div>
    </DashboardLayout>
  );  
  const hasData = schedules.length > 0;

  return (
    <DashboardLayout>
      <div className="flex h-full flex-col md:flex-row gap-6 overflow-hidden">
        
        {/* SIDEBAR DE HISTÓRICO (Estilizada para o novo layout) */}
        <aside className="w-full md:w-64 bg-white rounded-xl border border-gray-200 shadow-sm shrink-0 flex flex-col overflow-hidden max-h-[400px] md:max-h-full md:h-full">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <History size={16} className="text-purple-600" />
              Histórico
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {savedMeetingsList.length === 0 && (
              <p className="text-xs text-gray-500 p-4 text-center">Nenhuma reunião salva.</p>
            )}
            {savedMeetingsList.map((m) => (
              <button
                key={m.dataSQL}
                onClick={() => handleLoadSavedMeeting(m)}
                className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors border border-transparent
                  ${meetingDates[currentIndex] === m.dataSQL && hasData 
                    ? 'bg-purple-50 text-purple-900 border-purple-100 font-medium' 
                    : 'hover:bg-gray-50 text-gray-600'
                  }`}
              >
                <div className="truncate">{m.descricao}</div>
                <div className="text-xs text-gray-400 mt-0.5">{m.dataFormatada}</div>
              </button>
            ))}
          </div>
        </aside>

        {/* ÁREA PRINCIPAL */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 overflow-y-auto pb-10">
            
            {/* Card de Controle */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" /> Editor de Reunião
                        </h2>
                        <p className="text-sm text-gray-500">Gerencie as designações da semana.</p>
                    </div>
                    <label className="flex items-center gap-2 py-2 px-4 rounded-lg text-sm bg-purple-600 hover:bg-purple-700 text-white cursor-pointer transition font-medium shadow-sm">
                        <UploadCloud size={16} /> 
                        {hasData ? 'Importar Outro' : 'Importar RTF'}
                        <input type="file" multiple accept=".rtf, .txt" className="hidden" onChange={handleFilesParse} />
                    </label>
                </div>

                {/* Navegação e Mensagens (Conteúdo existente adaptado) */}
                {/* ... (mantenha a lógica de navegação e alertas aqui, usando as cores do novo tema) ... */}
                {hasData && (
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setCurrentIndex(c => Math.max(0, c - 1))} disabled={currentIndex === 0} className="p-1.5 hover:bg-white rounded shadow-sm disabled:opacity-30"><ChevronLeft size={16}/></button>
                            <span className="text-sm font-medium min-w-[100px] text-center">Semana {currentIndex + 1}/{schedules.length}</span>
                            <button onClick={() => setCurrentIndex(c => Math.min(schedules.length - 1, c + 1))} disabled={currentIndex === schedules.length - 1} className="p-1.5 hover:bg-white rounded shadow-sm disabled:opacity-30"><ChevronRight size={16}/></button>
                        </div>
                        {/* ... Inputs de data ... */}
                    </div>
                )}
            </div>

            {/* Tabela */}
            {hasData && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-1">
                        <TabelaDesignacoes 
                            schedule={schedules[currentIndex]}
                            assignments={assignmentsList[currentIndex]}
                            weekText={weekDescriptions[currentIndex]}
                            publicadores={publicadores}
                            onAssignmentChange={handleAssignmentChange}
                        />
                    </div>
                    <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                        <Button onClick={handleSaveCurrent} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>}
                            Salvar Alterações
                        </Button>
                        <Button variant="outline" onClick={handlePrintAll}>
                            <Printer className="w-4 h-4 mr-2"/> Imprimir
                        </Button>
                    </div>
                </div>
            )}
        </div>

      </div>
    </DashboardLayout>
  )
}