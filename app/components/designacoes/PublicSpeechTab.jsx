'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Calendar, User, BookOpen, Music, Users, Plus, Trash2, Edit, Menu } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/app/components/ui/sheet';
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

// Helper to format date consistent with backend
const formatDate = (dateStr) => {
    if(!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

export function PublicSpeechTab() {
  const [talks, setTalks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publishers, setPublishers] = useState([]);
  const [themes, setThemes] = useState([]);
  
  // Filter states
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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
    try {
        const res = await fetch('/api/admin/discursos');
        if (res.ok) setTalks(await res.json());
    } catch (error) {
        console.error(error);
    } finally {
        setLoading(false);
    }
  }

  // Filter Logic
  const filteredTalks = useMemo(() => {
    let list = talks;
    // Sort descending
    list = [...list].sort((a, b) => new Date(b.data) - new Date(a.data));

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
        id: t.id,
        date: t.data,
        label: formatDate(t.data),
        subLabel: t.orador || t.tema || 'Sem orador'
    }));
  }, [filteredTalks, talks]); 
  const handleSidebarSelect = (item) => {
    // Scroll to item or Highlight?
    // For now, simple highlight.
    // In PublicSpeechTab we are showing a grid. We could filter to JUST that item?
    // Or just highlight the card.
    const element = document.getElementById(`talk-${item.id}`);
    if(element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSave = async () => {
    if (!formData.data) return;
    setSaving(true);
    try {
        const res = await fetch('/api/admin/discursos', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(formData)
        });
        if (res.ok) {
            setIsDialogOpen(false);
            setFormData({ id: null, data: '', orador: '', tema: '', cantico: '', congregacao: '', presidente_id: null });
            fetchTalks();
        } else {
            alert('Erro ao salvar');
        }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
      if(!confirm('Tem certeza?')) return;
      try {
          await fetch(`/api/admin/discursos?id=${id}`, { method: 'DELETE' });
          fetchTalks();
      } catch(e) { console.error(e); }
  };

  const handleEdit = (talk) => {
      setFormData({
          id: talk.id,
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
    <div className="p-6 max-w-7xl mx-auto w-full flex flex-col gap-8">
        
        {/* HEADER: TITLE + ACTION */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Discursos Públicos</h1>
                <p className="text-gray-500 text-sm mt-1">Gerencie oradores, temas e designações de fim de semana.</p>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) setFormData({ id: null, data: '', orador: '', tema: '', cantico: '', congregacao: '', presidente_id: null });
            }}>
                <DialogTrigger asChild>
                    <button className="flex items-center gap-3 py-3 px-6 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition font-bold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0">
                        <Plus size={20} /> 
                        NOVO DISCURSO
                    </button>
                </DialogTrigger>
                <DialogContent className="bg-white sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900">{formData.id ? 'Editar Discurso' : 'Novo Discurso'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-gray-700">Data</Label>
                                <Input className="text-gray-900" type="date" value={formData.data} onChange={e => setFormData({...formData, data: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-gray-700">Cântico</Label>
                                <Input className="text-gray-900" type="number" placeholder="Nº" value={formData.cantico} onChange={e => setFormData({...formData, cantico: e.target.value})} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-700">Orador</Label>
                            <Input className="text-gray-900" placeholder="Nome do Orador" value={formData.orador} onChange={e => setFormData({...formData, orador: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-700">Congregação</Label>
                            <Input className="text-gray-900" placeholder="Congregação do Orador" value={formData.congregacao} onChange={e => setFormData({...formData, congregacao: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-700">Tema</Label>
                            <ThemeCombobox 
                                themes={themes}
                                value={formData.tema}
                                onChange={val => setFormData({...formData, tema: val})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-700">Presidente</Label>
                            <PublisherCombobox 
                                label=""
                                publishers={publishers}
                                value={formData.presidente_id}
                                onChange={val => setFormData({...formData, presidente_id: val})}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-gray-300 text-gray-700 font-medium hover:bg-gray-50 hover:text-gray-900">Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white">
                            {saving ? <Loader2 className="animate-spin w-4 h-4" /> : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>

        {/* MAIN LIST / GRID */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-[500px]">
            {/* TOOLBAR: FILTERS */}
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                 <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    <Calendar size={20} className="text-gray-500" />
                    Programação de Discursos
                 </h2>

                 <div className="flex items-center gap-3">
                    <select 
                        value={month} 
                        onChange={(e) => setMonth(e.target.value)} 
                        className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 outline-none text-gray-700"
                    >
                        <option value="">Todos os Meses</option>
                        {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => <option key={i} value={String(i+1).padStart(2, '0')}>{m}</option>)}
                    </select>
                    
                    <select 
                        value={year} 
                        onChange={(e) => setYear(e.target.value)} 
                        className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 outline-none text-gray-700"
                    >
                        <option value="">Todos os Anos</option>
                        {Array.from(new Set(talks.map(t => t.data.split('-')[0]))).sort().reverse().map(y => (
                             <option key={y} value={y}>{y}</option>
                        ))}
                    </select>

                    {(month || year) && (
                        <button onClick={() => { setMonth(''); setYear(''); }} className="text-sm text-red-600 hover:text-red-700 hover:underline px-2">
                            Limpar Filtros
                        </button>
                    )}
                 </div>
            </div>

            <div className="flex-1 p-6 md:p-8 bg-gray-50/30">
                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-purple-600" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTalks.length === 0 && (
                             <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                                <Calendar size={48} className="mb-4 opacity-20" />
                                <p>Nenhum discurso encontrado com os filtros atuais.</p>
                             </div>
                        )}
                        {filteredTalks.map(talk => (
                            <Card key={talk.id} id={`talk-${talk.id}`} className="hover:shadow-md transition-all group border-gray-200">
                                <CardHeader className="pb-3 border-b border-gray-100 bg-white rounded-t-xl">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-purple-100 text-purple-700 p-1.5 rounded-md">
                                                <Calendar className="w-4 h-4" />
                                            </div>
                                            <CardTitle className="text-base font-bold text-gray-900">{formatDate(talk.data)}</CardTitle>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(talk)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600 transition-colors" title="Editar"><Edit size={16} /></button>
                                            <button onClick={() => handleDelete(talk.id)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600 transition-colors" title="Excluir"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    <CardDescription className="flex items-center gap-1.5 mt-2 text-gray-500 font-medium bg-gray-50 py-1 px-2 rounded w-fit">
                                        <Music className="w-3 h-3" /> Cântico {talk.cantico || '---'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-4">
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
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
