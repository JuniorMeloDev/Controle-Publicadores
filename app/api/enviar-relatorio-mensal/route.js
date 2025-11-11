import { Pool } from '@neondatabase/serverless'; 
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  // A configuração 'ssl' foi removida
});

export async function POST(req) {
  const body = await req.json();
  
  // 1. RECEBER OS NOVOS DADOS
  const {
    nome_completo,
    data_nascimento,
    nome_grupo, // <-- NOVO CAMPO
    mes,
    ano_servico,
    ...dadosDoRelatorio 
  } = body;

  const client = await pool.connect();

  try {
    // 2. PASSO A: Validar o Grupo de Campo
    const grupoRes = await client.query(
      'SELECT id FROM grupos WHERE nome_grupo = $1',
      [nome_grupo]
    );
    const grupo = grupoRes.rows[0];

    if (!grupo) {
      return NextResponse.json(
        { message: 'Grupo de Campo não encontrado. Verifique o nome digitado.' },
        { status: 404 }
      );
    }

    // 3. PASSO B: Validar o Publicador (agora com 3 campos)
    const publicadorRes = await client.query(
      'SELECT id FROM publicadores WHERE nome_completo = $1 AND data_nascimento = $2 AND grupo_id = $3',
      [nome_completo, data_nascimento, grupo.id] // <-- USA O ID DO GRUPO
    );
    const publicador = publicadorRes.rows[0];

    if (!publicador) {
      return NextResponse.json(
        { message: 'Identificação falhou. Verifique se Nome, Data de Nascimento ou Grupo estão corretos.' },
        { status: 404 }
      );
    }

    // 4. PASSO C: Inserir o Relatório (sem mudança)
    await client.query(
      `INSERT INTO relatorios_mensais 
       (publicador_id, mes, ano_servico, participou_ministerio, pioneiro_auxiliar, estudos_biblicos, horas, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        publicador.id,
        mes,
        ano_servico,
        dadosDoRelatorio.participou_ministerio,
        dadosDoRelatorio.pioneiro_auxiliar,
        dadosDoRelatorio.estudos_biblicos || null,
        dadosDoRelatorio.horas || null,
        dadosDoRelatorio.observacoes || null
      ]
    );

    // 5. Sucesso
    return NextResponse.json(
      { message: 'Relatório enviado com sucesso!' },
      { status: 200 }
    );

  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json(
        { message: `O relatório de ${mes} já foi enviado.` },
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