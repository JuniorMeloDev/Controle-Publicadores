'use client';

import { cloneElement, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Plus, Pencil, Loader2, MapPin, CheckCircle2 } from 'lucide-react';
import { DesignationRowActions } from './DesignationRowActions';
import { Button } from '@/app/components/ui/button';
import { StatusToast } from '@/app/components/ui/status-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { ConfirmationDialog } from '@/app/components/ui/confirmation-dialog';
import { PublisherCombobox } from '@/app/components/reunioes/PublisherCombobox';
import { FieldMapAttachment, FieldMapLinks } from './FieldMapAttachment';
import { TerritoryMapDetails } from './IndividualFieldMaps';
import { FieldMapBatchImport } from './FieldMapBatchImport';
import { FieldOutingResults } from './FieldOutingResults';
import { FieldScheduleGenerator } from './FieldScheduleGenerator';
import { FieldHistoryExport } from './FieldHistoryExport';
import { FieldLeadersExport } from './FieldLeadersExport';
import { TerritoryRecentHistory } from './TerritoryRecentHistory';
import { WeekendGroupTerritories } from './WeekendGroupTerritories';
import { FieldAssignmentTransfer, PendingTerritoryNotice } from './FieldAssignmentTransfer';
import { TERRITORY_PERIODS, FIELD_RESULTS, territoryPeriod } from '@/app/lib/field-planner';
import { buildFieldOutingMessage, fieldWhatsAppUrl } from '@/app/lib/field-service-share';
import { TerritoryBoundaryEditor } from './TerritoryBoundaryEditor';
import { CongregationSchematic } from './CongregationSchematic';
import { usePermissions } from '@/app/components/PermissionsContext';
import { isAllowed } from '@/app/lib/access-control';
import { FIELD_MODES, fieldOutingResults, isFieldOutingCompleted, usesGroupTerritories, isTerritoryAllowedForOuting, isWeekendOuting, usesSingleFieldLeader, fieldOutingTerritorySummary } from '@/app/lib/field-service';
import { useDesignationPeriod } from './DesignationPeriodContext';
import { DesignationPeriodFilters, designationToolbarClass, designationListHeaderClass } from './DesignationLayout';

const sections = { saidas: 'Agenda', locais: 'Locais', territorios: 'Territórios', conclusoes: 'Histórico' };
const titles = { saidas: 'saída', locais: 'local', territorios: 'território', designacoes: 'designação de território', complete: 'conclusão' };
const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const controlClass = 'w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const displayDate = date => date ? date.slice(0, 10).split('-').reverse().join('/') : '—';
const blankData = { saidas: [], locais: [], territorios: [], designacoes: [], publicadores: [], grupos: [], mapas: [], resultados: [] };

