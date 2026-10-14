'use client';

import { useState } from 'react';
import { ChevronRight, MapPin } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { FieldMapAttachment } from './FieldMapAttachment';
import { buildTerritoryMessage } from '@/app/lib/field-service-share';
import { fieldMapUrl } from '@/app/lib/field-service';
import { designationListHeaderClass } from './DesignationLayout';

export function IndividualFieldMaps({ territories, maps, canEdit, showInactive, onEdit, onShare, onSaved }) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = territories.find(row => row.id === selectedId);
  const visible = territories.filter(row => showInactive || row.ativo);
  let selectedUrl = '';
  try { selectedUrl = fieldMapUrl(selected?.mapa_url); } catch { /* Ignore invalid legacy links. */ }
  return <section className="bg-white rounded-xl border border-gray-200 overflow-hidden" aria-label="Mapas individuais">
    <div className={designationListHeaderClass}><div><h3 className="font-semibold text-gray-900">Mapas individuais</h3><p className="text-sm text-gray-500 mt-1">Selecione um território para ver o mapa e as referências.</p></div>{canEdit && <Button type="button" variant="outline" onClick={() => onEdit()}>Cadastrar território</Button>}</div>
    {visible.length ? <div className="p-4 space-y-3 md:p-0 md:space-y-0 md:divide-y md:divide-gray-100">{visible.map(row => {
      const map = maps.find(item => item.territorio_id === row.id);
      return <button type="button" key={row.id} aria-label={`Ver detalhes do território ${row.numero}`} onClick={() => setSelectedId(row.id)}
        className="w-full min-w-0 flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left hover:bg-purple-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500 md:border-0 md:rounded-none md:py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600"><MapPin className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className="block font-semibold text-gray-900">Território {row.numero}{!row.ativo ? ' · Inativo' : ''}</span>
          {row.descricao && <span className="block text-sm text-gray-500 truncate">{row.descricao}</span>}
          <span className="block text-xs text-gray-500 mt-1">{map ? 'PDF disponível' : 'PDF a cadastrar'}{row.mapa_url ? ' · Google Maps cadastrado' : ''}</span>
        </span><ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
      </button>;
    })}</div> : <p className="p-6 text-sm text-gray-500">Cadastre um território para adicionar seu PDF, referências e link do Google Maps.</p>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelectedId(null); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto bg-white text-gray-900">
        <DialogHeader><DialogTitle>Território {selected?.numero}{selected?.ativo === false ? ' · Inativo' : ''}</DialogTitle><DialogDescription>{selected?.descricao || 'Mapa e referências do território.'}</DialogDescription></DialogHeader>
        {selected && <div className="space-y-5">
          <div className="space-y-2"><h4 className="text-sm font-semibold">Referências das quadras e orientações</h4><p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{selected.referencias || 'Nenhuma referência cadastrada.'}</p></div>
          <div className="space-y-2"><h4 className="text-sm font-semibold">Google Maps do território</h4>{selectedUrl ? <a href={selectedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-purple-700 underline"><MapPin className="h-4 w-4" />Abrir território no Google Maps</a> : <p className="text-sm text-gray-500">Link do Google Maps a cadastrar.</p>}</div>
          <div className="space-y-2"><h4 className="text-sm font-semibold">PDF do mapa</h4><FieldMapAttachment territoryId={selected.id} map={maps.find(map => map.territorio_id === selected.id)} canEdit={canEdit} onSaved={onSaved} /></div>
        </div>}
        <DialogFooter className="flex flex-wrap gap-2">{selected && canEdit && <Button type="button" variant="outline" onClick={() => { setSelectedId(null); onEdit(selected); }}>Editar mapa e referências</Button>}{selected && <Button type="button" onClick={() => { setSelectedId(null); onShare(buildTerritoryMessage(selected)); }} className="bg-purple-600 hover:bg-purple-700 text-white">Compartilhar</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
