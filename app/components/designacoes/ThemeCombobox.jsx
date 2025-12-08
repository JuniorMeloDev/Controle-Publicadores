'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';

export function ThemeCombobox({ value, onChange, themes = [], placeholder = "Selecione o tema..." }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Sync internal state with external value
  // value here is the theme NAME (string), or maybe I should pass the whole object?
  // In PublicSpeechTab I was setting `formData.tema` = `theme.tema`.
  // So value is a string.
  useEffect(() => {
    if (value) {
       // If value matches a theme in the list, we might want to display "123 - Theme Name"
       const found = themes.find(t => t.tema === value);
       if (found) {
           setSelectedLabel(`${found.numero}. ${found.tema}`);
       } else {
           setSelectedLabel(value);
       }
    } else {
      setSelectedLabel('');
      setQuery('');
    }
  }, [value, themes]);

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

  const filteredThemes = query === ''
    ? themes
    : themes.filter((t) => {
        const str = `${t.numero} ${t.tema}`;
        return normalizeStr(str).includes(normalizeStr(query));
      });

  const handleSelect = (theme) => {
    if (!theme) return;
    onChange(theme.tema); // Parent expects the theme name string
    setSelectedLabel(`${theme.numero}. ${theme.tema}`);
    setQuery('');
    setOpen(false);
    setHighlightedIndex(0);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSelectedLabel('');
    setQuery('');
  };

  const handleKeyDown = (e) => {
      if (!open) return;

      switch (e.key) {
          case 'ArrowDown':
              e.preventDefault();
              setHighlightedIndex(prev => Math.min(prev + 1, filteredThemes.length - 1));
              break;
          case 'ArrowUp':
              e.preventDefault();
              setHighlightedIndex(prev => Math.max(prev - 1, 0));
              break;
          case 'Enter':
              e.preventDefault();
              if (filteredThemes.length > 0) {
                  handleSelect(filteredThemes[highlightedIndex]);
              }
              break;
          case 'Tab':
              if (filteredThemes.length > 0) {
                  handleSelect(filteredThemes[highlightedIndex]);
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
              placeholder="Buscar número ou nome..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <span className={`block truncate ${selectedLabel ? 'text-gray-900' : 'text-gray-500'}`}>
              {selectedLabel || placeholder}
            </span>
          )}
          
          <div className="flex items-center gap-1">
             {selectedLabel && !open && (
                <button onClick={handleClear} className="text-gray-400 hover:text-red-500 p-0.5">
                    <X size={14} />
                </button>
             )}
             <ChevronsUpDown className="w-4 h-4 text-gray-400 opacity-50" />
          </div>
        </div>

        {open && (
           <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto py-1">
              {filteredThemes.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500 text-center">Nenhum encontrado.</div>
              ) : (
                filteredThemes.map((theme, idx) => {
                   const isSelected = theme.tema === value;
                   const isHighlighted = idx === highlightedIndex;
                   return (
                     <div
                        key={theme.id}
                        onClick={() => handleSelect(theme)}
                        className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                            isSelected ? 'bg-purple-50 text-purple-700 font-medium' : 
                            isHighlighted ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                        }`}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                     >
                        <span><span className="font-bold mr-1">{theme.numero}.</span> {theme.tema}</span>
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
