'use client';

import { useState, useEffect } from 'react';
import { Loader2, Printer, UploadCloud, ArrowLeft, Save, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import TabelaDesignacoes from '@/componentes/TabelaDesignacoes';

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
    const match = cleanStr.match(/(\d{1,2}).*?([A-ZÇ]+)(?:.*?(\d{4}))?/);
    if (!match) return '';
    const dia = parseInt(match[1], 10);
    const mesNome = match[2];
    const anoEncontrado = match[3] ? parseInt(match[3], 10) : null;
    const meses = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    const mesIndex = meses.findIndex(m => m.startsWith(mesNome) || mesNome.startsWith(m));
    if (mesIndex === -1) return '';
    let ano;
    if (anoEncontrado) { ano = anoEncontrado; } 
    else {
      const hoje = new Date();
      ano = hoje.getFullYear();
      if (hoje.getMonth() <= 1 && mesIndex >= 10) ano = ano - 1;
      else if (hoje.getMonth() >= 10 && mesIndex <= 1) ano = ano + 1;
    }
    const data = new Date(ano, mesIndex, dia);
    const yyyy = data.getFullYear();
    const mm = String(data.getMonth() + 1).padStart(2, '0');
    const dd = String(data.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch (e) { return ''; }
}

export default function DesignacoesPage() {
  const router = useRouter();
  const [publicadores, setPublicadores] = useState([]);
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

  useEffect(() => {
    async function fetchPublicadores() {
      try {
        const res = await fetch('/api/admin/get-publicadores');
        if (!res.ok) throw new Error('Falha ao buscar publicadores');
        const data = await res.json();
        const publicadoresComNomeCurto = data.map(p => ({
          ...p,
          nome_curto: p.nome_chamado ? p.nome_chamado : getShortName(p.nome_completo)
        }));
        setPublicadores(publicadoresComNomeCurto);
      } catch (err) { setError(err.message); } finally { setIsLoading(false); }
    }
    fetchPublicadores();
  }, []);

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, 'ISO-8859-1');
    });
  };

  const handleFilesParse = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    files.sort((a, b) => a.name.localeCompare(b.name));
    setIsParsing(true); setError(''); setSaveMessage({ text: '', isError: false });
    setSchedules([]); setAssignmentsList([]); setWeekDescriptions([]); setMeetingDates([]); setCurrentIndex(0);

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
        newAssignments.push({});
        const autoDateSQL = parseDateFromWeekString(parsedData.weekDate);
        newDates.push(autoDateSQL);
        let yearStr = '';
        if (autoDateSQL) yearStr = ` ${autoDateSQL.split('-')[0]}`;
        newDescriptions.push((parsedData.weekDate || 'Semana') + yearStr);
      }
      setSchedules(newSchedules);
      setAssignmentsList(newAssignments);
      setWeekDescriptions(newDescriptions);
      setMeetingDates(newDates);
    } catch (err) { setError(`Falha: ${err.message}`); } finally { setIsParsing(false); }
  };

  const handleAssignmentChange = (partId, name) => {
    setAssignmentsList(prevList => {
      const newList = [...prevList];
      newList[currentIndex] = { ...newList[currentIndex], [partId]: name };
      return newList;
    });
  };

  const handleDescriptionChange = (newText) => {
    setWeekDescriptions(prev => { const n = [...prev]; n[currentIndex] = newText; return n; });
    setMeetingDates(prev => { const n = [...prev]; n[currentIndex] = parseDateFromWeekString(newText); return n; });
  };

  const handleSaveCurrent = async () => {
    const currentSchedule = schedules[currentIndex];
    const currentAssignments = assignmentsList[currentIndex];
    const currentDescription = weekDescriptions[currentIndex];
    const currentDateSQL = meetingDates[currentIndex];
    if (!currentDateSQL) { setSaveMessage({ text: 'Data inválida.', isError: true }); return; }
    if (Object.keys(currentAssignments).length === 0) { setSaveMessage({ text: 'Preencha designações.', isError: true }); return; }
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
      setSaveMessage({ text: `Semana de ${currentDescription} salva!`, isError: false });
    } catch (err) { setSaveMessage({ text: err.message, isError: true }); } finally { setIsSaving(false); }
  };

  const handlePrintAll = () => { window.print(); };

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-neutral-900"><Loader2 className="animate-spin text-white" /></div>;
  const hasData = schedules.length > 0;

  return (
    <main className="min-h-screen w-full bg-neutral-900 text-neutral-100 p-4 md:p-8 print:bg-white print:p-0 print:text-black print:m-0">
      
      {/* CSS ESPECIAL PARA IMPRESSÃO CORRETA NESTA PÁGINA */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body { margin: 0; padding: 0; }
          body * { visibility: hidden; }
          
          .designacoes-print-wrapper, .designacoes-print-wrapper * {
            visibility: visible;
          }
          .designacoes-print-wrapper {
            position: absolute;
            top: 0; left: 0; width: 100%;
          }
          
          /* Classe para cada página de designação */
          .print-page-break {
            page-break-after: always;
            break-after: page;
            height: 100vh; /* Altura fixa para forçar ocupação total */
            width: 100%;
            display: block;
            padding: 5mm; /* Margem segura para a borda não cortar */
            box-sizing: border-box;
            overflow: hidden;
          }
          
          /* A mágica: remove a quebra de página APÓS o último elemento */
          .print-page-break:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>

      {/* === CONTROLES === */}
      <div className="no-print max-w-4xl mx-auto mb-6 bg-neutral-800 rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b border-neutral-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Gerador de Designações</h2>
            <div className="flex gap-2">
              {hasData && (
                <label htmlFor="rtf-upload-change" className="flex items-center gap-2 py-2 px-3 rounded-lg text-sm bg-blue-700 hover:bg-blue-600 cursor-pointer transition">
                  <UploadCloud size={16} /> Novos Arquivos
                  <input id="rtf-upload-change" type="file" multiple accept=".rtf, .txt" className="hidden" onChange={handleFilesParse} />
                </label>
              )}
              <button onClick={() => router.push('/admin/dashboard')} className="flex items-center gap-2 py-2 px-3 rounded-lg text-sm bg-neutral-700 hover:bg-neutral-600">
                <ArrowLeft size={16} /> Painel
              </button>
            </div>
          </div>

          {!hasData && (
            <>
              <label htmlFor="rtf-upload-multiple" className="cursor-pointer w-full p-6 border-2 border-dashed border-neutral-600 rounded-lg flex flex-col items-center justify-center text-center hover:bg-neutral-700 transition">
                <UploadCloud size={40} className="text-neutral-400 mb-2" />
                <span className="font-semibold">Carregar Arquivos RTF</span>
                <span className="text-xs text-neutral-400">Selecione múltiplos arquivos para gerar o mês inteiro</span>
              </label>
              <input id="rtf-upload-multiple" type="file" multiple accept=".rtf, .txt" className="hidden" onChange={handleFilesParse} />
            </>
          )}

          {isParsing && <div className="mt-4 text-center text-blue-300 flex justify-center gap-2"><Loader2 className="animate-spin" /> Processando...</div>}
          {error && <div className="mt-4 p-3 bg-red-900/30 text-red-300 rounded-md text-sm">{error}</div>}
        </div>

        {hasData && (
          <div className="p-4 bg-neutral-700/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => { setCurrentIndex(c => Math.max(0, c - 1)); setSaveMessage({text:'', isError:false}); }} disabled={currentIndex === 0} className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-600 disabled:opacity-30"><ChevronLeft size={20} /></button>
              <span className="font-mono font-bold text-lg">Semana {currentIndex + 1} de {schedules.length}</span>
              <button onClick={() => { setCurrentIndex(c => Math.min(schedules.length - 1, c + 1)); setSaveMessage({text:'', isError:false}); }} disabled={currentIndex === schedules.length - 1} className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-600 disabled:opacity-30"><ChevronRight size={20} /></button>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Calendar size={18} className="text-neutral-400" />
              <input type="text" value={weekDescriptions[currentIndex] || ''} onChange={(e) => handleDescriptionChange(e.target.value)} className="bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-sm text-white w-full md:w-64 text-center font-bold uppercase" />
            </div>
          </div>
        )}
        {saveMessage.text && <div className={`mx-6 mb-6 p-3 rounded-md text-sm ${saveMessage.isError ? 'bg-red-900/30 text-red-300' : 'bg-green-900/30 text-green-300'}`}>{saveMessage.text}</div>}
      </div>

      {/* === MODO TELA === */}
      {hasData && (
        <div className="print:hidden">
           <TabelaDesignacoes 
             schedule={schedules[currentIndex]}
             assignments={assignmentsList[currentIndex]}
             weekText={weekDescriptions[currentIndex]}
             publicadores={publicadores}
             onAssignmentChange={handleAssignmentChange}
           />
           <div className="max-w-4xl mx-auto mt-6 flex justify-center gap-4 pb-10">
             <button onClick={handleSaveCurrent} disabled={isSaving} className="flex items-center gap-2 py-3 px-6 rounded-lg font-bold text-white bg-green-600 hover:bg-green-500 disabled:opacity-50">
               {isSaving ? <Loader2 className="animate-spin" /> : <Save />} Salvar Semana Atual
             </button>
             <button onClick={handlePrintAll} className="flex items-center gap-2 py-3 px-6 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500">
               <Printer /> Imprimir Todas as Semanas
             </button>
           </div>
        </div>
      )}

      {/* === MODO IMPRESSÃO === */}
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
  );
}