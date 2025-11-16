'use client';

import { useState, useEffect } from 'react';
import FiltroELista from '@/componentes/FiltroELista';
import DetalhesPublicador from '@/componentes/DetalhesPublicador/DetalhesPublicador';
import FormularioCadastro from '@/componentes/DetalhesPublicador/FormularioCadastro';

export default function GerenciarPage() {
  const [publicadores, setPublicadores] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [selectedPublicadorId, setSelectedPublicadorId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [modoNovo, setModoNovo] = useState(false);

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
  };

  const handleNovoPublicador = () => {
    setSelectedPublicadorId(null);
    setModoNovo(true);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    // Um pequeno delay para a transição ficar suave antes de limpar o ID
    setTimeout(() => {
      setSelectedPublicadorId(null);
      setModoNovo(false);
    }, 150);
  };

  const handleSaveSuccess = (keepOpen = false) => {
    fetchPublicadores();
    if (!keepOpen) {
      handleCloseDrawer();
    }
  };

  if (isLoadingList) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-900">
        <div className="text-neutral-400">Carregando...</div>
      </div>
    );
  }

  return (
    // Layout principal: flex, altura da tela, overflow escondido
    <div className="flex h-screen bg-neutral-900 text-white overflow-hidden">
      
      {/* === PAINEL LATERAL: LISTA === */}
      {/* - Telas pequenas: Ocupa 100% da largura. É 'hidden' se o drawer estiver aberto.
        - Telas médias (md): Fica fixo em 'w-96' e 'flex' (sempre visível).
      */}
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
      {/* - Telas pequenas: Ocupa 100% da largura. É 'hidden' se o drawer estiver fechado.
        - Telas médias (md): Fica como 'flex-1' (ocupa o resto) e 'flex' (sempre visível).
      */}
      <div className={`
        ${isDrawerOpen ? 'flex w-full' : 'hidden'} 
        md:flex md:flex-1 h-full flex-col overflow-hidden
      `}>
        {/* Estado vazio (só aparece em desktop) */}
        {!selectedPublicadorId && !modoNovo && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-neutral-400 text-lg">Selecione um publicador ou clique em Novo Publicador</p>
            </div>
          </div>
        )}

        {modoNovo && (
          <FormularioCadastro 
            onSaveSuccess={handleSaveSuccess} 
            onClose={handleCloseDrawer} // Passa a função de fechar
          />
        )}

        {selectedPublicadorId && !modoNovo && (
          <DetalhesPublicador
            key={selectedPublicadorId}
            publicadorId={selectedPublicadorId}
            onSaveSuccess={handleSaveSuccess}
            onClose={handleCloseDrawer} // Passa a função de fechar
          />
        )}
      </div>
    </div>
  );
}