'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import {
  Search, Home, Users, Calendar,
  LogOut, Menu, ChevronRight,
  User, Key, ChevronDown, X, Loader2, Eye, EyeOff,
  Clock, BarChart3, Settings
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { GlobalSearch } from '@/app/components/GlobalSearch';
import ThemeToggle from '@/app/components/ThemeToggle';
import { NotificationBell } from '@/app/components/NotificationBell';
import { PermissionsProvider } from '@/app/components/PermissionsContext';
import { useUserSession } from '@/app/components/UserSessionProvider';
import { getPageKeyForPath, isAllowed } from '@/app/lib/access-control';

// Definição dos menus do sistema
const navigation = [
  { name: "Visão Geral", href: "/admin/dashboard", icon: Home },
  { name: 'Meus Dados', href: '/admin/meus-dados', icon: User },
  { name: 'Minhas Designações', href: '/admin/minhas-designacoes', icon: Calendar },
  { name: 'Meu S-21', href: '/admin/meu-s21', icon: BarChart3 },
  { name: "Publicadores", href: "/admin/gerenciar", icon: Users },
  { name: "Designações", href: "/admin/designacoes", icon: Calendar },
  { name: "Reuniões", href: "/admin/reunioes", icon: Clock },
  { name: "Relatórios", href: "/admin/relatorios", icon: BarChart3 },
  { name: "Configurações", href: "/admin/configuracoes", icon: Settings },
];

const routeTitleMap = {
  "/admin/dashboard": "Visão Geral",
  "/admin/gerenciar": "Publicadores",
  "/admin/designacoes": "Designações",
  "/admin/reunioes": "Reuniões",
  "/admin/relatorios": "Relatórios",
  "/admin/configuracoes": "Configurações",
  "/admin/gestao-acessos": "Gestão de Acessos",
  "/admin/relatorios/vida-e-ministerio": "Relatório Vida e Ministério",
  "/admin/relatorios/discursos": "Relatório de Discursos Públicos",
  "/admin/relatorios/privilegios-mecanicos": "Relatório de Privilégios Mecânicos",
  "/admin/relatorios/limpeza": "Relatório de Limpeza Semanal",
  "/admin/relatorios/assistencia": "Assistência às Reuniões",
};

