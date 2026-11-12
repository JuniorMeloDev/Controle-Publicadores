'use client';
import { useState } from 'react';

export function TerritoryReferencePicker({options,selectedIds,onChange,focusedId,onFocus,disabled=false}){
  const [search,setSearch]=useState('');
  const term=search.trim().toLocaleLowerCase('pt-BR');
  const filtered=options.filter(option=>option.name.toLocaleLowerCase('pt-BR').includes(term));
  return <section className="min-w-0 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-gray-900">Referências que aparecerão no cartão</h3><span className="text-xs font-medium text-purple-700">{selectedIds.length} selecionada(s)</span></div>
    <p className="text-sm text-gray-600">Marque os locais mais úteis para orientar os publicadores. Clique no nome para destacar o ponto no mapa. Você também pode validar sem referências.</p>
    <p className="text-xs text-gray-500">As sugestões usam os pontos disponíveis no OpenStreetMap dentro do contorno e as referências já cadastradas no cartão.</p>
    <fieldset disabled={disabled} className="space-y-3">
      <label className="grid gap-1 text-sm text-gray-700">Buscar referência<input type="search" value={search} onChange={event=>setSearch(event.target.value)} className="min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900" placeholder="Digite o nome do local" /></label>
      <div className="flex flex-wrap gap-4 text-xs"><button type="button" className="text-purple-700 underline" disabled={!options.length} onClick={()=>onChange(options.map(option=>option.id))}>Selecionar todas</button><button type="button" className="text-gray-600 underline" onClick={()=>onChange([])}>Limpar seleção</button></div>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {filtered.map(option=><div key={option.id} className={`flex items-start gap-3 rounded-lg border p-3 ${focusedId===option.id?'border-purple-300 bg-purple-50':'border-gray-200 bg-white'}`}>
          <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-purple-600" aria-label={`Incluir ${option.name} no cartão`} checked={selectedIds.includes(option.id)} onChange={event=>onChange(event.target.checked?[...selectedIds,option.id]:selectedIds.filter(id=>id!==option.id))} />
          <button type="button" disabled={!option.location} aria-pressed={focusedId===option.id} onClick={()=>onFocus(option.id)} className="min-w-0 flex-1 rounded text-left text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-purple-500"><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">{options.indexOf(option)+1}</span><span className="[overflow-wrap:anywhere]">{option.name}</span><span className="mt-1 block text-xs text-gray-500">{option.id.startsWith('osm-point-')?'OpenStreetMap':'Cadastrada no cartão'} · {option.location?'Destacar no mapa':'Consulta indisponível'}</span></button>
        </div>)}
        {!filtered.length&&<p className="p-3 text-sm text-gray-500">{options.length?'Nenhuma referência corresponde à busca.':'Nenhuma referência disponível neste contorno. Você pode salvar sem referências.'}</p>}
      </div>
    </fieldset>
  </section>;
}
