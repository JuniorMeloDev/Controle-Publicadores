'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea'; 
import { Plus, Trash2, Calendar as CalendarIcon, Loader2, Pencil, X, Search, Users, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';

export function CleaningTab() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableGroups, setAvailableGroups] = useState([]);
  
  // Filters
  const getCurrentMonthDates = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    return { start, end };
  };

  const { start: initialStart, end: initialEnd } = getCurrentMonthDates();
  const [filterStartDate, setFilterStartDate] = useState(initialStart);
  const [filterEndDate, setFilterEndDate] = useState(initialEnd);
  const [filterGroup, setFilterGroup] = useState('all');

  // Form State
  const [date, setDate] = useState('');
  const [tasks, setTasks] = useState('');
  const [group, setGroup] = useState('');
  const [responsibles, setResponsibles] = useState('');
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    fetchItems();
    fetchGroups();
  }, []); 

  const fetchGroups = async () => {
      try {
          const res = await fetch('/api/get-grupos');
          if(res.ok) {
              const data = await res.json();
              setAvailableGroups(data);
          }
      } catch (e) {
          console.error("Erro ao buscar grupos", e);
      }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      let url = `/api/admin/limpeza?start=${filterStartDate}`;
      if (filterEndDate) url += `&end=${filterEndDate}`;
      if (filterGroup && filterGroup !== 'all') url += `&group=${encodeURIComponent(filterGroup)}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
        console.error("Failed to fetch cleaning items", error);
    } finally {
        setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !tasks || !group) return;

    try {
      const method = editId ? 'PUT' : 'POST';
      const body = { data: date, tarefas: tasks, grupo: group, responsaveis: responsibles };
      if (editId) body.id = editId;

      const res = await fetch('/api/admin/limpeza', {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        fetchItems();
        closeModal();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const openNewModal = () => {
      setEditId(null);
      setDate('');
      setTasks('');
      setGroup('');
      setResponsibles('');
      setIsModalOpen(true);
  };

  const openEditModal = (item) => {
      setEditId(item.id);
      setDate(new Date(item.data).toISOString().split('T')[0]);
      setTasks(item.tarefas);
      setGroup(item.grupo);
      setResponsibles(item.responsaveis || '');
      setIsModalOpen(true);
  };

  const closeModal = () => {
      setIsModalOpen(false);
      setEditId(null);
      setDate('');
      setTasks('');
      setGroup('');
      setResponsibles('');
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir?')) return;
    try {
      await fetch(`/api/admin/limpeza?id=${id}`, { method: 'DELETE' });
      fetchItems();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6 text-gray-900 font-medium">
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
             <div>
                <Label className="text-xs font-bold text-gray-900 mb-1.5 block">Data Inicial</Label>
                <Input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="bg-white" />
             </div>
             <div>
                <Label className="text-xs font-bold text-gray-900 mb-1.5 block">Data Final</Label>
                <Input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="bg-white" />
             </div>
             <div className="w-[200px]">
                <Label className="text-xs font-bold text-gray-900 mb-1.5 block">Grupo</Label>
                <Select value={filterGroup} onValueChange={setFilterGroup}>
                    <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Todos os Grupos" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Grupos</SelectItem>
                        {availableGroups.map((g, i) => (
                            <SelectItem key={i} value={g}>{g}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
             </div>
             <div className="flex items-end">
                <Button onClick={fetchItems} className="bg-purple-600 hover:bg-purple-700 text-white">
                    <Search className="w-4 h-4" />
                </Button>
             </div>
          </div>
          
          <Button onClick={openNewModal} className="bg-green-600 hover:bg-green-700 text-white gap-2 shrink-0">
              <Plus className="w-4 h-4" /> Nova Designação
          </Button>
      </div>

      <div className="bg-white rounded-xl flex flex-col min-h-[500px]">
        {loading ? (
             <div className="text-center py-12"><Loader2 className="animate-spin mx-auto text-purple-600 w-8 h-8" /></div>
           ) : items.length === 0 ? (
             <div className="text-center py-20 text-gray-500">
                 <CalendarIcon size={48} className="mx-auto mb-4 opacity-20" />
                 <p>Nenhuma designação encontrada para este período.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {items.map((item) => (
                 <Card key={item.id} className="hover:shadow-md transition-all group border-gray-200">
                    <CardHeader className="pb-3 border-b border-gray-100 bg-white rounded-t-xl">
                        <div className="flex justify-between items-start">
                             <div className="flex items-center gap-2">
                                <div className="bg-purple-100 text-purple-700 p-1.5 rounded-md">
                                    <CalendarIcon className="w-4 h-4" />
                                </div>
                                <CardTitle className="text-base font-bold text-gray-900">
                                    {new Date(item.data).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).toUpperCase()}
                                </CardTitle>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEditModal(item)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600 transition-colors" title="Editar"><Edit size={16} /></button>
                                <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600 transition-colors" title="Excluir"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div>
                             <h4 className="text-xs uppercase tracking-wider font-bold text-gray-400 mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Grupo</h4>
                             <p className="text-gray-900 font-medium text-base line-clamp-1">{item.grupo}</p>
                        </div>
                        {item.responsaveis && (
                             <div>
                                 <h4 className="text-xs uppercase tracking-wider font-bold text-gray-400 mb-1 flex items-center gap-1">Responsáveis</h4>
                                 <p className="text-gray-600 text-sm line-clamp-2">{item.responsaveis}</p>
                             </div>
                        )}
                    </CardContent>
                 </Card>
               ))}
             </div>
           )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl bg-white text-gray-900 font-medium">
            <DialogHeader>
                <DialogTitle>{editId ? 'Editar Designação' : 'Nova Designação de Limpeza'}</DialogTitle>
                <DialogDescription>Preencha os dados da semana de limpeza.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data da Reunião (ou Semana)</Label>
                    <Input className="text-gray-900 font-medium" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                  </div>
                   <div className="space-y-2">
                    <Label>Grupo Designado</Label>
                    <Select value={group} onValueChange={setGroup} required>
                        <SelectTrigger className="text-gray-900 font-medium">
                            <SelectValue placeholder="Selecione um grupo" />
                        </SelectTrigger>
                        <SelectContent>
                             {availableGroups.map((g, i) => (
                                <SelectItem key={i} value={g}>{g}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                    <Label>Tarefas</Label>
                    <Textarea 
                        className="min-h-[100px] text-gray-900 font-medium"
                        placeholder="Ex: Varrer o chão, recolher o lixo..."
                        value={tasks}
                        onChange={e => setTasks(e.target.value)}
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label>Responsáveis (Opcional)</Label>
                    <Textarea 
                        className="min-h-[60px] text-gray-900 font-medium"
                        placeholder="Ex: Fulano, Beltrano"
                        value={responsibles}
                        onChange={e => setResponsibles(e.target.value)}
                    />
                </div>

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={closeModal}>Cancelar</Button>
                    <Button type="submit" className={editId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}>
                        {editId ? 'Salvar Alterações' : 'Adicionar Designação'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
