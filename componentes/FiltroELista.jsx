'use client';

import { useState, useMemo } from 'react';
import { Search, ShieldCheck, Star, User, X, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function FiltroELista({ publicadores, selectedId, onPublicadorSelect }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [grupoSelecionado, setGrupoSelecionado] = useState('');
  const [privilegiosSelecionados, setPrivilegiosSelecionados] = useState([]);
  const [designacoesSelecionadas, setDesignacoesSelecionadas] = useState([]);
  const [naoBatizado, setNaoBatizado] = useState(false);

  const grupos = useMemo(() => {
    if (!publicadores || publicadores.length === 0) return [];
    const gruposSet = [...new Set(publicadores.map(p => p.nome_grupo))];
    return gruposSet.map(g => ({
      nome: g,
      total: publicadores.filter(p => p.nome_grupo === g).length
    }));
  }, [publicadores]);

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

    const temFiltroPorAtributo = privilegiosSelecionados.length > 0 || designacoesSelecionadas.length > 0 || naoBatizado;

    if (!temFiltroPorAtributo) {
      return lista;
    }

    return lista.filter((p) => {
      const matchesPriv = privilegiosSelecionados.length > 0
        && p.privilegios
        && p.privilegios.some(pr => privilegiosSelecionados.includes(pr));

      const matchesDes = designacoesSelecionadas.length > 0
        && p.designacoes
        && p.designacoes.some(d => designacoesSelecionadas.includes(d));

      const matchesNaoBat = naoBatizado && (!p.data_batismo || String(p.data_batismo).trim() === '');

      return !!(matchesPriv || matchesDes || matchesNaoBat);
    });
  }, [publicadores, search, grupoSelecionado, privilegiosSelecionados, designacoesSelecionadas, naoBatizado]);

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

  return (
    <div className="flex flex-col h-full">
      {/* Botão para voltar à tela principal */}
      <div className="p-4 border-b border-neutral-800">
        <button
          type="button"
          onClick={() => router.push('/admin/dashboard')}
          className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-100 hover:bg-neutral-700"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Voltar</span>
        </button>
      </div>

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
            <option key={g.nome} value={g.nome}>
              {g.nome} ({g.total})
            </option>
          ))}
        </select>

        {/* Linha única para todos os toggles — tenta manter o máximo em uma linha */}
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => togglePrivilegio('anciao')}
              aria-pressed={privilegiosSelecionados.includes('anciao')}
              className={`h-9 px-3 rounded-md text-sm font-medium transition inline-flex items-center gap-2 ${
                privilegiosSelecionados.includes('anciao')
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-800 border border-neutral-700 text-neutral-100 hover:bg-neutral-700'
              }`}
            >
              <ShieldCheck size={14} />
              <span className="hidden sm:inline">Ancião</span>
            </button>

            <button
              type="button"
              onClick={() => togglePrivilegio('servo_ministerial')}
              aria-pressed={privilegiosSelecionados.includes('servo_ministerial')}
              className={`h-9 px-3 rounded-md text-sm font-medium transition inline-flex items-center gap-2 ${
                privilegiosSelecionados.includes('servo_ministerial')
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-800 border border-neutral-700 text-neutral-100 hover:bg-neutral-700'
              }`}
            >
              <span className="hidden sm:inline">Servo Ministerial</span>
            </button>

            <button
              type="button"
              onClick={() => toggleDesignacao('pioneiro_regular')}
              aria-pressed={designacoesSelecionadas.includes('pioneiro_regular')}
              className={`h-9 px-3 rounded-md text-sm font-medium transition inline-flex items-center gap-2 ${
                designacoesSelecionadas.includes('pioneiro_regular')
                  ? 'bg-green-600 text-white'
                  : 'bg-neutral-800 border border-neutral-700 text-neutral-100 hover:bg-neutral-700'
              }`}
            >
              <Star size={14} />
              <span className="hidden sm:inline">Pioneiro Regular</span>
            </button>

            <button
              type="button"
              onClick={() => setNaoBatizado(prev => !prev)}
              aria-pressed={naoBatizado}
              className={`h-9 px-3 rounded-md text-sm font-medium transition inline-flex items-center gap-2 ${
                naoBatizado
                  ? 'bg-yellow-600 text-white'
                  : 'bg-neutral-800 border border-neutral-700 text-neutral-100 hover:bg-neutral-700'
              }`}
            >
              <span className="text-yellow-400">⚠️</span>
              <span className="hidden sm:inline">Não Batizado</span>
            </button>
          </div>

          {/* Spacer flex para empurrar limpar para a direita quando houver espaço */}
          <div className="flex-1 min-w-0"></div>

          {temFiltrosAtivos && (
            <button
              onClick={handleLimpar}
              className="h-9 px-3 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium inline-flex items-center gap-2"
            >
              <X size={16} />
              <span className="hidden sm:inline">Limpar</span>
            </button>
          )}
        </div>
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
                  <ShieldCheck size={14} className="text-blue-400" title="Ancião" />
                )}
                {p.designacoes?.includes('pioneiro_regular') && (
                  <Star size={14} className="text-green-400" title="Pioneiro Regular" />
                )}
                {(!p.data_batismo || String(p.data_batismo).trim() === '') && (
                  <span className="text-yellow-400 text-xs font-bold">⚠️</span>
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
