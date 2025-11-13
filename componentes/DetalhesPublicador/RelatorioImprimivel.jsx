'use client';

// Define o ano de serviço
const MESES_ANO_SERVICO = [
  'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Janeiro', 'Fevereiro',
  'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto'
];

export default function RelatorioImprimivel({ publicador, relatorios }) {
  // Mapear valores para exibição
  const mapSexo = (sexo) => {
    const map = { 'Masculino': 'Masculino', 'Feminino': 'Feminino' };
    return map[sexo] || 'Não informado';
  };

  const mapEsperanca = (esperanca) => {
    const map = {
      'Ungido': 'Ungido',
      'Outras Ovelhas': 'Outras Ovelhas'
    };
    return map[esperanca] || 'Não informado';
  };

  // Extrair dados do publicador
  const nome = publicador?.nome_completo || '';
  const dataNasc = publicador?.data_nascimento || 'Não informado';
  const dataBatismo = publicador?.data_batismo || 'Não batizado';
  const sexo = mapSexo(publicador?.sexo);
  const esperanca = mapEsperanca(publicador?.esperanca);

  // Processar relatórios por mês
  const relatoriosPorMes = {};
  if (relatorios && relatorios.length > 0) {
    relatorios.forEach(rel => {
      const mes = rel.mes || 'Desconhecido';
      if (!relatoriosPorMes[mes]) {
        relatoriosPorMes[mes] = rel;
      }
    });
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-0">
      {/* CABEÇALHO */}
      <div className="text-center mb-6 border-b-2 border-black pb-4">
        <h1 className="text-xl font-bold mb-2">REGISTRO DE PUBLICADOR DE CONGREGAÇÃO</h1>
        <p className="text-sm">Ano de Serviço 2025</p>
      </div>

      {/* INFORMAÇÕES PESSOAIS */}
      <div className="mb-6 border border-black p-4">
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

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs font-bold">Data de Batismo:</p>
            <p className="text-sm border-b border-black">{dataBatismo}</p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={sexo === 'Masculino'}
                disabled
                className="h-4 w-4"
              />
              <label className="text-xs font-bold">Masculino</label>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={sexo === 'Feminino'}
                disabled
                className="h-4 w-4"
              />
              <label className="text-xs font-bold">Feminino</label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={esperanca === 'Ungido'}
                disabled
                className="h-4 w-4"
              />
              <label className="text-xs font-bold">Ungido</label>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={esperanca === 'Outras Ovelhas'}
                disabled
                className="h-4 w-4"
              />
              <label className="text-xs font-bold">Outras Ovelhas</label>
            </div>
          </div>
          <div className="flex gap-4">
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
          </div>
        </div>
      </div>

      {/* TABELA DE SERVIÇO */}
      <div className="mb-4">
        <h2 className="font-bold text-sm mb-2">Ano de Serviço 2025</h2>
        <table className="w-full border-collapse border border-black">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-2 text-xs font-bold">Mês</th>
              <th className="border border-black p-2 text-xs font-bold">Participou no ministério</th>
              <th className="border border-black p-2 text-xs font-bold">Estudos</th>
              <th className="border border-black p-2 text-xs font-bold">Pioneiro Auxiliar</th>
              <th className="border border-black p-2 text-xs font-bold">Horas</th>
              <th className="border border-black p-2 text-xs font-bold">Observações</th>
            </tr>
          </thead>
          <tbody>
            {MESES_ANO_SERVICO.map((mes) => {
              const rel = relatoriosPorMes[mes] || {};
              const Box = ({ checked }) => (
                <span
                  style={{
                    display: 'inline-block',
                    width: 16,
                    height: 16,
                    border: '1px solid #000',
                    textAlign: 'center',
                    lineHeight: '14px',
                    fontSize: 12,
                    color: '#000',
                    verticalAlign: 'middle'
                  }}
                  aria-hidden
                >
                  {checked ? '✔' : '\u00A0'}
                </span>
              );

              return (
                <tr key={mes}>
                  <td className="border border-black p-2 text-xs">{mes}</td>
                  <td className="border border-black p-2 text-center text-xs">
                    <Box checked={!!rel.participacoes} />
                  </td>
                  <td className="border border-black p-2 text-center text-xs">
                    {rel.estudos || ''}
                  </td>
                  <td className="border border-black p-2 text-center text-xs">
                    <Box checked={!!rel.pioneiro_auxiliar} />
                  </td>
                  <td className="border border-black p-2 text-center text-xs">
                    {rel.horas || ''}
                  </td>
                  <td className="border border-black p-2 text-xs text-gray-600">
                    {rel.observacoes || ''}
                  </td>
                </tr>
              );
            })}
            <tr className="font-bold bg-gray-100">
              <td className="border border-black p-2 text-xs">Total</td>
              <td className="border border-black p-2 text-center text-xs">
                {relatorios?.filter(r => r.participacoes).length || 0}
              </td>
              <td className="border border-black p-2 text-center text-xs">
                {relatorios?.reduce((sum, r) => sum + (r.estudos || 0), 0) || 0}
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

      {/* FOOTER */}
      <div className="text-center text-xs text-gray-600 mt-4">
        <p>Relatório gerado automaticamente</p>
      </div>
    </div>
  );
}