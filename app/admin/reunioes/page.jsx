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


export default function ReunioesPage() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newMeetingDate, setNewMeetingDate] = useState('');
  const [newMeetingType, setNewMeetingType] = useState('Meio de Semana');
  const [creating, setCreating] = useState(false);

  async function fetchMeetings() {
    try {
      const res = await fetch('/api/admin/reunioes');
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch (error) {
      console.error('Erro ao buscar reuniões:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleCreateMeeting = async () => {
    if (!newMeetingDate) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/reunioes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: newMeetingDate, tipo: newMeetingType })
      });
      
      if (res.ok) {
        setIsDialogOpen(false);
        setNewMeetingDate('');
        fetchMeetings();
      } else {
        alert('Erro ao criar reunião. Verifique se já existe uma nesta data.');
      }
    } catch (error) {
       console.error(error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
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
             <DialogContent>
               <DialogHeader>
                 <DialogTitle>Registrar Nova Reunião</DialogTitle>
               </DialogHeader>
               <div className="space-y-4 py-4">
                 <div className="space-y-2">
                   <Label>Data da Reunião</Label>
                   <Input 
                      type="date" 
                      value={newMeetingDate} 
                      onChange={(e) => setNewMeetingDate(e.target.value)} 
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>Tipo</Label>
                   <select 
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newMeetingType}
                      onChange={(e) => setNewMeetingType(e.target.value)}
                   >
                     <option value="Meio de Semana">Meio de Semana</option>
                     <option value="Fim de Semana">Fim de Semana</option>
                     <option value="Especial">Especial</option>
                   </select>
                 </div>
               </div>
               <DialogFooter>
                 <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                 <Button onClick={handleCreateMeeting} disabled={creating} className="bg-purple-600">
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
