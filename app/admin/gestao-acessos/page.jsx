'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PAGE_PERMISSIONS, ACTION_PERMISSIONS, buildAllPermissions, normalizePermissions } from '@/app/lib/access-control';
import { Button } from '@/app/components/ui/button';
import { Loader2, ShieldCheck, Save } from 'lucide-react';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import { usePermissions } from '@/app/components/PermissionsContext';
import { isAllowed } from '@/app/lib/access-control';

function GestaoAcessosContent() {
  const { permissions, isLoading: permsLoading } = usePermissions();
  const canViewLogs = isAllowed(permissions, 'logs_visualizar', 'actions');

  const [publicadores, setPublicadores] = useState([]);
  const [acessosMap, setAcessosMap] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [privilegeFilter, setPrivilegeFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('');
  const [mode, setMode] = useState('add');
  const [formPerms, setFormPerms] = useState(normalizePermissions(null));
  const [superAdmins, setSuperAdmins] = useState({});
  const [superAdmin, setSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('acessos');

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logAction, setLogAction] = useState('');
  const [logEntity, setLogEntity] = useState('');
  const [logUser, setLogUser] = useState('');
  const [logFrom, setLogFrom] = useState('');
  const [logTo, setLogTo] = useState('');

  const LOG_ACTIONS = [
    { value: '', label: 'Todas as ações' },
    { value: 'acesso_atualizado', label: 'Acesso atualizado' },
    { value: 'designacoes_salvas', label: 'Designações salvas' },
    { value: 'rtf_importado', label: 'RTF importado' },
    { value: 'emails_designacoes_enviados', label: 'E-mails enviados' },
    { value: 'configuracoes_dias_salvos', label: 'Configurações (dias)' },
    { value: 'configuracoes_evento_criado', label: 'Configurações (evento criado)' },
    { value: 'configuracoes_evento_excluido', label: 'Configurações (evento excluído)' },
    { value: 'publicador_criado', label: 'Publicador criado' },
    { value: 'publicador_editado', label: 'Publicador editado' },
    { value: 'discurso_criado', label: 'Discurso criado' },
    { value: 'discurso_atualizado', label: 'Discurso atualizado' },
    { value: 'discurso_excluido', label: 'Discurso excluído' },
    { value: 'privilegio_tipo_criado', label: 'Privilégio tipo criado' },
    { value: 'privilegio_tipo_atualizado', label: 'Privilégio tipo atualizado' },
    { value: 'privilegio_tipo_excluido', label: 'Privilégio tipo excluído' },
    { value: 'privilegios_atribuidos', label: 'Privilégios atribuídos' },
    { value: 'limpeza_criada', label: 'Limpeza criada' },
    { value: 'limpeza_atualizada', label: 'Limpeza atualizada' },
    { value: 'limpeza_excluida', label: 'Limpeza excluída' },
  ];

  const LOG_ENTITIES = [
    { value: '', label: 'Todas as entidades' },
    { value: 'publicador', label: 'Publicador' },
    { value: 'reuniao', label: 'Reunião' },
    { value: 'designacoes', label: 'Designações' },
    { value: 'configuracoes', label: 'Configurações' },
    { value: 'evento', label: 'Evento' },
    { value: 'discurso', label: 'Discurso' },
    { value: 'privilegio_tipo', label: 'Privilégio (tipo)' },
    { value: 'limpeza', label: 'Limpeza' },
  ];

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/gestao-acessos');
        if (!res.ok) throw new Error('Acesso negado ou erro ao carregar.');
        const data = await res.json();

        setPublicadores(data.publicadores || []);
        const map = {};
        (data.acessos || []).forEach(a => { map[a.publicador_id] = a.permissoes; });
        setAcessosMap(map);
        setSuperAdmins(Object.fromEntries((data.acessos || []).map(access => [String(access.publicador_id), access.super_admin === true])));
      } catch (err) {
        setError(err.message || 'Erro ao carregar dados.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const selectedUsers = useMemo(
    () => publicadores.filter(p => selectedIds.includes(String(p.id))),
    [publicadores, selectedIds]
  );

  const privilegeOptions = [
    { key: 'anciao', label: 'Ancião' },
    { key: 'servo_ministerial', label: 'Servo ministerial' },
  ];
  const assignmentOptions = [
    { key: 'pioneiro_regular', label: 'Pioneiro regular' },
    { key: 'pioneiro_especial', label: 'Pioneiro especial' },
    { key: 'missionario', label: 'Missionário em campo' },
  ];
  const filteredPublicadores = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase('pt-BR');
    return publicadores.filter(p =>
      `${p.nome_completo || ''} ${p.nome_chamado || ''}`.toLocaleLowerCase('pt-BR').includes(term)
      && (!privilegeFilter || (privilegeFilter === 'none' ? !p.privilegios?.length : p.privilegios?.includes(privilegeFilter)))
      && (!assignmentFilter || p.designacoes?.includes(assignmentFilter))
    );
  }, [publicadores, searchTerm, privilegeFilter, assignmentFilter]);

  const accessCount = useMemo(() => {
    const pages = Object.values(formPerms.pages || {}).filter(Boolean).length;
    const actions = Object.values(formPerms.actions || {}).filter(Boolean).length;
    return { pages, actions };
  }, [formPerms]);

  const fetchLogs = useCallback(async () => {
    if (permsLoading || !canViewLogs) return;
    setLogsLoading(true);
    try {
      const params = new URLSearchParams();
      if (logAction) params.set('action', logAction);
      if (logEntity) params.set('entity', logEntity);
      if (logUser) params.set('user', logUser);
      if (logFrom) params.set('from', logFrom);
      if (logTo) params.set('to', logTo);
      params.set('limit', '200');

      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  }, [permsLoading, canViewLogs, logAction, logEntity, logUser, logFrom, logTo]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  const changeSelection = (ids) => {
    setSelectedIds(ids);
    setSuccess(''); setError('');
    setSuperAdmin(ids.length === 1 && superAdmins[ids[0]] === true);
    if (!ids.length) setFormPerms(normalizePermissions(null));
    else if (mode === 'replace' && ids.length === 1 && selectedIds.length <= 1) setFormPerms(normalizePermissions(acessosMap[ids[0]]));
  };
  const handleSelectUser = id => {
    const key = String(id);
    changeSelection(selectedIds.includes(key) ? selectedIds.filter(value => value !== key) : [...selectedIds, key]);
  };
  const handleClearSelection = () => changeSelection([]);
  const selectFiltered = () => changeSelection([...new Set([...selectedIds, ...filteredPublicadores.map(p => String(p.id))])]);
  const changeMode = next => {
    setMode(next);
    setFormPerms(next === 'replace' && selectedIds.length === 1 ? normalizePermissions(acessosMap[selectedIds[0]]) : normalizePermissions(null));
  };

  const handleToggle = (group, key) => {
    setFormPerms(prev => ({
      ...prev,
      [group]: { ...prev[group], [key]: !prev[group]?.[key] }
    }));
  };

  const handleSelectAll = () => {
    setFormPerms(buildAllPermissions());
  };

  const handleClearAll = () => {
    setFormPerms(normalizePermissions(null));
  };

  const handleSave = async () => {
    if (selectedIds.length === 0) return;
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const completed = [], failed = [];
      for (const id of selectedIds) {
        try {
          const res = await fetch('/api/admin/gestao-acessos', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicadorId: id, permissoes: formPerms, mode, ...(selectedIds.length === 1 ? { superAdmin } : {}) })
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.message || 'Erro ao salvar.');
          completed.push(id);
          setAcessosMap(prev => ({ ...prev, [id]: result.permissions }));
          if (selectedIds.length === 1) setSuperAdmins(prev => ({ ...prev, [id]: superAdmin }));
        } catch (err) {
          const person = publicadores.find(p => String(p.id) === id);
          failed.push(`${person?.nome_completo || id}: ${err.message}`);
        }
      }
      if (completed.length) setSuccess(`Acessos atualizados para ${completed.length} publicador(es).`);
      if (failed.length) setError(`Não foi possível atualizar: ${failed.join('; ')}`);
      window.dispatchEvent(new Event('session:changed'));
    } catch (err) {
      setError(err.message || 'Erro ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-purple-600" />
      </div>
    );
  }

  if (error && publicadores.length === 0) {
    return (
      <div className="max-w-xl mx-auto mt-10 bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Gestão de Acessos</h2>
        <p className="text-sm text-gray-600 mt-2">{error}</p>
      </div>
    );
  }

  return (
      <div className="w-full min-w-0 p-4 sm:p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestão de Acessos</h1>
            <p className="text-sm text-gray-500">Defina quais telas e funções cada publicador pode acessar.</p>
          </div>
        </div>

        {(error || success) && (
          <div className={`mb-4 p-3 rounded-md text-sm ${error ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
            {error}{error && success && <br />}{success}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <p className="mb-5 text-sm text-gray-600">Todos têm acesso aos próprios dados, designações e S-21. Privilégios congregacionais não liberam funções administrativas automaticamente.</p>
          <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
            <TabsTrigger value="acessos">Gestão de Acessos</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="acessos">
            <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
              <section className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <h2 className="mb-3 font-semibold text-gray-900">1. Selecione os publicadores</h2>
                <fieldset disabled={isSaving} className="space-y-3">
                  <label className="block text-sm text-gray-700">Buscar por nome<input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Digite o nome..." className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900" /></label>
                  <label className="block text-sm text-gray-700">Privilégio<select value={privilegeFilter} onChange={e => setPrivilegeFilter(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900"><option value="">Todos os privilégios</option><option value="none">Sem privilégios</option>{privilegeOptions.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
                  <label className="block text-sm text-gray-700">Designação especial<select value={assignmentFilter} onChange={e => setAssignmentFilter(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900"><option value="">Todas as designações</option>{assignmentOptions.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
                  <p className="text-xs text-gray-500">Os filtros combinados mostram quem atende aos dois critérios.</p>
                  <div className="flex flex-wrap gap-3 text-xs"><button type="button" onClick={selectFiltered} disabled={!filteredPublicadores.length} className="text-purple-700 hover:underline">Selecionar resultados ({filteredPublicadores.length})</button><button type="button" onClick={handleClearSelection} className="text-gray-600 hover:underline">Limpar seleção</button><button type="button" onClick={() => { setSearchTerm(''); setPrivilegeFilter(''); setAssignmentFilter(''); }} className="text-gray-600 hover:underline">Limpar filtros</button></div>
                  <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-gray-200 bg-white">
                    {!filteredPublicadores.length && <p className="p-4 text-sm text-gray-500">Nenhum publicador encontrado.</p>}
                    {filteredPublicadores.map(p => <label key={p.id} className={`flex cursor-pointer items-start gap-3 border-b border-gray-100 p-3 last:border-0 ${selectedIds.includes(String(p.id)) ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={selectedIds.includes(String(p.id))} onChange={() => handleSelectUser(p.id)} className="mt-1 accent-purple-600" />
                      <span className="min-w-0 text-sm text-gray-900"><span className="block break-words font-medium">{p.nome_completo || p.nome_chamado}</span><span className="block text-xs text-gray-500">{[...privilegeOptions.filter(item => p.privilegios?.includes(item.key)), ...assignmentOptions.filter(item => p.designacoes?.includes(item.key))].map(item => item.label).join(' · ') || 'Publicador'}{superAdmins[String(p.id)] ? ' · Super admin' : ''}</span></span>
                    </label>)}
                  </div>
                </fieldset>
              </section>
              <section className="min-w-0 space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-gray-900">2. Defina os acessos · {selectedIds.length} selecionado(s)</h2><span className="text-xs text-purple-700">{accessCount.pages} telas · {accessCount.actions} funções</span></div>
                  <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-y-auto">{selectedUsers.map(p => <button disabled={isSaving} type="button" key={p.id} onClick={() => handleSelectUser(p.id)} aria-label={`Remover ${p.nome_completo} da seleção`} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700">{p.nome_chamado || p.nome_completo} ×</button>)}</div>
                  {!selectedIds.length && <p className="mt-3 text-sm text-gray-500">Selecione pessoas individualmente ou use os filtros e &quot;Selecionar resultados&quot;.</p>}
                </div>
                <fieldset disabled={isSaving || !selectedIds.length} className="space-y-4 disabled:opacity-60">
                  <label className="block text-sm font-medium text-gray-700">Como aplicar<select value={mode} onChange={e => changeMode(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900"><option value="add">Adicionar as permissões marcadas</option><option value="remove">Remover as permissões marcadas</option><option value="replace">Substituir todas as permissões</option></select></label>
                  <p className="text-sm text-gray-500">{mode === 'add' ? 'Mantém os acessos existentes e libera os itens marcados.' : mode === 'remove' ? 'Retira somente os itens marcados e mantém os demais acessos.' : 'Cada selecionado ficará apenas com os itens marcados. Os acessos desmarcados serão removidos.'}</p>
                  {selectedIds.length === 1 ? <label className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900"><input type="checkbox" checked={superAdmin} onChange={e => setSuperAdmin(e.target.checked)} className="mt-1 accent-purple-600" /><span><strong>Super admin</strong><br />Acesso completo, incluindo gestão de permissões.</span></label> : <p className="text-xs text-gray-500">O perfil super admin é alterado individualmente. A aplicação em lote preserva esse perfil.</p>}
                  <div className="flex flex-wrap justify-end gap-4 text-sm"><button type="button" onClick={handleSelectAll} className="text-purple-700 hover:underline">Marcar todas as permissões</button><button type="button" onClick={handleClearAll} className="text-gray-600 hover:underline">Desmarcar todas</button></div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {[['pages', 'Telas', PAGE_PERMISSIONS], ['actions', 'Funções', ACTION_PERMISSIONS]].map(([group, title, items]) => <details key={group} open className="min-w-0 rounded-xl border border-gray-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-gray-900">{title}</summary><div className="mt-3 space-y-1">{items.map(item => <label key={item.key} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 text-sm text-gray-700 hover:bg-gray-50"><input type="checkbox" className="mt-1 accent-purple-600" checked={!!formPerms[group]?.[item.key]} onChange={() => handleToggle(group, item.key)} /><span>{item.label}</span></label>)}</div></details>)}
                  </div>
                </fieldset>
                <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-sm text-gray-600">Aplicar para <strong>{selectedIds.length}</strong> publicador(es)</p>
                  <Button onClick={handleSave} disabled={isSaving || !selectedIds.length} className="gap-2 bg-purple-600 hover:bg-purple-700">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{isSaving ? 'Aplicando...' : 'Aplicar acessos'}</Button>
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            {permsLoading ? (
              <div className="p-4 text-center text-sm text-gray-500">Carregando permissões...</div>
            ) : !canViewLogs ? (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-md p-3">
                Você não tem permissão para visualizar logs.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Usuário</label>
                    <select
                      value={logUser}
                      onChange={(e) => setLogUser(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-700"
                    >
                      <option value="">Todos</option>
                      {publicadores.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nome_chamado ? p.nome_chamado : p.nome_completo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Ação</label>
                    <select
                      value={logAction}
                      onChange={(e) => setLogAction(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-700"
                    >
                      {LOG_ACTIONS.map(a => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Entidade</label>
                    <select
                      value={logEntity}
                      onChange={(e) => setLogEntity(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-700"
                    >
                      {LOG_ENTITIES.map(a => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">De</label>
                    <input
                      type="date"
                      value={logFrom}
                      onChange={(e) => setLogFrom(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Até</label>
                    <input
                      type="date"
                      value={logTo}
                      onChange={(e) => setLogTo(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-700"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={() => { setLogAction(''); setLogEntity(''); setLogUser(''); setLogFrom(''); setLogTo(''); }}>
                    Limpar filtros
                  </Button>
                  <Button onClick={fetchLogs} className="bg-purple-600 hover:bg-purple-700 text-white">
                    Buscar
                  </Button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-6 bg-gray-50 text-xs font-semibold text-gray-600 px-3 py-2">
                    <div>Data</div>
                    <div>Usuário</div>
                    <div>Ação</div>
                    <div>Entidade</div>
                    <div>ID</div>
                    <div>Detalhes</div>
                  </div>
                  {logsLoading ? (
                    <div className="p-4 text-center text-sm text-gray-500">Carregando...</div>
                  ) : logs.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">Nenhum log encontrado.</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {logs.map(row => (
                        <div key={row.id} className="grid grid-cols-6 px-3 py-2 text-xs text-gray-700">
                          <div>{new Date(row.created_at).toLocaleString('pt-BR')}</div>
                          <div>{row.nome_chamado || row.nome_completo || '-'}</div>
                          <div>{row.action}</div>
                          <div>{row.entity || '-'}</div>
                          <div>{row.entity_id || '-'}</div>
                          <div className="truncate" title={row.details ? JSON.stringify(row.details) : ''}>
                            {row.details ? JSON.stringify(row.details) : '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      </div>
  );
}

export default function GestaoAcessosPage() {
  return (
    <DashboardLayout>
      <GestaoAcessosContent />
    </DashboardLayout>
  );
}
