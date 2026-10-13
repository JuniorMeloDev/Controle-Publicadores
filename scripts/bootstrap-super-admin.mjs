import { Pool } from '@neondatabase/serverless';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !process.env.POSTGRES_URL || !process.env.JWT_SECRET) throw new Error('Provide a registered email, POSTGRES_URL and JWT_SECRET.');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
const client = await pool.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS acessos_app (
    publicador_id INTEGER PRIMARY KEY REFERENCES publicadores(id) ON DELETE CASCADE,
    permissoes JSONB NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query('ALTER TABLE acessos_app ADD COLUMN IF NOT EXISTS super_admin BOOLEAN NOT NULL DEFAULT FALSE');
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(72904123)');
  const existing = await client.query('SELECT publicador_id FROM acessos_app WHERE super_admin = TRUE');
  if (existing.rows.length) throw new Error('A super admin already exists. Manage roles through the application.');
  const users = await client.query('SELECT id FROM publicadores WHERE LOWER(TRIM(email)) = $1', [email]);
  if (users.rows.length !== 1) throw new Error('Email must match exactly one registered publisher.');
  await client.query(`INSERT INTO acessos_app (publicador_id, permissoes, super_admin) VALUES ($1, '{}'::jsonb, TRUE)
    ON CONFLICT (publicador_id) DO UPDATE SET super_admin = TRUE, updated_at = NOW()`, [users.rows[0].id]);
  await client.query(`CREATE TABLE IF NOT EXISTS auditoria_logs (
    id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES publicadores(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL, entity VARCHAR(80), entity_id VARCHAR(80), details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`INSERT INTO auditoria_logs (user_id, action, entity, entity_id, details)
    VALUES ($1, 'super_admin_inicial', 'publicador', $2, '{"super_admin":true}'::jsonb)`, [users.rows[0].id, String(users.rows[0].id)]);
  await client.query('COMMIT');
  console.log('Initial super admin configured and audited.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error.message.startsWith('Email') || error.message.startsWith('A super') ? error.message : 'Bootstrap failed; no access changes applied.');
  process.exitCode = 1;
} finally { client.release(); await pool.end(); }
