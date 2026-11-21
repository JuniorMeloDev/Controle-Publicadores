import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server.js';
import { fieldPushVapid } from './field-push.js';
import { disableDevicePush, parsePushSubscription, pushDeviceId, PUSH_DEVICE_COOKIE, readDevicePush, saveDevicePush } from './push-subscriptions.js';

function respond(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function handleDevicePush(request, method, { db, userId, general = false, vapid = fieldPushVapid() }) {
  if (method !== 'GET' && request.headers.get('origin') !== new URL(request.url).origin) {
    return respond({ message: 'Origem da solicitação inválida.' }, 403);
  }
  const deviceId = pushDeviceId(request);
  try {
    if (method === 'GET') {
      const device = await readDevicePush(db, deviceId, userId);
      return respond({ userId, publicKey: vapid?.publicKey || null, endpoint: device?.endpoint || null,
        subscriptionKey: device?.chave_vapid || null, enabled: (general ? device?.avisos_gerais : device?.campo) === true });
    }
    const body = await request.json();
    if (body?.userId !== userId) return respond({ message: 'Sua conta mudou. Atualize a página e tente novamente.' }, 409);
    if (method === 'DELETE') {
      await disableDevicePush(db, deviceId, userId, general);
      return respond({ enabled: false });
    }
    if (!vapid) return respond({ message: 'As notificações no aparelho ainda não foram configuradas.' }, 503);
    if (body.publicKey !== vapid.publicKey) return respond({ message: 'A configuração mudou. Atualize a página e tente novamente.' }, 409);
    const subscription = parsePushSubscription(body.subscription);
    if (!subscription) return respond({ message: 'A inscrição deste aparelho é inválida ou incompatível.' }, 400);
    const id = deviceId || randomUUID();
    await saveDevicePush(db, id, userId, general, subscription, vapid.publicKey);
    const response = respond({ enabled: true });
    response.cookies.set(PUSH_DEVICE_COOKIE, id, { httpOnly: true, sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 });
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) return respond({ message: 'Inscrição inválida.' }, 400);
    if (error.code === '42P01' || error.code === '42703') return respond({ message: 'As notificações no aparelho ainda não foram configuradas.' }, 503);
    if (error.code === '23505') return respond({ message: 'Inscrição já vinculada. Atualize a página e tente ativar novamente.' }, 409);
    console.error('Falha na inscrição Web Push:', error.code || error.name);
    return respond({ message: 'Não foi possível atualizar as notificações neste aparelho.' }, 500);
  }
}
