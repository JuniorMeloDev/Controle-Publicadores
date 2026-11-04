'use client';
import { useEffect, useState } from 'react';
import { SchematicMap } from './SchematicMap';

export function CongregationSchematic({ territories, onSelect }) {
  const [selected, setSelected] = useState('');
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/servico-campo/esquema?meta=1', {signal:controller.signal,cache:'no-store'}).then(async response => { if(response.ok) setMeta(await response.json()); }).catch(() => {});
    return () => controller.abort();
  }, []);
  function choose(value) { setSelected(value); if (value) onSelect(Number(value)); }
  return <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold text-gray-900">Mapa esquemático da congregação</h3><p className="mt-1 text-sm text-gray-500">Os territórios, as cores dos grupos e as referências do mapa original.</p></div><label className="grid gap-1 text-xs font-medium text-gray-600">Abrir território<select className="rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-900" value={selected} onChange={event => choose(event.target.value)}><option value="">Selecione um território</option>{territories.filter(t => t.ativo).map(t => <option key={t.id} value={t.id}>Território {t.numero}</option>)}</select></label></div><SchematicMap src="/api/admin/servico-campo/esquema" width={meta?.width || 1861} height={meta?.height || 2000} points={meta?.points || []} general territories={territories} selected={Number(selected) || null} onSelect={id => choose(String(id))} alt="Mapa geral esquemático da Congregação Praia dos Corais, com territórios e grupos" /></section>;
}
