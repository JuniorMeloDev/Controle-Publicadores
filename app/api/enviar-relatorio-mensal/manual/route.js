// app/api/enviar-relatorio-mensal/manual/route.js

import { Pool } from '@neondatabase/serverless'; 
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const publicadorId = searchParams.get('publicadorId');

  if (!publicadorId) {
    return NextResponse.json(
      { message: 'ID do publicador não fornecido.' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    // Busca o publicador, o nome do seu grupo e suas designações
    const publicadorRes = await client.query(
      `SELECT 
         p.id, 
         p.nome_completo, 
         p.data_nascimento, 
         p.designacoes,  
         g.nome_grupo 
       FROM publicadores p
       LEFT JOIN grupos g ON p.grupo_id = g.id
       WHERE p.id = $1`,
      [publicadorId]
    );

    if (publicadorRes.rows.length === 0) {
      return NextResponse.json(
        { message: 'Publicador não encontrado.' },
        { status: 404 }
      );
    }

    const publicador = publicadorRes.rows[0];

    return NextResponse.json(publicador, { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar publicador:', err);
    return NextResponse.json(
      { message: 'Erro ao buscar dados do publicador.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function POST(req) {
  const body = await req.json();
  
  const {
    publicadorId,
    mes,
    ano_servico,
    ...dadosDoRelatorio 
  } = body;

  if (!publicadorId || !mes || !ano_servico) {
     return NextResponse.json(
      { message: 'Dados de relatório incompletos.' },
      { status: 400 }
    );
  }
  
  const client = await pool.connect();

  try {
    // 1. Verificar se publicador existe
    const publicadorRes = await client.query(
      'SELECT id FROM publicadores WHERE id = $1',
      [publicadorId]
    );

    if (publicadorRes.rows.length === 0) {
      return NextResponse.json(
        { message: 'Publicador não encontrado.' },
        { status: 404 }
      );
    }

    // 2. Lógica de Anulação/Exclusão: Se todos os campos de serviço estiverem vazios/falsos.
    const relatorioVazio = !dadosDoRelatorio.participou_ministerio &&
                         !dadosDoRelatorio.pioneiro_auxiliar &&
                         !dadosDoRelatorio.estudos_biblicos &&
                         !dadosDoRelatorio.horas;

    if (relatorioVazio) {
        // Se o relatório está vazio, tentamos ANULAR/DELETAR o registro existente.
        const deleteRes = await client.query(
            `DELETE FROM relatorios_mensais 
             WHERE publicador_id = $1 AND mes = $2 AND ano_servico = $3`,
            [publicadorId, mes, ano_servico]
        );
        
        if (deleteRes.rowCount > 0) {
            return NextResponse.json({ message: 'Relatório anulado com sucesso.' }, { status: 200 });
        } else {
            // Se não havia registro, retornamos sucesso silencioso.
            return NextResponse.json({ message: 'Nenhum relatório a ser anulado.' }, { status: 200 });
        }
    }


    // 3. Lógica de Inserção/Atualização (UPSERT para salvar/atualizar)
    await client.query(
      `INSERT INTO relatorios_mensais 
       (publicador_id, mes, ano_servico, participou_ministerio, pioneiro_auxiliar, estudos_biblicos, horas, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (publicador_id, mes, ano_servico) 
       DO UPDATE SET
           participou_ministerio = EXCLUDED.participou_ministerio,
           pioneiro_auxiliar = EXCLUDED.pioneiro_auxiliar,
           estudos_biblicos = EXCLUDED.estudos_biblicos,
           horas = EXCLUDED.horas,
           observacoes = EXCLUDED.observacoes`,
      [
        publicadorId,
        mes,
        ano_servico,
        dadosDoRelatorio.participou_ministerio,
        dadosDoRelatorio.pioneiro_auxiliar,
        dadosDoRelatorio.estudos_biblicos || null,
        dadosDoRelatorio.horas || null,
        dadosDoRelatorio.observacoes || null
      ]
    );

    return NextResponse.json(
      { message: 'Relatório salvo/atualizado com sucesso!' },
      { status: 200 }
    );

  } catch (err) {
    console.error('Erro no banco de dados (manual):', err);
    return NextResponse.json(
      { message: 'Erro interno ao salvar/atualizar o relatório.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}