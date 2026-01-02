'use client';

import { useState, useEffect, useMemo } from 'react';
import { jsPDF } from "jspdf";
import { Loader2, Printer, UploadCloud, Save, ChevronLeft, ChevronRight, Calendar, RefreshCw, History, FileText, X, Mail, MessageCircle, Plus, CheckCircle, AlertTriangle, Menu } from 'lucide-react';
import TabelaDesignacoes from '@/app/componentes/TabelaDesignacoes';
import { Button } from '@/app/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';
import { StatusToast } from '@/app/components/ui/status-toast';

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

import { HistorySidebar } from '@/app/components/designacoes/HistorySidebar';
import { MobileDesignationModal } from './MobileDesignationModal';

// ... (imports remain)

export function LifeMinistryTab() {
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

  // New Filter state for Sidebar
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState('');
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

  const refreshSavedMeetings = async () => {
    try {
      const res = await fetch('/api/admin/get-reunioes');
      if (res.ok) setSavedMeetingsList(await res.json());
    } catch (e) { console.error(e); }
  };

  // Filter Logic centralized
  const filteredMeetings = useMemo(() => {
    let lista = [...savedMeetingsList];
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
  }, [savedMeetingsList, month, year]);

  // Sidebar Items
  const sidebarItems = useMemo(() => {
    return filteredMeetings.map(m => ({
      id: m.dataSQL,
      date: m.dataSQL,
      label: m.descricao,
      subLabel: m.dataFormatada
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
      setAssignmentsList([reconstructedAssignments]);
      setCurrentIndex(0);

      if (window.innerWidth < 768) {
        setIsMobileModalOpen(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsParsing(false);
    }
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

    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Reset input
    event.target.value = '';

    files.sort((a, b) => a.name.localeCompare(b.name));

    setIsParsing(true); setError('');

    const newSchedules = [];
    const newAssignments = [];
    const newDescriptions = [];
    const newDates = [];

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
            body: JSON.stringify({ textContent }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) throw new Error(`Erro ao processar ${file.name}`);
        const parsedData = await response.json();

        // Validate Data
        if (!parsedData || !parsedData.weekDate) {
          console.warn(`Dados inválidos em ${file.name}`, parsedData);
          setToastData({ message: `Aviso: Dados inválidos em ${file.name}. Ignorado.`, type: 'error' });
          continue;
        }

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
      } catch (e) { console.error(e); }
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

  const handleGeneratePDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const schedule = schedules[currentIndex];
    const assignments = assignmentsList[currentIndex];
    const weekText = weekDescriptions[currentIndex];

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
    const minH = 12; // Altura mínima maior para encher a folha

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

      let h = Math.max(minH, textH + 5);

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
      drawRow(formatTime(currentMinutes), parseRichText(part.title, 'treasures'), assignments[`tesouro_${idx}`]);
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
      const parts = parseRichText(part.title, 'ministry');
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
      const parts = parseRichText(part.title, 'living');
      const isBibleStudy = part.title.toLowerCase().includes('estudo bíblico');

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

      if (currentSchedule[section]) {
        const newSection = [...currentSchedule[section]];
        if (newSection[partIndex]) {
          newSection[partIndex] = { ...newSection[partIndex], title: newTitle };
          currentSchedule[section] = newSection;
          newSchedules[currentIndex] = currentSchedule;
        }
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
    <div className="p-6 max-w-5xl mx-auto w-full">
      <StatusToast message={toastData.message} type={toastData.type} onClose={() => setToastData({ message: '', type: '' })} />

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

      {/* MODAL DE EDIÇÃO (ÚNIO) */}
      <MobileDesignationModal
        isOpen={isMobileModalOpen}
        onClose={handleCloseMobileModal}
        schedule={schedules[currentIndex]}
        assignments={assignmentsList[currentIndex]}
        weekDescription={weekDescriptions[currentIndex]}
        publicadores={publicadores}
        onAssignmentChange={handleAssignmentChange}
        onSave={handleSaveCurrent}
        isSaving={isSaving}
        onPrint={handleGeneratePDF}
        onScheduleUpdate={handleSchedulePartUpdate}
      />

      <div className="flex flex-col gap-8">

        {/* CABEÇALHO + IMPORTAR */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Designações</h1>
            <p className="text-gray-500 text-sm mt-1">Importe um ou vários arquivos RTF para começar ou selecione uma semana do histórico.</p>
          </div>

          <label className={`flex items-center gap-3 py-3 px-6 rounded-lg text-white transition font-bold shadow-md hover:shadow-lg transform active:translate-y-0 ${isParsing ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 hover:-translate-y-0.5 cursor-pointer'}`}>
            {isParsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud size={20} />}
            {isParsing ? 'IMPORTANDO...' : 'IMPORTAR PROGRAMAÇÃO (RTF)'}
            <input type="file" multiple accept=".rtf, .txt" className="hidden" onChange={handleFilesParse} disabled={isParsing} />
          </label>
        </div>

        {/* HISTÓRICO DE REUNIÕES */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-[500px]">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <History size={20} className="text-gray-500" />
              Histórico de Reuniões
            </h2>

            <div className="flex items-center gap-3">
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 outline-none text-gray-700"
              >
                <option value="">Todos os Meses</option>
                {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
              </select>

              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 outline-none text-gray-700"
              >
                <option value="">Todos os Anos</option>
                {/* Compute years from sidebarItems just for display options if needed, or static list */}
                {Array.from(new Set(sidebarItems.map(i => i.date?.split('-')[0]).filter(Boolean))).sort().reverse().map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {(month || year) && (
                <button onClick={() => { setMonth(''); setYear(''); }} className="text-sm text-red-600 hover:text-red-700 hover:underline px-2">
                  Limpar Filtros
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {sidebarItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <History size={48} className="mb-4 opacity-20" />
                <p>Nenhuma reunião encontrada no histórico.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sidebarItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      handleLoadSavedMeeting({ dataSQL: item.id, descricao: item.label });
                      setIsMobileModalOpen(true);
                    }}
                    className="p-4 hover:bg-purple-50 cursor-pointer flex items-center justify-between group transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">
                        {item.date?.split('-')[2]}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 group-hover:text-purple-700">{item.label}</h3>
                        <p className="text-xs text-gray-500 capitalize">{new Date(item.date).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long' })}</p>
                      </div>
                    </div>
                    <div className="text-gray-400 group-hover:text-purple-500">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                ))}
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
