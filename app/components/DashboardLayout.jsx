'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { 
  Search, Bell, Home, Users, Calendar, 
  LogOut, Menu, ChevronRight, Workflow 
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';

// Definição dos menus do sistema
const navigation = [
  { name: "Visão Geral", href: "/admin/dashboard", icon: Home },
  { name: "Publicadores", href: "/admin/gerenciar", icon: Users },
  { name: "Designações", href: "/admin/designacoes", icon: Calendar },
];

const congregação = process.env.NOME_CONGREGACAO

export function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
        await fetch('/api/logout', { method: 'POST' });
        router.push('/');
    } catch (error) {
        console.error("Erro ao sair", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      
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
      `}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
             <div className="flex items-center gap-2 font-bold text-xl text-gray-900">
                <div className="w-8 h-8 bg-linear-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center text-white">
                   <Workflow className="w-4 h-4" />
                </div>
                <span>praia</span>
             </div>
             <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-500">
               ✕
             </button>
          </div>

          {/* Menu de Navegação */}
          <div className="flex-1 overflow-y-auto p-4">
            <nav className="space-y-1">
              {navigation.map((item) => {
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

          {/* Botão Sair */}
          <div className="p-4 border-t border-gray-200">
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

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-gray-200 bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button 
                className="md:hidden p-2 -ml-2 text-gray-500"
                onClick={() => setIsSidebarOpen(true)}
            >
                <Menu className="w-5 h-5" />
            </button>
            <div className="hidden md:flex text-sm text-gray-500 items-center">
              <span className="font-medium text-gray-900">Painel</span> 
              <ChevronRight className="w-4 h-4 mx-1" />
              <span>{navigation.find(n => n.href === pathname)?.name || 'Página'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar..."
                className="pl-10 w-64 bg-gray-50 border-gray-200 focus:bg-white transition-all text-gray-600"
              />
            </div>
            
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-gray-500" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
            </Button>

            <div className="h-9 w-9 bg-linear-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center text-purple-700 font-bold border border-purple-200">
                A
            </div>
          </div>
        </header>

        {/* Área de Scroll da Página */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6 md:p-8">
            {children}
        </main>
      </div>
    </div>
  );
}