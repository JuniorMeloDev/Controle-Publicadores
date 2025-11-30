// app/admin/gerenciar/page.jsx

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {DashboardLayout} from '@/app/components/DashboardLayout'; 
import FiltroELista from '@/app/componentes/FiltroELista';
import DetalhesPublicador from '@/app/componentes/DetalhesPublicador/DetalhesPublicador';
import FormularioCadastro from '@/app/componentes/DetalhesPublicador/FormularioCadastro';
import { Loader2, X, Shuffle } from 'lucide-react'; 
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose 
} from "@/app/components/ui/sheet";
import TrocaGrupoSheet from '@/app/componentes/TrocaGrupoSheet'; 

function getShortName(fullName) {
    if (!fullName || typeof fullName !== 'string') return '';
    const parts = fullName.split(' ').filter(Boolean);
    if (parts.length === 1) return fullName;
    return `${parts[0]} ${parts[parts.length - 1]}`;
}

function GerenciarContent() {
  const [publicadores, setPublicadores] = useState([]);
  const [gruposList, setGruposList] = useState([]); 
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [selectedPublicadorId, setSelectedPublicadorId] = useState(null);
  const [modoNovo, setModoNovo] = useState(false);
  
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // --- ESTADOS PARA TROCA DE GRUPO ---
  const [isTransferSheetOpen, setIsTransferSheetOpen] = useState(false);
  // ------------------------------------

  const searchParams = useSearchParams();

  const fetchPublicadores = async () => {
      setIsLoadingList(true);
      try {
        const res = await fetch('/api/admin/get-publicadores', { cache: 'no-store' });
        if (!res.ok) throw new Error('Falha ao buscar publicadores');
        const data = await res.json();
        
        const publicadoresFormatados = data.map(p => ({
            ...p,
            nome_curto: p.nome_chamado ? p.nome_chamado : getShortName(p.nome_completo)
        }));

        setPublicadores(publicadoresFormatados);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingList(false);
      }
  };
  
  const fetchGrupos = async () => {
     try {
        const res = await fetch('/api/get-grupos');
        if (res.ok) {
            const data = await res.json();
            setGruposList(data);
        }
     } catch (err) {
        console.error("Erro ao carregar grupos", err);
     }
  };

  useEffect(() => { 
    fetchPublicadores(); 
    fetchGrupos(); 
  }, []);

  useEffect(() => {
    const idNaUrl = searchParams.get('id');
    if (idNaUrl) {
      setSelectedPublicadorId(idNaUrl);
    }
  }, [searchParams]);

  const handleSelect = (id) => { 
    setSelectedPublicadorId(id); 
    setModoNovo(false); 
    setSuccessMessage(null); 
    setErrorMessage(null); 
    setIsTransferSheetOpen(false);
  };

  const handleNovoPublicador = () => { 
    setSelectedPublicadorId(null); 
    setModoNovo(true); 
    setSuccessMessage(null); 
    setErrorMessage(null); 
    setIsTransferSheetOpen(false);
  };

  // FUNÇÃO QUE É CHAMADA PELO BOTÃO DE TROCA
  const handleStartTransfer = () => {
    setSelectedPublicadorId(null); 
    setModoNovo(false); 
    setIsTransferSheetOpen(true); // Abre o modal de transferência
  };

  const handleCloseDrawer = () => { 
    setSuccessMessage(null); 
    setErrorMessage(null); 
    setSelectedPublicadorId(null); 
    setModoNovo(false); 
    setIsTransferSheetOpen(false);
  };

  const handleSaveSuccess = ({ message, isError, keepOpen = false }) => { 
    fetchPublicadores(); 
    if (isError) { setErrorMessage(message); setSuccessMessage(null); } 
    else { setSuccessMessage(message); setErrorMessage(null); } 
    if (!keepOpen) handleCloseDrawer(); 
  };
  
  const handleTransferSuccess = (count) => {
    handleSaveSuccess({ 
        message: `${count} publicador(es) transferido(s) com sucesso.`, 
        isError: false, 
        keepOpen: false 
    });
  };

  const handleMessageDismiss = () => { setSuccessMessage(null); setErrorMessage(null); };

  const isSheetOpen = !!selectedPublicadorId || modoNovo || isTransferSheetOpen;

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-7rem)] bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          
          <div className="flex-1 flex flex-col bg-gray-50/30">
            {isLoadingList ? (
                <div className="flex-1 flex items-center justify-center gap-2 text-gray-500">
                <Loader2 className="animate-spin text-purple-600" /> Carregando...
                </div>
            ) : (
                <FiltroELista
                    publicadores={publicadores}
                    selectedId={selectedPublicadorId}
                    onPublicadorSelect={handleSelect}
                    onNovoPublicador={handleNovoPublicador}
                    onStartTransfer={handleStartTransfer} 
                />
            )}
          </div>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={(open) => !open && handleCloseDrawer()}>
        
        {/* Conteúdo Normal (Detalhes/Cadastro) */}
        {(!isTransferSheetOpen && isSheetOpen) && (
            <SheetContent 
                side="right" 
                className="w-full sm:max-w-lg md:max-w-xl lg:max-w-3xl p-0 border-l border-gray-200 bg-white focus:outline-none"
            >
                {/* CORREÇÃO DO ERRO DE ACESSIBILIDADE RADIX UI */}
                <SheetHeader className="sr-only">
                    <SheetTitle>
                        {modoNovo ? "Cadastrar Novo Publicador" : "Editar Publicador"}
                    </SheetTitle>
                    <SheetDescription>
                        Formulário para gerenciamento de dados do publicador.
                    </SheetDescription>
                </SheetHeader>
                
                {/* BOTÃO DE FECHAR VISÍVEL PARA USER EXPERIENCE E ACESSIBILIDADE */}
                <SheetClose 
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary" 
                    asChild
                >
                    <button onClick={handleCloseDrawer} aria-label="Fechar">
                         <X className="h-4 w-4" />
                    </button>
                </SheetClose>
                {/* FIM DA CORREÇÃO */}

                <div className="h-full w-full bg-white flex flex-col">
                    {modoNovo && (
                        <FormularioCadastro 
                            onSaveSuccess={(data) => handleSaveSuccess({ ...data, keepOpen: false })} 
                            onClose={handleCloseDrawer} 
                        />
                    )}

                    {selectedPublicadorId && !modoNovo && (
                        <DetalhesPublicador
                            publicadorId={selectedPublicadorId}
                            onSaveSuccess={handleSaveSuccess}
                            onClose={handleCloseDrawer}
                            persistedMessage={successMessage || errorMessage}
                            persistedError={!!errorMessage}
                            onMessageDismiss={handleMessageDismiss}
                        />
                    )}
                </div>
            </SheetContent>
        )}
        
        {/* Conteúdo do Modal de Troca de Grupo */}
        {isTransferSheetOpen && (
             <SheetContent 
                side="right" 
                className="w-full sm:max-w-lg p-0 border-l border-gray-200 bg-white focus:outline-none"
            >
                <SheetHeader className="p-4 border-b border-gray-200">
                    <SheetTitle className="text-xl font-bold text-gray-900">
                        Trocar Publicadores de Grupo
                    </SheetTitle>
                    <SheetDescription className="text-sm text-gray-500">
                       Selecione os publicadores para transferência.
                    </SheetDescription>
                </SheetHeader>
                <SheetClose asChild>
                    <button 
                        onClick={handleCloseDrawer} 
                        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary"
                    >
                         <X className="h-4 w-4" />
                         <span className="sr-only">Fechar</span>
                    </button>
                </SheetClose>
                
                <TrocaGrupoSheet
                    publicadores={publicadores}
                    gruposList={gruposList}
                    onTransferSuccess={handleTransferSuccess}
                />
            </SheetContent>
        )}
      </Sheet>

    </DashboardLayout>
  );
}

export default function GerenciarPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-purple-600"/></div>}>
      <GerenciarContent />
    </Suspense>
  );
}