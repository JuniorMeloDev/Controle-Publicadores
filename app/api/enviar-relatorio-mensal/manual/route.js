// Em app\api\enviar-relatorio-mensal\manual\route.js

import { Pool } from '@neondatabase/serverless'; 
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

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
    // ----- MUDANÇA AQUI -----
    // Buscamos o publicador e o nome do seu grupo
    const publicadorRes = await client.query(
      `SELECT 
         p.id, 
         p.nome_completo, 
         p.data_nascimento, 
         g.nome_grupo 
       FROM publicadores p
       LEFT JOIN grupos g ON p.grupo_id = g.id
       WHERE p.id = $1`,
      [publicadorId]
    );
    // ----- FIM DA MUDANÇA -----

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

  const client = await pool.connect();

  try {
    // Verificar se publicador existe
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

    // Inserir o relatório
    await client.query(
      `INSERT INTO relatorios_mensais 
       (publicador_id, mes, ano_servico, participou_ministerio, pioneiro_auxiliar, estudos_biblicos, horas, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
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
      { message: 'Relatório enviado com sucesso!' },
      { status: 200 }
    );

  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json(
        { message: `O relatório de ${body.mes} já foi enviado.` },
        { status: 409 }
      );
    }
    console.error('Erro no banco de dados:', err);
    return NextResponse.json(
      { message: 'Erro interno ao salvar o relatório.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}