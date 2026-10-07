import { useState, useRef, useEffect, useId } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';

export function PublisherCombobox({ label, value, onChange, publishers = [], placeholder = "Selecione...", disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedPublisher = publishers.find(p => String(p.id) === String(value));
  const selectedName = selectedPublisher ? selectedPublisher.nome_chamado || selectedPublisher.nome_completo : '';
  const listId = useId();
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

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
    if (!pub || disabled) return;
    onChange(pub.id);
    setQuery('');
    setOpen(false);
    setHighlightedIndex(0);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(null);
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
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              break;
      }
  };

  return (
    <div className="flex flex-col gap-1.5" ref={wrapperRef}>
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
      <div className="relative">
        <div
          onClick={() => {
              if (disabled) return;
              setQuery('');
              setHighlightedIndex(0);
              setOpen(!open);
              if (!open) setTimeout(() => inputRef.current?.focus(), 0);
          }}
          role="combobox"
          aria-label={label || placeholder}
          aria-expanded={open && !disabled}
          aria-controls={listId}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={e => {
              if (disabled || open || !['Enter', ' ', 'ArrowDown'].includes(e.key)) return;
              e.preventDefault();
              setQuery('');
              setHighlightedIndex(0);
              setOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className={`flex items-center justify-between w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-purple-100 focus-within:border-purple-500 transition-colors ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}`}
        >
          {open ? (
            <input
              ref={inputRef}
              className="w-full outline-none bg-transparent placeholder:text-gray-500 text-gray-900"
              placeholder="Buscar..."
              aria-label={`Buscar ${label || 'publicador'}`}
              disabled={disabled}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlightedIndex(0); }}
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
                <button type="button" disabled={disabled} aria-label={`Limpar ${label || 'publicador'}`} onClick={handleClear} className="text-gray-400 hover:text-red-500 p-0.5">
                    <X size={14} />
                </button>
             )}
             <ChevronsUpDown className="w-4 h-4 text-gray-400 opacity-50" />
          </div>
        </div>

        {open && !disabled && (
           <div id={listId} role="listbox" aria-label={label || 'Publicadores'} className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto py-1">
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
                        role="option"
                        aria-selected={isSelected}
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
