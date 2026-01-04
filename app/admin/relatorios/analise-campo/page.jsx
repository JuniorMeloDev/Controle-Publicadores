'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Button } from '@/app/components/ui/button';
import { StatusToast } from '@/app/components/ui/status-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/app/components/ui/sheet";
import DetalhesPublicador from '@/app/componentes/DetalhesPublicador/DetalhesPublicador';
import { Loader2, ArrowLeft, Calendar, BarChart3, Users, Clock, BookOpen, Printer, Download, X } from 'lucide-react';

const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function AnaliseCampoPage() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);

    // Logic to determine default period (Previous Month + Service Year)
    const getDefaultPeriod = () => {
        const today = new Date();
        today.setMonth(today.getMonth() - 1); // Previous month

        const mIndex = today.getMonth();
        const year = today.getFullYear();

        const serviceYear = mIndex >= 8 ? year + 1 : year;
        return { mes: meses[mIndex], ano: serviceYear };
    };

    const defaultPeriod = getDefaultPeriod();

    // Filters
    const [selectedMes, setSelectedMes] = useState(defaultPeriod.mes);
    const [selectedAno, setSelectedAno] = useState(defaultPeriod.ano);
    const [tipoPioneiro, setTipoPioneiro] = useState('todos'); // todos, regular, auxiliar, publicador

    // Toast
    const [toast, setToast] = useState({ show: false, message: '', type: '' });

    // List Modal
    const [listModal, setListModal] = useState({ open: false, title: '', items: [] });

    // Details Sheet
    const [selectedPubId, setSelectedPubId] = useState(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const handlePubClick = (id) => {
        setSelectedPubId(id);
        setDetailsOpen(true);
    };

    const handleCloseDetails = () => {
        setDetailsOpen(false);
        setSelectedPubId(null);
    };

    const handleSaveDetails = ({ message, isError, keepOpen }) => {
        if (message) {
            setToast({ show: true, message, type: isError ? 'error' : 'success' });
        }
        if (!keepOpen) handleCloseDetails();
        // Refresh data if needed (optional, effectively refetch stats)
        fetchStats();
    };

    useEffect(() => {
        fetchStats();
    }, [selectedMes, selectedAno, tipoPioneiro]);

    const router = useRouter();

    useEffect(() => {
        // Check permission
        fetch('/api/usuario-atual')
            .then(res => res.json())
            .then(user => {
                if (!user.isAnciao) {
                    setToast({ show: true, message: 'Acesso negado. Apenas anciãos.', type: 'error' });
                    setTimeout(() => router.push('/admin/relatorios'), 1500);
                }
            })
            .catch(() => router.push('/admin/relatorios'));
    }, []);

    const handleExportExcel = () => {
        if (!data) return;

        // Format data for Excel
        const exportData = data.details.map(row => ({
            'Nome': row.nome_completo,
            'Grupo': row.nome_grupo || '-',
            'Horas': row.horas || 0,
            'Estudos': row.estudos_biblicos || 0,
            'Regular': row.is_regular ? 'Sim' : 'Não',
            'Auxiliar': row.pioneiro_auxiliar ? 'Sim' : 'Não',
            'Observações': row.observacoes || ''
        }));

        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);

        // Add summary rows at the bottom
        XLSX.utils.sheet_add_aoa(ws, [
            [],
            ['Resumo Geral'],
            ['Total Publicadores', data.totals.publicadores_reportaram],
            ['Total Horas', data.totals.horas],
            ['Total Estudos', data.totals.estudos],
            ['Média Horas', data.averages.horas_por_publicador],
            ['Irregulares', data.totals.irregulares],
            ['Inativos', data.totals.inativos]
        ], { origin: -1 });

        XLSX.utils.book_append_sheet(wb, ws, "Análise de Campo");

        // Download
        XLSX.writeFile(wb, `Analise_Campo_${selectedMes}_${selectedAno}.xlsx`);
    };

    const fetchStats = async () => {
        setLoading(true);

        try {
            const query = new URLSearchParams({
                mes: selectedMes,
                ano_servico: selectedAno,
                tipo_pioneiro: tipoPioneiro === 'todos' ? '' : tipoPioneiro
            });

            const res = await fetch(`/api/admin/relatorios/analise?${query.toString()}`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            } else {
                throw new Error('Falha ao carregar dados');
            }
        } catch (err) {
            setToast({ show: true, message: 'Erro ao carregar estatísticas.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // StatCard Component
    const StatCard = ({ title, value, icon: Icon, colorClass, onClick }) => (
        <div
            onClick={onClick}
            className={`bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between print:p-2 print:border print:shadow-none print:block print:text-center ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
        >
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1 print:text-[10px] print:mb-0">{title}</p>
                <h3 className="text-2xl font-bold text-gray-900 print:text-lg">{value}</h3>
            </div>
            <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10 print:hidden`}>
                <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
            </div>
        </div>
    );

    return (
        <DashboardLayout>
            {toast.show && <StatusToast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}

            <div className="max-w-6xl mx-auto space-y-8 printable-content" style={{ display: 'block' }}>
                {/* Header - Hidden on Print */}
                <div className="print:hidden">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <Link href="/admin/relatorios">
                                <Button variant="ghost" size="icon" className="shrink-0 text-gray-700 hover:text-gray-900 hover:bg-gray-100"><ArrowLeft className="w-5 h-5" /></Button>
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Análise de Campo</h1>
                                <p className="text-sm text-gray-500">Visão geral do desempenho da congregação</p>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-3">
                            {/* Filters Bar */}
                            <div className="bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0">
                                <select
                                    value={selectedMes}
                                    onChange={(e) => setSelectedMes(e.target.value)}
                                    className="border-none bg-transparent text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer py-1.5 px-3 hover:bg-gray-50 rounded-md transition-colors"
                                >
                                    {meses.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>

                                <div className="w-px h-6 bg-gray-200 hidden sm:block mx-1" />

                                <select
                                    value={selectedAno}
                                    onChange={(e) => setSelectedAno(e.target.value)}
                                    className="border-none bg-transparent text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer py-1.5 px-3 hover:bg-gray-50 rounded-md transition-colors"
                                >
                                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>

                                <div className="w-px h-6 bg-gray-200 hidden sm:block mx-1" />

                                <select
                                    value={tipoPioneiro}
                                    onChange={(e) => setTipoPioneiro(e.target.value)}
                                    className="border-none bg-transparent text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer py-1.5 px-3 hover:bg-gray-50 rounded-md transition-colors"
                                >
                                    <option value="todos">Todos os Publicadores</option>
                                    <option value="publicador">Publicadores</option>
                                    <option value="regular">Pioneiros Regulares</option>
                                    <option value="auxiliar">Pioneiros Auxiliares</option>
                                </select>
                            </div>

                            <div className="flex gap-2">
                                <Button onClick={handleExportExcel} variant="outline" className="flex-1 md:flex-none gap-2 text-green-700 border-green-200 hover:bg-green-50 shadow-sm">
                                    <Download className="w-4 h-4" />
                                    <span className="md:hidden lg:inline">Excel</span>
                                </Button>
                                <Button onClick={() => window.print()} className="flex-1 md:flex-none gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                                    <Printer className="w-4 h-4" />
                                    <span className="md:hidden lg:inline">Imprimir</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Print Header (Visible only when printing) */}
                <div className="hidden print:block mb-6 text-center">
                    <h1 className="text-2xl font-bold text-gray-900">Relatório de Análise de Campo</h1>
                    <p className="text-gray-600 mb-4">
                        {selectedMes} de {selectedAno} • Filtro: {
                            tipoPioneiro === 'todos' ? 'Todos os Publicadores' :
                                tipoPioneiro === 'regular' ? 'Pioneiros Regulares' :
                                    tipoPioneiro === 'auxiliar' ? 'Pioneiros Auxiliares' :
                                        'Publicadores (Excl. Pioneiros)'
                        }
                    </p>
                </div>

                {loading && !data ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-600 w-10 h-10" /></div>
                ) : data ? (
                    <>
                        {/* KPI Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 print:grid-cols-6 print:gap-2">
                            <StatCard
                                title="Relatórios"
                                value={data.totals.publicadores_reportaram}
                                icon={Users}
                                colorClass="text-blue-600 bg-blue-100"
                            />
                            <StatCard
                                title="Horas"
                                value={data.totals.horas.toLocaleString('pt-BR')}
                                icon={Clock}
                                colorClass="text-purple-600 bg-purple-100"
                            />
                            <StatCard
                                title="Estudos"
                                value={data.totals.estudos}
                                icon={BookOpen}
                                colorClass="text-pink-600 bg-pink-100"
                            />
                            <StatCard
                                title="Média"
                                value={data.averages.horas_por_publicador}
                                icon={BarChart3}
                                colorClass="text-green-600 bg-green-100"
                            />
                            {data.totals.irregulares > 0 && (
                                <StatCard
                                    title="Irregulares"
                                    value={data.totals.irregulares}
                                    icon={Users}
                                    colorClass="text-orange-600 bg-orange-100"
                                    onClick={() => setListModal({
                                        open: true,
                                        title: 'Publicadores Irregulares',
                                        items: data.lists?.irregulares || []
                                    })}
                                />
                            )}
                            {data.totals.inativos > 0 && (
                                <StatCard
                                    title="Inativos"
                                    value={data.totals.inativos}
                                    icon={Users}
                                    colorClass="text-red-600 bg-red-100"
                                    onClick={() => setListModal({
                                        open: true,
                                        title: 'Publicadores Inativos',
                                        items: data.lists?.inativos || []
                                    })}
                                />
                            )}
                        </div>

                        {/* Detailed Data Table */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h3 className="font-semibold text-gray-900">Detalhamento</h3>
                                <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                                    {data.details.length} registros
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-3 font-medium">Nome</th>
                                            <th className="px-6 py-3 font-medium">Grupo</th>
                                            <th className="px-6 py-3 font-medium text-center">Horas</th>
                                            <th className="px-6 py-3 font-medium text-center">Estudos</th>
                                            {(tipoPioneiro !== 'publicador' && tipoPioneiro !== 'auxiliar') && (
                                                <th className="px-6 py-3 font-medium text-center">Regular</th>
                                            )}
                                            {(tipoPioneiro !== 'publicador' && tipoPioneiro !== 'regular') && (
                                                <th className="px-6 py-3 font-medium text-center">Auxiliar</th>
                                            )}
                                            <th className="px-6 py-3 font-medium">Observações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {data.details.map((row) => (
                                            <tr
                                                key={row.id}
                                                className="hover:bg-gray-50 transition-colors cursor-pointer"
                                                onClick={() => handlePubClick(row.id)}
                                            >
                                                <td className="px-6 py-4 font-medium text-gray-900">{row.nome_completo}</td>
                                                <td className="px-6 py-4 text-gray-500">{row.nome_grupo || '-'}</td>
                                                <td className="px-6 py-4 text-center font-medium text-purple-700">{row.horas || 0}</td>
                                                <td className="px-6 py-4 text-center text-gray-700">{row.estudos_biblicos || 0}</td>
                                                {(tipoPioneiro !== 'publicador' && tipoPioneiro !== 'auxiliar') && (
                                                    <td className="px-6 py-4 text-center">
                                                        {row.is_regular ? (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                                                Sim
                                                            </span>
                                                        ) : <span className="text-gray-300">-</span>}
                                                    </td>
                                                )}
                                                {(tipoPioneiro !== 'publicador' && tipoPioneiro !== 'regular') && (
                                                    <td className="px-6 py-4 text-center">
                                                        {row.pioneiro_auxiliar ? (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                                Sim
                                                            </span>
                                                        ) : <span className="text-gray-300">-</span>}
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 text-gray-500 text-xs italic max-w-[200px] truncate" title={row.observacoes}>
                                                    {row.observacoes || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : null}

                <Dialog open={listModal.open} onOpenChange={(open) => setListModal(prev => ({ ...prev, open }))}>
                    <DialogContent className="max-w-md bg-white">
                        <DialogHeader>
                            <DialogTitle className="text-gray-900">{listModal.title}</DialogTitle>
                        </DialogHeader>
                        <div className="mt-4 max-h-[60vh] overflow-y-auto">
                            {listModal.items.length > 0 ? (
                                <ul className="divide-y divide-gray-100">
                                    {listModal.items.map((pub) => (
                                        <li key={pub.id} className="py-2 text-gray-700 font-medium">
                                            {pub.nome}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500">Nenhum registro encontrado.</p>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                <Sheet open={detailsOpen} onOpenChange={(open) => !open && handleCloseDetails()}>
                    <SheetContent side="right" className="w-full sm:max-w-lg md:max-w-xl lg:max-w-3xl p-0 border-l border-gray-200 bg-white focus:outline-none">
                        <SheetHeader className="sr-only">
                            <SheetTitle>Detalhes do Publicador</SheetTitle>
                            <SheetDescription>Edição de registros e atividades.</SheetDescription>
                        </SheetHeader>

                        <SheetClose
                            className="absolute right-4 top-4 rounded-sm opacity-100 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary z-50"
                            asChild
                        >
                            <button onClick={handleCloseDetails} aria-label="Fechar">
                                <X className="h-6 w-6 text-black" />
                            </button>
                        </SheetClose>

                        <div className="h-full w-full bg-white flex flex-col">
                            {selectedPubId && (
                                <DetalhesPublicador
                                    publicadorId={selectedPubId}
                                    onSaveSuccess={handleSaveDetails}
                                    onClose={handleCloseDetails}
                                    initialTab="atividades"
                                />
                            )}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </DashboardLayout>
    );
}
