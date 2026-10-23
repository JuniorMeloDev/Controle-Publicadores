import { getPageKeyForPath, isAllowed } from './access-control.js';

const personalPages = new Set(['/admin/dashboard', '/admin/meus-dados', '/admin/minhas-designacoes', '/admin/meu-s21', '/admin/configuracoes/preferencias']);
const personalApis = new Set(['/api/admin/notificacoes', '/api/admin/alertas/preferencias']);
const readGroups = {
  dashboard: ['dashboard/stats', 'get-status-relatorios'],
  publicadores: ['get-publicadores', 'get-publicador', 'get-historico', 'atualizacoes-cadastrais'],
  designacoes: ['get-designacoes-publicador', 'get-historico-designacoes', 'get-meeting-details', 'get-reuniao-dados', 'discursos', 'temas-discursos', 'limpeza', 'servico-campo', 'privilegios/tipos', 'privilegios/atribuicoes', 'privilegios/sugestoes'],
  reunioes: ['get-reunioes', 'reunioes'],
  relatorios: ['get-relatorios', 'relatorios'],
  configuracoes: ['configuracoes', 'grupos', 'alertas/configuracoes'],
};
const writes = {
  'criar-publicador': ['publicadores_editar'], 'update-publicador': ['publicadores_editar'],
  'delete-publicador': ['publicadores_excluir'], 'batch-update-grupos': ['publicadores_editar'],
  'atualizacoes-cadastrais': ['publicadores_editar'],
  'batch-update-relatorios': ['relatorios_editar'], 'relatorios-lote': ['relatorios_gerar'],
  'salvar-designacoes': ['designacoes_salvar'], 'parse-rtf': ['designacoes_importar'],
  'enviar-emails-lote': ['designacoes_email'], 'discursos': ['discursos_publicos_editar'],
  'temas-discursos': ['discursos_publicos_editar'], 'limpeza': ['limpeza_semanal_editar'],
  'servico-campo': ['servico_campo_editar'],
  'privilegios/tipos': ['privilegios_mecanicos_editar'], 'privilegios/atribuicoes': ['privilegios_mecanicos_editar'],
  'privilegios/sugestoes': ['privilegios_mecanicos_editar'],
  'configuracoes': ['configuracoes_editar'], 'grupos': ['configuracoes_editar'], 'setup-grupos': ['configuracoes_editar'],
  'alertas/configuracoes': ['configuracoes_editar'],
  'reunioes/importar-programacao': ['designacoes_importar', 'configuracoes_editar'],
  'reunioes/atualizar-privilegios': ['privilegios_mecanicos_editar'],
  'reunioes/gerar': ['configuracoes_editar'], 'reunioes/editar': ['configuracoes_editar'],
  'reunioes/deletar': ['configuracoes_editar'], 'reunioes/remover-evento-especial': ['configuracoes_editar'],
  'reunioes': ['reunioes_editar'],
};
const matches = (route, prefix) => route === prefix || route.startsWith(prefix + '/');

export function canAccessRoute(access, pathname, method = 'GET') {
  if (!access) return false;
  const { permissions, isSuperAdmin } = access;
  if (pathname === '/admin/gestao-acessos' || pathname === '/api/admin/gestao-acessos') return isSuperAdmin;
  if (pathname === '/admin/gerenciar/atualizacoes' || pathname === '/api/admin/atualizacoes-cadastrais') return isSuperAdmin;
  if (personalPages.has(pathname) || personalApis.has(pathname)) return true;
  const canViewS21 = isAllowed(permissions, 's21_visualizar', 'actions');
  const canExportS21 = canViewS21 && isAllowed(permissions, 's21_exportar', 'actions');
  if (pathname === '/admin/relatorios/registro-publicador') return isAllowed(permissions, 'relatorios') && canExportS21;
  if (pathname === '/admin/relatorios/analise-campo') return isAllowed(permissions, 'relatorios') && canViewS21;
  if (pathname.startsWith('/admin/')) {
    const key = getPageKeyForPath(pathname);
    return Boolean(key && isAllowed(permissions, key));
  }
  if (!pathname.startsWith('/api/admin/')) return false;
  const route = pathname.slice('/api/admin/'.length);
  if (matches(route, 'get-relatorios')) return ['GET', 'HEAD'].includes(method) && canViewS21;
  if (matches(route, 'relatorios-lote')) return method === 'POST' && canExportS21;
  if (matches(route, 'relatorios/analise')) return ['GET', 'HEAD'].includes(method) && canViewS21 && isAllowed(permissions, 'relatorios');
  if (route === 'backup') return isAllowed(permissions, 'backup_exportar', 'actions');
  if (route === 'logs') return isAllowed(permissions, 'logs_visualizar', 'actions');
  if (route === 'global-search') return isAllowed(permissions, 'publicadores');
  if (method === 'GET' || method === 'HEAD') {
    if (route === 'pessoas-especiais') return ['designacoes', 'configuracoes'].some(page => isAllowed(permissions, page));
    if (route === 'get-publicadores') return ['publicadores', 'designacoes', 'reunioes', 'relatorios', 'dashboard', 'configuracoes'].some(page => isAllowed(permissions, page));
    if (route === 'get-reunioes') return ['reunioes', 'designacoes', 'relatorios'].some(page => isAllowed(permissions, page));
    return Object.entries(readGroups).some(([page, prefixes]) => prefixes.some(prefix => matches(route, prefix)) && isAllowed(permissions, page));
  }
  const prefix = Object.keys(writes).sort((a, b) => b.length - a.length).find(key => matches(route, key));
  return Boolean(prefix && writes[prefix].some(key => isAllowed(permissions, key, 'actions')));
}
