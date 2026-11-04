'use client';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';

export function SchematicMap({ src, width, height, general = false, territories = [], onSelect, selected = null, points = [], alt = 'Mapa esquemático do território' }) {
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const container = useRef(null);
  const control = 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40';
  return <div ref={container} className="overflow-hidden rounded-xl border border-slate-200 bg-white [&:fullscreen]:overflow-auto">
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white p-2.5"><p className="px-1 text-xs text-slate-500">{general ? 'Selecione o número de um território no esquema.' : 'Amplie para consultar ruas e referências.'}</p><div className="flex items-center gap-1.5"><button type="button" className={control} aria-label="Diminuir mapa" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - 0.5))}><Minus size={16} /></button><span className="w-10 text-center text-xs font-semibold text-slate-600">{Math.round(zoom * 100)}%</span><button type="button" className={control} aria-label="Ampliar mapa" disabled={zoom >= 4} onClick={() => setZoom(value => Math.min(4, value + 0.5))}><Plus size={16} /></button><button type="button" className={control} aria-label="Ajustar mapa à tela" onClick={() => setZoom(1)}><RotateCcw size={15} /></button><button type="button" className={control} aria-label="Abrir mapa em tela cheia" onClick={() => { if (document.fullscreenElement) document.exitFullscreen?.(); else container.current?.requestFullscreen?.().catch(() => {}); }}><Maximize2 size={16} /></button></div></div>
    {failed ? <p role="alert" className="p-6 text-sm text-red-700">O esquema está indisponível ou o PDF foi atualizado. As imagens de referência precisam ser preparadas novamente.</p> : <div className="max-h-[80vh] overflow-auto bg-slate-100 p-3 sm:p-5"><div className="relative mx-auto bg-white shadow-sm" style={{ width: `calc(min(100%, ${general ? '70vh' : '900px'}) * ${zoom})` }}><Image src={src} width={width} height={height} unoptimized alt={alt} className="h-auto w-full" onError={() => setFailed(true)} onLoad={() => setFailed(false)} />{general && points.map(({territorio_id,x,y}) => {
      const territory = territories.find(t => t.id === territorio_id && t.ativo);
      const number = territory?.numero;
      return territory ? <button type="button" key={number} aria-label={`Abrir território ${number}`} title={`Território ${number}`} onClick={() => onSelect?.(territory.id)} className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${selected === territory.id ? 'border-slate-900 bg-white text-slate-900 shadow-md' : 'border-transparent bg-transparent text-transparent hover:border-slate-900 hover:bg-white hover:text-slate-900'}`} style={{left:`${x}%`,top:`${y}%`}}>{number}</button> : null;
    })}</div></div>}

  </div>;
}
