'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Users, Calendar, ArrowRight, TrendingUp, FileText, CheckCircle, Clock, Loader2, X, Printer, Search } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from '@/app/components/ui/sheet';
import { Button } from '@/app/components/ui/button';
import ListaStatusImprimivel from '@/app/componentes/Relatorios/ListaStatusImprimivel';

// --- CONSTANTES E FUNÇÕES DE DATA ---
const MESES = [
  'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Janeiro', 'Fevereiro',
  'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto'
];

// O ano de serviço é o ano atual se for Setembro-Dezembro (Mês 8-11 no JS)
// ou o próximo ano se for Janeiro-Agosto (Mês 0-7)
const getCurrentServiceYear = (monthIndex = new Date().getMonth()) => {
  const currentYear = new Date().getFullYear();
  // Se for Setembro (8) a Dezembro (11), o ano de serviço é o ano final do ciclo
  return monthIndex >= 8 ? currentYear + 1 : currentYear;
};

const getPreviousMonthAndYear = () => {
    const data = new Date();
    const diaAtual = data.getDate();
    
    // Se estamos nos primeiros dias, o relatório é para o mês anterior.
    if (diaAtual <= 5) {
      data.setMonth(data.getMonth() - 1); 
    }
    
    const mesIndex = data.getMonth();
    
    // Mapeia o índice 0-11 (Janeiro-Dezembro) para o nome no array MESES
    const nomeMes = MESES[
        mesIndex >= 8 // Se for Setembro ou depois
            ? mesIndex - 8 // Setembro (8) -> 0, Outubro (9) -> 1, ...
            : mesIndex + 4 // Janeiro (0) -> 4, Fevereiro (1) -> 5, ...
    ]; 
    
    const ano = getCurrentServiceYear(mesIndex);
    
    return { mes: nomeMes, ano: ano };
};

const defaultPeriod = getPreviousMonthAndYear();

// --- FUNÇÃO DE BUSCA DA API ---
async function fetchStatus(mes, ano) {
    const res = await fetch(`/api/admin/get-status-relatorios?mes=${mes}&ano=${ano}`, {
        cache: 'no-store'
    });
    if (!res.ok) {
        throw new Error('Falha ao buscar status de relatórios.');
    }
    return res.json();
}

async function fetchGrupos() {
     const res = await fetch('/api/get-grupos');
     if (!res.ok) throw new Error('Falha ao carregar grupos.');
     return res.json();
}


