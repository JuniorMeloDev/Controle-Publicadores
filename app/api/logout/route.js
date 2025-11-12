import { NextResponse } from 'next/server';
import { serialize } from 'cookie';

export async function POST(req) {
  // O "logout" funciona criando um cookie com o
  // mesmo nome ('auth_token'), mas com uma data de validade no passado.
  const cookie = serialize('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(0), // Data no passado (1 Jan 1970)
    path: '/',
    sameSite: 'strict',
  });

  // Envia a resposta de sucesso com o cookie "expirado"
  return NextResponse.json(
    { message: 'Logout bem-sucedido!' },
    {
      status: 200,
      headers: { 'Set-Cookie': cookie },
    }
  );
}