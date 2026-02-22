export const PAGE_PERMISSIONS = [
  { key: 'dashboard', label: 'Visão Geral', path: '/admin/dashboard' },
  { key: 'publicadores', label: 'Publicadores', path: '/admin/gerenciar' },
  { key: 'designacoes', label: 'Designações', path: '/admin/designacoes' },
  { key: 'reunioes', label: 'Reuniões', path: '/admin/reunioes' },
  { key: 'relatorios', label: 'Relatórios', path: '/admin/relatorios' },
  { key: 'configuracoes', label: 'Configurações', path: '/admin/configuracoes' },
];

export const ACTION_PERMISSIONS = [
  { key: 'designacoes_importar', label: 'Importar RTF (Designações)' },
  { key: 'designacoes_salvar', label: 'Salvar Designações' },
  { key: 'designacoes_pdf', label: 'Gerar PDF (Designações)' },
  { key: 'designacoes_email', label: 'Enviar E-mails (Designações)' },
  { key: 'discursos_publicos_editar', label: 'Criar/Editar Discursos Públicos' },
  { key: 'privilegios_mecanicos_editar', label: 'Editar Privilégios Mecânicos' },
  { key: 'limpeza_semanal_editar', label: 'Editar Limpeza Semanal' },
  { key: 'logs_visualizar', label: 'Visualizar Logs do Sistema' },
  { key: 'publicadores_editar', label: 'Criar/Editar Publicadores' },
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
    pages[key] = Boolean(input.pages?.[key]);
  });
  ACTION_PERMISSIONS.forEach(({ key }) => {
    // Actions: se a chave NÃO existe no registro salvo, assume true.
    // Isso garante compatibilidade retroativa: novas actions adicionadas ao sistema
    // não bloqueiam usuários com registros antigos que não tinham essa chave.
    const storedValue = input.actions?.[key];
    actions[key] = storedValue === undefined ? true : Boolean(storedValue);
  });

  return { pages, actions };
};

export const getPageKeyForPath = (pathname) => {
  if (!pathname) return null;
  const match = PAGE_PERMISSIONS.find(p => pathname === p.path || pathname.startsWith(`${p.path}/`));
  return match ? match.key : null;
};

export const isAllowed = (permissions, key, type = 'pages') => {
  if (!permissions || !key) return false;
  return Boolean(permissions?.[type]?.[key]);
};
