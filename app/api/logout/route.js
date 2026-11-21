import { NextResponse } from 'next/server';
import { serialize } from 'cookie';
import { Pool } from 'pg';
import { pushDeviceId, revokePushDevice } from '@/app/lib/push-subscriptions';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function POST(req) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ message: 'Origem da solicitação inválida.' }, { status: 403 });
  }
  let pushCleanupFailed = false;
  try { await revokePushDevice(pool, pushDeviceId(req)); }
  catch (error) {
    pushCleanupFailed = true;
    console.error('Falha ao desvincular aparelho no logout:', error.code || error.name);
  }
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
    { message: 'Logout bem-sucedido!', pushCleanupFailed },
    {
      status: 200,
      headers: { 'Set-Cookie': cookie },
    }
  );
}
