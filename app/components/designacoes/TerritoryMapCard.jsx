'use client';
import { useState } from 'react';
import { ArrowUpRight, Check, Compass, Copy, MapPin, Navigation } from 'lucide-react';
import { SchematicMap } from './SchematicMap';
import { EditableTerritoryView } from './EditableTerritoryCanvas';
import { fieldMapUrl } from '@/app/lib/field-service';

export function TerritoryMapCard({ territory, image, congregation }) {
  const [feedback, setFeedback] = useState('');
  const group = territory.grupo_nome ? { name: territory.grupo_nome, color: territory.grupo_cor || '#64748b' } : null;
  let googleUrl = '';
  try { googleUrl = fieldMapUrl(territory.mapa_url); } catch { /* Invalid legacy URL. */ }
  if (!googleUrl && territory.limites) {
    const ring = territory.limites.coordinates[0].slice(0, -1);
    const center = ring.reduce((p, [lng, lat]) => ({ lat: p.lat + lat / ring.length, lng: p.lng + lng / ring.length }), { lat: 0, lng: 0 });
    googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}`;
  }
  async function share() {
    setFeedback('');
    try {
      const url = window.location.href;
      if (navigator.share) await navigator.share({ title: `Território ${territory.numero} · ${congregation}`, url });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setFeedback('Link copiado.'); }
      else setFeedback('Copie o endereço desta página para compartilhar.');
    } catch (error) { if (error.name !== 'AbortError') setFeedback('Copie o endereço desta página para compartilhar.'); }
  }
  return <main className="min-h-screen bg-slate-50 px-3 py-6 text-slate-900 sm:px-6 sm:py-10"><div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 px-1"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white"><Compass size={23} strokeWidth={1.6} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Serviço de campo</p><p className="mt-0.5 text-sm font-semibold text-slate-700">Congregação {congregation}</p></div></div>{group && <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"><span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor:group.color}} />Grupo {group.name}</span>}</header>
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-4 border-b border-slate-100 px-5 py-5 sm:px-7"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-bold text-slate-800">{String(territory.numero).padStart(2,'0')}</div><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Cartão esquemático</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Território {territory.numero}</h1>{territory.descricao && <p className="mt-1 text-sm text-slate-500">{territory.descricao}</p>}</div></div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_260px]"><section aria-label="Esquema do território" className="min-w-0 p-3 sm:p-5"><>{territory.mapa_prototipo && territory.mapa_layout ? <EditableTerritoryView layout={territory.mapa_layout} number={territory.numero} color={group?.color} /> : <SchematicMap {...image} alt={`Cartão original do Território ${territory.numero}, com ruas e pontos de referência`} />}</></section><aside className="flex flex-col gap-5 border-t border-slate-100 bg-slate-50 p-5 lg:border-l lg:border-t-0"><section><h2 className="flex items-center gap-2 text-sm font-bold"><MapPin size={17} />Referências e orientações</h2>{territory.mapa_prototipo && territory.mapa_layout?.landmarks.length ? <ul className="mt-3 space-y-3">{territory.mapa_layout.landmarks.map(p => <li key={p.id} className="text-sm leading-relaxed text-slate-600">{p.name}</li>)}</ul> : <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{territory.referencias || 'Consulte os pontos de referência indicados no cartão.'}</p>}</section><div className="mt-auto space-y-3">{googleUrl && <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"><Navigation size={16} />Abrir no Google Maps<ArrowUpRight size={15} /></a>}<button type="button" onClick={share} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">{feedback === 'Link copiado.' ? <Check size={16} /> : <Copy size={16} />}Compartilhar mapa</button>{googleUrl && <p className="text-xs leading-relaxed text-slate-500">A localização abre no Google Maps. As divisões do território estão no esquema.</p>}{feedback && <p role="status" className="text-xs font-medium text-slate-700">{feedback}</p>}</div></aside></div>
    </article><footer className="text-center text-xs text-slate-400">Congregação {congregation} · Mapa de apoio ao serviço de campo</footer>
  </div></main>;
}
