
import React from 'react';

export default function ListaStatusImprimivel({ dados, mes, ano, resumo }) {
  // Ordenação para impressão: Status (Pendente > Enviado) e depois Nome
  const dadosOrdenados = [...dados].sort((a, b) => {
    if (a.status !== b.status) return b.status.localeCompare(a.status);
    return a.nome_completo.localeCompare(b.nome_completo);
  });

  return (
    <div className="w-full max-w-[210mm] mx-auto p-0 bg-white text-black font-sans">
      {/* Cabeçalho do Relatório */}
      <div className="text-center mb-6 border-b-2 border-black pb-4">
        <h1 className="text-2xl font-bold uppercase tracking-wide">Status de Relatórios de Serviço</h1>
        <p className="text-lg font-medium mt-1">Período: {mes} / {ano}</p>
      </div>

      {/* Resumo Estatístico */}
      <div className="mb-6 flex justify-between text-sm font-medium border border-gray-400 p-3 bg-gray-50 rounded-sm">
         <span>Total de Publicadores: <strong className="text-base">{resumo.total}</strong></span>
         <span>Enviados: <strong className="text-base">{resumo.enviados}</strong></span>
         <span>Pendentes: <strong className="text-base">{resumo.pendentes}</strong></span>
      </div>

      {/* Tabela de Dados */}
      <table className="w-full border-collapse border border-black text-sm">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-black p-2 text-left w-1/2">Nome</th>
            <th className="border border-black p-2 text-left w-1/3">Grupo</th>
            <th className="border border-black p-2 text-center w-1/6">Status</th>
          </tr>
        </thead>
        <tbody>
          {dadosOrdenados.map((pub, index) => (
            <tr key={pub.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="border border-black px-2 py-1.5 align-middle">
                {pub.nome_completo}
              </td>
              <td className="border border-black px-2 py-1.5 align-middle text-xs">
                {pub.nome_grupo}
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-bold align-middle">
                {pub.status === 'Enviado' ? (
                  <span>Enviado</span>
                ) : (
                  <span>Pendente</span>
                )}
              </td>
            </tr>
          ))}
          
          {dadosOrdenados.length === 0 && (
            <tr>
              <td colSpan="3" className="border border-black p-4 text-center text-gray-500 italic">
                Nenhum registro encontrado com os filtros atuais.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      
      {/* Rodapé */}
      <div className="mt-8 text-[10px] text-right text-gray-500 border-t border-gray-300 pt-2">
        Relatório gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
      </div>
    </div>
  );
}
