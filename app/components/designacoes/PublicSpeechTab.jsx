'use client';

import { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { Loader2, Calendar, User, BookOpen, Music, Users, Plus, Trash2, Edit, Menu, AlertTriangle, Printer, FileText, ChevronRight } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { ConfirmationDialog } from '@/app/components/ui/confirmation-dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/app/components/ui/sheet';
import { usePermissions } from '@/app/components/PermissionsContext';
import { isAllowed } from '@/app/lib/access-control';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/app/components/ui/dialog";
import { PublisherCombobox } from '@/app/components/reunioes/PublisherCombobox';
import { ThemeCombobox } from '@/app/components/designacoes/ThemeCombobox';
import { HistorySidebar } from '@/app/components/designacoes/HistorySidebar';
import { useDesignationPeriod } from './DesignationPeriodContext';
import { DesignationPeriodFilters, designationToolbarClass, designationActionClass, designationListHeaderClass } from './DesignationLayout';

// Helper to format date consistent with backend
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

const formatFullDateBR = (dateStr) => {
    if (!dateStr) return '';
    const str = new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' });
    return str.charAt(0).toUpperCase() + str.slice(1);
};

const speechStatus = talk => talk.cancelado
    ? `Cancelada: ${talk.motivo_cancelamento}`
    : !talk.orador || !talk.tema || !talk.presidente_id ? 'Designações pendentes' : 'Completa';

const getThemeNumber = (themeStr) => {
    if (!themeStr) return null;
    const match = themeStr.match(/(?:n[ºo°.]?\s*|^#?)(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
};

const normalizeText = (text) => {
    if (!text) return '';
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
};

export function PublicSpeechTab() {
    const { permissions } = usePermissions();
    const canEdit = isAllowed(permissions, 'discursos_publicos_editar', 'actions');
    const [talks, setTalks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [publishers, setPublishers] = useState([]);
    const [themes, setThemes] = useState([]);

    // Filter states
    const { month, year } = useDesignationPeriod();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [pendingDelete, setPendingDelete] = useState(null);
    const [formData, setFormData] = useState({
        id: null,
        data: '',
        orador: '',
        tema: '',
        cantico: '',
        congregacao: '',
        presidente_id: null
    });

    useEffect(() => {
        fetchTalks();
        fetch('/api/admin/get-publicadores').then(res => res.json()).then(setPublishers).catch(console.error);
        fetch('/api/admin/temas-discursos').then(res => res.json()).then(setThemes).catch(console.error);
    }, []);

    async function fetchTalks() {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/admin/discursos');
            if (res.ok) setTalks(await res.json());
            else throw new Error('Não foi possível carregar as reuniões de fim de semana.');
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }

    // Filter Logic
    const filteredTalks = useMemo(() => {
        let list = talks;
        // Sort Ascending (Oldest to Newest)
        list = [...list].sort((a, b) => new Date(a.data) - new Date(b.data));

        if (month) {
            list = list.filter(t => t.data.split('-')[1] === month);
        }
        if (year) {
            list = list.filter(t => t.data.split('-')[0] === year);
        }
        return list;
    }, [talks, month, year]);

    // Map to Sidebar Items format
    const sidebarItems = useMemo(() => {
        const allSorted = [...talks].sort((a, b) => new Date(b.data) - new Date(a.data));
        // Calculate display items based on filter, BUT sidebar usually shows filtered list too?
        // Using filteredTalks for the list display.
        return filteredTalks.map(t => ({
            id: t.id || `reuniao-${t.reuniao_id}`,
            date: t.data,
            label: formatDate(t.data),
            subLabel: t.cancelado ? 'Reunião cancelada' : t.orador || t.tema || 'Designações pendentes'
        }));
    }, [filteredTalks, talks]);

    // Detecção de tema repetido nos últimos 12 meses
    const repeatedSpeechAlert = useMemo(() => {
        if (!formData.tema || formData.tema.trim().length < 3) return null;

        const currentNum = getThemeNumber(formData.tema);
        const currentNorm = normalizeText(formData.tema);
        const targetDate = formData.data ? new Date(`${formData.data}T12:00:00`) : new Date();

        const duplicates = talks.filter(t => {
            if (formData.id && t.id === formData.id) return false;
            if (!t.tema) return false;

            const tNum = getThemeNumber(t.tema);
            const tNorm = normalizeText(t.tema);

            const isSameTheme = (currentNum && tNum && currentNum === tNum) ||
                (currentNorm.length > 5 && (tNorm.includes(currentNorm) || currentNorm.includes(tNorm)));

            if (!isSameTheme) return false;
            if (!t.data) return false;

            const talkDate = new Date(`${t.data}T12:00:00`);
            const diffDays = Math.round((targetDate.getTime() - talkDate.getTime()) / (1000 * 60 * 60 * 24));

            return diffDays >= -30 && diffDays <= 365;
        });

        if (duplicates.length === 0) return null;

        duplicates.sort((a, b) => new Date(b.data) - new Date(a.data));
        const lastOne = duplicates[0];
        const talkDate = new Date(`${lastOne.data}T12:00:00`);
        const diffDays = Math.max(0, Math.round((targetDate.getTime() - talkDate.getTime()) / (1000 * 60 * 60 * 24)));
        const monthsAgo = Math.round(diffDays / 30);

        return {
            count: duplicates.length,
            lastDate: formatDate(lastOne.data),
            orador: lastOne.orador || 'Orador não informado',
            congregacao: lastOne.congregacao || '',
            monthsAgo,
            isRecent: diffDays <= 180
        };
    }, [formData.tema, formData.data, formData.id, talks]);

    const handleExportSchedulePDF = () => {
        if (filteredTalks.length === 0) return;

        const doc = new jsPDF('l', 'mm', 'a4');
        const pageWidth = 297;
        const pageHeight = 210;
        const margin = 14;
        const printableWidth = pageWidth - (margin * 2);

        doc.setFillColor(30, 41, 59);
        doc.rect(margin, margin, printableWidth, 16, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text("PROGRAMAÇÃO DE DISCURSOS PÚBLICOS", margin + 6, margin + 10.5);

        const mesNome = month ? ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][parseInt(month, 10) - 1] : 'Todos os Meses';
        const periodoStr = year ? `${mesNome} / ${year}` : mesNome;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Período: ${periodoStr}`, pageWidth - margin - 6, margin + 10.5, { align: 'right' });

        let currentY = margin + 20;

        const cols = [
            { title: "DATA", width: 28, align: "center" },
            { title: "CÂNTICO", width: 22, align: "center" },
            { title: "ORADOR", width: 50, align: "left" },
            { title: "CONGREGAÇÃO", width: 48, align: "left" },
            { title: "TEMA DO DISCURSO", width: 83, align: "left" },
            { title: "PRESIDENTE", width: 38, align: "left" }
        ];

        const headerHeight = 9;
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.rect(margin, currentY, printableWidth, headerHeight, 'FD');

        let colX = margin;
        doc.setTextColor(51, 65, 85);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);

        cols.forEach(col => {
            if (col.align === "center") {
                doc.text(col.title, colX + (col.width / 2), currentY + 6, { align: "center" });
            } else {
                doc.text(col.title, colX + 3, currentY + 6);
            }
            colX += col.width;
        });

        currentY += headerHeight;

        const rowHeight = 12;
        filteredTalks.forEach((talk, idx) => {
            if (currentY + rowHeight > pageHeight - margin - 10) {
                doc.addPage('l', 'mm', 'a4');
                currentY = margin;

                doc.setFillColor(241, 245, 249);
                doc.rect(margin, currentY, printableWidth, headerHeight, 'FD');
                let cx = margin;
                cols.forEach(col => {
                    if (col.align === "center") {
                        doc.text(col.title, cx + (col.width / 2), currentY + 6, { align: "center" });
                    } else {
                        doc.text(col.title, cx + 3, currentY + 6);
                    }
                    cx += col.width;
                });
                currentY += headerHeight;
            }

            if (idx % 2 === 1) {
                doc.setFillColor(248, 250, 252);
                doc.rect(margin, currentY, printableWidth, rowHeight, 'F');
            }

            doc.setDrawColor(226, 232, 240);
            doc.line(margin, currentY + rowHeight, margin + printableWidth, currentY + rowHeight);

            doc.setDrawColor(203, 213, 225);
            doc.rect(margin, currentY, printableWidth, rowHeight, 'D');

            let cellX = margin;
            doc.setFontSize(9);

            doc.setFont("helvetica", "bold");
            doc.setTextColor(30, 41, 59);
            doc.text(formatDate(talk.data), cellX + (cols[0].width / 2), currentY + 7.5, { align: "center" });
            cellX += cols[0].width;

            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            doc.text(talk.cantico ? `Nº ${talk.cantico}` : '---', cellX + (cols[1].width / 2), currentY + 7.5, { align: "center" });
            cellX += cols[1].width;

            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            const oradorText = doc.splitTextToSize(talk.orador || 'A definir', cols[2].width - 6);
            doc.text(oradorText[0] || '', cellX + 3, currentY + 7.5);
            cellX += cols[2].width;

            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            const congText = doc.splitTextToSize(talk.congregacao || '---', cols[3].width - 6);
            doc.text(congText[0] || '', cellX + 3, currentY + 7.5);
            cellX += cols[3].width;

            doc.setFont("helvetica", "italic");
            doc.setTextColor(30, 41, 59);
            const temaLines = doc.splitTextToSize(talk.tema || 'Tema não definido', cols[4].width - 6);
            if (temaLines.length === 1) {
                doc.text(temaLines[0], cellX + 3, currentY + 7.5);
            } else {
                doc.text(temaLines[0], cellX + 3, currentY + 5.5);
                doc.text(temaLines[1], cellX + 3, currentY + 9.5);
            }
            cellX += cols[4].width;

            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            const presName = talk.nome_chamado || talk.nome_completo || '---';
            const presLines = doc.splitTextToSize(presName, cols[5].width - 6);
            doc.text(presLines[0] || '', cellX + 3, currentY + 7.5);

            currentY += rowHeight;
        });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} via Sistema de Controle de Publicadores`, margin, pageHeight - 8);

        doc.save(`Escala_Discursos_${periodoStr.replace(/[\/\s]/g, '_')}.pdf`);
    };

    const handleSidebarSelect = (item) => {
        // Scroll to item or Highlight?
        // For now, simple highlight.
        // In PublicSpeechTab we are showing a grid. We could filter to JUST that item?
        // Or just highlight the card.
        const element = document.getElementById(`talk-${item.id}`);
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleSave = async () => {
        if (!canEdit) return;
        if (!formData.data) return;
        setSaving(true);
        setSaveError('');
        try {
            const res = await fetch('/api/admin/discursos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                setIsDialogOpen(false);
                setFormData({ id: null, data: '', orador: '', tema: '', cantico: '', congregacao: '', presidente_id: null });
                fetchTalks();
            } else {
                const error = await res.json();
                setSaveError(error.message || error.error || 'Erro ao salvar');
            }
        } catch (e) { setSaveError(e.message || 'Não foi possível salvar o discurso.'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        if (!canEdit) return;
        const response = await fetch(`/api/admin/discursos?id=${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.error || result.message || 'Não foi possível excluir o discurso.');
        }
        await fetchTalks();
    };

    const handleEdit = (talk) => {
        setSaveError('');
        setFormData({
            id: talk.id,
            reuniao_id: talk.reuniao_id,
            data: talk.data,
            orador: talk.orador || '',
            tema: talk.tema || '',
            cantico: talk.cantico || '',
            congregacao: talk.congregacao || '',
            presidente_id: talk.presidente_id
        });
        setIsDialogOpen(true);
    };

    return (
        <div className="w-full min-w-0 flex flex-col gap-4">
            {pendingDelete && <ConfirmationDialog destructive title="Excluir designações do discurso?" confirmLabel="Excluir"
                description={`As designações do discurso em ${formatDate(pendingDelete.data)} serão removidas. A reunião continuará no calendário para novas designações.`}
                onConfirm={() => handleDelete(pendingDelete.id)} onCancel={() => setPendingDelete(null)} />}
            {error && <p role="alert" className="bg-red-50 text-red-700 rounded-md p-3">{error} <button onClick={fetchTalks} className="underline">Tentar novamente</button></p>}

            {/* HEADER: TITLE + ACTION */}
            <div className={designationToolbarClass}>
                <div className="flex-1 min-w-0 basis-64">
                    <h2 className="text-lg font-bold text-gray-900">Discursos Públicos</h2>
                    <p className="text-gray-500 text-sm mt-1">Gerencie oradores, temas e designações de fim de semana.</p>
                </div>

                {!canEdit && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
                        Você não tem permissão para editar discursos públicos.
                    </div>
                )}

                <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
                    <Button
                        variant="outline"
                        onClick={handleExportSchedulePDF}
                        disabled={filteredTalks.length === 0}
                        className={`${designationActionClass} border-gray-300 text-gray-700 hover:bg-gray-50`}
                        title="Gerar PDF da escala de oradores para o quadro de anúncios"
                    >
                        <Printer size={18} className="text-purple-600" />
                        <span>Exportar PDF</span>
                    </Button>

                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        setSaveError('');
                        if (!open) setFormData({ id: null, data: '', orador: '', tema: '', cantico: '', congregacao: '', presidente_id: null });
                    }}>
                        <DialogTrigger asChild>
                            <button disabled={!canEdit} className={`${designationActionClass} bg-purple-600 hover:bg-purple-700 text-white`}>
                                <Plus size={20} />
                                Novo discurso
                            </button>
                        </DialogTrigger>
                        <DialogContent className="bg-white sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle className="text-gray-900">{formData.id ? 'Editar Discurso' : 'Novo Discurso'}</DialogTitle>
                            </DialogHeader>
                            {saveError && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-gray-700">Data</Label>
                                        <Input className="text-gray-900" type="date" disabled={Boolean(formData.reuniao_id)} value={formData.data} onChange={e => setFormData({ ...formData, data: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-gray-700">Cântico</Label>
                                        <Input className="text-gray-900" type="number" placeholder="Nº" value={formData.cantico} onChange={e => setFormData({ ...formData, cantico: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-700">Orador</Label>
                                    <Input className="text-gray-900" placeholder="Nome do Orador" value={formData.orador} onChange={e => setFormData({ ...formData, orador: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-700">Congregação</Label>
                                    <Input className="text-gray-900" placeholder="Congregação do Orador" value={formData.congregacao} onChange={e => setFormData({ ...formData, congregacao: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-700">Tema</Label>
                                    <ThemeCombobox
                                        themes={themes}
                                        value={formData.tema}
                                        onChange={val => setFormData({ ...formData, tema: val })}
                                    />
                                    {repeatedSpeechAlert && (
                                        <div className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs animate-in fade-in duration-200 mt-2 ${
                                            repeatedSpeechAlert.isRecent
                                                ? 'bg-red-50 border-red-200 text-red-800'
                                                : 'bg-amber-50 border-amber-200 text-amber-800'
                                        }`}>
                                            <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                                                repeatedSpeechAlert.isRecent ? 'text-red-600' : 'text-amber-600'
                                            }`} />
                                            <div className="flex-1">
                                                <p className="font-bold">
                                                    {repeatedSpeechAlert.isRecent ? 'Alerta Crítico: Tema Proferido Recentemente!' : 'Atenção: Tema Proferido nos Últimos 12 Meses'}
                                                </p>
                                                <p className="mt-0.5 leading-relaxed">
                                                    Este tema foi feito em <strong>{repeatedSpeechAlert.lastDate}</strong> ({repeatedSpeechAlert.monthsAgo === 0 ? 'menos de 1 mês atrás' : `há cerca de ${repeatedSpeechAlert.monthsAgo} meses`}) por <strong>{repeatedSpeechAlert.orador}</strong>{repeatedSpeechAlert.congregacao ? ` (${repeatedSpeechAlert.congregacao})` : ''}.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-700">Presidente</Label>
                                    <PublisherCombobox
                                        label=""
                                        publishers={publishers}
                                        value={formData.presidente_id}
                                        onChange={val => setFormData({ ...formData, presidente_id: val })}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-gray-300 text-gray-700 font-medium hover:bg-gray-50 hover:text-gray-900">Cancelar</Button>
                                <Button onClick={handleSave} disabled={saving || !canEdit} className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50">
                                    {saving ? <Loader2 className="animate-spin w-4 h-4" /> : 'Salvar'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* MAIN LIST / GRID */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                {/* TOOLBAR: FILTERS */}
                <div className={designationListHeaderClass}>
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                        <Calendar size={20} className="text-gray-500" />
                        Programação de Discursos
                    </h2>

                    <DesignationPeriodFilters years={talks.map(t => t.data.slice(0, 4))} />
                </div>

                <div className="flex-1">
                    {loading ? (
                        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-purple-600" /></div>
                    ) : (
                        <div className="md:divide-y md:divide-gray-100">
                            {filteredTalks.length === 0 && (
                                <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                                    <Calendar size={48} className="mb-4 opacity-20" />
                                    <p>Nenhum discurso encontrado com os filtros atuais.</p>
                                </div>
                            )}
                            {filteredTalks.map(talk => (
                                <div key={talk.id || `reuniao-${talk.reuniao_id}`} id={`talk-${talk.id || `reuniao-${talk.reuniao_id}`}`} className="p-4 md:p-0">
                                    <div className="hidden md:flex items-center group transition-colors hover:bg-purple-50">
                                        <button
                                            type="button"
                                            disabled={!canEdit || talk.cancelado}
                                            onClick={() => handleEdit(talk)}
                                            aria-label={`Editar designações do discurso de ${formatDate(talk.data)}`}
                                            className="flex-1 min-w-0 px-4 py-3 flex items-center justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500 disabled:cursor-default"
                                        >
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${talk.cancelado ? 'bg-gray-100 text-gray-500' : 'bg-purple-100 text-purple-600'}`}>
                                                    {talk.data.split('-')[2]}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-medium text-gray-900 group-hover:text-purple-700 truncate" title={talk.tema || 'Reunião de fim de semana'}>
                                                        {talk.tema || 'Reunião de fim de semana'}
                                                    </h3>
                                                    <p className="text-xs text-gray-500">
                                                        {formatFullDateBR(talk.data)}
                                                    </p>
                                                    {(talk.orador || talk.nome_chamado || talk.nome_completo) && <p className="text-xs text-gray-500 mt-1 truncate">
                                                        {talk.orador && `Orador: ${talk.orador}`}
                                                        {talk.orador && (talk.nome_chamado || talk.nome_completo) && ' · '}
                                                        {(talk.nome_chamado || talk.nome_completo) && `Presidente: ${talk.nome_chamado || talk.nome_completo}`}
                                                    </p>}
                                                    <p className={`text-xs mt-1 ${talk.cancelado ? 'text-red-600' : 'text-purple-600'}`}>{speechStatus(talk)}</p>
                                                </div>
                                            </div>
                                            <ChevronRight size={20} className="shrink-0 text-gray-400 group-hover:text-purple-500" />
                                        </button>
                                        {talk.id && !talk.cancelado && <button
                                            type="button" disabled={!canEdit} onClick={() => setPendingDelete(talk)}
                                            aria-label={`Excluir designações do discurso de ${formatDate(talk.data)}`}
                                            title="Excluir designações"
                                            className="p-2 mr-4 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                        ><Trash2 size={16} /></button>}
                                    </div>
                                <Card className="md:hidden hover:shadow-md transition-all group border-gray-200">
                                    <CardHeader className="pb-3 border-b border-gray-100 bg-white rounded-t-xl">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-purple-100 text-purple-700 p-1.5 rounded-md">
                                                    <Calendar className="w-4 h-4" />
                                                </div>
                                                <CardTitle className="text-base font-bold text-gray-900">{formatDate(talk.data)}</CardTitle>
                                            </div>
                                            <div className="flex gap-1">
                                                <button disabled={!canEdit || talk.cancelado} onClick={() => handleEdit(talk)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Editar"><Edit size={16} /></button>
                                                <button disabled={!canEdit || !talk.id || talk.cancelado} onClick={() => setPendingDelete(talk)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Excluir"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                        <CardDescription className="flex items-center gap-1.5 mt-2 text-gray-500 font-medium bg-gray-50 py-1 px-2 rounded w-fit">
                                            <Music className="w-3 h-3" /> Cântico {talk.cantico || '---'}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4 pt-4">
                                        <p className={`text-xs font-medium ${talk.cancelado ? 'text-red-600' : 'text-purple-600'}`}>
                                            {speechStatus(talk)}
                                        </p>
                                        <div>
                                            <h4 className="text-xs uppercase tracking-wider font-bold text-gray-400 mb-1 flex items-center gap-1"><User className="w-3 h-3" /> Orador</h4>
                                            <p className="text-gray-900 font-medium text-base line-clamp-1" title={talk.orador}>{talk.orador || 'A definir'}</p>
                                            <p className="text-gray-500 text-xs mt-0.5 max-w-full truncate">{talk.congregacao || 'Congregação não informada'}</p>
                                        </div>
                                        <div>
                                            <h4 className="text-xs uppercase tracking-wider font-bold text-gray-400 mb-1 flex items-center gap-1"><BookOpen className="w-3 h-3" /> Tema</h4>
                                            <p className="text-gray-800 text-sm italic line-clamp-2 min-h-[40px]" title={talk.tema}>{talk.tema || 'Tema não definido'}</p>
                                        </div>
                                        <div className="pt-3 border-t border-gray-100">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                                    <Users className="w-3 h-3 text-gray-500" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-400">Presidente</p>
                                                    <p className="text-sm font-medium text-gray-900">{talk.nome_chamado || talk.nome_completo || '-'}</p>
                                                </div>
                                            </div>
                                        </div>
                                        {!talk.cancelado && <Button disabled={!canEdit} onClick={() => handleEdit(talk)} variant="outline" className="w-full text-purple-700">
                                            {talk.id ? 'Editar designações' : 'Designar discurso'}
                                        </Button>}
                                    </CardContent>
                                </Card>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
