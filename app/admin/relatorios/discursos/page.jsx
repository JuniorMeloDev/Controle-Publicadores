
'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Button } from '@/app/components/ui/button';
import { Loader2, Printer, FileSpreadsheet, Search, ArrowLeft } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import Link from 'next/link';

export default function PublicSpeechesReport() {
  const [loading, setLoading] = useState(false);
  const [speeches, setSpeeches] = useState([]);
  
  // Filter State
  const getCurrentMonthFirstDay = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  const [startDate, setStartDate] = useState(getCurrentMonthFirstDay());
  const [endDate, setEndDate] = useState('');
  const [themeFilter, setThemeFilter] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState('');
  const [congregationFilter, setCongregationFilter] = useState('');

  useEffect(() => {
    generateReport();
  }, []);

  // Clear Filters
  const clearFilters = () => {
    setStartDate(getCurrentMonthFirstDay());
    setEndDate('');
    setThemeFilter('');
    setSpeakerFilter('');
    setCongregationFilter('');
    // Trigger reset logic
    generateReportWithParams(getCurrentMonthFirstDay(), '', '', '', '');
  };

  const generateReportWithParams = async (start, end, theme, speaker, congregation) => {
    setLoading(true);
    try {
      let url = `/api/admin/relatorios/discursos?start=${start}`;
      if (end) url += `&end=${end}`;
      if (theme) url += `&theme=${encodeURIComponent(theme)}`;
      if (speaker) url += `&speaker=${encodeURIComponent(speaker)}`;
      if (congregation) url += `&congregation=${encodeURIComponent(congregation)}`;

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setSpeeches(json);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = () => {
      generateReportWithParams(startDate, endDate, themeFilter, speakerFilter, congregationFilter);
  };
    
  const handleExport = () => {
    if (speeches.length === 0) return;
    
    // Flatten data for Excel
    const wsData = speeches.map(s => ({
        Data: new Date(s.data).toLocaleDateString('pt-BR'),
        Orador: s.orador || '-',
        Congregacao: s.congregacao || '-', 
        Tema: s.tema || '-',
        Presidente: s.presidente_nome || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Discursos");
    XLSX.writeFile(wb, `Discursos_${startDate}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Config
    const margin = 15;
    let y = 20;
    const lineHeight = 7;
    const pageHeight = doc.internal.pageSize.height;
    
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Discursos Públicos', margin, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const cong = process.env.NEXT_PUBLIC_NOME_CONGREGACAO || 'Congregação';
    doc.text(cong, margin, y);
    y += 5;
    
    // Filters Info (optional)
    if(startDate) {
        doc.setFontSize(9);
        doc.text(`Período: ${new Date(startDate).toLocaleDateString('pt-BR')} ${endDate ? 'a ' + new Date(endDate).toLocaleDateString('pt-BR') : 'em diante'}`, margin, y);
        y += 10;
    }

    // Table Headers
    const headers = ['Data', 'Tema', 'Cânt.', 'Orador', 'Congregação', 'Presidente'];
    const colWidths = [25, 60, 15, 40, 30, 0]; // 0 = rest
    // X Positions
    const xPositions = [margin];
    for(let i=0; i < colWidths.length - 1; i++) {
        xPositions.push(xPositions[i] + colWidths[i]);
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 5, 180, 7, 'F'); // Header background
    
    headers.forEach((h, i) => {
        doc.text(h, xPositions[i], y);
    });
    y += 8;

    // Table Content
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    speeches.forEach((s) => {
        // Check Page Break
        if (y + lineHeight > pageHeight - margin) {
            doc.addPage();
            y = 20;
            // Draw Header again
            doc.setFont('helvetica', 'bold');
            headers.forEach((h, i) => doc.text(h, xPositions[i], y));
            y += 8;
            doc.setFont('helvetica', 'normal');
        }

        const dataDate = new Date(s.data).toLocaleDateString('pt-BR');
        const dataTema = s.tema ? doc.splitTextToSize(s.tema, colWidths[1] - 2) : '-';
        const dataCant = s.cantico ? String(s.cantico) : '-';
        const dataOrador = s.orador ? doc.splitTextToSize(s.orador, colWidths[3] - 2) : '-';
        const dataCong = s.congregacao ? doc.splitTextToSize(s.congregacao, colWidths[4] - 2) : '-';
        const dataPres = s.presidente_nome || '-';

        // Calculate max height for this row based on wrapping text (theme/speaker)
        const themeLines = Array.isArray(dataTema) ? dataTema.length : 1;
        const oradorLines = Array.isArray(dataOrador) ? dataOrador.length : 1;
        const congLines = Array.isArray(dataCong) ? dataCong.length : 1;
        const maxLines = Math.max(themeLines, oradorLines, congLines);
        const rowHeight = maxLines * 5; 

        // Draw Row
        doc.text(dataDate, xPositions[0], y);
        doc.text(dataTema, xPositions[1], y);
        doc.text(dataCant, xPositions[2], y);
        doc.text(dataOrador, xPositions[3], y);
        doc.text(dataCong, xPositions[4], y);
        doc.text(dataPres, xPositions[5], y);
        
        y += rowHeight + 2; // Spacing
        
        // Horizontal Line
        doc.setDrawColor(230, 230, 230);
        doc.line(margin, y - 2, 195, y - 2); 
    });

    const filename = `Discursos_${startDate || 'Geral'}.pdf`;
    doc.save(filename);
  };


  const searchOnEnter = (e) => {
      if (e.key === 'Enter') generateReport();
  }

  const hasActiveFilters = startDate !== getCurrentMonthFirstDay() || endDate || themeFilter || speakerFilter || congregationFilter;

  return (
    <DashboardLayout>
       <div className="max-w-6xl mx-auto space-y-8">
            <div className="print:hidden space-y-6">
                
                <div className="flex items-center gap-4">
                    <Link href="/admin/relatorios">
                        <Button variant="ghost" size="icon" className="shrink-0 text-gray-700 hover:text-gray-900 hover:bg-gray-100">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Relatório de Discursos Públicos</h1>
                        <p className="text-sm text-gray-600">Filtre por data, tema, orador ou congregação</p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    
                    {/* Filters Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4 border-b border-gray-200 pb-4">
                        <div>
                            <Label className="text-xs font-bold text-gray-900 mb-1.5 block">Data Inicial</Label>
                            <Input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)} 
                                onKeyDown={searchOnEnter}
                                className="w-full bg-white text-gray-900 border-gray-300 font-medium" 
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold text-gray-900 mb-1.5 block">Data Final</Label>
                            <Input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                                onKeyDown={searchOnEnter}
                                className="w-full bg-white text-gray-900 border-gray-300 font-medium" 
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold text-gray-900 mb-1.5 block">Tema</Label>
                            <Input 
                                type="text" 
                                placeholder="Filtrar por tema..."
                                value={themeFilter} 
                                onChange={e => setThemeFilter(e.target.value)} 
                                onKeyDown={searchOnEnter}
                                className="w-full bg-white text-gray-900 border-gray-300 font-medium" 
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold text-gray-900 mb-1.5 block">Orador</Label>
                            <Input 
                                type="text" 
                                placeholder="Nome..."
                                value={speakerFilter} 
                                onChange={e => setSpeakerFilter(e.target.value)} 
                                onKeyDown={searchOnEnter}
                                className="w-full bg-white text-gray-900 border-gray-300 font-medium" 
                            />
                        </div>
                        <div className="flex gap-2">
                             <div className="flex-1">
                                <Label className="text-xs font-bold text-gray-900 mb-1.5 block">Congregação</Label>
                                <Input 
                                    type="text" 
                                    placeholder="Congregação..."
                                    value={congregationFilter} 
                                    onChange={e => setCongregationFilter(e.target.value)} 
                                    onKeyDown={searchOnEnter}
                                    className="w-full bg-white text-gray-900 border-gray-300 font-medium" 
                                />
                             </div>
                             <div className="flex items-end gap-1">
                                <Button onClick={generateReport} className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm mb-[1px]" title="Pesquisar">
                                    {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                                </Button>
                                {hasActiveFilters && (
                                    <Button onClick={clearFilters} variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 mb-[1px] px-3" title="Limpar Filtros">
                                        Limpar
                                    </Button>
                                )}
                             </div>
                        </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex justify-end gap-2">
                        <Button onClick={handleExport} variant="outline" className="gap-2 text-green-700 border-green-200">
                            <FileSpreadsheet className="w-4 h-4" /> Excel
                        </Button>
                        <Button onClick={handleExportPDF} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                            <Printer className="w-4 h-4" />PDF
                        </Button>
                    </div>
                </div>
            </div>

            <div id="print-area" className="bg-white rounded-xl border border-gray-200 shadow-sm print:border-none print:shadow-none p-6 print:p-0">
                <div className="mb-6 hidden print:block text-center border-b pb-4">
                     <h1 className="text-2xl font-bold uppercase tracking-wide text-gray-900">Programação de Discursos Públicos</h1>
                     <p className="text-sm text-gray-600">Congregação {process.env.NEXT_PUBLIC_NOME_CONGREGACAO}</p>
                </div>

                {!loading && speeches.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">Nenhum discurso encontrado.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-gray-200 text-gray-900 text-sm uppercase tracking-wider bg-gray-50/50 print:bg-white">
                                    <th className="p-3 font-bold print:border print:border-black">Data</th>
                                    <th className="p-3 font-bold print:border print:border-black w-1/4">Tema</th>
                                    <th className="p-3 font-bold print:border print:border-black text-center">Cânt.</th>
                                    <th className="p-3 font-bold print:border print:border-black">Orador</th>
                                    <th className="p-3 font-bold print:border print:border-black">Congregação</th>
                                    <th className="p-3 font-bold print:border print:border-black">Presidente</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-700 text-sm">
                                {speeches.map((s, i) => (
                                    <tr key={s.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} print:bg-white border-b border-gray-100 print:border-black`}>
                                        <td className="p-3 font-medium text-gray-900 print:border print:border-black whitespace-nowrap">
                                            {new Date(s.data).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="p-3 print:border print:border-black font-medium">
                                            {s.tema || '-'}
                                        </td>
                                        <td className="p-3 print:border print:border-black text-center">
                                            {s.cantico || '-'}
                                        </td>
                                        <td className="p-3 print:border print:border-black font-bold text-gray-900">
                                            {s.orador || 'A definir'}
                                        </td>
                                        <td className="p-3 print:border print:border-black text-gray-600 print:text-gray-900 font-medium">
                                            {s.congregacao || '-'}
                                        </td>
                                        <td className="p-3 print:border print:border-black">
                                            {s.presidente_nome || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
            <style jsx global>{`
                @media print {
                    @page { margin: 1.5cm; } 
                    body * { visibility: hidden; }
                    #print-area, #print-area * { visibility: visible; }
                    #print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 0;
                    }
                }
            `}</style>
       </div>
    </DashboardLayout>
  );
}
