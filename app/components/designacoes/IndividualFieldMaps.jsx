'use client';

import { MapPin } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { FieldMapAttachment } from './FieldMapAttachment';
import { buildTerritoryMessage } from '@/app/lib/field-service-share';
import { fieldMapUrl } from '@/app/lib/field-service';

export function TerritoryMapDetails({ territory: selected, maps, canEdit, onEdit, onShare, onSaved, onClose }) {
  let selectedUrl = '';
  try { selectedUrl = fieldMapUrl(selected?.mapa_url); } catch { /* Ignore invalid legacy links. */ }
  return (
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto bg-white text-gray-900">
        <DialogHeader><DialogTitle>Território {selected?.numero}{selected?.ativo === false ? ' · Inativo' : ''}</DialogTitle><DialogDescription>{selected?.descricao || 'Mapa e referências do território.'}</DialogDescription></DialogHeader>
        {selected && <div className="space-y-5">
          <div className="space-y-2"><h4 className="text-sm font-semibold">Referências das quadras e orientações</h4><p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{selected.referencias || 'Nenhuma referência cadastrada.'}</p></div>
          <div className="space-y-2"><h4 className="text-sm font-semibold">Google Maps do território</h4>{selectedUrl ? <a href={selectedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-purple-700 underline"><MapPin className="h-4 w-4" />Abrir território no Google Maps</a> : <p className="text-sm text-gray-500">Link do Google Maps a cadastrar.</p>}</div>
          <div className="space-y-2"><h4 className="text-sm font-semibold">PDF do mapa</h4><FieldMapAttachment territoryId={selected.id} map={maps.find(map => map.territorio_id === selected.id)} canEdit={canEdit} onSaved={onSaved} /></div>
        </div>}
        <DialogFooter className="flex flex-wrap gap-2">{selected && canEdit && <Button type="button" variant="outline" onClick={() => { onClose(); onEdit(selected); }}>Editar mapa e referências</Button>}{selected && <Button type="button" onClick={() => { onClose(); onShare(buildTerritoryMessage(selected)); }} className="bg-purple-600 hover:bg-purple-700 text-white">Compartilhar</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
