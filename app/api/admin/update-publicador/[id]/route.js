import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Rota: PUT /api/admin/update-publicador/123
export async function PUT(request, context) {
  const { id } = await context.params; // Pega o ID da URL
  const body = await request.json();   // Pega os dados do formulário

  const { 
    nome_completo, data_nascimento, data_batismo, nome_grupo, senha, 
    privilegios, designacoes, telefone, email, cep, 
    logradouro, numero, complemento, bairro, cidade, estado
  } = body;

  if (!id || !nome_completo || !data_nascimento || !nome_grupo) {
    return NextResponse.json({ message: 'ID, Nome, Data de Nascimento e Grupo são obrigatórios.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    // 1. Criptografa a nova senha (APENAS se uma nova foi digitada)
    let hashSenha = null;
    if (senha && senha.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      hashSenha = await bcrypt.hash(senha, salt);
    }

    // 2. Encontra o ID do grupo (igual ao 'create')
    const grupoRes = await client.query('SELECT id FROM grupos WHERE nome_grupo = $1', [nome_grupo]);
    if (grupoRes.rows.length === 0) {
      return NextResponse.json({ message: 'Grupo não encontrado.' }, { status: 404 });
    }
    const grupo_id = grupoRes.rows[0].id;

    // 3. Garante que arrays vazios sejam salvos como NULL
    const finalPrivilegios = privilegios.length > 0 ? privilegios : null;
    const finalDesignacoes = designacoes.length > 0 ? designacoes : null;

    // 4. Executa a query de ATUALIZAÇÃO (UPDATE)
    await client.query(
      `UPDATE publicadores
       SET 
         nome_completo = $1, data_nascimento = $2, data_batismo = $3, grupo_id = $4, 
         privilegios = $5, designacoes = $6, telefone = $7, email = $8,
         cep = $9, logradouro = $10, numero = $11, complemento = $12,
         bairro = $13, cidade = $14, estado = $15,
         senha = COALESCE($16, senha) 
       WHERE id = $17`,
      [
        nome_completo, data_nascimento, data_batismo || null, grupo_id,
        finalPrivilegios, finalDesignacoes, telefone || null, email || null,
        cep || null, logradouro || null, numero || null, complemento || null,
        bairro || null, cidade || null, estado || null,
        hashSenha, 
        id        
      ]
    );
    
    return NextResponse.json({ message: 'Publicador atualizado com sucesso!' }, { status: 200 });
  
  } catch (err) {
    // Erro de nome duplicado
    if (err.code === '23505') {
      return NextResponse.json({ message: 'Outro publicador já existe com este Nome Completo.' }, { status: 409 });
    }
    console.error('Erro ao atualizar publicador:', err);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  } finally {
    client.release();
  }
}