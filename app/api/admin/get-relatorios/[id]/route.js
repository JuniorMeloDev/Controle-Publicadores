import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Rota: GET /api/admin/get-relatorios/123
export async function GET(request, context) {
  const { id } = await context.params; // Pega o ID do publicador

  if (!id) {
    return NextResponse.json({ message: 'ID do publicador é obrigatório' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Busca todos os relatórios de um publicador, ordenados do mais novo para o mais antigo
    const res = await client.query(
      `SELECT * FROM relatorios_mensais
       WHERE publicador_id = $1
       ORDER BY ano_servico DESC, 
                -- Ordena os meses na ordem correta do ano de serviço (Setembro = 1, Agosto = 12)
                CASE
                  WHEN mes = 'Setembro' THEN 1
                  WHEN mes = 'Outubro' THEN 2
                  WHEN mes = 'Novembro' THEN 3
                  WHEN mes = 'Dezembro' THEN 4
                  WHEN mes = 'Janeiro' THEN 5
                  WHEN mes = 'Fevereiro' THEN 6
                  WHEN mes = 'Março' THEN 7
                  WHEN mes = 'Abril' THEN 8
                  WHEN mes = 'Maio' THEN 9
                  WHEN mes = 'Junho' THEN 10
                  WHEN mes = 'Julho' THEN 11
                  WHEN mes = 'Agosto' THEN 12
                  ELSE 13
                END ASC`,
      [id]
    );

    // Retorna a lista de relatórios (pode ser vazia)
    return NextResponse.json(res.rows, { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar relatórios:', err);
    return NextResponse.json({ message: 'Erro interno ao buscar relatórios.' }, { status: 500 });
  } finally {
    client.release();
  }
}