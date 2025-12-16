'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Button } from '@/app/components/ui/button';
import { Loader2, Printer, FileSpreadsheet, Search, ArrowLeft, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import * as XLSX from 'xlsx';
import Link from 'next/link';

function getShortName(fullName, chamado) {
  if (chamado) return chamado;
  if (!fullName) return '';
  const parts = fullName.split(' ').filter(Boolean);
  if (parts.length === 1) return fullName;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

const DEFAULT_HEADER_COLOR = '#3b82f6';
const DEFAULT_TEXT_COLOR = '#ffffff';

export default function PrivilegiosMecanicosReport() {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState({ meetings: [], types: [], assignments: {} });
  
  // Filter State
  const getCurrentMonthFirstDay = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  const [startDate, setStartDate] = useState(getCurrentMonthFirstDay());
  const [endDate, setEndDate] = useState('');
  const [limit, setLimit] = useState(10);

  // Advanced Print Config
  const [configOpen, setConfigOpen] = useState(false);
  const [printConfig, setPrintConfig] = useState({
    fontSize: 'normal', 
    orientation: 'portrait',
    margins: 'normal',
    headerColor: DEFAULT_HEADER_COLOR,
    textColor: DEFAULT_TEXT_COLOR,
    congregationName: process.env.NEXT_PUBLIC_NOME_CONGREGACAO
   });

  useEffect(() => {
    generateReport();
  }, [limit]);

  const generateReport = async () => {
    setLoading(true);
    try {
      let url = `/api/admin/relatorios/privilegios-mecanicos?start=${startDate}&limit=${limit}`;
      if (endDate) url += `&end=${endDate}`;

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        // Backend returns: { meetings: [], types: [], assignments: {} }
        // If empty, it might return empty arrays.
        setReportData(json);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (reportData.meetings.length === 0) return;
    
    // Dynamic Columns based on Types
    const wsData = reportData.meetings.map(m => {
        const row = {
            Data: new Date(m.data).toLocaleDateString('pt-BR'),
            Dia: new Date(m.data).toLocaleDateString('pt-BR', { weekday: 'long' })
        };
        
        reportData.types.forEach(t => {
            const assign = reportData.assignments[m.id]?.[t.id];
            row[t.nome] = assign ? getShortName(assign.nome, assign.chamado) : '';
        });
        
        return row;
    });

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Privilégios");
    XLSX.writeFile(wb, `Privilegios_Mecanicos_${startDate}.xlsx`);
  };

  // Chunking for Print Layout
  const chunks = [];
  const chunkSize = 5; 
  for (let i = 0; i < reportData.meetings.length; i += chunkSize) {
    chunks.push(reportData.meetings.slice(i, i + chunkSize));
  }

  // Styles based on config
  const fontClass = {
      'normal': 'text-[11px] sm:text-xs',
      'small': 'text-[10px] sm:text-[11px]',
      'extra-small': 'text-[9px] sm:text-[10px]'
  }[printConfig.fontSize];

  const cellPadding = {
      'normal': 'p-1',
      'small': 'p-0.5',
      'extra-small': 'p-[1px]'
  }[printConfig.fontSize];

  const marginClass = {
      'small': '0.5cm',
      'normal': '1.5cm',
      'wide': '2.5cm'
  }[printConfig.margins];

  return (
    <DashboardLayout>
       <div className="max-w-6xl mx-auto space-y-8">
            {/* Header - Screen Only */}
            <div className="print:hidden space-y-6">
                
                {/* Title */}
                <div className="flex items-center gap-4">
                    <Link href="/admin/relatorios">
                        <Button variant="ghost" size="icon" className="shrink-0 text-gray-700 hover:text-gray-900 hover:bg-gray-100">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Privilégios Mecânicos</h1>
                        <p className="text-sm text-gray-600">Visualize e gere relatórios de atribuições</p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                    <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
                        <div className="w-full sm:w-auto">
                            <Label className="text-xs font-bold text-gray-900 mb-1.5 block">Data Inicial</Label>
                            <Input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)} 
                                className="w-full sm:w-40 bg-white text-gray-900 border-gray-300 font-medium" 
                            />
                        </div>
                        <div className="w-full sm:w-auto">
                            <Label className="text-xs font-bold text-gray-900 mb-1.5 block">Data Final (Opcional)</Label>
                            <Input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                                className="w-full sm:w-40 bg-white text-gray-900 border-gray-300 font-medium" 
                            />
                        </div>
                        <div className="w-20">
                            <Label className="text-xs font-bold text-gray-900 mb-1.5 block">Qtd.</Label>
                            <Input 
                                type="number" 
                                value={limit} 
                                onChange={e => setLimit(e.target.value)} 
                                className="w-full bg-white text-gray-900 border-gray-300 font-medium" 
                            />
                        </div>
                        <Button onClick={generateReport} className="mb-0.5 bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
                            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                        </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="gap-2 bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
                                    <Settings className="w-4 h-4" /> Configurar
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg bg-white sm:rounded-xl text-gray-900">
                                <DialogHeader>
                                    <DialogTitle className="text-gray-900 font-bold">Configurações de Impressão</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-5 py-4">
                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <Label className="text-gray-900 font-bold">Orientação</Label>
                                            <select 
                                                value={printConfig.orientation}
                                                onChange={(e) => setPrintConfig(prev => ({...prev, orientation: e.target.value}))}
                                                className="w-full p-2.5 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-medium"
                                            >
                                                <option value="portrait">Retrato (Vertical)</option>
                                                <option value="landscape">Paisagem (Horizontal)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-gray-900 font-bold">Margens</Label>
                                            <select 
                                                value={printConfig.margins}
                                                onChange={(e) => setPrintConfig(prev => ({...prev, margins: e.target.value}))}
                                                className="w-full p-2.5 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-medium"
                                            >
                                                <option value="small">Pequenas</option>
                                                <option value="normal">Normais</option>
                                                <option value="wide">Grandes</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-5">
                                         <div className="space-y-2">
                                            <Label className="text-gray-900 font-bold">Tamanho da Fonte</Label>
                                            <select 
                                                value={printConfig.fontSize}
                                                onChange={(e) => setPrintConfig(prev => ({...prev, fontSize: e.target.value}))}
                                                className="w-full p-2.5 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-medium"
                                            >
                                                <option value="normal">Normal</option>
                                                <option value="small">Compacta</option>
                                                <option value="extra-small">Super Compacta</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-gray-900 font-bold">Congregação</Label>
                                            <Input 
                                                value={printConfig.congregationName}
                                                onChange={(e) => setPrintConfig(prev => ({...prev, congregationName: e.target.value}))}
                                                className="bg-white text-gray-900 border-gray-300 font-medium"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <Label className="text-gray-900 font-bold">Cor do Cabeçalho</Label>
                                            <div className="flex items-center gap-3 p-1 border border-gray-200 rounded-md bg-gray-50">
                                                <Input 
                                                    type="color" 
                                                    value={printConfig.headerColor}
                                                    onChange={(e) => setPrintConfig(prev => ({...prev, headerColor: e.target.value}))}
                                                    className="w-10 h-8 p-0 border-0 cursor-pointer"
                                                />
                                                <span className="text-xs font-mono text-gray-900 font-bold">{printConfig.headerColor}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-gray-900 font-bold">Cor do Texto</Label>
                                            <div className="flex items-center gap-3 p-1 border border-gray-200 rounded-md bg-gray-50">
                                                <Input 
                                                    type="color" 
                                                    value={printConfig.textColor}
                                                    onChange={(e) => setPrintConfig(prev => ({...prev, textColor: e.target.value}))}
                                                    className="w-10 h-8 p-0 border-0 cursor-pointer"
                                                />
                                                <span className="text-xs font-mono text-gray-900 font-bold">{printConfig.textColor}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={() => setConfigOpen(false)} className="bg-gray-900 text-white hover:bg-gray-800 font-bold shadow-sm">Concluir</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <Button onClick={handleExport} variant="outline" className="gap-2 text-green-700 border-green-200">
                            <FileSpreadsheet className="w-4 h-4" /> Excel
                        </Button>
                        <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                            <Printer className="w-4 h-4" /> Imprimir
                        </Button>
                    </div>
                </div>
            </div>

            {/* Print Content */}
            <div id="print-area" className={`bg-white rounded-xl border border-gray-200 shadow-sm print:border-none print:shadow-none p-6 print:p-0 ${printConfig.orientation}`}>
                <div className="mb-4 p-2 rounded-lg print:rounded-none flex flex-col items-center justify-center gap-1 print-color-adjust-exact" style={{ backgroundColor: printConfig.headerColor, color: printConfig.textColor }}>
                    <div className="flex items-center gap-3">
                         <h1 className="text-xl font-bold uppercase tracking-wide">Privilégios Mecânicos</h1>
                    </div>
                    <p className="font-medium text-sm" style={{ opacity: 0.9 }}>Congregação {printConfig.congregationName}</p>
                </div>

                {!loading && reportData.meetings.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">Nenhum dado encontrado.</div>
                ) : (
                    <div className="space-y-4"> 
                        {chunks.map((chunk, idx) => (
                            <div key={idx} className="border border-black print:border-none bg-white print:break-inside-avoid overflow-x-auto">
                                <table className="w-full text-center border-collapse min-w-[600px] print:min-w-0">
                                    <thead>
                                        {/* Date Row 1 */}
                                        <tr className={`bg-white print:bg-white text-black font-bold border-b border-black print:border-none print-color-adjust-exact ${fontClass}`}>
                                            <th className={`border-r border-black print:border-2 ${cellPadding} min-w-[120px] bg-white uppercase text-blue-800 sticky left-0 print:static z-10 text-sm`}>Privilégio</th>
                                            {chunk.map(item => (
                                                <th key={item.id} className={`border-l border-black print:border-2 ${cellPadding} min-w-[100px]`}>
                                                    {new Date(item.data).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC'})}
                                                </th>
                                            ))}
                                            {Array.from({length: chunkSize - chunk.length}).map((_, i) => <th key={i} className={`border-l border-black print:border-2 ${cellPadding} min-w-[100px]`}></th>)}
                                        </tr>
                                        {/* Date Row 2 (Weekday) */}
                                        <tr className={`bg-white print:bg-white text-black font-semibold border-b border-black print:border-none text-[9px] sm:text-[10px]`}>
                                            <th className="border-r border-black print:border-2 bg-white sticky left-0 print:static z-10"></th>
                                            {chunk.map(item => (
                                                <th key={item.id} className={`border-l border-black print:border-2 p-0 capitalize min-w-[100px]`}>
                                                    {new Date(item.data).toLocaleDateString('pt-BR', {weekday: 'long', timeZone: 'UTC'}).split('-')[0]}
                                                </th>
                                            ))}
                                            {Array.from({length: chunkSize - chunk.length}).map((_, i) => <th key={i} className="border-l border-black print:border-2 min-w-[100px]"></th>)}
                                        </tr>
                                    </thead>
                                    <tbody className={`text-black font-medium leading-tight ${fontClass}`}>
                                        {reportData.types.map(type => (
                                            <tr key={type.id} className="border-b border-black print:border-none">
                                                <td className={`border-r border-black print:border-2 border-b border-black ${cellPadding} font-bold bg-white text-left pl-2 sticky left-0 print:static z-10 text-xs print:text-sm`}>
                                                    {type.nome}
                                                </td>
                                                {chunk.map(item => {
                                                    const assign = reportData.assignments[item.id]?.[type.id];
                                                    const display = assign ? getShortName(assign.nome, assign.chamado) : '';
                                                    return (
                                                        <td key={item.id} className={`border-l border-black print:border-2 ${cellPadding} bg-white whitespace-nowrap`}>
                                                            {display}
                                                        </td>
                                                    );
                                                })}
                                                {Array.from({length: chunkSize - chunk.length}).map((_, i) => <td key={i} className={`border-l border-black print:border-2 ${cellPadding}`}></td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            <style jsx global>{`
                @media print {
                    @page { margin: 0; size: ${printConfig.orientation}; } 
                    body * { visibility: hidden; }
                    #print-area, #print-area * { visibility: visible; }
                    #print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: ${marginClass};
                    }
                    .print-color-adjust-exact { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>
       </div>
    </DashboardLayout>
  );
}