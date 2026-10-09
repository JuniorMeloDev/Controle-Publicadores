import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensurePasswordResetTable, isValidPassword, isValidResetToken, consumePasswordReset } from '@/app/lib/password-reset';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export const runtime = 'nodejs';

export async function POST(request) {
  let client;
  try {
    const { token, novaSenha } = await request.json();
    if (!isValidResetToken(token)) {
      return NextResponse.json({ message: 'Link inválido ou expirado. Solicite um novo link.' }, { status: 400 });
    }
    if (!isValidPassword(novaSenha)) {
      return NextResponse.json({ message: 'Use pelo menos 8 caracteres, com maiúscula, minúscula, número e símbolo (máximo de 72 bytes).' }, { status: 400 });
    }
    client = await pool.connect();
    await ensurePasswordResetTable(client);
    const changed = await consumePasswordReset(client, token, await bcrypt.hash(novaSenha, 10));
    if (!changed) return NextResponse.json({ message: 'Link inválido ou expirado. Solicite um novo link.' }, { status: 400 });
    return NextResponse.json({ message: 'Senha redefinida com sucesso! Faça login com sua nova senha.' }, {
      headers: { 'Set-Cookie': 'auth_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' },
    });
  } catch {
    return NextResponse.json({ message: 'Não foi possível redefinir a senha. Tente novamente.' }, { status: 500 });
  } finally {
    client?.release();
  }
}
