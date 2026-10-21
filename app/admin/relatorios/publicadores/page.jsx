'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { 
  ArrowLeft, 
  Search, 
  FileSpreadsheet, 
  FileText, 
  Users, 
  ShieldCheck, 
  Star, 
  Phone, 
  Mail, 
  MapPin, 
  AlertCircle,
  FolderTree,
  Download,
  X,
  CheckSquare,
  Square
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

const formatDate = (value) => {
  if (!value) return '—';
  const str = String(value).slice(0, 10);
  const parts = str.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return str;
};

const calculateAge = (dateStr) => {
  if (!dateStr) return '';
  const birth = new Date(String(dateStr).slice(0, 10));
  if (isNaN(birth.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? `${age} anos` : '';
};

const formatPrivilegios = (privs = []) => {
  if (!Array.isArray(privs) || !privs.length) return '—';
  const map = { anciao: 'Ancião', servo_ministerial: 'Servo Ministerial' };
  return privs.map(p => map[p] || p).join(', ');
};

const formatDesignacoes = (des = []) => {
  if (!Array.isArray(des) || !des.length) return 'Publicador';
  const map = {
    pioneiro_regular: 'Pioneiro Regular',
    pioneiro_especial: 'Pioneiro Especial',
    missionario: 'Missionário em Campo'
  };
  return des.map(d => map[d] || d).join(', ');
};

const formatEsperanca = (val) => {
  if (!val) return '—';
  if (val === 'outras_ovelhas') return 'Outras Ovelhas';
  if (val === 'ungido') return 'Ungido';
  return val;
};

const formatSexo = (val) => {
  if (!val) return '—';
  if (val === 'M' || val === 'Masculino') return 'Masculino';
  if (val === 'F' || val === 'Feminino') return 'Feminino';
  return val;
};

const formatAddress = (p) => {
  const parts = [];
  if (p.logradouro) {
    let rua = p.logradouro;
    if (p.numero) rua += `, ${p.numero}`;
    if (p.complemento) rua += ` (${p.complemento})`;
    parts.push(rua);
  }
  if (p.bairro) parts.push(p.bairro);
  if (p.cidade || p.estado) {
    parts.push([p.cidade, p.estado].filter(Boolean).join(' - '));
  }
  if (p.cep) parts.push(`CEP: ${p.cep}`);
  return parts.length ? parts.join(', ') : 'Não informado';
};

const formatEmergencyContacts = (contacts) => {
  if (!Array.isArray(contacts) || !contacts.length) return 'Não informado';
  const valid = contacts.filter(c => c && (c.nome || c.telefone));
  if (!valid.length) return 'Não informado';
  return valid.map(c => `${c.nome || 'Contato'}${c.telefone ? `: ${c.telefone}` : ''}`).join('; ');
};

const COLUMN_CATEGORIES = [
  {
    category: 'Identificação & Pessoal',
    columns: [
      { id: 'nome_completo', label: 'Nome Completo', pdfWidth: 44, getValue: p => p.nome_completo || '' },
      { id: 'nome_chamado', label: 'Nome Chamado', pdfWidth: 24, getValue: p => p.nome_chamado || '' },
      { id: 'sexo', label: 'Sexo', pdfWidth: 16, getValue: p => formatSexo(p.sexo) },
      { id: 'data_nascimento', label: 'Data de Nascimento', pdfWidth: 24, getValue: p => formatDate(p.data_nascimento) },
      { id: 'idade', label: 'Idade', pdfWidth: 16, getValue: p => calculateAge(p.data_nascimento) },
    ]
  },
  {
    category: 'Dados Espirituais',
    columns: [
      { id: 'grupo', label: 'Grupo de Campo', pdfWidth: 26, getValue: p => p.nome_grupo || 'Sem Grupo' },
      { id: 'data_batismo', label: 'Data de Batismo', pdfWidth: 24, getValue: p => formatDate(p.data_batismo) },
      { id: 'esperanca', label: 'Esperança', pdfWidth: 22, getValue: p => formatEsperanca(p.esperanca) },
      { id: 'privilegios', label: 'Privilégios', pdfWidth: 30, getValue: p => formatPrivilegios(p.privilegios) },
      { id: 'designacoes', label: 'Designações', pdfWidth: 30, getValue: p => formatDesignacoes(p.designacoes) },
    ]
  },
  {
    category: 'Contato & Endereço',
    columns: [
      { id: 'telefone', label: 'Telefone', pdfWidth: 28, getValue: p => p.telefone || '' },
      { id: 'email', label: 'E-mail', pdfWidth: 38, getValue: p => p.email || '' },
      { id: 'endereco', label: 'Endereço Completo', pdfWidth: 50, getValue: p => formatAddress(p) },
      { id: 'bairro', label: 'Bairro', pdfWidth: 24, getValue: p => p.bairro || '' },
      { id: 'cidade_estado', label: 'Cidade / UF', pdfWidth: 24, getValue: p => [p.cidade, p.estado].filter(Boolean).join(' - ') },
      { id: 'cep', label: 'CEP', pdfWidth: 18, getValue: p => p.cep || '' },
    ]
  },
  {
    category: 'Emergência',
    columns: [
      { id: 'contatos_emergencia', label: 'Contatos de Emergência', pdfWidth: 46, getValue: p => formatEmergencyContacts(p.contatos_emergencia) },
    ]
  }
];

const ALL_COLUMNS = COLUMN_CATEGORIES.flatMap(c => c.columns);
const DEFAULT_SELECTED_COLUMNS = ALL_COLUMNS.map(c => c.id);

export default function RelatorioPublicadoresPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [grupos, setGrupos] = useState([]);
  const [publicadores, setPublicadores] = useState([]);
  const [selectedGrupo, setSelectedGrupo] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPrivilegio, setFilterPrivilegio] = useState('todos');
  const [breakByGroupPdf, setBreakByGroupPdf] = useState(true);
  
  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState(DEFAULT_SELECTED_COLUMNS);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/admin/relatorios/publicadores', { cache: 'no-store' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Erro ao carregar dados dos publicadores.');
        }
        const data = await res.json();
        setGrupos(data.grupos || []);
        setPublicadores(data.publicadores || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filtered by selected group and search
  const filteredPublishers = useMemo(() => {
    return publicadores.filter(p => {
      // Group filter
      if (selectedGrupo !== 'todos') {
        if (selectedGrupo === 'sem_grupo') {
          if (p.grupo_id) return false;
        } else {
          if (String(p.grupo_id) !== String(selectedGrupo)) return false;
        }
      }

      // Privilege filter
      if (filterPrivilegio !== 'todos') {
        if (filterPrivilegio === 'anciao' && !p.privilegios?.includes('anciao')) return false;
        if (filterPrivilegio === 'servo_ministerial' && !p.privilegios?.includes('servo_ministerial')) return false;
        if (filterPrivilegio === 'pioneiro_regular' && !p.designacoes?.includes('pioneiro_regular')) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const nome = (p.nome_completo || '').toLowerCase();
        const chamado = (p.nome_chamado || '').toLowerCase();
        const grupo = (p.nome_grupo || '').toLowerCase();
        const tel = (p.telefone || '').toLowerCase();
        const email = (p.email || '').toLowerCase();
        const endereco = formatAddress(p).toLowerCase();
        const contatos = formatEmergencyContacts(p.contatos_emergencia).toLowerCase();

        return (
          nome.includes(term) ||
          chamado.includes(term) ||
          grupo.includes(term) ||
          tel.includes(term) ||
          email.includes(term) ||
          endereco.includes(term) ||
          contatos.includes(term)
        );
      }

      return true;
    });
  }, [publicadores, selectedGrupo, filterPrivilegio, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = filteredPublishers.length;
    const anciaos = filteredPublishers.filter(p => p.privilegios?.includes('anciao')).length;
    const servos = filteredPublishers.filter(p => p.privilegios?.includes('servo_ministerial')).length;
    const pioneiros = filteredPublishers.filter(p => p.designacoes?.includes('pioneiro_regular')).length;
    const distinctGroups = new Set(filteredPublishers.map(p => p.nome_grupo || 'Sem Grupo')).size;
    return { total, anciaos, servos, pioneiros, distinctGroups };
  }, [filteredPublishers]);

  // Grouped structure for display and export
  const groupedPublishers = useMemo(() => {
    const map = new Map();
    filteredPublishers.forEach(p => {
      const g = p.nome_grupo || 'Sem Grupo';
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(p);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [filteredPublishers]);

  // Toggle column selection
  const toggleColumn = (colId) => {
    setSelectedColumns(prev => 
      prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]
    );
  };

  const handleSelectAllColumns = () => {
    setSelectedColumns(ALL_COLUMNS.map(c => c.id));
  };

  const handleDeselectAllColumns = () => {
    setSelectedColumns([]);
  };

  // Export to Excel (with selected columns)
  const handleExportXlsx = () => {
    const activeCols = ALL_COLUMNS.filter(c => selectedColumns.includes(c.id));
    if (!activeCols.length) return;

    const headers = activeCols.map(c => c.label);
    const colWidths = activeCols.map(c => ({ wch: Math.max(14, Math.min(50, Math.round(c.pdfWidth * 0.85))) }));
    const mapRow = p => activeCols.map(c => c.getValue(p));

    const groupLabel = selectedGrupo === 'todos' 
      ? 'Todos_os_Publicadores' 
      : (grupos.find(g => String(g.id) === String(selectedGrupo))?.nome_grupo || 'Grupo').replace(/\s+/g, '_');
    const filename = `Relatorio_Publicadores_${groupLabel}_${new Date().toISOString().slice(0, 10)}`;

    const wb = XLSX.utils.book_new();

    if (selectedGrupo === 'todos') {
      // General sheet with all
      const allSheet = XLSX.utils.aoa_to_sheet([headers, ...filteredPublishers.map(mapRow)]);
      allSheet['!cols'] = colWidths;
      allSheet['!autofilter'] = { ref: allSheet['!ref'] };
      XLSX.utils.book_append_sheet(wb, allSheet, 'Geral - Todos');

      // Individual sheets per group
      groupedPublishers.forEach(([groupName, list]) => {
        const sheet = XLSX.utils.aoa_to_sheet([headers, ...list.map(mapRow)]);
        sheet['!cols'] = colWidths;
        sheet['!autofilter'] = { ref: sheet['!ref'] };
        const safeTitle = groupName.replace(/[\\/?*[\]:]/g, '_').slice(0, 31);
        XLSX.utils.book_append_sheet(wb, sheet, safeTitle);
      });
    } else {
      const sheet = XLSX.utils.aoa_to_sheet([headers, ...filteredPublishers.map(mapRow)]);
      sheet['!cols'] = colWidths;
      sheet['!autofilter'] = { ref: sheet['!ref'] };
      XLSX.utils.book_append_sheet(wb, sheet, 'Publicadores');
    }

    XLSX.writeFile(wb, `${filename}.xlsx`);
    setIsExportModalOpen(false);
  };

  // Export to PDF via jsPDF (with selected columns)
  const handleExportPdf = () => {
    const activeCols = ALL_COLUMNS.filter(c => selectedColumns.includes(c.id));
    if (!activeCols.length) return;

    const doc = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'mm' });
    const pageWidth = 297;
    const pageHeight = 210;
    const marginX = 10;
    const printableWidth = 277;

    // Calculate proportional column widths
    const rawSum = activeCols.reduce((sum, c) => sum + c.pdfWidth, 0);
    const colWidths = activeCols.map(c => Math.max(12, Math.round((c.pdfWidth / rawSum) * printableWidth)));
    const currentSum = colWidths.reduce((a, b) => a + b, 0);
    if (colWidths.length > 0) {
      colWidths[colWidths.length - 1] += (printableWidth - currentSum);
    }

    const colHeaders = activeCols.map(c => c.label);

    let pageNumber = 1;
    let y = 14;

    const drawPageHeader = (groupTitle = '') => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(48, 32, 67);
      doc.text('Relatório Cadastral de Publicadores', marginX, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(110, 110, 110);
      const dataStr = new Date().toLocaleDateString('pt-BR');
      const filtroStr = selectedGrupo === 'todos' ? 'Todos os grupos' : (grupos.find(g => String(g.id) === String(selectedGrupo))?.nome_grupo || 'Grupo');
      doc.text(`Emitido em: ${dataStr} | Filtro: ${filtroStr} | Total: ${filteredPublishers.length} publicador(es)`, marginX, y + 5);

      if (groupTitle) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(126, 34, 206);
        doc.text(`Grupo: ${groupTitle}`, marginX, y + 10);
      }

      y += groupTitle ? 14 : 9;

      // Table Header
      doc.setFillColor(243, 232, 255);
      doc.rect(marginX, y, printableWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);

      let curX = marginX;
      colHeaders.forEach((header, i) => {
        doc.text(header, curX + 2, y + 4.8);
        curX += colWidths[i];
      });

      y += 8;
    };

    const drawPageFooter = () => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(140, 140, 140);
      doc.text(`Página ${pageNumber}`, pageWidth - marginX - 18, pageHeight - 6);
      doc.text('Congregação Praia dos Corais — Uso Interno', marginX, pageHeight - 6);
    };

    const renderRows = (items, getGroupHeader) => {
      items.forEach((p, idx) => {
        const cellValues = activeCols.map(c => String(c.getValue(p) ?? ''));
        const lines = cellValues.map((txt, i) => doc.splitTextToSize(txt, colWidths[i] - 3));
        const maxLines = Math.max(1, ...lines.map(l => l.length));
        const rowHeight = maxLines * 3.5 + 3.5;

        if (y + rowHeight > pageHeight - 12) {
          drawPageFooter();
          doc.addPage();
          pageNumber++;
          y = 14;
          drawPageHeader(getGroupHeader ? getGroupHeader(true) : '');
        }

        // Row background zebra
        if (idx % 2 === 1) {
          doc.setFillColor(250, 250, 252);
          doc.rect(marginX, y, printableWidth, rowHeight, 'F');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 30, 30);

        let curX = marginX;
        lines.forEach((lineArr, i) => {
          lineArr.forEach((l, lIdx) => {
            doc.text(l, curX + 2, y + 3.2 + lIdx * 3.4);
          });
          curX += colWidths[i];
        });

        // Bottom border
        doc.setDrawColor(230, 230, 230);
        doc.line(marginX, y + rowHeight, marginX + printableWidth, y + rowHeight);

        y += rowHeight;
      });
    };

    if (breakByGroupPdf && selectedGrupo === 'todos') {
      groupedPublishers.forEach(([groupName, publishersInGroup], gIdx) => {
        if (gIdx > 0) {
          drawPageFooter();
          doc.addPage();
          pageNumber++;
          y = 14;
        }

        drawPageHeader(`${groupName} (${publishersInGroup.length} publicadores)`);
        renderRows(publishersInGroup, isContinuation => `${groupName} (${isContinuation ? 'continuação' : ''})`);
      });
    } else {
      drawPageHeader();
      renderRows(filteredPublishers);
    }

    drawPageFooter();

    const groupLabel = selectedGrupo === 'todos' ? 'Todos' : (grupos.find(g => String(g.id) === String(selectedGrupo))?.nome_grupo || 'Grupo').replace(/\s+/g, '_');
    doc.save(`Relatorio_Publicadores_${groupLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
    setIsExportModalOpen(false);
  };

  return (
    <DashboardLayout contentClassName="[scrollbar-gutter:stable]">
      <div className="w-full min-w-0 p-2 sm:p-4 space-y-5">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <Link href="/admin/relatorios">
              <Button variant="ghost" size="icon" className="shrink-0 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-zinc-100 tracking-tight">
                Dados dos Publicadores
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
                Relatório cadastral com endereços, contatos de emergência e grupos.
              </p>
            </div>
          </div>

          {/* Export button that opens the column selection modal */}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsExportModalOpen(true)}
              disabled={loading || !filteredPublishers.length}
              className="gap-2 bg-purple-700 hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-700 text-white font-medium shadow-sm"
              size="sm"
            >
              <Download className="w-4 h-4" />
              <span>Exportar</span>
            </Button>
          </div>
        </div>

        {/* Filters and Controls Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Search Input */}
            <div className="md:col-span-5">
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Buscar publicador
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Nome, telefone, e-mail, bairro, contato..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-sm bg-white dark:bg-zinc-800/80 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                />
              </div>
            </div>

            {/* Grupo Selector */}
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Grupo de Serviço de Campo
              </label>
              <select
                value={selectedGrupo}
                onChange={(e) => setSelectedGrupo(e.target.value)}
                className="w-full h-9 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-gray-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="todos">Todos os Grupos ({publicadores.length})</option>
                {grupos.map((g) => {
                  const count = publicadores.filter(p => p.grupo_id === g.id).length;
                  return (
                    <option key={g.id} value={g.id}>
                      {g.nome_grupo} ({count})
                    </option>
                  );
                })}
                <option value="sem_grupo">
                  Sem Grupo ({publicadores.filter(p => !p.grupo_id).length})
                </option>
              </select>
            </div>

            {/* Privilégios Quick Filter */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Privilégio / Designação
              </label>
              <select
                value={filterPrivilegio}
                onChange={(e) => setFilterPrivilegio(e.target.value)}
                className="w-full h-9 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-gray-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="todos">Todos os privilégios</option>
                <option value="anciao">Anciãos</option>
                <option value="servo_ministerial">Servos Ministeriais</option>
                <option value="pioneiro_regular">Pioneiros Regulares</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-3 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-zinc-400 font-medium block">Total Exibido</span>
            <span className="text-xl font-bold text-purple-700 dark:text-purple-400 mt-1 block">
              {loading ? '…' : stats.total}
            </span>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-3 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-zinc-400 font-medium block">Grupos</span>
            <span className="text-xl font-bold text-gray-800 dark:text-zinc-100 mt-1 block">
              {loading ? '…' : stats.distinctGroups}
            </span>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-3 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-zinc-400 font-medium block">Anciãos</span>
            <span className="text-xl font-bold text-blue-700 dark:text-blue-400 mt-1 block">
              {loading ? '…' : stats.anciaos}
            </span>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-3 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-zinc-400 font-medium block">Servos Min.</span>
            <span className="text-xl font-bold text-indigo-700 dark:text-indigo-400 mt-1 block">
              {loading ? '…' : stats.servos}
            </span>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-3 shadow-xs col-span-2 sm:col-span-1">
            <span className="text-xs text-gray-500 dark:text-zinc-400 font-medium block">Pioneiros Reg.</span>
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 block">
              {loading ? '…' : stats.pioneiros}
            </span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-4 text-red-700 dark:text-red-300 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-12 text-center text-gray-500 dark:text-zinc-400">
            <Users className="w-8 h-8 mx-auto mb-3 animate-pulse text-purple-500" />
            <p className="text-base font-medium">Carregando dados dos publicadores...</p>
          </div>
        )}

        {/* Content Table / Grouped view */}
        {!loading && !error && (
          <div className="space-y-6">
            {groupedPublishers.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-12 text-center text-gray-500 dark:text-zinc-400">
                <Users className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-zinc-600" />
                <p className="text-base font-semibold text-gray-700 dark:text-zinc-200">Nenhum publicador encontrado</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Tente ajustar seus filtros de grupo ou termos de busca.</p>
              </div>
            ) : (
              groupedPublishers.map(([groupName, groupItems]) => (
                <div key={groupName} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                  {/* Group header bar */}
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-zinc-900 dark:to-zinc-800 dark:bg-zinc-800 border-b border-purple-100 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderTree className="w-5 h-5 text-purple-700 dark:text-purple-400" />
                      <h2 className="text-base font-bold text-purple-900 dark:text-zinc-100">{groupName}</h2>
                      <span className="text-xs bg-purple-200/70 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 dark:border dark:border-purple-800/60 font-semibold px-2 py-0.5 rounded-full">
                        {groupItems.length} publicador(es)
                      </span>
                    </div>
                  </div>

                  {/* Desktop / Tablet Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-700 dark:text-zinc-300 border-collapse">
                      <thead className="bg-gray-50 text-gray-600 dark:bg-zinc-950/70 dark:text-zinc-400 font-semibold border-b border-gray-200 dark:border-zinc-800 uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="px-4 py-2.5">Publicador</th>
                          <th className="px-3 py-2.5">Privilégios & Dados</th>
                          <th className="px-3 py-2.5">Contatos</th>
                          <th className="px-3 py-2.5">Endereço Completo</th>
                          <th className="px-4 py-2.5">Contatos de Emergência</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {groupItems.map((p) => {
                          const age = calculateAge(p.data_nascimento);
                          const isAnciao = p.privilegios?.includes('anciao');
                          const isServo = p.privilegios?.includes('servo_ministerial');
                          const isPioneiro = p.designacoes?.includes('pioneiro_regular');

                          return (
                            <tr key={p.id} className="hover:bg-purple-50/20 dark:hover:bg-zinc-800/50 transition-colors">
                              {/* Publicador info */}
                              <td className="px-4 py-3 align-top min-w-[200px]">
                                <div className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">
                                  {p.nome_completo}
                                </div>
                                {p.nome_chamado && (
                                  <div className="text-xs text-gray-500 dark:text-zinc-400">
                                    Chamado: <span className="font-medium text-gray-700 dark:text-zinc-300">{p.nome_chamado}</span>
                                  </div>
                                )}
                                <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1 space-y-0.5">
                                  <div>Nasc: <span className="font-medium text-gray-700 dark:text-zinc-300">{formatDate(p.data_nascimento)}</span> {age && `(${age})`}</div>
                                  <div>Batismo: <span className="font-medium text-gray-700 dark:text-zinc-300">{formatDate(p.data_batismo)}</span></div>
                                </div>
                              </td>

                              {/* Privilegios & Espiritual */}
                              <td className="px-3 py-3 align-top min-w-[150px]">
                                <div className="space-y-1">
                                  {isAnciao && (
                                    <span className="inline-flex items-center gap-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 dark:border dark:border-blue-800/60 px-2 py-0.5 text-[11px] font-semibold">
                                      <ShieldCheck className="w-3 h-3" /> Ancião
                                    </span>
                                  )}
                                  {isServo && (
                                    <span className="inline-flex items-center gap-1 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border dark:border-indigo-800/60 px-2 py-0.5 text-[11px] font-semibold">
                                      <ShieldCheck className="w-3 h-3" /> Servo Ministerial
                                    </span>
                                  )}
                                  {isPioneiro && (
                                    <span className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border dark:border-emerald-800/60 px-2 py-0.5 text-[11px] font-semibold">
                                      <Star className="w-3 h-3" /> Pioneiro Regular
                                    </span>
                                  )}
                                  {!isAnciao && !isServo && !isPioneiro && (
                                    <span className="text-xs text-gray-500 dark:text-zinc-400">Publicador</span>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1">
                                  Esperança: <span className="font-medium text-gray-700 dark:text-zinc-300">{formatEsperanca(p.esperanca)}</span>
                                </div>
                              </td>

                              {/* Telefone & E-mail */}
                              <td className="px-3 py-3 align-top min-w-[170px]">
                                <div className="space-y-1">
                                  {p.telefone ? (
                                    <a href={`tel:${p.telefone}`} className="inline-flex items-center gap-1.5 text-purple-700 dark:text-purple-400 hover:underline font-medium">
                                      <Phone className="w-3 h-3 shrink-0 text-purple-600 dark:text-purple-400" />
                                      {p.telefone}
                                    </a>
                                  ) : (
                                    <span className="text-gray-400 dark:text-zinc-500 text-xs">—</span>
                                  )}
                                  {p.email && (
                                    <div className="flex items-center gap-1.5 text-gray-600 dark:text-zinc-400 truncate max-w-[200px]" title={p.email}>
                                      <Mail className="w-3 h-3 shrink-0 text-gray-400 dark:text-zinc-500" />
                                      <a href={`mailto:${p.email}`} className="hover:underline truncate">
                                        {p.email}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Endereço */}
                              <td className="px-3 py-3 align-top min-w-[220px]">
                                <div className="flex items-start gap-1.5 text-gray-700 dark:text-zinc-300">
                                  <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-zinc-500 mt-0.5" />
                                  <div className="text-xs leading-relaxed">
                                    {p.logradouro ? (
                                      <>
                                        <div className="font-medium text-gray-900 dark:text-zinc-100">
                                          {p.logradouro}{p.numero ? `, ${p.numero}` : ''}{p.complemento ? ` (${p.complemento})` : ''}
                                        </div>
                                        <div className="text-gray-500 dark:text-zinc-400">
                                          {[p.bairro, [p.cidade, p.estado].filter(Boolean).join(' - ')].filter(Boolean).join(', ')}
                                        </div>
                                        {p.cep && <div className="text-[11px] text-gray-400 dark:text-zinc-500">CEP: {p.cep}</div>}
                                      </>
                                    ) : (
                                      <span className="text-gray-400 dark:text-zinc-500">Não informado</span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Contatos de Emergência */}
                              <td className="px-4 py-3 align-top min-w-[220px]">
                                {Array.isArray(p.contatos_emergencia) && p.contatos_emergencia.filter(c => c && (c.nome || c.telefone)).length > 0 ? (
                                  <div className="space-y-1.5">
                                    {p.contatos_emergencia.filter(c => c && (c.nome || c.telefone)).map((c, cIdx) => (
                                      <div key={cIdx} className="bg-amber-50/70 border border-amber-200/70 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200 rounded px-2 py-1 text-xs">
                                        <div className="font-semibold">{c.nome || 'Contato'}</div>
                                        {c.telefone && (
                                          <div className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                                            {c.telefone}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 dark:text-zinc-500 text-xs">Não informado</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Export Modal */}
      {isExportModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-zinc-100">
                  Exportar Relatório de Publicadores
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                  Selecione as colunas desejadas para exportação em PDF ou XLSX.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 bg-white dark:bg-zinc-900">
              {/* Toolbar: Select All / Deselect All */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllColumns}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-200 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 dark:border dark:border-purple-800/50 px-2.5 py-1 rounded-md transition-colors"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    Selecionar Todas
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllColumns}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:text-gray-800 dark:hover:text-zinc-100 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border dark:border-zinc-700 px-2.5 py-1 rounded-md transition-colors"
                  >
                    <Square className="w-3.5 h-3.5" />
                    Desmarcar Todas
                  </button>
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 px-2.5 py-1 rounded-full">
                  <strong className="text-purple-700 dark:text-purple-400 font-bold">{selectedColumns.length}</strong> de {ALL_COLUMNS.length} colunas
                </span>
              </div>

              {/* Column Categories */}
              <div className="space-y-4">
                {COLUMN_CATEGORIES.map(category => (
                  <div key={category.category} className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                      {category.category}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {category.columns.map(col => {
                        const isChecked = selectedColumns.includes(col.id);
                        return (
                          <label
                            key={col.id}
                            className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors select-none ${
                              isChecked 
                                ? 'bg-purple-50/70 border-purple-300 text-purple-900 dark:bg-purple-950/60 dark:border-purple-600 dark:text-purple-200 font-semibold' 
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/60'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleColumn(col.id)}
                              className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4 border-gray-300 dark:border-zinc-600 dark:bg-zinc-800"
                            />
                            <span className="truncate">{col.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Extra PDF option */}
              {selectedGrupo === 'todos' && (
                <div className="p-3 bg-purple-50/60 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-900/60">
                  <label className="flex items-center gap-2 text-xs text-purple-900 dark:text-purple-200 font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={breakByGroupPdf}
                      onChange={e => setBreakByGroupPdf(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4 border-purple-300 dark:border-purple-700 dark:bg-zinc-800"
                    />
                    <span>No PDF: Iniciar cada grupo em uma nova página</span>
                  </label>
                </div>
              )}

              {selectedColumns.length === 0 && (
                <p className="text-xs text-red-600 dark:text-red-300 font-medium bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-200 dark:border-red-900/60">
                  Selecione ao menos uma coluna para poder exportar.
                </p>
              )}
            </div>

            {/* Modal Footer with XLSX & PDF buttons */}
            <div className="p-4 bg-gray-50 dark:bg-zinc-950 border-t border-gray-100 dark:border-zinc-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsExportModalOpen(false)}
                className="w-full sm:w-auto text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                Cancelar
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  onClick={handleExportPdf}
                  disabled={selectedColumns.length === 0 || loading || !filteredPublishers.length}
                  size="sm"
                  className="gap-2 bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm flex-1 sm:flex-none"
                >
                  <FileText className="w-4 h-4" />
                  <span>Exportar PDF</span>
                </Button>

                <Button
                  onClick={handleExportXlsx}
                  disabled={selectedColumns.length === 0 || loading || !filteredPublishers.length}
                  size="sm"
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm flex-1 sm:flex-none"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar XLSX</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
