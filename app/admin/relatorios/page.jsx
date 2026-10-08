'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { FileText, BarChart, Calendar, ArrowRight, Lock, Users, LayoutList, Brush, BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function RelatoriosHubPage() {
  const [isAnciao, setIsAnciao] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/usuario-atual');
        if (res.ok) {
          const data = await res.json();
          setIsAnciao(data.isAnciao);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingUser(false);
      }
    };
    fetchUser();
  }, []);

  const reports = [
    {
      title: "Registro de Publicador (S-21)",
      description: "Imprimir cartões S-21 individuais ou em lote.",
      href: "/admin/relatorios/registro-publicador",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      hoverRing: "group-hover:ring-blue-100",
      active: true,
      needsElder: true
    },
    {
      title: "Análise de Campo",
      description: "Totais mensais, médias e desempenho da congregação.",
      href: "/admin/relatorios/analise-campo",
      icon: BarChart,
      color: "text-green-600",
      bgColor: "bg-green-50",
      hoverRing: "group-hover:ring-green-100",
      active: true,
      needsElder: true
    },
    {
      title: "Privilégios Mecânicos",
      description: "Imprimir cartões e lista de privilégios.",
      href: "/admin/relatorios/privilegios-mecanicos",
      icon: Calendar,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      hoverRing: "group-hover:ring-blue-100",
      active: true
    },
    {
      title: "Relatório de Assistência",
      description: "Gráficos de comparecimento, Zoom e faltantes.",
      href: "/admin/relatorios/assistencia",
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      hoverRing: "group-hover:ring-purple-100",
      active: true
    },
    {
      title: "Discursos Públicos",
      description: "Filtrar por data, orador e tema. Exportar lista.",
      href: "/admin/relatorios/discursos",
      icon: LayoutList,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      hoverRing: "group-hover:ring-orange-100",
      active: true
    },
    {
      title: "Programação de Limpeza",
      description: "Escala semanal de limpeza e manutenção do Salão.",
      href: "/admin/relatorios/limpeza",
      icon: Brush,
      color: "text-teal-600",
      bgColor: "bg-teal-50",
      hoverRing: "group-hover:ring-teal-100",
      active: true
    },
    {
      title: "Vida e Ministério - Designações",
      description: "Exportar designações em lote (PDF/Excel) ou individualmente.",
      href: "/admin/relatorios/vida-e-ministerio",
      icon: BookOpen,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      hoverRing: "group-hover:ring-indigo-100",
      active: true
    }
  ];

  return (
    <DashboardLayout contentClassName="[scrollbar-gutter:stable]">
      <div className="w-full min-w-0 p-2 sm:p-3 space-y-4">
        <div className="pb-2 border-b border-gray-100">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Central de Relatórios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Selecione o tipo de relatório que deseja visualizar ou imprimir.</p>
        </div>

        <section aria-label="Relatórios disponíveis" className="md:bg-white md:rounded-xl md:border md:border-gray-200 md:shadow-sm md:overflow-hidden">
          <div className="space-y-3 md:space-y-0 md:divide-y md:divide-gray-100">
            {reports.map(report => {
              const pending = isLoadingUser && report.needsElder;
              const isLocked = !isLoadingUser && report.needsElder && !isAnciao;
              const isActive = report.active && !isLocked && !pending;
              const Icon = isLocked ? Lock : report.icon;
              return <Link key={report.href} href={isActive ? report.href : '#'} aria-disabled={!isActive}
                onClick={event => { if (!isActive) event.preventDefault(); }}
                className={`group flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-4 min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm md:rounded-none md:border-0 md:shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500 ${isActive ? 'hover:bg-purple-50/40' : 'cursor-not-allowed opacity-75'}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isLocked ? 'bg-gray-100' : report.bgColor}`}>
                  <Icon className={`w-5 h-5 ${isLocked ? 'text-gray-500' : report.color}`} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-base font-semibold text-gray-900">{report.title}</span>
                  <span className="block text-sm text-gray-500 mt-1">{report.description}</span>
                </span>
                <span className={`flex h-10 w-full md:w-32 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium ${isActive ? 'border border-purple-200 text-purple-700 group-hover:bg-purple-50' : 'text-gray-500'}`}>
                  {pending ? 'Carregando…' : isLocked ? 'Apenas anciãos' : isActive ? <>Acessar <ArrowRight className="w-4 h-4" aria-hidden="true" /></> : 'Em breve'}
                </span>
              </Link>;
            })}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
