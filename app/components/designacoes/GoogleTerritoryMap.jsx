'use client';
import { useEffect, useRef, useState } from 'react';

let loading;
export function loadGoogleMaps(key) {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (!loading) loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => reject(new Error('O Google Maps demorou para responder. Recarregue a página.')), 20000);
    window.initTerritoryGoogleMaps = () => { clearTimeout(timer); resolve(window.google.maps); };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=initTerritoryGoogleMaps&v=quarterly&language=pt-BR&region=BR`;
    script.async = true;
    script.onerror = () => { clearTimeout(timer); reject(new Error('Não foi possível carregar o Google Maps. Verifique a conexão e a chave configurada.')); };
    document.head.appendChild(script);
  }).catch(error => { loading = null; throw error; });
  return loading;
}
const points = geometry => geometry?.coordinates?.[0]?.slice(0, -1).map(([lng, lat]) => ({ lat, lng })) || [];
const noReferences=[];

export function GoogleTerritoryMap({ areas = [], selected = 'geral', mode = '', initialGeometry = null, onChange, onSelect, center = null, pointCount = 0, onPointCountChange, appearance = 'default', viewRevision = 0, focusBoundary = null, boundaryFocusSide = null, heightClassName = 'h-[460px] min-h-80', references=noReferences, focusedReferenceId=null, onReferenceClick }) {
  const element = useRef(null);
  const instance = useRef(null);
  const fitView = useRef(null);
  const handlers = useRef({ onChange, onSelect, onPointCountChange, onReferenceClick });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  useEffect(() => { handlers.current = { onChange, onSelect, onPointCountChange, onReferenceClick }; }, [onChange, onSelect, onPointCountChange, onReferenceClick]);
  useEffect(() => {
    if (!key) return;
    let disposed = false;
    const authFailure = window.gm_authFailure;
    window.gm_authFailure = () => { if (!disposed) setError('O Google Maps recusou a chave. Confira a API habilitada, o faturamento e os sites permitidos no Google Cloud.'); };
    loadGoogleMaps(key).then(maps => {
      if (disposed) return;
      instance.current = new maps.Map(element.current, { center: center || { lat: -8.2, lng: -34.93 }, zoom: 14, streetViewControl: false, mapTypeControl: true, fullscreenControl: true, zoomControl: true, cameraControl: false, scaleControl: true, gestureHandling: 'cooperative' });
      setReady(true);
    }).catch(err => { if (!disposed) setError(err.message); });
    return () => { disposed = true; window.gm_authFailure = authFailure; if (instance.current) { window.google.maps.event.clearInstanceListeners(instance.current); instance.current = null; } };
    // The map is created once; areas below determine its viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!ready || !instance.current) return;
    const maps = window.google.maps;
    const map = instance.current;
    const layers = [];
    const listeners = [];
    const bounds = new maps.LatLngBounds();
    const review = appearance === 'territory-review';
    const card = appearance === 'territory-card' || review;
    // Keep the surrounding streets available while changing the congregation border.
    const focusPath = review || (mode && selected === 'geral') ? [] : points(focusBoundary);
    if (focusPath.length >= 3) {
      const latitudes = focusPath.map(p => p.lat);
      const longitudes = focusPath.map(p => p.lng);
      const south = Math.min(...latitudes), north = Math.max(...latitudes);
      const west = Math.min(...longitudes), east = Math.max(...longitudes);
      const winding = focusPath.reduce((sum, p, i) => {
        const next = focusPath[(i + 1) % focusPath.length];
        return sum + p.lng * next.lat - next.lng * p.lat;
      }, 0);
      const hole = winding > 0 ? focusPath : [...focusPath].reverse();
      layers.push(new maps.Polygon({ map, paths: [
        [{ lat: south - 5, lng: west - 5 }, { lat: north + 5, lng: west - 5 }, { lat: north + 5, lng: east + 5 }, { lat: south - 5, lng: east + 5 }], hole
      ], strokeOpacity: 0, fillColor: '#f1f5f9', fillOpacity: 1, clickable: true, zIndex: -1 }));
    }
    map.setOptions({ disableDoubleClickZoom: Boolean(mode), clickableIcons: !mode, draggableCursor: mode === 'draw' ? 'crosshair' : null,
      ...(review ? { isFractionalZoomEnabled: true } : {}),
      styles: review ? [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'road', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#111827' }] },
        { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 4 }] }
      ] : card ? [{ featureType: 'poi.business', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] }, { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] }] : null });
    const selectedArea = areas.find(a => a.id === selected);
    for (const item of areas) {
      if (!item.limites || (mode && item.id === selected)) continue;
      const path = points(item.limites);
      const layer = new maps.Polygon({ map, paths: path, strokeColor: item.id === 'geral' ? '#475569' : (card ? '#0369a1' : '#9333ea'), strokeWeight: review ? 2 : item.id === selected ? 4 : 2, fillColor: (card ? '#0ea5e9' : '#9333ea'), fillOpacity: review ? 0 : item.id === 'geral' ? 0.03 : item.id === selected ? card ? 0.12 : 0.25 : 0.1, zIndex: item.id === 'geral' ? 0 : 1, clickable: !review && !mode && item.id !== 'geral' });
      layers.push(layer);
      listeners.push(layer.addListener('click', () => handlers.current.onSelect?.(item.id)));
      if (!selectedArea?.limites || item.id === selected) path.forEach(p => bounds.extend(p));
    }
    const editingPath = mode === 'edit' ? points(initialGeometry) : [];
    let viewBounds = bounds;
    if (editingPath.length) {
      const editingBounds = new maps.LatLngBounds();
      editingPath.forEach(point => editingBounds.extend(point));
      viewBounds = editingBounds;
    }
    const fit = () => { if (!viewBounds.isEmpty()) map.fitBounds(viewBounds, review ? 24 : editingPath.length ? 48 : 36); };
    fitView.current = fit;
    fit();
    // Refit after the modal has its final dimensions, including fullscreen changes.
    let fitFrame;
    const resizeObserver = review ? new ResizeObserver(() => {
      cancelAnimationFrame(fitFrame);
      fitFrame = requestAnimationFrame(fit);
    }) : null;
    resizeObserver?.observe(element.current);
    if(Number.isInteger(boundaryFocusSide)&&selectedArea?.limites){
      const path=points(selectedArea.limites);
      if(path[boundaryFocusSide])layers.push(new maps.Polyline({map,path:[path[boundaryFocusSide],path[(boundaryFocusSide+1)%path.length]],strokeColor:'#ea580c',strokeWeight:7,zIndex:20,clickable:false}));
    }
    if (mode) {
      const path = mode === 'edit' ? points(initialGeometry) : [];
      const draftPath = new maps.MVCArray(path.map(p => new maps.LatLng(p)));
      const draft = new maps.Polygon({ map, paths: new maps.MVCArray([draftPath]), strokeColor: '#ea580c', fillColor: '#fb923c', fillOpacity: 0.2, strokeWeight: 3, editable: true, clickable: true, zIndex: 10 });
      layers.push(draft);
      const emit = () => {
        const ring = draftPath.getArray().map(p => [p.lng(), p.lat()]);
        handlers.current.onPointCountChange?.(ring.length);
        handlers.current.onChange?.(ring.length >= 3 ? { type: 'Polygon', coordinates: [[...ring, [...ring[0]]]] } : null);
      };
      for (const event of ['insert_at', 'set_at', 'remove_at']) listeners.push(draftPath.addListener(event, emit));
      if (mode === 'draw') listeners.push(map.addListener('click', event => draftPath.push(event.latLng)));
      if (mode === 'draw') listeners.push(draft.addListener('click', event => { if (event.vertex === undefined && event.edge === undefined) draftPath.push(event.latLng); }));
      listeners.push(draft.addListener('rightclick', event => { if (event.vertex !== undefined && draftPath.getLength() > 3) draftPath.removeAt(event.vertex); }));
    }
    return () => { resizeObserver?.disconnect(); cancelAnimationFrame(fitFrame); fitView.current = null; listeners.forEach(listener => listener.remove()); layers.forEach(layer => layer.setMap(null)); };
  }, [ready, areas, selected, mode, initialGeometry, appearance, viewRevision, focusBoundary, boundaryFocusSide]);
  useEffect(()=>{
    if(!ready||!instance.current)return;
    const maps=window.google.maps;
    const markers=references.map((reference,index)=>{
      const focused=reference.id===focusedReferenceId;
      const marker=new maps.Marker({map:instance.current,position:reference.location,title:reference.name,
        label:{text:String(index+1),color:'#ffffff',fontSize:'11px',fontWeight:'700'},
        icon:{path:maps.SymbolPath.CIRCLE,scale:focused?15:12,fillColor:focused?'#ea580c':reference.selected?'#7e22ce':'#64748b',fillOpacity:1,strokeColor:'#ffffff',strokeWeight:2},zIndex:focused?40:30});
      const listener=marker.addListener('click',()=>handlers.current.onReferenceClick?.(reference.id));
      return {marker,listener};
    });
    return()=>markers.forEach(({marker,listener})=>{listener.remove();marker.setMap(null);});
  },[ready,references,focusedReferenceId]);
  useEffect(()=>{
    if(!ready||!instance.current||!focusedReferenceId)return;
    const reference=references.find(item=>item.id===focusedReferenceId);
    if(reference){instance.current.panTo(reference.location);if(instance.current.getZoom()<18)instance.current.setZoom(18);}
  },[ready,focusedReferenceId,references]);
  if (!key) return <div className="rounded-xl border border-dashed border-purple-300 bg-purple-50 p-6 text-sm text-gray-700"><p className="font-semibold text-gray-900">Configure o Google Maps para desenhar os limites</p><p className="mt-2">Ative a Maps JavaScript API no Google Cloud e configure a chave do site. Os PDFs continuam disponíveis como referência.</p><a className="mt-3 inline-block text-purple-700 underline" href="https://developers.google.com/maps/documentation/javascript/get-api-key?hl=pt-br" target="_blank" rel="noopener noreferrer">Como configurar a chave</a></div>;
  return <div className="space-y-2">{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div ref={element} aria-label="Mapa dos limites dos territórios" className={`${heightClassName} w-full rounded-xl border border-gray-200`} />{appearance === 'territory-review' && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600"><p>Confira as ruas dentro e ao redor do contorno azul. Use + para ampliar.</p><button type="button" disabled={!ready} className="font-medium text-purple-700 underline disabled:opacity-50" onClick={() => fitView.current?.()}>Enquadrar território</button></div>}{mode && <p className="text-sm text-gray-500">{pointCount} pontos no contorno</p>}{!ready && !error && <p role="status" className="text-sm text-gray-500">Carregando Google Maps…</p>}</div>;
}
