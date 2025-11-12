import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function POST(req) {
  const body = await req.json();
  const { 
    nome_completo, 
    data_nascimento, 
    nome_grupo, 
    senha, 
    privilegios, 
    designacoes,
    telefone,
    email,
    cep,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    estado
  } = body;

  if (!nome_completo || !data_nascimento || !nome_grupo) {
    return NextResponse.json({ message: 'Nome, Data de Nascimento e Grupo são obrigatórios.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    let hashSenha = null;
    if (senha && senha.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      hashSenha = await bcrypt.hash(senha, salt);
    }

    const finalPrivilegios = privilegios.length > 0 ? privilegios : null;
    const finalDesignacoes = designacoes.length > 0 ? designacoes : null;

    const grupoRes = await client.query('SELECT id FROM grupos WHERE nome_grupo = $1', [nome_grupo]);
    const grupo = grupoRes.rows[0];

    if (!grupo) {
      return NextResponse.json({ message: 'Grupo de Campo não encontrado.' }, { status: 404 });
    }

    // --- QUERY ATUALIZADA PARA INSERIR TUDO ---
    await client.query(
      `INSERT INTO publicadores (
         nome_completo, data_nascimento, grupo_id, senha, privilegios, designacoes,
         telefone, email, cep, logradouro, numero, complemento, bairro, cidade, estado
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        nome_completo, data_nascimento, grupo.id, hashSenha, finalPrivilegios, finalDesignacoes,
        telefone || null, email || null, cep || null, logradouro || null, numero || null, 
        complemento || null, bairro || null, cidade || null, estado || null
      ]
    );

    return NextResponse.json({ message: 'Publicador cadastrado com sucesso!' }, { status: 201 });

  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ message: 'Um publicador com este Nome Completo já existe.' }, { status: 409 });
    }
    console.error('Erro ao criar publicador:', err);
    return NextResponse.json({ message: 'Erro interno ao salvar o publicador.' }, { status: 500 });
  } finally {
    client.release();
  }
}