'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Users, Save, CheckCircle2, Menu } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Sheet, SheetContent, SheetTitle } from '@/app/components/ui/sheet';
import { PublisherCombobox } from '@/app/components/reunioes/PublisherCombobox';
import { HistorySidebar } from '@/app/components/designacoes/HistorySidebar';

// Helper to format date
const formatDate = (dateStr) => {
    if(!dateStr) return '';
    try {
        // Assume API returns correct format or ISO
        const d = new Date(dateStr);
        // data_formatada from backend might be DD/MM/YYYY
        // If dateStr is "2023-12-01"
        const [y, m, day] = dateStr.split('-');
        return `${day}/${m}/${y}`;
    } catch(e) { return dateStr; }
};

export function MechanicalPrivilegesTab() {
  const [meetings, setMeetings] = useState([]); // List of ALL meetings
  const [loading, setLoading] = useState(true);
  const [publishers, setPublishers] = useState([]);
  const [savingId, setSavingId] = useState(null);

  // Filter States - Default to Current Month/Year
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // State for selection
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Filtering
  const filteredMeetings = useMemo(() => {
    let list = meetings;
    if (month) {
        list = list.filter(m => m.dataISO.split('-')[1] === month);
    }
    if (year) {
        list = list.filter(m => m.dataISO.split('-')[0] === year);
    }
    return list;
  }, [meetings, month, year]);

  useEffect(() => {
      // Auto-select first meeting if none selected and filtered meetings exist
      // Priority: Select first from filtered list
      if (filteredMeetings.length > 0) {
           // Only change if current selection is NOT in the filtered list?
           // Or just default to first one when filter changes?
           // Let's keep it simple: if selection is null, pick first.
           if (!selectedMeetingId) setSelectedMeetingId(filteredMeetings[0].id);
      }
  }, [filteredMeetings]);

  async function fetchData() {
    setLoading(true);
    try {
        // Increase limit to ensuring we get recent history (e.g. 100 meetings ~ 1 year)
        const [mRes, pRes] = await Promise.all([
            fetch('/api/admin/reunioes?limit=100'),
            fetch('/api/admin/get-publicadores')
        ]);
        if (mRes.ok) {
            const data = await mRes.json();
            const normalized = data.map(m => ({
                ...m,
                dataISO: m.data.split('T')[0]
            }));
            const sorted = normalized.sort((a, b) => new Date(a.dataISO) - new Date(b.dataISO));
            setMeetings(sorted);
            // Don't auto-select here, let the effect handle it
        }
        if (pRes.ok) setPublishers(await pRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // Compute available years from ALL meetings (unfiltered) to pass to Sidebar
  const allYears = useMemo(() => {
    const years = new Set();
    meetings.forEach(m => {
        if (m.dataISO) years.add(m.dataISO.split('-')[0]);
    });
    return Array.from(years).sort().reverse();
  }, [meetings]);

  // Sidebar Items
  const sidebarItems = useMemo(() => {
    return filteredMeetings.map(m => ({
        id: m.id,
        date: m.dataISO,
        label: m.data_formatada || formatDate(m.dataISO),
        subLabel: m.tipo
    }));
  }, [filteredMeetings]);

  const handleSidebarSelect = (item) => {
    setSelectedMeetingId(item.id);
  };

  const handleUpdatePrivilege = (meetingId, field, publisherId) => {
      setMeetings(prev => prev.map(m => {
          if (m.id === meetingId) {
              return { ...m, [field]: publisherId };
          }
          return m;
      }));
  };

  const handleSave = async (meeting) => {
      setSavingId(meeting.id);
      try {
          const res = await fetch('/api/admin/reunioes/atualizar-privilegios', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  id: meeting.id,
                  leitor_id: meeting.leitor_id,
                  indicador_interno_id: meeting.indicador_interno_id,
                  indicador_externo_volante_id: meeting.indicador_externo_volante_id,
                  indicador_externo_id: meeting.indicador_externo_id,
                  volante_id: meeting.volante_id,
                  anciao_apoio_id: meeting.anciao_apoio_id
              })
          });
          
          if (res.ok) {
              // Success feedback could go here
          } else {
              alert('Erro ao salvar');
          }
      } catch (e) { console.error(e); }
      finally { setSavingId(null); }
  };

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-purple-600" /></div>;

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
                selectedId={selectedMeetingId}
                availableYearsProp={allYears}
            />
       </div>

       {/* MOBILE SIDEBAR */}
       <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetContent side="left" className="p-0 w-72">
                 <SheetTitle className="hidden">Histórico de Privilégios</SheetTitle>
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
                   <h2 className="font-bold text-gray-900 text-lg">Privilégios Mecânicos</h2>
                   <p className="text-sm text-gray-500">Defina os indicadores, volante e apoio.</p>
                </div>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50/30">
             <div className="max-w-4xl mx-auto">
                {!selectedMeeting ? (
                     <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                        <Users size={48} className="mb-4 opacity-20" />
                        <p>Selecione uma reunião para editar os privilégios.</p>
                     </div>
                ) : (
                    <Card key={selectedMeeting.id} className="border-l-4 border-l-purple-500 shadow-sm bg-white">
                        <CardHeader className="bg-gray-50/50 pb-3 border-b border-gray-100">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-gray-900 font-bold text-xl">{selectedMeeting.data_formatada}</CardTitle>
                                    <CardDescription className="text-purple-600 font-medium text-sm mt-1 uppercase tracking-wide">{selectedMeeting.tipo}</CardDescription>
                                </div>
                                <Button 
                                    onClick={() => handleSave(selectedMeeting)} 
                                    disabled={savingId === selectedMeeting.id}
                                    variant="outline"
                                    className="bg-white hover:bg-green-50 text-green-700 border-green-200 hover:border-green-300"
                                >
                                    {savingId === selectedMeeting.id ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4 mr-2" />}
                                    Salvar Alterações
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {selectedMeeting.tipo === 'Fim de Semana' && (
                                <div className="md:col-span-2">
                                <PublisherCombobox 
                                    label="Leitor de A Sentinela"
                                    publishers={publishers}
                                    value={selectedMeeting.leitor_id}
                                    onChange={(val) => handleUpdatePrivilege(selectedMeeting.id, 'leitor_id', val)}
                                />
                                </div>
                            )}
                            <PublisherCombobox 
                                label="Indicador Interno"
                                publishers={publishers}
                                value={selectedMeeting.indicador_interno_id}
                                onChange={(val) => handleUpdatePrivilege(selectedMeeting.id, 'indicador_interno_id', val)}
                            />
                            <PublisherCombobox 
                                label="Ind. Externo / Volante"
                                publishers={publishers}
                                value={selectedMeeting.indicador_externo_volante_id}
                                onChange={(val) => handleUpdatePrivilege(selectedMeeting.id, 'indicador_externo_volante_id', val)}
                            />
                            <PublisherCombobox 
                                label="Indicador Externo"
                                publishers={publishers}
                                value={selectedMeeting.indicador_externo_id}
                                onChange={(val) => handleUpdatePrivilege(selectedMeeting.id, 'indicador_externo_id', val)}
                            />
                            <PublisherCombobox 
                                label="Volante"
                                publishers={publishers}
                                value={selectedMeeting.volante_id}
                                onChange={(val) => handleUpdatePrivilege(selectedMeeting.id, 'volante_id', val)}
                            />
                            <div className="md:col-span-2 pt-4 border-t border-gray-100 mt-2">
                                <PublisherCombobox 
                                    label="Ancião de Apoio (Opcional)"
                                    publishers={publishers}
                                    value={selectedMeeting.anciao_apoio_id}
                                    onChange={(val) => handleUpdatePrivilege(selectedMeeting.id, 'anciao_apoio_id', val)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}
             </div>
          </div>
       </div>
    </div>
  );
}
