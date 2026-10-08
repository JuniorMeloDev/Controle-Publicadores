'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/app/components/PermissionsContext';
import { isAllowed } from '@/app/lib/access-control';
import { jsPDF } from "jspdf";
import { Loader2, Printer, UploadCloud, Save, ChevronLeft, ChevronRight, Calendar, RefreshCw, History, FileText, X, Mail, MessageCircle, Plus, CheckCircle, AlertTriangle, Menu } from 'lucide-react';
import TabelaDesignacoes from '@/app/componentes/TabelaDesignacoes';
import { Button } from '@/app/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';
import { StatusToast } from '@/app/components/ui/status-toast';
import { useDesignationPeriod } from './DesignationPeriodContext';
import { requestMeetingProgram } from '@/app/lib/import-programs-client';
import { buildLifeMinistryWhatsAppMessage, lifeMinistryWhatsAppUrl } from '@/app/lib/life-ministry-whatsapp';
import { DesignationPeriodFilters, designationToolbarClass, designationActionClass, designationListHeaderClass } from './DesignationLayout';

// --- CONSTANTES ---
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// --- FUNÇÕES AUXILIARES ---
function truncatePartTitle(title) {
  if (!title) return '';
  const norm = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (norm.includes('cantico') || norm.startsWith('cantemos')) return title;
  const match = title.match(/^(.*?\(\d+\s*min\))/i);
  if (match) {
    let base = match[1].trim();
    const afterTime = title.substring(match[0].length);
    if (afterTime.match(/^[:\s]*Considera/i)) base += ': Consideração';
    return base;
  }
  const dotIdx = title.indexOf('.');
  if (dotIdx > 0 && dotIdx < 100) return title.substring(0, dotIdx).trim();
  return title.substring(0, 100).trim();
}

function getShortName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';
  const parts = fullName.split(' ').filter(Boolean);
  if (parts.length === 1) return fullName;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function getGroupLabel(dataSQL) {
  if (!dataSQL) return 'Outros';
  const [ano, mes] = dataSQL.split('-');
  const nomeMes = MESES[parseInt(mes, 10) - 1];
  return `${nomeMes} ${ano}`;
}

