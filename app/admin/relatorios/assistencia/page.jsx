'use client';

import { DashboardLayout } from '@/app/components/DashboardLayout';
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import * as XLSX from 'xlsx';
import { Loader2, Users, Video, UserMinus, RefreshCcw, Printer, FileSpreadsheet, Calculator } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/app/components/ui/dialog";
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

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
    const getCurrentMonthRange = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        return {
            start: new Date(year, month, 1).toLocaleDateString('en-CA'),
            end: new Date(year, month + 1, 0).toLocaleDateString('en-CA')
        };
    };

    const { start: initialStart, end: initialEnd } = getCurrentMonthRange();

    const [startDate, setStartDate] = useState(initialStart);
    const [endDate, setEndDate] = useState(initialEnd);

    // Independent period states
    const [trendPeriod, setTrendPeriod] = useState('mes');
    const [compPeriod, setCompPeriod] = useState('mes');
    const [totalTypeFilter, setTotalTypeFilter] = useState('todos');

    // Chart Type States
    const [trendChartType, setTrendChartType] = useState('line_curve');
    const [compChartType, setCompChartType] = useState('bar_stacked');

    // Derived states
    const [averages, setAverages] = useState({ presencial: 0, zoom: 0, visitantes: 0, faltantes: 0 });
    const [trendData, setTrendData] = useState([]);
    const [compData, setCompData] = useState([]);

    const lineChartRef = useRef(null);
    const barChartRef = useRef(null);
    const trendRef = useRef(null);
    const compRef = useRef(null);

    // Detail Modal State
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailData, setDetailData] = useState([]);
    const [detailMetric, setDetailMetric] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const handleCardClick = async (metric) => {
        setDetailMetric(metric);
        setIsDetailOpen(true);
        setDetailLoading(true);

        try {
            // Determine date range - Use functionality of state or defaults
            const start = startDate || initialStart;
            const end = endDate || initialEnd;

            const res = await fetch(`/api/admin/relatorios/assistencia/detalhes?startDate=${start}&endDate=${end}&type=${metric}`);
            if (res.ok) {
                const data = await res.json();
                setDetailData(data);
            }
        } catch (error) {
            console.error("Erro ao buscar detalhes", error);
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        // Fetch data based on initialized state
        fetchData();
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
                if (!isDefaultFetch && !start) {
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
        const labels = data ? data.map(d => {
            if (!d.fullDate) return '';
            const parts = d.fullDate.substring(0, 10).split('-');
            // parts[0]=YYYY, parts[1]=MM, parts[2]=DD
            return `${parts[2]}/${parts[1]}`;
        }) : [];
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

    // --- PDF Export (Canvas + Manual Table) ---
    const handlePrint = async () => {
        try {
            const { jsPDF } = await import('jspdf');

            // 1. Fetch Detailed Matrix Data
            const start = startDate || initialStart;
            const end = endDate || initialEnd;
            const res = await fetch(`/api/admin/relatorios/assistencia/matriz?startDate=${start}&endDate=${end}`);
            if (!res.ok) throw new Error("Erro ao buscar dados da matriz");
            const { meetings, rows } = await res.json();

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            let yPos = 15;

            // Helper for new page
            const checkPageBreak = (heightNeeded) => {
                if (yPos + heightNeeded > pageHeight - margin) {
                    pdf.addPage();
                    yPos = 15;
                    return true;
                }
                return false;
            };

            // Formatting Date helpers (keeps local YYYY-MM-DD as is)
            const formatDateSafe = (dateStr) => {
                if (!dateStr) return '';
                const parts = dateStr.split('-');
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            };

            // 1. Header
            pdf.setFontSize(18);
            pdf.setFont("helvetica", "bold");
            pdf.text("Relatório de Assistência Detalhado", pageWidth / 2, yPos, { align: "center" });
            yPos += 7;

            pdf.setFontSize(10);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(100);
            const dateText = `Período: ${formatDateSafe(start)} a ${formatDateSafe(end)}`;
            pdf.text(dateText, pageWidth / 2, yPos, { align: "center" });
            yPos += 15;

            // 2. KPI Cards
            const stats = averages;

            // Calculate specific totals
            const mediaTotalGeral = calculateTotalAverage(startDate && endDate ? fullData : filterDataByPeriod(fullData, 'mes'), 'todos');
            const mediaTotalMeio = calculateTotalAverage(startDate && endDate ? fullData : filterDataByPeriod(fullData, 'mes'), 'meio');
            const mediaTotalFim = calculateTotalAverage(startDate && endDate ? fullData : filterDataByPeriod(fullData, 'mes'), 'fim');

            const kpis = [
                { title: "Média Total (Geral)", value: mediaTotalGeral, color: [75, 85, 99] },
                { title: "Média Total (Meio)", value: mediaTotalMeio, color: [75, 85, 99] },
                { title: "Média Total (Fim)", value: mediaTotalFim, color: [75, 85, 99] },
                { title: "Média Presencial", value: stats.presencial, color: [59, 130, 246] },
                { title: "Média Zoom", value: stats.zoom, color: [168, 85, 247] },
                { title: "Média Visitantes", value: stats.visitantes, color: [34, 197, 94] },
                { title: "Média Faltantes", value: stats.faltantes, color: [239, 68, 68] }
            ];

            const kpiWidth = 35;
            const kpiHeight = 15;
            const kpiGap = 4;
            const maxCols = 4; // Max cards per row

            // Calculate centering for first row
            const firstRowCards = Math.min(kpis.length, maxCols);
            const firstRowWidth = (kpiWidth * firstRowCards) + (kpiGap * (firstRowCards - 1));
            let currentX = (pageWidth - firstRowWidth) / 2;
            let startRowX = currentX;

            kpis.forEach((kpi, i) => {
                // New Row check
                if (i > 0 && i % maxCols === 0) {
                    yPos += kpiHeight + 5;
                    // Recalculate centering for this remaining row
                    const remaining = kpis.length - i;
                    const rowCards = Math.min(remaining, maxCols);
                    const rowWidth = (kpiWidth * rowCards) + (kpiGap * (rowCards - 1));
                    currentX = (pageWidth - rowWidth) / 2;
                }

                pdf.setDrawColor(200);
                pdf.setFillColor(255, 255, 255);
                pdf.roundedRect(currentX, yPos, kpiWidth, kpiHeight, 2, 2, 'FD');

                pdf.setFillColor(...kpi.color);
                pdf.rect(currentX, yPos, 2, kpiHeight, 'F'); // border left

                pdf.setFontSize(6);
                pdf.setTextColor(100);
                pdf.text(kpi.title, currentX + 4, yPos + 5);

                pdf.setFontSize(12);
                pdf.setTextColor(0);
                pdf.setFont("helvetica", "bold");
                pdf.text(kpi.value.toString(), currentX + 4, yPos + 11);

                currentX += kpiWidth + kpiGap;
            });
            yPos += kpiHeight + 10;


            // 3. Matrix Table
            if (meetings.length > 0) {
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(12);
                pdf.text("Matriz de Frequência", margin, yPos);
                yPos += 6;

                // Column Config
                const nameColWidth = 60;
                // Distribute remaining width among date columns
                const availableWidth = pageWidth - (margin * 2) - nameColWidth;
                const colWidth = Math.min(15, availableWidth / meetings.length);
                const rowHeight = 6; // Compact rows
                const headerHeight = 10;

                // Header Row
                pdf.setFillColor(240, 240, 240);
                pdf.rect(margin, yPos, pageWidth - (margin * 2), headerHeight, 'F');
                pdf.setFontSize(9);
                pdf.setTextColor(0);

                pdf.text("Publicador", margin + 2, yPos + 6);

                meetings.forEach((m, i) => {
                    const cx = margin + nameColWidth + (i * colWidth);
                    // Rotate date text if narrow
                    if (colWidth < 12) {
                        pdf.text(m.date, cx + (colWidth / 2), yPos + 6, { align: 'center', angle: 90 });
                    } else {
                        pdf.text(m.date, cx + (colWidth / 2), yPos + 6, { align: 'center' });
                    }
                });

                yPos += headerHeight;

                // Data Rows
                pdf.setFont("helvetica", "normal");
                rows.forEach((row, rowIndex) => {
                    checkPageBreak(rowHeight);

                    // Zebra stripe
                    if (rowIndex % 2 === 1) {
                        pdf.setFillColor(250, 250, 250);
                        pdf.rect(margin, yPos, pageWidth - (margin * 2), rowHeight, 'F');
                    }

                    pdf.setTextColor(0);
                    pdf.setFontSize(8);

                    // Truncate name if too long
                    let name = row.shortName || row.name;
                    if (name.length > 35) name = name.substring(0, 32) + '...';
                    pdf.text(name, margin + 2, yPos + 4.5);

                    // Checkmarks
                    meetings.forEach((m, i) => {
                        const cx = margin + nameColWidth + (i * colWidth);
                        const status = row.attendance[m.id];

                        let symbol = '';
                        if (status === 'Presencial') {
                            pdf.setTextColor(0, 100, 0); // Dark Green
                            symbol = 'P';
                        } else if (status === 'Zoom') {
                            pdf.setTextColor(100, 0, 100); // Purple
                            symbol = 'Z';
                        } else {
                            pdf.setTextColor(200, 50, 50); // Red
                            symbol = 'F'; // Falta
                        }

                        pdf.setFont("courier", "bold"); // Monospace for alignment
                        pdf.text(symbol, cx + (colWidth / 2), yPos + 4.5, { align: 'center' });
                        pdf.setFont("helvetica", "normal");
                    });

                    // Horizontal line
                    pdf.setDrawColor(230);
                    pdf.line(margin, yPos + rowHeight, pageWidth - margin, yPos + rowHeight);

                    yPos += rowHeight;
                });
                yPos += 10; // Spacing after table
            }

            // 4. Meeting Summary Table
            // Use fullData or filtered fullData if necessary
            const meetingData = startDate && endDate ? fullData : filterDataByPeriod(fullData, 'mes');
            if (meetingData && meetingData.length > 0) {
                // Sort by date ascending for the list
                const sortedMeetings = [...meetingData].sort((a, b) => a.fullDate.localeCompare(b.fullDate));

                checkPageBreak(30); // Ensure header fits
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(12);
                pdf.setTextColor(0);
                pdf.text("Resumo por Reunião", margin, yPos);
                yPos += 6;

                // Table Header
                const summaryCols = [
                    { title: "Data", width: 30 },
                    { title: "Presencial", width: 25 },
                    { title: "Zoom", width: 25 },
                    { title: "Visitantes", width: 25 },
                    { title: "Faltantes", width: 25 },
                    { title: "Total Geral", width: 30 }
                ];

                const summaryRowHeight = 7;

                pdf.setFontSize(9);
                pdf.setFillColor(230, 230, 230);
                pdf.rect(margin, yPos, pageWidth - (margin * 2), summaryRowHeight, 'F');

                let currentX = margin;
                summaryCols.forEach(col => {
                    pdf.text(col.title, currentX + 2, yPos + 5);
                    currentX += col.width;
                });
                yPos += summaryRowHeight;

                pdf.setFont("helvetica", "normal");

                sortedMeetings.forEach((m, idx) => {
                    checkPageBreak(summaryRowHeight);
                    if (idx % 2 === 1) {
                        pdf.setFillColor(250, 250, 250);
                        pdf.rect(margin, yPos, pageWidth - (margin * 2), summaryRowHeight, 'F');
                    }

                    currentX = margin;

                    // Date
                    pdf.text(new Date(m.fullDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }), currentX + 2, yPos + 5);
                    currentX += 30;

                    // Presencial
                    pdf.text(m.presencial.toString(), currentX + 2, yPos + 5);
                    currentX += 25;

                    // Zoom
                    pdf.text(m.zoom.toString(), currentX + 2, yPos + 5);
                    currentX += 25;

                    // Visitantes
                    pdf.text(m.visitantes.toString(), currentX + 2, yPos + 5);
                    currentX += 25;

                    // Faltantes
                    pdf.text(m.faltantes.toString(), currentX + 2, yPos + 5);
                    currentX += 25;

                    // Total
                    // Recalculate total if needed or use total_geral (but detailed summary usually implies P+Z+V)
                    const total = (m.presencial + m.zoom + m.visitantes);
                    pdf.font = "helvetica-bold";
                    pdf.text(total.toString(), currentX + 2, yPos + 5);
                    pdf.font = "helvetica-normal";

                    pdf.setDrawColor(240);
                    pdf.line(margin, yPos + summaryRowHeight, pageWidth - margin, yPos + summaryRowHeight);

                    yPos += summaryRowHeight;
                });
                yPos += 10;
            }


            // 5. Charts
            if (trendRef.current && compRef.current) {
                checkPageBreak(80);

                pdf.setFontSize(14);
                pdf.setTextColor(0);
                pdf.setFont("helvetica", "bold");
                pdf.text("Gráficos de Análise", margin, yPos);
                yPos += 10;

                const addChart = (ref) => {
                    const canvas = ref.current.canvas;
                    if (canvas) {
                        // High quality export
                        const imgData = canvas.toDataURL('image/png', 1.0);
                        const imgWidth = pageWidth - (margin * 2); // Full page width
                        // Calculate proportional height
                        const imgHeight = (canvas.height * imgWidth) / canvas.width;

                        checkPageBreak(imgHeight + 10);

                        pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
                        yPos += imgHeight + 10;
                    }
                };

                addChart(trendRef);
                addChart(compRef);
            }

            pdf.save(`Relatorio_Assistencia_Detalhado_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error('PDF Generation Error:', error);
            alert('Não foi possível gerar o arquivo PDF. Tente novamente.');
        }
    };

    // --- Excel Export (Detailed) ---
    const handleExport = async () => {
        const start = startDate || initialStart;
        const end = endDate || initialEnd;

        const res = await fetch(`/api/admin/relatorios/assistencia/matriz?startDate=${start}&endDate=${end}`);
        if (!res.ok) {
            alert("Erro ao buscar dados para exportação.");
            return;
        }
        const { meetings, rows } = await res.json();

        // Build Sheets
        const wb = XLSX.utils.book_new();

        // Calculate Specific Totals
        const mediaTotalGeral = calculateTotalAverage(startDate && endDate ? fullData : filterDataByPeriod(fullData, 'mes'), 'todos');
        const mediaTotalMeio = calculateTotalAverage(startDate && endDate ? fullData : filterDataByPeriod(fullData, 'mes'), 'meio');
        const mediaTotalFim = calculateTotalAverage(startDate && endDate ? fullData : filterDataByPeriod(fullData, 'mes'), 'fim');

        // 1. Matriz Sheet
        const headerRow = ["Publicador", ...meetings.map(m => m.date)];
        const dataRows = rows.map(r => {
            const row = [r.shortName || r.name];
            meetings.forEach(m => {
                row.push(r.attendance[m.id] === 'Presencial' ? 'P' : r.attendance[m.id] === 'Zoom' ? 'Z' : 'F');
            });
            return row;
        });

        // Add KPIs at top
        const wsData = [
            ["Relatório de Assistência Detalhado"],
            [`Período: ${start} a ${end}`],
            [""],
            ["RESUMO GERAL"],
            [`Média Total (Geral)`, mediaTotalGeral],
            [`Média Total (Meio de Semana)`, mediaTotalMeio],
            [`Média Total (Final de Semana)`, mediaTotalFim],
            ["Média Presencial", averages.presencial],
            ["Média Zoom", averages.zoom],
            ["Média Visitantes", averages.visitantes],
            ["Média Faltantes", averages.faltantes],
            [""],
            headerRow,
            ...dataRows,
            [""],
            ["RESUMO POR REUNIÃO"],
            ["Data", "Presencial", "Zoom", "Visitantes", "Faltantes", "Total Geral"]
        ];

        // Add Meeting Summary Table
        const meetingData = startDate && endDate ? fullData : filterDataByPeriod(fullData, 'mes');
        // Sort
        const sortedMeetings = [...(meetingData || [])].sort((a, b) => a.fullDate.localeCompare(b.fullDate));

        sortedMeetings.forEach(m => {
            wsData.push([
                new Date(m.fullDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
                m.presencial,
                m.zoom,
                m.visitantes,
                m.faltantes,
                (m.presencial + m.zoom + m.visitantes)
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Detalhado");

        XLSX.writeFile(wb, `Relatorio_Assistencia_Detalhado_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const filterDataByPeriod = (data, period) => {
        if (!data || data.length === 0) return [];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        return data.filter(item => {
            if (!item.fullDate) return false;
            // Parse Date manually to avoid Timezone issues (YYYY-MM-DD)
            const parts = item.fullDate.substring(0, 10).split('-');
            const itemYear = parseInt(parts[0], 10);
            const itemMonth = parseInt(parts[1], 10) - 1; // 0-indexed
            if (itemYear !== currentYear) return false;
            switch (period) {
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

    const calculateTotalAverage = (dataSet, filterType) => {
        if (!dataSet || dataSet.length === 0) return 0;

        // Helper to get day of week safe from timezone issues
        const getSafeDay = (dateStr) => {
            // dateStr can be YYYY-MM-DD or ISO String
            if (!dateStr) return -1;
            const iso = typeof dateStr === 'string' ? dateStr.substring(0, 10) : new Date(dateStr).toISOString().substring(0, 10);
            const parts = iso.split('-');
            // Create date at noon to avoid timezone shifts to previous day
            const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
            return date.getDay();
        };

        let filteredData = dataSet;

        if (filterType === 'meio') {
            // Monday=1 to Friday=5
            filteredData = dataSet.filter(d => {
                const day = getSafeDay(d.fullDate); // 0 is Sunday
                return day >= 1 && day <= 5;
            });
        } else if (filterType === 'fim') {
            // Saturday=6, Sunday=0
            filteredData = dataSet.filter(d => {
                const day = getSafeDay(d.fullDate);
                return day === 0 || day === 6;
            });
        }

        if (filteredData.length === 0) return 0;

        const sum = filteredData.reduce((acc, curr) => acc + (curr.presencial || 0) + (curr.zoom || 0) + (curr.visitantes || 0), 0);
        return Math.round(sum / filteredData.length);
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
                <div className="flex flex-col gap-6 mb-8 mt-4 print:hidden">
                    {/* Header with Back Button */}
                    <div className="flex items-center gap-4">
                        <Link href="/admin/relatorios">
                            <Button variant="ghost" size="icon" className="shrink-0 text-gray-700 hover:text-gray-900 hover:bg-gray-100">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Relatório de Assistência</h1>
                            <p className="text-gray-700">Análise de assistência às reuniões.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-end">
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
                        <div className="flex flex-row gap-2 flex-wrap justify-center sm:justify-start">
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
                </div>

                {/* KPI CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                    {/* New Card: Média Total */}
                    <Card className="border-l-4 border-l-gray-600 shadow-sm relative overflow-visible">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-bold text-gray-700">Média Total</CardTitle>
                                <div className="p-1 rounded bg-gray-100">
                                    <Calculator className="w-4 h-4 text-gray-600" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-900 mb-1">
                                {calculateTotalAverage(
                                    startDate && endDate ? fullData : filterDataByPeriod(fullData, 'mes'),
                                    totalTypeFilter
                                )}
                            </div>
                            <select
                                value={totalTypeFilter}
                                onChange={(e) => setTotalTypeFilter(e.target.value)}
                                className="text-xs w-full bg-gray-50 border border-gray-200 rounded px-1 py-0.5 outline-none text-gray-600 focus:ring-1 focus:ring-gray-300"
                            >
                                <option value="todos">Todas</option>
                                <option value="meio">Meio de Semana</option>
                                <option value="fim">Fim de Semana</option>
                            </select>
                        </CardContent>
                    </Card>

                    <Card
                        className="border-l-4 border-l-blue-500 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleCardClick('presencial')}
                    >
                        <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-bold text-gray-700">Média Presencial</CardTitle><Users className="w-4 h-4 text-blue-500" /></div></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-gray-900">{averages.presencial}</div><p className="text-xs font-medium text-gray-600">Publicadores no Salão</p></CardContent>
                    </Card>
                    <Card
                        className="border-l-4 border-l-purple-500 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleCardClick('zoom')}
                    >
                        <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-bold text-gray-700">Média Zoom</CardTitle><Video className="w-4 h-4 text-purple-500" /></div></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-gray-900">{averages.zoom}</div><p className="text-xs font-medium text-gray-600">Conectados online</p></CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-green-500 shadow-sm opacity-80">
                        <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-bold text-gray-700">Média Visitantes</CardTitle><Users className="w-4 h-4 text-green-500" /></div></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-gray-900">{averages.visitantes}</div><p className="text-xs font-medium text-gray-600">Assistência Externa</p></CardContent>
                    </Card>
                    <Card
                        className="border-l-4 border-l-red-500 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleCardClick('faltantes')}
                    >
                        <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-bold text-gray-700">Média Faltantes</CardTitle><UserMinus className="w-4 h-4 text-red-500" /></div></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-gray-900">{averages.faltantes}</div><p className="text-xs font-medium text-gray-600">Não compareceram</p></CardContent>
                    </Card>
                </div>

                <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                    <DialogContent className="bg-white max-w-md max-h-[80vh] overflow-y-auto text-gray-700">
                        <DialogHeader>
                            <DialogTitle>Detalhamento: {detailMetric === 'presencial' ? 'Presencial' : detailMetric === 'zoom' ? 'Zoom' : 'Faltantes'}</DialogTitle>
                            <DialogDescription>
                                {detailMetric === 'faltantes'
                                    ? 'Ranking de faltas no período selecionado.'
                                    : 'Ranking de frequência no período selecionado.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            {detailLoading ? (
                                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-purple-600" /></div>
                            ) : detailData.length === 0 ? (
                                <div className="text-center text-gray-500 py-4">Nenhum registro encontrado.</div>
                            ) : (
                                <div className="space-y-2">
                                    {detailData.map((item, index) => (
                                        <div key={index} className="flex justify-between items-center p-2 rounded bg-gray-50 border border-gray-100">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200 text-gray-600'}`}>
                                                    {index + 1}º
                                                </div>
                                                <span className="font-medium text-gray-900">{item.name}</span>
                                            </div>
                                            <span className="font-bold text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200 text-sm">
                                                {item.value} {detailMetric === 'faltantes' ? 'faltas' : 'vezes'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

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
