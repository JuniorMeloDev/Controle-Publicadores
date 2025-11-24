import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-de-teste-mude-depois';

export async function POST(req) {
  const body = await req.json();
  const { novaSenha } = body;

  if (!novaSenha || novaSenha.trim().length < 4) {
    return NextResponse.json({ message: 'A senha deve ter pelo menos 4 caracteres.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');

  if (!token) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  }

  try {
    // Pega o ID do usuário logado diretamente do token
    const decoded = verify(token.value, JWT_SECRET);
    const userId = decoded.userId;

    // Gera o hash da nova senha
    const salt = await bcrypt.genSalt(10);
    const hashSenha = await bcrypt.hash(novaSenha, salt);

    const client = await pool.connect();
    try {
      // Atualiza apenas a senha e registra no histórico
      await client.query('BEGIN');

      await client.query(
        'UPDATE publicadores SET senha = $1 WHERE id = $2',
        [hashSenha, userId]
      );

      // Opcional: Registrar no histórico que a senha foi alterada pelo próprio usuário
      await client.query(
        `INSERT INTO publicador_historico 
         (publicador_id, campo_alterado, valor_antigo, valor_novo, data_mudanca) 
         VALUES ($1, 'senha', '********', '********', NOW())`,
        [userId]
      );

      await client.query('COMMIT');

      return NextResponse.json({ message: 'Senha alterada com sucesso!' }, { status: 200 });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro ao alterar senha:', err);
    return NextResponse.json({ message: 'Erro ao processar solicitação.' }, { status: 500 });
  }
}