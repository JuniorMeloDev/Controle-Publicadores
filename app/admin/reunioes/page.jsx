'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Plus, Calendar, Users, Video, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/app/components/ui/dialog";
import { PublisherCombobox } from '@/app/components/reunioes/PublisherCombobox';
import { StatusToast } from '@/app/components/ui/status-toast';

export default function ReunioesPage() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newMeetingDate, setNewMeetingDate] = useState('');
  const [newMeetingType, setNewMeetingType] = useState('Meio de Semana');
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);
  
  // New State for Privileges
  const [publishers, setPublishers] = useState([]);
  const [privileges, setPrivileges] = useState({
     leitor_id: null,
     indicador_interno_id: null,
     indicador_externo_volante_id: null,
     indicador_externo_id: null,
     volante_id: null,
     anciao_apoio_id: null
  });

  async function fetchMeetings() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/reunioes');
      if (res.ok) {
        const data = await res.json();
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
    // Fetch publishers for the combobox
    fetch('/api/admin/get-publicadores').then(res => res.json()).then(setPublishers).catch(console.error);
  }, []);

  const handleCreateMeeting = async () => {
    if (!newMeetingDate) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/reunioes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            data: newMeetingDate, 
            tipo: newMeetingType,
            ...privileges
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setIsDialogOpen(false);
        setNewMeetingDate('');
        // Reset privileges
        setPrivileges({
            leitor_id: null,
            indicador_interno_id: null,
            indicador_externo_volante_id: null,
            indicador_externo_id: null,
            volante_id: null,
            anciao_apoio_id: null
        });
        setToast({ message: 'Reunião criada com sucesso!', type: 'success' });
        fetchMeetings();
      } else {
        setToast({ message: data.message || 'Erro ao criar reunião.', type: 'error' });
      }
    } catch (error) {
       console.error(error);
       setToast({ message: 'Erro de conexão.', type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <StatusToast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
           <div>
             <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Reuniões</h1>
             <p className="text-gray-500">Registre a assistência e acompanhe as métricas.</p>
           </div>
           
           <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
             <DialogTrigger asChild>
               <Button className="bg-purple-600 hover:bg-purple-700">
                 <Plus className="w-4 h-4 mr-2" /> Nova Reunião
               </Button>
             </DialogTrigger>
             <DialogContent className="bg-white sm:max-w-lg">
               <DialogHeader>
                 <DialogTitle className="text-lg font-semibold text-gray-900">Registrar Nova Reunião</DialogTitle>
               </DialogHeader>
               <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1">
                 <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <Label className="text-gray-700 font-medium">Data da Reunião</Label>
                       <Input 
                          type="date" 
                          value={newMeetingDate} 
                          onChange={(e) => setNewMeetingDate(e.target.value)} 
                          className="text-gray-900" 
                       />
                     </div>
                     <div className="space-y-2">
                       <Label className="text-gray-700 font-medium">Tipo</Label>
                       <select 
                          className="w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                          value={newMeetingType}
                          onChange={(e) => setNewMeetingType(e.target.value)}
                       >
                         <option value="Meio de Semana">Meio de Semana</option>
                         <option value="Fim de Semana">Fim de Semana</option>
                         <option value="Especial">Especial</option>
                       </select>
                     </div>
                 </div>

                 <div className="pt-4 border-t border-gray-100">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-600" />
                        Privilégios Mecânicos
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {newMeetingType === 'Fim de Semana' && (
                            <PublisherCombobox 
                                label="Leitor" 
                                publishers={publishers}
                                value={privileges.leitor_id}
                                onChange={(val) => setPrivileges(p => ({...p, leitor_id: val}))}
                            />
                        )}
                        <PublisherCombobox 
                            label="Indicador Int." 
                            publishers={publishers}
                            value={privileges.indicador_interno_id}
                            onChange={(val) => setPrivileges(p => ({...p, indicador_interno_id: val}))}
                        />
                        <PublisherCombobox 
                            label="Ind. Ext/Volante" 
                            publishers={publishers}
                            value={privileges.indicador_externo_volante_id}
                            onChange={(val) => setPrivileges(p => ({...p, indicador_externo_volante_id: val}))}
                        />
                        <PublisherCombobox 
                            label="Indicador Ext." 
                            publishers={publishers}
                            value={privileges.indicador_externo_id}
                            onChange={(val) => setPrivileges(p => ({...p, indicador_externo_id: val}))}
                        />
                        <PublisherCombobox 
                            label="Volante" 
                            publishers={publishers}
                            value={privileges.volante_id}
                            onChange={(val) => setPrivileges(p => ({...p, volante_id: val}))}
                        />
                        <PublisherCombobox 
                            label="Ancião de Apoio" 
                            publishers={publishers}
                            value={privileges.anciao_apoio_id}
                            onChange={(val) => setPrivileges(p => ({...p, anciao_apoio_id: val}))}
                        />
                    </div>
                 </div>
               </div>
               <DialogFooter>
                 <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-gray-300 text-gray-700 font-medium hover:bg-gray-50 hover:text-gray-900">Cancelar</Button>
                 <Button onClick={handleCreateMeeting} disabled={creating} className="bg-purple-600 hover:bg-purple-700 text-white">
                    {creating ? <Loader2 className="animate-spin w-4 h-4" /> : 'Criar'}
                 </Button>
               </DialogFooter>
             </DialogContent>
           </Dialog>
        </div>

        {loading ? (
           <div className="flex justify-center p-8"><Loader2 className="animate-spin text-purple-600" /></div>
        ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {meetings.map((meeting) => (
                <Link key={meeting.id} href={`/admin/reunioes/${meeting.id}`} className="block group">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer border-gray-200 group-hover:border-purple-300">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                           <CardDescription className="uppercase text-xs font-bold tracking-wider text-purple-600 mb-1">
                             {meeting.tipo}
                           </CardDescription>
                           <CardTitle className="text-gray-900">
                             {meeting.data_formatada}
                           </CardTitle>
                        </div>
                        <Calendar className="text-gray-300 w-5 h-5 group-hover:text-purple-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                       <div className="flex items-center gap-4 text-sm mt-2">
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Users className="w-4 h-4" />
                            <span className="font-semibold">{meeting.presencial || 0}</span>
                            <span className="text-xs text-gray-400">Presencial</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Video className="w-4 h-4" />
                            <span className="font-semibold">{meeting.zoom || 0}</span>
                            <span className="text-xs text-gray-400">Zoom</span>
                          </div>
                       </div>
                       <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                          <span>Total: <strong className="text-gray-900">{meeting.total || 0}</strong></span>
                          <span className="text-purple-600 font-medium group-hover:underline">Gerenciar Assistência &rarr;</span>
                       </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              
              {meetings.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                   <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                   <p>Nenhuma reunião registrada.</p>
                   <p className="text-sm">Clique em "Nova Reunião" para começar.</p>
                </div>
              )}
           </div>
        )}
      </div>
    </DashboardLayout>
  );
}
