'use client';

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { ChevronLeft, FileText, Download, Calendar, Filter, Loader2, CheckSquare, Square } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { generateLifeMinistryPDF } from '@/app/utils/generateLifeMinistryPDF';
import { generateS140TPDF } from '@/app/utils/generateS140TPDF';

export default function LifeMinistryExportPage() {
    const router = useRouter();
    const [meetings, setMeetings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Filters
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');

    const [isPreparingExport, setIsPreparingExport] = useState(false);

    useEffect(() => {
        fetchMeetings();
    }, []);

    const fetchMeetings = async () => {
        try {
            const res = await fetch('/api/admin/get-reunioes');
            if (res.ok) {
                const data = await res.json();
                setMeetings(data);
            }
        } catch (error) {
            console.error("Erro ao buscar reuniões:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredMeetings = useMemo(() => {
        return meetings
            .filter(m => {
                const date = m.dataSQL; // YYYY-MM-DD
                const [mYear, mMonth] = date.split('-');
                if (year && mYear !== year) return false;
                if (month && mMonth !== month) return false;
                return true;
            })
            .sort((a, b) => a.dataSQL.localeCompare(b.dataSQL));
    }, [meetings, month, year]);



    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (selectedIds.size === filteredMeetings.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredMeetings.map(m => m.id || m.dataSQL)));
        }
    };

    const fetchSelectedDetails = async () => {
        const results = [];
        const selectedMeetings = meetings
            .filter(m => selectedIds.has(m.id || m.dataSQL))
            .sort((a, b) => a.dataSQL.localeCompare(b.dataSQL));

        for (const m of selectedMeetings) {
            try {
                const res = await fetch(`/api/admin/get-meeting-details?date=${m.dataSQL}`);
                if (!res.ok) throw new Error(`Erro ${m.label}`);
                const data = await res.json();
                results.push(data);
            } catch (e) {
                console.error(e);
            }
        }
        return results;
    };

    const handleExportPDF = async () => {
        if (selectedIds.size === 0) return;
        setIsPreparingExport(true);
        try {
            const detailsList = await fetchSelectedDetails();
            if (detailsList.length === 0) return;

            let doc = null;
            detailsList.forEach((data) => {
                doc = generateLifeMinistryPDF(data.schedule, data.assignments, data.weekDescription, doc, false);
            });

            if (doc) {
                doc.save(`Designacoes_Vida_Ministerio_Lote.pdf`);
            }
        } catch (error) {
            console.error("Erro exportar PDF", error);
        } finally {
            setIsPreparingExport(false);
        }
    };

    const handleExportExcel = async () => {
        if (selectedIds.size === 0) return;
        setIsPreparingExport(true);
        try {
            const detailsList = await fetchSelectedDetails();
            if (detailsList.length === 0) return;

            const wb = XLSX.utils.book_new();

            detailsList.forEach(data => {
                const { schedule, assignments, weekDescription } = data;
                const rows = [];

                // Header
                rows.push(["Semana:", weekDescription]);
                rows.push(["Data", "Parte", "Designado"]);
                rows.push([]);

                const getName = (key) => assignments[key] || "---";

                // Opening
                rows.push(["19:30", "Presidente", assignments['presidente'] || '---']);
                rows.push(["", "Oração Inicial", assignments['oracao_inicial'] || '---']);
                rows.push(["", "Cântico Inicial", schedule.openingSong]);
                rows.push(["", "Comentários Iniciais", assignments['comentarios_iniciais'] || '---']);
                rows.push([]);

                // Treasures
                rows.push(["TESOUROS"]);
                schedule.treasures?.forEach((part, idx) => {
                    rows.push(["", part.title, getName(`tesouro_${idx}`)]);
                });
                rows.push([]);

                // Ministry
                rows.push(["MINISTÉRIO"]);
                schedule.ministry?.forEach((part, idx) => {
                    const isDiscurso = part.title.toLowerCase().includes('discurso');
                    if (isDiscurso) {
                        rows.push(["", part.title, getName(`ministerio_${idx}`)]);
                    } else {
                        rows.push(["", part.title, `Est: ${getName(`ministerio_${idx}_1`)}`]);
                        rows.push(["", "", `Ajud: ${getName(`ministerio_${idx}_2`)}`]);
                    }
                });
                rows.push([]);

                // Living
                rows.push(["VIDA CRISTÃ"]);
                rows.push(["", "Cântico do Meio", schedule.middleSong]);
                schedule.living?.forEach((part, idx) => {
                    const isBibleStudy = part.title.toLowerCase().includes('estudo bíblico');
                    if (isBibleStudy) {
                        rows.push(["", part.title, `Dirig: ${getName(`vida_${idx}_1`)}`]);
                        rows.push(["", "", `Leitor: ${getName(`vida_${idx}_2`)}`]);
                    } else {
                        rows.push(["", part.title, getName(`vida_${idx}`)]);
                    }
                });

                rows.push([]);
                rows.push(["", "Comentários Finais", assignments['comentarios_finais'] || '---']);
                rows.push(["", "Cântico Final", schedule.finalSong]);
                rows.push(["", "Oração Final", assignments['oracao_final'] || '---']);

                const ws = XLSX.utils.aoa_to_sheet(rows);
                const safeName = (weekDescription || "Semana").substring(0, 30).replace(/[:\/\\?*\[\]]/g, "");
                XLSX.utils.book_append_sheet(wb, ws, safeName);
            });

            XLSX.writeFile(wb, "Designacoes_Vida_Ministerio.xlsx");
        } catch (error) {
            console.error("Erro exportar Excel", error);
        } finally {
            setIsPreparingExport(false);
        }
    };

    const handleExportS140T = async () => {
        if (selectedIds.size === 0) return;
        setIsPreparingExport(true);
        try {
            const detailsList = await fetchSelectedDetails();
            if (detailsList.length === 0) return;
            generateS140TPDF(detailsList);
        } catch (error) {
            console.error("Erro exportar S-140-T", error);
        } finally {
            setIsPreparingExport(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Link href="/admin/relatorios" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <ChevronLeft className="w-6 h-6 text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <FileText className="text-indigo-600" />
                                Exportar Designações
                            </h1>
                            <p className="text-gray-500 text-sm">Vida e Ministério</p>
                        </div>
                    </div>
                </div>

                {/* Filters & Actions */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-3 w-full md:w-auto text-gray-500">
                        <Filter className="text-gray-400 w-5 h-5" />
                        <select value={year} onChange={e => setYear(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
                            <option value="">Todos os Anos</option>
                            {[2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select value={month} onChange={e => setMonth(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
                            <option value="">Todos os Meses</option>
                            {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                        </select>
                        {(year || month) && (
                            <button
                                onClick={() => { setYear(''); setMonth(''); }}
                                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium hover:underline transition-all"
                            >
                                Limpar
                            </button>
                        )}
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            disabled={selectedIds.size === 0 || isPreparingExport}
                            onClick={handleExportExcel}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPreparingExport ? <Loader2 className="animate-spin w-4 h-4" /> : <Download size={16} />}
                            Exportar Excel
                        </button>
                        <button
                            disabled={selectedIds.size === 0 || isPreparingExport}
                            onClick={handleExportPDF}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPreparingExport ? <Loader2 className="animate-spin w-4 h-4" /> : <FileText size={16} />}
                            Exportar PDF
                        </button>
                        <button
                            disabled={selectedIds.size === 0 || isPreparingExport}
                            onClick={handleExportS140T}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPreparingExport ? <Loader2 className="animate-spin w-4 h-4" /> : <FileText size={16} />}
                            Exportar S-140-T
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-4">
                        <button onClick={toggleAll} className="text-gray-500 hover:text-indigo-600">
                            {selectedIds.size > 0 && selectedIds.size === filteredMeetings.length ? <CheckSquare /> : <Square />}
                        </button>
                        <span className="text-sm font-semibold text-gray-700">
                            {selectedIds.size} selecionados
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="p-10 text-center flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>
                    ) : filteredMeetings.length === 0 ? (
                        <div className="p-10 text-center text-gray-500">Nenhuma reunião encontrada.</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredMeetings.map(m => (
                                <div key={m.dataSQL || m.id} onClick={() => toggleSelection(m.id || m.dataSQL)} className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-indigo-50 transition-colors ${selectedIds.has(m.id || m.dataSQL) ? 'bg-indigo-50/50' : ''}`}>
                                    <div className={selectedIds.has(m.id || m.dataSQL) ? 'text-indigo-600' : 'text-gray-300'}>
                                        {selectedIds.has(m.id || m.dataSQL) ? <CheckSquare /> : <Square />}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-gray-900">{m.label || m.descricao}</h3>
                                        <p className="text-sm text-gray-500 capitalize">
                                            {m.dataSQL ? new Date(m.dataSQL + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : m.dataSQL}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
