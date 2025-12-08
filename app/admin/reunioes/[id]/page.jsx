'use client';

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { Checkbox } from '@/app/components/ui/checkbox';
import { StatusToast } from '@/app/components/ui/status-toast';
import { Search, Save, Loader2, ArrowLeft, Users, Video, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

export default function DetalheReuniaoPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState([]); // List of publishers with attendance status
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set()); // For bulk selection
  
  // Toast State
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('');

  // Stats
  const stats = useMemo(() => {
     return {
         presencial: data.filter(p => p.modalidade === 'Presencial').length,
         zoom: data.filter(p => p.modalidade === 'Zoom').length,
         total: data.filter(p => p.modalidade).length
     };
  }, [data]);

  useEffect(() => {
    async function fetchData() {
       try {
         const res = await fetch(`/api/admin/reunioes/${params.id}/assistencia`);
         if (res.ok) {
            const json = await res.json();
            setData(json);
         }
       } catch (err) {
         console.error(err);
         setToastMessage('Erro ao carregar dados.');
         setToastType('error');
         setShowToast(true);
       } finally {
         setLoading(false);
       }
    }
    fetchData();
  }, [params.id]);

  // Toast Timer
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handleStatusChange = (publicadorId, newStatus) => {
     setData(prev => prev.map(p => {
        if (p.publicador_id === publicadorId) {
            return { ...p, modalidade: newStatus === p.modalidade ? null : newStatus }; 
        }
        return p;
     }));
  };

  const handleBulkStatusChange = (newStatus) => {
      setData(prev => prev.map(p => {
          if (selectedIds.has(p.publicador_id)) {
              return { ...p, modalidade: newStatus };
          }
          return p;
      }));
      setSelectedIds(new Set()); // Clear selection after action
  };

  const handleToggleSelect = (id) => {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(id)) {
          newSelected.delete(id);
      } else {
          newSelected.add(id);
      }
      setSelectedIds(newSelected);
  };

  const handleSelectAll = (checked) => {
      if (checked) {
          const allIds = filteredData.map(p => p.publicador_id);
          setSelectedIds(new Set(allIds));
      } else {
          setSelectedIds(new Set());
      }
  };

  const handleSave = async () => {
     setSaving(true);
     const payload = data.map(p => ({
         publicador_id: p.publicador_id,
         modalidade: p.modalidade
     }));

     try {
        const res = await fetch(`/api/admin/reunioes/${params.id}/assistencia`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assistanceData: payload })
        });
        
        if (res.ok) {
            setToastMessage('Salvo com sucesso!');
            setToastType('success');
            setShowToast(true);
            setTimeout(() => {
               router.push('/admin/reunioes');
            }, 1000);
        } else {
            setToastMessage('Erro ao salvar.');
            setToastType('error');
            setShowToast(true);
        }
     } catch (err) {
        console.error(err);
        setToastMessage('Erro de conexão.');
        setToastType('error');
        setShowToast(true);
     } finally {
        setSaving(false);
     }
  };

  const filteredData = useMemo(() => {
     return data.filter(p => {
        const nameMatch = (p.nome_completo || '').toLowerCase().includes(searchTerm.toLowerCase());
        const groupMatch = filterGroup ? p.nome_grupo === filterGroup : true;
        return nameMatch && groupMatch;
     });
  }, [data, searchTerm, filterGroup]);
  
  const uniqueGroups = useMemo(() => [...new Set(data.map(p => p.nome_grupo).filter(Boolean))], [data]);

  if (loading) return (
    <DashboardLayout>
       <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-purple-600" /></div>
    </DashboardLayout> 
  );

  return (
    <DashboardLayout>
       {showToast && (
          <StatusToast 
            message={toastMessage} 
            type={toastType} 
            onClose={() => setShowToast(false)} 
          />
       )}
       
       <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between sticky top-0 bg-gray-50 z-10 py-4 border-b border-gray-200">
             <div className="flex items-center gap-4">
                <Link href="/admin/reunioes">
                   <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
                </Link>
                <div>
                   <h1 className="text-2xl font-bold text-gray-900">Registrar Assistência</h1>
                   <div className="flex gap-4 text-sm text-gray-600 mt-1">
                      <span className="flex items-center gap-1"><Users className="w-4 h-4 text-blue-600" /> Presencial: <strong>{stats.presencial}</strong></span>
                      <span className="flex items-center gap-1"><Video className="w-4 h-4 text-green-600" /> Zoom: <strong>{stats.zoom}</strong></span>
                      <span className="font-medium text-purple-700">Total: {stats.total}</span>
                   </div>
                </div>
             </div>
             <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 min-w-[120px]">
                {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar
             </Button>
          </div>
          
          {/* Filtros e Busca */}
          <div className="flex flex-col md:flex-row gap-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
             <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input 
                   placeholder="Buscar publicador..." 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="pl-10 text-gray-900" 
                />
             </div>
             <select 
                className="w-full md:w-1/3 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
             >
                <option value="">Todos os Grupos</option>
                {uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}
             </select>
          </div>

          {/* Bulk Actions Header */}
          {selectedIds.size > 0 && (
             <div className="flex items-center gap-4 p-3 bg-purple-50 border border-purple-200 rounded-lg animate-in fade-in slide-in-from-top-2">
                 <span className="text-sm font-medium text-purple-900">{selectedIds.size} selecionado(s)</span>
                 <div className="h-4 w-px bg-purple-200 mx-2" />
                 <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange('Presencial')} className="bg-white hover:bg-purple-100 border-purple-200 text-purple-700">
                    <Users className="w-3.5 h-3.5 mr-2" /> Marcar Presencial
                 </Button>
                 <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange('Zoom')} className="bg-white hover:bg-purple-100 border-purple-200 text-purple-700">
                    <Video className="w-3.5 h-3.5 mr-2" /> Marcar Zoom
                 </Button>
                 <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="ml-auto text-gray-500 hover:text-gray-700">
                    Cancelar
                 </Button>
             </div>
          )}

          {/* Lista de Chamada */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
             {/* List Header with Checkbox */}
             <div className="flex items-center p-4 bg-gray-50 border-b border-gray-200 font-medium text-sm text-gray-500">
                 <div className="mr-4">
                     <Checkbox 
                        checked={filteredData.length > 0 && selectedIds.size === filteredData.length}
                        onCheckedChange={handleSelectAll}
                     />
                 </div>
                 <div className="flex-1">Nome / Grupo</div>
                 <div className="w-[200px] text-center hidden sm:block">Ações</div>
             </div>

             {filteredData.map((pub) => (
                <div key={pub.publicador_id} className={`flex items-center justify-between p-4 border-b border-gray-100 last:border-0 transition-colors ${selectedIds.has(pub.publicador_id) ? 'bg-purple-50/50' : 'hover:bg-gray-50'}`}>
                   <div className="mr-4">
                       <Checkbox 
                          checked={selectedIds.has(pub.publicador_id)}
                          onCheckedChange={() => handleToggleSelect(pub.publicador_id)}
                       />
                   </div>
                   <div className="flex-1">
                      <div className="font-semibold text-gray-900">{pub.nome_completo}</div>
                      <div className="text-xs text-gray-500">{pub.nome_grupo || 'Sem Grupo'}</div>
                   </div>
                   
                   <div className="flex gap-2">
                      <button 
                         onClick={() => handleStatusChange(pub.publicador_id, 'Presencial')}
                         className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                             pub.modalidade === 'Presencial' 
                               ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' 
                               : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                         }`}
                      >
                         <Users className="w-4 h-4" /> <span className="hidden sm:inline">Presencial</span>
                      </button>
                      
                      <button 
                         onClick={() => handleStatusChange(pub.publicador_id, 'Zoom')}
                         className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                             pub.modalidade === 'Zoom' 
                               ? 'bg-green-100 text-green-700 ring-1 ring-green-300' 
                               : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                         }`}
                      >
                         <Video className="w-4 h-4" /> <span className="hidden sm:inline">Zoom</span>
                      </button>
                   </div>
                </div>
             ))}
             {filteredData.length === 0 && (
                <div className="p-8 text-center text-gray-500">Nenhum publicador encontrado.</div>
             )}
          </div>
       </div>
    </DashboardLayout>
  );
}
