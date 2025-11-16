'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, ShieldCheck, Star, X, Plus, ChevronDown, ChevronUp } from 'lucide-react';

export default function FiltroELista({ publicadores = [], selectedId, onPublicadorSelect, onNovoPublicador }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [grupoSelecionado, setGrupoSelecionado] = useState('');
  const [privilegiosSelecionados, setPrivilegiosSelecionados] = useState([]);
  const [designacoesSelecionadas, setDesignacoesSelecionadas] = useState([]);
  const [naoBatizado, setNaoBatizado] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState(true);

  const listRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 220);
    return () => clearTimeout(t);
  }, [search]);

  const grupos = useMemo(() => {
    const map = new Map();
    for (const p of publicadores) {
      const g = p.nome_grupo || '—';
      map.set(g, (map.get(g) || 0) + 1);
    }
    return Array.from(map.entries()).map(([nome, total]) => ({ nome, total }));
  }, [publicadores]);

  const filtrados = useMemo(() => {
    let lista = publicadores;

    if (debouncedSearch !== '') {
      lista = lista.filter((p) => {
        const nome = (p.nome_completo || '').toLowerCase();
        const grupo = (p.nome_grupo || '').toLowerCase();
        return nome.includes(debouncedSearch) || grupo.includes(debouncedSearch);
      });
    }

    if (grupoSelecionado !== '') {
      lista = lista.filter((p) => (p.nome_grupo || '—') === grupoSelecionado);
    }

    const temFiltroPorAtributo = privilegiosSelecionados.length > 0 || designacoesSelecionadas.length > 0 || naoBatizado;

    if (!temFiltroPorAtributo) return lista;

    return lista.filter((p) => {
      const matchesPriv = privilegiosSelecionados.length > 0 && Array.isArray(p.privilegios) && p.privilegios.some(pr => privilegiosSelecionados.includes(pr));
      const matchesDes = designacoesSelecionadas.length > 0 && Array.isArray(p.designacoes) && p.designacoes.some(d => designacoesSelecionadas.includes(d));
      const matchesNaoBat = naoBatizado && (!p.data_batismo || String(p.data_batismo).trim() === '');
      return matchesPriv || matchesDes || matchesNaoBat;
    });
  }, [publicadores, debouncedSearch, grupoSelecionado, privilegiosSelecionados, designacoesSelecionadas, naoBatizado]);

  const handleLimpar = () => {
    setSearch('');
    setGrupoSelecionado('');
    setPrivilegiosSelecionados([]);
    setDesignacoesSelecionadas([]);
    setNaoBatizado(false);
  };

  const temFiltrosAtivos = search !== '' || grupoSelecionado !== '' || privilegiosSelecionados.length > 0 || designacoesSelecionadas.length > 0 || naoBatizado;

  const togglePrivilegio = (valor) => {
    setPrivilegiosSelecionados(prev => prev.includes(valor) ? prev.filter(v => v !== valor) : [...prev, valor]);
  };

  const toggleDesignacao = (valor) => {
    setDesignacoesSelecionadas(prev => prev.includes(valor) ? prev.filter(v => v !== valor) : [...prev, valor]);
  };

  const initials = (name) => {
    if (!name) return 'P';
    const parts = String(name).split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <p>Congregação Praia dos Corais</p>
          <div>
            <h2 className="text-sm font-bold">Publicadores</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Total: {publicadores.length}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="p-4 border-b border-neutral-800 space-y-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-neutral-800 rounded-md px-3 py-2 flex-1">
            <Search size={14} className="text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar publicador ou grupo..."
              className="bg-transparent text-sm text-neutral-100 flex-1 ml-2 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="ml-2 text-neutral-400 hover:text-neutral-200">
                <X size={14} />
              </button>
            )}
          </div>
          <button onClick={() => setAccordionOpen(prev => !prev)} className="p-2 rounded-md bg-neutral-800 hover:bg-neutral-700">
            {accordionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {accordionOpen && (
          <div className="space-y-2">
            <select
              value={grupoSelecionado}
              onChange={(e) => setGrupoSelecionado(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-2 text-sm text-neutral-100"
            >
              <option value="">Todos os grupos</option>
              {grupos.map(g => (
                <option key={g.nome} value={g.nome}>{g.nome} ({g.total})</option>
              ))}
            </select>

            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => togglePrivilegio('anciao')} className={`h-8 px-3 rounded-md text-sm font-medium inline-flex items-center gap-2 ${privilegiosSelecionados.includes('anciao') ? 'bg-blue-600 text-white' : 'bg-neutral-800 border border-neutral-700 text-neutral-100 hover:bg-neutral-700'}`}>
                <ShieldCheck size={14} /> <span className="hidden sm:inline">Ancião</span>
              </button>
              <button type="button" onClick={() => togglePrivilegio('servo_ministerial')} className={`h-8 px-3 rounded-md text-sm font-medium inline-flex items-center gap-2 ${privilegiosSelecionados.includes('servo_ministerial') ? 'bg-blue-600 text-white' : 'bg-neutral-800 border border-neutral-700 text-neutral-100 hover:bg-neutral-700'}`}>
                <span className="hidden sm:inline">Servo</span>
              </button>
              <button type="button" onClick={() => toggleDesignacao('pioneiro_regular')} className={`h-8 px-3 rounded-md text-sm font-medium inline-flex items-center gap-2 ${designacoesSelecionadas.includes('pioneiro_regular') ? 'bg-green-600 text-white' : 'bg-neutral-800 border border-neutral-700 text-neutral-100 hover:bg-neutral-700'}`}>
                <Star size={14} /> <span className="hidden sm:inline">Pioneiro</span>
              </button>
              <button type="button" onClick={() => setNaoBatizado(prev => !prev)} className={`h-8 px-3 rounded-md text-sm font-medium inline-flex items-center gap-2 ${naoBatizado ? 'bg-yellow-600 text-white' : 'bg-neutral-800 border border-neutral-700 text-neutral-100 hover:bg-neutral-700'}`}>
                <span className="text-yellow-400">⚠️</span> <span className="hidden sm:inline">Não batizado</span>
              </button>
              <div className="flex-1 min-w-0" />
              {temFiltrosAtivos && (
                <button onClick={handleLimpar} className="h-8 px-3 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium inline-flex items-center gap-2">
                  <X size={14} /> Limpar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

            {/* Lista com rolagem */}
      <div ref={listRef} className="flex-1 overflow-y-auto divide-y divide-neutral-800">
        {filtrados.map((p) => (
          <div
            key={p.id}
            onClick={() => onPublicadorSelect(p.id)}
            className={`cursor-pointer px-4 py-2 hover:bg-neutral-800 transition flex items-center gap-3 ${
              selectedId === p.id ? 'bg-neutral-800' : ''
            }`}
          >
            <div className="h-10 w-10 rounded-full bg-neutral-700 flex items-center justify-center text-sm font-semibold">
              {initials(p.nome_completo)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold truncate">{p.nome_completo}</h3>
                <div className="flex items-center gap-2">
                  {p.privilegios?.includes('anciao') && <ShieldCheck size={14} className="text-blue-400" />}
                  {p.designacoes?.includes('pioneiro_regular') && <Star size={14} className="text-green-400" />}
                  {(!p.data_batismo || String(p.data_batismo).trim() === '') && (
                    <span className="text-yellow-400 text-xs font-bold">⚠️</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-neutral-400 truncate mt-0.5">{p.nome_grupo || '—'}</p>
            </div>
          </div>
        ))}

        {filtrados.length === 0 && (
          <div className="text-center text-neutral-500 py-10 text-sm">Nenhum publicador encontrado</div>
        )}
      </div>

      {/* Botão Novo Publicador */}
      <div className="p-3 border-t border-neutral-800 shrink-0">
        <button
          onClick={onNovoPublicador}
          className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-md bg-green-600 hover:bg-green-500 text-sm font-semibold"
        >
          <Plus size={16} /> Novo Publicador
        </button>
      </div>
    </div>
  );
}