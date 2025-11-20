'use client';

import { useState, useEffect } from 'react';
import FiltroELista from '@/app/componentes/FiltroELista';
import DetalhesPublicador from '@/app/componentes/DetalhesPublicador/DetalhesPublicador';
import FormularioCadastro from '@/app/componentes/DetalhesPublicador/FormularioCadastro';

export default function GerenciarPage() {
  const [publicadores, setPublicadores] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [selectedPublicadorId, setSelectedPublicadorId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [modoNovo, setModoNovo] = useState(false);
  
  // --- NOVOS ESTADOS PARA MENSAGEM PERSISTENTE ---
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
      console.error('Erro ao buscar publicadores:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchPublicadores();
  }, []);

  const handleSelect = (id) => {
    setSelectedPublicadorId(id);
    setModoNovo(false);
    setIsDrawerOpen(true);
    // Limpa a mensagem ao trocar de publicador
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleNovoPublicador = () => {
    setSelectedPublicadorId(null);
    setModoNovo(true);
    setIsDrawerOpen(true);
    // Limpa a mensagem ao iniciar novo cadastro
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    // Limpa a mensagem ao fechar o drawer
    setSuccessMessage(null);
    setErrorMessage(null);
    setTimeout(() => {
      setSelectedPublicadorId(null);
      setModoNovo(false);
    }, 150);
  };

  // --- FUNÇÃO ATUALIZADA PARA RECEBER A MENSAGEM DO FILHO ---
  const handleSaveSuccess = ({ message, isError, keepOpen = false }) => {
    fetchPublicadores(); // Recarrega a lista
    
    if (isError) {
      setErrorMessage(message);
      setSuccessMessage(null);
    } else {
      setSuccessMessage(message);
      setErrorMessage(null);
    }

    if (!keepOpen) {
      handleCloseDrawer();
    }
  };

  // Função para limpar a mensagem quando o usuário interage
  const handleMessageDismiss = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  if (isLoadingList) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-900">
        <div className="text-neutral-400">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-900 text-white overflow-hidden">
      
      {/* === PAINEL LATERAL: LISTA === */}
      <div className={`
        ${isDrawerOpen ? 'hidden' : 'flex w-full'} 
        md:flex md:w-96 h-full flex-col shrink-0 border-r border-neutral-800
      `}>
        <FiltroELista
          publicadores={publicadores}
          selectedId={selectedPublicadorId}
          onPublicadorSelect={handleSelect}
          onNovoPublicador={handleNovoPublicador}
        />
      </div>

      {/* === PAINEL PRINCIPAL: DETALHES OU NOVO === */}
      <div className={`
        ${isDrawerOpen ? 'flex w-full' : 'hidden'} 
        md:flex md:flex-1 h-full flex-col overflow-hidden
      `}>
        {/* Estado vazio */}
        {!selectedPublicadorId && !modoNovo && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-neutral-400 text-lg">Selecione um publicador ou clique em Novo Publicador</p>
            </div>
          </div>
        )}

        {modoNovo && (
          <FormularioCadastro 
            // Modificado para passar o formato de objeto {message, isError}
            onSaveSuccess={(data) => handleSaveSuccess({ ...data, keepOpen: false })} 
            onClose={handleCloseDrawer} 
          />
        )}

        {selectedPublicadorId && !modoNovo && (
          <DetalhesPublicador
            publicadorId={selectedPublicadorId}
            // --- PASSANDO MENSAGENS E HANDLERS PARA O FILHO ---
            onSaveSuccess={handleSaveSuccess}
            onClose={handleCloseDrawer}
            persistedMessage={successMessage || errorMessage} // A mensagem a ser exibida
            persistedError={!!errorMessage} // O status (é erro ou não?)
            onMessageDismiss={handleMessageDismiss}
          />
        )}
      </div>
    </div>
  );
}