'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Loader2, Search, Filter, AlertCircle, Plus, Trash2, Calendar, X } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { StatusToast } from '@/app/components/ui/status-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/app/components/ui/dialog';

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

    // Estados para a Reunião Personalizada/Avulsa
    const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
    const [customDate, setCustomDate] = useState('');
    const [customType, setCustomType] = useState('');
    const [isCreatingCustom, setIsCreatingCustom] = useState(false);

    // Múltipla seleção e edição
    const [selectedMeetings, setSelectedMeetings] = useState(new Set());
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isEditDateModalOpen, setIsEditDateModalOpen] = useState(false);
    const [editDateValue, setEditDateValue] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchMeetings = useCallback(async () => {
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
    }, [year, month]);

    useEffect(() => {
        fetchMeetings();
        setSelectedMeetings(new Set()); // Limpa seleção ao trocar mês/ano
    }, [fetchMeetings]);

    const toggleMeetingSelection = (id) => {
        const newSelected = new Set(selectedMeetings);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedMeetings(newSelected);
    };

    const selectAllVisible = () => {
        if (selectedMeetings.size === meetings.filter(m => !m.cancelado).length && selectedMeetings.size > 0) {
            setSelectedMeetings(new Set());
        } else {
            setSelectedMeetings(new Set(meetings.filter(m => !m.cancelado).map(m => m.id)));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedMeetings.size === 0) return;
        
        setIsProcessing(true);
        try {
            const ids = Array.from(selectedMeetings);
            const res = await fetch('/api/admin/reunioes/deletar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });

            if (res.ok) {
                setToast({ message: `${ids.length} reunião(ões) deletada(s) com sucesso!`, type: 'success' });
                setSelectedMeetings(new Set());
                setIsDeleteConfirmOpen(false);
                fetchMeetings();
            } else {
                const errorData = await res.json();
                setToast({ message: errorData.message || 'Erro ao deletar reuniões.', type: 'error' });
            }
        } catch (error) {
            console.error('Erro:', error);
            setToast({ message: 'Erro interno ao deletar reuniões.', type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEditDate = async () => {
        if (selectedMeetings.size !== 1 || !editDateValue) {
            setToast({ message: 'Selecione uma reunião e uma data válida.', type: 'error' });
            return;
        }

        setIsProcessing(true);
        try {
            const id = Array.from(selectedMeetings)[0];
            const res = await fetch('/api/admin/reunioes/editar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, nova_data: editDateValue })
            });

            if (res.ok) {
                setToast({ message: 'Data da reunião alterada com sucesso!', type: 'success' });
                setSelectedMeetings(new Set());
                setIsEditDateModalOpen(false);
                setEditDateValue('');
                fetchMeetings();
            } else {
                const errorData = await res.json();
                setToast({ message: errorData.message || 'Erro ao editar reunião.', type: 'error' });
            }
        } catch (error) {
            console.error('Erro:', error);
            setToast({ message: 'Erro interno ao editar reunião.', type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRemoveSpecialEvent = async (meeting) => {
        setIsProcessing(true);
        try {
            const payload = meeting.id ? { id: meeting.id } : { data: meeting.data };
            const res = await fetch('/api/admin/reunioes/remover-evento-especial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setToast({ message: 'Restrição removida com sucesso!', type: 'success' });
                fetchMeetings();
            } else {
                const errorData = await res.json();
                setToast({ message: errorData.message || 'Erro ao remover restrição.', type: 'error' });
            }
        } catch (error) {
            console.error('Erro:', error);
            setToast({ message: 'Erro interno ao remover restrição.', type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    // Função para criar a reunião avulsa
    const getTypeClasses = (meeting) => {
        if (meeting.cancelado) {
            return 'bg-gray-100 text-gray-500 border-gray-200 line-through';
        }

        if (meeting.tipo === 'Meio de Semana') {
            return 'bg-blue-50 text-blue-700 border-blue-100';
        }

        if (meeting.tipo === 'Especial' || meeting.tipo !== 'Fim de Semana') {
            return 'bg-orange-50 text-orange-700 border-orange-100';
        }

        return 'bg-purple-50 text-purple-700 border-purple-100';
    };

    const getWeekdayLabel = (meeting) => {
        return new Date(meeting.data).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
    };

    async function handleCreateCustom() {
        if (!customDate || !customType) {
            setToast({ message: 'Preencha a data e o tipo/nome do evento.', type: 'error' });
            return;
        }

        setIsCreatingCustom(true);
        try {
            const res = await fetch('/api/admin/reunioes/gerar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_custom',
                    data: customDate,
                    tipo: customType
                })
            });

            if (res.ok) {
                setToast({ message: 'Reunião avulsa criada com sucesso!', type: 'success' });
                setIsCustomModalOpen(false);
                setCustomDate('');
                setCustomType('');
                fetchMeetings(); // Atualiza a lista
            } else {
                const errorData = await res.json();
                setToast({ message: errorData.message || 'Erro ao criar reunião.', type: 'error' });
            }
        } catch (error) {
            console.error('Erro:', error);
            setToast({ message: 'Erro interno ao criar reunião.', type: 'error' });
        } finally {
            setIsCreatingCustom(false);
        }
    }

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                <StatusToast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

                {/* Header com botão de Nova Reunião */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Reuniões</h1>
                        <p className="text-gray-500">Visualize e gerencie as reuniões e assistências.</p>
                    </div>

                    {/* Modal para Reunião Avulsa */}
                    <Dialog open={isCustomModalOpen} onOpenChange={setIsCustomModalOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
                                <Plus className="w-4 h-4" /> Nova Reunião Avulsa
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Criar Reunião Personalizada</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Nome / Tipo do Evento</Label>
                                    <Input 
                                        placeholder="Ex: Visita Especial, Reunião Extra..." 
                                        value={customType}
                                        onChange={(e) => setCustomType(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Data da Reunião</Label>
                                    <Input 
                                        type="date" 
                                        value={customDate}
                                        onChange={(e) => setCustomDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCustomModalOpen(false)}>Cancelar</Button>
                                <Button 
                                    onClick={handleCreateCustom} 
                                    disabled={isCreatingCustom}
                                    className="bg-purple-600 hover:bg-purple-700 text-white w-32"
                                >
                                    {isCreatingCustom ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Reunião'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Barra de Seleção de Ações */}
                {selectedMeetings.size > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-purple-900">{selectedMeetings.size} reunião(ões) selecionada(s)</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {selectedMeetings.size === 1 && (
                                <Dialog open={isEditDateModalOpen} onOpenChange={setIsEditDateModalOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="gap-1 border-purple-300 text-purple-700 hover:bg-purple-100">
                                            <Calendar className="w-4 h-4" /> Editar Data
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Alterar Data da Reunião</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label>Nova Data</Label>
                                                <Input 
                                                    type="date" 
                                                    value={editDateValue}
                                                    onChange={(e) => setEditDateValue(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setIsEditDateModalOpen(false)}>Cancelar</Button>
                                            <Button 
                                                onClick={handleEditDate} 
                                                disabled={isProcessing}
                                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                            >
                                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                            <Button variant="destructive" size="sm" className="gap-1 bg-red-600 text-white hover:bg-red-700" onClick={() => setIsDeleteConfirmOpen(true)}>
                                <Trash2 className="w-4 h-4 text-white" /> Deletar ({selectedMeetings.size})
                            </Button>
                            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                                <DialogContent className="bg-white text-gray-900 shadow-xl rounded-2xl border border-gray-200">
                                    <DialogHeader>
                                        <DialogTitle>Confirmar Exclusão</DialogTitle>
                                    </DialogHeader>
                                    <p className="py-4 text-gray-700">
                                        Tem certeza que deseja deletar {selectedMeetings.size} reunião(ões)? Esta ação não pode ser desfeita.
                                    </p>
                                    <DialogFooter className="flex flex-wrap gap-2">
                                        <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancelar</Button>
                                        <Button 
                                            onClick={handleDeleteSelected} 
                                            disabled={isProcessing}
                                            className="bg-red-600 hover:bg-red-700 text-white"
                                        >
                                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deletar'}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setSelectedMeetings(new Set())}
                                className="gap-1 text-gray-600 hover:text-gray-900"
                            >
                                <X className="w-4 h-4" /> Limpar
                            </Button>
                        </div>
                    </div>
                )}

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
                </div>

                {/* List View */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 w-12">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedMeetings.size > 0 && selectedMeetings.size === meetings.filter(m => !m.cancelado).length}
                                            onChange={selectAllVisible}
                                            className="w-4 h-4 cursor-pointer"
                                        />
                                    </th>
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
                                    <tr><td colSpan="9" className="p-8 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                                ) : meetings.length === 0 ? (
                                    <tr><td colSpan="9" className="p-8 text-center text-gray-500">Nenhuma reunião encontrada para este período.</td></tr>
                                ) : (
                                    meetings.map((meeting) => (
                                        <tr key={meeting.id ?? `virtual-${meeting.data_formatada}`}
                                            className={`transition-colors group relative ${meeting.cancelado ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}
                                        >
                                            <td className="px-4 py-3">
                                                {!meeting.cancelado && (
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedMeetings.has(meeting.id)}
                                                        onChange={() => toggleMeetingSelection(meeting.id)}
                                                        className="w-4 h-4 cursor-pointer"
                                                    />
                                                )}
                                            </td>
                                            <td className={`px-6 py-3 font-medium border-l-4 ${meeting.cancelado
                                                    ? 'text-gray-400 border-red-300 line-through'
                                                    : 'text-gray-900 border-transparent hover:border-purple-500'
                                                }`}>
                                                {meeting.data_formatada}
                                            </td>
                                            <td className={`px-6 py-3 capitalize ${meeting.cancelado ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                                                {new Date(meeting.data).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' })}
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${meeting.cancelado
                                                        ? 'bg-gray-100 text-gray-500 border-gray-200 line-through'
                                                        : meeting.tipo === 'Meio de Semana'
                                                            ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                            : meeting.tipo === 'Especial' || meeting.tipo !== 'Fim de Semana' // Destaca os tipos customizados
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
                                                    <div className="flex flex-col gap-2 items-end">
                                                        <div className="relative inline-block">
                                                            <span className="cursor-help flex items-center justify-end gap-1 text-xs font-medium text-red-600 italic px-3 py-2 bg-red-100/50 rounded-md border border-red-200">
                                                                <AlertCircle className="w-3 h-3" /> Evento Especial
                                                            </span>
                                                            {/* Custom Tooltip */}
                                                            <div className="absolute bottom-full right-0 mb-2 w-max max-w-xs z-50 hidden group-hover:block animate-in fade-in zoom-in-95 duration-200">
                                                                <div className="bg-gray-900 text-white text-xs rounded-md py-2 px-3 shadow-xl relative">
                                                                    <p className="font-semibold mb-0.5">
                                                                        {meeting.virtual ? 'Evento Especial' : 'Reunião Cancelada'}
                                                                    </p>
                                                                    {meeting.evento_nome && (
                                                                        <p className="font-medium text-orange-300 mb-0.5">{meeting.evento_nome}</p>
                                                                    )}
                                                                    <p className="opacity-90 font-light">{meeting.motivo_cancelamento}</p>
                                                                    {/* Arrow */}
                                                                    <div className="absolute top-full right-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={() => handleRemoveSpecialEvent(meeting)}
                                                            disabled={isProcessing}
                                                            className="text-xs gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                                                        >
                                                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                                            Remover
                                                        </Button>
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

                    <div className="md:hidden divide-y divide-gray-100">
                        {loading ? (
                            <div className="p-8 text-center text-gray-500">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                            </div>
                        ) : meetings.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                Nenhuma reunião encontrada para este período.
                            </div>
                        ) : (
                            meetings.map((meeting) => (
                                <div
                                    key={meeting.id ?? `virtual-${meeting.data_formatada}`}
                                    className={`p-4 ${meeting.cancelado ? 'bg-red-50' : 'bg-white'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="pt-1">
                                            {!meeting.cancelado ? (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedMeetings.has(meeting.id)}
                                                    onChange={() => toggleMeetingSelection(meeting.id)}
                                                    className="w-4 h-4 cursor-pointer"
                                                />
                                            ) : (
                                                <div className="w-4 h-4" />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1 space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className={`text-base font-semibold ${meeting.cancelado ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                                        {meeting.data_formatada}
                                                    </div>
                                                    <div className={`text-sm capitalize ${meeting.cancelado ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                                                        {getWeekdayLabel(meeting)}
                                                    </div>
                                                </div>
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${getTypeClasses(meeting)}`}>
                                                    {meeting.tipo}
                                                </span>
                                            </div>

                                            {meeting.cancelado ? (
                                                <div className="space-y-3">
                                                    <div className="rounded-lg border border-red-200 bg-white/70 p-3">
                                                        <p className="flex items-center gap-1 text-xs font-semibold text-red-600 uppercase tracking-wide">
                                                            <AlertCircle className="w-3 h-3" /> Evento Especial
                                                        </p>
                                                        {meeting.evento_nome && (
                                                            <p className="mt-1 text-sm font-medium text-orange-700">{meeting.evento_nome}</p>
                                                        )}
                                                        <p className="mt-1 text-sm text-gray-700">{meeting.motivo_cancelamento}</p>
                                                    </div>

                                                    <div className="flex justify-end">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleRemoveSpecialEvent(meeting)}
                                                            disabled={isProcessing}
                                                            className="text-xs gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                                                        >
                                                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                                            Remover
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="rounded-lg bg-gray-50 p-3">
                                                            <div className="text-[11px] uppercase tracking-wide text-gray-500">Presencial</div>
                                                            <div className="mt-1 text-sm font-semibold text-gray-900">{meeting.presencial || '-'}</div>
                                                        </div>
                                                        <div className="rounded-lg bg-gray-50 p-3">
                                                            <div className="text-[11px] uppercase tracking-wide text-gray-500">Zoom</div>
                                                            <div className="mt-1 text-sm font-semibold text-gray-900">{meeting.zoom || '-'}</div>
                                                        </div>
                                                        <div className="rounded-lg bg-gray-50 p-3">
                                                            <div className="text-[11px] uppercase tracking-wide text-gray-500">Visitantes</div>
                                                            <div className="mt-1 text-sm font-semibold text-gray-900">{meeting.visitantes || '-'}</div>
                                                        </div>
                                                        <div className="rounded-lg bg-gray-50 p-3">
                                                            <div className="text-[11px] uppercase tracking-wide text-gray-500">Total</div>
                                                            <div className="mt-1 text-sm font-semibold text-gray-900">{meeting.total || '-'}</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-end">
                                                        <Link href={`/admin/reunioes/${meeting.id}`}>
                                                            <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 cursor-pointer">
                                                                Gerenciar
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
