'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

const title = 'Designações do Serviço de Campo';
const headers = ['Data', 'Dia', 'Horário', 'Dirigente', 'Local', 'Grupos', 'Territórios'];
const dateLabel = value => value.split('-').reverse().join('/');
const weekdayLabel = value => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
const cells = row => [dateLabel(row.data), weekdayLabel(row.data), row.horario, row.dirigente, row.local, row.grupos_nomes, row.territorios_numeros || '—'];
function currentMonth() {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return { start: `${prefix}-01`, end: `${prefix}-${new Date(year, month + 1, 0).getDate()}` };
}

export default function FieldServiceReport() {
  const [period, setPeriod] = useState(currentMonth);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ dirigente: '', local: '', grupo: '' });
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    await Promise.resolve();
    if (controller.signal.aborted) return;
    setRows([]);
    setError('');
    if (!period.start || !period.end || period.start > period.end) {
      setError('Informe um período válido.');
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/admin/relatorios/servico-campo?${new URLSearchParams(period)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Falha ao carregar as designações.');
        if (!controller.signal.aborted) setRows(data);
      })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }
    load();
    return () => controller.abort();
  }, [period]);
  const filtered = useMemo(() => rows.filter(row =>
    (!filters.dirigente || (row.dirigente_publicador_id ? String(row.dirigente_publicador_id) : 'pendente') === filters.dirigente)
    && (!filters.local || (row.local_id ? String(row.local_id) : 'pendente') === filters.local)
    && (!filters.grupo || (filters.grupo === 'todos' ? !row.grupos.length : row.grupos.map(String).includes(filters.grupo)))
  ), [rows, filters]);
  const options = key => [...new Map(rows.map(row => [String(row[key === 'dirigente' ? 'dirigente_publicador_id' : 'local_id'] || 'pendente'), row[key]])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  // Group names come from the selected period; no extra access to publisher profiles is needed.
  const groupOptions = [...new Map(rows.flatMap(row => row.grupos_detalhes.map(group => [String(group.id), group.nome]))).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  const filename = `Designacoes_Servico_Campo_${period.start.split('-').reverse().join('-')}_${period.end.split('-').reverse().join('-')}`;
  function exportXlsx() {
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...filtered.map(row => [
      { t: 'n', v: (Date.parse(`${row.data}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000, z: 'dd/mm/yyyy' },
      ...cells(row).slice(1)
    ])]);
    sheet['!cols'] = [14, 20, 20, 32, 36, 28, 24].map(wch => ({ wch }));
    sheet['!autofilter'] = { ref: sheet['!ref'] };
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Designações');
    XLSX.writeFile(book, `${filename}.xlsx`);
  }
  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    const widths = [26, 30, 30, 48, 56, 43, 40];
    let y;
    function pageHeader() {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
      doc.text(title, 12, 17);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text(`${dateLabel(period.start)} a ${dateLabel(period.end)} | ${filtered.length} saída(s)`, 12, 25);
      let x = 12;
      doc.setFont('helvetica', 'bold');
      headers.forEach((header, i) => { doc.text(header, x + 2, 35); x += widths[i]; });
      doc.setFont('helvetica', 'normal'); y = 41;
    }
    pageHeader();
    filtered.forEach(row => {
      const lines = cells(row).map((value, i) => doc.splitTextToSize(value, widths[i] - 4));
      const count = Math.max(...lines.map(value => value.length));
      // Split unusually long rows too, keeping every line inside the page.
      for (let offset = 0; offset < count;) {
        if (y > 190) { doc.addPage(); pageHeader(); }
        const take = Math.min(count - offset, Math.floor((196 - y) / 5));
        let x = 12;
        lines.forEach((value, i) => { const part = value.slice(offset, offset + take); if (part.length) doc.text(part, x + 2, y); x += widths[i]; });
        y += take * 5 + 4; offset += take;
        doc.setDrawColor(220); doc.line(12, y - 3, 285, y - 3);
      }
    });
    doc.save(`${filename}.pdf`);
  }
  return <DashboardLayout>
    <div className="max-w-7xl mx-auto space-y-5 text-gray-900">
      <Link className="text-sm text-purple-700 hover:underline" href="/admin/relatorios">← Relatórios</Link>
      <div><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-gray-600">Consulte a escala dos dirigentes e exporte o período selecionado.</p></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 rounded-xl border border-gray-200 bg-white p-4">
        {['start', 'end'].map(key => <label key={key} className="text-sm font-medium">{key === 'start' ? 'Data inicial' : 'Data final'}<Input className="mt-1" type="date" value={period[key]} onChange={event => setPeriod({ ...period, [key]: event.target.value })} /></label>)}
        {['dirigente', 'local', 'grupo'].map(key => <label key={key} className="text-sm font-medium capitalize">{key}<select className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm" value={filters[key]} onChange={event => setFilters({ ...filters, [key]: event.target.value })}>
          <option value="">Todos</option>
          {key === 'grupo' ? <><option value="todos">Congregação inteira</option>{groupOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</> : options(key).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select></label>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-sm text-gray-600">{filtered.length} saída(s) · {filtered.filter(row => !row.dirigente_publicador_id).length} com dirigente a definir</span>
        <Button variant="outline" disabled={loading || !!error || !filtered.length} onClick={exportXlsx}>Exportar XLSX</Button>
        <Button disabled={loading || !!error || !filtered.length} onClick={exportPdf}>Exportar PDF</Button>
      </div>
      {error ? <p role="alert" className="text-red-700">{error}</p> : loading ? <p role="status">Carregando designações...</p> : !filtered.length ? <p className="p-8 text-center text-gray-500">Nenhuma saída encontrada para os filtros selecionados.</p> : <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-left text-sm">
        <thead className="bg-gray-50"><tr>{headers.map(header => <th scope="col" className="p-3" key={header}>{header}</th>)}</tr></thead>
        <tbody>{filtered.map(row => <tr key={row.id} className="border-t border-gray-100">{cells(row).map((value, index) => <td className="p-3" key={index}>{value}</td>)}</tr>)}</tbody>
      </table></div>}
    </div>
  </DashboardLayout>;
}
