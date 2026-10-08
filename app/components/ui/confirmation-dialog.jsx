'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog';

// Mount while an action is pending. Reject onConfirm to keep the dialog open with an error.
export function ConfirmationDialog({ title, description, confirmLabel = 'Confirmar', destructive = false, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const cancelButton = useRef(null);

  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onCancel();
    } catch (err) {
      setError(err.message || 'Não foi possível concluir a ação. Tente novamente.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <Dialog open onOpenChange={open => { if (!open && !inFlight.current) onCancel(); }}>
    <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[90dvh] overflow-y-auto rounded-xl bg-white text-gray-900"
      onOpenAutoFocus={event => { event.preventDefault(); cancelButton.current?.focus(); }}
      onInteractOutside={event => event.preventDefault()}
      onEscapeKeyDown={event => { if (inFlight.current) event.preventDefault(); }}>
      <DialogHeader className="text-left space-y-3">
        {destructive && <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600"><AlertTriangle className="h-5 w-5" /></span>}
        <DialogTitle className="pr-5 leading-snug">{title}</DialogTitle>
        <DialogDescription className="text-sm text-gray-600 leading-relaxed">{description}</DialogDescription>
      </DialogHeader>
      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <DialogFooter className="grid grid-cols-2 gap-2 sm:space-x-0">
        <Button ref={cancelButton} type="button" variant="outline" disabled={busy} onClick={onCancel} className="h-10 w-full">Cancelar</Button>
        <Button type="button" disabled={busy} onClick={confirm} className={`h-10 w-full gap-2 text-white ${destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}>
          {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}{busy ? 'Aguarde…' : confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
