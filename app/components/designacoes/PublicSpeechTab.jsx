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
  }, [filteredTalks, talks]); // Pass filteredTalks to sidebar list? 
  // Wait, if I filter by Month/Year in Parent, filteredTalks contains only valid items.
  // Sidebar expects `items` (filtered) and maybe `allItems` for year generation if I changed Sidebar logic.
  // But my Sidebar implementation computes year from `items` passed to it.
  // CRITICAL: If I pass `filteredTalks` to Sidebar, `availableYears` in Sidebar will only show the selected year if I filter by year!
  // I need to fix Sidebar to accept `availableItems` OR compute years from a separate prop.
  // Actually, standard behavior: if I select 2024, only 2024 items show. So availableYears will be just 2024? That's bad UX.
  // The Sidebar should receive ALL items to calculate available years, but list FILTERED items.
  // My Sidebar implementation currently takes ONE `items` prop.
  // I will just update Sidebar in next step to fix this, or pass ALL items and handle filter inside Sidebar?
  // No, I prefer Parent Control.
  // So Sidebar needs `items` (for listing) AND `yearsSource` (for dropdown).
  // I will check Sidebar code again. 
  // Sidebar code: `const availableYears = useMemo(() => ... items ...`
  // I should update Sidebar to accept `allYearsItems`.

  // For now, I will use `talks` (all) for computing years if I modify Sidebar.
  // Or I can just pass `filteredTalks` and accept that year dropdown might shrink. 
  // BETTER: Update Sidebar to take `allItems` prop.

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
    <div className="flex bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-[calc(100vh-220px)]">
        {/* SIDEBAR */}
        <div className="hidden md:block">
            <HistorySidebar 
                items={sidebarItems}
                month={month}
                setMonth={setMonth}
                year={year}
                setYear={setYear}
                onSelect={handleSidebarSelect}
                selectedId={null} // We could track selected
            />
        </div>

        {/* MOBILE SIDEBAR */}
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetContent side="left" className="p-0 w-72">
                 <SheetTitle className="hidden">Histórico de Discursos</SheetTitle>
                 <HistorySidebar 
                    items={sidebarItems}
                    month={month}
                    setMonth={setMonth}
                    year={year}
                    setYear={setYear}
                    onSelect={(i) => { handleSidebarSelect(i); setIsSidebarOpen(false); }}
                 />
            </SheetContent>
        </Sheet>
        
        <div className="flex-1 flex flex-col bg-white overflow-hidden relative min-w-0">
             <div className="p-4 border-b border-gray-200 flex flex-wrap justify-between items-center bg-white z-10 gap-2">
                 <div className="flex items-center gap-2">
                    <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-md">
                      <Menu size={20} />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Discursos Públicos</h2>
                        <p className="text-sm text-gray-500">Gerencie oradores e designações.</p>
                    </div>
                 </div>
                 
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) setFormData({ id: null, data: '', orador: '', tema: '', cantico: '', congregacao: '', presidente_id: null });
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-purple-600 hover:bg-purple-700">
                            <Plus className="w-4 h-4 mr-2" /> Novo Discurso
                        </Button>
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

             <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50/30 scroll-smooth">
                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-purple-600" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                        {filteredTalks.length === 0 && <p className="text-gray-500 text-center col-span-3 py-10">Nenhum discurso encontrado para o período.</p>}
                        {filteredTalks.map(talk => (
                            <Card key={talk.id} id={`talk-${talk.id}`} className="hover:shadow-md transition-shadow">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-purple-600" />
                                        <CardTitle className="text-base font-bold text-gray-900">{formatDate(talk.data)}</CardTitle>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEdit(talk)} className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"><Edit size={16} /></button>
                                            <button onClick={() => handleDelete(talk.id)} className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    <CardDescription className="flex items-center gap-1 mt-1 text-gray-500">
                                    <Music className="w-3 h-3" /> Cântico {talk.cantico || '---'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div>
                                        <h4 className="font-semibold text-gray-700 flex items-center gap-2"><User className="w-4 h-4" /> Orador</h4>
                                        <p className="text-gray-900 ml-6">{talk.orador || 'A definir'}</p>
                                        <p className="text-gray-500 text-xs ml-6">{talk.congregacao}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-700 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Tema</h4>
                                        <p className="text-gray-900 italic ml-6">{talk.tema || '---'}</p>
                                    </div>
                                    <div className="pt-2 border-t border-gray-100">
                                        <h4 className="font-semibold text-gray-700 flex items-center gap-2"><Users className="w-4 h-4" /> Presidente</h4>
                                        <p className="text-gray-900 ml-6">{talk.nome_chamado || talk.nome_completo || 'A definir'}</p>
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