export default function Dashboard() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null);
  
  const [gruposList, setGruposList] = useState([]);
  
  // Período selecionado pelo usuário
  const [selectedMonth, setSelectedMonth] = useState(defaultPeriod.mes);
  const [selectedYear, setSelectedYear] = useState(defaultPeriod.ano);
  
  // FILTROS
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  
  // ESTADO DE BUSCA (NOVO)
  const [searchTerm, setSearchTerm] = useState('');

  // Dados da API
  const [statusRelatorios, setStatusRelatorios] = useState([]);
  const [isPageLoading, setIsPageLoading] = useState(true);


  // ------------------------------------------------------------------
  // 1. CARREGAMENTO INICIAL (Grupos + Status)
  // ------------------------------------------------------------------

  const loadReportStatus = async (mes, ano) => {
    setLoadingStatus(true);
    setErrorStatus(null);
    try {
      const data = await fetchStatus(mes, ano);
      setStatusRelatorios(data);
    } catch (err) {
      setErrorStatus(err.message);
      setStatusRelatorios([]);
    } finally {
      setLoadingStatus(false);
    }
  };
  
  const loadInitialData = async () => {
    setIsPageLoading(true);
    try {
        const gruposData = await fetchGrupos();
        setGruposList(gruposData);
        await loadReportStatus(defaultPeriod.mes, defaultPeriod.ano);
    } catch (err) {
        console.error("Erro ao carregar dados iniciais:", err);
        setErrorStatus("Erro ao carregar dados iniciais.");
    } finally {
        setIsPageLoading(false);
    }
  };
  
  useEffect(() => {
    loadInitialData();
  }, []); 

  useEffect(() => {
    if (!isPageLoading) {
       loadReportStatus(selectedMonth, selectedYear);
    }
    // Sempre reseta os filtros ao mudar o mês/ano
    setSelectedGroup(''); 
    setSelectedStatus('');
    setSearchTerm('');
  }, [selectedMonth, selectedYear, isPageLoading]);


  // ------------------------------------------------------------------
  // 2. FILTRAGEM E CÁLCULO DE ESTATÍSTICAS
  // ------------------------------------------------------------------
  
  // Filtra os relatórios exibidos com base no grupo, status e NOME
  const filteredRelatorios = useMemo(() => {
    let list = statusRelatorios;
    
    // Filtro por Grupo
    if (selectedGroup) {
      list = list.filter(pub => pub.nome_grupo === selectedGroup);
    }
    
    // Filtro por Status
    if (selectedStatus) {
      list = list.filter(pub => pub.status === selectedStatus);
    }

    // Filtro por Busca de Texto (Nome ou Grupo)
    if (searchTerm.trim()) {
        const lowerTerm = searchTerm.toLowerCase();
        list = list.filter(pub => 
            (pub.nome_completo || '').toLowerCase().includes(lowerTerm) ||
            (pub.nome_grupo || '').toLowerCase().includes(lowerTerm)
        );
    }

    return list;
  }, [statusRelatorios, selectedGroup, selectedStatus, searchTerm]);


  const { totalPublicadores, enviados, pendentes } = useMemo(() => {
    const total = filteredRelatorios.length;
    const enviados = filteredRelatorios.filter(p => p.status === 'Enviado').length;
    const pendentes = total - enviados;
    return { totalPublicadores: total, enviados, pendentes };
  }, [filteredRelatorios]);

  // Função para acionar a impressão
  const handlePrint = () => {
    window.print();
  };

  // ANOS DISPONÍVEIS - LÓGICA DE EXIBIÇÃO AJUSTADA
  const availableYears = useMemo(() => {
    const today = new Date();
    const monthIndex = today.getMonth(); // 0 = Jan, 8 = Sep
    
    // O ano de término do ciclo de serviço ATUAL
    const currentEndYear = getCurrentServiceYear(monthIndex); 

    let yearsList = new Set();
    
    // Inclui o ano de término do ciclo atual e os dois anteriores
    yearsList.add(currentEndYear); 
    yearsList.add(currentEndYear - 1); 
    yearsList.add(currentEndYear - 2); 

    // Incluir o próximo ano de serviço SÓ SE for Setembro ou depois.
    if (monthIndex >= 8) {
        yearsList.add(currentEndYear + 1); 
    }
    
    return Array.from(yearsList).sort((a,b) => b - a); 
  }, []);

  // Mapeamento dos índices JS (0-11) para a ordem do Ano de Serviço (Setembro = 0)
  const availableMonths = useMemo(() => {
    // Array dos nomes dos meses na ordem do ano de serviço (Setembro a Agosto)
    return MESES; 
  }, []);
  
  
  // ------------------------------------------------------------------
  // 3. RENDERIZAÇÃO DOS CARDS ESTÁTICOS
  // ------------------------------------------------------------------
  
  const stats = [
    { 
      label: "Total de Publicadores", 
      value: statusRelatorios.length || "0", 
      change: `Grupos: ${gruposList.length}`, 
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
      label: `Relatórios (${selectedMonth}/${selectedYear})`, 
      // Mostra o status geral antes da filtragem:
      value: `${statusRelatorios.filter(p => p.status === 'Enviado').length} de ${statusRelatorios.length}`, 
      change: `${statusRelatorios.filter(p => p.status === 'Pendente').length} Pendentes`, 
      icon: TrendingUp, 
      color: "text-green-600", 
      bg: "bg-green-100",
      action: () => setIsSheetOpen(true) // Ação para abrir o modal
    },
  ];

  if (isPageLoading) return (
     <DashboardLayout>
       <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
         <Loader2 className="animate-spin text-purple-600 w-8 h-8" />
       </div>
     </DashboardLayout>
  );

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

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <Card 
              key={index} 
              className="border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-white cursor-pointer"
              onClick={stat.action || (() => {})}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 ${stat.bg} rounded-lg flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full border border-red-100">
                    {stat.change}
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* --- Grid de Acesso Rápido --- */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Acesso Rápido</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      
      {/* --- MODAL DE DETALHES DE RELATÓRIO --- */}
      <Sheet open={isSheetOpen} onOpenChange={(open) => {
          setIsSheetOpen(open);
          // Reseta os filtros ao fechar, mas mantém o mês/ano
          if (!open) {
             setSelectedGroup(''); 
             setSelectedStatus('');
             setSearchTerm('');
          }
      }}>
        <SheetContent side="right" className="w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl p-0 focus:outline-none flex flex-col bg-white">
          <SheetHeader className="p-6 border-b border-gray-200 bg-gray-50/50 flex flex-row items-center justify-between">
            <div className="flex flex-col text-left">
                <SheetTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-green-600" />
                    Status de Relatórios
                </SheetTitle>
                <SheetDescription className="text-sm text-gray-600">
                    Acompanhe quem enviou o relatório para o período selecionado.
                </SheetDescription>
            </div>
            
            <div className="flex items-center gap-3 pr-8">
               {/* BOTÃO DE IMPRESSÃO */}
               <Button 
                 variant="outline" 
                 size="sm" 
                 onClick={handlePrint}
                 className="hidden sm:flex border-gray-300 hover:bg-gray-100 text-gray-700"
               >
                 <Printer className="w-4 h-4 mr-2" />
                 Imprimir
               </Button>
            </div>

            <SheetClose className="absolute right-4 top-6 p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900">
                <X className="h-5 w-5" />
            </SheetClose>
          </SheetHeader>

          {/* Controles de Filtro */}
          <div className="p-6 pt-4 border-b border-gray-100 flex flex-col gap-4 shrink-0 bg-white">
             
             {/* Row 1: Mês / Ano */}
             <div className="flex gap-4 w-full">
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Mês</label>
                    <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    >
                        {availableMonths.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Ano de Serviço</label>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    >
                        {availableYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
             </div>

             {/* Row 2: Grupo / Status */}
             <div className="flex gap-4 w-full">
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Filtrar por Grupo</label>
                    <select 
                       value={selectedGroup} 
                       onChange={(e) => setSelectedGroup(e.target.value)}
                       className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    >
                        <option value="">Todos os Grupos</option>
                        {gruposList.map(g => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                        {/* Adicionar a opção 'Sem Grupo' se houver publicadores sem grupo */}
                        {statusRelatorios.some(p => p.nome_grupo === 'Sem Grupo') && (
                            <option value="Sem Grupo">Sem Grupo</option>
                        )}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                    <select 
                       value={selectedStatus} 
                       onChange={(e) => setSelectedStatus(e.target.value)}
                       className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    >
                        <option value="">Todos os Status</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Enviado">Enviado</option>
                    </select>
                </div>
             </div>

             {/* Row 3: Busca por Nome (NOVO) */}
             <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Buscar por Nome</label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="text"
                        placeholder="Nome do publicador..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full border border-gray-300 rounded-md pl-10 pr-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X size={14} />
                        </button>
                    )}
                </div>
             </div>
          </div>
          
          {/* Corpo da Lista */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
             {loadingStatus ? (
                 <div className="flex justify-center items-center h-40">
                     <Loader2 className="animate-spin text-green-600 w-6 h-6" />
                     <span className="ml-3 text-gray-600">Carregando status...</span>
                 </div>
             ) : errorStatus ? (
                 <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm">
                     Erro: {errorStatus}
                 </div>
             ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm font-semibold text-gray-700 bg-white p-3 rounded-md border border-gray-200 shadow-sm">
                        <span>Resumo:</span>
                        <div className="flex gap-3">
                            <span className="text-green-600">{enviados} Enviados</span>
                            <span className="text-gray-300">|</span>
                            <span className="text-red-600">{pendentes} Pendentes</span>
                        </div>
                    </div>
                    
                    {/* Lista Agrupada por Status (Pendentes primeiro) E ORDENADA POR NOME */}
                    {[...filteredRelatorios]
                        .sort((a, b) => {
                            // 1. Prioriza Pendentes (Z-A) -> Pendente > Enviado
                            if (a.status !== b.status) {
                                return b.status.localeCompare(a.status);
                            }
                            // 2. Dentro do mesmo status, ordena por Nome Completo (A-Z)
                            return a.nome_completo.localeCompare(b.nome_completo);
                        }) 
                        .map(pub => (
                        <div key={pub.id} className="flex items-center justify-between p-3 border-b border-gray-100 bg-white rounded-md hover:shadow-sm transition-all">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {pub.nome_completo}
                                </p>
                                <p className="text-xs text-gray-500">{pub.nome_grupo}</p>
                            </div>
                            <Link 
                                href={`/admin/gerenciar?id=${pub.id}`}
                                onClick={() => setIsSheetOpen(false)}
                                className={`flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
                                    pub.status === 'Enviado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                } hover:opacity-80`}
                                title="Ver detalhes do publicador"
                            >
                                {pub.status === 'Enviado' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                {pub.status}
                                <ArrowRight className="w-3 h-3 ml-1" />
                            </Link>
                        </div>
                    ))}
                    
                    {filteredRelatorios.length === 0 && (
                        <p className="text-center text-gray-500 italic mt-8 p-4 border border-dashed border-gray-300 rounded-md">
                            Nenhum registro encontrado com os filtros aplicados.
                        </p>
                    )}
                </div>
             )}
          </div>
          
          <div className="p-4 border-t border-gray-200 shrink-0 bg-white sm:hidden">
              <Button onClick={handlePrint} variant="outline" className="w-full mb-2">
                  <Printer className="w-4 h-4 mr-2" /> Imprimir Relatório
              </Button>
              <Button onClick={() => setIsSheetOpen(false)} className="w-full bg-purple-600 hover:bg-purple-700">
                  Fechar
              </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* --- COMPONENTE DE IMPRESSÃO (Escondido na tela, visível na impressão) --- */}
      {/* Este componente renderiza a tabela formatada para papel A4.
          Ele recebe os dados já filtrados da tela.
      */}
      <div className="printable-content">
         <ListaStatusImprimivel 
            dados={filteredRelatorios}
            mes={selectedMonth}
            ano={selectedYear}
            resumo={{ total: filteredRelatorios.length, enviados, pendentes }}
         />
      </div>

    </DashboardLayout>
  );
}