function formatFullDateBR(dateStr) {
  if (!dateStr) return '';
  const str = new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const mapSavedToAssignments = (savedRows, schedule) => {
  const newAssignments = {};
  if (!savedRows || savedRows.length === 0) return newAssignments;
  const externalParticipants = schedule.participantes_externos || [];
  const externalByPart = new Map(externalParticipants.map(p => [p.parte_id, p.nome_completo]));
  const rowsByPart = {};
  savedRows.forEach(row => {
    if (externalParticipants.some(p => p.nome_parte === row.nome_parte && p.nome_completo === row.nome_completo)) return;
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
    newAssignments[`tesouro_${idx}`] = externalByPart.get(`tesouro_${idx}`) || popAssignment(truncatePartTitle(part.title));
  });
  schedule.ministry?.forEach((part, idx) => {
    const isDiscurso = part.title.toLowerCase().includes('discurso');
    if (isDiscurso) {
      newAssignments[`ministerio_${idx}`] = externalByPart.get(`ministerio_${idx}`) || popAssignment(truncatePartTitle(part.title));
    } else {
      newAssignments[`ministerio_${idx}_1`] = externalByPart.get(`ministerio_${idx}_1`) || popAssignment(truncatePartTitle(part.title));
      newAssignments[`ministerio_${idx}_2`] = externalByPart.get(`ministerio_${idx}_2`) || popAssignment(truncatePartTitle(part.title));
    }
  });
  schedule.living?.forEach((part, idx) => {
    const isBibleStudy = part.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes('estudo biblico');
    if (isBibleStudy) {
      newAssignments[`vida_${idx}_1`] = popAssignment(truncatePartTitle(part.title));
      newAssignments[`vida_${idx}_2`] = popAssignment(truncatePartTitle(part.title));
    } else {
      newAssignments[`vida_${idx}`] = popAssignment(truncatePartTitle(part.title));
    }
  });
  return newAssignments;
};

const generateWhatsAppText = (weekText, schedule, assignments, publishers) =>
  encodeURIComponent(buildLifeMinistryWhatsAppMessage(weekText, schedule, assignments, publishers));

function getWeekCompletionStats(schedule, assignments = {}) {
  if (!schedule) return { total: 0, filled: 0, percentage: 0 };
  let total = 0;
  let filled = 0;

  total += 1; if (assignments.presidente) filled += 1;
  total += 1; if (assignments.oracao_inicial) filled += 1;
  total += 1; if (assignments.comentarios_iniciais) filled += 1;

  schedule.treasures?.forEach((_, idx) => {
    total += 1;
    if (assignments[`tesouro_${idx}`]) filled += 1;
  });
  schedule.ministry?.forEach((part, idx) => {
    const isDiscurso = part.title?.toLowerCase().includes('discurso');
    if (isDiscurso) {
      total += 1;
      if (assignments[`ministerio_${idx}`] || assignments[`ministerio_${idx}_1`]) filled += 1;
    } else {
      total += 2;
      if (assignments[`ministerio_${idx}_1`] || assignments[`ministerio_${idx}`]) filled += 1;
      if (assignments[`ministerio_${idx}_2`]) filled += 1;
    }
  });

  total += 1; if (assignments.cantico_meio) filled += 1;
  schedule.living?.forEach((part, idx) => {
    const isBibleStudy = part.title?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes('estudo biblico');
    if (isBibleStudy) {
      total += 2;
      if (assignments[`vida_${idx}_1`] || assignments[`vida_${idx}`]) filled += 1;
      if (assignments[`vida_${idx}_2`]) filled += 1;
    } else {
      total += 1;
      if (assignments[`vida_${idx}`] || assignments[`vida_${idx}_1`]) filled += 1;
    }
  });

  total += 1; if (assignments.comentarios_finais) filled += 1;
  total += 1; if (assignments.oracao_final) filled += 1;

  const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { total, filled, percentage };
}

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

import { HistorySidebar } from '@/app/components/designacoes/HistorySidebar';
import { MobileDesignationModal } from './MobileDesignationModal';

// ... (imports remain)

export function LifeMinistryTab() {
  const { permissions } = usePermissions();
  const canImport = isAllowed(permissions, 'designacoes_importar', 'actions');
  const canEmail = isAllowed(permissions, 'designacoes_email', 'actions');
  const [publicadores, setPublicadores] = useState([]);
  const [savedMeetingsList, setSavedMeetingsList] = useState([]);
  const [historyData, setHistoryData] = useState([]); // New state for history
  const [isLoading, setIsLoading] = useState(true);

  const [schedules, setSchedules] = useState([]);
  const [assignmentsList, setAssignmentsList] = useState([]);
  const [weekDescriptions, setWeekDescriptions] = useState([]);
  const [meetingDates, setMeetingDates] = useState([]);
  const [meetingIds, setMeetingIds] = useState([]);
  const [pendingMeeting, setPendingMeeting] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState('');
  const [programSessionRequired, setProgramSessionRequired] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New Filter state for Sidebar
  const { month, year } = useDesignationPeriod();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const [emailsList, setEmailsList] = useState([]);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [importQueue, setImportQueue] = useState([]);

  const [toastData, setToastData] = useState({ message: '', type: '' });

  useEffect(() => {
    async function fetchData() {
      try {
        const [pubRes, meetingsRes, historyRes] = await Promise.all([
          fetch('/api/admin/get-publicadores'),
          fetch('/api/admin/get-reunioes'),
          fetch('/api/admin/get-historico-designacoes')
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

        if (historyRes.ok) {
          setHistoryData(await historyRes.json());
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

  const refreshSavedMeetings = async () => {
    try {
      const res = await fetch('/api/admin/get-reunioes');
      if (res.ok) setSavedMeetingsList(await res.json());
    } catch (e) { console.error(e); }
  };

  // Filter Logic centralized
  const filteredMeetings = useMemo(() => {
    let lista = [...savedMeetingsList];
    meetingDates.forEach((date, idx) => {
      if (!date || !schedules[idx]) return;
      const existing = lista.findIndex(m => m.dataSQL === date);
      const loaded = { dataSQL: date, reuniao_id: meetingIds[idx], descricao: weekDescriptions[idx], tem_programacao: true };
      if (existing >= 0) lista[existing] = { ...lista[existing], ...loaded };
      else lista.push(loaded);
    });
    if (year) {
      lista = lista.filter(m => m.dataSQL.startsWith(year));
    }
    if (month) {
      lista = lista.filter(m => {
        const mPart = m.dataSQL.split('-')[1];
        return mPart === month;
      });
    }
    // Sort Ascending (Oldest to Newest)
    return lista.sort((a, b) => a.dataSQL.localeCompare(b.dataSQL));
  }, [savedMeetingsList, month, year, meetingDates, schedules, meetingIds, weekDescriptions]);

  // Sidebar Items
  const sidebarItems = useMemo(() => {
    return filteredMeetings.map(m => ({
      id: m.dataSQL,
      date: m.dataSQL,
      label: m.descricao,
      subLabel: m.cancelado ? 'Reunião cancelada' : !m.tem_programacao ? 'Programação pendente' : 'Programação disponível',
      meeting: m
    }));
  }, [filteredMeetings]);

  // ... (readFileAsText, handleLoadSavedMeeting, etc. remain the same)


  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, 'ISO-8859-1');
    });
  };

  const handleLoadSavedMeeting = async (meeting) => {
    meeting = savedMeetingsList.find(m => m.dataSQL === meeting.dataSQL) || meeting;
    if (meeting.cancelado) {
      setToastData({ message: meeting.motivo_cancelamento, type: 'error' });
      return;
    }
    const loadedIndex = meetingDates.findIndex((date, idx) => date === meeting.dataSQL && schedules[idx]);
    if (loadedIndex >= 0) {
      setPendingMeeting(null);
      setCurrentIndex(loadedIndex);
      setIsMobileModalOpen(true);
      return;
    }
    if (meeting.tem_programacao === false) {
      setPendingMeeting(meeting);
      setIsMobileModalOpen(false);
      return;
    }
    setPendingMeeting(null);
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

      setSchedules(prev => [...prev, scheduleData]);
      setWeekDescriptions(prev => [...prev, meeting.descricao]);
      setMeetingDates(prev => [...prev, meeting.dataSQL]);
      setMeetingIds(prev => [...prev, meeting.reuniao_id]);
      setAssignmentsList(prev => [...prev, reconstructedAssignments]);
      setCurrentIndex(schedules.length);
      setIsMobileModalOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFetchProgram = async () => {
    if (!pendingMeeting || isParsing) return;
    setIsParsing(true);
    setError('');
    setProgramSessionRequired(false);
    try {
      const result = await requestMeetingProgram(pendingMeeting.reuniao_id);
      const listResponse = await fetch('/api/admin/get-reunioes');
      if (!listResponse.ok) throw new Error('Programação salva. Atualize a página para carregar a reunião.');
      const list = await listResponse.json();
      setSavedMeetingsList(list);
      const meeting = list.find(m => m.reuniao_id === pendingMeeting.reuniao_id);
      if (meeting?.tem_programacao) {
        // Load the fresh entry rather than the old pending entry in state.
        const struct = await fetch(`/api/admin/get-reuniao-dados?date=${meeting.dataSQL}`);
        const assigned = await fetch(`/api/recuperar-designacoes?date=${meeting.dataSQL}`);
        if (!struct.ok || !assigned.ok) throw new Error('Programação salva. Atualize a página para carregar a reunião.');
        const schedule = await struct.json();
        const assignments = mapSavedToAssignments(await assigned.json(), schedule);
        setSchedules(prev => [...prev, schedule]); setWeekDescriptions(prev => [...prev, meeting.descricao]);
        setMeetingDates(prev => [...prev, meeting.dataSQL]); setMeetingIds(prev => [...prev, meeting.reuniao_id]);
        setAssignmentsList(prev => [...prev, assignments]);
        setCurrentIndex(schedules.length); setPendingMeeting(null);
        setIsMobileModalOpen(true);
      }
      setToastData({ message: result.message, type: 'success' });
    } catch (err) { setError(err.message); setProgramSessionRequired(err.status === 401); }
    finally { setIsParsing(false); }
  };

  const handleFilesParse = async (event) => {
    const readFileAsText = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    };

    const allSelectedFiles = Array.from(event.target.files);
    if (allSelectedFiles.length === 0) return;

    // Reset input
    event.target.value = '';

    // Arquivos _00.rtf são apenas a capa/sumário da apostila bimestral, não são semanas de reunião
    const files = allSelectedFiles.filter(f => !f.name.match(/_00\.(rtf|txt)$/i));

    if (files.length === 0) {
      setToastData({
        message: 'O arquivo com final "_00" é apenas a capa da apostila. Por favor, selecione os arquivos das semanas (_01, _02, _03...) para importar.',
        type: 'error'
      });
      return;
    }

    files.sort((a, b) => a.name.localeCompare(b.name));

    setIsParsing(true); setError('');

    const newSchedules = [];
    const newAssignments = [];
    const newDescriptions = [];
    const newDates = [];
    const newMeetingIds = [];

    try {
      for (const file of files) {
        const textContent = await readFileAsText(file);

        // Timeout handling for fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout to avoid AbortError on heavy loads

        let response;
        try {
          response = await fetch('/api/admin/parse-rtf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ textContent, year: year || new Date().getFullYear() }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          let errData;
          try {
            errData = await response.json();
          } catch (_) {}
          throw new Error(errData?.message || `Erro ao processar ${file.name}`);
        }
        const parsedData = await response.json();

        // Validate Data: checar se tem data e se contém partes reais de reunião
        const hasParts = (parsedData?.treasures?.length > 0) || (parsedData?.ministry?.length > 0) || (parsedData?.living?.length > 0);
        if (!parsedData || !parsedData.weekDate || !hasParts) {
          console.warn(`Dados sem partes de reunião em ${file.name}`, parsedData);
          setToastData({ message: `Aviso: ${file.name} não contém partes de reunião (ex: capa/sumário). Ignorado.`, type: 'error' });
          continue;
        }

        newSchedules.push(parsedData);

        const autoDateSQL = parsedData.meetingDate;
        if (files.length === 1 && pendingMeeting && pendingMeeting.reuniao_id !== parsedData.reuniao_id) {
          throw new Error('O arquivo pertence a outra semana. Selecione a reunião correspondente antes de importar.');
        }
        newDates.push(autoDateSQL);
        newMeetingIds.push(parsedData.reuniao_id);

        const yearStr = /\b\d{4}\b/.test(parsedData.weekDate) ? '' : ` ${year || new Date().getFullYear()}`;
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
          } catch (e) { console.error("Erro ao recuperar designações:", e); }
        }
        newAssignments.push(retrievedAssignments);
      }

      if (newSchedules.length === 0) {
        throw new Error("Nenhuma programação válida encontrada.");
      }

      setSchedules(newSchedules);
      setAssignmentsList(newAssignments);
      setWeekDescriptions(newDescriptions);
      setMeetingDates(newDates);
      setMeetingIds(newMeetingIds);
      setPendingMeeting(null);
      setCurrentIndex(0);

      // Setup Queue for Sequential Opening
      if (newSchedules.length > 1) {
        // Add indices 1..N to queue
        const queueIndices = newSchedules.map((_, i) => i).slice(1);
        setImportQueue(queueIndices);
      } else {
        setImportQueue([]);
      }

      // Always open modal on import (if data exists)
      if (newSchedules.length > 0) {
        setIsMobileModalOpen(true);
      }

    } catch (err) {
      console.error(err);
      setError(`Falha: ${err.message}`);
      setToastData({ message: `Erro: ${err.message}`, type: 'error' });
    } finally {
      setIsParsing(false);
    }
  };

  const handleAssignmentChange = (partId, name) => {
    setAssignmentsList(prevList => {
      const newList = [...prevList];
      const currentAssignments = { ...newList[currentIndex] };

      if (typeof partId === 'object' && partId !== null) {
        // Bulk Update
        Object.assign(currentAssignments, partId);

        // Special logic for President in bulk update if present
        if (partId.presidente) {
          currentAssignments['comentarios_iniciais'] = partId.presidente;
          currentAssignments['comentarios_finais'] = partId.presidente;
          currentAssignments['cantico_meio'] = partId.presidente;
        }
      } else {
        // Single Update
        currentAssignments[partId] = name;

        if (partId === 'presidente') {
          currentAssignments['comentarios_iniciais'] = name;
          currentAssignments['comentarios_finais'] = name;
          currentAssignments['cantico_meio'] = name;
        }
      }

      newList[currentIndex] = currentAssignments;
      return newList;
    });
  };

  const handleDescriptionChange = (newText) => {
    setWeekDescriptions(prev => { const next = [...prev]; next[currentIndex] = newText; return next; });
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
      const response = await fetch('/api/admin/salvar-designacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleData: { ...currentSchedule, weekDate: currentDescription },
          assignments: currentAssignments,
          meetingDate: currentDateSQL,
          reuniao_id: meetingIds[currentIndex]
        })
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Erro ao salvar designações.');
      }
      setToastData({ message: 'Salvo com sucesso!', type: 'success' });
      refreshSavedMeetings();
    } catch (err) {
      setToastData({ message: err.message, type: 'error' });
    } finally { setIsSaving(false); }
  };

  const handleGeneratePDF = (indexOverride) => {
    const targetIdx = typeof indexOverride === 'number' ? indexOverride : currentIndex;
    const doc = new jsPDF('p', 'mm', 'a4');
    const schedule = schedules[targetIdx];
    const assignments = assignmentsList[targetIdx];
    const weekText = weekDescriptions[targetIdx];

    if (!schedule || !assignments) return;

    // --- CONFIGURAÇÕES GERAIS ---
    const margin = 5;
    const pageWidth = 210;
    const contentWidth = pageWidth - (margin * 2);
    let currentY = margin;

    // Cores
    const colors = {
      blue: [23, 58, 110],
      orange: [160, 80, 0],   // Amber-700 approx
      red: [150, 0, 0],
      black: [0, 0, 0],
      gray: [100, 100, 100],
      cyan: [0, 150, 150]
    };

    const borderColor = [0, 0, 0];
    const headerBgFn = () => doc.setFillColor(240, 240, 240);
    const timeBgFn = () => doc.setFillColor(230, 230, 230);
    const sectionBgFn = (c) => () => doc.setFillColor(...c); // Header section
    const highlightBgFn = () => doc.setFillColor(230, 230, 230); // Destaque Presidente

    // --- HELPERS DE TEXTO RICO ---

    // 1. Parsing: Transforma string crua em array de pedaços com estilo
    const parseRichText = (text, type) => {
      const parts = [];
      if (!text) return parts;
      const normalized = text.replace(/(\d+)\s*MIN/g, '$1 min').replace(/(\d+)\s*Min/g, '$1 min');

      if (type === 'treasures') {
        const match = normalized.match(/^(.*?)(\(\d+\s*min\))(.*)$/i);
        if (match) {
          // Título (com ou sem numero)
          let title = match[1];
          const numMatch = title.match(/^(\d+\.)\s*(.*)$/);
          if (numMatch) {
            parts.push({ text: numMatch[1] + " ", color: colors.blue, font: "bold" });
            parts.push({ text: numMatch[2], color: colors.blue, font: "bold" });
          } else {
            parts.push({ text: title, color: colors.blue, font: "bold" });
          }
          // Tempo
          parts.push({ text: " " + match[2], color: colors.black, font: "bold" }); // Negrito para tempo
          // Resto
          if (match[3]) parts.push({ text: match[3], color: colors.black, font: "bold" });
        } else {
          parts.push({ text: normalized, color: colors.blue, font: "bold" });
        }

      } else if (type === 'ministry') {
        const match = normalized.match(/^(.*?)(\(\d+\s*min\))(:?)\s*(.*)$/i);
        if (match) {
          parts.push({ text: match[1].toUpperCase(), color: colors.orange, font: "bold" }); // Título
          parts.push({ text: " " + match[2] + match[3], color: colors.black, font: "bold" }); // Tempo

          // Source parsing para parenteses em outra cor
          const source = match[4];
          const sourceParts = source.split(/(\([^)]+\))/g);
          sourceParts.forEach(sp => {
            if (sp.startsWith('(') && sp.endsWith(')')) {
              // Se for (...min) ignora cor diferente, senão cyan
              if (sp.includes('min')) parts.push({ text: " " + sp, color: colors.black, font: "bold" });
              else parts.push({ text: " " + sp, color: colors.cyan, font: "normal" });
            } else if (sp.trim()) {
              parts.push({ text: " " + sp, color: colors.black, font: "bold" });
            }
          });
        } else {
          parts.push({ text: normalized.toUpperCase(), color: colors.orange, font: "bold" });
        }

      } else if (type === 'living') {
        if (normalized.toLowerCase().includes('cântico')) {
          parts.push({ text: normalized, color: colors.blue, font: "bold" });
          return parts;
        }
        const match = normalized.match(/^(.*?)(\(\d+\s*min\))(:?)\s*(.*)$/i);
        if (match) {
          parts.push({ text: match[1], color: colors.red, font: "bold" });
          parts.push({ text: " " + match[2] + match[3], color: colors.black, font: "bold" });
          // Source
          if (match[4]) parts.push({ text: " " + match[4], color: colors.black, font: "bold" });
        } else {
          parts.push({ text: normalized, color: colors.red, font: "bold" });
        }
      } else {
        // Default / Normal
        parts.push({ text: normalized, color: colors.black, font: "normal" });
      }
      return parts;
    };

    // 2. Measure & Render: Calcula quebras de linha e desenha
    const measureAndRender = (richParts, x, y, maxWidth, lineHeight = 5, dryRun = false) => {
      doc.setFontSize(10); // Base size
      let cursorX = 0;
      let cursorY = 0; // Relative Y
      let maxLineWidth = 0;

      // Simulação de linhas
      let lines = [];
      let currentLine = [];
      let currentLineWidth = 0;

      // Flatten words
      const words = [];
      richParts.forEach(part => {
        doc.setFont("helvetica", part.font || "normal");
        const partWords = part.text.split(/(\s+)/); // Keep spaces
        const { text: fullText, ...style } = part; // Separa o texto full do estilo

        partWords.forEach(w => {
          if (!w) return;
          const wWidth = doc.getTextWidth(w);
          words.push({ text: w, width: wWidth, ...style });
        });
      });

      // Word Wrap
      words.forEach(word => {
        if (currentLineWidth + word.width > maxWidth && currentLineWidth > 0 && word.text.trim()) {
          lines.push(currentLine);
          currentLine = [];
          currentLineWidth = 0;
          // Se word for espaço no inicio da linha nova, ignorar (opcional, mas simples aqui)
          if (!word.text.trim()) return;
        }
        currentLine.push(word);
        currentLineWidth += word.width;
      });
      if (currentLine.length > 0) lines.push(currentLine);

      const totalHeight = lines.length * lineHeight;

      // Render
      if (!dryRun) {
        // Centralizar verticalmente: calcular startY baseado na altura total do bloco e na altura da célula
        // mas esta função espera que o chamador passe o Y correto para começar a desenhar as linhas
        // Vamos desenhar linha a linha a partir de y

        lines.forEach((line, i) => {
          let lineX = x; // Align Left always for parts
          const lineY = y + (i * lineHeight) + (lineHeight * 0.7); // Baseline approx

          line.forEach(word => {
            doc.setFont("helvetica", word.font || "normal");
            doc.setTextColor(...(word.color || colors.black));
            doc.text(word.text, lineX, lineY);
            lineX += word.width;
          });
        });
      }

      return totalHeight;
    };

    // --- DRAWING PRIMITIVES ---

    const drawRect = (x, y, w, h, fillFn = null, strokeColor = borderColor) => {
      if (fillFn) { fillFn(); doc.rect(x, y, w, h, 'F'); }
      doc.setDrawColor(...strokeColor); doc.setLineWidth(0.3);
      doc.rect(x, y, w, h, 'S');
    };

    const drawTextCentered = (text, x, y, w, h, fontSize = 11, fontStyle = 'normal', color = colors.black) => {
      doc.setFontSize(fontSize); doc.setFont("helvetica", fontStyle); doc.setTextColor(...color);
      const textW = doc.getTextWidth(text);

      // Wrap se precisar (nomes grandes)
      if (textW > w - 2) {
        const lines = doc.splitTextToSize(text, w - 2);
        const blockH = lines.length * 5;
        const startY = y + (h - blockH) / 2 + 3.5;
        doc.text(lines, x + w / 2, startY, { align: 'center' });
      } else {
        doc.text(text, x + w / 2, y + h / 2 + 1.5, { align: 'center', baseline: 'middle' });
      }
    };

    const getName = (fullName) => {
      if (!fullName) return "";
      const pub = publicadores.find(p => p.nome_completo === fullName);
      return pub ? pub.nome_curto : getShortName(fullName);
    };

    // --- CONSTRUÇÃO ---

    // 1. Title Header
    const headerH = 40; // Mais alto
    const colNameW = 75; // Largura da coluna de nomes
    const infoW = colNameW; // Alinhado com a coluna de nomes
    const infoX = margin + contentWidth - infoW; // Posição X exata do final

    // Fix Overlap: Main Title box takes remaining width
    const titleBoxW = contentWidth - infoW;

    drawRect(margin, currentY, titleBoxW, headerH, headerBgFn);

    doc.setFontSize(15); doc.setTextColor(...colors.blue); doc.setFont("helvetica", "bold");
    doc.text(weekText || "", margin + (titleBoxW / 2), currentY + 14, { align: "center" });

    doc.setFontSize(19); doc.setTextColor(...colors.black);
    doc.text("NOSSA VIDA E MINISTÉRIO CRISTÃO", margin + (titleBoxW / 2), currentY + 28, { align: "center" });

    const infoTitleH = 10;
    const infoRowH = (headerH - infoTitleH) / 2;

    drawRect(infoX, currentY, infoW, infoTitleH, headerBgFn);
    drawTextCentered("Salão Principal", infoX, currentY, infoW, infoTitleH, 11, "bold");

    drawRect(infoX, currentY + infoTitleH, infoW, infoRowH); // Pres
    doc.setFontSize(10); doc.setTextColor(...colors.black); doc.text("Presidente:", infoX + 2, currentY + infoTitleH + infoRowH / 2 + 1.5);
    drawTextCentered(getName(assignments.presidente), infoX + 22, currentY + infoTitleH, infoW - 22, infoRowH, 12, "normal");

    drawRect(infoX, currentY + infoTitleH + infoRowH, infoW, infoRowH); // Ajudante
    doc.setFontSize(10); doc.setTextColor(...colors.black); doc.text("Ajudante:", infoX + 2, currentY + infoTitleH + infoRowH + infoRowH / 2 + 1.5);
    drawTextCentered(getName(assignments.ajudante), infoX + 22, currentY + infoTitleH + infoRowH, infoW - 22, infoRowH, 12, "normal");

    currentY += headerH;

    // --- TABELA ---
    const colTimeW = 16;
    // colNameW já definido acima como 75
    const colPartW = contentWidth - colTimeW - colNameW;

    // Contagem de linhas para cálculo dinâmico de altura (preencher toda a folha A4)
    let totalRowsCount = 2; // Cântico inicial + Comentários iniciais
    totalRowsCount += (schedule.treasures?.length || 0);
    if (assignments.leitura_biblia && !schedule.treasures?.some(t => t.title?.toLowerCase().includes('leitura'))) {
      totalRowsCount += 1;
    }
    totalRowsCount += (schedule.ministry?.length || 0);
    totalRowsCount += 1; // Cântico do meio
    totalRowsCount += (schedule.living?.length || 0);
    totalRowsCount += 2; // Comentários finais + Cântico final

    const pageHeight = 297;
    const topMargin = 6;
    const bottomMargin = 6;
    const usableHeight = pageHeight - topMargin - bottomMargin; // 285mm
    const sectionHeadersTotalH = 3 * 9; // 3 seções * 9mm = 27mm
    const availableForRows = usableHeight - headerH - sectionHeadersTotalH; // ~218mm
    const dynamicMinH = Math.max(12, Math.min(18.5, Math.floor((availableForRows / Math.max(1, totalRowsCount)) * 10) / 10));

    const drawRow = (time, richParts, nameVal, type, secondaryLabel = null) => {
      // Handle "Oração --->" right alignment special case
      let oracaoLabel = "";
      let finalRichParts = richParts;
      if (Array.isArray(richParts)) {
        finalRichParts = JSON.parse(JSON.stringify(richParts));
        const oraIdx = finalRichParts.findIndex(p => p.text.includes("Oração --->"));
        if (oraIdx !== -1) {
          oracaoLabel = "Oração --->";
          finalRichParts[oraIdx].text = finalRichParts[oraIdx].text.replace("Oração --->", "").trim();
        }
      }

      // Calculate Height
      let textH = 0;
      if (type !== 'header') {
        textH = measureAndRender(finalRichParts, 0, 0, colPartW - 4, 6, true); // lineHeight 6
      }

      let h = Math.max(dynamicMinH, textH + 6);

      // Header Row
      if (type === 'header') {
        drawRect(margin, currentY, contentWidth, 9, sectionBgFn(richParts.color), richParts.color);
        doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text(richParts.text, margin + contentWidth / 2, currentY + 6, { align: "center" });
        currentY += 9;
        return;
      }

      // Normal Row
      // Column 1: Time
      drawRect(margin, currentY, colTimeW, h, timeBgFn);
      doc.setFontSize(10); doc.setTextColor(...colors.black); doc.setFont("helvetica", "bold");
      if (time) doc.text(time, margin + colTimeW / 2, currentY + h / 2 + 1, { align: "center", baseline: "middle" });

      // Column 2: Part (Rich Text)
      drawRect(margin + colTimeW, currentY, colPartW, h);
      const textYStart = currentY + (h - textH) / 2 - 2;
      measureAndRender(finalRichParts, margin + colTimeW + 2, textYStart, colPartW - 4, 6, false);

      // Draw Oração label
      if (oracaoLabel) {
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...colors.black);
        doc.text(oracaoLabel, margin + colTimeW + colPartW - 2, currentY + h / 2 + 1, { align: "right", baseline: "middle" });
      }

      // Column 3: Name
      const colNameX = margin + colTimeW + colPartW;

      if (Array.isArray(nameVal)) { // Split Cell
        const halfH = h / 2;
        const isPres0 = (assignments.presidente && nameVal[0] === assignments.presidente);
        const isPres1 = (assignments.presidente && nameVal[1] === assignments.presidente);

        // Custom Fills
        if (isPres0) { highlightBgFn(); doc.rect(colNameX, currentY, colNameW, halfH, 'F'); }
        if (isPres1) { highlightBgFn(); doc.rect(colNameX, currentY + halfH, colNameW, halfH, 'F'); }

        // Draw Outer Outline
        drawRect(colNameX, currentY, colNameW, h);

        // Top Name (Standard)
        drawTextCentered(getName(nameVal[0]) || "---", colNameX, currentY, colNameW, halfH, 12);

        // Bottom Name (Styled)
        const bottomName = getName(nameVal[1]) || "---";
        const centerY = currentY + halfH + (halfH / 2); // Vertically centered in bottom half

        if (secondaryLabel) {

          // 1. Configs (New)
          const finalLabel = secondaryLabel.toLowerCase() === 'ajudante' ? 'Ajud.' : secondaryLabel;
          const labelStr = finalLabel;
          const nameStr = bottomName;

          // 2. Measure
          doc.setFontSize(9); doc.setFont("helvetica", "normal");
          const labelW = doc.getTextWidth(labelStr);

          doc.setFontSize(12); doc.setFont("helvetica", "normal");
          const nameW = doc.getTextWidth(nameStr);

          // Spacing
          const arrowW = 5.5; // Wider for new icon
          const gapArrowLabel = 3;
          const gapLabelName = 2;
          const totalW = arrowW + gapArrowLabel + labelW + gapLabelName + nameW;

          // 3. Start X (Centered Group)
          let currentX = colNameX + (colNameW - totalW) / 2;

          // 4. Draw Arrow (Down-Right "Enter" style ↳)
          const iconLeft = currentX + 0.5;

          doc.setDrawColor(100, 100, 100); // Gray
          doc.setFillColor(100, 100, 100); // Gray Fill
          doc.setLineWidth(0.6); // Medium thick

          // Coords
          const kneeX = iconLeft + 1;
          const kneeY = centerY + 1.2;
          const topY = centerY - 2;
          const shaftEndX = kneeX + 2.5;

          // L-Shape Shaft (Continuous line for clean corner)
          doc.lines([[0, kneeY - topY], [shaftEndX - kneeX, 0]], kneeX, topY);

          // Solid Arrowhead (Filled Triangle)
          const tipX = shaftEndX + 1.2;
          const headW = 0.9;
          doc.triangle(
            shaftEndX, kneeY - headW, // Top Base
            shaftEndX, kneeY + headW, // Bottom Base
            tipX, kneeY,             // Tip
            'F'                      // Fill
          );

          currentX += arrowW + gapArrowLabel;

          // 5. Draw Label
          doc.setTextColor(115, 115, 115); // Distinct Gray
          doc.setFontSize(9); doc.setFont("helvetica", "normal");
          doc.text(labelStr, currentX, centerY, { baseline: 'middle' });
          currentX += labelW + gapLabelName;

          // 6. Draw Name
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(12); doc.setFont("helvetica", "normal");
          doc.text(nameStr, currentX, centerY, { baseline: 'middle' });

        } else {
          drawTextCentered(bottomName, colNameX, currentY + halfH, colNameW, halfH, 12);
        }

      } else {
        const isPres = (assignments.presidente && nameVal === assignments.presidente);
        drawRect(colNameX, currentY, colNameW, h, isPres ? highlightBgFn : null);
        drawTextCentered(getName(nameVal) || "", colNameX, currentY, colNameW, h, 12);
      }

      currentY += h;
    };

    // --- TIME CALCULATION HELPERS ---
    let currentMinutes = 19 * 60 + 30; // Início 19:30

    const formatTime = (minutes) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h}:${m.toString().padStart(2, '0')}`;
    };

    const getDuration = (text) => {
      if (!text) return 0;
      const match = text.match(/\((\d+)\s*min\)/i);
      if (match) return parseInt(match[1], 10);
      return 0;
    };

    // 1. Initial
    const initParts = parseRichText(`${schedule.initialSong}    Oração --->`, 'normal');
    if (initParts[0]) initParts[0] = { ...initParts[0], color: colors.blue, font: "bold" };
    drawRow(formatTime(currentMinutes), initParts, assignments.oracao_inicial);
    currentMinutes += 5; // Cântico + Oração (5 min)

    // Comentários Iniciais
    const commentsText = schedule.openingComments || 'Comentários Iniciais (1 min)';
    const commentsDuration = getDuration(commentsText) || 1;
    drawRow(formatTime(currentMinutes), parseRichText(commentsText, 'normal'), assignments.comentarios_iniciais);
    currentMinutes += commentsDuration;

    // 2. Treasures
    drawRow('', { text: 'TESOUROS DA PALAVRA DE DEUS', color: colors.blue }, '', 'header');
    schedule.treasures?.forEach((part, idx) => {
      drawRow(formatTime(currentMinutes), parseRichText(truncatePartTitle(part.title), 'treasures'), assignments[`tesouro_${idx}`]);
      currentMinutes += getDuration(part.title) + 1; // +1 min transition
    });

    if (assignments.leitura_biblia) {
      const bibleText = 'Leitura da Bíblia (4 min)';
      drawRow(formatTime(currentMinutes), parseRichText(bibleText, 'treasures'), assignments.leitura_biblia);
      currentMinutes += getDuration(bibleText) + 1; // +1 min transition
    }

    // 3. Ministry
    drawRow('', { text: 'FAÇA SEU MELHOR NO MINISTÉRIO', color: colors.orange }, '', 'header');
    schedule.ministry?.forEach((part, idx) => {
      const parts = parseRichText(truncatePartTitle(part.title), 'ministry');
      const isDiscurso = part.title.toLowerCase().includes('discurso');

      let assignVal;
      let label = null;
      if (isDiscurso) {
        assignVal = assignments[`ministerio_${idx}`] || assignments[`ministerio_${idx}_1`];
      } else {
        const s = assignments[`ministerio_${idx}_1`] || assignments[`ministerio_${idx}`];
        const a = assignments[`ministerio_${idx}_2`];
        assignVal = [s, a];
        label = "Ajudante";
      }

      drawRow(formatTime(currentMinutes), parts, assignVal, null, label);
      currentMinutes += getDuration(part.title) + 1; // +1 min transition
    });

    // 4. Living
    drawRow('', { text: 'NOSSA VIDA CRISTÃ', color: colors.red }, '', 'header');

    // Middle Song (Now 3 min)
    drawRow(formatTime(currentMinutes), parseRichText(schedule.middleSong || "Cântico do Meio", 'living'), assignments.cantico_meio);
    currentMinutes += 3;

    schedule.living?.forEach((part, idx) => {
      const parts = parseRichText(truncatePartTitle(part.title), 'living');
      const isBibleStudy = part.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes('estudo biblico');

      let assignVal;
      let label = null;
      if (isBibleStudy) {
        const s = assignments[`vida_${idx}_1`] || assignments[`vida_${idx}`];
        const a = assignments[`vida_${idx}_2`];
        assignVal = [s, a];
        label = "Leitor";
      } else {
        assignVal = assignments[`vida_${idx}`] || assignments[`vida_${idx}_1`];
      }

      drawRow(formatTime(currentMinutes), parts, assignVal, null, label);
      currentMinutes += getDuration(part.title);
    });

    // Finish
    const finalCommentsText = schedule.finalComments || 'Comentários Finais (3 min)';
    const finalCommentsDuration = getDuration(finalCommentsText) || 3;
    drawRow(formatTime(currentMinutes), parseRichText(finalCommentsText, 'normal'), assignments.comentarios_finais);
    currentMinutes += finalCommentsDuration;

    const finalParts = parseRichText(`${schedule.finalSong}    Oração --->`, 'normal');
    if (finalParts[0]) finalParts[0] = { ...finalParts[0], color: colors.blue, font: "bold" };
    drawRow(formatTime(currentMinutes), finalParts, assignments.oracao_final);

    doc.save(`Designacoes_${weekText}.pdf`);
  };

  const handleOpenEmailModal = () => {
    if (!canEmail) {
      setToastData({ message: 'Você não tem permissão para enviar e-mails.', type: 'error' });
      return;
    }
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

  const handleShareWhatsApp = (scheduleOverride, assignmentsOverride, descriptionOverride) => {
    let currentSchedule = scheduleOverride;
    let currentAssignments = assignmentsOverride;
    let currentDescription = descriptionOverride;

    if (typeof scheduleOverride === 'number') {
      const idx = scheduleOverride;
      currentSchedule = schedules[idx];
      currentAssignments = assignmentsList[idx];
      currentDescription = weekDescriptions[idx];
    } else if (!currentSchedule || typeof currentSchedule !== 'object' || !currentSchedule.initialSong) {
      currentSchedule = schedules[currentIndex];
      currentAssignments = assignmentsList[currentIndex];
      currentDescription = weekDescriptions[currentIndex];
    }

    if (!currentSchedule || !currentAssignments) {
      setToastData({ message: 'Nenhuma designação disponível para compartilhar.', type: 'error' });
      return;
    }
    const text = generateWhatsAppText(currentDescription, currentSchedule, currentAssignments, publicadores);
    // Clipboard avoids emoji corruption by an external link/protocol handler.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(decodeURIComponent(text)).then(() => {
        setToastData({ message: 'Mensagem copiada. Você também pode colá-la no WhatsApp.', type: 'success' });
      }).catch(() => {});
    }
    window.open(lifeMinistryWhatsAppUrl(decodeURIComponent(text)), '_blank', 'noopener,noreferrer');
  };

  const handlePrintAll = () => { window.print(); };

  if (isLoading) return (
    <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-purple-600" /></div>
  );
  const hasData = schedules.length > 0;

  // --- HANDLERS (UPDATED) ---

  // ensure modal opens on file load
  // (In handleFilesParse -> handleFileChange)
  // I need to locate handleFileChange. It wasn't fully shown in the last view tools but it was around line 324.

  // Let's replace the whole JSX first.

  // --- HANDLERS (UPDATED) ---
  const handleSchedulePartUpdate = (section, partIndex, newTitle) => {
    setSchedules(prev => {
      const newSchedules = [...prev];
      const currentSchedule = { ...newSchedules[currentIndex] };

      if (section in currentSchedule) {
        if (typeof partIndex === 'number') {
          const newSection = [...currentSchedule[section]];
          if (newSection[partIndex]) {
            newSection[partIndex] = { ...newSection[partIndex], title: newTitle };
            currentSchedule[section] = newSection;
          }
        } else {
          currentSchedule[section] = newTitle;
        }
        newSchedules[currentIndex] = currentSchedule;
      }
      return newSchedules;
    });
  };

  const handleCloseMobileModal = () => {
    if (importQueue.length > 0) {
      // Open next in queue
      const nextIndex = importQueue[0];
      setImportQueue(prev => prev.slice(1));
      setCurrentIndex(nextIndex);
      setIsMobileModalOpen(true); // Keep open, just switch data
    } else {
      setIsMobileModalOpen(false);
    }
  };

  return (
    <div className="w-full min-w-0">
      <StatusToast message={toastData.message} type={toastData.type} onClose={() => setToastData({ message: '', type: '' })} />
      {error && <p role="alert" className="mb-4 bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm">{error}
        {programSessionRequired && <Link href="/" prefetch={false} className="block mt-2 font-semibold underline">Entrar novamente</Link>}
      </p>}
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
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveEmail(email);
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors pointer-events-auto"
                        aria-label={`Remover ${email}`}
                      >
                        <X size={14} />
                      </button>
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

      {/* MODAL DE EDIÇÃO (ÚNIO) */}
      <MobileDesignationModal
        isOpen={isMobileModalOpen}
        onClose={handleCloseMobileModal}
        schedule={schedules[currentIndex]}
        assignments={assignmentsList[currentIndex]}
        weekDescription={weekDescriptions[currentIndex]}
        publicadores={publicadores}
        historyData={historyData}
        onAssignmentChange={handleAssignmentChange}
        onSave={handleSaveCurrent}
        isSaving={isSaving}
        onPrint={handleGeneratePDF}
        onScheduleUpdate={handleSchedulePartUpdate}
        onOpenEmail={handleOpenEmailModal}
        onShareWhatsApp={handleShareWhatsApp}
      />

      <div className="flex flex-col gap-4">

        {/* CABEÇALHO + IMPORTAR */}
        <div className={designationToolbarClass}>
          <div className="flex-1 min-w-0 basis-64">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Programação Vida e Ministério
            </h2>
            <p className="text-gray-500 text-sm mt-1">Abra uma reunião para preencher as designações.</p>
          </div>

          <label role="button" tabIndex={isParsing || !canImport ? -1 : 0} aria-disabled={isParsing || !canImport}
            onKeyDown={event => {
              if ((event.key === 'Enter' || event.key === ' ') && !isParsing && canImport) {
                event.preventDefault(); event.currentTarget.querySelector('input').click();
              }
            }}
            className={`${designationActionClass} text-white ${isParsing || !canImport ? 'bg-purple-400 cursor-not-allowed opacity-70' : 'bg-purple-600 hover:bg-purple-700 cursor-pointer'}`}>
            {isParsing ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <UploadCloud size={16} className="shrink-0" />}
            {isParsing ? 'Importando…' : 'Importar RTF'}
            <input type="file" multiple accept=".rtf, .txt" className="hidden" onChange={handleFilesParse} disabled={isParsing || !canImport} />
          </label>
        </div>

        {pendingMeeting && <div role="status" className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-purple-900">
          <p className="font-semibold">{pendingMeeting.dataFormatada} — Programação pendente</p>
          <p className="text-sm mt-1">Busque a programação no jw.org ou importe o RTF da semana usando o botão acima.</p>
          <Button className="mt-3 bg-purple-600 text-white" disabled={isParsing || !canImport} onClick={handleFetchProgram}>
            {isParsing ? <Loader2 className="animate-spin mr-2" size={16} /> : <RefreshCw className="mr-2" size={16} />}Buscar programação no jw.org
          </Button>
        </div>}

        {/* HISTÓRICO DE REUNIÕES */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          <div className={designationListHeaderClass}>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <History size={20} className="text-gray-500" />
              Histórico de Reuniões
            </h2>

            <DesignationPeriodFilters years={savedMeetingsList.map(m => m.dataSQL.slice(0, 4))} />
          </div>

          <div className="flex-1 overflow-auto">
            {sidebarItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <History size={48} className="mb-4 opacity-20" />
                <p>Nenhuma reunião encontrada no histórico.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sidebarItems.map((item) => {
                  const idx = meetingDates.findIndex((date, index) => date === item.date && schedules[index]);
                  const schedule = idx >= 0 ? schedules[idx] : null;
                  const assignments = idx >= 0 ? assignmentsList[idx] || {} : {};
                  const stats = schedule ? getWeekCompletionStats(schedule, assignments) : null;
                  const readingIndex = schedule?.treasures?.findIndex(part =>
                    part.title?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('leitura da biblia')) ?? -1;
                  const bibleReader = readingIndex >= 0 ? assignments[`tesouro_${readingIndex}`] : '';
                  return (
                  <div
                    key={item.id}
                    className="hover:bg-purple-50 flex flex-col sm:flex-row sm:items-center group transition-colors"
                  >
                    <button type="button" disabled={isParsing || item.meeting.cancelado}
                      onClick={() => handleLoadSavedMeeting(item.meeting)}
                      aria-label={`Abrir / Editar ${item.label}`}
                      className="px-4 py-3 flex-1 min-w-0 flex items-center gap-4 text-left disabled:cursor-default focus-visible:outline-purple-600">
                      <div className="w-10 h-10 shrink-0 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">
                        {item.date?.split('-')[2]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 group-hover:text-purple-700">{item.label}</h3>
                        <p className="text-xs text-gray-500">{formatFullDateBR(item.date)}</p>
                        <p className={`text-xs mt-1 ${item.meeting.cancelado ? 'text-red-600' : 'text-purple-600'}`}>
                          {item.meeting.cancelado || !stats ? item.subLabel : `${stats.filled} de ${stats.total} partes preenchidas · ${stats.percentage}%`}
                        </p>
                        {stats && !item.meeting.cancelado && <>
                          <div className="max-w-xs h-1.5 mt-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar"
                            aria-label="Preenchimento das designações" aria-valuenow={stats.percentage} aria-valuemin={0} aria-valuemax={100}>
                            <div className={`h-full ${stats.percentage === 100 ? 'bg-emerald-500' : 'bg-purple-600'}`} style={{ width: `${stats.percentage}%` }} />
                          </div>
                          <p className="text-xs mt-2 text-gray-500">Presidente: {assignments.presidente || 'Pendente'} · Leitor Bíblia: {bibleReader || 'Pendente'}</p>
                        </>}
                      </div>
                      <span className="text-gray-400 group-hover:text-purple-500 shrink-0">
                      <ChevronRight size={20} />
                      </span>
                    </button>
                    {schedule && !item.meeting.cancelado && <div className="flex gap-2 px-4 pb-4 sm:pb-0 sm:pl-0">
                      <button type="button" onClick={() => handleShareWhatsApp(idx)} title="Compartilhar no WhatsApp"
                        aria-label={`Compartilhar ${item.label} no WhatsApp`}
                        className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200">
                        <MessageCircle size={16} />
                      </button>
                      <button type="button" onClick={() => handleGeneratePDF(idx)} title="Gerar PDF"
                        aria-label={`Gerar PDF de ${item.label}`}
                        className="p-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200">
                        <FileText size={16} />
                      </button>
                    </div>}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      <div className="designacoes-print-wrapper printable-content">
        {schedules.map((schedule, idx) => (<div key={idx} className="print-page-break"><TabelaDesignacoes schedule={schedule} assignments={assignmentsList[idx]} weekText={weekDescriptions[idx]} publicadores={publicadores} isPrintView={true} /></div>))}
      </div>
    </div>
  );
}
