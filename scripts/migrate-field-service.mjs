import nextEnv from '@next/env';
import pg from 'pg';
import { readFile } from 'node:fs/promises';

nextEnv.loadEnvConfig(process.cwd());
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL });
try {
  await pool.query(await readFile(new URL('./sql/adicionar-servico-campo.sql', import.meta.url), 'utf8'));
  console.log('Serviço de Campo: tabelas e índices criados. Dados existentes preservados.');
} catch (error) {
  console.error('Falha na migração de Serviço de Campo. Código:', error.code || 'desconhecido');
  process.exitCode = 1;
} finally { await pool.end(); }
