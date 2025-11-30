// app/api/alterar-senha/route.js

import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-de-teste-mude-depois';

// Função auxiliar de validação (Regex)
function isPasswordComplex(password) {
    // Deve ter 8+ caracteres, 1 minúscula, 1 maiúscula, 1 número, 1 símbolo
    if (password.length < 8) return false;
    if (!/[a-z]/.test(password)) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    if (!/[^a-zA-Z0-9]/.test(password)) return false;
    return true;
}

export async function POST(req) {
  const body = await req.json();
  const { novaSenha } = body;

  // 1. Validação de Complexidade no Backend
  if (!isPasswordComplex(novaSenha)) {
    return NextResponse.json(
        { message: 'A senha deve ter 8+ caracteres, com letras maiúsculas, minúsculas, números e símbolos.' }, 
        { status: 400 }
    );
  }

  const cookieStore = cookies();
  const token = cookieStore.get('auth_token');

  if (!token) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const decoded = verify(token.value, JWT_SECRET);
    const userId = decoded.id;

    const hashedPassword = await bcrypt.hash(novaSenha, 10);

    const client = await pool.connect();

    await client.query(
      'UPDATE usuarios SET senha_hash = $1 WHERE id = $2',
      [hashedPassword, userId]
    );

    client.release();

    return NextResponse.json(
      { message: 'Senha alterada com sucesso.' },
      { status: 200 }
    );

  } catch (err) {
    console.error('Erro ao alterar senha:', err);
    if (err.name === 'JsonWebTokenError') {
       return NextResponse.json({ message: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
    }
    return NextResponse.json(
      { message: 'Erro interno ao tentar alterar a senha.' },
      { status: 500 }
    );
  }
}