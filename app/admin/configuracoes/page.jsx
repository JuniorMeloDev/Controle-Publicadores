'use client';

import { DashboardLayout } from '@/app/components/DashboardLayout';
import { useState, useEffect } from 'react';
import { usePermissions } from '@/app/components/PermissionsContext';
import { isAllowed } from '@/app/lib/access-control';
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog";
import { Label } from "@/app/components/ui/label";
import { StatusToast } from "@/app/components/ui/status-toast";
import { Trash2, Calendar, Save, Plus, Loader2, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';

const WEEKDAYS = [
    { value: 'Segunda-feira', label: 'Segunda-feira' },
    { value: 'Terça-feira', label: 'Terça-feira' },
    { value: 'Quarta-feira', label: 'Quarta-feira' },
    { value: 'Quinta-feira', label: 'Quinta-feira' },
    { value: 'Sexta-feira', label: 'Sexta-feira' },
    { value: 'Sábado', label: 'Sábado' },
    { value: 'Domingo', label: 'Domingo' },
];

const EVENT_TYPES = [
    { value: 'Assembleia', label: 'Assembleia' },
    { value: 'Congresso', label: 'Congresso' },
    { value: 'Visita do Superintendente', label: 'Visita do Superintendente' },
    { value: 'Feriado', label: 'Feriado' },
    { value: 'Celebração', label: 'Celebração' },
    { value: 'Outro', label: 'Outro' },
];

export default function ConfiguracoesPage() {
    const { permissions } = usePermissions();
    const canEditConfig = isAllowed(permissions, 'configuracoes_editar', 'actions');
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState({ message: '', type: '' });
    
    // Meeting Days State
    const [midweekDay, setMidweekDay] = useState('');
    const [weekendDay, setWeekendDay] = useState('');

    // Events State
    const [events, setEvents] = useState([]);
    const [newEvent, setNewEvent] = useState({ date: '', name: '', type: 'Outro' });

    // Generation State
    const [genOpen, setGenOpen] = useState(false);
    const [genStep, setGenStep] = useState(1); // 1 = Select, 2 = Preview
    const [genPeriod, setGenPeriod] = useState('mensal');
    const [genLoading, setGenLoading] = useState(false);
    const [previewData, setPreviewData] = useState({ meetings: [], warnings: [] });
    
    // Result Modal State
    const [resultOpen, setResultOpen] = useState(false);
    const [resultData, setResultData] = useState({ success: true, message: '', details: [] });

    useEffect(() => {
        fetchData();
    }, [year]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/configuracoes?year=${year}`);
            if (res.ok) {
                const data = await res.json();
                setMidweekDay(data.config.dia_meio_semana || '');
                setWeekendDay(data.config.dia_fim_semana || '');
                setEvents(data.events || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveWeekdays = async () => {
        if (!canEditConfig) {
            setToast({ message: 'Você não tem permissão para editar configurações.', type: 'error' });
            return;
        }
        setSaving(true);
        try {
            await fetch('/api/admin/configuracoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_weekdays',
                    ano: year,
                    dia_meio_semana: midweekDay,
                    dia_fim_semana: weekendDay
                })
            });
            setToast({ message: 'Dias de reunião salvos com sucesso!', type: 'success' });
            setTimeout(() => setToast({ message: '', type: '' }), 3000);
        } catch (error) {
            console.error(error);
            setToast({ message: 'Erro ao salvar dias de reunião.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleAddEvent = async () => {
        if (!newEvent.date || !newEvent.name) return;
        if (!canEditConfig) {
            setToast({ message: 'Você não tem permissão para editar configurações.', type: 'error' });
            return;
        }
        try {
            const res = await fetch('/api/admin/configuracoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'add_event',
                    data: newEvent.date,
                    nome: newEvent.name,
                    tipo: newEvent.type,
                    ano: parseInt(newEvent.date.split('-')[0])
                })
            });
            if (res.ok) {
                const addedEvent = await res.json();
                if (addedEvent.ano === year) {
                    setEvents([...events, addedEvent].sort((a,b) => new Date(a.data) - new Date(b.data)));
                }
                setNewEvent({ date: '', name: '', type: 'Outro' });
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteEvent = async (id) => {
        if (!canEditConfig) {
            setToast({ message: 'Você não tem permissão para editar configurações.', type: 'error' });
            return;
        }
        if(!confirm('Tem certeza que deseja excluir este evento?')) return;
        try {
             await fetch('/api/admin/configuracoes', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ action: 'delete_event', id })
             });
             setEvents(events.filter(e => e.id !== id));
        } catch (error) {
            console.error(error);
        }
    };

    // GENERATION LOGIC
    const handlePreview = async () => {
        if (!canEditConfig) {
            setToast({ message: 'Você não tem permissão para editar configurações.', type: 'error' });
            return;
        }
        setGenLoading(true);
        try {
            const res = await fetch('/api/admin/reunioes/gerar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'preview', 
                    period: genPeriod, 
                    year: year 
                })
            });
            
            if(res.ok) {
                const data = await res.json();
                setPreviewData(data);
                setGenStep(2);
            } else {
                const err = await res.json();
                setToast({ message: err.message || 'Erro ao gerar prévia.', type: 'error' });
            }
        } catch (error) {
            console.error(error);
            setToast({ message: 'Erro de conexão.', type: 'error' });
        } finally {
            setGenLoading(false);
        }
    };

    const handleConfirmGeneration = async () => {
        if (!canEditConfig) {
            setToast({ message: 'Você não tem permissão para editar configurações.', type: 'error' });
            return;
        }
        setGenLoading(true);
        const toCreate = previewData.meetings.filter(m => !m.exists);
        
        if (toCreate.length === 0) {
             setGenLoading(false);
             setResultData({
                 success: true,
                 message: 'Nenhuma nova reunião para criar.',
                 details: ['Todas as reuniões do período já existem.']
             });
             setGenOpen(false);
             setResultOpen(true);
             return;
        }

        try {
            const res = await fetch('/api/admin/reunioes/gerar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'create', 
                    year: year,
                    options: { meetings_to_create: toCreate }
                })
            });
            
            const data = await res.json();
            
            if(res.ok) {
                setGenOpen(false);
                setGenStep(1);
                // Show success modal
                setResultData({
                    success: true,
                    message: data.message,
                    details: [`${toCreate.length} reuniões criadas com sucesso.`]
                });
                setResultOpen(true);
            } else {
                // Show error modal
                 setResultData({
                    success: false,
                    message: 'Erro ao criar reuniões',
                    details: [data.message || 'Erro desconhecido.']
                });
                setGenOpen(false);
                setResultOpen(true);
            }
        } catch (error) {
             setResultData({
                success: false,
                message: 'Erro de conexão',
                details: [error.message]
            });
            setGenOpen(false);
            setResultOpen(true);
        } finally {
            setGenLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
                {/* Header... (Same as before) */}
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Configurações Gerais</h1>
                        <p className="text-gray-500">Gerencie os dias de reunião e eventos especiais do calendário.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
                        <Label className="text-sm font-medium text-gray-700">Ano de Referência:</Label>
                        <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
                            <SelectTrigger className="w-24 border-none shadow-none focus:ring-0 bg-transparent h-8 p-0 px-2 font-bold text-lg text-purple-700">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[year - 1, year, year + 1, year + 2].map(y => (
                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* CARD 1: DIAS DE REUNIÃO */}
                        <Card className="border-gray-200 shadow-sm flex flex-col">
                            <CardHeader className="bg-gray-50/50 pb-4 border-b border-gray-100">
                                <CardTitle className="flex items-center gap-2 text-gray-900">
                                    <Calendar className="w-5 h-5 text-blue-600" />
                                    Dias de Reunião ({year})
                                </CardTitle>
                                <CardDescription className="text-gray-600">
                                    Defina em quais dias da semana ocorrem as reuniões regulares.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6 flex-1">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-gray-700">Reunião de Meio de Semana (Vida e Ministério)</Label>
                                        <Select value={midweekDay} onValueChange={setMidweekDay}>
                                            <SelectTrigger className="bg-white text-gray-900 border-gray-300">
                                                <SelectValue placeholder="Selecione o dia..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {WEEKDAYS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-gray-700">Reunião de Fim de Semana (Público e Sentinela)</Label>
                                        <Select value={weekendDay} onValueChange={setWeekendDay}>
                                            <SelectTrigger className="bg-white text-gray-900 border-gray-300">
                                                <SelectValue placeholder="Selecione o dia..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {WEEKDAYS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-3 pt-2">
                                    <Button onClick={handleSaveWeekdays} disabled={saving || !canEditConfig} className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Salvar Dias
                                    </Button>

                                    {/* create meetings button */}
                                    <Dialog open={genOpen} onOpenChange={(open) => { if(!open) setGenStep(1); setGenOpen(open); }}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" disabled={!canEditConfig} className="w-full border-purple-200 text-purple-700 hover:bg-purple-50 disabled:opacity-50">
                                                <Sparkles className="w-4 h-4 mr-2" /> Criar Reuniões Automaticamente
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl bg-white max-h-[85vh] overflow-hidden flex flex-col text-gray-900">
                                            <DialogHeader>
                                                <DialogTitle>Gerador Automático de Reuniões</DialogTitle>
                                                <DialogDescription>
                                                    O sistema criará as reuniões com base nos dias configurados e nos eventos especiais.
                                                </DialogDescription>
                                            </DialogHeader>

                                            <div className="flex-1 overflow-y-auto py-4 px-1">
                                                {genStep === 1 ? (
                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-gray-900 font-semibold">Período de Criação (a partir de amanhã)</Label>
                                                            <Select value={genPeriod} onValueChange={setGenPeriod}>
                                                                <SelectTrigger className="w-full text-gray-900 border-gray-300">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="mensal">Próximo Mês</SelectItem>
                                                                    <SelectItem value="trimestral">Próximo Trimestre</SelectItem>
                                                                    <SelectItem value="semestral">Próximo Semestre</SelectItem>
                                                                    <SelectItem value="anual">Até o final do ano ({year})</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700 space-y-2">
                                                            <p className="font-semibold flex items-center gap-2">
                                                                <CheckCircle2 className="w-4 h-4" /> Regras Consideradas:
                                                            </p>
                                                            <ul className="list-disc list-inside space-y-1 ml-1 opacity-90 font-medium">
                                                                <li>Assembleias/Congressos cancelam reuniões conflitantes.</li>
                                                                <li>Visitas do Superintendente movem a reunião para Terça-feira.</li>
                                                                <li>Celebrações cancelam a reunião do dia da semana ou fim de semana.</li>
                                                                <li>Assembleias cancelam as reuniões daquela semana.</li>
                                                            </ul>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-6">
                                                        {/* Warnings */}
                                                        {previewData.warnings.length > 0 && (
                                                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                                                <h4 className="flex items-center gap-2 text-yellow-800 font-semibold mb-2">
                                                                    <AlertTriangle className="w-4 h-4" /> Avisos e Exceções
                                                                </h4>
                                                                <ul className="text-sm text-yellow-700 space-y-1">
                                                                    {previewData.warnings.map((w, i) => (
                                                                        <li key={i}>• {w}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        {/* Table */}
                                                        <div>
                                                            <h4 className="font-semibold text-gray-900 mb-2">Reuniões a serem criadas ({previewData.meetings.filter(m => !m.exists).length})</h4>
                                                            <div className="border border-gray-200 rounded-md overflow-hidden bg-white text-sm">
                                                                <table className="w-full text-left">
                                                                    <thead className="bg-gray-100 border-b border-gray-200">
                                                                        <tr>
                                                                            <th className="p-2 font-semibold text-gray-700">Data</th>
                                                                            <th className="p-2 font-semibold text-gray-700">Dia</th>
                                                                            <th className="p-2 font-semibold text-gray-700">Tipo</th>
                                                                            <th className="p-2 font-semibold text-gray-700">Status</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-100">
                                                                        {previewData.meetings.map((m, idx) => (
                                                                            <tr key={idx} className={m.exists ? 'bg-gray-50' : 'bg-white'}>
                                                                                <td className={`p-2 font-medium ${m.exists ? 'text-gray-500' : 'text-gray-900'}`}>{new Date(m.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                                                                                <td className="p-2 capitalize text-gray-600">{m.weekday}</td>
                                                                                <td className="p-2 text-gray-700">{m.tipo}</td>
                                                                                <td className="p-2 text-xs">
                                                                                    {m.exists ? (
                                                                                        <span className="text-gray-500 font-medium">Já existe</span>
                                                                                    ) : (
                                                                                        <span className="text-green-600 font-bold">Novo</span>
                                                                                    )}
                                                                                    {m.reason && m.reason !== 'Agenda Regular' && (
                                                                                        <span className="block text-[10px] text-blue-600 truncate max-w-[150px]">{m.reason}</span>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <DialogFooter className="mt-4 border-t pt-4">
                                                {genStep === 1 ? (
                                                    <Button onClick={handlePreview} disabled={genLoading} className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white">
                                                        {genLoading ? <Loader2 className="animate-spin w-4 h-4 ml-2" /> : 'Gerar Prévia'}
                                                    </Button>
                                                ) : (
                                                    <div className="flex gap-2 w-full justify-end">
                                                        <Button variant="outline" onClick={() => setGenStep(1)}>Voltar</Button>
                                                        <Button onClick={handleConfirmGeneration} disabled={genLoading || previewData.meetings.filter(m => !m.exists).length === 0} className="bg-green-600 hover:bg-green-700 text-white">
                                                            {genLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Confirmar e Criar'}
                                                        </Button>
                                                    </div>
                                                )}
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </CardContent>
                        </Card>

                        {/* CARD 2: EVENTOS ESPECIAIS (Same as before) */}
                         <Card className="border-gray-200 shadow-sm lg:row-span-2 h-fit">
                            <CardHeader className="bg-gray-50/50 pb-4 border-b border-gray-100">
                                <CardTitle className="text-orange-900 flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-orange-600" />
                                    Eventos Especiais & Datas Importantes
                                </CardTitle>
                                <CardDescription className="text-gray-600">
                                    Adicione Assembleias, Congressos, Visitas e outras datas que alteram a rotina.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                
                                <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 space-y-3">
                                    <Label className="font-semibold text-orange-900">Adicionar Novo Evento</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <span className="text-xs font-medium text-gray-700">Nome do Evento</span>
                                            <Input 
                                                placeholder="Ex: Assembleia de Circuito" 
                                                value={newEvent.name}
                                                onChange={e => setNewEvent({...newEvent, name: e.target.value})}
                                                className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-400"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-xs font-medium text-gray-700">Tipo</span>
                                            <Select value={newEvent.type} onValueChange={v => setNewEvent({...newEvent, type: v})}>
                                                <SelectTrigger className="bg-white text-gray-900 border-gray-300">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1 sm:col-span-2">
                                            <span className="text-xs font-medium text-gray-700">Data</span>
                                            <div className="flex gap-2">
                                                <Input 
                                                    type="date" 
                                                    value={newEvent.date}
                                                    onChange={e => setNewEvent({...newEvent, date: e.target.value})}
                                                    className="bg-white text-gray-900 border-gray-300 flex-1"
                                                />
                                                <Button onClick={handleAddEvent} className="bg-orange-600 hover:bg-orange-700 text-white shrink-0">
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="font-medium text-sm text-gray-500 uppercase tracking-wider">Eventos em {year}</h4>
                                    {events.length === 0 ? (
                                        <p className="text-sm text-gray-400 italic text-center py-4">Nenhum evento cadastrado para este ano.</p>
                                    ) : (
                                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {events.map((event) => (
                                                <div key={event.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg hover:shadow-sm transition-shadow">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex flex-col items-center bg-gray-50 px-2 py-1 rounded border border-gray-200 min-w-[3.5rem]">
                                                            <span className="text-[10px] font-bold text-gray-500 uppercase">{new Date(event.data).toLocaleString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.','')}</span>
                                                            <span className="text-lg font-bold text-gray-900 leading-none">{new Date(event.data).getUTCDate()}</span>
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-gray-900 text-sm">{event.nome}</p>
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded textxs font-medium bg-purple-50 text-purple-700 text-[10px] border border-purple-100">
                                                                {event.tipo}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => handleDeleteEvent(event.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                    </div>
                )}
             <StatusToast 
                message={toast.message} 
                type={toast.type} 
                onClose={() => setToast({ ...toast, message: '' })} 
            />

            {/* Result Modal */}
            <Dialog open={resultOpen} onOpenChange={setResultOpen}>
                <DialogContent className="bg-white">
                    <DialogHeader>
                        <DialogTitle className={resultData.success ? "text-green-600" : "text-red-600"}>
                            {resultData.success ? 'Sucesso!' : 'Atenção'}
                        </DialogTitle>
                        <DialogDescription>
                            {resultData.message}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                            {resultData.details.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setResultOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            </div>
        </DashboardLayout>
    );
}
