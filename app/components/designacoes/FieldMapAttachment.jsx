'use client';

import { useId, useRef, useState } from 'react';
import { MAX_FIELD_MAP_BYTES } from '@/app/lib/field-map';

export function FieldMapLinks({ territoryId, map }) {
  if (!map) return null;
  const url = `/api/admin/servico-campo/mapas${territoryId ? `?territorio=${territoryId}` : ''}`;
  return <div className="space-y-1 min-w-0"><p className="text-xs text-gray-500 break-words">{map.nome} · {(map.tamanho / 1024 / 1024).toFixed(2)} MB</p><div className="flex flex-wrap gap-3 text-sm text-purple-700"><a className="underline" href={url} target="_blank" rel="noopener noreferrer">Visualizar mapa</a><a className="underline" href={`${url}${territoryId ? '&' : '?'}download=1`}>Baixar PDF</a></div></div>;
}

export function FieldMapAttachment({ territoryId, map, canEdit, onSaved }) {
  const id = useId();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !canEdit || inFlight.current) return;
    setError('');
    if (!/\.pdf$/i.test(file.name) || file.size > MAX_FIELD_MAP_BYTES || !file.size) { setError('Selecione um PDF de até 10 MB.'); return; }
    inFlight.current = true; setBusy(true);
    try {
      const form = new FormData(); form.append('arquivo', file);
      if (territoryId) form.append('territorio', String(territoryId));
      const response = await fetch('/api/admin/servico-campo/mapas', { method: 'POST', body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Não foi possível salvar o mapa.');
      await onSaved();
    } catch (err) { setError(err.message); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="space-y-2 min-w-0"><FieldMapLinks territoryId={territoryId} map={map} />{!map && <p className="text-sm text-gray-500">Nenhum PDF anexado.</p>}
    {canEdit && <div><label htmlFor={id} className="block text-sm text-gray-700 mb-1">{busy ? 'Salvando mapa…' : map ? 'Substituir mapa (PDF, até 10 MB)' : 'Adicionar mapa (PDF, até 10 MB)'}</label><input id={id} type="file" accept=".pdf,application/pdf" disabled={busy} onChange={upload} className="block max-w-full text-sm text-gray-600 file:mr-2 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-gray-700 disabled:opacity-50" /></div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}

