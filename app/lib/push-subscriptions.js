export const PUSH_DEVICE_COOKIE = 'campo_push_device';
export const PUSH_LOGIN_COOKIE = 'campo_push_login';

export function pushDeviceId(request) {
  const value = request.cookies.get(PUSH_DEVICE_COOKIE)?.value;
  return isPushId(value) ? value : null;
}

export function pushEnabledOnLogin(request, deviceId) {
  return Boolean(deviceId && request.cookies.get(PUSH_LOGIN_COOKIE)?.value === deviceId);
}

export async function linkLoginDevicePush(db, deviceId, userId, publicKey) {
  if (!publicKey) return;
  await db.query(`UPDATE web_push_inscricoes SET publicador_id = $2
    WHERE aparelho_id = $1 AND avisos_gerais AND chave_vapid = $3
      AND (expira_em IS NULL OR expira_em > NOW())
      AND (publicador_id IS NULL OR publicador_id = $2)`, [deviceId, userId, publicKey]);
}

export function parsePushSubscription(value, now = Date.now()) {
  const { endpoint, keys, expirationTime } = value || {};
  if (typeof endpoint !== 'string' || endpoint.length > 1800) return null;
  let url;
  try { url = new URL(endpoint); } catch { return null; }
  const host = url.hostname;
  // The device supplies this URL. Only HTTPS endpoints on browser push providers
  // may receive an outbound request from the server.
  const provider = (host === 'fcm.googleapis.com' && /^\/(?:fcm\/send|wp)\/.+/.test(url.pathname))
    || (host === 'updates.push.services.mozilla.com' && url.pathname.startsWith('/wpush/'))
    || host.endsWith('.push.apple.com') || host.endsWith('.notify.windows.com');
  if (!provider || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) return null;
  if (typeof keys?.p256dh !== 'string' || !/^B[A-Za-z0-9_-]{86}$/.test(keys.p256dh)
    || typeof keys.auth !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(keys.auth)) return null;
  if (expirationTime != null && (!Number.isFinite(expirationTime)
    || expirationTime <= now || expirationTime > 8640000000000000)) return null;
  return { endpoint: url.href, keys: { p256dh: keys.p256dh, auth: keys.auth },
    expiresAt: expirationTime == null ? null : new Date(expirationTime) };
}

export async function revokePushDevice(db, deviceId, nextUserId = null) {
  if (!deviceId) return false;
  try {
    const result = await db.query(`UPDATE web_push_inscricoes SET publicador_id = NULL
      WHERE aparelho_id = $1 AND publicador_id IS NOT NULL
      AND ($2::int IS NULL OR publicador_id <> $2)`, [deviceId, nextUserId]);
    return result.rowCount > 0;
  } catch (error) {
    if (error.code !== '42P01') throw error;
    return false;
  }
}

export const isPushId = value => typeof value === 'string'
  && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);

export async function readDevicePush(db, deviceId, userId) {
  if (!deviceId) return null;
  const { rows: [device] } = await db.query(`SELECT endpoint, chave_vapid, avisos_gerais,
      COALESCE(publicador_id = $2, FALSE) AS campo
    FROM web_push_inscricoes
    WHERE aparelho_id = $1 AND (avisos_gerais OR publicador_id = $2)
      AND (expira_em IS NULL OR expira_em > NOW())`, [deviceId, userId]);
  return device || null;
}

export async function saveDevicePush(db, deviceId, userId, general, subscription, publicKey, includeGeneral = false) {
  await db.query(`INSERT INTO web_push_inscricoes (aparelho_id, publicador_id, avisos_gerais, endpoint, chaves, chave_vapid, expira_em)
    VALUES ($1, CASE WHEN $3 THEN NULL ELSE $2::int END, $3 OR $8, $4, $5, $6, $7)
    ON CONFLICT (aparelho_id) DO UPDATE SET
      publicador_id = CASE
        WHEN NOT $3 THEN EXCLUDED.publicador_id
        WHEN web_push_inscricoes.publicador_id = $2 THEN web_push_inscricoes.publicador_id
        ELSE NULL END,
      avisos_gerais = web_push_inscricoes.avisos_gerais OR EXCLUDED.avisos_gerais,
      endpoint = EXCLUDED.endpoint, chaves = EXCLUDED.chaves, chave_vapid = EXCLUDED.chave_vapid, expira_em = EXCLUDED.expira_em`,
  [deviceId, userId, general, subscription.endpoint, JSON.stringify(subscription.keys), publicKey, subscription.expiresAt, includeGeneral]);
}

export async function disableDevicePush(db, deviceId, userId, general, includeGeneral = false) {
  if (!deviceId) return;
  if (general) {
    await db.query(`UPDATE web_push_inscricoes SET avisos_gerais = FALSE${includeGeneral ? ', publicador_id = NULL' : ''} WHERE aparelho_id = $1`, [deviceId]);
  } else {
    await db.query(`UPDATE web_push_inscricoes SET publicador_id = NULL${includeGeneral ? ', avisos_gerais = FALSE' : ''}
      WHERE aparelho_id = $1 AND publicador_id = $2`, [deviceId, userId]);
  }
}
