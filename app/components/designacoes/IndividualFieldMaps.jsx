'use client';

import { useState } from 'react';
import { EditableTerritoryEditor } from './EditableTerritoryEditor';

import { SchematicMap } from './SchematicMap';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { FieldMapAttachment } from './FieldMapAttachment';
import { buildTerritoryMessage } from '@/app/lib/field-service-share';
import { ConfirmationDialog } from '@/app/components/ui/confirmation-dialog';
import { territoryMapDisplay } from '@/app/lib/territory-map-display';

export function TerritoryMapDetails({ territory: selected, maps, canEdit, onEdit, onShare, publicMapUrl = '', onSaved, onClose }) {
  const [prototypeEditing, setPrototypeEditing] = useState(false);
  const [prototypeSaving, setPrototypeSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closeNotice, setCloseNotice] = useState('');
  const display = territoryMapDisplay(selected);
  function requestClose() {
    if (prototypeSaving) { setCloseNotice('Aguarde o desenho terminar de salvar para fechar.'); return; }
    if (prototypeEditing) { setConfirmClose(true); return; }
    setCloseNotice('');
    onClose();
  }
  return (
    <><Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) requestClose(); }}>
      <DialogContent onInteractOutside={e => { if (prototypeEditing || prototypeSaving) e.preventDefault(); }} className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto bg-white text-gray-900">
        <DialogHeader><DialogTitle>Território {selected?.numero}{selected?.ativo === false ? ' · Inativo' : ''}</DialogTitle><DialogDescription>{selected?.descricao || 'Mapa e referências do território.'}</DialogDescription></DialogHeader>
        {selected && <div className="space-y-5">
          {closeNotice && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{closeNotice}</p>}
          {display === 'editable' && <EditableTerritoryEditor key={selected.id} territoryId={selected.id} canEdit={canEdit} onSaved={onSaved} onEditingChange={setPrototypeEditing} onSavingChange={setPrototypeSaving} />}
          {display === 'original' && maps.some(map => map.territorio_id === selected.id) && <SchematicMap src={`/api/admin/servico-campo/esquema?territorio=${selected.id}`} width={1000} height={700} alt={`Cartão original do Território ${selected.numero}`} />}
          {publicMapUrl && <a className="inline-flex text-sm text-purple-700 underline" href={publicMapUrl} target="_blank" rel="noopener noreferrer">Abrir cartão público do território</a>}
          <div className="space-y-2"><h4 className="text-sm font-semibold">PDF de referência</h4><FieldMapAttachment territoryId={selected.id} map={maps.find(map => map.territorio_id === selected.id)} canEdit={canEdit} onSaved={onSaved} /></div>
        </div>}
        {!prototypeEditing && <DialogFooter className="flex flex-wrap gap-2">{selected && canEdit && <Button type="button" variant="outline" onClick={() => { onClose(); onEdit(selected); }}>Editar mapa e referências</Button>}{selected && <Button type="button" onClick={() => { onClose(); onShare(buildTerritoryMessage(selected, publicMapUrl)); }} className="bg-purple-600 hover:bg-purple-700 text-white">Compartilhar</Button>}</DialogFooter>}
      </DialogContent>
    </Dialog>
    {confirmClose && <ConfirmationDialog title="Fechar sem salvar o desenho?" description="As alterações do desenho que ainda não foram salvas serão descartadas." confirmLabel="Fechar sem salvar" onCancel={() => setConfirmClose(false)} onConfirm={() => { setConfirmClose(false); setPrototypeEditing(false); setCloseNotice(''); onClose(); }} />}
    </>
  );
}