export function FieldAgendaCard({ outing, data, groups, children }) {
  const leader = data.publicadores.find(row => row.id === outing.dirigente_publicador_id)?.nome;
  const location = data.locais.find(row => row.id === outing.local_id)?.nome;
  const territoryNumber = id => data.territorios.find(row => row.id === id)?.numero ?? '?';
  const results = fieldOutingResults(outing, data.designacoes, data.resultados);
  const groupSummary = usesSingleFieldLeader(outing) && outing.grupos.length
    ? fieldOutingTerritorySummary(outing, data).split('\n').filter(Boolean) : [];
  const hasGroupSummary = groupSummary.length > 0;
  const sideBySide = hasGroupSummary || results.length > 0;

  return <article className="@container space-y-3 p-4">
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="font-semibold text-gray-900">{displayDate(outing.data)} · {outing.horario}</h4>
        <p className="text-sm text-gray-700 [overflow-wrap:anywhere]">{leader || 'Dirigente a definir'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </header>
    <div className={`grid gap-x-5 gap-y-3 text-sm ${sideBySide ? '@2xl:grid-cols-2' : ''} ${hasGroupSummary && results.length ? '@5xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,2fr)]' : ''}`}>
      <div className={`min-w-0 [overflow-wrap:anywhere] ${sideBySide ? 'space-y-1' : 'flex flex-wrap items-baseline gap-x-3 gap-y-1'}`}>
        <p className="font-medium text-gray-900">{location || 'Local a definir'}</p>
        <p className="text-gray-600">{groups}</p>
        <p className="text-purple-700">{FIELD_MODES[outing.modalidade]}{outing.territorios.length > 0 && ` · ${outing.territorios.map(territoryNumber).join(', ')}`}</p>
      </div>
      {hasGroupSummary && <div className="min-w-0 space-y-1">
        <h5 className="font-medium text-gray-900">Dirigente único</h5>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-gray-600 [overflow-wrap:anywhere]">
          {groupSummary.map((line, index) => <li key={index} className="max-w-full">{line}</li>)}
        </ul>
      </div>}
      {results.length > 0 && <div className={`min-w-0 space-y-1 ${hasGroupSummary ? '@2xl:col-span-2 @5xl:col-span-1' : ''}`}>
        <h5 className="font-medium text-gray-900">Resultados dos territórios</h5>
        <ul className={`grid gap-x-4 gap-y-1.5 ${hasGroupSummary ? '@2xl:grid-cols-2' : '@4xl:grid-cols-2'}`}>
          {results.map(result => <li key={result.territorio_id} className="min-w-0 text-gray-600 [overflow-wrap:anywhere]">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-gray-900">Território {territoryNumber(result.territorio_id)}</span>
              <span>{result.resultado === 'transferido' ? 'Transferido' : FIELD_RESULTS[result.resultado]} · {displayDate(result.data)}</span>
            </p>
            {result.observacoes && <p className="whitespace-pre-wrap">{result.observacoes}</p>}
          </li>)}
        </ul>
      </div>}
    </div>
    {outing.observacoes && <p className="whitespace-pre-wrap text-sm text-gray-600 [overflow-wrap:anywhere]">{outing.observacoes}</p>}
  </article>;
}

function defaults(entity) {
  if (entity === 'saidas') return { data: today(), horario: '08:30', dirigente_publicador_id: '', local_id: '', grupos: [], territorios: [], dirigente_unico: true, territorios_por_grupo: {}, modalidade: 'territorio', observacoes: '', semanas: 1 };
  if (entity === 'locais') return { nome: '', endereco: '', mapa_url: '', grupos: [], observacoes: '', ativo: true };
  if (entity === 'territorios') return { numero: '', descricao: '', mapa_url: '', referencias: '', fim_semana: false, periodo: 'ambos', ativo: true };
  if (entity === 'complete') return { data_conclusao: today() };
  return { territorio_id: '', publicador_id: '', data_designacao: today(), data_conclusao: '', observacoes: '' };
}

async function api(body, signal) {
  const multipart = body instanceof FormData;
  const response = await fetch('/api/admin/servico-campo', body ? { method: 'POST', ...(multipart ? {} : { headers: { 'Content-Type': 'application/json' } }), body: multipart ? body : JSON.stringify(body), signal } : { signal, cache: 'no-store' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'Não foi possível carregar o Serviço de Campo.');
  return result;
}

function Field({ label, children }) {
  const id = useId();
  if (children.type === 'div') return <fieldset className="grid gap-1.5 text-sm font-medium text-gray-700"><legend className="mb-1.5">{label}</legend>{children}</fieldset>;
  return <div className="grid gap-1.5 text-sm font-medium text-gray-700"><label htmlFor={id}>{label}</label>{cloneElement(children, { id })}</div>;
}
function Choices({ label, options, selected, onChange }) {
  return <fieldset className="space-y-2"><legend className="text-sm font-medium text-gray-700">{label}</legend>
    {options.length ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border border-gray-200 p-3">{options.map(option => <label key={option.id} className="flex items-center gap-2 text-sm min-w-0">
      <input type="checkbox" className="accent-purple-600 shrink-0" checked={selected.includes(option.id)} onChange={e => onChange(e.target.checked ? [...selected, option.id] : selected.filter(id => id !== option.id))} />
      <span className="break-words">{option.nome || `Território ${option.numero}`}{option.ativo === false ? ' (inativo)' : ''}</span>
    </label>)}</div> : <p className="text-sm text-gray-500">Nenhum cadastro disponível.</p>}
  </fieldset>;
}

