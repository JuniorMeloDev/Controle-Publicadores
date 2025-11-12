'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import FiltroELista from '@/componentes/FiltroELista';
import DetalhesPublicador from '@/componentes/DetalhesPublicador/DetalhesPublicador';

export default function GerenciarPage() {
  const [publicadores, setPublicadores] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [selectedPublicadorId, setSelectedPublicadorId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 🔄 Buscar todos os publicadores
  const fetchPublicadores = async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch('/api/admin/get-publicadores');
      if (!res.ok) throw new Error('Erro ao carregar publicadores');
      const data = await res.json();
      setPublicadores(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchPublicadores();
  }, []);

  const handleSelect = (id) => {
    setSelectedPublicadorId(id);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedPublicadorId(null);
  };

  return (
    <div className="flex w-full h-screen bg-neutral-900 text-white">
      {/* === LADO ESQUERDO: Lista e filtros === */}
      <div className="w-full md:w-1/3 lg:w-1/4 border-r border-neutral-800 bg-neutral-900 overflow-y-auto">
        {isLoadingList ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-6 animate-spin text-neutral-400" />
          </div>
        ) : (
          <FiltroELista
            publicadores={publicadores}
            selectedId={selectedPublicadorId}
            onPublicadorSelect={handleSelect}
          />
        )}
      </div>

      {/* === LADO DIREITO: Drawer / Detalhes === */}
      <div
        className={`fixed inset-0 md:static md:flex-1 bg-neutral-900 transition-transform duration-300 ${
          isDrawerOpen
            ? 'translate-x-0'
            : 'translate-x-full md:translate-x-0 md:hidden'
        }`}
      >
        {/* Backdrop (só no mobile) */}
        {isDrawerOpen && (
          <div
            className="absolute inset-0 bg-black/60 z-10 md:hidden"
            onClick={handleCloseDrawer}
          />
        )}

        {/* Conteúdo do drawer */}
        <div className="relative z-20 h-full overflow-y-auto border-l border-neutral-800">
          {selectedPublicadorId ? (
            <DetalhesPublicador
              key={selectedPublicadorId}
              publicadorId={selectedPublicadorId}
              onSaveSuccess={fetchPublicadores}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-neutral-400">
              Selecione um publicador à esquerda.
            </div>
          )}

          {/* Botão Fechar (só mobile) */}
          <button
            onClick={handleCloseDrawer}
            className="md:hidden absolute top-3 right-3 bg-neutral-800 hover:bg-neutral-700 rounded-full p-2"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
