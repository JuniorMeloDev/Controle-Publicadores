'use client';

import { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Button } from '@/app/components/ui/button';
import { Loader2, Printer, FileSpreadsheet, Search, ArrowLeft, Settings, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
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
  const [data, setData] = useState([]);
  
  // New Filter State
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
    margins: 'normal', // small, normal, wide
    headerColor: DEFAULT_HEADER_COLOR,
    textColor: DEFAULT_TEXT_COLOR,
    congregationName: process.env.NEXT_PUBLIC_NOME_CONGREGACAO
   });

  // Fetch on mount or when filter changes (debounced?)
  useEffect(() => {
    generateReport();
  }, [limit]);

  const generateReport = async () => {
    setLoading(true);
    try {
      let url = `/api/admin/relatorios/privilegios-mecanicos?start=${startDate}&limit=${limit}`;
      if (endDate) {
          url += `&end=${endDate}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
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
    if (data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data.map(item => ({
      Data: new Date(item.data).toLocaleDateString('pt-BR'),
      Dia: new Date(item.data).toLocaleDateString('pt-BR', { weekday: 'long' }),
      Leitor: getShortName(item.leitor_nome, item.leitor_chamado),
      'Ind. Interno': getShortName(item.ind_int_nome, item.ind_int_chamado),
      'Ind. Externo/Volante': getShortName(item.ind_ext_vol_nome, item.ind_ext_vol_chamado),
      'Ind. Externo': getShortName(item.ind_ext_nome, item.ind_ext_chamado),
      'Volante': getShortName(item.volante_nome, item.volante_chamado),
      'Ancião Apoio': getShortName(item.apoio_nome, item.apoio_chamado)
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Privilégios");
    XLSX.writeFile(wb, `Privilegios_Mecanicos_${startDate}.xlsx`);
  };

  const chunks = [];
  const chunkSize = 5; 
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
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
                
                {/* Title Section */}
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

                {/* Toolbar Section */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                    
                    {/* Filters */}
                    <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
                        <div className="w-full sm:w-auto">
                            <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Data Inicial</Label>
                            <Input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)} 
                                className="w-full sm:w-40 bg-white text-gray-900 border-gray-300" 
                            />
                        </div>
                        <div className="w-full sm:w-auto">
                            <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Data Final (Opcional)</Label>
                            <Input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                                className="w-full sm:w-40 bg-white text-gray-900 border-gray-300" 
                            />
                        </div>
                        <div className="w-20">
                            <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Qtd.</Label>
                            <Input 
                                type="number" 
                                value={limit} 
                                onChange={e => setLimit(e.target.value)} 
                                className="w-full bg-white text-gray-900 border-gray-300" 
                            />
                        </div>
                        <Button onClick={generateReport} className="mb-0.5 bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
                            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                        </Button>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="gap-2 bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
                                    <Settings className="w-4 h-4" /> Configurar
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg bg-white sm:rounded-xl">
                                <DialogHeader>
                                    <DialogTitle className="text-gray-900">Configurações de Impressão</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-5 py-4">
                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <Label className="text-gray-700 font-medium">Orientação do Papel</Label>
                                            <select 
                                                value={printConfig.orientation}
                                                onChange={(e) => setPrintConfig(prev => ({...prev, orientation: e.target.value}))}
                                                className="w-full p-2.5 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                            >
                                                <option value="portrait">Retrato (Vertical)</option>
                                                <option value="landscape">Paisagem (Horizontal)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-gray-700 font-medium">Margens</Label>
                                            <select 
                                                value={printConfig.margins}
                                                onChange={(e) => setPrintConfig(prev => ({...prev, margins: e.target.value}))}
                                                className="w-full p-2.5 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                            >
                                                <option value="small">Pequenas</option>
                                                <option value="normal">Normais</option>
                                                <option value="wide">Grandes</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-5">
                                         <div className="space-y-2">
                                            <Label className="text-gray-700 font-medium">Tamanho da Fonte</Label>
                                            <select 
                                                value={printConfig.fontSize}
                                                onChange={(e) => setPrintConfig(prev => ({...prev, fontSize: e.target.value}))}
                                                className="w-full p-2.5 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                            >
                                                <option value="normal">Normal</option>
                                                <option value="small">Compacta</option>
                                                <option value="extra-small">Super Compacta</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-gray-700 font-medium">Congregação</Label>
                                            <Input 
                                                value={printConfig.congregationName}
                                                onChange={(e) => setPrintConfig(prev => ({...prev, congregationName: e.target.value}))}
                                                className="bg-white text-gray-900 border-gray-300"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <Label className="text-gray-700 font-medium">Cor do Cabeçalho</Label>
                                            <div className="flex items-center gap-3 p-1 border border-gray-200 rounded-md bg-gray-50">
                                                <Input 
                                                    type="color" 
                                                    value={printConfig.headerColor}
                                                    onChange={(e) => setPrintConfig(prev => ({...prev, headerColor: e.target.value}))}
                                                    className="w-10 h-8 p-0 border-0 cursor-pointer"
                                                />
                                                <span className="text-xs font-mono text-gray-600">{printConfig.headerColor}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-gray-700 font-medium">Cor do Texto</Label>
                                            <div className="flex items-center gap-3 p-1 border border-gray-200 rounded-md bg-gray-50">
                                                <Input 
                                                    type="color" 
                                                    value={printConfig.textColor}
                                                    onChange={(e) => setPrintConfig(prev => ({...prev, textColor: e.target.value}))}
                                                    className="w-10 h-8 p-0 border-0 cursor-pointer"
                                                />
                                                <span className="text-xs font-mono text-gray-600">{printConfig.textColor}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={() => setConfigOpen(false)} className="bg-gray-900 text-white hover:bg-gray-800">Concluir</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <Button onClick={handleExport} variant="outline" className="gap-2 text-green-700 border-green-200 hover:bg-green-50 bg-white">
                            <FileSpreadsheet className="w-4 h-4" /> Excel
                        </Button>
                        <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                            <Printer className="w-4 h-4" /> Imprimir
                        </Button>
                    </div>
                </div>
            </div>

            {/* Print Content */}
            <div id="print-area" className={`bg-white rounded-xl border border-gray-200 shadow-sm print:border-none print:shadow-none p-6 print:p-0 ${printConfig.orientation}`}>
                
                {/* Visual Header */}
                <div 
                    className="mb-4 p-2 rounded-lg print:rounded-none flex flex-col items-center justify-center gap-1 print-color-adjust-exact"
                    style={{ backgroundColor: printConfig.headerColor, color: printConfig.textColor }}
                >
                    <div className="flex items-center gap-3">
                         <div className="text-2xl opacity-90">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                         </div>
                         <div className="h-6 w-px" style={{ backgroundColor: printConfig.textColor, opacity: 0.3 }} />
                         <h1 className="text-xl font-bold uppercase tracking-wide">Privilégios Mecânicos</h1>
                    </div>
                    <p className="font-medium text-sm" style={{ opacity: 0.9 }}>Congregação {printConfig.congregationName}</p>
                </div>

                {!loading && data.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">Nenhum dado encontrado.</div>
                ) : (
                    <div className="space-y-4"> 
                        {chunks.map((chunk, idx) => (
                            <div key={idx} className="border border-black print:border-none bg-white print:break-inside-avoid overflow-x-auto">
                                <table className="w-full text-center border-collapse min-w-[600px] print:min-w-0">
                                    <thead>
                                        {/* Date Row 1 */}
                                        <tr className={`bg-white print:bg-white text-black font-bold border-b border-black print:border-none print-color-adjust-exact ${fontClass}`}>
                                            {/* ALTERADO: print:border-2 em TODOS os THs */}
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
                                        {[
                                            { label: 'Leitor', prop: 'leitor', field: 'nome' },
                                            { label: 'Ind. Interno', prop: 'ind_int', field: 'nome' },
                                            { label: 'Ind. Externo/Volante', prop: 'ind_ext_vol', field: 'nome' },
                                            { label: 'Ind. Externo', prop: 'ind_ext', field: 'nome' },
                                            { label: 'Volante', prop: 'volante', field: 'nome' },
                                            { label: 'Ancião de Apoio', prop: 'apoio', field: 'nome' },
                                        ].map((rowDef, rIdx) => (
                                            <tr key={rIdx} className="border-b border-black print:border-none">
                                                {/* ALTERADO: print:border-2 em TODOS os TDs */}
                                                <td className={`border-r border-black print:border-2 border-b border-black ${cellPadding} font-bold bg-white text-left pl-2 sticky left-0 print:static z-10 text-xs print:text-sm`}>
                                                    {rowDef.label}
                                                </td>
                                                {chunk.map(item => {
                                                    const name = getShortName(item[`${rowDef.prop}_nome`], item[`${rowDef.prop}_chamado`]);
                                                    const isSemana = item.tipo === 'Meio de Semana';
                                                    let display = name;
                                                    if (!display) {
                                                        if (rowDef.label === 'Leitor' && isSemana) display = '**'; 
                                                        else display = '';
                                                    }
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