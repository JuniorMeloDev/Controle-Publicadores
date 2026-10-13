import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

nextEnv.loadEnvConfig(process.cwd());
const base = process.argv[2] || 'http://localhost:3004';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use a local application server.');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
try {
  const admins = await pool.query('SELECT publicador_id AS id FROM acessos_app WHERE super_admin = TRUE ORDER BY publicador_id LIMIT 1');
  const users = await pool.query(`SELECT p.id FROM publicadores p LEFT JOIN acessos_app a ON a.publicador_id = p.id
    WHERE COALESCE(a.super_admin, FALSE) = FALSE AND (a.permissoes IS NULL OR a.permissoes = '{}'::jsonb) ORDER BY p.id LIMIT 1`);
  assert.ok(admins.rows.length && users.rows.length, 'Need a super admin and a personal-only publisher.');
  const adminId = admins.rows[0].id, userId = users.rows[0].id;
  const call = (path, id) => fetch(base + path, { headers: id ? { Cookie: 'auth_token=' + jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: '5m' }) } : {}, redirect: 'manual' });
  assert.equal((await call('/api/admin/get-publicadores')).status, 401);
  for (const path of ['/api/atualizacao-cadastral/buscar', '/api/atualizacao-cadastral/enviar', '/api/enviar-relatorio-mensal']) {
    assert.equal((await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  }
  assert.equal((await call('/api/admin/get-publicadores', userId)).status, 403);
  assert.equal((await call('/api/admin/gestao-acessos', userId)).status, 403);
  assert.equal((await call('/api/admin/backup', userId)).status, 403);
  assert.equal((await call('/api/enviar-relatorio-mensal/manual?publicadorId=' + adminId, userId)).status, 403);
  assert.equal((await call('/api/recuperar-designacoes?date=2026-10-07', userId)).status, 403);
  const own = await call('/api/minha-conta?id=' + adminId, userId);
  assert.equal(own.status, 200);
  const data = await own.json();
  assert.equal(data.info.id, userId);
  assert.equal(data.info.senha, undefined);
  assert.ok(data.assignments.every(assignment => assignment.publicador_id === userId));
  const actor = await call('/api/usuario-atual', adminId);
  assert.equal(actor.status, 200);
  assert.equal((await actor.json()).isSuperAdmin, true);
  assert.equal((await call('/api/admin/gestao-acessos', adminId)).status, 200);
  assert.equal((await call('/admin/gerenciar', userId)).status, 307);
  assert.equal((await call('/admin/dashboard', userId)).status, 200);
  console.log('Live access checks passed: personal isolation, administrative denial and super admin access. No publisher or permission data modified.');
} finally { await pool.end(); }
