// app/componentes/FiltroELista.jsx

'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, ShieldCheck, Star, X, Plus, ChevronDown, ChevronUp, Shuffle } from 'lucide-react'; 

export default function FiltroELista({ 
    publicadores = [], 
    selectedId, 
    onPublicadorSelect, 
    onNovoPublicador,
    onStartTransfer
}) {
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
    return Array.from(map.entries()).map(([nome, total]) => ({ nome, total })).sort((a,b) => a.nome.localeCompare(b.nome));
  }, [publicadores]);

  const filtrados = useMemo(() => {
    let lista = publicadores;
    if (debouncedSearch !== '') {
      lista = lista.filter((p) => (p.nome_completo || '').toLowerCase().includes(debouncedSearch) || (p.nome_grupo || '').toLowerCase().includes(debouncedSearch));
    }
    if (grupoSelecionado !== '') {
      lista = lista.filter((p) => (p.nome_grupo || '—') === grupoSelecionado);
    }
    if (privilegiosSelecionados.length > 0 || designacoesSelecionadas.length > 0 || naoBatizado) {
      lista = lista.filter((p) => {
        const matchesPriv = privilegiosSelecionados.length > 0 && p.privilegios?.some(pr => privilegiosSelecionados.includes(pr));
        const matchesDes = designacoesSelecionadas.length > 0 && p.designacoes?.some(d => designacoesSelecionadas.includes(d));
        const matchesNaoBat = naoBatizado && (!p.data_batismo || String(p.data_batismo).trim() === '');
        return matchesPriv || matchesDes || matchesNaoBat;
      });
    }
    return lista;
  }, [publicadores, debouncedSearch, grupoSelecionado, privilegiosSelecionados, designacoesSelecionadas, naoBatizado]);

  const handleLimpar = () => {
    setSearch(''); setGrupoSelecionado(''); setPrivilegiosSelecionados([]); setDesignacoesSelecionadas([]); setNaoBatizado(false);
  };

  const togglePrivilegio = (valor) => setPrivilegiosSelecionados(prev => prev.includes(valor) ? prev.filter(v => v !== valor) : [...prev, valor]);
  const toggleDesignacao = (valor) => setDesignacoesSelecionadas(prev => prev.includes(valor) ? prev.filter(v => v !== valor) : [...prev, valor]);

  const initials = (name) => {
    if (!name) return 'P';
    const parts = String(name).split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white md:bg-gray-50/50">
      <div className="p-4 border-b border-gray-200 shrink-0 bg-white">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Congregação</h2>
            <p className="text-xs text-gray-500">{publicadores.length} registros</p>
          </div>
          
          {/* GRUPO DE BOTÕES DE AÇÃO: shrink-0 garante que eles não sejam espremidos */}
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            
            {/* BOTÃO DE TRANSFERÊNCIA */}
            <button 
                onClick={onStartTransfer} 
                title="Trocar Publicadores de Grupo" 
                className={`p-2 rounded-md shadow-sm transition-colors relative
                    bg-gray-100 hover:bg-gray-200 text-gray-600
                `}
            >
                <Shuffle size={18} />
            </button>
            
            {/* BOTÃO NOVO PUBLICADOR */}
            <button onClick={onNovoPublicador} className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md shadow-sm transition-colors" title="Novo Publicador">
                <Plus size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="w-full bg-gray-100 border-transparent focus:bg-white focus:border-purple-500 focus:ring-0 rounded-md pl-8 pr-8 py-2 text-sm text-gray-900 outline-none transition-all" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>
          <button onClick={() => setAccordionOpen(prev => !prev)} className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600">
            {accordionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {accordionOpen && (
          <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
            <select value={grupoSelecionado} onChange={(e) => setGrupoSelecionado(e.target.value)} className="w-full bg-white border border-gray-200 rounded-md px-2 py-1.5 text-xs text-gray-700 focus:border-purple-500 outline-none">
              <option value="">Todos os grupos</option>
              {grupos.map(g => <option key={g.nome} value={g.nome}>{g.nome} ({g.total})</option>)}
            </select>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => togglePrivilegio('anciao')} className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${privilegiosSelecionados.includes('anciao') ? 'bg-purple-100 border-purple-200 text-purple-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><ShieldCheck size={12} /> Ancião</button>
              <button onClick={() => togglePrivilegio('servo_ministerial')} className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${privilegiosSelecionados.includes('servo_ministerial') ? 'bg-purple-100 border-purple-200 text-purple-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Servo</button>
              <button onClick={() => toggleDesignacao('pioneiro_regular')} className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${designacoesSelecionadas.includes('pioneiro_regular') ? 'bg-purple-100 border-purple-200 text-purple-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><Star size={12} /> Pioneiro</button>
              {(search || grupoSelecionado || privilegiosSelecionados.length || designacoesSelecionadas.length || naoBatizado) && <button onClick={handleLimpar} className="text-xs text-red-600 hover:underline ml-auto">Limpar</button>}
            </div>
          </div>
        )}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto scroll-smooth">
        {filtrados.map((p) => (
          <div key={p.id} onClick={() => onPublicadorSelect(p.id)} className={`group cursor-pointer px-4 py-3 border-b border-gray-100 hover:bg-white hover:shadow-sm transition-all ${selectedId === p.id ? 'bg-white border-l-4 border-l-purple-600 shadow-sm' : 'border-l-4 border-l-transparent'}`}>
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selectedId === p.id ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600 group-hover:bg-gray-300'}`}>{initials(p.nome_completo)}</div>
              
              {/* CORREÇÃO: min-w-0 e flex-1 garantem que o nome ocupe o espaço restante e truque. */}
              <div className="min-w-0 flex-1"> 
                {/* CLASSE TRUNCATE NO NOME COMPLETO */}
                <h3 className={`text-sm font-medium truncate ${selectedId === p.id ? 'text-purple-900' : 'text-gray-900'}`}>{p.nome_completo}</h3>
                
                <div className="flex items-center justify-between mt-0.5"> 
                  {/* TRUNCATE NO NOME DO GRUPO */}
                  <span className="text-xs text-gray-500 truncate max-w-[calc(100%-40px)]">{p.nome_grupo || 'Sem grupo'}</span>
                  <div className="flex gap-1 shrink-0"> {/* shrink-0 para os ícones */}
                    {p.privilegios?.includes('anciao') && <ShieldCheck size={12} className="text-blue-500" />}
                    {p.designacoes?.includes('pioneiro_regular') && <Star size={12} className="text-green-500" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}