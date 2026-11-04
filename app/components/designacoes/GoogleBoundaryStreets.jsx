'use client';
import { useMemo,useRef,useState } from 'react';
import { Search,MapPin,Plus } from 'lucide-react';
import { GoogleTerritoryMap,loadGoogleMaps } from './GoogleTerritoryMap';
import { lookupPoint,streetCandidates,geocodingMessage } from '@/app/lib/google-boundary-streets';

export function GoogleBoundaryStreets({boundary,outline,onAdd,onTargetSideChange,disabled=false}) {
  const [geoSide,setGeoSide]=useState('0'),[drawingSide,setDrawingSide]=useState('0');
  const [results,setResults]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[opened,setOpened]=useState(false);
  const cache=useRef(new Map()),inFlight=useRef(false);
  const areas=useMemo(()=>boundary?[{id:'boundary',limites:boundary}]:[],[boundary]);
  const count=boundary?.coordinates?.[0]?.length-1||0;
  async function lookup(){
    if(inFlight.current||disabled)return;
    const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if(!key){setError('Configure a chave do Google Maps para consultar as ruas.');return;}
    inFlight.current=true;setBusy(true);setError('');setResults([]);setOpened(true);
    try{
      const point=lookupPoint(boundary,Number(geoSide));const cacheKey=JSON.stringify(point);
      let candidates=cache.current.get(cacheKey);
      if(!candidates){
        const maps=await loadGoogleMaps(key);
        let timer;
        let response;
        try { response=await Promise.race([new maps.Geocoder().geocode({location:point}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('TIMEOUT')),15000);})]); }
        finally { clearTimeout(timer); }
        candidates=streetCandidates(response.results||[]);cache.current.set(cacheKey,candidates);
      }
      if(!candidates.length)setError('Não há rua identificada pelo Google neste trecho. Confira outro trecho do limite.');
      setResults(candidates);
    }catch(err){setError(geocodingMessage(`${err.code||''} ${err.message||''}`));}
    finally{inFlight.current=false;setBusy(false);}
  }
  return <section className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/40 p-3"><div><h4 className="text-sm font-semibold text-slate-900">Ruas ao redor do território · Google Maps</h4><p className="mt-1 text-xs leading-relaxed text-slate-600">Consulte um trecho do limite salvo e confirme a rua antes de colocá-la na lateral do esquema.</p></div>
    <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs font-medium text-slate-600">Trecho no mapa real<select value={geoSide} disabled={busy||disabled} onChange={e=>{setGeoSide(e.target.value);if(count===outline.length){setDrawingSide(e.target.value);onTargetSideChange?.(Number(e.target.value));}setResults([]);setError('');}} className="rounded-lg border border-slate-300 bg-white p-2 text-sm">{Array.from({length:count},(_,i)=><option key={i} value={i}>Trecho {i+1} do limite</option>)}</select></label><label className="grid gap-1 text-xs font-medium text-slate-600">Lateral no esquema<select value={drawingSide} disabled={busy||disabled} onChange={e=>{setDrawingSide(e.target.value);onTargetSideChange?.(Number(e.target.value));}} className="rounded-lg border border-slate-300 bg-white p-2 text-sm">{outline.map((_,i)=><option key={i} value={i}>Lateral {i+1} do desenho</option>)}</select></label></div>
    <button type="button" disabled={busy||disabled||!count} onClick={lookup} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-sky-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Search size={15} />{busy?'Consultando…':'Consultar rua deste trecho'}</button><p className="text-[11px] text-slate-500">Uma consulta Geocoding por trecho; o mapa exibido tem consumo separado. Repetir o mesmo trecho nesta edição reutiliza o resultado já obtido.</p>
    {opened&&<GoogleTerritoryMap areas={areas} selected="boundary" boundaryFocusSide={Number(geoSide)} />}
    {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
    {results.map(street=><div key={street.placeId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-100 bg-white p-3"><span className="inline-flex items-center gap-2 text-sm text-slate-800"><MapPin size={15} />{street.name}</span><button type="button" disabled={disabled||busy} onClick={()=>onAdd(street,Number(drawingSide))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold"><Plus size={14} />Usar nesta lateral</button></div>)}
    {opened&&<p className="text-[11px] text-slate-500">Resultados do Google Maps. A consulta identifica nomes próximos; confira no mapa se a rua corresponde à divisa desejada.</p>}
  </section>;
}
