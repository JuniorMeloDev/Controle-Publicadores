'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';

const control = 'w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';
export function CadastroProgressModal({ onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState('todos');
  const [group, setGroup] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError('');
      try {
        const response = await fetch('/api/admin/atualizacoes-cadastrais?acompanhamento=1', { signal: controller.signal, cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Não foi possível carregar o acompanhamento.');
        if (!controller.signal.aborted) setData(body);
      } catch (err) { if (!controller.signal.aborted) setError(err.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    load(); return () => controller.abort();
  }, [revision]);
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const rows = (data?.publicadores || []).filter(row => (status === 'todos' || Boolean(row.enviado_em) === (status === 'enviados')) && (!group || (row.nome_grupo || 'Sem grupo') === group) && normalize(row.nome_completo).includes(normalize(search)));
  const groups = [...new Set((data?.publicadores || []).map(row => row.nome_grupo || 'Sem grupo'))].sort();
  async function exportar(format) {
    const headers = ['Publicador', 'Grupo', 'Situação', 'Último envio', 'Alterações pendentes'];
    const values = rows.map(row => [row.nome_completo, row.nome_grupo || 'Sem grupo', row.enviado_em ? 'Já enviou' : 'Ainda não enviou', row.enviado_em ? new Date(row.enviado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—', String(row.pendentes || 0)]);
    const filename = 'Acompanhamento_atualizacoes_cadastrais';
    try {
      if (format === 'xlsx') {
        const XLSX = await import('xlsx');
        const sheet = XLSX.utils.aoa_to_sheet([headers, ...values]);
        sheet['!cols'] = [52, 24, 24, 24, 24].map(wch => ({ wch }));
        sheet['!autofilter'] = { ref: sheet['!ref'] };
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, 'Acompanhamento');
        XLSX.writeFile(workbook, `${filename}.xlsx`);
      } else {
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ orientation: 'landscape' });
        const widths = [88, 40, 42, 57, 50];
        let y = 0;
        const pageHeader = () => {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(30);
          doc.text('Acompanhamento das atualizações cadastrais', 10, 15);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
          doc.text(`Situação: ${status === 'todos' ? 'Todos' : status === 'enviados' ? 'Já enviaram' : 'Ainda faltam'} | Grupo: ${group || 'Todos'} | Busca: ${search || 'Todas'} | Total: ${rows.length}`, 10, 22);
          doc.setFillColor(243, 232, 255); doc.rect(10, 27, 277, 9, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
          let x = 10;
          headers.forEach((header, index) => { doc.text(header, x + 2, 33); x += widths[index]; });
          y = 36;
        };
        pageHeader();
        values.forEach((row, index) => {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
          const lines = row.map((value, column) => doc.splitTextToSize(value, widths[column] - 4));
          const height = Math.max(...lines.map(value => value.length)) * 4 + 5;
          if (y + height > 195) { doc.addPage(); pageHeader(); }
          if (index % 2 === 1) { doc.setFillColor(248, 248, 250); doc.rect(10, y, 277, height, 'F'); }
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
          let x = 10;
          lines.forEach((value, column) => { doc.text(value, x + 2, y + 5); x += widths[column]; });
          y += height;
        });
        doc.save(`${filename}.pdf`);
      }
    } catch {
      setError('Não foi possível exportar o acompanhamento. Tente novamente.');
    }
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="w-[calc(100%-2rem)] max-w-3xl max-h-[90dvh] overflow-y-auto bg-white text-gray-900">
    <DialogHeader><DialogTitle>Acompanhamento das atualizações cadastrais</DialogTitle><DialogDescription>Quem já enviou o cadastro e quem ainda falta. Envios sem alterações também contam. O envio não significa aprovação.</DialogDescription></DialogHeader>
    <div className="flex justify-end"><DropdownMenu.Root><DropdownMenu.Trigger asChild><Button disabled={loading || Boolean(error) || !rows.length} className="gap-2 bg-purple-700 hover:bg-purple-800 text-white"><Download size={16} />Exportar</Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={6} className="z-[60] min-w-40 rounded-lg border border-gray-200 bg-white p-1 text-gray-900 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"><DropdownMenu.Item onSelect={() => exportar('pdf')} className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none focus:bg-purple-50 dark:focus:bg-zinc-800"><FileText size={16} />PDF</DropdownMenu.Item><DropdownMenu.Item onSelect={() => exportar('xlsx')} className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none focus:bg-purple-50 dark:focus:bg-zinc-800"><FileSpreadsheet size={16} />XLSX</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div>
    {loading ? <p role="status" className="py-6 text-sm text-gray-500">Carregando acompanhamento…</p> : error ? <p role="alert" className="text-sm text-red-700">{error}</p> : data && <>
      <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-gray-50 p-3"><p className="text-lg font-semibold">{data.total}</p><p className="text-xs text-gray-600">Publicadores</p></div><div className="rounded-lg bg-green-50 p-3"><p className="text-lg font-semibold text-green-800">{data.enviados}</p><p className="text-xs text-green-800">Já enviaram</p></div><div className="rounded-lg bg-amber-50 p-3"><p className="text-lg font-semibold text-amber-800">{data.faltam}</p><p className="text-xs text-amber-800">Ainda faltam</p></div></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><label className="grid gap-1 text-sm">Buscar publicador<input type="search" className={control} value={search} onChange={e => setSearch(e.target.value)} /></label><label className="grid gap-1 text-sm">Situação<select className={control} value={status} onChange={e => setStatus(e.target.value)}><option value="todos">Todos</option><option value="enviados">Já enviaram</option><option value="faltam">Ainda faltam</option></select></label><label className="grid gap-1 text-sm">Grupo<select className={control} value={group} onChange={e => setGroup(e.target.value)}><option value="">Todos os grupos</option>{groups.map(name => <option key={name}>{name}</option>)}</select></label></div>
      <div className="divide-y divide-gray-100">{rows.length ? rows.map(row => <div key={row.id} className="py-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium break-words">{row.nome_completo}</p><p className="text-xs text-gray-500">{row.nome_grupo || 'Sem grupo'}</p></div><div className="text-sm sm:text-right"><p className={row.enviado_em ? 'text-green-700' : 'text-amber-700'}>{row.enviado_em ? 'Já enviou' : 'Ainda não enviou'}</p>{row.enviado_em && <p className="text-xs text-gray-500">Último envio: {new Date(row.enviado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>}{row.pendentes > 0 && <p className="text-xs text-gray-500">{row.pendentes} alteração(ões) aguardando aprovação</p>}</div></div>) : <p className="py-6 text-center text-sm text-gray-500">Nenhum publicador encontrado.</p>}</div>
    </>}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={loading} onClick={() => setRevision(value => value + 1)}>Atualizar</Button><Button onClick={onClose} className="bg-purple-700 hover:bg-purple-800 text-white">Fechar</Button></div>
  </DialogContent></Dialog>;
}
