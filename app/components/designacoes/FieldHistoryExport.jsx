'use client';

import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { fieldServiceYear } from '@/app/lib/field-service';
import { territoryHistoryReport, territoryHistoryYears, writeTerritoryHistoryPdf } from '@/app/lib/territory-history-pdf';

export function FieldHistoryExport({ data, disabled }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const [open, setOpen] = useState(false), [year, setYear] = useState(fieldServiceYear(today));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const saving = useRef(false);
  const report = territoryHistoryReport(data, year);
  async function exportPdf() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
      writeTerritoryHistoryPdf(doc, data, year).save(`Registro_Designacao_Territorios_${year}.pdf`);
      setOpen(false);
    } catch { setError('Não foi possível exportar o histórico. Tente novamente.'); }
    finally { saving.current = false; setBusy(false); }
  }
  return <>
    <Button type="button" variant="outline" disabled={disabled} onClick={() => { setError(''); setOpen(true); }}><Download className="mr-2 h-4 w-4" />Exportar histórico (PDF)</Button>
    <Dialog open={open} onOpenChange={value => { if (!saving.current) setOpen(value); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto bg-white text-gray-900">
        <DialogHeader><DialogTitle>Exportar histórico de territórios</DialogTitle><DialogDescription>Modelo em tabela, com responsáveis, entregas, conclusões e marcações de fim de semana. O ano de serviço vai de setembro a agosto.</DialogDescription></DialogHeader>
        <label className="grid gap-2 text-sm font-medium">Ano de serviço<select className="w-full rounded-md border border-gray-300 bg-white p-2" disabled={busy} value={year} onChange={e => setYear(Number(e.target.value))}>{territoryHistoryYears(data, today).map(value => <option key={value} value={value}>{value} (set/{value - 1} a ago/{value})</option>)}</select></label>
        <p className="text-sm text-gray-600">{report.territories.length} território(s) · {report.count} designação(ões). Territórios ativos sem registros também aparecem com as células vazias.</p>
        <p className="text-sm text-gray-500">A exportação considera o ano de serviço escolhido, independentemente dos filtros de mês e ano da lista.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button type="button" disabled={busy || !report.territories.length} onClick={exportPdf}>{busy ? 'Gerando PDF…' : 'Baixar PDF'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
