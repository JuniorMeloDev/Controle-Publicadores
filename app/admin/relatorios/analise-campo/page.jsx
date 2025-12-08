'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Button } from '@/app/components/ui/button';
import { StatusToast } from '@/app/components/ui/status-toast';
import { Loader2, ArrowLeft, Calendar, BarChart3, Users, Clock, BookOpen, Printer } from 'lucide-react';
import Link from 'next/link';

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function AnaliseCampoPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  
  // Filters
  const [selectedMes, setSelectedMes] = useState(meses[new Date().getMonth()]);
  const [selectedAno, setSelectedAno] = useState(new Date().getFullYear());
  const [tipoPioneiro, setTipoPioneiro] = useState('todos'); // todos, regular, auxiliar, publicador
  
  // Toast
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    fetchStats();
  }, [selectedMes, selectedAno, tipoPioneiro]);

  const fetchStats = async () => {
     setLoading(true);
     
     try {
        const query = new URLSearchParams({
            mes: selectedMes,
            ano_servico: selectedAno,
            tipo_pioneiro: tipoPioneiro === 'todos' ? '' : tipoPioneiro
        });

        const res = await fetch(`/api/admin/relatorios/analise?${query.toString()}`);
        if (res.ok) {
            const json = await res.json();
            setData(json);
        } else {
            throw new Error('Falha ao carregar dados');
        }
     } catch (err) {
        setToast({ show: true, message: 'Erro ao carregar estatísticas.', type: 'error' });
     } finally {
        setLoading(false);
     }
  };

  // Stat Card Component
  const StatCard = ({ title, value, icon: Icon, colorClass }) => (
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
              <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
              <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          </div>
          <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
              <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
          </div>
      </div>
  );

  return (
    <DashboardLayout>
        {toast.show && <StatusToast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
        
        <div className="max-w-6xl mx-auto space-y-8 printable-content" style={{ display: 'block' }}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-4">
                    <Link href="/admin/relatorios">
                        <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Análise de Campo</h1>
                        <p className="text-gray-500">Visão geral do desempenho da congregação</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {/* Filters Bar */}
                    <div className="flex flex-wrap gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                        <select 
                            value={selectedMes} 
                            onChange={(e) => setSelectedMes(e.target.value)}
                            className="border-none bg-transparent font-medium text-gray-700 focus:ring-0 cursor-pointer"
                        >
                            {meses.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <div className="w-px bg-gray-200 my-1" />
                        <select 
                            value={selectedAno} 
                            onChange={(e) => setSelectedAno(e.target.value)}
                            className="border-none bg-transparent font-medium text-gray-700 focus:ring-0 cursor-pointer"
                        >
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <div className="w-px bg-gray-200 my-1" />
                        <select 
                            value={tipoPioneiro} 
                            onChange={(e) => setTipoPioneiro(e.target.value)}
                            className="border-none bg-transparent font-medium text-gray-700 focus:ring-0 cursor-pointer"
                        >
                            <option value="todos">Todos os Publicadores</option>
                            <option value="publicador">Publicadores (Só Publicadores)</option>
                            <option value="regular">Pioneiros Regulares</option>
                            <option value="auxiliar">Pioneiros Auxiliares</option>
                        </select>
                    </div>
                    
                    <Button onClick={() => window.print()} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                        <Printer className="w-4 h-4" />
                        Imprimir
                    </Button>
                </div>
            </div>

            {/* Print Header (Visible only when printing) */}
            <div className="hidden print:block mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Relatório de Análise de Campo</h1>
                <p className="text-gray-600 mb-4">
                   {selectedMes} de {selectedAno} • Filtro: {
                      tipoPioneiro === 'todos' ? 'Todos os Publicadores' :
                      tipoPioneiro === 'regular' ? 'Pioneiros Regulares' :
                      tipoPioneiro === 'auxiliar' ? 'Pioneiros Auxiliares' :
                      'Publicadores (Excl. Pioneiros)'
                   }
                </p>
            </div>

            {loading && !data ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-600 w-10 h-10" /></div>
            ) : data ? (
                <>
                    {/* KPI Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard 
                            title="Total de Relatórios" 
                            value={data.totals.publicadores_reportaram} 
                            icon={Users} 
                            colorClass="text-blue-600 bg-blue-100" 
                        />
                        <StatCard 
                            title="Total de Horas" 
                            value={data.totals.horas.toLocaleString('pt-BR')} 
                            icon={Clock} 
                            colorClass="text-purple-600 bg-purple-100" 
                        />
                        <StatCard 
                            title="Estudos Bíblicos" 
                            value={data.totals.estudos} 
                            icon={BookOpen} 
                            colorClass="text-pink-600 bg-pink-100" 
                        />
                         <StatCard 
                            title="Média de Horas" 
                            value={data.averages.horas_por_publicador} 
                            icon={BarChart3} 
                            colorClass="text-green-600 bg-green-100" 
                        />
                    </div>

                    {/* Detailed Data Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900">Detalhamento</h3>
                            <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                                {data.details.length} registros
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Nome</th>
                                        <th className="px-6 py-3 font-medium">Grupo</th>
                                        <th className="px-6 py-3 font-medium text-center">Horas</th>
                                        <th className="px-6 py-3 font-medium text-center">Estudos</th>
                                        <th className="px-6 py-3 font-medium text-center">Regular</th>
                                        <th className="px-6 py-3 font-medium text-center">Auxiliar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {data.details.map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">{row.nome_completo}</td>
                                            <td className="px-6 py-4 text-gray-500">{row.nome_grupo || '-'}</td>
                                            <td className="px-6 py-4 text-center font-medium text-purple-700">{row.horas || 0}</td>
                                            <td className="px-6 py-4 text-center text-gray-700">{row.estudos_biblicos || 0}</td>
                                            <td className="px-6 py-4 text-center">
                                                {row.is_regular ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                                        Sim
                                                    </span>
                                                ) : <span className="text-gray-300">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {row.pioneiro_auxiliar ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                        Sim
                                                    </span>
                                                ) : <span className="text-gray-300">-</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    </DashboardLayout>
  );
}
