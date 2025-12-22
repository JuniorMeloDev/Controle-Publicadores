'use client';

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox'; // Assuming you have/will create this, or use standard input
import { Loader2, Search, Printer, FileText, CheckSquare, Square, Users, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import S21Card from '@/app/components/relatorios/S21Card';

import { useSearchParams, useRouter } from 'next/navigation';

import { Suspense } from 'react';

function RelatoriosContent() {
   const router = useRouter();
   const searchParams = useSearchParams();
   const [publicadores, setPublicadores] = useState([]);
   const [grupos, setGrupos] = useState([]);
   const [loading, setLoading] = useState(true);
   const [checkingAuth, setCheckingAuth] = useState(true); // Estágio de verificação de permissão

   // Verificação de Acesso (Apenas Anciãos)
   useEffect(() => {
      const checkAuth = async () => {
         try {
            const res = await fetch('/api/usuario-atual');
            if (res.ok) {
               const user = await res.json();
               if (!user.isAnciao) {
                  // Se não for ancião, redireciona
                  router.push('/admin/relatorios');
                  return;
               }
            }
         } catch (error) {
            console.error("Erro ao verificar permissão", error);
         } finally {
            setCheckingAuth(false);
         }
      };
      checkAuth();
   }, [router]);

   // Estados de Filtro e Seleção
   const [searchTerm, setSearchTerm] = useState('');
   const [selectedGroup, setSelectedGroup] = useState('');
   const [selectedIds, setSelectedIds] = useState(new Set());

   // Auto-Select from URL
   useEffect(() => {
      if (!loading && publicadores.length > 0) {
         const idParam = searchParams.get('id');
         if (idParam) {
            const pubExists = publicadores.find(p => p.id === idParam || p.id === parseInt(idParam));
            if (pubExists) {
               setSelectedIds(new Set([pubExists.id]));
               // Optional: Filter to show only this one or just highlight? 
               // Let's filter the view to this publisher too for clarity
               setSearchTerm(pubExists.nome_completo);
            }
         }
      }
   }, [loading, publicadores, searchParams]);

   // Estado de Impressão
   const [isPrinting, setIsPrinting] = useState(false);
   const [printData, setPrintData] = useState(null); // { [id]: { info, reports } }

   // Ano de Serviço para impressão (Padrão: Atual)
   const currentServiceYear = new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear();
   const [printYear, setPrintYear] = useState(currentServiceYear);

   // --- CARREGAMENTO DE DADOS ---
   useEffect(() => {
      async function fetchData() {
         try {
            const [pubRes, grupoRes] = await Promise.all([
               fetch('/api/admin/get-publicadores'),
               fetch('/api/get-grupos')
            ]);

            if (pubRes.ok && grupoRes.ok) {
               const pubs = await pubRes.json();
               const grps = await grupoRes.json();
               setPublicadores(pubs);
               setGrupos(grps);
            }
         } catch (err) {
            console.error("Erro ao carregar dados", err);
         } finally {
            setLoading(false);
         }
      }
      fetchData();
   }, []);

   // --- FILTRAGEM ---
   const filteredPublicadores = useMemo(() => {
      return publicadores.filter(p => {
         const matchesSearch = (p.nome_completo || '').toLowerCase().includes(searchTerm.toLowerCase());
         const matchesGroup = selectedGroup ? p.nome_grupo === selectedGroup : true;
         return matchesSearch && matchesGroup;
      }).sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
   }, [publicadores, searchTerm, selectedGroup]);

   // --- SELEÇÃO ---
   const handleSelectOne = (id) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
   };

   const handleSelectAllFiltered = () => {
      const allIds = filteredPublicadores.map(p => p.id);
      // Se todos já estão selecionados, deseleciona. Se não, seleciona todos.
      const allSelected = allIds.every(id => selectedIds.has(id));

      const newSet = new Set(selectedIds);
      if (allSelected) {
         allIds.forEach(id => newSet.delete(id));
      } else {
         allIds.forEach(id => newSet.add(id));
      }
      setSelectedIds(newSet);
   };

   // --- IMPRESSÃO ---
   const handlePreparePrint = async () => {
      if (selectedIds.size === 0) return;

      setIsPrinting(true);
      try {
         const res = await fetch('/api/admin/relatorios-lote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publisherIds: Array.from(selectedIds) })
         });

         if (res.ok) {
            const data = await res.json();
            setPrintData(data);
            // Aguarda renderização e chama print
            setTimeout(() => {
               window.print();
               setIsPrinting(false); // Retorna ao estado normal após print dialog fechar (ou imediatamente)
            }, 500);
         }
      } catch (err) {
         console.error("Erro ao preparar impressão", err);
         setIsPrinting(false);
      }
   };

   if (loading || checkingAuth) return (
      <DashboardLayout>
         <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-purple-600" /></div>
      </DashboardLayout>
   );

   return (
      <DashboardLayout>
         {/* CONTEÚDO DA TELA (Escondido na impressão) */}
         <div className="space-y-6 print:hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <div className="flex items-center gap-4">
                  <Link href="/admin/relatorios">
                     <Button variant="ghost" size="icon" className="shrink-0 text-gray-700 hover:text-gray-900 hover:bg-gray-100">
                        <ArrowLeft className="w-5 h-5" />
                     </Button>
                  </Link>
                  <div>
                     <h1 className="text-2xl font-bold text-gray-900">Cartões de Publicador (S-21)</h1>
                     <p className="text-gray-500">Selecione publicadores para imprimir o registro.</p>
                  </div>
               </div>
               <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
                  <label className="text-sm font-medium text-gray-600 mr-2">Ano de Serviço:</label>
                  <select
                     value={printYear}
                     onChange={(e) => setPrintYear(e.target.value)}
                     className="border-none bg-transparent font-bold text-purple-700 outline-none cursor-pointer"
                  >
                     <option value={currentServiceYear}>{currentServiceYear}</option>
                     <option value={currentServiceYear - 1}>{currentServiceYear - 1}</option>
                     <option value={currentServiceYear - 2}>{currentServiceYear - 2}</option>
                  </select>
               </div>
            </div>

            <Card>
               <CardHeader className="pb-3 border-b border-gray-100">
                  <div className="flex flex-col md:flex-row gap-4 justify-between">
                     {/* BARRA DE FILTROS */}
                     <div className="flex flex-1 gap-2">
                        <div className="relative flex-1 max-w-sm">
                           <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                           <Input
                              placeholder="Buscar publicador..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-9 text-gray-500"
                           />
                        </div>
                        <select
                           value={selectedGroup}
                           onChange={(e) => setSelectedGroup(e.target.value)}
                           className="h-10 rounded-md border border-gray-200 text-gray-500 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                        >
                           <option value="">Todos os Grupos</option>
                           {grupos.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                     </div>

                     {/* BOTÕES DE AÇÃO */}
                     <div className="flex gap-2 items-center">
                        {selectedIds.size > 0 && (
                           <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedIds(new Set())}
                              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                           >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remover Selecionado(s)
                           </Button>
                        )}
                        <span className="text-sm text-gray-500 font-medium">
                           {selectedIds.size} selecionado(s)
                        </span>
                        <Button
                           onClick={handlePreparePrint}
                           disabled={selectedIds.size === 0 || isPrinting}
                           className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                           {isPrinting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
                           Imprimir Cartões
                        </Button>
                     </div>
                  </div>
               </CardHeader>
               <CardContent className="p-0">
                  <div className="rounded-md border-t border-gray-100">
                     {/* CABEÇALHO DA TABELA */}
                     <div className="grid grid-cols-[auto_1fr_auto] gap-4 p-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                        <div className="flex items-center pl-2">
                           <button onClick={handleSelectAllFiltered} className="hover:text-purple-600 transition-colors">
                              {filteredPublicadores.length > 0 && filteredPublicadores.every(p => selectedIds.has(p.id))
                                 ? <CheckSquare className="w-5 h-5 text-purple-600" />
                                 : <Square className="w-5 h-5 text-gray-400" />}
                           </button>
                        </div>
                        <div>Nome / Grupo</div>
                        <div className="pr-4">Status</div>
                     </div>

                     {/* LISTA DE PUBLICADORES */}
                     <div className="max-h-[600px] overflow-y-auto">
                        {filteredPublicadores.length === 0 ? (
                           <div className="p-8 text-center text-gray-500">Nenhum publicador encontrado.</div>
                        ) : (
                           filteredPublicadores.map(pub => (
                              <div
                                 key={pub.id}
                                 className={`grid grid-cols-[auto_1fr_auto] gap-4 p-3 border-b border-gray-100 items-center hover:bg-purple-50/50 transition-colors cursor-pointer ${selectedIds.has(pub.id) ? 'bg-purple-50' : ''}`}
                                 onClick={() => handleSelectOne(pub.id)}
                              >
                                 <div className="pl-2" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => handleSelectOne(pub.id)}>
                                       {selectedIds.has(pub.id)
                                          ? <CheckSquare className="w-5 h-5 text-purple-600" />
                                          : <Square className="w-5 h-5 text-gray-300" />}
                                    </button>
                                 </div>
                                 <div>
                                    <div className="font-medium text-gray-900">{pub.nome_completo}</div>
                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                       <Users className="w-3 h-3" /> {pub.nome_grupo || 'Sem Grupo'}
                                    </div>
                                 </div>
                                 <div className="pr-4">
                                    {pub.ativo !== false ? (
                                       <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Ativo</span>
                                    ) : (
                                       <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Inativo</span>
                                    )}
                                 </div>
                              </div>
                           ))
                        )}
                     </div>
                  </div>
               </CardContent>
            </Card>
         </div>

         {/* ÁREA DE IMPRESSÃO (Visível apenas na impressão) */}
         {printData && (
            <div className="printable-content hidden print:block fixed inset-0 w-full h-full bg-white z-[9999] overflow-visible p-0 m-0">
               {Array.from(selectedIds).map(id => {
                  const data = printData[id];
                  if (!data) return null;
                  return (
                     <S21Card
                        key={id}
                        publisherData={data}
                        serviceYear={printYear}
                     />
                  );
               })}
            </div>
         )}
      </DashboardLayout>
   );
}

export default function RelatoriosPage() {
   return (
      <Suspense fallback={
         <DashboardLayout>
            <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-purple-600" /></div>
         </DashboardLayout>
      }>
         <RelatoriosContent />
      </Suspense>
   );
}
