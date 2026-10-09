import { createHash, randomBytes } from 'node:crypto';

export const RESET_MESSAGE = 'Se houver uma conta com esse e-mail, você receberá um link para redefinir sua senha.';

export function hashResetToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function isValidResetToken(token) {
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
}

export function isValidPassword(password) {
  return typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= 72 &&
    password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) &&
    /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password);
}

export async function ensurePasswordResetTable(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS password_resets (
    publicador_id INTEGER PRIMARY KEY REFERENCES publicadores(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

export async function issuePasswordReset(client, email) {
  const token = randomBytes(32).toString('hex');
  const result = await client.query(`
    INSERT INTO password_resets (publicador_id, token_hash, password_hash, expires_at)
    SELECT id, $2, senha, NOW() + INTERVAL '30 minutes'
    FROM publicadores WHERE LOWER(TRIM(email)) = $1 AND senha IS NOT NULL AND senha <> ''
    ON CONFLICT (publicador_id) DO UPDATE SET
      token_hash = EXCLUDED.token_hash, password_hash = EXCLUDED.password_hash,
      expires_at = EXCLUDED.expires_at, requested_at = NOW()
    WHERE password_resets.requested_at < NOW() - INTERVAL '2 minutes'
    RETURNING publicador_id`, [email, hashResetToken(token)]);
  return result.rows.length ? token : null;
}

export async function consumePasswordReset(client, token, passwordHash) {
  // A single statement consumes the token and updates only an unchanged password.
  const result = await client.query(`
    WITH consumed AS (
      DELETE FROM password_resets WHERE token_hash = $1 AND expires_at > NOW()
      RETURNING publicador_id, password_hash
    )
    UPDATE publicadores p SET senha = $2 FROM consumed c
    WHERE p.id = c.publicador_id AND p.senha = c.password_hash
    RETURNING p.id`, [hashResetToken(token), passwordHash]);
  return result.rows.length === 1;
}
