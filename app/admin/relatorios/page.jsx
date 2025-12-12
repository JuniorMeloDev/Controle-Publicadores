'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/app/components/ui/card';
import { FileText, BarChart, Calendar, ArrowRight, Lock, Users } from 'lucide-react';
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
       active: true
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
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="text-center">
           <h1 className="text-2xl font-bold text-gray-900">Central de Relatórios</h1>
           <p className="text-gray-500">Selecione o tipo de relatório que deseja visualizar ou imprimir.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {reports.map((report, idx) => {
             const isLocked = !isLoadingUser && report.needsElder && !isAnciao;
             const isActive = report.active && !isLocked;
             
             return (
              <Link 
                  key={idx} 
                  href={isActive ? report.href : '#'} 
                  className={`block group h-full ${!isActive ? 'cursor-not-allowed' : ''}`}
                  onClick={(e) => !isActive && e.preventDefault()}
              >
                  <Card className={`h-full border-gray-200 bg-white transition-all 
                      ${isActive 
                        ? `cursor-pointer hover:border-${report.color.split('-')[1]}-300 hover:shadow-md group-hover:ring-2 ${report.hoverRing}` 
                        : 'opacity-75 grayscale-[0.5]'}
                  `}>
                    <CardHeader>
                      <div className={`mb-2 w-10 h-10 rounded-full flex items-center justify-center transition-colors
                          ${isLocked ? 'bg-gray-100' : report.bgColor}
                      `}>
                        {isLocked ? <Lock className="w-5 h-5 text-gray-500" /> : <report.icon className={`w-5 h-5 ${report.color}`} />}
                      </div>
                      <CardTitle className={`text-gray-900 ${isActive ? 'group-hover:text-primary transition-colors' : ''}`}>
                        {report.title}
                      </CardTitle>
                      <CardDescription className="text-gray-600">
                        {report.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className={`flex items-center text-sm font-medium mt-2 
                          ${isActive ? 'text-gray-900 font-semibold' : 'text-gray-400'}
                      `}>
                        {isLocked ? (
                            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Apenas Anciãos</span>
                        ) : (
                            isActive ? (
                                <>Acessar <ArrowRight className="text-gray-900 w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></>
                            ) : 'Em breve'
                        )}
                      </div>
                    </CardContent>
                  </Card>
              </Link>
             );
           })}
        </div>
      </div>
    </DashboardLayout>
  );
}
