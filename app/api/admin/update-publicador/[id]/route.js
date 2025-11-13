import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Rota: PUT /api/admin/update-publicador/123
export async function PUT(request, context) {
  const { id } = await context.params; 
  const body = await request.json();   

  const { 
    nome_completo, data_nascimento, data_batismo, nome_grupo, senha, 
    privilegios, designacoes, telefone, email, cep, 
    logradouro, numero, complemento, bairro, cidade, estado,
    sexo, esperanca // <-- ADICIONADO
  } = body;

  // Validação principal
  if (!id || !nome_completo || !data_nascimento || !nome_grupo || !sexo) {
    return NextResponse.json({ message: 'ID, Nome, Data de Nascimento, Sexo e Grupo são obrigatórios.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    let hashSenha = null;
    if (senha && senha.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      hashSenha = await bcrypt.hash(senha, salt);
    }

    const grupoRes = await client.query('SELECT id FROM grupos WHERE nome_grupo = $1', [nome_grupo]);
    if (grupoRes.rows.length === 0) {
      return NextResponse.json({ message: 'Grupo não encontrado.' }, { status: 404 });
    }
    const grupo_id = grupoRes.rows[0].id;

    const finalPrivilegios = privilegios.length > 0 ? privilegios : null;
    const finalDesignacoes = designacoes.length > 0 ? designacoes : null;

    // --- QUERY DE ATUALIZAÇÃO (UPDATE) ---
    await client.query(
      `UPDATE publicadores
       SET 
         nome_completo = $1, data_nascimento = $2, data_batismo = $3, grupo_id = $4, 
         privilegios = $5, designacoes = $6, telefone = $7, email = $8,
         cep = $9, logradouro = $10, numero = $11, complemento = $12,
         bairro = $13, cidade = $14, estado = $15,
         sexo = $16, esperanca = $17,
         senha = COALESCE($18, senha)
       WHERE id = $19`,
      [
        nome_completo, data_nascimento, data_batismo || null, grupo_id,
        finalPrivilegios, finalDesignacoes, telefone || null, email || null,
        cep || null, logradouro || null, numero || null, complemento || null,
        bairro || null, cidade || null, estado || null,
        sexo, esperanca || null,
        hashSenha,
        id
      ]
    );
    
    // Buscar o registro atualizado (incluindo nome_grupo) para devolver ao cliente
    const updatedRes = await client.query(
      `SELECT 
         p.id, p.nome_completo, p.data_nascimento, p.data_batismo,
         g.nome_grupo, p.privilegios, p.designacoes,
         p.sexo, p.esperanca,
         p.telefone, p.email, p.cep, p.logradouro, p.numero, p.complemento, p.bairro, p.cidade, p.estado
       FROM publicadores p
       LEFT JOIN grupos g ON p.grupo_id = g.id
       WHERE p.id = $1`,
      [id]
    );
    
    const updatedPublicador = updatedRes.rows[0] || null;
    return NextResponse.json({ message: 'Publicador atualizado com sucesso!', publicador: updatedPublicador }, { status: 200 });
  
  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ message: 'Outro publicador já existe com este Nome Completo.' }, { status: 409 });
    }
    // Tratamento de erro para constraints CHECK
    if (err.code === '23514') {
      return NextResponse.json({ message: `Valor inválido para Sexo ou Esperança. Verifique os dados.` }, { status: 400 });
    }
    console.error('Erro ao atualizar publicador:', err);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  } finally {
    client.release();
  }
}