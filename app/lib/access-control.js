export const PAGE_PERMISSIONS = [
  { key: 'dashboard', label: 'Visão Geral', path: '/admin/dashboard' },
  { key: 'publicadores', label: 'Publicadores', path: '/admin/gerenciar' },
  { key: 'designacoes', label: 'Designações', path: '/admin/designacoes' },
  { key: 'reunioes', label: 'Reuniões', path: '/admin/reunioes' },
  { key: 'relatorios', label: 'Relatórios', path: '/admin/relatorios' },
  { key: 'configuracoes', label: 'Configurações', path: '/admin/configuracoes' },
];

export const ACTION_PERMISSIONS = [
  { key: 's21_visualizar', label: 'Visualizar S-21 de outros publicadores' },
  { key: 's21_exportar', label: 'Exportar PDF / imprimir S-21 de outros publicadores' },
  { key: 'designacoes_importar', label: 'Importar RTF (Designações)' },
  { key: 'designacoes_salvar', label: 'Salvar Designações' },
  { key: 'designacoes_pdf', label: 'Gerar PDF (Designações)' },
  { key: 'designacoes_email', label: 'Enviar E-mails (Designações)' },
  { key: 'discursos_publicos_editar', label: 'Criar/Editar Discursos Públicos' },
  { key: 'privilegios_mecanicos_editar', label: 'Editar Privilégios Mecânicos' },
  { key: 'limpeza_semanal_editar', label: 'Editar Limpeza Semanal' },
  { key: 'logs_visualizar', label: 'Visualizar Logs do Sistema' },
  { key: 'publicadores_editar', label: 'Criar/Editar Publicadores' },
  { key: 'publicadores_excluir', label: 'Excluir Publicadores' },
  { key: 'relatorios_editar', label: 'Editar Relatórios' },
  { key: 'reunioes_editar', label: 'Editar Reuniões e Assistência' },
  { key: 'backup_exportar', label: 'Exportar Backup Completo' },
  { key: 'configuracoes_editar', label: 'Editar Configurações' },
  { key: 'relatorios_gerar', label: 'Gerar Relatórios' },
];

export const buildAllPermissions = () => ({
  pages: PAGE_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.key]: true }), {}),
  actions: ACTION_PERMISSIONS.reduce((acc, a) => ({ ...acc, [a.key]: true }), {}),
});

export const normalizePermissions = (input) => {
  if (!input || typeof input !== 'object') {
    return { pages: {}, actions: {} };
  }
  const pages = {};
  const actions = {};

  PAGE_PERMISSIONS.forEach(({ key }) => {
    // Pages: ausente = false (acesso a páginas deve ser explicitamente concedido)
    pages[key] = input.pages?.[key] === true;
  });
  ACTION_PERMISSIONS.forEach(({ key }) => {
    // Actions: se a chave NÃO existe no registro salvo, assume true.
    // Isso garante compatibilidade retroativa: novas actions adicionadas ao sistema
    // não bloqueiam usuários com registros antigos que não tinham essa chave.
    actions[key] = input.actions?.[key] === true;
  });

  return { pages, actions };
};

export const getPageKeyForPath = (pathname) => {
  if (!pathname) return null;
  if (pathname.startsWith('/admin/editar/')) return 'publicadores';
  const match = PAGE_PERMISSIONS.find(p => pathname === p.path || pathname.startsWith(`${p.path}/`));
  return match ? match.key : null;
};

export const isAllowed = (permissions, key, type = 'pages') => {
  if (!permissions || !key) return false;
  return Boolean(permissions?.[type]?.[key]);
};
