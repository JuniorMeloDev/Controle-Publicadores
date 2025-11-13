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

  // 🔄 Buscar todos os publicadores
  const fetchPublicadores = async () => {
    setIsLoadingList(true);
    try {
      // Adicionado cache: 'no-store' aqui também por segurança
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
    setSelectedPublicadorId(null);
    setModoNovo(false);
  };

  const handleSaveSuccess = (keepOpen = false) => {
    fetchPublicadores();
    // Se keepOpen for true, apenas atualiza a lista e mantém o drawer aberto
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
    <div className="flex min-h-screen bg-neutral-900 text-white overflow-hidden">
      {/* === PAINEL LATERAL: LISTA === */}
      <div className="w-96 border-r border-neutral-800 flex flex-col shrink-0">
        <FiltroELista
          publicadores={publicadores}
          selectedId={selectedPublicadorId}
          onPublicadorSelect={handleSelect}
          onNovoPublicador={handleNovoPublicador}
        />
      </div>

      {/* === PAINEL PRINCIPAL: DETALHES OU NOVO === */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!isDrawerOpen && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-neutral-400 text-lg">Selecione um publicador ou clique em Novo Publicador</p>
            </div>
          </div>
        )}

        {isDrawerOpen && modoNovo && (
          <FormularioCadastro onSaveSuccess={handleSaveSuccess} onClose={handleCloseDrawer} />
        )}

        {isDrawerOpen && !modoNovo && selectedPublicadorId && (
          <DetalhesPublicador
            key={selectedPublicadorId} // <-- ESTA É A CORREÇÃO CRÍTICA
            publicadorId={selectedPublicadorId}
            onSaveSuccess={handleSaveSuccess}
            onClose={handleCloseDrawer}
          />
        )}
      </div>
    </div>
  );
}