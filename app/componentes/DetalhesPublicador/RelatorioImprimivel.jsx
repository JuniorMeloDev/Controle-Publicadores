'use client';

import S21Card from '@/app/components/relatorios/S21Card';

export default function RelatorioImprimivel({ 
  publicador, 
  relatorios,
  anoServico = new Date().getFullYear() // Default fallback
}) {

  // Transforma os dados "flat" do publicador no formato que o S21Card espera
  const publisherData = {
    info: {
      nome: publicador?.nome_completo || '',
      nascimento: publicador?.data_nascimento,
      batismo: publicador?.data_batismo,
      sexo: publicador?.sexo,
      esperanca: publicador?.esperanca,
      privilegios: publicador?.privilegios || [],
      designacoes: publicador?.designacoes || []
    },
    reports: relatorios || []
  };

  // Se anoServico não for passado, tenta pegar do primeiro relatório ou usa atual
  // Mas DetalhesPublicador geralmente não passa anoServico explícito no componente principal, 
  // vamos assumir o ano atual ou tentar inferir.
  // Na verdade, o S21Card filtra pelo anoServico. 
  // O componente DetalhesPublicador no activeTab='atividades' tem um seletor de ano, mas ele não passa pro RelatorioImprimivel.
  // Vamos ver se conseguimos pegar o ano dos relatórios para mostrar TUDO ou se devemos apenas mostrar o ano atual.
  // O S21Card filtra: const yearReports = reports.filter(r => Number(r.ano_servico) === Number(serviceYear));
  
  // HACK: Para garantir que mostra dados da tela atual, vamos passar '2026' (ou o que estiver). 
  // Mas o RelatorioImprimivel está fora do escopo do seletor de ano de AtividadesTeocraticas.
  // Para ser consistente, vamos mostrar o ano corrente do sistema ou idealmente receber via prop.
  // Vou usar o ano atual + 1 se for >= Setembro, lógica padrão de ano de serviço.
  
  const currentServiceYear = new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear();
  const yearToUse = anoServico || currentServiceYear;

  return (
    <>
       {/* Reutiliza o componente oficial S21Card sem wrappers adicionais que afetam o layout */}
       <S21Card 
         publisherData={publisherData} 
         serviceYear={yearToUse} 
       />
    </>
  );
}