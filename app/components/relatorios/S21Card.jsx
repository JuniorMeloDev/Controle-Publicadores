import React from 'react';

// Constantes de layout para impressão
const ROW_HEIGHT = "h-8";
const COL_WIDTH_MONTH = "w-24";
const COL_WIDTH_DATA = "w-16";
const BORDER_CLASS = "border border-black";

const MONTHS = [
  "Setembro", "Outubro", "Novembro", "Dezembro", "Janeiro", "Fevereiro", 
  "Março", "Abril", "Maio", "Junho", "Julho", "Agosto"
];

// Função simples para formatar data (PT-BR)
// Função simples para formatar data (PT-BR)
const formatDate = (dateString) => {
    if (!dateString) return "";
    
    // Se já estiver no formato DD/MM/YYYY, retorna direto ou valida
    if (typeof dateString === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
       return dateString;
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return ""; // Validação extra
    
    // Adiciona +3h para compensar fuso horário se necessário, ou usa UTC
    // Mas para simplificar, usamos string simples
    return date.toLocaleDateString('pt-BR');
};

// Helper para checkboxes de impressão (quadrado visual)
const CheckboxItem = ({ label, checked }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-3.5 h-3.5 border border-black flex items-center justify-center ${checked ? 'bg-black text-white' : 'bg-white'}`}>
       {checked && <div className="w-2 h-2 bg-black"></div>} {/* Simula o check preenchido, ou pode usar um icone svg se preferir */}
    </div>
    <span className="leading-none pt-0.5">{label}</span>
  </div>
);

const S21Card = ({ publisherData, serviceYear }) => {
  const { info, reports } = publisherData;
  
  // Filtra relatórios apenas do Ano de Serviço solicitado
  const yearReports = reports.filter(r => Number(r.ano_servico) === Number(serviceYear));
  
  // Cria um mapa para acesso rápido: { "Setembro": relatorioObj, ... }
  const reportsMap = {};
  yearReports.forEach(r => { reportsMap[r.mes] = r; });

  // Totais
  const totals = yearReports.reduce((acc, curr) => ({
    hours: acc.hours + (Number(curr.horas) || 0),
    studies: acc.studies + (Number(curr.estudos_biblicos) || 0), // Atualizado para estudos_biblicos
  }), { hours: 0, studies: 0 });

  return (
    <div className="w-[95%] max-w-[210mm] border-2 border-black p-4 bg-white text-black font-sans mx-auto page-break-inside-avoid mb-8 print:mb-2 print:break-inside-avoid relative print:w-full print:max-w-none">
       
       {/* Título Principal */}
       <div className="text-center mb-4">
           <h1 className="uppercase font-extrabold text-xl tracking-wide">REGISTRO DE PUBLICADOR DE CONGREGAÇÃO</h1>
           <p className="font-bold text-base mt-1">Ano de Serviço: {serviceYear}</p>
       </div>

       {/* Caixa de Informações Pessoais */}
       <div className="border-[3px] border-black p-3 mb-4">
           
           {/* Linha 1: Nome e Nascimento */}
           <div className="flex gap-8 mb-4">
               <div className="flex-1">
                   <div className="font-bold text-xs mb-1 uppercase">NOME:</div>
                   <div className="border-b border-black text-sm pb-0.5 font-bold uppercase truncate h-6">
                       {info?.nome}
                   </div>
               </div>
               <div className="w-1/3">
                   <div className="font-bold text-xs mb-1 uppercase">DATA DE NASCIMENTO:</div>
                   <div className="border-b border-black text-sm pb-0.5 font-bold h-6">
                       {formatDate(info?.nascimento)}
                   </div>
               </div>
           </div>

           {/* Linha 2: Batismo e Checkboxes (Sexo / Esperança) */}
           <div className="flex gap-8 mb-4 items-end">
               <div className="w-1/2">
                   <div className="font-bold text-xs mb-1 uppercase">DATA DE BATISMO:</div>
                   <div className="border-b border-black text-sm pb-0.5 font-bold h-6">
                       {formatDate(info?.batismo)}
                   </div>
               </div>
               <div className="w-1/2 grid grid-cols-2 gap-y-1 text-xs font-bold">
                   <CheckboxItem label="Masculino" checked={info?.sexo === 'Masculino'} />
                   <CheckboxItem label="Feminino" checked={info?.sexo === 'Feminino'} />
                   <CheckboxItem label="Outras Ovelhas" checked={info?.esperanca === 'Outras Ovelhas'} />
                   <CheckboxItem label="Ungido" checked={info?.esperanca === 'Ungido'} />
               </div>
           </div>

           {/* Linha 3: Privilégios (Checkboxes Inferiores) */}
           <div className="flex justify-between border-t border-gray-300 pt-3 mt-2 text-xs font-bold">
                <CheckboxItem label="Ancião" checked={info?.privilegios?.includes('anciao')} />
                <CheckboxItem label="Servo Ministerial" checked={info?.privilegios?.includes('servo_ministerial')} />
                <CheckboxItem label="Pioneiro Regular" checked={info?.designacoes?.includes('pioneiro_regular')} />
                <CheckboxItem label="Pioneiro Especial" checked={false} /> {/* Não mapeado no sistema ainda */}
                <CheckboxItem label="Missionário" checked={false} /> {/* Não mapeado ainda */}
           </div>
       </div>

       {/* TABELA - NOVO LAYOUT S-21 */}
       <table className="w-full border-collapse border-2 border-black text-center text-sm">
           <thead>
               <tr className="bg-blue-50">
                   <th className={`${BORDER_CLASS} ${COL_WIDTH_MONTH} py-2 font-bold bg-blue-50`}>Ano de serviço</th>
                   <th className={`${BORDER_CLASS} w-24 leading-none py-1`}>Participou no ministério</th>
                   <th className={`${BORDER_CLASS} ${COL_WIDTH_DATA} leading-none py-1`}>Estudos bíblicos</th>
                   <th className={`${BORDER_CLASS} w-20 leading-none py-1`}>Pioneiro auxiliar</th>
                   <th className={`${BORDER_CLASS} w-24 px-1 leading-none py-1`}>
                       <span className="block font-bold">Horas</span>
                       <span className="block text-[9px] font-normal">(Se for pioneiro ou missionário em campo)</span>
                   </th>
                   <th className={`${BORDER_CLASS} flex-1 font-bold`}>Observações</th>
               </tr>
           </thead>
           <tbody>
               {MONTHS.map(month => {
                   const report = reportsMap[month];
                   // Prioriza o campo 'participou_ministerio' se existir, senão infere de outros dados
                   const participou = report?.participou_ministerio || 
                                     (report && (report.publicacoes > 0 || report.videos > 0 || report.horas > 0 || report.revisitas > 0));
                   
                   return (
                       <tr key={month} className={ROW_HEIGHT}>
                           <td className={`${BORDER_CLASS} font-bold text-left px-2 bg-blue-50`}>{month}</td>
                           <td className={BORDER_CLASS}>
                               <div className="flex justify-center items-center h-full">
                                   {participou ? <div className="w-4 h-4 border border-black flex items-center justify-center"><div className="w-2.5 h-2.5 bg-black"></div></div> : <div className="w-4 h-4 border border-gray-300"></div>}
                               </div>
                           </td>
                           <td className={BORDER_CLASS}>{report?.estudos_biblicos || ''}</td>
                           <td className={BORDER_CLASS}>
                               <div className="flex justify-center items-center h-full">
                                    {report?.pioneiro_auxiliar ? <div className="w-4 h-4 border border-black flex items-center justify-center"><div className="w-2.5 h-2.5 bg-black"></div></div> : <div className="w-4 h-4 border border-gray-300"></div>}
                               </div>
                           </td>
                           
                           <td className={BORDER_CLASS}>{report?.horas || ''}</td>
                           <td className={`${BORDER_CLASS} text-left px-2 text-xs`}>
                               {report?.observacoes || ''}
                           </td>
                       </tr>
                   );
               })}
               {/* LINHA DE TOTAIS */}
               <tr className={`${ROW_HEIGHT} font-bold bg-blue-50`}>
                   <td className={`${BORDER_CLASS} text-right px-2 uppercase`}>Total</td>
                   <td className={`${BORDER_CLASS} bg-gray-200`}></td>
                   <td className={BORDER_CLASS}>{totals.studies || ''}</td>
                   <td className={`${BORDER_CLASS} bg-gray-200`}></td>
                   <td className={BORDER_CLASS}>{totals.hours || ''}</td>
                   <td className={`${BORDER_CLASS} bg-gray-200`}></td>
               </tr>
           </tbody>
       </table>
       
       <div className="mt-2 text-[10px] text-gray-500 text-center">
           Impresso via Sistema de Gestão Congregacional
       </div>
    </div>
  );
};

export default S21Card;
