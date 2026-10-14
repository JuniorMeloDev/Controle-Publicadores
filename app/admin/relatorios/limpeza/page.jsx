'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Loader2, Printer, ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';

const subscribe = () => () => {};
const formatReportDate = value => new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
const formatDate = value => formatReportDate(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

function CleaningSchedule({ items, period }) {
    return <section className="cleaning-report">
        <header className="cleaning-report-header"><h1>Programação de Limpeza</h1><p>Congregação {process.env.NEXT_PUBLIC_NOME_CONGREGACAO || 'Praia dos Corais'}</p></header>
        <h2 className="cleaning-report-period">{period}</h2>
        <table className="cleaning-report-table">
            <colgroup><col style={{ width: '14%' }} /><col style={{ width: '50%' }} /><col style={{ width: '14%' }} /><col style={{ width: '22%' }} /></colgroup>
            <thead><tr><th>Data</th><th>Tarefas</th><th>Grupo</th><th>Responsáveis</th></tr></thead>
            <tbody>{items.map(item => <tr key={item.id}>
                <td className="cleaning-date"><span>{formatReportDate(item.data).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' })}</span><strong>{formatDate(item.data)}</strong></td>
                <td className="cleaning-tasks">{item.tarefas}</td>
                <td className="cleaning-group">{item.grupo}</td>
                <td className="cleaning-responsibles">{item.responsaveis?.trim() || '—'}</td>
            </tr>)}{!items.length && <tr><td colSpan={4} className="cleaning-empty">Nenhuma programação encontrada para este período.</td></tr>}</tbody>
        </table>
    </section>;
}

export default function CleaningReportPage() {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const portalReady = useSyncExternalStore(subscribe, () => true, () => false);

    // Filters
    const getCurrentMonthFirstDay = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}-01`;
    };

    const [startDate, setStartDate] = useState(getCurrentMonthFirstDay());
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        setLoading(true);
        try {
            let url = `/api/admin/limpeza?start=${startDate}`;
            if (endDate) url += `&end=${endDate}`;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                // The calendar API includes meetings that do not have a cleaning assignment yet.
                setItems(data.filter(item => item.id != null));
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

    const currentMonthName = endDate
        ? `${startDate ? formatDate(startDate) : 'Início'} a ${formatDate(endDate)}`
        : startDate ? formatReportDate(startDate).toLocaleString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).toUpperCase() : 'PERÍODO SELECIONADO';

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="print:hidden space-y-6">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/relatorios">
                            <Button variant="ghost" size="icon" className="shrink-0 text-gray-700 hover:text-gray-900 hover:bg-gray-100">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Programação de Limpeza</h1>
                            <p className="text-sm text-gray-600">Visualizar e imprimir a escala de limpeza.</p>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                        <div>
                            <Label className="text-xs font-bold text-gray-900 mb-1.5 block">Data Inicial</Label>
                            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-xs font-bold text-gray-900 mb-1.5 block">Data Final</Label>
                            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                        <Button onClick={fetchItems} className="bg-purple-600 hover:bg-purple-700 text-white">
                            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                        </Button>
                        <div className="flex-1 text-right">
                            <Button onClick={handlePrint} disabled={loading || !items.length} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                                <Printer className="w-4 h-4" /> Imprimir
                            </Button>
                        </div>
                    </div>
                </div>

                <CleaningSchedule items={items} period={currentMonthName} />
                {portalReady && createPortal(<div id="cleaning-print-root"><CleaningSchedule items={items} period={currentMonthName} /></div>, document.body)}

                <style jsx global>{`
                    #cleaning-print-root { display: none; }
                    .cleaning-report { background: #fff; color: #172554; border: 1px solid #cbd5e1; border-radius: 10px; font-family: Arial, Helvetica, sans-serif; }
                    .cleaning-report-header { padding: 22px 24px; text-align: center; background: #eff6ff; border-bottom: 2px solid #4472c4; border-radius: 10px 10px 0 0; }
                    .cleaning-report-header h1 { margin: 0; font-size: 25px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #23477d; }
                    .cleaning-report-header p { margin: 6px 0 0; font-size: 14px; color: #475569; }
                    .cleaning-report-period { margin: 0; padding: 16px; font-size: 16px; font-weight: 700; text-align: center; color: #23477d; }
                    .cleaning-report-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13px; color: #111827; }
                    .cleaning-report-table th, .cleaning-report-table td { border: 1px solid #94a3b8; padding: 12px 10px; overflow-wrap: anywhere; }
                    .cleaning-report-table th { background: #eff6ff; color: #23477d; text-align: center; font-size: 12px; text-transform: uppercase; }
                    .cleaning-date, .cleaning-group { text-align: center; vertical-align: middle; }
                    .cleaning-date span { display: block; margin-bottom: 4px; text-transform: capitalize; font-size: 12px; }
                    .cleaning-date strong { display: block; }
                    .cleaning-group { font-weight: 700; text-transform: uppercase; }
                    .cleaning-tasks, .cleaning-responsibles { white-space: pre-line; text-align: left; vertical-align: top; line-height: 1.5; }
                    .cleaning-responsibles { text-align: center; vertical-align: middle; }
                    .cleaning-empty { padding: 30px !important; text-align: center; color: #64748b; }
                    @media screen {
                        .dark .cleaning-report { background: #18181b; color: #f4f4f5; border-color: #3f3f46; }
                        .dark .cleaning-report-header { background: #172b46; border-bottom-color: #31577e; }
                        .dark .cleaning-report-header h1, .dark .cleaning-report-period { color: #93c5fd; }
                        .dark .cleaning-report-header p, .dark .cleaning-empty { color: #a1a1aa; }
                        .dark .cleaning-report-table { color: #f4f4f5; }
                        .dark .cleaning-report-table th { background: #172b46; color: #93c5fd; }
                        .dark .cleaning-report-table th, .dark .cleaning-report-table td { border-color: #52525b; }
                    }
                    @media print {
                        @page { size: A4 portrait; margin: 10mm; }
                        html, body { background: #fff !important; color: #111827 !important; color-scheme: light !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
                        body > :not(#cleaning-print-root) { display: none !important; }
                        #cleaning-print-root { display: block !important; position: static !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
                        #cleaning-print-root, #cleaning-print-root * { visibility: visible !important; box-shadow: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        #cleaning-print-root .cleaning-report { width: 100%; border: 0; border-radius: 0; background: #fff !important; color: #111827 !important; }
                        #cleaning-print-root .cleaning-report-header { padding: 5mm 4mm; border-radius: 0; background: #eff6ff !important; break-inside: avoid; break-after: avoid; }
                        #cleaning-print-root .cleaning-report-header h1 { font-size: 18pt; }
                        #cleaning-print-root .cleaning-report-header p { font-size: 10pt; }
                        #cleaning-print-root .cleaning-report-period { padding: 4mm 0; font-size: 11pt; break-after: avoid; }
                        #cleaning-print-root .cleaning-report-table { font-size: 10pt; }
                        #cleaning-print-root .cleaning-report-table th { font-size: 9pt; background: #eff6ff !important; }
                        #cleaning-print-root .cleaning-report-table th, #cleaning-print-root .cleaning-report-table td { padding: 3mm 2.5mm; border-color: #64748b; }
                        #cleaning-print-root .cleaning-date span { font-size: 9pt; }
                        #cleaning-print-root thead { display: table-header-group; }
                        #cleaning-print-root tr { break-inside: avoid; page-break-inside: avoid; }
                    }
                `}</style>
            </div>
        </DashboardLayout>
    );
}
