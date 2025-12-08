'use client';

import { useMemo } from 'react';
import { History, X, Search } from 'lucide-react';
import { Input } from '@/app/components/ui/input';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getGroupLabel(dateStr) {
    if (!dateStr) return 'Outros';
    // Accepts YYYY-MM-DD
    const [ano, mes] = dateStr.split('-');
    const nomeMes = MESES[parseInt(mes, 10) - 1];
    return `${nomeMes} ${ano}`;
}

export function HistorySidebar({ 
    items, // Array of { id, date (YYYY-MM-DD), label, ... }
    month, 
    setMonth, 
    year, 
    setYear,
    onSelect,
    selectedId 
}) {
    
    // Compute available years from items
    const availableYears = useMemo(() => {
        const years = new Set();
        items.forEach(item => {
            if (item.date) {
                const y = item.date.split('-')[0];
                years.add(y);
            }
        });
        return Array.from(years).sort().reverse();
    }, [items]);

    // Filtering logic is done by PARENT usually to sync main view, 
    // BUT we need to display filtered items in the list too. 
    // We assume 'items' PASSED IN are already ALL items or we filter them here?
    // If we want the sidebar to control the Global Filter, the Parent should pass ALL items, 
    // and the Parent should ALSO filter for the Main View.
    // To avoid duplication, the Parent should pass `filteredItems` to the sidebar?
    // NO, if passing `filteredItems`, then the sidebar cannot compute `availableYears` correctly (years would disappear on filter).
    // So Parent passes `allItems` AND `filteredItems`? Or Parent passes `allItems` and Sidebar does filtering for ITSELF?
    // The requirement is: Sidebar has Filters -> Filters affect Main View AND Sidebar List.
    // So Parent should hold state. Parent computes `filteredItems`.
    // Parent passes `filteredItems` to Sidebar list.
    // Parent passes `allItems` (or just years) to Sidebar for available options?
    // Actually, available years should come from ALL items. 
    // So: Props = { allItems, filteredItems, ... }
    
    // Let's refine props:
    // items: ALL items (for year extraction)
    // filteredItems: Items to display in the list
    // ...
    // But wait, `LifeMinistryTab` does it all internally.
    // I will simplify: Sidebar receives `allItems`, `month`, `year`. 
    // Sidebar calculates `filteredItems` for display? 
    // No, if Parent needs filtered items for the Main View, Parent must filter.
    // So Parent calculates `filteredItems` and passes it.
    // Parent ALSO needs `allItems` to preserve Year options? 
    // Yes.
    
    // Actually, simpler: 
    // Sidebar receives `availableYears` (calculated by parent) and `filteredItems`.
    
    return (
        <aside className="hidden md:flex w-full md:w-64 border-r border-gray-200 shadow-sm shrink-0 flex-col overflow-hidden bg-white h-full min-h-[500px]">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-base">
                        <History size={18} className="text-purple-600" /> Histórico
                    </h3>
                    {(month || year) && (
                        <button onClick={() => { setMonth(''); setYear(''); }} className="text-xs text-red-500 flex items-center hover:underline">
                            <X size={12} className="mr-1"/> Limpar
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <select 
                        value={month} 
                        onChange={(e) => setMonth(e.target.value)} 
                        className="text-sm border border-gray-200 rounded p-1.5 bg-white focus:ring-1 focus:ring-purple-500 outline-none text-gray-700"
                    >
                        <option value="">Mês</option>
                        {MESES.map((m, i) => <option key={i} value={String(i+1).padStart(2, '0')}>{m.substring(0, 3)}</option>)}
                    </select>
                    <select 
                        value={year} 
                        onChange={(e) => setYear(e.target.value)} 
                        className="text-sm border border-gray-200 rounded p-1.5 bg-white focus:ring-1 focus:ring-purple-500 outline-none text-gray-700"
                    >
                        <option value="">Ano</option>
                        {availableYears.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {items.length === 0 && (
                    <p className="text-sm text-gray-500 p-4 text-center">Nenhum item encontrado.</p>
                )}
                {items.map((item, index) => {
                    const currentGroup = getGroupLabel(item.date);
                    const prevGroup = index > 0 ? getGroupLabel(items[index - 1].date) : null;
                    const showGroupHeader = currentGroup !== prevGroup;

                    return (
                        <div key={item.id || index}>
                            {showGroupHeader && (
                                <div className="px-2 pt-3 pb-1 text-xs font-bold text-gray-800 uppercase tracking-wider border-b border-gray-100 mb-1 mt-1">
                                    {currentGroup}
                                </div>
                            )}
                            <button
                                onClick={() => onSelect && onSelect(item)}
                                className={`w-full text-left px-3 py-3 rounded-md text-sm transition-colors border border-transparent flex flex-col mb-0.5
                                    ${selectedId === item.id 
                                    ? 'bg-purple-50 text-purple-900 border-purple-100 font-medium' 
                                    : 'hover:bg-gray-50 text-gray-600 bg-transparent'
                                    }`}
                            >
                                <span className="truncate w-full text-sm font-medium">{item.label}</span>
                                {item.subLabel && <span className="text-xs text-gray-400 truncate mt-0.5">{item.subLabel}</span>}
                            </button>
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
