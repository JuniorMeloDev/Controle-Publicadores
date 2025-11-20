'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Calendar, LogOut } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  // Função para verificar se o link está ativo
  const isActive = (path) => pathname === path;

  const linkClass = (path) => `
    flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1
    ${isActive(path) 
      ? 'bg-blue-600 text-white shadow-md' 
      : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}
  `;

  return (
    <aside className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col h-screen shrink-0">
      
      {/* Logo / Título */}
      <div className="p-6 border-b border-neutral-800 flex items-center gap-2">
        <div className="bg-blue-600 p-1.5 rounded-lg">
          <LayoutDashboard size={20} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">Controle</h1>
      </div>

      {/* Menu de Navegação */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <p className="px-4 text-xs font-semibold text-neutral-500 uppercase mb-4 mt-2">
          Menu Principal
        </p>
        
        <Link href="/admin/dashboard" className={linkClass('/admin/dashboard')}>
          <LayoutDashboard size={20} />
          <span className="font-medium">Visão Geral</span>
        </Link>

        <Link href="/admin/gerenciar" className={linkClass('/admin/gerenciar')}>
          <Users size={20} />
          <span className="font-medium">Publicadores</span>
        </Link>

        <Link href="/admin/designacoes" className={linkClass('/admin/designacoes')}>
          <Calendar size={20} />
          <span className="font-medium">Designações</span>
        </Link>
      </nav>

      {/* Rodapé do Menu */}
      <div className="p-4 border-t border-neutral-800">
        <button 
          onClick={async () => {
             await fetch('/api/logout', { method: 'POST' });
             window.location.href = '/';
          }}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
}