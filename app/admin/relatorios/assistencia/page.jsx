'use client';

import { DashboardLayout } from '@/app/components/DashboardLayout';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Loader2, Users, Video, UserMinus, RefreshCcw } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { Button } from '@/app/components/ui/button';

export default function AssistenciaPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Defaulting to last 20 meetings for a good trend line
            const res = await fetch('/api/admin/relatorios/assistencia?limit=20');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex h-screen items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
            </DashboardLayout>
        );
    }

    if (!data) {
        return (
            <DashboardLayout>
                <div className="p-8 text-center text-gray-500">Erro ao carregar dados.</div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Relatório de Assistência</h1>
                        <p className="text-gray-700">Análise de comparecimento às reuniões (Últimas 20 reuniões).</p>
                    </div>
                    <Button onClick={fetchData} variant="outline" size="sm" className="gap-2">
                        <RefreshCcw className="w-4 h-4" /> Atualizar
                    </Button>
                </div>

                {/* KPI CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-l-4 border-l-blue-500 shadow-sm">
                        <CardHeader className="pb-2">
                             <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-bold text-gray-700">Média Presencial</CardTitle>
                                <Users className="w-4 h-4 text-blue-500" />
                             </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-900">{data.averages.presencial}</div>
                            <p className="text-xs font-medium text-gray-600">Publicadores no Salão</p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-purple-500 shadow-sm">
                        <CardHeader className="pb-2">
                             <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-bold text-gray-700">Média Zoom</CardTitle>
                                <Video className="w-4 h-4 text-purple-500" />
                             </div>
                        </CardHeader>
                        <CardContent>
                             <div className="text-2xl font-bold text-gray-900">{data.averages.zoom}</div>
                             <p className="text-xs font-medium text-gray-600">Conectados online</p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-red-500 shadow-sm">
                        <CardHeader className="pb-2">
                             <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-bold text-gray-700">Média Faltantes</CardTitle>
                                <UserMinus className="w-4 h-4 text-red-500" />
                             </div>
                        </CardHeader>
                        <CardContent>
                             <div className="text-2xl font-bold text-gray-900">{data.averages.faltantes}</div>
                             <p className="text-xs font-medium text-gray-600">Não compareceram</p>
                        </CardContent>
                    </Card>
                </div>

                {/* CHARTS ROW */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LINE CHART - TREND */}
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-gray-900">Tendência de Assistência</CardTitle>
                            <CardDescription className="text-gray-600">Evolução nas últimas reuniões</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data.history} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="presencial" name="Presencial" stroke="#3B82F6" strokeWidth={3} activeDot={{ r: 6 }} dot={false} />
                                    <Line type="monotone" dataKey="zoom" name="Zoom" stroke="#A855F7" strokeWidth={3} activeDot={{ r: 6 }} dot={false} />
                                    <Line type="monotone" dataKey="faltantes" name="Faltantes" stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" activeDot={{ r: 6 }} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    
                    {/* BAR CHART - COMPOSITION */}
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-gray-900">Composição da Assistência</CardTitle>
                            <CardDescription className="text-gray-600">Presencial vs Zoom vs Faltantes</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.history} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E5E7EB' }}/>
                                    <Legend />
                                    <Bar dataKey="presencial" name="Presencial" stackId="a" fill="#3B82F6" radius={[0, 0, 4, 4]} />
                                    <Bar dataKey="zoom" name="Zoom" stackId="a" fill="#A855F7" />
                                    <Bar dataKey="faltantes" name="Faltantes" stackId="a" fill="#FECACA" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
