import nextEnv from '@next/env';
import pg from 'pg';
import { readFile } from 'node:fs/promises';

nextEnv.loadEnvConfig(process.cwd());
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL });
try {
  await pool.query(await readFile(new URL('./sql/adicionar-servico-campo.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('./sql/adicionar-planejamento-campo.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('./sql/adicionar-dirigente-unico-campo.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('./sql/adicionar-transferencias-campo.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('./sql/adicionar-progresso-quadras.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('./sql/corrigir-entregas-saidas-excluidas.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('./sql/adicionar-limites-territorios.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('./sql/adicionar-mapas-editaveis.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('./sql/adicionar-notificacoes-campo.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('./sql/adicionar-inscricoes-web-push.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('./sql/adicionar-avisos-gerais-web-push.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('./sql/adicionar-envios-web-push-alertas.sql', import.meta.url), 'utf8'));
  console.log('Serviço de Campo: tabelas e índices criados. Pendências de saídas excluídas corrigidas; histórico de trabalho preservado.');
} catch (error) {
  console.error('Falha na migração de Serviço de Campo. Código:', error.code || 'desconhecido');
  process.exitCode = 1;
} finally { await pool.end(); }