export function FieldServiceTab() {
  const { permissions } = usePermissions();
  const canEdit = isAllowed(permissions, 'servico_campo_editar', 'actions');
  const { month, year } = useDesignationPeriod();
  const [section, setSection] = useState('saidas');
  const [data, setData] = useState(blankData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState('');
  const [mapFile, setMapFile] = useState(null);
  const [shareMessage, setShareMessage] = useState(null);
  const [shareFeedback, setShareFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingNotification, setPendingNotification] = useState(null);
  const [groupFilter, setGroupFilter] = useState('');
  const [historyYear, setHistoryYear] = useState(today().slice(0, 4));
  const [historyMonth, setHistoryMonth] = useState(() => today().slice(5, 7));
  const [showInactive, setShowInactive] = useState(false);
  const [mapTerritoryId, setMapTerritoryId] = useState(null);
  const [mapEditing, setMapEditing] = useState(false);
  const [showGeographicMap, setShowGeographicMap] = useState(false);
  const [registerHandover, setRegisterHandover] = useState(false);
  const [batchDialog, setBatchDialog] = useState(null);
  const [resultOuting, setResultOuting] = useState(null);
  const [transferAssignment, setTransferAssignment] = useState(null);
  const [confirmedTransfers, setConfirmedTransfers] = useState({});
  const [recentTerritoryId, setRecentTerritoryId] = useState(null);
  const saving = useRef(false);
  const refresh = useCallback(async (signal, silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try { const result = await api(null, signal); if (!signal?.aborted) setData(result); }
    catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); refresh(controller.signal); return () => controller.abort(); }, [refresh]);

  const name = (entity, id) => data[entity].find(row => row.id === Number(id))?.nome;
  const groupsLabel = groups => groups.length ? groups.map(id => name('grupos', id) || 'Grupo removido').join(', ') : 'Congregação';
  const territoryUrls = () => Object.fromEntries(data.territorios.filter(t => t.ativo && t.mapa_share_token && (t.limites || data.mapas.some(map => map.territorio_id === t.id)))
    .map(t => [t.id, new URL(`/mapa-territorio/${t.mapa_share_token}`, window.location.origin).toString()]));
  function shareOuting(row) { openShare(buildFieldOutingMessage(row, data, territoryUrls())); }
  const agenda = data.saidas.filter(row => !isFieldOutingCompleted(row, data.designacoes, data.resultados) && (!year || row.data.startsWith(year)) && (!month || row.data.slice(5, 7) === month) && (!groupFilter || !row.grupos.length || row.grupos.includes(Number(groupFilter))));
  const history = data.designacoes.filter(row =>
    (!historyYear || row.data_designacao.slice(0, 4) === historyYear) &&
    (!historyMonth || row.data_designacao.slice(5, 7) === historyMonth)
  );
  const openAssignments = data.designacoes.filter(row => !row.data_conclusao && !row.data_transferencia);
  const selectedPending = editor?.entity === 'saidas' ? openAssignments.filter(row => form.territorios?.includes(row.territorio_id)
    && row.observacoes !== `Entrega registrada pela saída ${editor.id}.`) : [];
  const historyYears = [...new Set([today().slice(0, 4), ...data.designacoes.map(row => row.data_designacao.slice(0, 4))])].filter(Boolean).sort().reverse();
  const options = entity => data[entity].filter(row => row.ativo !== false || row.id === Number(form[entity === 'locais' ? 'local_id' : 'territorio_id']) || (entity === 'grupos' ? form.grupos : form.territorios)?.includes(row.id))
    .filter(row => entity !== 'territorios' || editor?.entity !== 'saidas' || isTerritoryAllowedForOuting(row, form) || form.territorios?.includes(row.id))
    .map(row => entity === 'territorios' && editor?.entity === 'saidas' ? { ...row, nome: `Território ${row.numero}${row.mapa_grupo_id ? ` · ${name('grupos', row.mapa_grupo_id)}` : ' · Sem grupo no mapa'}${!isTerritoryAllowedForOuting(row, form) ? ' · Fora dos grupos selecionados: remova para salvar' : ''}` } : row);
  const changeForm = patch => setForm(current => {
    const next = { ...current, ...patch };
    if (editor?.entity !== 'saidas') return next;
    const previousAssigned = Object.values(current.territorios_por_grupo || {}).flat();
    const unassigned = (next.territorios || []).filter(id => !previousAssigned.includes(id));
    const mapping = usesSingleFieldLeader(next) ? Object.fromEntries(Object.entries(next.territorios_por_grupo || {}).filter(([id]) => next.grupos.includes(Number(id)))) : {};
    // Turning off the shared consideration keeps the flat territory selection.
    return { ...next, territorios_por_grupo: mapping, territorios: usesSingleFieldLeader(next)
      ? [...new Set([...unassigned, ...Object.values(mapping).flat()])] : next.territorios };
  });
  const update = (key, value) => changeForm({ [key]: value });
  const openEditor = (entity, row) => {
    if (!canEdit) return;
    setRegisterHandover(false);
    setConfirmedTransfers({});
    setEditor({ entity, id: row?.id });
    setForm(entity === 'complete' ? defaults(entity) : { ...defaults(entity), ...row });
    setFormError('');
    setMapFile(null);
    setRecentTerritoryId(entity === 'designacoes' ? row?.territorio_id || null : null);
  };
  const chooseTerritory = value => {
    update('territorio_id', value);
    setRecentTerritoryId(value ? Number(value) : null);
  };
  const chooseOutingTerritories = value => {
    const added = value.find(id => !(form.territorios || []).includes(id));
    update('territorios', value);
    if (added) setRecentTerritoryId(added);
  };
  const setLocation = value => {
    const location = data.locais.find(row => row.id === Number(value));
    changeForm({ local_id: value, grupos: location?.grupos || form.grupos });
  };
  async function submit(event) {
    event.preventDefault();
    if (!canEdit || saving.current) return;
    saving.current = true; setBusy(true); setFormError(''); setFeedback('');
    try {
      let body = editor.entity === 'complete' ? { action: 'complete', entity: 'designacoes', id: editor.id, data_conclusao: form.data_conclusao } : { action: 'save', entity: editor.entity, record: form };
      if (editor.entity === 'saidas') {
        body.registrar_entrega = registerHandover && form.modalidade === 'territorio';
        if (body.registrar_entrega) {
          if (selectedPending.some(row => confirmedTransfers[row.territorio_id] !== row.id)) throw new Error('Confirme a transferência dos territórios pendentes antes de registrar a entrega.');
          body.transferencias = Object.fromEntries(selectedPending.map(row => [row.territorio_id, row.id]));
        }
      }
      if (editor.entity === 'territorios' && mapFile) {
        const multipart = new FormData(); multipart.append('dados', JSON.stringify(body)); multipart.append('arquivo', mapFile); body = multipart;
      }
      const result = await api(body);
      setEditor(null);
      setFeedback(result.entregas ? `Saída salva e ${result.entregas} território(s) com entrega registrada.` : result.ids.length > 1 ? `${result.ids.length} saídas semanais criadas.` : 'Registro salvo com sucesso.');
      await refresh();
    } catch (err) { setFormError(err.message); }
    finally { saving.current = false; setBusy(false); }
  }
  async function remove() {
    await api({ action: 'delete', entity: 'saidas', id: pendingDelete.id });
    setFeedback('Saída excluída. Entregas pendentes sem resultados, transferências ou quadras concluídas foram removidas.');
    await refresh();
  }
  const openShare = message => { setShareMessage(message); setShareFeedback(''); };
  const batchSaved = async message => { setFeedback(message); await refresh(undefined, true); };
  async function notifyOuting() {
    const result = await api({ action: 'notify', entity: 'saidas', id: pendingNotification.id });
    setFeedback(result.notificacoes
      ? `Notificação salva para ${result.notificacoes} publicador(es).`
      : 'A notificação desta saída já está atualizada para os publicadores.');
    window.dispatchEvent(new Event('alertas-atualizados'));
  }
  async function copyMessage() {
    try { await navigator.clipboard.writeText(shareMessage); setShareFeedback('Mensagem copiada.'); }
    catch { setShareFeedback('Selecione o texto acima e copie a mensagem.'); }
  }
  const select = (key, entity, placeholder, handler) => <select className={controlClass} value={form[key] ?? ''} onChange={e => handler ? handler(e.target.value) : update(key, e.target.value)} required={['publicador_id', 'territorio_id'].includes(key)}>
    <option value="">{placeholder}</option>{options(entity).map(row => <option key={row.id} value={row.id}>{row.nome || `Território ${row.numero}`}{row.ativo === false ? ' (inativo)' : ''}</option>)}
  </select>;
  const input = (key, type = 'text', required = false, extra = {}) => <input className={controlClass} type={type} value={form[key] ?? ''} onChange={e => update(key, e.target.value)} required={required} {...extra} />;
  const notes = (key, label) => <Field label={label}><textarea className={controlClass} rows={3} maxLength={2000} value={form[key] || ''} onChange={e => update(key, e.target.value)} /></Field>;
  const buttons = (entity, row) => canEdit && <Button type="button" variant="outline" size="sm" onClick={() => openEditor(entity, row)}><Pencil className="h-4 w-4 mr-1" />Editar</Button>;

  return <div className="min-w-0 space-y-4">
    <div className={designationToolbarClass}><div><h2 className="text-lg font-bold text-gray-900">Serviço de Campo</h2><p className="text-sm text-gray-500 mt-1">Organize as saídas, os dirigentes e o trabalho nos territórios.</p></div>
      <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap [&>button]:h-auto [&>button]:min-h-11 [&>button]:min-w-0 [&>button]:w-full [&>button]:whitespace-normal [&>button]:py-2 xl:[&>button]:w-auto">
      {section === 'conclusoes' && isAllowed(permissions, 'designacoes_pdf', 'actions') && <FieldHistoryExport data={data} disabled={loading || Boolean(error)} />}
      {section === 'conclusoes' && isAllowed(permissions, 'designacoes_pdf', 'actions') && <FieldLeadersExport data={data} initialYear={historyYear} initialMonth={historyMonth} disabled={loading || Boolean(error)} />}
      {canEdit && !loading && !error && section === 'saidas' && <Button variant="outline" onClick={() => setBatchDialog('schedule')}>Gerar programação automática</Button>}
      {canEdit && ['saidas', 'locais'].includes(section) && <Button disabled={loading || Boolean(error)} className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => openEditor(section)}><Plus className="h-4 w-4 mr-2" />{section === 'saidas' ? 'Nova saída' : 'Novo local'}</Button>}</div>
    </div>
    {!canEdit && <p className="text-sm text-gray-500">Você tem acesso de leitura. A edição depende da permissão de Serviço de Campo na gestão de acessos.</p>}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-gray-100 rounded-xl" role="tablist" aria-label="Seções do Serviço de Campo">{Object.entries(sections).map(([key, label]) => <button type="button" key={key} id={`campo-tab-${key}`} disabled={mapEditing} role="tab" aria-selected={section === key} aria-controls={`campo-panel-${key}`} onClick={() => { setSection(key); setFeedback(''); }} className={`h-10 rounded-lg text-sm font-medium focus-visible:ring-2 focus-visible:ring-purple-500 ${section === key ? 'bg-white shadow-sm text-purple-700' : 'text-gray-600 hover:bg-white/50'}`}>{label}</button>)}</div>
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}<button className="ml-3 underline" onClick={() => refresh()}>Tentar novamente</button></div>}
    <StatusToast message={feedback} type="success" onClose={() => setFeedback('')} />
    {section === 'territorios' && !loading && !error && <>
      <CongregationSchematic territories={data.territorios} onSelect={setMapTerritoryId} />
      <details className="rounded-xl border border-gray-200 bg-white p-4"><summary className="cursor-pointer text-sm font-medium text-gray-700">PDF geral original</summary><div className="mt-3"><FieldMapAttachment map={data.mapas.find(map => map.chave === 'geral')} canEdit={canEdit} onSaved={() => refresh()} /></div></details>
      <details className="rounded-xl border border-gray-200 bg-white p-4" onToggle={event => setShowGeographicMap(event.currentTarget.open)}><summary onClick={event => { if (mapEditing) event.preventDefault(); }} className="cursor-pointer text-sm font-medium text-gray-700">Editar limites geográficos no Google Maps (opcional)</summary>{showGeographicMap && <div className="mt-3"><TerritoryBoundaryEditor canEdit={canEdit} territories={data.territorios} onEditingChange={setMapEditing} onSaved={() => refresh(undefined, true)} /></div>}</details>
    </>}
    <section id={`campo-panel-${section}`} role="tabpanel" aria-labelledby={`campo-tab-${section}`} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={designationListHeaderClass}><h3 className="font-semibold text-gray-900">{section === 'saidas' ? 'Programação de campo' : section === 'territorios' ? 'Cadastro e registro de territórios' : section === 'conclusoes' ? 'Histórico de designações' : sections[section]}</h3>
        {section === 'territorios' && canEdit && !loading && !error && <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" onClick={() => openEditor('territorios')}>Cadastrar território</Button><FieldMapBatchImport territories={data.territorios} onSaved={() => refresh(undefined, true)} /></div>}
        {section === 'saidas' ? <div className="flex flex-wrap gap-2 min-w-0"><DesignationPeriodFilters years={data.saidas.map(row => row.data.slice(0, 4))} onClear={() => setGroupFilter('')} hasAdditionalFilters={Boolean(groupFilter)} /><select className={`${controlClass} sm:w-44`} aria-label="Filtrar saídas por grupo" value={groupFilter} onChange={e => setGroupFilter(e.target.value)}><option value="">Todos os grupos</option>{data.grupos.map(row => <option key={row.id} value={row.id}>{row.nome}</option>)}</select></div>
          : section === 'conclusoes' ? <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto">
            <label className="text-sm text-gray-600">Mês<select className={`${controlClass} mt-1 sm:w-40`} value={historyMonth} onChange={e => setHistoryMonth(e.target.value)}><option value="">Todos</option>{months.map((value, index) => <option key={value} value={String(index + 1).padStart(2, '0')}>{value}</option>)}</select></label>
            <label className="text-sm text-gray-600">Ano<select className={`${controlClass} mt-1 sm:w-32`} value={historyYear} onChange={e => setHistoryYear(e.target.value)}><option value="">Todos</option>{historyYears.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>
            : <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />Mostrar inativos</label>}
      </div>
      {loading ? <div role="status" aria-label="Carregando Serviço de Campo" className="p-10"><Loader2 className="mx-auto h-7 w-7 animate-spin text-purple-600" /></div> : error ? <p className="p-6 text-sm text-gray-500">Atualize os dados para continuar.</p> : <div className="divide-y divide-gray-100">
        {section === 'saidas' && (agenda.length ? agenda.map(row =>
          <FieldAgendaCard key={row.id} outing={row} data={data} groups={groupsLabel(row.grupos)}>
            {canEdit && row.modalidade === 'territorio' && row.territorios.length > 0 &&
              <Button type="button" variant="outline" size="sm" onClick={() => setResultOuting(row)}>Registrar resultado</Button>}
            {buttons('saidas', row)}
            <DesignationRowActions label={`Saída de ${displayDate(row.data)} ${row.horario}`} showPdf={false}
              onNotify={canEdit ? () => setPendingNotification(row) : undefined} onWhatsApp={() => shareOuting(row)}
              onDelete={canEdit ? () => setPendingDelete(row) : undefined} />
          </FieldAgendaCard>
        ) : <p className="p-10 text-center text-sm text-gray-500">Nenhuma saída neste período. Escolha um publicador e um local para começar a programação.</p>)}
        {['locais', 'territorios'].includes(section) && (data[section].filter(row => showInactive || row.ativo).length ? data[section].filter(row => showInactive || row.ativo).map(row => <article key={row.id} className="p-4 flex flex-col sm:flex-row gap-3"><div className="min-w-0 flex-1 space-y-1">
          <div className="font-semibold text-gray-900">{row.nome || `Território ${row.numero}`}{!row.ativo && <span className="ml-2 text-xs text-gray-500">Inativo</span>}</div>
          {section === 'locais' && <><p className="text-sm text-gray-600 break-words">{row.endereco || 'Endereço a cadastrar'}</p><p className="text-sm text-gray-500">{groupsLabel(row.grupos)}</p>{row.mapa_url && /^https?:\/\//i.test(row.mapa_url) && <a href={row.mapa_url} target="_blank" rel="noopener noreferrer" className="inline-flex gap-1 items-center text-sm text-purple-700 underline"><MapPin className="w-4 h-4" />Abrir mapa</a>}{row.observacoes && <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{row.observacoes}</p>}</>}
          {section === 'territorios' && <><p className="text-sm text-gray-600 break-words">{row.descricao || 'Sem descrição'}{` · ${TERRITORY_PERIODS[territoryPeriod(row)]}`}</p><p className="text-xs text-gray-500">Última conclusão: {displayDate(row.ultima_conclusao)}</p><p className="text-sm text-purple-700">{openAssignments.some(item => item.territorio_id === row.id) ? `Designado para ${name('publicadores', openAssignments.find(item => item.territorio_id === row.id).publicador_id)}` : 'Disponível'}</p></>}
          </div><div className="flex flex-wrap gap-2 items-start">{section === 'territorios' && <Button type="button" variant="outline" size="sm" onClick={() => setMapTerritoryId(row.id)}>Mapa e referências</Button>}{buttons(section, row)}{section === 'territorios' && canEdit && openAssignments.some(d => d.territorio_id === row.id) && <Button variant="outline" size="sm" onClick={() => setTransferAssignment(openAssignments.find(d => d.territorio_id === row.id))}>Transferir pendência</Button>}{section === 'territorios' && canEdit && row.ativo && !openAssignments.some(item => item.territorio_id === row.id) && <Button variant="outline" size="sm" onClick={() => openEditor('designacoes', { territorio_id: row.id })}>Designar</Button>}</div></article>) : <p className="p-10 text-center text-sm text-gray-500">Nenhum cadastro encontrado.</p>)}
            {section === 'conclusoes' && (history.length ? history.map(row => <article key={row.id} className="p-4 flex flex-col sm:flex-row gap-3"><div className="flex-1 min-w-0"><p className="font-medium text-gray-900">Território {data.territorios.find(item => item.id === row.territorio_id)?.numero} · {name('publicadores', row.publicador_id) || row.responsavel_nome || 'Responsável não informado'}{row.origem_importacao ? ' · Importado' : ''}</p><p className="text-sm text-gray-500 mt-1">Designado: {displayDate(row.data_designacao)} · {row.data_conclusao ? `Concluído: ${displayDate(row.data_conclusao)}` : row.data_transferencia ? `Transferido: ${displayDate(row.data_transferencia)} (sem conclusão)` : 'Conclusão pendente'}</p>{row.observacoes && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap break-words">{row.observacoes}</p>}{row.designacao_anterior_id && <p className="text-sm text-purple-700 mt-1">Recebido por transferência de {name('publicadores', data.designacoes.find(d => d.id === row.designacao_anterior_id)?.publicador_id) || 'responsável anterior'}.</p>}{row.orientacoes_continuacao && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap break-words">Pendências recebidas: {row.orientacoes_continuacao}</p>}{row.data_transferencia && <p className="text-sm text-purple-700 mt-1">Transferido para {name('publicadores', data.designacoes.find(d => d.designacao_anterior_id === row.id)?.publicador_id) || 'novo responsável'}.</p>}{(data.resultados || []).filter(result => result.designacao_id === row.id).map(result => <p key={result.id} className="text-sm text-gray-600 mt-1">{FIELD_RESULTS[result.resultado]} · {displayDate(result.data)}{result.observacoes && `: ${result.observacoes}`}</p>)}</div>{!row.data_conclusao && !row.data_transferencia && canEdit && <div className="flex flex-wrap gap-2 items-start"><Button variant="outline" size="sm" onClick={() => setTransferAssignment(row)}>Transferir território</Button><Button variant="outline" size="sm" onClick={() => openEditor('complete', row)}><CheckCircle2 className="h-4 w-4 mr-2" />Registrar conclusão</Button></div>}</article>) : <p className="p-8 text-sm text-center text-gray-500">Nenhuma designação encontrada para esse período.</p>)}
      </div>}
    </section>
    {batchDialog === 'schedule' && <FieldScheduleGenerator data={data} onClose={() => setBatchDialog(null)} onSaved={batchSaved} />}
    {resultOuting && <FieldOutingResults outing={resultOuting} data={data} onClose={() => setResultOuting(null)} onSaved={batchSaved} />}
    {transferAssignment && <FieldAssignmentTransfer assignment={transferAssignment} data={data} onClose={() => setTransferAssignment(null)} onSaved={batchSaved} />}
    {pendingNotification && <ConfirmationDialog title="Enviar notificação da saída?" confirmLabel="Enviar"
        description={`Saída de ${displayDate(pendingNotification.data)} às ${pendingNotification.horario}. O sino dos publicadores de ${groupsLabel(pendingNotification.grupos)} mostrará os territórios de cada grupo e os links dos mapas disponíveis. Os aparelhos com notificações ativadas receberão um aviso.`}
      onConfirm={notifyOuting} onCancel={() => setPendingNotification(null)} />}
    <TerritoryMapDetails territory={data.territorios.find(row => row.id === mapTerritoryId)} maps={data.mapas} canEdit={canEdit} onEdit={row => openEditor('territorios', row)} onShare={openShare} publicMapUrl={typeof window !== 'undefined' && mapTerritoryId ? territoryUrls()[mapTerritoryId] || '' : ''} onSaved={() => refresh(undefined, true)} onClose={() => setMapTerritoryId(null)} />
    {pendingDelete && <ConfirmationDialog destructive title="Excluir saída de campo?" confirmLabel="Excluir" description={`A saída de ${displayDate(pendingDelete.data)} às ${pendingDelete.horario} será excluída junto com suas entregas pendentes sem resultados, transferências ou quadras concluídas.`} onConfirm={remove} onCancel={() => setPendingDelete(null)} />}
    <Dialog open={shareMessage !== null} onOpenChange={open => { if (!open) setShareMessage(null); }}><DialogContent className="w-[calc(100%-2rem)] max-w-xl max-h-[90dvh] overflow-y-auto bg-white text-gray-900"><DialogHeader><DialogTitle>Compartilhar serviço de campo</DialogTitle><DialogDescription>Confira a mensagem e escolha como compartilhar. Os links do Google Maps podem ser abertos pelos publicadores.</DialogDescription></DialogHeader><Field label="Mensagem"><textarea className={controlClass} rows={12} value={shareMessage || ''} onChange={e => setShareMessage(e.target.value)} /></Field>{shareFeedback && <p role="status" className="text-sm text-gray-600">{shareFeedback}</p>}<DialogFooter className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={copyMessage}>Copiar mensagem</Button><a className="inline-flex items-center justify-center rounded-md bg-purple-600 hover:bg-purple-700 px-4 py-2 text-sm font-medium text-white" href={fieldWhatsAppUrl(shareMessage || '')} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(editor)} onOpenChange={open => { if (!open && !saving.current && !recentTerritoryId) setEditor(null); }}><DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto bg-white text-gray-900" onEscapeKeyDown={event => { if (recentTerritoryId) { event.preventDefault(); setRecentTerritoryId(null); } else if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy || recentTerritoryId) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{editor?.entity === 'complete' ? 'Registrar conclusão' : `${editor?.id ? 'Editar' : 'Cadastrar'} ${titles[editor?.entity] || ''}`}</DialogTitle><DialogDescription>{editor?.entity === 'saidas' ? 'Escolha o dirigente, os grupos e o local da consideração. Sem grupos selecionados, a saída é da congregação.' : editor?.entity === 'designacoes' ? 'Registre a entrega do território ao responsável. A conclusão será registrada separadamente.' : 'Preencha os dados abaixo. Desative cadastros para preservar o histórico.'}</DialogDescription></DialogHeader>
      {recentTerritoryId && <TerritoryRecentHistory territoryId={recentTerritoryId} data={data} onClose={() => setRecentTerritoryId(null)} />}
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
        {editor?.entity === 'saidas' && <p className="rounded-lg bg-purple-50 p-3 text-sm text-purple-900">Para montar o mês, defina horário, local, dirigente e grupos, deixe os territórios vazios e escolha quantas saídas criar em &quot;Repetir semanalmente&quot;. Depois, edite cada data para escolher seus territórios. No fim de semana, mantenha Dirigente Único marcado para reunir os grupos na consideração e definir os territórios de cada grupo depois.</p>}
        {editor?.entity === 'saidas' && isWeekendOuting(form) && <div className="space-y-2 rounded-lg border border-purple-200 p-3"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="accent-purple-600" checked={form.dirigente_unico !== false} onChange={event => update('dirigente_unico', event.target.checked)} />Dirigente Único</label><p className="text-sm text-gray-500">{form.dirigente_unico !== false ? 'Um dirigente faz a consideração para os grupos, que depois trabalham em territórios separados.' : 'Cadastre uma saída por grupo e escolha o dirigente de cada saída.'}</p></div>}
        {editor?.entity === 'saidas' && usesGroupTerritories(form) && <p role="status" className="text-sm text-gray-600">Nos fins de semana, você pode escolher os territórios dos grupos selecionados e os que ainda estão sem grupo no mapa. Enquanto os vínculos não forem definidos, os territórios sem grupo ficam disponíveis para qualquer grupo. Depois de definir o grupo responsável no mapa, o território fica disponível apenas para ele. Com Dirigente Único, distribua os territórios entre os grupos abaixo. Desmarque a opção para cadastrar uma saída por grupo.</p>}
        {editor?.entity === 'saidas' && usesGroupTerritories(form) && !data.territorios.some(t => t.ativo && isTerritoryAllowedForOuting(t, form)) && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Nenhum território ativo está disponível para esses grupos. Os territórios com grupo definido no mapa ficam disponíveis apenas para o grupo responsável. Você pode salvar a programação sem territórios e preenchê-los depois.</p>}
        {editor?.entity === 'saidas' && <><div className="grid sm:grid-cols-2 gap-4"><Field label="Data">{input('data', 'date', true)}</Field><Field label="Horário"><div className="space-y-2"><label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={form.horario === 'Pós reunião'} onChange={e => update('horario', e.target.checked ? 'Pós reunião' : '08:30')} />Pós reunião</label>{form.horario !== 'Pós reunião' && input('horario', 'time', true)}</div></Field><PublisherCombobox label="Dirigente" value={form.dirigente_publicador_id} onChange={value => update('dirigente_publicador_id', value)} publishers={data.publicadores.map(row => ({ id: row.id, nome_completo: row.nome }))} placeholder="A definir" disabled={busy} /><Field label="Local da consideração">{select('local_id', 'locais', 'A definir', setLocation)}</Field></div><Choices label="Grupos (nenhum = congregação)" options={options('grupos')} selected={form.grupos || []} onChange={value => update('grupos', value)} /><Field label="Modalidade"><select className={controlClass} value={form.modalidade} onChange={e => update('modalidade', e.target.value)}>{Object.entries(FIELD_MODES).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></Field>{form.modalidade === 'territorio' && (usesSingleFieldLeader(form) && form.grupos.length > 0 ? <WeekendGroupTerritories form={form} groups={data.grupos} territories={data.territorios} onChange={changeForm} onConsult={setRecentTerritoryId} /> : <Choices label="Territórios planejados (opcional)" options={options('territorios')} selected={form.territorios || []} onChange={chooseOutingTerritories} />)}{!editor.id && <Field label="Repetir semanalmente"><select className={controlClass} value={form.semanas} onChange={e => update('semanas', Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i ? `${i + 1} saídas, uma por semana` : 'Somente esta saída'}</option>)}</select></Field>}{notes('observacoes', 'Observações')}</>}
        {editor?.entity === 'designacoes' && form.territorio_id && <Button type="button" variant="outline" size="sm" onClick={() => setRecentTerritoryId(Number(form.territorio_id))}>Consultar últimas 3 conclusões</Button>}
        {editor?.entity === 'saidas' && form.modalidade === 'territorio' && form.territorios?.length > 0 && <div className="flex flex-wrap gap-2">{form.territorios.map(id => <Button key={id} type="button" variant="outline" size="sm" onClick={() => setRecentTerritoryId(id)}>Histórico do território {data.territorios.find(row => row.id === id)?.numero}</Button>)}</div>}
        {editor?.entity === 'saidas' && form.modalidade === 'territorio' && <div className="rounded-lg border border-purple-200 p-3 space-y-2">
          <label className="flex items-start gap-2 text-sm font-medium"><input type="checkbox" checked={registerHandover} onChange={event => setRegisterHandover(event.target.checked)} />Registrar entrega dos territórios aos responsáveis ao salvar</label>
          {selectedPending.map(assignment => <PendingTerritoryNotice key={assignment.id} assignment={assignment} data={data}><label className="flex items-start gap-2"><input type="checkbox" className="mt-1 accent-purple-600" disabled={!registerHandover} checked={confirmedTransfers[assignment.territorio_id] === assignment.id} onChange={event => setConfirmedTransfers(current => ({ ...current, [assignment.territorio_id]: event.target.checked ? assignment.id : undefined }))} />Transferir esta pendência para o responsável pelo território nesta saída ao registrar a entrega.</label>{!registerHandover && <p>Marque registrar entrega para efetivar a transferência. Apenas planejar a saída preserva o responsável atual.</p>}</PendingTerritoryNotice>)}
          <p className="text-xs text-gray-500">A entrega usa a data da saída (a primeira, se houver repetição). Escolha um dirigente e os territórios. Ao editar, as entregas pendentes ainda sem progresso acompanham as alterações, mesmo sem marcar esta opção novamente.</p>
        </div>}
        {editor?.entity === 'locais' && <><Field label="Nome do local">{input('nome', 'text', true, { maxLength: 120 })}</Field><Field label="Endereço">{input('endereco', 'text', false, { maxLength: 2000 })}</Field><Field label="Link do mapa (opcional)">{input('mapa_url', 'url', false, { maxLength: 1000 })}</Field><Choices label="Grupos habituais" options={options('grupos')} selected={form.grupos || []} onChange={value => update('grupos', value)} />{notes('observacoes', 'Observações')}</>}
        {editor?.entity === 'territorios' && <><Field label="Número do território">{input('numero', 'number', true, { min: 1, max: 2147483647, step: 1 })}</Field>{notes('descricao', 'Descrição / bairro')}<Field label="Link do Google Maps do território (opcional)">{input('mapa_url', 'url', false, { maxLength: 1000, placeholder: 'Cole o link do território ou ponto de referência' })}</Field>{notes('referencias', 'Referências das quadras e orientações')}<Field label="Mapa do território (PDF, até 10 MB)"><input type="file" accept=".pdf,application/pdf" className={controlClass} onChange={e => setMapFile(e.target.files?.[0] || null)} /></Field>{editor.id && <FieldMapLinks territoryId={editor.id} map={data.mapas.find(map => map.territorio_id === editor.id)} />}<Field label="Quando usar este território"><select className={controlClass} value={territoryPeriod(form)} onChange={e => update('periodo', e.target.value)}>{Object.entries(TERRITORY_PERIODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></>}
        {editor?.entity === 'designacoes' && <><div className="grid sm:grid-cols-2 gap-4"><Field label="Território">{select('territorio_id', 'territorios', 'Selecione o território', chooseTerritory)}</Field><Field label="Responsável">{select('publicador_id', 'publicadores', 'Selecione um publicador')}</Field><Field label="Data da designação">{input('data_designacao', 'date', true)}</Field><Field label="Data da conclusão (opcional)">{input('data_conclusao', 'date', false, { min: form.data_designacao })}</Field></div>{notes('observacoes', 'Observações')}<FieldMapLinks territoryId={form.territorio_id} map={data.mapas.find(map => map.territorio_id === Number(form.territorio_id))} /></>}
        {editor?.entity === 'complete' && <Field label="Data da conclusão">{input('data_conclusao', 'date', true, { min: data.designacoes.find(row => row.id === editor.id)?.data_designacao })}</Field>}
        {['locais', 'territorios'].includes(editor?.entity) && <label className="flex gap-2 text-sm items-center"><input type="checkbox" checked={form.ativo ?? true} onChange={e => update('ativo', e.target.checked)} />Cadastro ativo</label>}
      </fieldset>{formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}<DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setEditor(null)}>Cancelar</Button><Button type="submit" disabled={!canEdit || busy} className="bg-purple-600 hover:bg-purple-700 text-white">{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{busy ? 'Salvando…' : 'Salvar'}</Button></DialogFooter></form>
    </DialogContent></Dialog>
  </div>;
}
