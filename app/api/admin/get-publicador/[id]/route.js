import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Rota: GET /api/admin/get-publicador/123
export async function GET(request, context) {
  const { id } = await context.params; // Pega o ID da URL

  if (!id) {
    return NextResponse.json({ message: 'ID do publicador é obrigatório' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Este SQL busca todos os campos do publicador e junta com
    // a tabela 'grupos' para pegar o 'nome_grupo'
    const res = await client.query(
      `SELECT 
         p.id, p.nome_completo, p.data_nascimento, 
         g.nome_grupo, p.privilegios, p.designacoes,
         p.telefone, p.email, p.cep, p.logradouro, 
         p.numero, p.complemento, p.bairro, p.cidade, p.estado
       FROM publicadores p
       LEFT JOIN grupos g ON p.grupo_id = g.id
       WHERE p.id = $1`,
      [id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ message: 'Publicador não encontrado' }, { status: 404 });
    }

    // Retorna o primeiro (e único) resultado
    return NextResponse.json(res.rows[0], { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar publicador:', err);
    return NextResponse.json({ message: 'Erro interno ao buscar publicador.' }, { status: 500 });
  } finally {
    client.release();
  }
}