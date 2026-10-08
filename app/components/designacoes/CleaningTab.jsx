'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { ConfirmationDialog } from '@/app/components/ui/confirmation-dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea'; 
import { Plus, Trash2, Calendar as CalendarIcon, Loader2, ChevronRight, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { usePermissions } from '@/app/components/PermissionsContext';
import { isAllowed } from '@/app/lib/access-control';
import { useDesignationPeriod } from './DesignationPeriodContext';
import { designationToolbarClass, designationActionClass, designationListHeaderClass, DesignationPeriodFilters } from './DesignationLayout';

export function CleaningTab() {
  const { month, year } = useDesignationPeriod();
  const { permissions } = usePermissions();
  const canEdit = isAllowed(permissions, 'limpeza_semanal_editar', 'actions');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableGroups, setAvailableGroups] = useState([]);
  
  // Filters
  const getCurrentMonthDates = () => {
    if (!year) return { start: '', end: '' };
    const selectedYear = Number(year || new Date().getFullYear());
    const start = `${selectedYear}-${month || '01'}-01`;
    const end = new Date(Date.UTC(selectedYear, month ? Number(month) : 12, 0)).toISOString().slice(0, 10);
    return { start, end };
  };

  const { start: filterStartDate, end: filterEndDate } = getCurrentMonthDates();
  const [filterGroup, setFilterGroup] = useState('all');

  // Form State
  const [date, setDate] = useState('');
  const [tasks, setTasks] = useState('');
  const [group, setGroup] = useState('');
  const [responsibles, setResponsibles] = useState('');
  const [editId, setEditId] = useState(null);
  const [meetingId, setMeetingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
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

  const fetchItems = useCallback(async ({ signal } = {}) => {
    setLoading(true);
    setError('');
    try {
      let url = `/api/admin/limpeza?start=${filterStartDate}`;
      if (filterEndDate) url += `&end=${filterEndDate}`;
      if (!filterStartDate && !filterEndDate && month) url += `&month=${Number(month)}`;
      if (filterGroup && filterGroup !== 'all') url += `&group=${encodeURIComponent(filterGroup)}`;
      
      const res = await fetch(url, { signal });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      } else throw new Error('Não foi possível carregar a agenda de limpeza.');
    } catch (error) {
        if (error.name !== 'AbortError') setError(error.message);
    } finally {
        if (!signal?.aborted) setLoading(false);
    }
  }, [filterStartDate, filterEndDate, filterGroup, month]);

  useEffect(() => {
    const controller = new AbortController();
    fetchItems({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!date || !tasks || !group) return;

    try {
      const method = editId ? 'PUT' : 'POST';
      const body = { data: date, tarefas: tasks, grupo: group, responsaveis: responsibles, reuniao_id: meetingId };
      if (editId) body.id = editId;

      const res = await fetch('/api/admin/limpeza', {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        fetchItems();
        closeModal();
      } else { const result = await res.json(); throw new Error(result.error || result.message || 'Erro ao salvar limpeza.'); }
    } catch (error) {
      setError(error.message);
    }
  };

  const openNewModal = () => {
      if (!canEdit) return;
      setEditId(null);
      setMeetingId(null);
      setDate('');
      setTasks('');
      setGroup('');
      setResponsibles('');
      setIsModalOpen(true);
  };

  const openEditModal = (item) => {
      if (!canEdit) return;
      setEditId(item.id);
      setMeetingId(item.reuniao_id);
      setDate(new Date(item.data).toISOString().split('T')[0]);
      setTasks(item.tarefas || '');
      setGroup(item.grupo || '');
      setResponsibles(item.responsaveis || '');
      setIsModalOpen(true);
  };

  const closeModal = () => {
      setIsModalOpen(false);
      setEditId(null);
      setMeetingId(null);
      setDate('');
      setTasks('');
      setGroup('');
      setResponsibles('');
  };

  const handleDelete = async (id) => {
    if (!canEdit) return;
    const response = await fetch(`/api/admin/limpeza?id=${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || result.message || 'Não foi possível excluir a designação de limpeza.');
    }
    await fetchItems();
  };

  return (
    <div className="w-full min-w-0 space-y-4 text-gray-900 font-medium">
      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{error}</p>}
      <div className={designationToolbarClass}>
        <div className="flex-1 min-w-0 basis-64">
          <h2 className="text-lg font-bold text-gray-900">Limpeza Semanal</h2>
          <p className="text-sm text-gray-500 mt-1">Organize os grupos e as tarefas de cada reunião.</p>
        </div>
        <Button onClick={openNewModal} disabled={!canEdit} className={`${designationActionClass} bg-purple-600 hover:bg-purple-700 text-white`}>
          <Plus className="w-4 h-4" /> Nova designação
        </Button>
      </div>
      {!canEdit && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
          Você não tem permissão para editar a limpeza semanal.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className={designationListHeaderClass}>
          <h3 className="flex items-center gap-2 text-base font-bold">
            <CalendarIcon className="w-5 h-5 text-gray-500" /> Programação de limpeza
          </h3>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
            <DesignationPeriodFilters years={items.map(item => item.data.slice(0, 4))} onClear={() => setFilterGroup('all')} hasAdditionalFilters={filterGroup !== 'all'} />
            <select aria-label="Grupo da limpeza" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
              className="h-10 w-full sm:w-40 min-w-0 border border-gray-300 rounded-md px-3 bg-white text-sm text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none">
              <option value="all">Todos os grupos</option>
              {availableGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
        {loading ? (
          <div role="status" aria-label="Carregando limpeza" className="py-12"><Loader2 className="animate-spin mx-auto text-purple-600 w-8 h-8" /></div>
        ) : items.length === 0 ? (
          <p className="text-center py-12 px-4 text-sm text-gray-500">Nenhuma designação encontrada para este período.</p>
        ) : (
          <div className="p-4 space-y-3 md:p-0 md:space-y-0 md:divide-y md:divide-gray-100">
            {items.map(item => {
              const meetingDate = new Date(`${item.data.slice(0, 10)}T12:00:00Z`);
              const dateLabel = meetingDate.toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
              const status = item.cancelado ? `Cancelada: ${item.motivo_cancelamento || 'Reunião cancelada'}` : !item.grupo || !item.tarefas ? 'Designações pendentes' : 'Designação completa';
              const statusClass = `text-xs ${item.cancelado ? 'text-red-600' : 'text-purple-600'}`;
              const deleteButton = canEdit && item.id && !item.cancelado && (
                <button type="button" onClick={() => setPendingDelete(item)} aria-label={`Excluir limpeza de ${dateLabel}`}
                  className="shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              );
              return <div key={item.id || `reuniao-${item.reuniao_id}`}>
                <div className="hidden md:flex items-center pr-4">
                  <button type="button" onClick={() => openEditModal(item)} disabled={!canEdit || item.cancelado}
                    aria-label={`Designar limpeza de ${dateLabel}`}
                    className="flex flex-1 min-w-0 items-center gap-4 px-4 py-3 text-left hover:bg-purple-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500 disabled:cursor-default">
                    <span className="flex items-center justify-center shrink-0 w-10 h-10 rounded-full bg-purple-100 text-purple-600 font-bold">{item.data.slice(8, 10)}</span>
                    <span className="flex-1 min-w-0 space-y-1">
                      <span className="block text-base font-semibold">{item.grupo || 'Grupo a definir'}</span>
                      <span className="block text-sm text-gray-500">{dateLabel}</span>
                      <span className={`block ${statusClass}`}>{status}</span>
                      {item.tarefas && <span className="block text-sm text-gray-600 line-clamp-1">{item.tarefas}</span>}
                      {item.responsaveis && <span className="block text-xs text-gray-500 line-clamp-1">Responsáveis: {item.responsaveis}</span>}
                    </span>
                    {!item.cancelado && <ChevronRight className="w-5 h-5 shrink-0 text-gray-400" />}
                  </button>
                  {deleteButton}
                </div>
                <Card className="md:hidden border-gray-200">
                  <CardHeader className="p-4 pb-3 border-b border-gray-100">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <CalendarIcon className="w-4 h-4 shrink-0 text-purple-600" />
                        {meetingDate.toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' })}
                      </CardTitle>
                      {deleteButton}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <p className={statusClass}>{status}</p>
                    <p className="flex items-center gap-2 text-base"><Users className="w-4 h-4 shrink-0 text-gray-400" />{item.grupo || 'Grupo a definir'}</p>
                    {item.tarefas && <p className="text-sm text-gray-600 break-words">{item.tarefas}</p>}
                    {item.responsaveis && <p className="text-xs text-gray-500 break-words">Responsáveis: {item.responsaveis}</p>}
                    {!item.cancelado && <Button disabled={!canEdit} onClick={() => openEditModal(item)} variant="outline" className="h-10 w-full text-purple-700">
                      {item.id ? 'Editar designação' : 'Designar limpeza'}
                    </Button>}
                  </CardContent>
                </Card>
              </div>;
            })}
          </div>
        )}
      </div>

      {pendingDelete && <ConfirmationDialog destructive title="Excluir designação de limpeza?" confirmLabel="Excluir"
        description={`A designação do grupo ${pendingDelete.grupo || 'não definido'} em ${pendingDelete.data.slice(0, 10).split('-').reverse().join('/')} será removida. A reunião continuará no calendário para uma nova designação.`}
        onConfirm={() => handleDelete(pendingDelete.id)} onCancel={() => setPendingDelete(null)} />}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto bg-white text-gray-900 font-medium">
            <DialogHeader>
                <DialogTitle>{editId ? 'Editar Designação' : 'Nova Designação de Limpeza'}</DialogTitle>
                <DialogDescription>Preencha os dados da semana de limpeza.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data da Reunião (ou Semana)</Label>
                    <Input className="text-gray-900 font-medium" type="date" disabled={Boolean(meetingId)} value={date} onChange={e => setDate(e.target.value)} required />
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

                <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:space-x-0">
                    <Button type="button" variant="outline" onClick={closeModal} className="h-10 w-full">Cancelar</Button>
                    <Button type="submit" disabled={!canEdit} className="h-10 w-full bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50">
                        {editId ? 'Salvar Alterações' : 'Adicionar Designação'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
