import { useState, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';

export function PublisherCombobox({ label, value, onChange, publishers = [], placeholder = "Selecione..." }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Sync internal state with external value
  useEffect(() => {
    if (value) {
      const pub = publishers.find(p => p.id === value);
      if (pub) setSelectedName(pub.nome_chamado || pub.nome_completo);
    } else {
      setSelectedName('');
      setQuery('');
    }
  }, [value, publishers]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizeStr = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

  const filteredPublishers = query === ''
    ? publishers
    : publishers.filter((pub) => {
        const name = pub.nome_chamado || pub.nome_completo;
        return normalizeStr(name).includes(normalizeStr(query));
      });

  const handleSelect = (pub) => {
    if (!pub) return;
    onChange(pub.id);
    setSelectedName(pub.nome_chamado || pub.nome_completo);
    setQuery('');
    setOpen(false);
    setHighlightedIndex(0);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
    setSelectedName('');
    setQuery('');
  };

  const handleKeyDown = (e) => {
      if (!open) return;

      switch (e.key) {
          case 'ArrowDown':
              e.preventDefault();
              setHighlightedIndex(prev => Math.min(prev + 1, filteredPublishers.length - 1));
              break;
          case 'ArrowUp':
              e.preventDefault();
              setHighlightedIndex(prev => Math.max(prev - 1, 0));
              break;
          case 'Enter':
              e.preventDefault();
              if (filteredPublishers.length > 0) {
                  handleSelect(filteredPublishers[highlightedIndex]);
              }
              break;
          case 'Tab':
              // Select the current highlighted one if valid, then allow focus move
              if (filteredPublishers.length > 0) {
                  handleSelect(filteredPublishers[highlightedIndex]);
              } else {
                  setOpen(false);
              }
              break;
          case 'Escape':
              setOpen(false);
              break;
      }
  };

  // Reset highlight when query changes
  useEffect(() => {
      setHighlightedIndex(0);
  }, [query]);

  return (
    <div className="flex flex-col gap-1.5" ref={wrapperRef}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <div className="relative">
        <div
          onClick={() => {
              setOpen(!open);
              if (!open) setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="flex items-center justify-between w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md cursor-pointer hover:border-gray-400 focus-within:ring-2 focus-within:ring-purple-100 focus-within:border-purple-500 transition-colors"
        >
          {open ? (
            <input
              ref={inputRef}
              className="w-full outline-none bg-transparent placeholder:text-gray-500 text-gray-900"
              placeholder="Buscar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <span className={`block truncate ${selectedName ? 'text-gray-900' : 'text-gray-500'}`}>
              {selectedName || placeholder}
            </span>
          )}
          
          <div className="flex items-center gap-1">
             {selectedName && !open && (
                <button onClick={handleClear} className="text-gray-400 hover:text-red-500 p-0.5">
                    <X size={14} />
                </button>
             )}
             <ChevronsUpDown className="w-4 h-4 text-gray-400 opacity-50" />
          </div>
        </div>

        {open && (
           <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto py-1">
              {filteredPublishers.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500 text-center">Nenhum encontrado.</div>
              ) : (
                filteredPublishers.map((pub, idx) => {
                   const isSelected = pub.id === value;
                   const isHighlighted = idx === highlightedIndex;
                   const name = pub.nome_chamado || pub.nome_completo;
                   return (
                     <div
                        key={pub.id}
                        onClick={() => handleSelect(pub)}
                        className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                            isSelected ? 'bg-purple-50 text-purple-700 font-medium' : 
                            isHighlighted ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                        }`}
                     >
                        <span>{name}</span>
                        {isSelected && <Check className="w-4 h-4" />}
                     </div>
                   );
                })
              )}
           </div>
        )}
      </div>
    </div>
  );
}
