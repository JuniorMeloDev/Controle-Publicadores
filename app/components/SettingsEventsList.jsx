'use client';

import { Calendar, Trash2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

const typeStyles = {
    Assembleia: 'border-blue-200 bg-blue-50 text-blue-700',
    Congresso: 'border-violet-200 bg-violet-50 text-violet-700',
    'Visita do Superintendente': 'border-amber-200 bg-amber-50 text-amber-800',
    Celebração: 'border-rose-200 bg-rose-50 text-rose-700',
    Feriado: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

export function SettingsEventsList({ events, year, canEdit, onDelete }) {
    const months = new Map();
    [...events].sort((a, b) => new Date(a.data) - new Date(b.data)).forEach(event => {
        const date = new Date(event.data);
        const key = date.toISOString().slice(0, 7);
        if (!months.has(key)) months.set(key, {
            label: date.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' }), events: [],
        });
        months.get(key).events.push({ ...event, date });
    });

    return <section aria-labelledby="settings-events-title" className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-3.5">
            <h4 id="settings-events-title" className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Calendar className="h-4 w-4 shrink-0 text-orange-600" aria-hidden="true" />Eventos em {year}
            </h4>
            <span className="shrink-0 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600">
                {events.length} {events.length === 1 ? 'evento' : 'eventos'}
            </span>
        </div>
        {!events.length ? <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Calendar className="h-8 w-8 text-gray-300" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-700">Nenhum evento neste ano</p>
            <p className="text-xs text-gray-500">Use o formulário acima para adicionar uma data ao calendário.</p>
        </div> : <div role="region" aria-label={`Lista de eventos de ${year}`} tabIndex={0}
            className="space-y-4 p-3 sm:p-4 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500">
            {[...months].map(([key, month]) => <div key={key}>
                <div className="mb-2.5 flex items-center gap-2">
                    <h5 className="text-xs font-semibold capitalize text-gray-600">{month.label}</h5>
                    <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
                    <span className="text-[11px] text-gray-400">{month.events.length}</span>
                </div>
                <ul className="space-y-2 md:space-y-0 md:divide-y md:divide-gray-100">
                    {month.events.map(event => <li key={event.id} className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-start gap-2 rounded-lg border border-gray-100 md:border-0 md:rounded-none bg-white p-2.5 transition-colors hover:border-gray-200 hover:bg-gray-50/60 sm:gap-3 sm:p-3">
                        <time dateTime={event.date.toISOString().slice(0, 10)} title={event.date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                            className="flex min-h-14 flex-col items-center justify-center rounded-lg border border-orange-100 bg-orange-50/70 text-orange-900">
                            <span className="text-xl font-bold leading-none">{event.date.getUTCDate()}</span>
                            <span className="mt-1 text-[10px] font-medium uppercase text-orange-700">{event.date.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')}</span>
                        </time>
                        <div className="min-w-0 py-0.5">
                            <p className="break-words text-sm font-medium leading-5 text-gray-900">{event.nome}</p>
                            <span className={`mt-2 inline-block max-w-full rounded-md border px-2 py-0.5 text-[11px] font-medium leading-4 ${typeStyles[event.tipo] || 'border-gray-200 bg-gray-50 text-gray-600'}`}>{event.tipo}</span>
                        </div>
                        <Button type="button" variant="ghost" size="icon" disabled={!canEdit}
                            className="h-10 w-10 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 focus-visible:ring-red-500"
                            aria-label={`Excluir evento: ${event.nome}`} title="Excluir evento" onClick={() => onDelete(event.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </li>)}
                </ul>
            </div>)}
        </div>}
    </section>;
}
