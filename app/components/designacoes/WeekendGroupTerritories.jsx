'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { isTerritoryAllowedForOuting } from '@/app/lib/field-service';

export function WeekendGroupTerritories({ form, groups, territories, onChange, onConsult }) {
  const [pendingSelections, setPendingSelections] = useState({});
  const mapping = form.territorios_por_grupo || {};
  const assigned = Object.values(mapping).flat();
  const unassigned = (form.territorios || []).filter(id => !assigned.includes(id));
  const number = id => territories.find(t => t.id === id)?.numero ?? '?';
  function change(groupId, selected) {
    const next = { ...mapping, [groupId]: selected };
    const flattened = Object.values(next).flat();
    onChange({ territorios_por_grupo: next, territorios: [...new Set([...unassigned, ...flattened])] });
  }
  return <fieldset className="space-y-3">
    <legend className="text-sm font-medium text-gray-700">Territórios por grupo</legend>
    <p className="text-sm text-gray-500">O dirigente faz a consideração e responde pelos territórios do próprio grupo. Os superintendentes respondem pelos territórios dos demais grupos. Você pode salvar agora e definir os territórios de cada grupo no dia da saída.</p>
    {!form.grupos?.length && <p className="text-sm text-amber-700">Selecione os grupos participantes para distribuir os territórios.</p>}
    <div className="grid gap-3 sm:grid-cols-2">{(form.grupos || []).map(groupId => {
      const selected = mapping[groupId] || [];
      const available = territories.filter(t => (t.ativo !== false || selected.includes(t.id))
        && !assigned.includes(t.id) && isTerritoryAllowedForOuting(t, { ...form, grupos: [groupId] }));
      const pending = available.some(t => t.id === pendingSelections[groupId]) ? pendingSelections[groupId] : '';
      const label = groups.find(g => g.id === groupId)?.nome || 'Grupo removido';
      return <div key={groupId} className="min-w-0 space-y-2 rounded-lg border border-gray-200 p-3">
        <p className="text-sm font-semibold">{label}</p>
        {selected.length ? <ul className="space-y-2">{selected.map(id => <li key={id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button type="button" className="text-purple-700 underline" onClick={() => onConsult(id)}>Território {number(id)}</button>
          <button type="button" className="text-red-600" aria-label={`Remover território ${number(id)} de ${label}`} onClick={() => change(groupId, selected.filter(value => value !== id))}>Remover</button>
        </li>)}</ul> : <p className="text-sm text-gray-500">Territórios a definir</p>}
        <div className="flex items-center gap-2">
          <select aria-label={`Selecionar território para ${label}`} value={pending} disabled={!available.length} className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" onChange={event => setPendingSelections(current => ({ ...current, [groupId]: Number(event.target.value) || '' }))}>
            <option value="">Selecione um território...</option>{available.map(t => <option key={t.id} value={t.id}>Território {t.numero}{t.mapa_grupo_id == null ? ' · Sem grupo no mapa' : ''}</option>)}
          </select>
          <button type="button" aria-label={`Adicionar território para ${label}`} title="Adicionar território" disabled={!pending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-purple-600 text-white hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => {
            if (!pending) return;
            change(groupId, [...selected, pending]);
            setPendingSelections(current => ({ ...current, [groupId]: '' }));
            onConsult(pending);
          }}><Plus className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        {!available.length && <p className="text-xs text-gray-500">Nenhum outro território disponível para este grupo.</p>}
      </div>;
    })}</div>
    {unassigned.length > 0 && <div className="space-y-2 rounded-lg border border-amber-200 p-3 text-sm">
      <p>Distribua entre os grupos os territórios já planejados abaixo ou remova-os da saída.</p>
      {unassigned.map(id => <div key={id} className="flex items-center justify-between gap-2"><span>Território {number(id)} · Sem grupo na saída</span><button type="button" className="text-red-600" onClick={() => onChange({ territorios: form.territorios.filter(value => value !== id) })}>Remover</button></div>)}
    </div>}
  </fieldset>;
}
