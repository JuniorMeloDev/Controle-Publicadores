'use client';

import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Users, Calendar, ArrowRight, TrendingUp, FileText } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  // Estes são dados estáticos de exemplo para preencher o visual do dashboard novo.
  // Futuramente você pode criar uma API para buscar esses números reais do banco.
  const stats = [
    { 
      label: "Total de Publicadores", 
      value: "91", 
      change: "+2 este mês", 
      icon: Users, 
      color: "text-blue-600", 
      bg: "bg-blue-100" 
    },
    { 
      label: "Reuniões do Mês", 
      value: "4", 
      change: "Próxima: 24/04", 
      icon: Calendar, 
      color: "text-purple-600", 
      bg: "bg-purple-100" 
    },
    { 
      label: "Relatórios Enviados", 
      value: "87%", 
      change: "+5% vs mês passado", 
      icon: TrendingUp, 
      color: "text-green-600", 
      bg: "bg-green-100" 
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Visão Geral</h1>
            <p className="text-gray-500 mt-1">Bem-vindo ao painel de controle da congregação.</p>
          </div>
        </div>

        {/* Cards de Estatísticas (Visual Novo) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <Card key={index} className="border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 ${stat.bg} rounded-lg flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                    {stat.change}
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Acesso Rápido</h2>
          
          {/* Grid de Navegação Principal */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Card 1: Gerenciar Publicadores */}
            <Link href="/admin/gerenciar" className="block group h-full">
              <Card className="h-full border-gray-200 bg-white hover:border-purple-300 hover:shadow-md transition-all cursor-pointer group-hover:ring-2 group-hover:ring-purple-100">
                <CardHeader>
                  <div className="mb-2 w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <CardTitle className="text-gray-900 group-hover:text-purple-700 transition-colors">
                    Gerenciar Publicadores
                  </CardTitle>
                  <CardDescription>
                    Visualizar lista, editar dados e adicionar novos publicadores.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm font-medium text-purple-600 mt-2">
                    Acessar diretório <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Card 2: Designações */}
            <Link href="/admin/designacoes" className="block group h-full">
              <Card className="h-full border-gray-200 bg-white hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group-hover:ring-2 group-hover:ring-blue-100">
                <CardHeader>
                  <div className="mb-2 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <CardTitle className="text-gray-900 group-hover:text-blue-700 transition-colors">
                    Designações da Reunião
                  </CardTitle>
                  <CardDescription>
                    Gerar programa da reunião importando arquivos RTF.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm font-medium text-blue-600 mt-2">
                    Ir para editor <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Card 3: Relatórios (Placeholder) */}
            <div className="block h-full opacity-60 grayscale">
              <Card className="h-full border-gray-200 bg-gray-50 border-dashed">
                <CardHeader>
                  <div className="mb-2 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-gray-500" />
                  </div>
                  <CardTitle className="text-gray-600">
                    Ver Relatórios
                  </CardTitle>
                  <CardDescription>
                    Visualizar e filtrar relatórios mensais (Em breve).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm font-medium text-gray-500 mt-2">
                    Indisponível
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}