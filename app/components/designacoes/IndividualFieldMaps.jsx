'use client';

import { useState } from 'react';
import { EditableTerritoryEditor } from './EditableTerritoryEditor';

import { MapPin } from 'lucide-react';
import { SchematicMap } from './SchematicMap';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { FieldMapAttachment } from './FieldMapAttachment';
import { buildTerritoryMessage } from '@/app/lib/field-service-share';
import { fieldMapUrl } from '@/app/lib/field-service';

export function TerritoryMapDetails({ territory: selected, maps, canEdit, onEdit, onShare, publicMapUrl = '', onSaved, onClose }) {
  const [prototypeEditing, setPrototypeEditing] = useState(false);
  let selectedUrl = '';
  try { selectedUrl = fieldMapUrl(selected?.mapa_url); } catch { /* Ignore invalid legacy links. */ }
  return (
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open && !prototypeEditing) onClose(); }}>
      <DialogContent onEscapeKeyDown={e => { if (prototypeEditing) e.preventDefault(); }} onInteractOutside={e => { if (prototypeEditing) e.preventDefault(); }} className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto bg-white text-gray-900">
        <DialogHeader><DialogTitle>Território {selected?.numero}{selected?.ativo === false ? ' · Inativo' : ''}</DialogTitle><DialogDescription>{selected?.descricao || 'Mapa e referências do território.'}</DialogDescription></DialogHeader>
        {selected && <div className="space-y-5">
          {selected.mapa_prototipo && <EditableTerritoryEditor territoryId={selected.id} canEdit={canEdit} onSaved={onSaved} onEditingChange={setPrototypeEditing} />}
          {!selected.mapa_prototipo && maps.some(map => map.territorio_id === selected.id) && <SchematicMap src={`/api/admin/servico-campo/esquema?territorio=${selected.id}`} width={1000} height={700} alt={`Cartão esquemático do Território ${selected.numero}`} />}
          {publicMapUrl && <a className="inline-flex text-sm text-purple-700 underline" href={publicMapUrl} target="_blank" rel="noopener noreferrer">Abrir cartão público do território</a>}
          <div className="space-y-2"><h4 className="text-sm font-semibold">Referências das quadras e orientações</h4><p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{selected.referencias || 'Nenhuma referência cadastrada.'}</p></div>
          <div className="space-y-2"><h4 className="text-sm font-semibold">Google Maps do território</h4>{selectedUrl ? <a href={selectedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-purple-700 underline"><MapPin className="h-4 w-4" />Abrir território no Google Maps</a> : <p className="text-sm text-gray-500">Link do Google Maps a cadastrar.</p>}</div>
          <div className="space-y-2"><h4 className="text-sm font-semibold">PDF de referência</h4><FieldMapAttachment territoryId={selected.id} map={maps.find(map => map.territorio_id === selected.id)} canEdit={canEdit} onSaved={onSaved} /></div>
        </div>}
        {!prototypeEditing && <DialogFooter className="flex flex-wrap gap-2">{selected && canEdit && <Button type="button" variant="outline" onClick={() => { onClose(); onEdit(selected); }}>Editar mapa e referências</Button>}{selected && <Button type="button" onClick={() => { onClose(); onShare(buildTerritoryMessage(selected, publicMapUrl)); }} className="bg-purple-600 hover:bg-purple-700 text-white">Compartilhar</Button>}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
