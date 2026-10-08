import nextEnv from '@next/env';
import pg from 'pg';
import { readFile } from 'node:fs/promises';

nextEnv.loadEnvConfig(process.cwd());
const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL?.replace('-pooler.', '.');
const pool = new pg.Pool({ connectionString });
try {
    const sql = await readFile(new URL('./sql/unificar-calendario-designacoes.sql', import.meta.url), 'utf8');
    await pool.query(sql);
    console.log('Calendário unificado: migração aplicada, registros históricos preservados.');
} catch (error) {
    console.error('Não foi possível aplicar a migração do calendário. Código:', error.code || 'desconhecido');
    process.exitCode = 1;
} finally {
    await pool.end();
}
