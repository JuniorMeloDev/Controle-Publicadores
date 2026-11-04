'use client';

import { useRef, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';

export const fieldControl = 'w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';
export function BatchField({ label, children }) { return <label className="grid gap-1 text-sm text-gray-700">{label}{children}</label>; }

export async function saveFieldBatch(body) {
  const response = await fetch('/api/admin/servico-campo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Não foi possível salvar.');
  return result;
}

export function FieldBatchDialog({ title, description, children, onClose, onSave, saveLabel = 'Salvar', disabled = false }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const saving = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { await onSave(); }
    catch (err) { setError(err.message); }
    finally { saving.current = false; setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving.current) onClose(); }}>
    <DialogContent className="w-[calc(100%-2rem)] max-w-4xl max-h-[90dvh] overflow-y-auto bg-white text-gray-900" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4">{children}</fieldset>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={disabled || busy}>{busy ? 'Salvando…' : saveLabel}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
