'use client';

import { useDesignationPeriod } from './DesignationPeriodContext';

export const designationToolbarClass = 'bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3';
export const designationActionClass = 'h-10 w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed';
export const designationListHeaderClass = 'p-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3';

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function DesignationPeriodFilters({ years = [], onClear, hasAdditionalFilters = false }) {
    const { month, year, setMonth, setYear } = useDesignationPeriod();
    const options = [...new Set([String(new Date().getFullYear()), ...(year ? [year] : []), ...years.map(String)])].sort().reverse();
    const selectClass = 'h-10 min-w-0 w-full sm:w-36 border border-gray-300 rounded-md px-3 bg-white text-sm text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none';
    return <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
        <select aria-label="Mês das designações" value={month} onChange={e => setMonth(e.target.value)} className={selectClass}>
            <option value="">Todos os meses</option>
            {months.map((name, index) => <option key={name} value={String(index + 1).padStart(2, '0')}>{name}</option>)}
        </select>
        <select aria-label="Ano das designações" value={year} onChange={e => setYear(e.target.value)} className={selectClass}>
            <option value="">Todos os anos</option>
            {options.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        {(month || year || hasAdditionalFilters) && <button type="button" onClick={() => { setMonth(''); setYear(''); onClear?.(); }}
            className="col-span-2 h-10 px-3 text-sm text-red-600 hover:bg-red-50 rounded-md whitespace-nowrap">Limpar filtros</button>}
    </div>;
}
