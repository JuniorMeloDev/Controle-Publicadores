'use client';

import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { fieldLeadersReport, writeFieldLeadersPdf } from '@/app/lib/field-leaders-pdf';

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export function FieldLeadersExport({ data, initialYear, initialMonth, disabled }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const [open, setOpen] = useState(false), [year, setYear] = useState(today.slice(0, 4)), [month, setMonth] = useState(today.slice(5, 7));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const saving = useRef(false);
  const years = [...new Set([today.slice(0, 4), year, ...data.saidas.map(row => row.data.slice(0, 4))])].sort().reverse();
  const report = fieldLeadersReport(data, year, month);
  async function exportPdf() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const { jsPDF } = await import('jspdf');
      writeFieldLeadersPdf(new jsPDF({ orientation: 'landscape', format: 'a4' }), data, year, month).save(`Dirigentes_Servico_Campo_${report.prefix}.pdf`);
      setOpen(false);
    } catch { setError('Não foi possível exportar a tabela de dirigentes. Tente novamente.'); }
    finally { saving.current = false; setBusy(false); }
  }
  return <>
    <Button type="button" variant="outline" disabled={disabled} onClick={() => { setYear(initialYear || today.slice(0, 4)); setMonth(initialMonth || today.slice(5, 7)); setError(''); setOpen(true); }}><Download className="mr-2 h-4 w-4" />Exportar dirigentes do mês</Button>
    <Dialog open={open} onOpenChange={value => { if (!saving.current) setOpen(value); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto bg-white text-gray-900">
        <DialogHeader><DialogTitle>Exportar dirigentes do mês</DialogTitle><DialogDescription>Baixe a programação mensal em PDF, com datas, horários, dirigentes, locais, grupos e territórios.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm font-medium">Mês<select aria-label="Mês da tabela de dirigentes" className="rounded-md border border-gray-300 bg-white p-2" value={month} disabled={busy} onChange={e => setMonth(e.target.value)}>{months.map((name, index) => <option key={name} value={String(index + 1).padStart(2, '0')}>{name}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium">Ano<select aria-label="Ano da tabela de dirigentes" className="rounded-md border border-gray-300 bg-white p-2" value={year} disabled={busy} onChange={e => setYear(e.target.value)}>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
        <p className="text-sm text-gray-600">{report.rows.length} saída(s) · {report.leaders} dirigente(s) · {report.pending} com dirigente a definir.</p>
        <p className="text-sm text-gray-500">As informações vêm das saídas cadastradas na Agenda.</p>
        {!report.rows.length && <p role="status" className="text-sm text-amber-800">Nenhuma saída cadastrada neste mês. Selecione outro período ou cadastre as saídas na Agenda.</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button type="button" disabled={busy || !report.rows.length} onClick={exportPdf}>{busy ? 'Gerando PDF…' : 'Baixar PDF'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
