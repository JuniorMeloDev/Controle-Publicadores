'use client';

import { DashboardLayout } from '@/app/components/DashboardLayout';
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import * as XLSX from 'xlsx';
import { Loader2, Users, Video, UserMinus, RefreshCcw, Printer, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

// Chart.js Imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

// Register Chart.js Components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

export default function AssistenciaPage() {
    const [fullData, setFullData] = useState(null); 
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    // Independent period states
    const [trendPeriod, setTrendPeriod] = useState('mes');
    const [compPeriod, setCompPeriod] = useState('mes');

    // Chart Type States
    const [trendChartType, setTrendChartType] = useState('line_curve'); // line_curve, line_straight, area, bar, bar_stacked
    const [compChartType, setCompChartType] = useState('bar_stacked'); // Default to stacked for composition

    // Derived states
    const [averages, setAverages] = useState({ presencial: 0, zoom: 0, visitantes: 0, faltantes: 0 });
    const [trendData, setTrendData] = useState([]);
    const [compData, setCompData] = useState([]);

    const lineChartRef = useRef(null);
    const barChartRef = useRef(null);
    // We need generic refs because the component type might change
    const trendRef = useRef(null);
    const compRef = useRef(null);

    useEffect(() => {
        const now = new Date();
        const startOfYear = `${now.getFullYear()}-01-01`;
        const endOfYear = `${now.getFullYear()}-12-31`;
        fetchData(startOfYear, endOfYear, true);
    }, []);

    useEffect(() => {
        if (!fullData) return;

        let averagesData = [];
        if (startDate && endDate) {
            averagesData = fullData; 
        } else {
             averagesData = filterDataByPeriod(fullData, 'mes');
        }
        setAverages(calculateAverages(averagesData));

        if (startDate && endDate) {
            setTrendData(fullData);
            setCompData(fullData);
        } else {
            setTrendData(filterDataByPeriod(fullData, trendPeriod));
            setCompData(filterDataByPeriod(fullData, compPeriod));
        }

    }, [fullData, trendPeriod, compPeriod, startDate, endDate]);

    const clearFilters = () => {
        setStartDate('');
        setEndDate('');
        const now = new Date();
        fetchData(`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`, true);
    };

    const fetchData = async (overrideStart, overrideEnd, isDefaultFetch = false) => {
        setLoading(true);
        try {
            let url = '/api/admin/relatorios/assistencia';
            const start = overrideStart !== undefined ? overrideStart : startDate;
            const end = overrideEnd !== undefined ? overrideEnd : endDate;

            if (start && end) {
                url += `?startDate=${start}&endDate=${end}`;
            } else {
               const now = new Date();
               if(!isDefaultFetch && !start) {
                    url += `?startDate=${now.getFullYear()}-01-01&endDate=${now.getFullYear()}-12-31`;
               } else {
                   url += '?limit=100'; 
               }
            }
            
            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                setFullData(json.history || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- Chart Configuration Helper ---
    const getChartConfig = (type, data, isStacked = false) => {
        const labels = data ? data.map(d => new Date(d.fullDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })) : [];
        const commonDatasets = [
            { label: 'Presencial', data: data.map(d => d.presencial), color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.2)' },
            { label: 'Zoom', data: data.map(d => d.zoom), color: '#A855F7', bg: 'rgba(168, 85, 247, 0.2)' },
            { label: 'Visitantes', data: data.map(d => d.visitantes), color: '#10B981', bg: 'rgba(16, 185, 129, 0.2)' },
            { label: 'Faltantes', data: data.map(d => d.faltantes), color: '#EF4444', bg: 'rgba(239, 68, 68, 0.2)' }
        ];

        const datasets = commonDatasets.map(ds => {
            const base = {
                label: ds.label,
                data: ds.data,
                borderColor: ds.color,
                backgroundColor: type === 'area' || type.startsWith('bar') ? ds.bg : ds.bg.replace('0.2)', '0.0)'), // Area needs opacity
            };

            if (type === 'line_curve') {
                return { ...base, tension: 0.4, fill: false };
            } else if (type === 'line_straight') {
                return { ...base, tension: 0, fill: false };
            } else if (type === 'area') {
                 return { ...base, tension: 0.4, fill: true };
            } else if (type.startsWith('bar')) {
                // For bars, solid color usually looks better or high opacity
                return { ...base, backgroundColor: ds.color, stack: isStacked ? 'stack1' : undefined };
            }
            return base;
        });

        // Specific tweak for Faltantes dash line if not bar
        if (!type.startsWith('bar')) {
            datasets[3].borderDash = [5, 5];
        }

        return { labels, datasets };
    };

    const getOptions = (type) => {
        const isStacked = type === 'bar_stacked';
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } },
                tooltip: { 
                    mode: 'index', 
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#000',
                    bodyColor: '#333',
                    borderColor: '#ddd',
                    borderWidth: 1
                }
            },
            scales: {
                x: { 
                    grid: { display: false },
                    stacked: isStacked
                },
                y: { 
                    grid: { color: '#f3f4f6' }, 
                    beginAtZero: true,
                    stacked: isStacked
                }
            },
            elements: {
                line: { borderWidth: 2 },
                point: { radius: 3, hitRadius: 10 }
            }
        };
    };

    const renderChart = (type, data, ref) => {
        const config = getChartConfig(type, data, type === 'bar_stacked');
        const options = getOptions(type);

        if (type.startsWith('bar')) {
            return <Bar ref={ref} data={config} options={options} />;
        } else {
             return <Line ref={ref} data={config} options={options} />;
        }
    };

    // --- PDF Export Logic (Canvas) ---
    const handlePrint = async () => {
        try {
            const { jsPDF } = await import('jspdf');
            
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            let yPos = 20;

            // 1. Header
            pdf.setFontSize(22);
            pdf.setFont("helvetica", "bold");
            pdf.text("Relatório de Assistência", pageWidth / 2, yPos, { align: "center" });
            yPos += 8;
            
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(100);
            pdf.text("Análise de assistência às reuniões", pageWidth / 2, yPos, { align: "center" });
            yPos += 15;

            // Date Range
            if (startDate && endDate) {
                pdf.setDrawColor(200);
                pdf.line(margin, yPos, pageWidth - margin, yPos);
                yPos += 7;
                pdf.setFontSize(10);
                pdf.setTextColor(50);
                const dateText = `INÍCIO: ${new Date(startDate).toLocaleDateString('pt-BR')}    FIM: ${new Date(endDate).toLocaleDateString('pt-BR')}`;
                pdf.text(dateText, pageWidth / 2, yPos, { align: "center" });
                yPos += 10;
            }

            // 2. KPIs
            const stats = averages;
            const boxWidth = (pageWidth - (margin * 2) - 15) / 4;
            const boxHeight = 25;
            const kpis = [
                { title: "Média Presencial", value: stats.presencial, color: [59, 130, 246] },
                { title: "Média Zoom", value: stats.zoom, color: [168, 85, 247] },
                { title: "Média Visitantes", value: stats.visitantes, color: [34, 197, 94] },
                { title: "Média Faltantes", value: stats.faltantes, color: [239, 68, 68] }
            ];

            kpis.forEach((kpi, index) => {
                const x = margin + (index * (boxWidth + 5));
                pdf.setDrawColor(220);
                pdf.setFillColor(255, 255, 255);
                pdf.roundedRect(x, yPos, boxWidth, boxHeight, 3, 3, 'FD');
                pdf.setFillColor(...kpi.color);
                pdf.rect(x, yPos, 2, boxHeight, 'F');
                pdf.setFontSize(8);
                pdf.setTextColor(100);
                pdf.text(kpi.title, x + 5, yPos + 6);
                pdf.setFontSize(16);
                pdf.setTextColor(0);
                pdf.setFont("helvetica", "bold");
                pdf.text(kpi.value.toString(), x + 5, yPos + 16);
                pdf.setFont("helvetica", "normal");
            });
            yPos += boxHeight + 15;

            // 3. Charts (Canvas to Image)
            const addChartToPdf = (chartRef, title) => {
                if (chartRef.current) {
                    const canvas = chartRef.current.canvas; 
                    if (canvas) {
                        // Max height for print to ensure fit (e.g., 75mm)
                        const maxPrintHeight = 75; 

                        if (yPos + maxPrintHeight + 20 > pageHeight - margin) {
                            pdf.addPage();
                            yPos = 20;
                        }

                        pdf.setFontSize(12);
                        pdf.setTextColor(0);
                        pdf.setFont("helvetica", "bold");
                        pdf.text(title, margin, yPos);
                        yPos += 5;

                        const imgData = canvas.toDataURL('image/png', 1.0);
                        const imgWidth = pageWidth - (margin * 2);
                        // Calculate proportional height, but cap it
                        let imgHeight = (canvas.height * imgWidth) / canvas.width;
                        if (imgHeight > maxPrintHeight) imgHeight = maxPrintHeight;

                        pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
                        yPos += imgHeight + 15;
                    }
                }
            };

            addChartToPdf(trendRef, "Tendência");
            addChartToPdf(compRef, "Composição");

            pdf.save(`Relatorio_Assistencia_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error('PDF Generation Error:', error);
            alert('Não foi possível gerar o arquivo PDF. Tente novamente.');
        }
    };

    const handleExport = () => {
         if (!fullData || fullData.length === 0) return;
         const dataToExport = fullData.map(item => ({
            Data: new Date(item.fullDate).toLocaleDateString('pt-BR'),
            'Dia da Semana': new Date(item.fullDate).toLocaleDateString('pt-BR', { weekday: 'long' }),
            Presencial: item.presencial,
            Zoom: item.zoom,
            Visitantes: item.visitantes,
            Faltantes: item.faltantes
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Assistência");
        XLSX.writeFile(wb, `Relatorio_Assistencia_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const filterDataByPeriod = (data, period) => {
        if (!data || data.length === 0) return [];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        return data.filter(item => {
            const itemDate = new Date(item.fullDate);
            const itemMonth = itemDate.getMonth();
            const itemYear = itemDate.getFullYear();
            if (itemYear !== currentYear) return false;
            switch(period) {
                case 'mes': return itemMonth === currentMonth;
                case 'trimestre': return Math.floor(itemMonth / 3) === Math.floor(currentMonth / 3);
                case 'semestre': return (itemMonth < 6 ? 0 : 1) === (currentMonth < 6 ? 0 : 1);
                default: return true;
            }
        });
    };

    const calculateAverages = (dataSet) => {
        if (!dataSet || dataSet.length === 0) return { presencial: 0, zoom: 0, visitantes: 0, faltantes: 0 };
        const count = dataSet.length;
        return {
            presencial: Math.round(dataSet.reduce((acc, curr) => acc + curr.presencial, 0) / count),
            zoom: Math.round(dataSet.reduce((acc, curr) => acc + curr.zoom, 0) / count),
            visitantes: Math.round(dataSet.reduce((acc, curr) => acc + curr.visitantes, 0) / count),
            faltantes: Math.round(dataSet.reduce((acc, curr) => acc + curr.faltantes, 0) / count),
        };
    };

    if (loading && !fullData) return <DashboardLayout><div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div></DashboardLayout>;
    if (!fullData) return <DashboardLayout><div className="p-8 text-center text-gray-500">Erro ao carregar dados.</div></DashboardLayout>;

    const isGlobalFilterActive = !!(startDate && endDate);

    const ChartSelector = ({ value, onChange }) => (
        <select className="text-sm border-gray-300 rounded-md shadow-sm p-1 bg-white border outline-none text-gray-600 max-w-[120px]" value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="line_curve">Curva</option>
            <option value="line_straight">Linha</option>
            <option value="area">Área</option>
            <option value="bar">Barra</option>
            <option value="bar_stacked">Pilha</option>
        </select>
    );

    const PeriodSelector = ({ value, onChange }) => (
        <select className="text-sm border-gray-300 rounded-md shadow-sm p-1 bg-white border outline-none text-gray-600 max-w-[120px]" value={value} onChange={(e) => onChange(e.target.value)}>
             <option value="mes">Mês</option>
             <option value="trimestre">Trimestre</option>
             <option value="semestre">Semestre</option>
             <option value="ano">Ano</option>
        </select>
    );

    return (
        <DashboardLayout>
            <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
                {/* HEADER */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Relatório de Assistência</h1>
                        <p className="text-gray-700">Análise de assistência às reuniões.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex gap-2">
                             <div className="flex flex-col gap-1">
                                 <label className="text-xs font-bold text-gray-700 uppercase">Início</label>
                                 <input type="date" className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                             </div>
                             <div className="flex flex-col gap-1">
                                 <label className="text-xs font-bold text-gray-700 uppercase">Fim</label>
                                 <input type="date" className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                             </div>
                        </div>
                        <Button onClick={() => fetchData()} variant="outline" size="sm" className="gap-2 h-9 text-white bg-blue-500 hover:bg-blue-600">
                            <RefreshCcw className="w-4 h-4" /> Atualizar
                        </Button>
                        <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2 h-9 text-gray-700 hover:bg-gray-100" title="Gerar PDF">
                            <Printer className="w-4 h-4" /> PDF
                        </Button>
                         <Button onClick={handleExport} variant="outline" size="sm" className="gap-2 h-9 text-green-700 border-green-200 hover:bg-green-50" title="Exportar XLSX">
                            <FileSpreadsheet className="w-4 h-4" />
                        </Button>
                        {isGlobalFilterActive && <Button onClick={clearFilters} variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700 h-9">Limpar</Button>}
                    </div>
                </div>

                {/* KPI CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <Card className="border-l-4 border-l-blue-500 shadow-sm">
                        <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-bold text-gray-700">Média Presencial</CardTitle><Users className="w-4 h-4 text-blue-500" /></div></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-gray-900">{averages.presencial}</div><p className="text-xs font-medium text-gray-600">Publicadores no Salão</p></CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-purple-500 shadow-sm">
                        <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-bold text-gray-700">Média Zoom</CardTitle><Video className="w-4 h-4 text-purple-500" /></div></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-gray-900">{averages.zoom}</div><p className="text-xs font-medium text-gray-600">Conectados online</p></CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-green-500 shadow-sm">
                        <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-bold text-gray-700">Média Visitantes</CardTitle><Users className="w-4 h-4 text-green-500" /></div></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-gray-900">{averages.visitantes}</div><p className="text-xs font-medium text-gray-600">Assistência Externa</p></CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-red-500 shadow-sm">
                        <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-bold text-gray-700">Média Faltantes</CardTitle><UserMinus className="w-4 h-4 text-red-500" /></div></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-gray-900">{averages.faltantes}</div><p className="text-xs font-medium text-gray-600">Não compareceram</p></CardContent>
                    </Card>
                </div>

                {/* CHARTJS CHARTS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="shadow-sm flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                             <div className="flex flex-col gap-1">
                                <CardTitle className="text-gray-900 text-base">Tendência</CardTitle>
                                <CardDescription className="text-gray-600 text-xs">Evolução da assistência</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <ChartSelector value={trendChartType} onChange={setTrendChartType} />
                                {!isGlobalFilterActive && <PeriodSelector value={trendPeriod} onChange={setTrendPeriod} />}
                            </div>
                        </CardHeader>
                        <CardContent className="h-[300px] w-full">
                            {renderChart(trendChartType, trendData, trendRef)}
                        </CardContent>
                    </Card>
                    
                    <Card className="shadow-sm flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                             <div className="flex flex-col gap-1">
                                <CardTitle className="text-gray-900 text-base">Composição</CardTitle>
                                <CardDescription className="text-gray-600 text-xs">Presencial vs Zoom vs Faltantes</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <ChartSelector value={compChartType} onChange={setCompChartType} />
                                {!isGlobalFilterActive && <PeriodSelector value={compPeriod} onChange={setCompPeriod} />}
                            </div>
                        </CardHeader>
                        <CardContent className="h-[300px] w-full">
                            {renderChart(compChartType, compData, compRef)}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
