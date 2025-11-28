// app/componentes/TrocaGrupoSheet.jsx

'use client';

import { useState, useMemo } from 'react';
import { Loader2, Zap, Search, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

export default function TrocaGrupoSheet({ publicadores, gruposList, onTransferSuccess }) {
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [selectedPublicadorIds, setSelectedPublicadorIds] = useState([]); // ADICIONADO
  const [searchTerm, setSearchTerm] = useState(''); // ADICIONADO
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false });

  // 1. Lógica de Busca e Seleção
  const publicadoresFiltrados = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return publicadores.sort((a,b) => a.nome_completo.localeCompare(b.nome_completo));
    
    return publicadores.filter((p) => {
      const nomeCompleto = (p.nome_completo || '').toLowerCase();
      const nomeCurto = (p.nome_curto || '').toLowerCase();
      const nomeGrupo = (p.nome_grupo || '').toLowerCase();
      return nomeCompleto.includes(search) || nomeCurto.includes(search) || nomeGrupo.includes(search);
    }).sort((a,b) => a.nome_completo.localeCompare(b.nome_completo));
  }, [publicadores, searchTerm]);


  const handleTogglePublicador = (id) => {
    setSelectedPublicadorIds(prev => 
        prev.includes(id) 
            ? prev.filter(pId => pId !== id) 
            : [...prev, id]
    );
  };
  
  const publicadoresSelecionados = useMemo(() => {
    const map = new Map(publicadores.map(p => [String(p.id), p]));
    return selectedPublicadorIds.map(id => map.get(id)).filter(Boolean);
  }, [selectedPublicadorIds, publicadores]);

  // 2. Grupos Atuais (para exibição)
  const currentGroups = publicadoresSelecionados.reduce((acc, p) => {
    const nome = p.nome_grupo || 'Sem grupo';
    if (!acc.includes(nome)) acc.push(nome);
    return acc;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', isError: false });

    if (selectedPublicadorIds.length === 0) {
      setMessage({ text: 'Selecione pelo menos um publicador.', isError: true });
      return;
    }

    if (!selectedGrupo) {
      setMessage({ text: 'Selecione o grupo de destino.', isError: true });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/batch-update-grupos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          publicadorIds: selectedPublicadorIds, 
          nome_grupo: selectedGrupo 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ text: data.message || 'Transferência concluída com sucesso.', isError: false });
        // Limpa a seleção e o estado de carregamento, e chama o sucesso
        setSelectedPublicadorIds([]);
        setSearchTerm('');
        setTimeout(() => {
          onTransferSuccess(selectedPublicadorIds.length); 
        }, 1000);
      } else {
        setMessage({ text: data.message || 'Erro ao realizar a transferência.', isError: true });
      }
    } catch (err) {
      setMessage({ text: 'Não foi possível conectar ao servidor.', isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 flex flex-col h-[calc(100%-80px)] overflow-hidden">
      
      {/* Mensagens */}
      {message.text && (
        <div className={`p-3 rounded-md mb-6 text-sm ${message.isError 
          ? 'bg-red-50 text-red-700 border border-red-200' 
          : 'bg-green-50 text-green-700 border border-green-200'}`
        }>
          {message.text}
        </div>
      )}

      {/* DETALHES DA SELEÇÃO */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 shrink-0">
        <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Zap size={14} className="text-blue-500" /> Seleção Atual ({selectedPublicadorIds.length})
        </h3>
        <p className="text-xs text-gray-700 font-medium">
            Grupos Atuais: <span className="font-semibold">{currentGroups.join(', ') || 'Nenhum'}</span>
        </p>
      </div>
      
      {/* 3. CAMPO DE PESQUISA */}
      <div className="relative mb-4 shrink-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
              type="text"
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              placeholder="Buscar publicador por nome ou grupo..." 
              className="w-full bg-white border border-gray-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-900 outline-none transition-all" 
          />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
      </div>

      {/* 4. LISTA DE SELEÇÃO */}
      <div className="flex-1 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2 bg-white mb-6">
        {publicadoresFiltrados.length === 0 ? (
           <p className="text-center text-sm text-gray-500 p-4">Nenhum publicador encontrado.</p>
        ) : (
          publicadoresFiltrados.map(p => (
            <div 
              key={p.id} 
              className={`flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer border border-transparent
                  ${selectedPublicadorIds.includes(String(p.id)) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`
              }
              onClick={() => handleTogglePublicador(String(p.id))}
            >
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium truncate ${selectedPublicadorIds.includes(String(p.id)) ? 'text-blue-800' : 'text-gray-800'}`}>
                    {p.nome_completo}
                </p>
                <p className="text-xs text-gray-500">{p.nome_grupo || 'Sem grupo'}</p>
              </div>
              <input
                  type="checkbox"
                  checked={selectedPublicadorIds.includes(String(p.id))}
                  readOnly
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          ))
        )}
      </div>

      {/* 5. FORMULÁRIO DE AÇÃO */}
      <form onSubmit={handleSubmit} className="space-y-4 shrink-0 pt-4 border-t border-gray-100">
        
        {/* SELETOR DE GRUPO */}
        <div>
          <label htmlFor="nome_grupo_destino" className="block text-sm font-medium text-gray-700 mb-1">
            Novo Grupo de Campo de Destino
          </label>
          <select 
            id="nome_grupo_destino" 
            name="nome_grupo_destino" 
            value={selectedGrupo} 
            onChange={(e) => setSelectedGrupo(e.target.value)} 
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" 
            required
          >
            <option value="" disabled>Selecione um grupo...</option>
            {gruposList.map(grupo => (
              <option key={grupo} value={grupo}>{grupo}</option>
            ))}
          </select>
        </div>

        {/* BOTÃO DE SUBMISSÃO */}
        <Button 
          type="submit" 
          disabled={isLoading || selectedPublicadorIds.length === 0 || !selectedGrupo} 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white flex justify-center py-2.5"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Transferindo...
            </div>
          ) : `Transferir ${selectedPublicadorIds.length} Publicador(es)`}
        </Button>
      </form>
    </div>
  );
}