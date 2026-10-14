import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

nextEnv.loadEnvConfig(process.cwd());
const base = process.argv[2] || 'http://localhost:3002';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use a local application server.');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
try {
  const publisher = await pool.query(`SELECT p.id FROM publicadores p LEFT JOIN acessos_app a ON a.publicador_id = p.id
    WHERE COALESCE(a.super_admin, FALSE) = FALSE AND NOT (COALESCE(p.privilegios::text[], ARRAY[]::text[]) @> ARRAY['anciao']::text[]) ORDER BY p.id LIMIT 1`);
  const elder = await pool.query(`SELECT p.id FROM publicadores p LEFT JOIN acessos_app a ON a.publicador_id = p.id
    WHERE a.super_admin = TRUE OR p.privilegios::text[] @> ARRAY['anciao']::text[] ORDER BY p.id LIMIT 1`);
  assert.ok(publisher.rows.length && elder.rows.length, 'Need a publisher and an elder or super admin.');
  const call = (path, id, body) => fetch(base + path, {
    method: body ? 'POST' : 'GET', headers: { ...(id ? { Cookie: 'auth_token=' + jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: '5m' }) } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'manual',
  });
  for (const path of ['/api/visao-geral', '/api/mural']) assert.equal((await call(path)).status, 401);
  const userId = publisher.rows[0].id;
  const response = await call('/api/visao-geral', userId);
  assert.equal(response.status, 200);
  const overview = await response.json();
  for (const key of ['meetings', 'cancelled', 'events', 'posts', 'changes']) assert.ok(Array.isArray(overview[key]));
  assert.ok(overview.meetings.every(meeting => !meeting.cancelado));
  assert.equal(overview.info, undefined); assert.equal(overview.reports, undefined);
  assert.equal((await call('/api/mural?manage=1', userId)).status, 403);
  assert.equal((await call('/api/mural', userId, { action: 'delete', id: 999999 })).status, 403);
  assert.equal((await call('/api/mural?manage=1', elder.rows[0].id)).status, 200);
  const repeated = await (await call('/api/visao-geral', userId)).json();
  assert.deepEqual(repeated.changes, overview.changes, 'Unchanged visits must not invent new notices.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(`INSERT INTO mural_congregacao (tipo, titulo, mensagem, inicio, link, autor_id)
      VALUES ('material', 'Teste temporário', 'Teste com rollback', '2099-01-01', 'https://example.com/material.pdf', $1) RETURNING tipo`, [elder.rows[0].id]);
    assert.equal(inserted.rows[0].tipo, 'material');
  } finally { await client.query('ROLLBACK'); client.release(); }
  console.log(`Overview integration passed: ${overview.meetings.length} upcoming meetings, ${overview.events.length} upcoming events; publisher reads and elder management verified. No posts or publisher data modified.`);
} finally { await pool.end(); }
