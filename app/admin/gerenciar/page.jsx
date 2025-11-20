'use client';

import { useState, useEffect } from 'react';
// --- CORREÇÃO DO IMPORT: Adicionado @/app ---
import { DashboardLayout } from '@/app/components/DashboardLayout';
import FiltroELista from '@/app/componentes/FiltroELista';
import DetalhesPublicador from '@/app/componentes/DetalhesPublicador/DetalhesPublicador';
import FormularioCadastro from '@/app/componentes/DetalhesPublicador/FormularioCadastro';
import { Loader2, UserPlus, Users } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
// --- CORREÇÃO DO IMPORT: Adicionado @/app ---
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/app/components/ui/sheet";

export default function GerenciarPage() {
  const [publicadores, setPublicadores] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [selectedPublicadorId, setSelectedPublicadorId] = useState(null);
  const [modoNovo, setModoNovo] = useState(false);
  
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchPublicadores = async () => {
      setIsLoadingList(true);
      try {
        const res = await fetch('/api/admin/get-publicadores', { cache: 'no-store' });
        if (!res.ok) throw new Error('Falha ao buscar publicadores');
        const data = await res.json();
        setPublicadores(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingList(false);
      }
  };

  useEffect(() => { fetchPublicadores(); }, []);

  const handleSelect = (id) => { 
    setSelectedPublicadorId(id); 
    setModoNovo(false); 
    setSuccessMessage(null); 
    setErrorMessage(null); 
  };

  const handleNovoPublicador = () => { 
    setSelectedPublicadorId(null); 
    setModoNovo(true); 
    setSuccessMessage(null); 
    setErrorMessage(null); 
  };

  const handleCloseDrawer = () => { 
    setSuccessMessage(null); 
    setErrorMessage(null); 
    setSelectedPublicadorId(null); 
    setModoNovo(false); 
  };

  const handleSaveSuccess = ({ message, isError, keepOpen = false }) => { 
    fetchPublicadores(); 
    if (isError) { setErrorMessage(message); setSuccessMessage(null); } 
    else { setSuccessMessage(message); setErrorMessage(null); } 
    if (!keepOpen) handleCloseDrawer(); 
  };

  const handleMessageDismiss = () => { setSuccessMessage(null); setErrorMessage(null); };

  // Variável para controlar se o Sheet está aberto
  const isSheetOpen = !!selectedPublicadorId || modoNovo;

  return (
    <DashboardLayout>
      {/* Container Principal da Lista */}
      <div className="flex h-[calc(100vh-7rem)] bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          
          {/* LISTA (Ocupa toda a largura aqui, pois o detalhe abre por cima) */}
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
                />
            )}
          </div>
      </div>

      {/* --- DRAWER DESLIZANTE (SHEET) --- */}
      <Sheet open={isSheetOpen} onOpenChange={(open) => !open && handleCloseDrawer()}>
        <SheetContent 
            side="right" 
            className="w-full sm:max-w-lg md:max-w-xl lg:max-w-3xl p-0 border-l border-gray-200 bg-white focus:outline-none"
        >
            {/* --- CORREÇÃO IMPORTANTE: Título e Descrição para Acessibilidade --- */}
            {/* A classe 'sr-only' esconde o texto visualmente mas o mantém acessível, corrigindo o erro */}
            <SheetHeader className="sr-only">
              <SheetTitle>
                {modoNovo ? "Cadastrar Novo Publicador" : "Editar Publicador"}
              </SheetTitle>
              <SheetDescription>
                Formulário para gerenciamento de dados do publicador.
              </SheetDescription>
            </SheetHeader>
            {/* ----------------------------------------------------------------- */}

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
      </Sheet>

    </DashboardLayout>
  );
}