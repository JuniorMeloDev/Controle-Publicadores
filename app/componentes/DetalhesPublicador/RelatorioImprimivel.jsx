'use client';

const MESES_ANO_SERVICO = [
  'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Janeiro', 'Fevereiro',
  'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto'
];

export default function RelatorioImprimivel({ 
  publicador, 
  relatorios,
  anoServico, 
  isEditing = false, 
  onRelatorioChange = () => {} 
}) {

  const mapSexo = (sexo) => {
    const map = { 'Masculino': 'Masculino', 'Feminino': 'Feminino' };
    return map[sexo] || 'Não informado';
  };
  const mapEsperanca = (esperanca) => {
    const map = { 'Ungido': 'Ungido', 'Outras Ovelhas': 'Outras Ovelhas' };
    return map[esperanca] || 'Não informado';
  };

  const nome = publicador?.nome_completo || '';
  const dataNasc = publicador?.data_nascimento || 'Não informado';
  const dataBatismo = publicador?.data_batismo || 'Não batizado';
  const sexo = mapSexo(publicador?.sexo);
  const esperanca = mapEsperanca(publicador?.esperanca);

  const relatoriosPorMes = new Map(relatorios.map(rel => [rel.mes, rel]));

  // --- CORREÇÃO DE CONTRASTE E ESTILO ---
  // Forçamos text-black e bg-transparent para impressão e visualização clara
  const inputBaseClass = "w-full text-center outline-none focus:ring-1 focus:ring-blue-500 focus:bg-blue-50 text-black font-medium";
  const inputDisabledClass = "bg-transparent border-none";
  const inputEnabledClass = "bg-white border border-gray-300 rounded-sm";
  const checkboxClass = "h-4 w-4 accent-black border-gray-400";
  // --------------------------------------

  return (
    <div className="w-full max-w-[210mm] mx-auto p-0 bg-white text-black">
      {/* CABEÇALHO */}
      <div className="text-center mb-4 border-b-2 border-black pb-2 pt-4">
        <h1 className="text-xl font-bold mb-1 text-black uppercase tracking-wide">Registro de Publicador de Congregação</h1>
        <p className="text-sm font-bold text-black">Ano de Serviço: {anoServico}</p>
      </div>

      {/* --- INFORMAÇÕES PESSOAIS --- */}
      <div className="mb-4 border-2 border-black p-3">
        {/* Linha 1: Nome e Data de Nascimento */}
        <div className="grid grid-cols-2 gap-6 mb-3">
          <div>
            <p className="text-xs font-bold text-black uppercase mb-1">Nome:</p>
            <p className="text-sm border-b border-black pb-0.5 text-black min-h-5">{nome}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-black uppercase mb-1">Data de Nascimento:</p>
            <p className="text-sm border-b border-black pb-0.5 text-black min-h-5">{dataNasc}</p>
          </div>
        </div>

        {/* Linha 2: Batismo, Sexo e Esperança */}
        <div className="grid grid-cols-2 gap-6 mb-3">
          <div>
            <p className="text-xs font-bold text-black uppercase mb-1">Data de Batismo:</p>
            <p className="text-sm border-b border-black pb-0.5 text-black min-h-5">{dataBatismo}</p>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="flex gap-8">
              <div className="flex items-center gap-1.5">
                <input type="checkbox" checked={sexo === 'Masculino'} disabled className={checkboxClass} />
                <label className="text-xs font-bold text-black">Masculino</label>
              </div>
              <div className="flex items-center gap-1.5">
                <input type="checkbox" checked={sexo === 'Feminino'} disabled className={checkboxClass} />
                <label className="text-xs font-bold text-black">Feminino</label>
              </div>
            </div>
            <div className="flex gap-8">
              <div className="flex items-center gap-1.5">
                <input type="checkbox" checked={esperanca === 'Outras Ovelhas'} disabled className={checkboxClass} />
                <label className="text-xs font-bold text-black">Outras Ovelhas</label>
              </div>
              <div className="flex items-center gap-1.5">
                <input type="checkbox" checked={esperanca === 'Ungido'} disabled className={checkboxClass} />
                <label className="text-xs font-bold text-black">Ungido</label>
              </div>
            </div>
          </div>
        </div>

        {/* Linha 3: Privilégios e Designações */}
        <div className="grid grid-cols-1 gap-2 mt-2 border-t border-black/50 pt-2">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-1.5">
              <input type="checkbox" checked={publicador?.privilegios?.includes('anciao') || false} disabled className={checkboxClass} />
              <label className="text-xs font-bold text-black">Ancião</label>
            </div>
            <div className="flex items-center gap-1.5">
              <input type="checkbox" checked={publicador?.privilegios?.includes('servo_ministerial') || false} disabled className={checkboxClass} />
              <label className="text-xs font-bold text-black">Servo Ministerial</label>
            </div>
            <div className="flex items-center gap-1.5">
              <input type="checkbox" checked={publicador?.designacoes?.includes('pioneiro_regular') || false} disabled className={checkboxClass} />
              <label className="text-xs font-bold text-black">Pioneiro Regular</label>
            </div>
            <div className="flex items-center gap-1.5">
              <input type="checkbox" checked={publicador?.designacoes?.includes('pioneiro_especial') || false} disabled className={checkboxClass} />
              <label className="text-xs font-bold text-black">Pioneiro Especial</label>
            </div>
            <div className="flex items-center gap-1.5">
              <input type="checkbox" checked={publicador?.designacoes?.includes('missionario') || false} disabled className={checkboxClass} />
              <label className="text-xs font-bold text-black">Missionário</label>
            </div>
          </div>
        </div>
      </div>

      {/* TABELA DE SERVIÇO */}
      <div className="mb-2">
        <table className="w-full border-collapse border-2 border-black text-sm">
          <thead>
            <tr className="bg-gray-100 print:bg-gray-200">
              <th className="border border-black p-1.5 text-xs font-bold text-black w-24">Mês</th>
              <th className="border border-black p-1.5 text-xs font-bold text-black w-16">Participou</th>
              <th className="border border-black p-1.5 text-xs font-bold text-black w-16">Estudos</th>
              <th className="border border-black p-1.5 text-xs font-bold text-black w-20">Pioneiro Aux.</th>
              <th className="border border-black p-1.5 text-xs font-bold text-black w-16">Horas</th>
              <th className="border border-black p-1.5 text-xs font-bold text-black">Observações</th>
            </tr>
          </thead>
          <tbody>
            {MESES_ANO_SERVICO.map((mes) => {
              const rel = relatoriosPorMes.get(mes) || { mes }; 

              return (
                <tr key={mes}>
                  <td className="border border-black p-1.5 font-medium text-black text-xs">{mes}</td>
                  
                  <td className="border border-black p-0 text-center align-middle">
                    <input
                      type="checkbox"
                      className={`${checkboxClass} mt-1`}
                      disabled={!isEditing}
                      checked={rel.participou_ministerio || false}
                      onChange={(e) => onRelatorioChange(mes, 'participou_ministerio', e.target.checked)}
                    />
                  </td>
                  
                  <td className="border border-black p-0 text-center align-middle">
                    <input
                      type="number"
                      min="0"
                      className={`${inputBaseClass} ${isEditing ? inputEnabledClass : inputDisabledClass}`}
                      disabled={!isEditing}
                      value={rel.estudos_biblicos || ''}
                      onChange={(e) => onRelatorioChange(mes, 'estudos_biblicos', e.target.value === '' ? null : parseInt(e.target.value))}
                    />
                  </td>
                  
                  <td className="border border-black p-0 text-center align-middle">
                    <input
                      type="checkbox"
                      className={`${checkboxClass} mt-1`}
                      disabled={!isEditing}
                      checked={rel.pioneiro_auxiliar || false}
                      onChange={(e) => onRelatorioChange(mes, 'pioneiro_auxiliar', e.target.checked)}
                    />
                  </td>
                  
                  <td className="border border-black p-0 text-center align-middle">
                    <input
                      type="number"
                      min="0"
                      className={`${inputBaseClass} ${isEditing ? inputEnabledClass : inputDisabledClass}`}
                      disabled={!isEditing}
                      value={rel.horas || ''}
                      onChange={(e) => onRelatorioChange(mes, 'horas', e.target.value === '' ? null : parseInt(e.target.value))}
                    />
                  </td>
                  
                  <td className="border border-black p-0 align-middle">
                    <input
                      type="text"
                      className={`${inputBaseClass} text-left px-2 ${isEditing ? inputEnabledClass : inputDisabledClass}`}
                      disabled={!isEditing}
                      value={rel.observacoes || ''}
                      onChange={(e) => onRelatorioChange(mes, 'observacoes', e.target.value === '' ? null : e.target.value)}
                    />
                  </td>
                </tr>
              );
            })}
            
            {/* Linha de Total */}
            <tr className="bg-gray-50 font-bold print:bg-gray-100">
              <td className="border border-black p-2 text-xs text-black text-right pr-4">Total</td>
              <td className="border border-black p-2 text-center text-xs text-black">
                {relatorios?.filter(r => r.participou_ministerio).length || 0}
              </td>
              <td className="border border-black p-2 text-center text-xs text-black">
                {/* Geralmente não se soma estudos, mas se quiser: */}
                 {/* {relatorios?.reduce((sum, r) => sum + (r.estudos_biblicos || 0), 0) || 0} */}
              </td>
              <td className="border border-black p-2 text-center text-xs text-black">
                {relatorios?.filter(r => r.pioneiro_auxiliar).length || 0}
              </td>
              <td className="border border-black p-2 text-center text-xs text-black">
                {relatorios?.reduce((sum, r) => sum + (r.horas || 0), 0) || 0}
              </td>
              <td className="border border-black p-2"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}