// app/api/alterar-senha/route.js

import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { isValidPassword } from '@/app/lib/password-reset';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-de-teste-mude-depois';

// Função auxiliar de validação (Regex)
export async function POST(req) {
  const body = await req.json();
  const { novaSenha } = body;

  // 1. Validação de Complexidade no Backend
  if (!isValidPassword(novaSenha)) {
    return NextResponse.json(
        { message: 'A senha deve ter 8+ caracteres, com letras maiúsculas, minúsculas, números e símbolos.' }, 
        { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');

  if (!token) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const decoded = verify(token.value, JWT_SECRET);
    const userId = decoded.userId;
    if (!Number.isInteger(userId) || userId <= 0) return NextResponse.json({ message: 'Sessão inválida.' }, { status: 401 });

    const hashedPassword = await bcrypt.hash(novaSenha, 10);

    const client = await pool.connect();

    try {
    const result = await client.query(
      'UPDATE publicadores SET senha = $1 WHERE id = $2 RETURNING id',
      [hashedPassword, userId]
    );

    if (!result.rows.length) return NextResponse.json({ message: 'Usuário não encontrado.' }, { status: 404 });
    } finally { client.release(); }

    return NextResponse.json(
      { message: 'Senha alterada com sucesso.' },
      { status: 200 }
    );

  } catch (err) {
    console.error('Erro ao alterar senha:', err);
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err.name)) {
       return NextResponse.json({ message: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
    }
    return NextResponse.json(
      { message: 'Erro interno ao tentar alterar a senha.' },
      { status: 500 }
    );
  }
}
