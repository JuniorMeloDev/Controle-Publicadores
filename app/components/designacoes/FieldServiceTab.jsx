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
import { buildFieldOutingMessage, fieldWhatsAppUrl } from '@/app/lib/field-service-share';
import { usePermissions } from '@/app/components/PermissionsContext';
import { isAllowed } from '@/app/lib/access-control';
import { FIELD_MODES, fieldServiceYear } from '@/app/lib/field-service';
import { useDesignationPeriod } from './DesignationPeriodContext';
import { DesignationPeriodFilters, designationToolbarClass, designationListHeaderClass } from './DesignationLayout';

const sections = { saidas: 'Agenda', locais: 'Locais', territorios: 'Territórios' };
const titles = { saidas: 'saída', locais: 'local', territorios: 'território', designacoes: 'designação de território', complete: 'conclusão' };
const controlClass = 'w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const displayDate = date => date ? date.slice(0, 10).split('-').reverse().join('/') : '—';
const blankData = { saidas: [], locais: [], territorios: [], designacoes: [], publicadores: [], grupos: [], mapas: [] };

function defaults(entity) {
  if (entity === 'saidas') return { data: today(), horario: '08:30', dirigente_publicador_id: '', local_id: '', grupos: [], territorios: [], modalidade: 'territorio', observacoes: '', semanas: 1 };
  if (entity === 'locais') return { nome: '', endereco: '', mapa_url: '', grupos: [], observacoes: '', ativo: true };
  if (entity === 'territorios') return { numero: '', descricao: '', mapa_url: '', referencias: '', fim_semana: false, ativo: true };
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
  const [groupFilter, setGroupFilter] = useState('');
  const [serviceYear, setServiceYear] = useState(String(fieldServiceYear(today())));
  const [showInactive, setShowInactive] = useState(false);
  const [mapTerritoryId, setMapTerritoryId] = useState(null);
  const [registerHandover, setRegisterHandover] = useState(false);
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
  const territoryLabel = ids => ids.map(id => data.territorios.find(row => row.id === id)?.numero ?? '?').join(', ');
  const agenda = data.saidas.filter(row => (!year || row.data.startsWith(year)) && (!month || row.data.slice(5, 7) === month) && (!groupFilter || !row.grupos.length || row.grupos.includes(Number(groupFilter))));
  const history = data.designacoes.filter(row => !serviceYear || String(fieldServiceYear(row.data_designacao)) === serviceYear);
  const openAssignments = data.designacoes.filter(row => !row.data_conclusao);
  const serviceYears = [...new Set([String(fieldServiceYear(today())), serviceYear, ...data.designacoes.map(row => String(fieldServiceYear(row.data_designacao)))]).values()].filter(Boolean).sort().reverse();
  const options = entity => data[entity].filter(row => row.ativo !== false || row.id === Number(form[entity === 'locais' ? 'local_id' : 'territorio_id']) || (entity === 'grupos' ? form.grupos : form.territorios)?.includes(row.id));
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const openEditor = (entity, row) => {
    if (!canEdit) return;
    setRegisterHandover(false);
    setEditor({ entity, id: row?.id });
    setForm(entity === 'complete' ? defaults(entity) : { ...defaults(entity), ...row });
    setFormError('');
    setMapFile(null);
  };
  const setLocation = value => {
    const location = data.locais.find(row => row.id === Number(value));
    setForm(current => ({ ...current, local_id: value, grupos: location?.grupos || current.grupos }));
  };
  async function submit(event) {
    event.preventDefault();
    if (!canEdit || saving.current) return;
    saving.current = true; setBusy(true); setFormError(''); setFeedback('');
    try {
      let body = editor.entity === 'complete' ? { action: 'complete', entity: 'designacoes', id: editor.id, data_conclusao: form.data_conclusao } : { action: 'save', entity: editor.entity, record: form };
      if (editor.entity === 'saidas') body.registrar_entrega = registerHandover && form.modalidade === 'territorio';
      if (editor.entity === 'territorios' && mapFile) {
        const multipart = new FormData(); multipart.append('dados', JSON.stringify(body)); multipart.append('arquivo', mapFile); body = multipart;
      }
      const result = await api(body);
      setEditor(null);
      setFeedback(result.entregas ? `Saída salva e ${result.entregas} território(s) entregue(s) ao dirigente.` : result.ids.length > 1 ? `${result.ids.length} saídas semanais criadas.` : 'Registro salvo com sucesso.');
      await refresh();
    } catch (err) { setFormError(err.message); }
    finally { saving.current = false; setBusy(false); }
  }
  async function remove() {
    await api({ action: 'delete', entity: 'saidas', id: pendingDelete.id });
    setFeedback('Saída excluída. O histórico dos territórios foi preservado.');
    await refresh();
  }
  const openShare = message => { setShareMessage(message); setShareFeedback(''); };
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
      <div className="flex flex-wrap gap-2">
      {canEdit && section !== 'territorios' && <Button disabled={loading || Boolean(error)} className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => openEditor(section)}><Plus className="h-4 w-4 mr-2" />{section === 'saidas' ? 'Nova saída' : section === 'locais' ? 'Novo local' : 'Novo território'}</Button>}</div>
    </div>
    {!canEdit && <p className="text-sm text-gray-500">Você tem acesso de leitura. A edição depende da permissão de Serviço de Campo na gestão de acessos.</p>}
    <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-xl" role="tablist" aria-label="Seções do Serviço de Campo">{Object.entries(sections).map(([key, label]) => <button type="button" key={key} id={`campo-tab-${key}`} role="tab" aria-selected={section === key} aria-controls={`campo-panel-${key}`} onClick={() => { setSection(key); setFeedback(''); }} className={`h-10 rounded-lg text-sm font-medium focus-visible:ring-2 focus-visible:ring-purple-500 ${section === key ? 'bg-white shadow-sm text-purple-700' : 'text-gray-600 hover:bg-white/50'}`}>{label}</button>)}</div>
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}<button className="ml-3 underline" onClick={() => refresh()}>Tentar novamente</button></div>}
    <StatusToast message={feedback} type="success" onClose={() => setFeedback('')} />
    {section === 'territorios' && !loading && !error && <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"><h3 className="font-semibold text-gray-900">Mapa geral da congregação</h3><FieldMapAttachment map={data.mapas.find(map => map.chave === 'geral')} canEdit={canEdit} onSaved={() => refresh()} /></div>}
    <section id={`campo-panel-${section}`} role="tabpanel" aria-labelledby={`campo-tab-${section}`} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={designationListHeaderClass}><h3 className="font-semibold text-gray-900">{section === 'saidas' ? 'Programação de campo' : section === 'territorios' ? 'Cadastro e registro de territórios' : sections[section]}</h3>
        {section === 'territorios' && canEdit && !loading && !error && <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" onClick={() => openEditor('territorios')}>Cadastrar território</Button><FieldMapBatchImport territories={data.territorios} onSaved={() => refresh(undefined, true)} /></div>}
        {section === 'saidas' ? <div className="flex flex-wrap gap-2 min-w-0"><DesignationPeriodFilters years={data.saidas.map(row => row.data.slice(0, 4))} onClear={() => setGroupFilter('')} hasAdditionalFilters={Boolean(groupFilter)} /><select className={`${controlClass} sm:w-44`} aria-label="Filtrar saídas por grupo" value={groupFilter} onChange={e => setGroupFilter(e.target.value)}><option value="">Todos os grupos</option>{data.grupos.map(row => <option key={row.id} value={row.id}>{row.nome}</option>)}</select></div>
          : <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />Mostrar inativos</label>}
      </div>
      {loading ? <div role="status" aria-label="Carregando Serviço de Campo" className="p-10"><Loader2 className="mx-auto h-7 w-7 animate-spin text-purple-600" /></div> : error ? <p className="p-6 text-sm text-gray-500">Atualize os dados para continuar.</p> : <div className="divide-y divide-gray-100">
        {section === 'saidas' && (agenda.length ? agenda.map(row => <article key={row.id} className="p-4 flex flex-col sm:flex-row gap-3 sm:items-start"><div className="min-w-0 flex-1 space-y-1">
          <div className="font-semibold text-gray-900">{displayDate(row.data)} · {row.horario}</div><div className="text-sm text-gray-700">{name('publicadores', row.dirigente_publicador_id) || 'Dirigente a definir'}</div>
          <div className="text-sm text-gray-500 break-words">{groupsLabel(row.grupos)} · {name('locais', row.local_id) || 'Local a definir'}</div><div className="text-sm text-purple-700">{FIELD_MODES[row.modalidade]}{row.territorios.length ? `: ${territoryLabel(row.territorios)}` : ''}</div>
          {row.observacoes && <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{row.observacoes}</p>}</div><div className="flex flex-wrap gap-2">{buttons('saidas', row)}<DesignationRowActions label={`Saída de ${displayDate(row.data)} ${row.horario}`} message={buildFieldOutingMessage(row, data)} filename={`campo-${row.data}-${row.id}`} canPdf={isAllowed(permissions, 'designacoes_pdf', 'actions')} onDelete={canEdit ? () => setPendingDelete(row) : undefined} /></div></article>) : <p className="p-10 text-center text-sm text-gray-500">Nenhuma saída neste período. Escolha um publicador e um local para começar a programação.</p>)}
        {section !== 'saidas' && (data[section].filter(row => showInactive || row.ativo).length ? data[section].filter(row => showInactive || row.ativo).map(row => <article key={row.id} className="p-4 flex flex-col sm:flex-row gap-3"><div className="min-w-0 flex-1 space-y-1">
          <div className="font-semibold text-gray-900">{row.nome || `Território ${row.numero}`}{!row.ativo && <span className="ml-2 text-xs text-gray-500">Inativo</span>}</div>
          {section === 'locais' && <><p className="text-sm text-gray-600 break-words">{row.endereco || 'Endereço a cadastrar'}</p><p className="text-sm text-gray-500">{groupsLabel(row.grupos)}</p>{row.mapa_url && /^https?:\/\//i.test(row.mapa_url) && <a href={row.mapa_url} target="_blank" rel="noopener noreferrer" className="inline-flex gap-1 items-center text-sm text-purple-700 underline"><MapPin className="w-4 h-4" />Abrir mapa</a>}{row.observacoes && <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{row.observacoes}</p>}</>}
          {section === 'territorios' && <><p className="text-sm text-gray-600 break-words">{row.descricao || 'Sem descrição'}{row.fim_semana ? ' · Preferência: fim de semana' : ''}</p><p className="text-xs text-gray-500">Última conclusão: {displayDate(row.ultima_conclusao)}</p><p className="text-sm text-purple-700">{openAssignments.some(item => item.territorio_id === row.id) ? `Designado para ${name('publicadores', openAssignments.find(item => item.territorio_id === row.id).publicador_id)}` : 'Disponível'}</p></>}
          </div><div className="flex flex-wrap gap-2 items-start">{section === 'territorios' && <Button type="button" variant="outline" size="sm" onClick={() => setMapTerritoryId(row.id)}>Mapa e referências</Button>}{buttons(section, row)}{section === 'territorios' && canEdit && row.ativo && !openAssignments.some(item => item.territorio_id === row.id) && <Button variant="outline" size="sm" onClick={() => openEditor('designacoes', { territorio_id: row.id })}>Designar</Button>}</div></article>) : <p className="p-10 text-center text-sm text-gray-500">Nenhum cadastro encontrado.</p>)}
      </div>}
    </section>
    {section === 'territorios' && !loading && !error && <div className="bg-white rounded-xl border border-gray-200 overflow-hidden"><div className={designationListHeaderClass}><div><h3 className="font-semibold text-gray-900">Histórico de designações</h3><p className="text-xs text-gray-500 mt-1">Ano de serviço: setembro a agosto. Saídas programadas não registram conclusão.</p></div><label className="text-sm text-gray-600">Ano de serviço<select className={`${controlClass} mt-1`} value={serviceYear} onChange={e => setServiceYear(e.target.value)}><option value="">Todos</option>{serviceYears.map(value => <option key={value}>{value}</option>)}</select></label></div>
      <div className="divide-y divide-gray-100">{history.length ? history.map(row => <article key={row.id} className="p-4 flex flex-col sm:flex-row gap-3"><div className="flex-1 min-w-0"><p className="font-medium text-gray-900">Território {data.territorios.find(item => item.id === row.territorio_id)?.numero} · {name('publicadores', row.publicador_id)}</p><p className="text-sm text-gray-500 mt-1">Designado: {displayDate(row.data_designacao)} · {row.data_conclusao ? `Concluído: ${displayDate(row.data_conclusao)}` : 'Conclusão pendente'}</p>{row.observacoes && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap break-words">{row.observacoes}</p>}</div>{!row.data_conclusao && canEdit && <Button variant="outline" size="sm" onClick={() => openEditor('complete', row)}><CheckCircle2 className="h-4 w-4 mr-2" />Registrar conclusão</Button>}</article>) : <p className="p-8 text-sm text-center text-gray-500">Nenhuma designação neste ano de serviço.</p>}</div></div>}
    <TerritoryMapDetails territory={data.territorios.find(row => row.id === mapTerritoryId)} maps={data.mapas} canEdit={canEdit} onEdit={row => openEditor('territorios', row)} onShare={openShare} onSaved={() => refresh(undefined, true)} onClose={() => setMapTerritoryId(null)} />
    {pendingDelete && <ConfirmationDialog destructive title="Excluir saída de campo?" confirmLabel="Excluir" description={`A saída de ${displayDate(pendingDelete.data)} às ${pendingDelete.horario} será excluída. Os registros de designação e conclusão dos territórios serão preservados.`} onConfirm={remove} onCancel={() => setPendingDelete(null)} />}
    <Dialog open={shareMessage !== null} onOpenChange={open => { if (!open) setShareMessage(null); }}><DialogContent className="w-[calc(100%-2rem)] max-w-xl max-h-[90dvh] overflow-y-auto bg-white text-gray-900"><DialogHeader><DialogTitle>Compartilhar serviço de campo</DialogTitle><DialogDescription>Confira a mensagem e escolha como compartilhar. Os links do Google Maps podem ser abertos pelos publicadores.</DialogDescription></DialogHeader><Field label="Mensagem"><textarea className={controlClass} rows={12} value={shareMessage || ''} onChange={e => setShareMessage(e.target.value)} /></Field>{shareFeedback && <p role="status" className="text-sm text-gray-600">{shareFeedback}</p>}<DialogFooter className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={copyMessage}>Copiar mensagem</Button><a className="inline-flex items-center justify-center rounded-md bg-purple-600 hover:bg-purple-700 px-4 py-2 text-sm font-medium text-white" href={fieldWhatsAppUrl(shareMessage || '')} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(editor)} onOpenChange={open => { if (!open && !saving.current) setEditor(null); }}><DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto bg-white text-gray-900" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{editor?.entity === 'complete' ? 'Registrar conclusão' : `${editor?.id ? 'Editar' : 'Cadastrar'} ${titles[editor?.entity] || ''}`}</DialogTitle><DialogDescription>{editor?.entity === 'saidas' ? 'Escolha o dirigente, os grupos e o local da consideração. Sem grupos selecionados, a saída é da congregação.' : editor?.entity === 'designacoes' ? 'Registre a entrega do território ao responsável. A conclusão será registrada separadamente.' : 'Preencha os dados abaixo. Desative cadastros para preservar o histórico.'}</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
        {editor?.entity === 'saidas' && <><div className="grid sm:grid-cols-2 gap-4"><Field label="Data">{input('data', 'date', true)}</Field><Field label="Horário"><div className="space-y-2"><label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={form.horario === 'Pós reunião'} onChange={e => update('horario', e.target.checked ? 'Pós reunião' : '08:30')} />Pós reunião</label>{form.horario !== 'Pós reunião' && input('horario', 'time', true)}</div></Field><PublisherCombobox label="Dirigente" value={form.dirigente_publicador_id} onChange={value => update('dirigente_publicador_id', value)} publishers={data.publicadores.map(row => ({ id: row.id, nome_completo: row.nome }))} placeholder="A definir" disabled={busy} /><Field label="Local da consideração">{select('local_id', 'locais', 'A definir', setLocation)}</Field></div><Choices label="Grupos (nenhum = congregação)" options={options('grupos')} selected={form.grupos || []} onChange={value => update('grupos', value)} /><Field label="Modalidade"><select className={controlClass} value={form.modalidade} onChange={e => update('modalidade', e.target.value)}>{Object.entries(FIELD_MODES).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></Field>{form.modalidade === 'territorio' && <Choices label="Territórios planejados (opcional)" options={options('territorios')} selected={form.territorios || []} onChange={value => update('territorios', value)} />}{!editor.id && <Field label="Repetir semanalmente"><select className={controlClass} value={form.semanas} onChange={e => update('semanas', Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i ? `${i + 1} saídas, uma por semana` : 'Somente esta saída'}</option>)}</select></Field>}{notes('observacoes', 'Observações')}</>}
        {editor?.entity === 'saidas' && form.modalidade === 'territorio' && <div className="rounded-lg border border-purple-200 p-3 space-y-2">
          <label className="flex items-start gap-2 text-sm font-medium"><input type="checkbox" checked={registerHandover} onChange={event => setRegisterHandover(event.target.checked)} />Registrar entrega dos territórios ao dirigente ao salvar</label>
          <p className="text-xs text-gray-500">A entrega usa a data da saída (a primeira, se houver repetição). Escolha um dirigente e os territórios. Ao editar, as entregas pendentes desta saída acompanham as alterações, mesmo sem marcar esta opção novamente. Conclusões registradas são preservadas. Excluir a saída preserva as entregas.</p>
        </div>}
        {editor?.entity === 'locais' && <><Field label="Nome do local">{input('nome', 'text', true, { maxLength: 120 })}</Field><Field label="Endereço">{input('endereco', 'text', false, { maxLength: 2000 })}</Field><Field label="Link do mapa (opcional)">{input('mapa_url', 'url', false, { maxLength: 1000 })}</Field><Choices label="Grupos habituais" options={options('grupos')} selected={form.grupos || []} onChange={value => update('grupos', value)} />{notes('observacoes', 'Observações')}</>}
        {editor?.entity === 'territorios' && <><Field label="Número do território">{input('numero', 'number', true, { min: 1, max: 2147483647, step: 1 })}</Field>{notes('descricao', 'Descrição / bairro')}<Field label="Link do Google Maps do território (opcional)">{input('mapa_url', 'url', false, { maxLength: 1000, placeholder: 'Cole o link do território ou ponto de referência' })}</Field>{notes('referencias', 'Referências das quadras e orientações')}<Field label="Mapa do território (PDF, até 10 MB)"><input type="file" accept=".pdf,application/pdf" className={controlClass} onChange={e => setMapFile(e.target.files?.[0] || null)} /></Field>{editor.id && <FieldMapLinks territoryId={editor.id} map={data.mapas.find(map => map.territorio_id === editor.id)} />}<label className="flex gap-2 text-sm items-center"><input type="checkbox" checked={form.fim_semana || false} onChange={e => update('fim_semana', e.target.checked)} />Preferencialmente aos fins de semana</label></>}
        {editor?.entity === 'designacoes' && <><div className="grid sm:grid-cols-2 gap-4"><Field label="Território">{select('territorio_id', 'territorios', 'Selecione o território')}</Field><Field label="Responsável">{select('publicador_id', 'publicadores', 'Selecione um publicador')}</Field><Field label="Data da designação">{input('data_designacao', 'date', true)}</Field><Field label="Data da conclusão (opcional)">{input('data_conclusao', 'date', false, { min: form.data_designacao })}</Field></div>{notes('observacoes', 'Observações')}<FieldMapLinks territoryId={form.territorio_id} map={data.mapas.find(map => map.territorio_id === Number(form.territorio_id))} /></>}
        {editor?.entity === 'complete' && <Field label="Data da conclusão">{input('data_conclusao', 'date', true, { min: data.designacoes.find(row => row.id === editor.id)?.data_designacao })}</Field>}
        {['locais', 'territorios'].includes(editor?.entity) && <label className="flex gap-2 text-sm items-center"><input type="checkbox" checked={form.ativo ?? true} onChange={e => update('ativo', e.target.checked)} />Cadastro ativo</label>}
      </fieldset>{formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}<DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setEditor(null)}>Cancelar</Button><Button type="submit" disabled={!canEdit || busy} className="bg-purple-600 hover:bg-purple-700 text-white">{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{busy ? 'Salvando…' : 'Salvar'}</Button></DialogFooter></form>
    </DialogContent></Dialog>
  </div>;
}
