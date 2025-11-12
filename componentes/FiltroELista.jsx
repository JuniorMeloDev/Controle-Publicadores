'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, ShieldCheck, Star, User } from 'lucide-react';

export default function FiltroELista({ publicadores, selectedId, onPublicadorSelect }) {
  const [search, setSearch] = useState('');
  const [grupoSelecionado, setGrupoSelecionado] = useState('');

  // Calcula grupos com useMemo
  const grupos = useMemo(() => {
    if (!publicadores || publicadores.length === 0) return [];
    return [...new Set(publicadores.map(p => p.nome_grupo))];
  }, [publicadores]);

  // Filtra a lista com useMemo
  const filtrados = useMemo(() => {
    if (!publicadores || publicadores.length === 0) return [];
    
    let lista = publicadores;
    
    if (search.trim() !== '') {
      lista = lista.filter((p) =>
        p.nome_completo.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    if (grupoSelecionado !== '') {
      lista = lista.filter((p) => p.nome_grupo === grupoSelecionado);
    }
    
    return lista;
  }, [publicadores, search, grupoSelecionado]);

  return (
    <div className="flex flex-col h-full">
      {/* === Busca e filtros === */}
      <div className="p-4 border-b border-neutral-800 space-y-3">
        <div className="flex items-center bg-neutral-800 rounded-md px-3 py-2">
          <Search size={16} className="text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar publicador..."
            className="bg-transparent text-sm text-neutral-100 flex-1 ml-2 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={grupoSelecionado}
          onChange={(e) => setGrupoSelecionado(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-2 text-sm text-neutral-100"
        >
          <option value="">Todos os grupos</option>
          {grupos.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {/* === Lista de publicadores === */}
      <div className="flex-1 overflow-y-auto">
        {filtrados.map((p) => (
          <div
            key={p.id}
            onClick={() => onPublicadorSelect(p.id)}
            className={`cursor-pointer px-4 py-3 border-b border-neutral-800 hover:bg-neutral-800 transition ${
              selectedId === p.id ? 'bg-neutral-800' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="bg-neutral-700 h-9 w-9 flex items-center justify-center rounded-full">
                  <User size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold truncate">{p.nome_completo}</h3>
                  <p className="text-xs text-neutral-400 truncate">{p.nome_grupo}</p>
                </div>
              </div>
              <div className="flex gap-1">
                {p.privilegios?.includes('anciao') && (
                  <ShieldCheck size={14} className="text-blue-400" />
                )}
                {p.designacoes?.includes('pioneiro_regular') && (
                  <Star size={14} className="text-green-400" />
                )}
              </div>
            </div>
          </div>
        ))}

        {filtrados.length === 0 && (
          <div className="text-center text-neutral-500 py-10 text-sm">
            Nenhum publicador encontrado
          </div>
        )}
      </div>
    </div>
  );
}