function getPageBreadcrumbTitle(pathname) {
  if (!pathname) return "Início";
  if (routeTitleMap[pathname]) return routeTitleMap[pathname];
  if (pathname.startsWith("/admin/reunioes/")) return "Detalhes da Reunião";
  if (pathname.startsWith("/admin/editar/")) return "Editar Publicador";

  const lastSegment = pathname.split("/").filter(Boolean).pop();
  if (lastSegment) {
    return lastSegment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return "Painel";
}

export function DashboardLayout({ children, contentClassName = '' }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Estado do Menu do Usuário
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Estado do Modal de Senha
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoadingSenha, setIsLoadingSenha] = useState(false);
  const [msgSenha, setMsgSenha] = useState({ text: '', isError: false });

  // Dados do Usuário
  const { user: sessionUser, isLoading: isPermsLoading } = useUserSession();
  const usuario = sessionUser || {
    id: null,
    nome_completo: '',
    nome_chamado: '',
    isAnciao: false,
    isServo: false
  };
  const permissions = sessionUser?.permissions || null;

  const nomeCongregacao = process.env.NEXT_PUBLIC_NOME_CONGREGACAO || 'Minha Congregação';

  // Fecha o menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuRef]);

  const nomeExibicao = usuario.nome_chamado
    ? usuario.nome_chamado
    : (usuario.nome_completo ? usuario.nome_completo.split(' ')[0] : 'Usuário');

  const getCargoExibicao = () => {
    if (usuario.isSuperAdmin) return 'Super admin';
    if (usuario.isAnciao) return 'Ancião';
    if (usuario.isServo) return 'Servo Ministerial';
    return 'Publicador';
  };

  const getInicial = (nome) => {
    if (!nome) return 'U';
    return nome.charAt(0).toUpperCase();
  };

  const pageKey = getPageKeyForPath(pathname);
  const personalPaths = ['/admin/dashboard', '/admin/meus-dados', '/admin/minhas-designacoes', '/admin/meu-s21', '/admin/configuracoes/preferencias'];
  const canAccessPage = personalPaths.includes(pathname) || (pathname === '/admin/gestao-acessos' ? usuario.isSuperAdmin : Boolean(pageKey && isAllowed(permissions, pageKey, 'pages')));

  const filteredNavigation = isPermsLoading
    ? []
    : (permissions
        ? navigation.filter(item => personalPaths.includes(item.href) || isAllowed(permissions, getPageKeyForPath(item.href), 'pages'))
        : []);

  const handleLogout = async () => {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.dispatchEvent(new Event('session:logout'));
        router.push('/');
    } catch (error) {
        console.error("Erro ao sair", error);
    }
  };

  // Função para alterar a senha via Modal
  const handleAlterarSenha = async (e) => {
    e.preventDefault();
    if (novaSenha !== confirmarSenha) {
      setMsgSenha({ text: 'As senhas não coincidem.', isError: true });
      return;
    }
    if (novaSenha.length < 8 || !/[a-z]/.test(novaSenha) || !/[A-Z]/.test(novaSenha) || !/[0-9]/.test(novaSenha) || !/[^a-zA-Z0-9]/.test(novaSenha) || new TextEncoder().encode(novaSenha).length > 72) {
      setMsgSenha({ text: 'Use pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e símbolo (máximo de 72 bytes).', isError: true });
      return;
    }

    setIsLoadingSenha(true);
    setMsgSenha({ text: '', isError: false });

    try {
      const res = await fetch('/api/alterar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novaSenha })
      });
      const data = await res.json();

      if (res.ok) {
        setMsgSenha({ text: 'Senha alterada com sucesso!', isError: false });
        setTimeout(() => {
          setIsPasswordModalOpen(false);
          setNovaSenha('');
          setConfirmarSenha('');
          setMsgSenha({ text: '', isError: false });
        }, 1500);
      } else {
        setMsgSenha({ text: data.message || 'Erro ao alterar senha.', isError: true });
      }
    } catch (err) {
      setMsgSenha({ text: 'Erro de conexão.', isError: true });
    } finally {
      setIsLoadingSenha(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col md:flex-row print:h-auto print:overflow-visible">

      {/* === MODAL DE ALTERAR SENHA === */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-600" /> Alterar Minha Senha
              </h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAlterarSenha} className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Use pelo menos 8 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.</p>
              {msgSenha.text && (
                <div className={`p-3 rounded-md text-sm ${msgSenha.isError ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                  {msgSenha.text}
                </div>
              )}

              <div>
                <label htmlFor="portal-new-password" className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
                <div className="relative">
                <input
                  id="portal-new-password" autoComplete="new-password" minLength={8} type={showNewPassword ? 'text' : 'password'}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 bg-gray-50 text-gray-900 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                  placeholder="Mínimo 8 caracteres"
                  required
                />
                <button type="button" aria-label={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-controls="portal-new-password" aria-pressed={showNewPassword} onClick={() => setShowNewPassword(!showNewPassword)} className="absolute inset-y-0 right-3 text-gray-500">{showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>

              <div>
                <label htmlFor="portal-confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Confirmar nova senha</label>
                <div className="relative">
                <input
                  id="portal-confirm-password" autoComplete="new-password" minLength={8} type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 bg-gray-50 text-gray-900 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                  placeholder="Repita a senha"
                  required
                />
                <button type="button" aria-label={showConfirmPassword ? 'Ocultar confirmação da senha' : 'Mostrar confirmação da senha'} aria-controls="portal-confirm-password" aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-3 text-gray-500">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoadingSenha}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors flex justify-center items-center"
                >
                  {isLoadingSenha ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Overlay para mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        print:hidden
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
             <div className="flex items-center gap-2 font-bold text-xl text-gray-900 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="" className="w-10 h-10 shrink-0 object-contain" />
                <span className="truncate" title={nomeCongregacao}>
                  {nomeCongregacao}
                </span>
             </div>
             <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-500">
               ✕
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <nav className="space-y-1">
              {filteredNavigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center w-full justify-start px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-purple-50 text-purple-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <item.icon className={`w-4 h-4 mr-3 ${isActive ? "text-purple-700" : "text-gray-500"}`} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="p-4 border-t border-gray-200 md:hidden">
            <Button
                variant="ghost"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleLogout}
            >
                <LogOut className="w-4 h-4 mr-3" />
                Sair
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden print:h-auto print:overflow-visible">
        <header className="h-16 border-b border-gray-200 bg-white px-3 sm:px-6 flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-4">
            <button
                className="md:hidden p-2 -ml-2 text-gray-500"
                onClick={() => setIsSidebarOpen(true)}
            >
                <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex text-sm text-gray-500 items-center min-w-0">
              <span className="font-medium text-gray-900 hidden lg:inline">Painel</span>
              <ChevronRight className="w-4 h-4 mx-1 hidden lg:inline" />
              <span className="font-semibold text-gray-800 text-base md:text-sm md:font-normal md:text-gray-500 truncate max-w-[100px] lg:max-w-none">{getPageBreadcrumbTitle(pathname)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {isAllowed(permissions, 'publicadores') && <GlobalSearch />}

            <NotificationBell userId={usuario.id} permissions={permissions} />
            <ThemeToggle />

            <div className="relative pl-2 sm:pl-4 border-l border-gray-100" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-4 hover:bg-gray-50 py-1.5 px-1 sm:px-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-100"
                >
                    <div className="text-right hidden lg:block">
                        <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                            {nomeExibicao}
                        </p>
                        <p className="text-xs text-gray-500">
                            {getCargoExibicao()}
                        </p>
                    </div>
                    <div className="h-9 w-9 bg-linear-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center text-purple-700 font-bold border border-purple-200 shadow-sm relative">
                        {getInicial(nomeExibicao)}
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full border border-gray-200 p-0.5 shadow-sm">
                           <ChevronDown className="w-2 h-2 text-gray-500" />
                        </div>
                    </div>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">

                    <div className="px-4 py-3 border-b border-gray-100 lg:hidden">
                      <p className="text-sm font-medium text-gray-900 truncate">{nomeExibicao}</p>
                      <p className="text-xs text-gray-500 truncate">{getCargoExibicao()}</p>
                    </div>

                    <div className="p-1">
                      {/* Link para Meus Dados usando a URL correta */}
                      <Link
                        href="/admin/meus-dados"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 rounded-md transition-colors"
                      >
                        <User className="w-4 h-4" />
                        Meus Dados
                      </Link>

                      <Link href="/admin/configuracoes/preferencias" onClick={() => setIsUserMenuOpen(false)}
                        className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 rounded-md transition-colors">
                        <Settings className="w-4 h-4" />Minhas configurações
                      </Link>
                      {usuario.isSuperAdmin && (
                        <Link
                          href="/admin/gestao-acessos"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 rounded-md transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          Gestão de Acessos
                        </Link>
                      )}

                      {/* Botão que abre o MODAL de senha */}
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setNovaSenha(''); setConfirmarSenha('');
                          setShowNewPassword(false); setShowConfirmPassword(false);
                          setMsgSenha({ text: '', isError: false });
                          setIsPasswordModalOpen(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 rounded-md transition-colors text-left"
                      >
                        <Key className="w-4 h-4" />
                        Trocar Senha
                      </button>
                    </div>

                    <div className="border-t border-gray-100 p-1 mt-1">
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sair
                      </button>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto bg-gray-50 p-2 md:p-2 print:p-0 print:overflow-visible print:bg-white ${contentClassName}`}>
            <PermissionsProvider permissions={permissions} isLoading={isPermsLoading} user={usuario}>
              {isPermsLoading ? <p className="p-6 text-gray-500">Verificando acesso...</p> : !permissions || !canAccessPage ? (
                <div className="max-w-xl mx-auto mt-10 bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm">
                  <h2 className="text-lg font-bold text-gray-900">Acesso restrito</h2>
                  <p className="text-sm text-gray-600 mt-2">
                    Você não tem permissão para acessar esta tela.
                  </p>
                </div>
              ) : (
                children
              )}
            </PermissionsProvider>
        </main>
      </div>
    </div>
  );
}
