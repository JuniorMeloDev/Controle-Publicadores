'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Loader2, Search, Filter, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { StatusToast } from '@/app/components/ui/status-toast';

const MONTHS = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export default function ReunioesPage() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
  // Filters
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [year, setYear] = useState(currentYear.toString());
  const [month, setMonth] = useState(currentMonth.toString());

  async function fetchMeetings() {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/reunioes?year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        // Sort ascending by date
        data.sort((a, b) => new Date(a.data) - new Date(b.data));
        setMeetings(data);
      }
    } catch (error) {
      console.error('Erro ao buscar reuniões:', error);
      setToast({ message: 'Erro ao buscar reuniões.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMeetings();
  }, [year, month]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <StatusToast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

        {/* Header */}
        <div className="flex flex-col items-center justify-center gap-4 text-center">
           <div>
             <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Reuniões</h1>
             <p className="text-gray-500">Visualize e gerencie as reuniões e assistências.</p>
           </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
                <Label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Ano</Label>
                <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="w-32 bg-white border-gray-300 text-gray-900 font-medium">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Mês</Label>
                <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="w-40 bg-white border-gray-300 text-gray-900 font-medium">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {MONTHS.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex-1"></div>
            {/* <Button variant="outline" onClick={fetchMeetings} className="gap-2">
                <Filter className="w-4 h-4" /> Atualizar
            </Button> */}
        </div>

        {/* List View */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3">Data</th>
                            <th className="px-6 py-3">Dia da Semana</th>
                            <th className="px-6 py-3">Tipo</th>
                            <th className="px-6 py-3 text-center">Presencial</th>
                            <th className="px-6 py-3 text-center">Zoom</th>
                            <th className="px-6 py-3 text-center">Visitantes</th>
                            <th className="px-6 py-3 text-center">Total</th>
                            <th className="px-6 py-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                             <tr><td colSpan="7" className="p-8 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                        ) : meetings.length === 0 ? (
                             <tr><td colSpan="7" className="p-8 text-center text-gray-500">Nenhuma reunião encontrada para este período.</td></tr>
                        ) : (
                            meetings.map((meeting) => (
                                <tr key={meeting.id} 
                                    className={`transition-colors group relative ${meeting.cancelado ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}
                                >
                                    <td className={`px-6 py-3 font-medium border-l-4 ${
                                        meeting.cancelado 
                                            ? 'text-gray-400 border-red-300 line-through' 
                                            : 'text-gray-900 border-transparent hover:border-purple-500'
                                    }`}>
                                        {meeting.data_formatada}
                                    </td>
                                    <td className={`px-6 py-3 capitalize ${meeting.cancelado ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                                        {new Date(meeting.data).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' })}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
                                            meeting.cancelado
                                                ? 'bg-gray-100 text-gray-500 border-gray-200 line-through'
                                                : meeting.tipo === 'Meio de Semana' 
                                                    ? 'bg-blue-50 text-blue-700 border-blue-100' 
                                                    : meeting.tipo === 'Especial'
                                                    ? 'bg-orange-50 text-orange-700 border-orange-100'
                                                    : 'bg-purple-50 text-purple-700 border-purple-100'
                                        }`}>
                                            {meeting.tipo}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-center text-gray-600">{meeting.cancelado ? '-' : (meeting.presencial || '-')}</td>
                                    <td className="px-6 py-3 text-center text-gray-600">{meeting.cancelado ? '-' : (meeting.zoom || '-')}</td>
                                    <td className="px-6 py-3 text-center text-gray-600">{meeting.cancelado ? '-' : (meeting.visitantes || '-')}</td>
                                    <td className="px-6 py-3 text-center font-bold text-gray-900">{meeting.cancelado ? '-' : (meeting.total || '-')}</td>
                                    <td className="px-6 py-3 text-right">
                                        {meeting.cancelado ? (
                                            <div className="relative inline-block">
                                                <span className="cursor-help flex items-center justify-end gap-1 text-xs font-medium text-red-600 italic px-3 py-2 bg-red-100/50 rounded-md border border-red-200">
                                                    <AlertCircle className="w-3 h-3" /> Evento Especial
                                                </span>
                                                {/* Custom Tooltip */}
                                                <div className="absolute bottom-full right-0 mb-2 w-max max-w-xs z-50 hidden group-hover:block animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="bg-gray-900 text-white text-xs rounded-md py-2 px-3 shadow-xl relative">
                                                        <p className="font-semibold mb-0.5">Reunião Cancelada</p>
                                                        <p className="opacity-90 font-light">{meeting.motivo_cancelamento}</p>
                                                        {/* Arrow */}
                                                        <div className="absolute top-full right-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <Link href={`/admin/reunioes/${meeting.id}`}>
                                                <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 cursor-pointer">
                                                    Gerenciar
                                                </Button>
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
