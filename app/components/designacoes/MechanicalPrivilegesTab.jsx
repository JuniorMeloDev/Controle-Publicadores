'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Calendar, Settings, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { PublisherCombobox } from '@/app/components/reunioes/PublisherCombobox';
import { PrivilegeTypesModal } from '@/app/components/designacoes/PrivilegeTypesModal';
import { usePermissions } from '@/app/components/PermissionsContext';
import { isAllowed } from '@/app/lib/access-control';

// Helper to format date
const formatDate = (dateStr) => {
    if(!dateStr) return '';
    try {
        const [y, m, day] = dateStr.split('T')[0].split('-');
        return `${day}/${m}/${y}`;
    } catch(e) { return dateStr; }
};

export function MechanicalPrivilegesTab() {
  const { permissions } = usePermissions();
  const canEdit = isAllowed(permissions, 'privilegios_mecanicos_editar', 'actions');
  const [meetings, setMeetings] = useState([]);
  const [publishers, setPublishers] = useState([]);
  const [privilegeTypes, setPrivilegeTypes] = useState([]);
  const [assignments, setAssignments] = useState({}); // { [meetingId]: { [typeId]: publisherId } }
  
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  
  // Filter States
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(new Date().getFullYear()));

  // Types Modal
  const [isTypesModalOpen, setIsTypesModalOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setLoading(true);
    try {
        const [mRes, pRes, tRes] = await Promise.all([
            fetch('/api/admin/reunioes?limit=100'),
            fetch('/api/admin/get-publicadores'),
            fetch('/api/admin/privilegios/tipos')
        ]);
        
        if (mRes.ok) {
            const data = await mRes.json();
            const normalized = data.map(m => ({
                ...m,
                dataISO: m.data.split('T')[0]
            })).sort((a, b) => new Date(a.dataISO) - new Date(b.dataISO));
            setMeetings(normalized);
        }
        if (pRes.ok) setPublishers(await pRes.json());
        if (tRes.ok) setPrivilegeTypes(await tRes.json());
        
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // Reload types when changed in modal
  const refreshTypes = async () => {
      const res = await fetch('/api/admin/privilegios/tipos');
      if(res.ok) setPrivilegeTypes(await res.json());
  };

  // Filter Meetings
  const filteredMeetings = useMemo(() => {
    let list = meetings;
    if (month) list = list.filter(m => m.dataISO.split('-')[1] === month);
    if (year) list = list.filter(m => m.dataISO.split('-')[0] === year);
    return list;
  }, [meetings, month, year]);

  // Fetch assignments for filtered meetings (Effect)
  useEffect(() => {
    if (filteredMeetings.length > 0 && privilegeTypes.length > 0) {
        // Optimization: Fetch assignments for these meetings in batch? 
        // Or one by one. Backend supports get by single ID.
        // Let's implement a batch or just loop for now. 
        // Given typically < 10 meetings per month, Loop is fine.
        filteredMeetings.forEach(m => fetchAssignmentsHelper(m.id));
    }
  }, [filteredMeetings, privilegeTypes]); // Dependencies slightly loose to catch initial load

  async function fetchAssignmentsHelper(meetingId) {
      if (assignments[meetingId]) return; // Already loaded? Maybe need refresh if types changed?
      try {
          const res = await fetch(`/api/admin/privilegios/atribuicoes?reuniao_id=${meetingId}`);
          if (res.ok) {
              const data = await res.json();
              const map = {};
              data.forEach(a => {
                  map[a.privilegio_tipo_id] = a.publicador_id;
              });
              setAssignments(prev => ({ ...prev, [meetingId]: map }));
          }
      } catch (e) { console.error(e); }
  }

  // Update Local State
  const handleAssignmentChange = (meetingId, typeId, pubId) => {
      setAssignments(prev => ({
          ...prev,
          [meetingId]: {
              ...(prev[meetingId] || {}),
              [typeId]: pubId
          }
      }));
  };

  const handleSave = async (meeting) => {
      if (!canEdit) return;
      setSavingId(meeting.id);
      try {
          // Construct Payload
          const meetingAssignments = assignments[meeting.id] || {};
          const payload = Object.entries(meetingAssignments).map(([typeId, pubId]) => ({
              tipo_id: parseInt(typeId),
              publicador_id: pubId
          }));

          const res = await fetch('/api/admin/privilegios/atribuicoes', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                  reuniao_id: meeting.id,
                  assignments: payload
              })
          });

          if (res.ok) {
              // Maybe show toast
          } else {
              alert('Erro ao salvar');
          }
      } catch(e) { console.error(e); }
      finally { setSavingId(null); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full flex flex-col gap-8">
       {/* HEADER */}
       <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Privilégios Mecânicos</h1>
                <p className="text-gray-500 text-sm mt-1">Gerencie ou crie privilégios mecânicos das reuniões.</p>
            </div>
            
            <Button 
                variant="outline"
                onClick={() => setIsTypesModalOpen(true)}
                disabled={!canEdit}
                className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
                <Settings className="w-4 h-4" />
                Gerenciar Tipos de Privilégios
            </Button>
       </div>

       {!canEdit && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
            Você não tem permissão para editar privilégios mecânicos.
          </div>
       )}

       <PrivilegeTypesModal 
            open={isTypesModalOpen} 
            onOpenChange={setIsTypesModalOpen} 
            onUpdate={refreshTypes} 
       />

       {/* CONTENT */}
       <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-[500px]">
            {/* TOOLBAR */}
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                 <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    <Calendar size={20} className="text-gray-500" />
                    Reuniões
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
                        {Array.from(new Set(meetings.map(m => m.dataISO.split('-')[0]))).sort().reverse().map(y => (
                             <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                 </div>
            </div>
            
            <div className="flex-1 p-6 md:p-8 bg-gray-50/30">
                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-purple-600" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredMeetings.length === 0 && (
                             <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                                <AlertCircle size={48} className="mb-4 opacity-20" />
                                <p>Nenhuma reunião encontrada com os filtros atuais.</p>
                             </div>
                        )}
                        {filteredMeetings.map(meeting => (
                            <Card key={meeting.id} className="border-l-4 border-l-purple-500 shadow-sm transition-shadow hover:shadow-md bg-white">
                                <CardHeader className="bg-gray-50/50 pb-3 border-b border-gray-100 flex flex-row items-center justify-between space-y-0 pr-4">
                                     <div>
                                        <CardTitle className="text-gray-900 font-bold text-lg">{formatDate(meeting.dataISO)}</CardTitle>
                                        <CardDescription className="text-purple-600 font-medium text-xs mt-1 uppercase tracking-wide">{meeting.tipo}</CardDescription>
                                     </div>
                                     <Button 
                                        size="sm"
                                        onClick={() => handleSave(meeting)}
                                        disabled={savingId === meeting.id || !canEdit}
                                        className={`h-8 transition-colors ${
                                            savingId === meeting.id 
                                            ? 'bg-purple-100 text-purple-700' 
                                            : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                                        }`}
                                     >
                                        {savingId === meeting.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                                        {savingId === meeting.id ? 'Salvando' : 'Salvar'}
                                     </Button>
                                </CardHeader>
                                <CardContent className={`pt-4 space-y-3 ${!canEdit ? 'pointer-events-none opacity-60' : ''}`}>
                                    {privilegeTypes.length === 0 && <p className="text-sm text-gray-400 italic">Nenhum privilégio cadastrado.</p>}
                                    {privilegeTypes.map(type => (
                                        <PublisherCombobox 
                                            key={type.id}
                                            label={type.nome}
                                            publishers={publishers}
                                            value={(assignments[meeting.id] || {})[type.id]}
                                            onChange={(val) => handleAssignmentChange(meeting.id, type.id, val)}
                                        />
                                    ))}
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
