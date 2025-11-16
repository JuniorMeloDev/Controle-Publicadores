import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Rota: POST /api/admin/batch-update-relatorios
export async function POST(request) {
  const body = await request.json();
  const { publicadorId, relatorios } = body; // Recebe o ID e a lista de relatórios

  if (!publicadorId || !Array.isArray(relatorios)) {
    return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    // Inicia uma transação
    await client.query('BEGIN');

    // Prepara a query de "UPSERT"
    // Tenta inserir, se já existir (pela chave publicador_id, mes, ano_servico),
    // ele atualiza os outros campos.
    const upsertQuery = `
      INSERT INTO relatorios_mensais (
        publicador_id, mes, ano_servico, 
        participou_ministerio, pioneiro_auxiliar, 
        estudos_biblicos, horas, observacoes
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (publicador_id, mes, ano_servico) 
      DO UPDATE SET
        participou_ministerio = EXCLUDED.participou_ministerio,
        pioneiro_auxiliar = EXCLUDED.pioneiro_auxiliar,
        estudos_biblicos = EXCLUDED.estudos_biblicos,
        horas = EXCLUDED.horas,
        observacoes = EXCLUDED.observacoes;
    `;

    // Executa o UPSERT para cada relatório na lista
    for (const rel of relatorios) {
      // Garante que valores "em branco" sejam salvos como NULL
      const estudos = rel.estudos_biblicos || null;
      const horas = rel.horas || null;
      const observacoes = rel.observacoes || null;
      
      await client.query(upsertQuery, [
        publicadorId,
        rel.mes,
        rel.ano_servico,
        rel.participou_ministerio || false,
        rel.pioneiro_auxiliar || false,
        estudos,
        horas,
        observacoes
      ]);
    }

    // Confirma a transação
    await client.query('COMMIT');

    return NextResponse.json({ message: 'Relatórios salvos com sucesso!' }, { status: 200 });

  } catch (err) {
    // Se der erro, desfaz tudo
    await client.query('ROLLBACK');
    console.error('Erro no batch update de relatórios:', err);
    return NextResponse.json({ message: 'Erro interno ao salvar relatórios.' }, { status: 500 });
  } finally {
    client.release();
  }
}