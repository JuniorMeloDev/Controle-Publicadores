'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [formPerms, setFormPerms] = useState(normalizePermissions(null));
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

  const filteredPublicadores = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return publicadores;
    return publicadores.filter(p => {
      const nome = (p.nome_chamado || p.nome_completo || '').toLowerCase();
      return nome.includes(term);
    });
  }, [publicadores, searchTerm]);

  const accessCount = useMemo(() => {
    const pages = Object.values(formPerms.pages || {}).filter(Boolean).length;
    const actions = Object.values(formPerms.actions || {}).filter(Boolean).length;
    return { pages, actions };
  }, [formPerms]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchTerm, filteredPublicadores.length]);

  const fetchLogs = async () => {
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
  };

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab]);

  const handleSelectUser = (id) => {
    const strId = String(id);
    setSelectedIds(prev => {
      if (prev.includes(strId)) return prev;
      return [...prev, strId];
    });
    if (selectedIds.length === 0) {
      const stored = acessosMap[strId] || null;
      setFormPerms(normalizePermissions(stored));
    }
    setSearchTerm('');
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
    setFormPerms(normalizePermissions(null));
  };

  const handleKeyDown = (e) => {
    if (filteredPublicadores.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, filteredPublicadores.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredPublicadores[activeIndex];
      if (target) handleSelectUser(target.id);
    } else if (e.key === 'Escape') {
      setSearchTerm('');
    }
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
      const results = await Promise.all(selectedIds.map(async (id) => {
        const res = await fetch('/api/admin/gestao-acessos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicadorId: id, permissoes: formPerms })
        });
        if (!res.ok) throw new Error('Erro ao salvar permissões.');
        return id;
      }));

      setAcessosMap(prev => {
        const next = { ...prev };
        results.forEach(id => { next[id] = formPerms; });
        return next;
      });
      setSuccess(`Permissões salvas para ${results.length} publicador(es)!`);
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
      <div className="p-6 max-w-5xl mx-auto w-full">
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
            {error || success}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
            <TabsTrigger value="acessos">Gestão de Acessos</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="acessos">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Selecionar publicador</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none bg-white text-gray-700"
              placeholder="Digite o nome..."
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-xs text-gray-500 hover:underline"
              >
                Limpar busca
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-xs text-gray-500 hover:underline"
              >
                Limpar seleção
              </button>
            </div>
            {searchTerm.trim().length > 0 && (
              <div className="mt-2 max-h-64 overflow-auto rounded-md border border-gray-200 bg-white">
                {filteredPublicadores.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400">Nenhum publicador encontrado.</div>
                )}
                {filteredPublicadores.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectUser(p.id)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      selectedIds.includes(String(p.id))
                        ? 'bg-purple-50 text-purple-700 font-medium'
                        : (idx === activeIndex ? 'bg-gray-50 text-gray-900' : 'hover:bg-gray-50 text-gray-700')
                    }`}
                  >
                    {p.nome_chamado ? p.nome_chamado : p.nome_completo}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            {selectedUsers.length > 0 ? (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-sm text-gray-700">
                    Configurando acesso para: <span className="font-semibold">{selectedUsers.length} publicador(es)</span>
                  </p>
                  <div className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-1 rounded-full">
                    {accessCount.pages} telas · {accessCount.actions} funções
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedUsers.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedIds(prev => prev.filter(id => id !== String(p.id)))}
                      className="px-2 py-1 text-xs rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                      title="Remover"
                    >
                      {p.nome_chamado ? p.nome_chamado : p.nome_completo} ×
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Selecione um publicador para editar as permissões.</p>
              </div>
            )}
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Telas</h3>
                <div className="flex items-center gap-2">
                  <button onClick={handleSelectAll} className="text-xs text-purple-700 hover:underline">Marcar tudo</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={handleClearAll} className="text-xs text-gray-500 hover:underline">Limpar</button>
                </div>
              </div>
              <div className="space-y-2">
                {PAGE_PERMISSIONS.map(item => (
                  <label key={item.key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      checked={!!formPerms.pages?.[item.key]}
                      onChange={() => handleToggle('pages', item.key)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2">Funções</h3>
              <div className="space-y-2">
                {ACTION_PERMISSIONS.map(item => (
                  <label key={item.key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      checked={!!formPerms.actions?.[item.key]}
                      onChange={() => handleToggle('actions', item.key)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Permissões
            </Button>
          </div>
        )}
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

