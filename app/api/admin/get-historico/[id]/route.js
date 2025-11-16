import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Rota: GET /api/admin/get-historico/123
export async function GET(request, context) {
  const { id } = await context.params; // Pega o ID do publicador

  if (!id) {
    return NextResponse.json({ message: 'ID do publicador é obrigatório' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // 1. Buscar o histórico de alterações pessoais
    const historicoPessoalRes = await client.query(
      `SELECT 
         id, 
         data_mudanca as data_evento, 
         campo_alterado, 
         valor_antigo, 
         valor_novo,
         'pessoal' as tipo_evento
       FROM publicador_historico
       WHERE publicador_id = $1`,
      [id]
    );

    // 2. Buscar o histórico de designações de reunião
    const designacoesRes = await client.query(
      `SELECT 
         id, 
         data_reuniao as data_evento, 
         descricao_semana, 
         nome_parte,
         'designacao' as tipo_evento
       FROM designacoes_reuniao
       WHERE publicador_id = $1`,
      [id]
    );

    // 3. Combinar os dois resultados
    const historicoCombinado = [
      ...historicoPessoalRes.rows,
      ...designacoesRes.rows
    ];

    // 4. Ordenar os resultados combinados pela data_evento (mais novo primeiro)
    historicoCombinado.sort((a, b) => {
      return new Date(b.data_evento) - new Date(a.data_evento);
    });

    // 5. Retornar a linha do tempo completa
    return NextResponse.json(historicoCombinado, { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    return NextResponse.json({ message: 'Erro interno ao buscar histórico.' }, { status: 500 });
  } finally {
    client.release();
  }
}