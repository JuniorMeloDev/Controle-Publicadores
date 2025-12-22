'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Loader2, Printer, ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';

export default function CleaningReportPage() {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);

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
                setItems(data);
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

    const currentMonthName = new Date(startDate).toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();

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
                            <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                                <Printer className="w-4 h-4" /> Imprimir
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Print Area */}
                <div id="print-area" className="bg-white print:p-0 min-h-[29.7cm] print:min-h-0 relative">

                    {/* Header matching the image */}
                    <div className="bg-[#6B9BD1] text-white p-8 text-center mb-8 print:mb-6 rounded-t-lg print:rounded-none">
                        <div className="flex justify-center items-center gap-4 mb-2">
                            {/* Icon placeholder if needed, or just text */}
                            {/* <Brush className="w-10 h-10 text-white" /> */}
                        </div>
                        <h1 className="text-3xl font-bold uppercase tracking-wide mb-1">Programação de Limpeza</h1>
                        <p className="text-lg font-light">Congregação {process.env.NEXT_PUBLIC_NOME_CONGREGACAO || 'Congregação'}</p>
                    </div>

                    <div className="px-8 pb-8 print:px-0 print:pb-0">
                        <h2 className="text-xl font-bold text-blue-600 text-center mb-6 uppercase">{currentMonthName}</h2>

                        <table className="w-full border-collapse border border-gray-400">
                            <thead>
                                <tr className="bg-white text-[#4472C4] uppercase text-sm font-bold text-center">
                                    <th className="border border-black p-3 w-32">Data</th>
                                    <th className="border border-black p-3">Tarefas</th>
                                    <th className="border border-black p-3 w-40">Grupo Designado</th>
                                    <th className="border border-black p-3 w-48">Responsáveis</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm text-black">
                                {items.map((item) => (
                                    <tr key={item.id} className="text-center">
                                        <td className="border border-black p-3 font-bold align-middle">
                                            <div className="capitalize">{new Date(item.data).toLocaleDateString('pt-BR', { weekday: 'long' })}</div>
                                            <div>{new Date(item.data).toLocaleDateString('pt-BR')}</div>
                                        </td>
                                        <td className="border border-black p-3 text-left align-middle whitespace-pre-wrap leading-relaxed">
                                            {item.tarefas}
                                        </td>
                                        <td className="border border-black p-3 font-bold align-middle uppercase">
                                            {item.grupo}
                                        </td>
                                        <td className="border border-black p-3 align-middle">
                                            {item.responsaveis}
                                        </td>
                                    </tr>
                                ))}
                                {items.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={4} className="border border-black p-8 text-center text-gray-400">
                                            Nenhuma programação encontrada para este período.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <style jsx global>{`
                @media print {
                    @page { margin: 1cm; size: A4; }
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
                    /* Ensure background colors print */
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>
            </div>
        </DashboardLayout>
    );
}
