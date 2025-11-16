'use client';

// Define o ano de serviço
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

  const inputBaseClass = "w-full text-center outline-none focus:ring-1 focus:ring-blue-500 focus:bg-blue-50";
  const inputDisabledClass = "bg-transparent disabled:border-none";
  const inputEnabledClass = "bg-neutral-100 border border-neutral-300 rounded-sm";
  const checkboxClass = "h-4 w-4 accent-blue-600";
  
  return (
    <div className="w-full max-w-4xl mx-auto p-0">
      {/* CABEÇALHO */}
      <div className="text-center mb-6 border-b-2 border-black pb-4">
        <h1 className="text-xl font-bold mb-2">REGISTRO DE PUBLICADOR DE CONGREGAÇÃO</h1>
      </div>

      {/* --- INFORMAÇÕES PESSOAIS (LAYOUT CORRIGIDO) --- */}
      <div className="mb-6 border border-black p-4">
        {/* Linha 1: Nome e Data de Nascimento */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs font-bold">Nome:</p>
            <p className="text-sm border-b border-black">{nome}</p>
          </div>
          <div>
            <p className="text-xs font-bold">Data de Nascimento:</p>
            <p className="text-sm border-b border-black">{dataNasc}</p>
          </div>
        </div>

        {/* Linha 2: Batismo, Sexo e Esperança */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Coluna 1: Batismo */}
          <div>
            <p className="text-xs font-bold">Data de Batismo:</p>
            <p className="text-sm border-b border-black">{dataBatismo}</p>
          </div>
          
          {/* Coluna 2: Sexo e Esperança (Empilhados) */}
          <div className="flex flex-col gap-2"> {/* Alterado para flex-col */}
            {/* Sexo */}
            <div className="flex gap-11">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={sexo === 'Masculino'} disabled className="h-4 w-4" />
                <label className="text-xs font-bold">Masculino</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={sexo === 'Feminino'} disabled className="h-4 w-4" />
                <label className="text-xs font-bold">Feminino</label>
              </div>
            </div>
            {/* Esperança (Movido para cá) */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={esperanca === 'Outras Ovelhas'} disabled className="h-4 w-4" />
                <label className="text-xs font-bold">Outras Ovelhas</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={esperanca === 'Ungido'} disabled className="h-4 w-4" />
                <label className="text-xs font-bold">Ungido</label>
              </div>
              
            </div>
          </div>
        </div>

        {/* Linha 3: Privilégios e Designações (Combinados) */}
        <div className="grid grid-cols-1 gap-4 mt-4">
          <div className="flex flex-wrap gap-x-4 gap-y-2 col-span-2">
            {/* Privilégios */}
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={publicador?.privilegios?.includes('anciao') || false} 
                disabled 
                className="h-4 w-4" 
              />
              <label className="text-xs font-bold">Ancião</label>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={publicador?.privilegios?.includes('servo_ministerial') || false} 
                disabled 
                className="h-4 w-4" 
              />
              <label className="text-xs font-bold">Servo Ministerial</label>
            </div>
            
            {/* Designações */}
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={publicador?.designacoes?.includes('pioneiro_regular') || false}
                disabled
                className="h-4 w-4"
              />
              <label className="text-xs font-bold">Pioneiro Regular</label>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={publicador?.designacoes?.includes('pioneiro_especial') || false}
                disabled
                className="h-4 w-4"
              />
              <label className="text-xs font-bold">Pioneiro Especial</label>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={publicador?.designacoes?.includes('missionario') || false}
                disabled
                className="h-4 w-4"
              />
              <label className="text-xs font-bold">Missionário em Campo</label>
            </div>
          </div>
        </div>
      </div>
      {/* --- FIM DAS INFORMAÇÕES PESSOAIS --- */}


      {/* TABELA DE SERVIÇO (Sem alteração) */}
      <div className="mb-4">
        <h2 className="font-bold text-sm mb-2">Ano de Serviço {anoServico}</h2>
        <table className="w-full border-collapse border border-black">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-2 text-xs font-bold">Mês</th>
              <th className="border border-black p-2 text-xs font-bold">Participou</th>
              <th className="border border-black p-2 text-xs font-bold">Estudos</th>
              <th className="border border-black p-2 text-xs font-bold">Pioneiro Aux.</th>
              <th className="border border-black p-2 text-xs font-bold">Horas</th>
              <th className="border border-black p-2 text-xs font-bold">Observações</th>
            </tr>
          </thead>
          <tbody>
            {MESES_ANO_SERVICO.map((mes) => {
              const rel = relatoriosPorMes.get(mes) || { mes }; 

              return (
                <tr key={mes}>
                  <td className="border border-black p-2 text-xs">{mes}</td>
                  
                  <td className="border border-black p-0 text-center text-xs">
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      disabled={!isEditing}
                      checked={rel.participou_ministerio || false}
                      onChange={(e) => onRelatorioChange(mes, 'participou_ministerio', e.target.checked)}
                    />
                  </td>
                  
                  <td className="border border-black p-0 text-center text-xs">
                    <input
                      type="number"
                      min="0"
                      className={`${inputBaseClass} ${isEditing ? inputEnabledClass : inputDisabledClass}`}
                      disabled={!isEditing}
                      value={rel.estudos_biblicos || ''}
                      onChange={(e) => onRelatorioChange(mes, 'estudos_biblicos', e.target.value === '' ? null : parseInt(e.target.value))}
                    />
                  </td>
                  
                  <td className="border border-black p-0 text-center text-xs">
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      disabled={!isEditing}
                      checked={rel.pioneiro_auxiliar || false}
                      onChange={(e) => onRelatorioChange(mes, 'pioneiro_auxiliar', e.target.checked)}
                    />
                  </td>
                  
                  <td className="border border-black p-0 text-center text-xs">
                    <input
                      type="number"
                      min="0"
                      className={`${inputBaseClass} ${isEditing ? inputEnabledClass : inputDisabledClass}`}
                      disabled={!isEditing}
                      value={rel.horas || ''}
                      onChange={(e) => onRelatorioChange(mes, 'horas', e.target.value === '' ? null : parseInt(e.target.value))}
                    />
                  </td>
                  
                  <td className="border border-black p-0 text-xs text-gray-600">
                    <input
                      type="text"
                      className={`${inputBaseClass} text-left px-1 ${isEditing ? inputEnabledClass : inputDisabledClass}`}
                      disabled={!isEditing}
                      value={rel.observacoes || ''}
                      onChange={(e) => onRelatorioChange(mes, 'observacoes', e.target.value === '' ? null : e.target.value)}
                    />
                  </td>
                </tr>
              );
            })}
            
            <tr className="font-bold bg-gray-100">
              <td className="border border-black p-2 text-xs">Total</td>
              <td className="border border-black p-2 text-center text-xs">
                {relatorios?.filter(r => r.participou_ministerio).length || 0}
              </td>
              <td className="border border-black p-2 text-center text-xs">
                {/* Deixado em branco */}
              </td>
              <td className="border border-black p-2 text-center text-xs">
                {relatorios?.filter(r => r.pioneiro_auxiliar).length || 0}
              </td>
              <td className="border border-black p-2 text-center text-xs">
                {relatorios?.reduce((sum, r) => sum + (r.horas || 0), 0) || 0}
              </td>
              <td className="border border-black p-2 text-xs"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}