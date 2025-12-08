'use client';

import { useSearchParams } from 'next/navigation';

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout'; 
import { Loader2, Printer, UploadCloud, Save, ChevronLeft, ChevronRight, Calendar, RefreshCw, History, FileText, X, Mail, MessageCircle, Plus, CheckCircle, AlertTriangle, Menu } from 'lucide-react';
import TabelaDesignacoes from '@/app/componentes/TabelaDesignacoes';
import { Button } from '@/app/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';

// --- CONSTANTES ---
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// --- COMPONENTE TOAST ---
function StatusToast({ message, type, onClose }) {
  if (!message) return null;
  const isError = type === 'error';
  const bgColor = isError ? 'bg-red-600' : 'bg-green-600';
  const hoverColor = isError ? 'hover:bg-red-700' : 'hover:bg-green-700';
  const Icon = isError ? AlertTriangle : CheckCircle; 

  return (
    <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-right duration-500">
      <div className={`${bgColor} text-white p-4 rounded-lg shadow-xl flex items-center justify-between min-w-[300px]`} role="alert">
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
    let mesIndex = -1;
    for (let i = 0; i < MESES.length; i++) {
      if (cleanStr.includes(MESES[i].toUpperCase())) {
        mesIndex = i;
        break;
      }
    }
    if (mesIndex === -1) return '';
    const matchDia = cleanStr.match(/(\d{1,2})/);
    if (!matchDia) return '';
    const dia = parseInt(matchDia[1], 10);
    const matchAno = cleanStr.match(/(\d{4})/);
    let ano;
    if (matchAno) {
      ano = parseInt(matchAno[1], 10);
    } else {
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

function getGroupLabel(dataSQL) {
    if (!dataSQL) return 'Outros';
    const [ano, mes] = dataSQL.split('-');
    const nomeMes = MESES[parseInt(mes, 10) - 1];
    return `${nomeMes} ${ano}`;
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

const generateWhatsAppText = (weekText, schedule, assignments) => {
  let text = `*DESIGNAÇÕES: ${weekText}*\n_Nossa Vida e Ministério Cristão_\n\n`;
  text += `🏛 *SALÃO PRINCIPAL*\nPresidente: *${assignments.presidente || '---'}*\nAjudante: ${assignments.ajudante || '---'}\n\n`;
  text += `🎵 Cântico Inicial: *${schedule.initialSong}*\n🙏 Oração: *${assignments.oracao_inicial || '---'}*\n🗣 ${schedule.openingComments || 'Comentários'}: *${assignments.comentarios_iniciais || '---'}*\n\n`;
  text += `💎 *TESOUROS DA PALAVRA DE DEUS*\n`;
  schedule.treasures?.forEach((part, idx) => {
    const title = part.title.replace(/\(.*\)/, '').trim(); 
    text += `• ${title}: *${assignments[`tesouro_${idx}`] || '---'}*\n`;
  });
  text += `\n🌾 *FAÇA SEU MELHOR NO MINISTÉRIO*\n`;
  schedule.ministry?.forEach((part, idx) => {
    const title = part.title.replace(/\(.*\)/, '').trim();
    const isDiscurso = part.title.toLowerCase().includes('discurso');
    if (isDiscurso) {
       text += `• ${title}: *${assignments[`ministerio_${idx}`] || '---'}*\n`;
    } else {
       const est = assignments[`ministerio_${idx}_1`] || '---';
       const aju = assignments[`ministerio_${idx}_2`] || '---';
       text += `• ${title}:\n   👤 *${est}* / 👥 ${aju}\n`;
    }
  });
  text += `\n✝ *NOSSA VIDA CRISTÃ*\n🎵 ${schedule.middleSong}: *${assignments.cantico_meio || '---'}*\n`;
  schedule.living?.forEach((part, idx) => {
    const title = part.title.replace(/\(.*\)/, '').trim();
    const isBibleStudy = part.title.toLowerCase().includes('estudo bíblico');
    if (isBibleStudy) {
        const dirig = assignments[`vida_${idx}_1`] || '---';
        const leitor = assignments[`vida_${idx}_2`] || '---';
        text += `• ${title}:\n   📖 *${dirig}* / 🗣 ${leitor}\n`;
    } else {
        text += `• ${title}: *${assignments[`vida_${idx}`] || '---'}*\n`;
    }
  });
  text += `\n🗣 ${schedule.finalComments}: *${assignments.comentarios_finais || '---'}*\n🎵 ${schedule.finalSong}\n🙏 Oração Final: *${assignments.oracao_final || '---'}*`;
  return encodeURIComponent(text);
};

// --- SUB-COMPONENTE: Lista de Histórico ---
const HistoryList = ({ listaFiltrada, meetingDates, currentIndex, hasData, handleLoadSavedMeeting }) => (
  <div className="space-y-1 p-1">
    {listaFiltrada.length === 0 && (
      <p className="text-xs text-gray-500 p-4 text-center">Nenhuma reunião encontrada.</p>
    )}
    {listaFiltrada.map((m, index) => {
        const currentGroup = getGroupLabel(m.dataSQL);
        const prevGroup = index > 0 ? getGroupLabel(listaFiltrada[index - 1].dataSQL) : null;
        const showGroupHeader = currentGroup !== prevGroup;

        return (
          <div key={m.dataSQL}>
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
);

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

  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState('');

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false); 
  const [emailsList, setEmailsList] = useState([]); 
  const [newEmailInput, setNewEmailInput] = useState(''); 
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const [toastData, setToastData] = useState({ message: '', type: '' });

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

  useEffect(() => {
    if (toastData.message) {
      const timer = setTimeout(() => setToastData({ message: '', type: '' }), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastData]);

  // --- MODAL DE DESIGNAÇÕES POR PUBLICADOR (DEEP LINK) ---
  const searchParams = useSearchParams(); // Requires: import { useSearchParams } from 'next/navigation';
  const [pubModalData, setPubModalData] = useState({ open: false, name: '', assignments: [] });

  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId) {
        // Fetch specific publisher assignments
        fetch(`/api/admin/get-designacoes-publicador?id=${highlightId}`)
            .then(res => res.json())
            .then(data => {
                if (data.assignments) {
                    setPubModalData({ 
                        open: true, 
                        name: data.publisher, 
                        assignments: data.assignments 
                    });
                }
            })
            .catch(err => console.error("Erro ao carregar designações do publicador", err));
    }
  }, [searchParams]);

  const refreshSavedMeetings = async () => {
    try {
      const res = await fetch('/api/admin/get-reunioes');
      if(res.ok) setSavedMeetingsList(await res.json());
    } catch(e) { console.error(e); }
  };

  const { listaFiltrada, anosDisponiveis } = useMemo(() => {
    const anosSet = new Set();
    savedMeetingsList.forEach(m => {
      if(m.dataSQL) anosSet.add(m.dataSQL.split('-')[0]);
    });
    const anos = Array.from(anosSet).sort().reverse();

    let lista = savedMeetingsList;
    if (filtroAno) {
      lista = lista.filter(m => m.dataSQL.startsWith(filtroAno));
    }
    if (filtroMes) {
      lista = lista.filter(m => {
        const mes = m.dataSQL.split('-')[1];
        return mes === filtroMes;
      });
    }

    return { listaFiltrada: lista, anosDisponiveis: anos };
  }, [savedMeetingsList, filtroMes, filtroAno]);

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
      setIsHistoryModalOpen(false);
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

    setIsParsing(true); setError('');
    
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

    if (!currentDateSQL) {
        setToastData({ message: 'Data inválida. Verifique o título da semana.', type: 'error' });
        return; 
    }
    
    setIsSaving(true);
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
      setToastData({ message: 'Salvo com sucesso!', type: 'success' });
      refreshSavedMeetings();
    } catch (err) { 
      setToastData({ message: err.message, type: 'error' });
    } finally { setIsSaving(false); }
  };

  const handleOpenEmailModal = () => {
    const currentAssignments = assignmentsList[currentIndex];
    if (!currentAssignments) {
        setIsEmailModalOpen(true);
        return;
    }

    const assignedNames = Object.values(currentAssignments).filter(Boolean);
    const uniqueNames = [...new Set(assignedNames)];

    const emailsFound = publicadores
      .filter(p => uniqueNames.includes(p.nome_completo) && p.email && p.email.trim() !== '')
      .map(p => p.email);

    setEmailsList(emailsFound);
    setNewEmailInput('');
    setIsEmailModalOpen(true);
  };

  const handleAddEmail = () => {
    const val = newEmailInput.trim();
    if (!val) return;
    if (!val.includes('@')) return;
    if (!emailsList.includes(val)) {
        setEmailsList([...emailsList, val]);
    }
    setNewEmailInput('');
  };

  const handleRemoveEmail = (emailToRemove) => {
    setEmailsList(prev => prev.filter(e => e !== emailToRemove));
  };

  const handleKeyDownEmail = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleAddEmail();
    }
  };

  const handleSendBatchEmails = async (e) => {
    e.preventDefault();
    if (emailsList.length === 0) return;

    setIsSendingEmail(true);

    try {
      const response = await fetch('/api/admin/enviar-emails-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientsList: emailsList,
          weekText: weekDescriptions[currentIndex],
          schedule: schedules[currentIndex],
          assignments: assignmentsList[currentIndex]
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setToastData({ message: 'E-mails enviados com sucesso!', type: 'success' });
        setIsEmailModalOpen(false);
      } else {
        setToastData({ message: data.message || 'Erro ao enviar.', type: 'error' });
      }
    } catch (err) {
      setToastData({ message: 'Erro de conexão.', type: 'error' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleShareWhatsApp = () => {
    const currentSchedule = schedules[currentIndex];
    const currentAssignments = assignmentsList[currentIndex];
    const currentDescription = weekDescriptions[currentIndex];
    const text = generateWhatsAppText(currentDescription, currentSchedule, currentAssignments);
    window.open(`https://wa.me/?text=${text}`, '_blank');
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
      {/* TOAST FLUTUANTE */}
      <StatusToast 
        message={toastData.message} 
        type={toastData.type} 
        onClose={() => setToastData({ message: '', type: '' })} 
      />

      {/* MODAL DE EMAIL */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-600" /> Enviar Designações
              </h3>
              <button onClick={() => setIsEmailModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm">
                 O sistema identificou automaticamente os e-mails dos publicadores designados abaixo. Verifique e edite conforme necessário.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destinatários</label>
                <div className="flex flex-wrap gap-2 mb-3 p-3 border border-gray-200 rounded-md bg-gray-50 min-h-[60px]">
                    {emailsList.length === 0 && <span className="text-gray-400 text-sm italic">Nenhum e-mail selecionado.</span>}
                    {emailsList.map((email, idx) => (
                        <div key={idx} className="bg-white border border-gray-300 rounded-full px-3 py-1 text-sm flex items-center gap-2 shadow-sm">
                            <span className="text-gray-700 truncate max-w-[200px]">{email}</span>
                            <button type="button" onClick={() => handleRemoveEmail(email)} className="text-gray-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input type="email" value={newEmailInput} onChange={(e) => setNewEmailInput(e.target.value)} onKeyDown={handleKeyDownEmail} className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none text-gray-600" placeholder="Adicionar outro e-mail..." />
                    <button type="button" onClick={handleAddEmail} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md border border-gray-300"><Plus size={18} /></button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3 shrink-0 bg-white">
                <button type="button" onClick={() => setIsEmailModalOpen(false)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">Cancelar</button>
                <button type="button" onClick={handleSendBatchEmails} disabled={isSendingEmail || emailsList.length === 0} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors flex justify-center items-center disabled:opacity-50">
                  {isSendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : `Enviar (${emailsList.length})`}
                </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HISTÓRICO (MOBILE) */}
      <Sheet open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <SheetContent side="left" className="w-[85vw] sm:max-w-sm p-0 bg-white">
            <SheetHeader className="p-4 border-b border-gray-100 bg-gray-50/50 text-left">
                <SheetTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <History size={18} className="text-purple-600" /> Histórico
                </SheetTitle>
                <SheetDescription className="text-xs text-gray-500">Selecione uma reunião antiga para editar.</SheetDescription>
            </SheetHeader>
            <div className="p-4 border-b border-gray-100 bg-white grid grid-cols-2 gap-2">
                <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="text-xs border border-gray-200 rounded p-1.5 bg-white focus:ring-1 focus:ring-purple-500 outline-none text-gray-700">
                   <option value="">Mês</option>
                   {MESES.map((m, i) => <option key={i} value={String(i+1).padStart(2, '0')}>{m.substring(0, 3)}</option>)}
                </select>
                <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="text-xs border border-gray-200 rounded p-1.5 bg-white focus:ring-1 focus:ring-purple-500 outline-none text-gray-700">
                   <option value="">Ano</option>
                   {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>
            <div className="overflow-y-auto h-[calc(100vh-180px)]">
                <HistoryList 
                    listaFiltrada={listaFiltrada} 
                    meetingDates={meetingDates} 
                    currentIndex={currentIndex} 
                    hasData={hasData} 
                    handleLoadSavedMeeting={handleLoadSavedMeeting} 
                />
            </div>
        </SheetContent>
      </Sheet>

      <div className="flex h-[calc(100vh-7rem)] bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* SIDEBAR DESKTOP */}
        <aside className="hidden md:flex w-full md:w-60 border-r border-gray-200 shadow-sm shrink-0 flex-col overflow-hidden no-print bg-white">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm"><History size={16} className="text-purple-600" /> Histórico</h3>
                {(filtroMes || filtroAno) && (
                    <button onClick={() => { setFiltroMes(''); setFiltroAno(''); }} className="text-[10px] text-red-500 flex items-center hover:underline"><X size={10} className="mr-1"/> Limpar</button>
                )}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="text-[11px] border border-gray-200 rounded p-1 bg-white focus:ring-1 focus:ring-purple-500 outline-none text-gray-700">
                   <option value="">Mês</option>
                   {MESES.map((m, i) => <option key={i} value={String(i+1).padStart(2, '0')}>{m.substring(0, 3)}</option>)}
                </select>
                <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="text-[11px] border border-gray-200 rounded p-1 bg-white focus:ring-1 focus:ring-purple-500 outline-none text-gray-700">
                   <option value="">Ano</option>
                   {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
             <HistoryList 
                listaFiltrada={listaFiltrada} 
                meetingDates={meetingDates} 
                currentIndex={currentIndex} 
                hasData={hasData} 
                handleLoadSavedMeeting={handleLoadSavedMeeting} 
             />
          </div>
        </aside>

        {/* ÁREA PRINCIPAL */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden relative no-print min-w-0">
            <div className="p-4 border-b border-gray-200 flex flex-wrap justify-between items-center bg-white z-10 gap-2">
                <div className="flex items-center gap-2 shrink-0">
                   <button onClick={() => setIsHistoryModalOpen(true)} className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-md">
                      <Menu size={20} />
                   </button>
                   <FileText size={20} className="text-purple-600" />
                   <h2 className="font-bold text-gray-900 text-base">Editor</h2>
                </div>

                <div className="flex items-center gap-2 ml-auto shrink-0">
                    {hasData && (
                      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mr-2 shrink-0">
                         <button onClick={() => { setCurrentIndex(c => Math.max(0, c - 1)); }} disabled={currentIndex === 0} className="p-1.5 hover:bg-white rounded-md disabled:opacity-30"><ChevronLeft size={16}/></button>
                         <span className="text-xs font-medium px-2 w-20 text-center text-gray-600">Semana {currentIndex + 1}</span>
                         <button onClick={() => { setCurrentIndex(c => Math.min(schedules.length - 1, c + 1)); }} disabled={currentIndex === schedules.length - 1} className="p-1.5 hover:bg-white rounded-md disabled:opacity-30"><ChevronRight size={16}/></button>
                      </div>
                    )}
                    <label className="flex items-center gap-2 py-2 px-3 rounded-md text-sm bg-purple-600 hover:bg-purple-700 text-white cursor-pointer transition font-medium shadow-sm shrink-0">
                        <UploadCloud size={16} /> 
                        <span className="hidden sm:inline">{hasData ? 'Importar' : 'Importar'}</span>
                        <span className="sm:hidden">{hasData ? 'Trocar' : 'RTF'}</span>
                        <input type="file" multiple accept=".rtf, .txt" className="hidden" onChange={handleFilesParse} />
                    </label>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50/30 scroll-smooth">
                {isParsing ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 animate-in fade-in duration-300">
                     <div className="bg-white p-6 rounded-full shadow-lg border border-gray-100"><Loader2 className="animate-spin text-purple-600 w-10 h-10" /></div>
                     <p className="text-sm font-medium text-gray-500">Processando arquivo...</p>
                  </div>
                ) : !hasData ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8 border-2 border-dashed border-gray-200 rounded-lg m-4">
                    <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4 text-purple-300"><UploadCloud size={32} /></div>
                    <p className="text-gray-900 font-medium">Nenhuma reunião carregada</p>
                  </div>
                ) : (
                  <div className="max-w-5xl mx-auto space-y-6 pb-10">
                      {error && (<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>)}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-2 w-full sm:w-auto"><Calendar size={16} className="text-gray-400" /><span className="text-sm font-medium text-gray-600">Data da Reunião:</span></div>
                          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 justify-end">
                             <input type="text" value={weekDescriptions[currentIndex] || ''} onChange={(e) => handleDescriptionChange(e.target.value)} className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-900 w-full sm:w-64 text-center font-bold uppercase focus:border-purple-500 focus:ring-0 outline-none transition-all" />
                              <button onClick={() => handleDescriptionChange(weekDescriptions[currentIndex])} className="p-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-600" title="Recarregar"><RefreshCw size={14}/></button>
                          </div>
                      </div>

                      {/* TABELA COM SCROLL BIDIRECIONAL APENAS NO MOBILE */}
                      <div className="bg-white shadow-sm border border-gray-200 rounded-lg flex flex-col">
                          {/* Mobile: Scroll interno (auto) com altura máxima. Desktop: Sem scroll interno (visible) e altura automática */}
                          <div className="overflow-auto max-h-[75vh] w-full rounded-lg md:overflow-visible md:max-h-none">
                             {/* Mobile: Força largura para scroll. Desktop: Largura fluida */}
                             <div className="min-w-[900px] md:min-w-0">
                                <TabelaDesignacoes 
                                    schedule={schedules[currentIndex]}
                                    assignments={assignmentsList[currentIndex]}
                                    weekText={weekDescriptions[currentIndex]}
                                    publicadores={publicadores}
                                    onAssignmentChange={handleAssignmentChange}
                                />
                             </div>
                          </div>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
                         <div className="flex gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                            <Button variant="outline" onClick={handleShareWhatsApp} className="bg-green-500 border-green-600 text-white hover:bg-green-600 hover:text-white flex-1 sm:flex-none min-w-[120px]"><MessageCircle className="w-4 h-4 mr-2"/> WhatsApp</Button>
                            <Button variant="outline" onClick={handleOpenEmailModal} className="bg-white border-purple-200 text-purple-700 hover:bg-purple-50 flex-1 sm:flex-none min-w-[100px]"><Mail className="w-4 h-4 mr-2"/> Email</Button>
                            <Button variant="outline" onClick={handlePrintAll} className=" bg-blue-600 flex-1 sm:flex-none border-gray-300 text-white  hover:bg-blue-500 min-w-[100px]"><Printer className="w-4 h-4 mr-2"/> Imprimir</Button>
                            <Button onClick={handleSaveCurrent} disabled={isSaving} className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none text-white min-w-[100px]">{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>} Salvar</Button>
                         </div>
                      </div>
                  </div>
                )}
            </div>
        </div>
      </div>
      <div className="designacoes-print-wrapper printable-content">
        {schedules.map((schedule, idx) => (<div key={idx} className="print-page-break"><TabelaDesignacoes schedule={schedule} assignments={assignmentsList[idx]} weekText={weekDescriptions[idx]} publicadores={publicadores} isPrintView={true} /></div>))}
      </div>

      {/* MODAL DE VISUALIZAÇÃO DE DESIGNACÕES FUTURAS */}
      {pubModalData.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-purple-50">
                 <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-600" /> 
                    <span>Designações Futuras</span>
                 </h3>
                 <button onClick={() => { setPubModalData(prev => ({ ...prev, open: false })); window.history.replaceState(null, '', '/admin/designacoes'); }} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                 </button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                 <p className="text-sm text-gray-500 mb-4">
                    Listando designações de <strong>{pubModalData.name}</strong> a partir de hoje.
                 </p>
                 {pubModalData.assignments.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-gray-100 border-dashed">
                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma designação futura encontrada.</p>
                    </div>
                 ) : (
                    <div className="space-y-2">
                       {pubModalData.assignments.map((assign, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-100 rounded-lg hover:border-purple-200 transition-colors">
                              <div className="flex items-center gap-3">
                                 <div className="bg-purple-100 p-2 rounded-md">
                                    <span className="text-xs font-bold text-purple-700 block text-center leading-none">
                                        {new Date(assign.data_reuniao).getDate()}
                                    </span>
                                    <span className="text-[10px] text-purple-600 uppercase block text-center leading-none mt-0.5">
                                        {new Date(assign.data_reuniao).toLocaleString('pt-BR', { month: 'short' }).replace('.','')}
                                    </span>
                                 </div>
                                 <span className="font-medium text-gray-900 text-sm">{assign.nome_parte}</span>
                              </div>
                              <div className="text-xs text-gray-400">
                                 {new Date(assign.data_reuniao).getFullYear()}
                              </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100 text-right">
                  <Button onClick={() => { setPubModalData(prev => ({ ...prev, open: false })); window.history.replaceState(null, '', '/admin/designacoes'); }} variant="outline" size="sm">
                    Fechar
                  </Button>
              </div>
           </div>
        </div>
      )}

    </DashboardLayout>
  );
}