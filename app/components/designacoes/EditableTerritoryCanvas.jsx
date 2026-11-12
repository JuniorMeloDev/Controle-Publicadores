'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MapPin, Store, Trees, School, Plus, Minus, Pill, ShoppingCart, Utensils, Croissant, Church, Scissors, Hospital } from 'lucide-react';
import { editableDrawingBounds, automaticReferenceGroups } from '@/app/lib/editable-territory';
import { roadLabelLayout } from '@/app/lib/road-label-layout';
import { territoryNumberPosition } from '@/app/lib/territory-number-position';

export function EditableTerritoryCanvas({layout,color='#0284c7',number,editing=false,tool='',selected=null,onSelect,onChange,onCheckpoint,highlightSide=null}) {
  const svg=useRef(null),drag=useRef(null);
  const prefix=useId().replace(/:/g,'');
  const [measureLabel,setMeasureLabel]=useState(()=>text=>text.length*9);
  useEffect(()=>{
    let active=true;
    document.fonts.ready.then(()=>{
      if(!active)return;
      const context=document.createElement('canvas').getContext('2d');
      if(context){context.font='600 18px Arial';setMeasureLabel(()=>text=>context.measureText(text).width);}
    });
    return()=>{active=false;};
  },[]);
  const roadLabels=useMemo(()=>layout.roads.map(road=>({road,parts:roadLabelLayout(road,layout.roads,measureLabel)})),[layout.roads,measureLabel]);
  const locate=event=>{const p=svg.current.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const local=p.matrixTransform(svg.current.getScreenCTM().inverse());return [Math.max(0,Math.min(1000,local.x)),Math.max(0,Math.min(700,local.y))];};
  const numberPosition=useMemo(()=>territoryNumberPosition(layout,editing),[layout,editing]);
  const bounds=editableDrawingBounds(layout);
  const referenceGroups=useMemo(()=>automaticReferenceGroups(layout.landmarks),[layout.landmarks]);
  function start(event,type,index,id){if(!editing)return;event.stopPropagation();onCheckpoint?.();drag.current={type,index,id};event.currentTarget.setPointerCapture(event.pointerId);}
  function move(event){if(!drag.current||!editing)return;const p=locate(event),target=drag.current;let next;
    if(target.type==='outline')next={...layout,outline:layout.outline.map((old,i)=>i===target.index?p:old)};
    else if(target.type==='road')next={...layout,roads:layout.roads.map(r=>r.id===target.id?{...r,points:r.points.map((old,i)=>i===target.index?p:old)}:r)};
    else next={...layout,landmarks:layout.landmarks.map(m=>m.id===target.id?{...m,position:p}:m)};
    onChange?.(next);
  }
  function click(event){if(!editing)return;const p=locate(event);if(tool==='reference'){onCheckpoint?.();const id=crypto.randomUUID();onChange({...layout,landmarks:[...layout.landmarks,{id,name:'Nova referência',kind:'reference',position:p}]});onSelect?.({type:'landmark',id});}
    else if(tool==='road'){onCheckpoint?.();const id=crypto.randomUUID();onChange({...layout,roads:[...layout.roads,{id,name:'Nova rua',points:[p,[Math.min(980,p[0]+140),Math.min(680,p[1]+40)]]}]});onSelect?.({type:'road',id});}
    else onSelect?.({type:'outline'});
  }
  const pick=(event,item)=>{if(editing){event.stopPropagation();onSelect?.(item);}};
  const handle=(p,index,type,id)=><circle key={index} cx={p[0]} cy={p[1]} r="7" fill="white" stroke="#0f172a" strokeWidth="2" className="cursor-move" aria-label={`Ponto ${index+1} da ${type==='outline'?'forma':'rua'}`} onPointerDown={event=>start(event,type,index,id)} onClick={event=>event.stopPropagation()} onContextMenu={event=>{
    event.preventDefault();event.stopPropagation();
    const points=type==='outline'?layout.outline:layout.roads.find(r=>r.id===id)?.points;
    if(!points||points.length<=(type==='outline'?3:2))return;
    onCheckpoint?.();const next=points.filter((_,i)=>i!==index);
    onChange?.(type==='outline'?{...layout,outline:next}:{...layout,roads:layout.roads.map(r=>r.id===id?{...r,points:next}:r)});
  }}><title>Arraste para mover. Botão direito para remover.</title></circle>;
  return <svg ref={svg} viewBox={editing?'0 0 1000 700':`${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}`} role="img" aria-label={`Desenho editável do Território ${number}`} className={`h-auto min-h-64 w-full rounded-xl border border-slate-200 bg-white ${editing?'touch-none':''}`} onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onClick={click}>
    <defs><pattern id={`${prefix}-grid`} width="25" height="25" patternUnits="userSpaceOnUse"><path d="M 25 0 L 0 0 0 25" fill="none" stroke="#e2e8f0" strokeWidth="0.7" /></pattern></defs>
    {editing&&<rect width="1000" height="700" fill={`url(#${prefix}-grid)`} />}
    <polygon points={layout.outline.map(p=>p.join(',')).join(' ')} fill={color} fillOpacity="0.78" stroke={color} strokeWidth="4" strokeLinejoin="round" onClick={event=>{if(tool!=='road'&&tool!=='reference')pick(event,{type:'outline'});}} />
    {editing&&Number.isInteger(highlightSide)&&layout.outline[highlightSide]&&<g pointerEvents="none"><line x1={layout.outline[highlightSide][0]} y1={layout.outline[highlightSide][1]} x2={layout.outline[(highlightSide+1)%layout.outline.length][0]} y2={layout.outline[(highlightSide+1)%layout.outline.length][1]} stroke="#ea580c" strokeWidth="7" strokeDasharray="9 5" /><text x={(layout.outline[highlightSide][0]+layout.outline[(highlightSide+1)%layout.outline.length][0])/2} y={(layout.outline[highlightSide][1]+layout.outline[(highlightSide+1)%layout.outline.length][1])/2-12} textAnchor="middle" fontSize="18" fontWeight="700" fill="#9a3412" stroke="white" strokeWidth="4" paintOrder="stroke">Lateral {highlightSide+1}</text></g>}
    {/* Draw all street surfaces first so intersections cannot cover earlier labels. */}
    {layout.roads.map(road=><path key={road.id} id={`${prefix}-${road.id}`} d={road.points.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join(' ')} stroke={selected?.id===road.id?'#cbd5e1':'white'} strokeWidth="27" strokeLinecap="round" fill="none" onClick={event=>pick(event,{type:'road',id:road.id})} className={editing?'cursor-pointer':''} />)}
    {roadLabels.map(({road,parts})=><g key={road.id} aria-label={road.name} onClick={event=>pick(event,{type:'road',id:road.id})} className={editing?'cursor-pointer':''}>{parts.map((part,index)=><text key={index} fontFamily="Arial, sans-serif" fontSize={road.labelFontSize||18} fill="#0f172a" dominantBaseline="central" fontWeight="600" stroke="white" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke"><textPath href={`#${prefix}-${road.id}`} startOffset={part.offset} textAnchor="middle" textLength={part.width} lengthAdjust="spacingAndGlyphs">{part.text}</textPath></text>)}</g>)}
    {editing&&selected?.type==='road'&&layout.roads.find(road=>road.id===selected.id)?.points.map((p,i)=>handle(p,i,'road',selected.id))}
    <g pointerEvents="none"><circle cx={numberPosition[0]} cy={numberPosition[1]} r="26" fill="white" fillOpacity="0.9" stroke="#0f172a" strokeWidth="2" /><text x={numberPosition[0]} y={numberPosition[1]+9} textAnchor="middle" fontSize="25" fontWeight="700" fill="#0f172a">{number}</text></g>
    {layout.landmarks.filter(marker=>editing||!marker.id.startsWith('osm-point-')).map(marker=>{const Icon={school:School,shop:Store,square:Trees,reference:MapPin,pharmacy:Pill,supermarket:ShoppingCart,restaurant:Utensils,bakery:Croissant,church:Church,hairdresser:Scissors,hospital:Hospital}[marker.kind]||MapPin;const lines=marker.name.split(/\r?\n/),fontSize=marker.labelFontSize||16,lineHeight=fontSize*1.25;return <g key={marker.id} onClick={event=>pick(event,{type:'landmark',id:marker.id})} onPointerDown={event=>start(event,'landmark',0,marker.id)} className={editing?'cursor-move':''}><circle cx={marker.position[0]} cy={marker.position[1]} r="19" fill="white" stroke={selected?.id===marker.id?'#0f172a':color} strokeWidth="2" /><Icon x={marker.position[0]-11} y={marker.position[1]-11} width="22" height="22" color="#0f172a" /><text transform={`rotate(${marker.labelRotation||0} ${marker.position[0]} ${marker.position[1]})`} x={marker.position[0]+27} y={marker.position[1]+5-(lines.length-1)*lineHeight/2} fontSize={fontSize} fontWeight="600" fill="#0f172a" stroke="white" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round">{lines.map((line,index)=><tspan key={index} x={marker.position[0]+27} y={marker.position[1]+5-(lines.length-1)*lineHeight/2+index*lineHeight}>{line}</tspan>)}</text></g>;})}
    {!editing&&referenceGroups.map(group=><g key={group.number} aria-label={group.markers.map(marker=>marker.name).join(', ')}><title>{group.markers.map(marker=>marker.name).join(', ')}</title><circle cx={group.position[0]} cy={group.position[1]} r="15" fill="white" stroke={color} strokeWidth="2" /><text x={group.position[0]} y={group.position[1]} textAnchor="middle" dominantBaseline="central" fontSize="16" fontWeight="700" fill="#0f172a">{group.number}</text></g>)}
    {editing&&(tool==='outline'||selected?.type==='outline')&&layout.outline.map((p,i)=>handle(p,i,'outline'))}
  </svg>;
}

export function EditableTerritoryView(props) {
  const [zoom,setZoom]=useState(1);
  const bounds=editableDrawingBounds(props.layout);
  const references=automaticReferenceGroups(props.layout.landmarks);
  const button='inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40';
  return <div className="space-y-2"><div className="flex justify-end gap-2"><button type="button" aria-label="Diminuir desenho" disabled={zoom<=1} className={button} onClick={()=>setZoom(value=>Math.max(1,value-0.5))}><Minus size={16} /></button><button type="button" className="text-xs text-slate-600" onClick={()=>setZoom(1)} aria-label="Ajustar desenho à tela">{Math.round(zoom*100)}%</button><button type="button" aria-label="Ampliar desenho" disabled={zoom>=3} className={button} onClick={()=>setZoom(value=>Math.min(3,value+0.5))}><Plus size={16} /></button></div><div className="max-h-[80vh] overflow-auto"><div className="mx-auto" style={{width:`calc(min(100%, ${64*bounds.width/bounds.height}vh) * ${zoom})`}}><EditableTerritoryCanvas {...props} /></div></div>{references.length>0&&<section className="rounded-lg border border-slate-200 bg-slate-50 p-3"><h4 className="mb-2 text-sm font-semibold text-slate-800">Pontos de referência</h4><ol className="grid gap-2 sm:grid-cols-2">{references.map(group=><li key={group.number} className="flex items-start gap-2 text-sm text-slate-700"><span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white font-bold">{group.number}</span><span>{group.markers.map(marker=>marker.name).join(" · ")}</span></li>)}</ol></section>}{props.layout.roads.some(road=>road.googlePlaceId)&&<p className="text-xs text-slate-500">Ruas consultadas no <a href="https://maps.google.com/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Google Maps</a>.</p>}</div>;
}
