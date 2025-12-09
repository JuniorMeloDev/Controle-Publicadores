'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, FileText, User, Calendar, Loader2, ArrowRight, LayoutDashboard, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ pages: [], publishers: [] });
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
        if (query.length >= 2) {
            fetchResults();
        } else {
            setResults({ pages: [], publishers: [] });
        }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const fetchResults = async () => {
    setLoading(true);
    try {
        const res = await fetch(`/api/admin/global-search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
            const data = await res.json();
            setResults(data);
            setIsOpen(true);
        }
    } catch (error) {
        console.error("Search failed", error);
    } finally {
        setLoading(false);
    }
  };

  const clearAndClose = () => {
      setIsOpen(false);
      setQuery('');
  };

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.length >= 2) setIsOpen(true);
          }}
          onFocus={() => { if(query.length >= 2) setIsOpen(true); }}
          placeholder="Pesquisar..."
          className="pl-10 pr-4 py-2 w-32 sm:w-64 focus:w-48 sm:focus:w-80 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-purple-100 focus:border-purple-300 transition-all text-sm text-gray-700 outline-none placeholder:text-gray-400"
        />
        {loading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            </div>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (results.pages.length > 0 || results.publishers.length > 0) && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 text-left mt-2 w-[90vw] sm:w-96 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 origin-top">
            
            {/* Pages Section */}
            {results.pages.length > 0 && (
                <div className="p-2">
                    <h4 className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Páginas</h4>
                    {results.pages.map((page, idx) => (
                        <Link 
                            key={idx} 
                            href={page.href}
                            onClick={clearAndClose}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700 group transition-colors"
                        >
                            <div className="p-1.5 bg-gray-100 rounded-md group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
                                <LayoutDashboard className="w-4 h-4" />
                            </div>
                            <span className="flex-1 text-sm font-medium">{page.name}</span>
                            <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                    ))}
                </div>
            )}

            {(results.pages.length > 0 && results.publishers.length > 0) && <div className="h-px bg-gray-100 mx-2 my-1" />}

            {/* Publishers Section */}
            {results.publishers.length > 0 && (
                <div className="p-2 bg-gray-50/50">
                    <h4 className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Publicadores</h4>
                    <div className="space-y-2 mt-1">
                        {results.publishers.map((pub) => (
                            <div key={pub.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:border-purple-200 hover:shadow-md transition-all">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700">
                                        {pub.nome_completo.charAt(0)}
                                    </div>
                                    <span className="text-sm font-medium text-gray-900 truncate">{pub.nome_completo}</span>
                                </div>
                                <div className="flex gap-2">
                                    <Link 
                                        href={`/admin/gerenciar?id=${pub.id}`}
                                        onClick={clearAndClose}
                                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-purple-50 hover:text-purple-700 rounded border border-gray-100 transition-colors"
                                        title="Ver Cadastro"
                                    >
                                        <User className="w-3 h-3" /> Cadastro
                                    </Link>
                                    <Link 
                                        href={`/admin/relatorios/registro-publicador?id=${pub.id}`} 
                                        onClick={clearAndClose}
                                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 rounded border border-gray-100 transition-colors"
                                        title="Ver Cartão S-21"
                                    >
                                        <FileText className="w-3 h-3" /> S-21
                                    </Link>
                                    <Link 
                                        href={`/admin/designacoes?highlight=${pub.id}`} 
                                        onClick={clearAndClose}
                                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-green-50 hover:text-green-700 rounded border border-gray-100 transition-colors"
                                        title="Ver Designações"
                                    >
                                        <Calendar className="w-3 h-3" /> Designações
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      )}

      {/* No Results */}
      {isOpen && query.length >= 2 && !loading && results.pages.length === 0 && results.publishers.length === 0 && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 text-left mt-2 w-[80vw] sm:w-80 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-50 text-center">
              <p className="text-sm text-gray-500">Nenhum resultado encontrado para "{query}".</p>
          </div>
      )}
    </div>
  );
}
