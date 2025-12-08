'use client';

import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/app/components/ui/card';
import { FileText, BarChart, Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function RelatoriosHubPage() {
  const reports = [
    {
      title: "Registro de Publicador (S-21)",
      description: "Imprimir cartões S-21 individuais ou em lote.",
      href: "/admin/relatorios/registro-publicador",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      hoverRing: "group-hover:ring-blue-100",
      active: true
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
      title: "Histórico de Designações",
      description: "Relatório de partes e designações passadas.",
      href: "#",
      icon: Calendar,
      color: "text-gray-400",
      bgColor: "bg-gray-100",
      hoverRing: "",
      active: false
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Central de Relatórios</h1>
           <p className="text-gray-500">Selecione o tipo de relatório que deseja visualizar ou imprimir.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {reports.map((report, idx) => (
             <Link 
                key={idx} 
                href={report.href} 
                className={`block group h-full ${!report.active ? 'pointer-events-none opacity-60 grayscale' : ''}`}
             >
                <Card className={`h-full border-gray-200 bg-white transition-all cursor-pointer ${report.active ? `hover:border-${report.color.split('-')[1]}-300 hover:shadow-md group-hover:ring-2 ${report.hoverRing}` : ''}`}>
                  <CardHeader>
                    <div className={`mb-2 w-10 h-10 rounded-full ${report.bgColor} flex items-center justify-center transition-colors`}>
                      <report.icon className={`w-5 h-5 ${report.color}`} />
                    </div>
                    <CardTitle className={`text-gray-900 ${report.active ? 'group-hover:text-primary transition-colors' : ''}`}>
                      {report.title}
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      {report.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className={`flex items-center text-sm font-medium mt-2 ${report.active ? 'text-primary' : 'text-gray-400'}`}>
                      {report.active ? 'Acessar' : 'Em breve'} 
                      {report.active && <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />}
                    </div>
                  </CardContent>
                </Card>
             </Link>
           ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
