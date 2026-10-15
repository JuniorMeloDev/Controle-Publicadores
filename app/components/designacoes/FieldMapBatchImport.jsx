'use client';

import { useRef, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { fieldImportError, territoryNumberFromFilename } from '@/app/lib/field-map-import';

export function FieldMapBatchImport({ territories, onSaved }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const saving = useRef(false);
  const pending = items.filter(item => item.status !== 'done');
  const invalid = pending.some(item => fieldImportError(item, pending, territories));
  function selectFiles(event) {
    const files = Array.from(event.target.files || []);
    setItems(files.map(file => ({ file, numero: territoryNumberFromFilename(file.name), status: '', error: '' })));
    setMessage('');
    event.target.value = '';
  }
  async function save() {
    if (saving.current || invalid || !pending.length) return;
    saving.current = true;
    setBusy(true);
    setMessage('');
    let succeeded = 0;
    let failed = 0;
    try {
      for (const item of pending) {
        setItems(current => current.map(row => row === item ? { ...row, status: 'saving', error: '' } : row));
        try {
          const form = new FormData();
          form.append('dados', JSON.stringify({ entity: 'territorios', action: 'save', record: {
            numero: item.numero, descricao: '', referencias: '', mapa_url: '', fim_semana: false, ativo: true
          } }));
          form.append('arquivo', item.file);
          const response = await fetch('/api/admin/servico-campo', { method: 'POST', body: form });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.message || 'Não foi possível importar este PDF.');
          succeeded++;
          setItems(current => current.map(row => row.file === item.file ? { ...row, status: 'done', error: '' } : row));
        } catch (error) {
          failed++;
          setItems(current => current.map(row => row.file === item.file ? { ...row, status: 'error', error: error.message } : row));
        }
      }
      setMessage(`${succeeded} território(s) importado(s) nesta tentativa. ${failed ? `${failed} arquivo(s) com erro; confira a lista antes de tentar novamente.` : 'Todos os PDFs foram salvos.'}`);
      await onSaved();
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return <>
    <Button type="button" variant="outline" onClick={() => { setOpen(true); setItems([]); setMessage(''); }}>Importar PDFs em lote</Button>
    <Dialog open={open} onOpenChange={value => { if (!saving.current) setOpen(value); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-3xl max-h-[90dvh] overflow-y-auto bg-white text-gray-900" onInteractOutside={event => { if (busy) event.preventDefault(); }} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>Importar territórios em lote</DialogTitle><DialogDescription>Selecione os PDFs individuais. O nome 1.pdf corresponde ao Território 1. Confira os números antes de importar. Cada arquivo pode ter até 10 MB.</DialogDescription></DialogHeader>
        <label className="grid gap-2 text-sm font-medium">Selecionar PDFs<input type="file" multiple accept=".pdf,application/pdf" disabled={busy} onChange={selectFiles} /></label>
        {!!items.length && <p className="text-sm text-gray-600">{items.length} arquivo(s) selecionado(s). Os territórios são salvos individualmente; os concluídos permanecem salvos se outro arquivo falhar.</p>}
        <div className="space-y-3">{items.map((item, index) => {
          const validation = item.status === 'done' ? '' : fieldImportError(item, pending, territories);
          return <div key={index} className="rounded-lg border border-gray-200 p-3 space-y-2">
            <p className="text-sm font-medium break-all">{item.file.name} · {(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm">Número do território<input type="number" min="1" max="2147483647" step="1" className="ml-2 w-28 border border-gray-300 rounded p-2" value={item.numero} disabled={busy || item.status === 'done'} onChange={event => setItems(current => current.map((row, position) => position === index ? { ...row, numero: event.target.value, status: '', error: '' } : row))} /></label>
              {item.status === 'done' ? <span className="text-sm text-green-700">Importado</span> : <Button type="button" variant="ghost" disabled={busy} onClick={() => setItems(current => current.filter((_, position) => position !== index))}>Remover</Button>}
              {item.status === 'saving' && <span role="status" className="text-sm">Importando...</span>}
            </div>
            {(validation || item.error) && <p role="alert" className="text-sm text-red-700">{validation || item.error}</p>}
          </div>;
        })}</div>
        {message && <p role="status" className="text-sm">{message}</p>}
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Fechar</Button><Button type="button" disabled={busy || invalid || !pending.length} onClick={save}>{busy ? 'Importando...' : `Importar ${pending.length} PDF(s)`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
