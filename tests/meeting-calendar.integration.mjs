// Opt-in SQL verification: all application tables are shadowed by session-local TEMP tables.
// No publisher, meeting or designation in the persistent database is inserted or modified.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import nextEnv from '@next/env';
import pg from 'pg';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

nextEnv.loadEnvConfig(process.cwd());
const calendar = await loadModule('../../app/lib/meeting-calendar.js');
const visits = await loadModule('../../app/lib/meeting-visits.js');
// Session-local TEMP tables require a direct connection, not a transaction pooler.
const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL?.replace('-pooler.', '.');
const pool = new pg.Pool({ connectionString });
const db = await pool.connect();
const client = { query: (...args) => db.query(...args), release() {} };
const serviceSource = (await readFile(new URL('../app/lib/meeting-calendar-service.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const serviceContext = vm.createContext({ ...calendar });
vm.runInContext(serviceSource + '\nglobalThis.service = { getCalendarContext, withCalendarState, lockAssignmentMeeting };', serviceContext);
const dependencies = {
    Pool: class { connect() { return client; } }, ...calendar, ...visits, ...serviceContext.service,
    getUserIdFromRequest: () => 990001, getUserPermissions: async () => ({}), isAllowed: () => true,
    registerAuditLog: async () => {}
};
const route = name => loadRoute(`../../app/api/admin/${name}/route.js`, dependencies);
const request = body => ({ json: async () => body, url: 'http://example.test/api' });

try {
    await db.query(`
        CREATE TEMP TABLE reunioes_registro (id SERIAL PRIMARY KEY, data DATE NOT NULL UNIQUE, tipo TEXT NOT NULL);
        CREATE TEMP TABLE reunioes_dados (data_reuniao DATE PRIMARY KEY, dados_json JSONB NOT NULL, descricao_texto TEXT);
        CREATE TEMP TABLE designacoes_reuniao (id SERIAL PRIMARY KEY, publicador_id INT, data_reuniao DATE, descricao_semana TEXT, nome_parte TEXT);
        CREATE TEMP TABLE discursos_publicos (id SERIAL PRIMARY KEY, data DATE, orador TEXT, tema TEXT, cantico INT, congregacao TEXT, presidente_id INT);
        CREATE TEMP TABLE limpeza_semanal (id SERIAL PRIMARY KEY, data DATE, tarefas TEXT, grupo TEXT, responsaveis TEXT);
        CREATE TEMP TABLE configuracoes_gerais (ano INT, dia_meio_semana TEXT, dia_fim_semana TEXT);
        CREATE TEMP TABLE eventos_especiais (data DATE, tipo TEXT, nome TEXT);
        CREATE TEMP TABLE publicadores (id INT PRIMARY KEY, nome_completo TEXT, nome_chamado TEXT);
        INSERT INTO configuracoes_gerais VALUES (2030, 'Quarta-feira', 'Domingo');
        INSERT INTO publicadores VALUES (900001, 'Publicador fictício', 'Fictício');
        INSERT INTO reunioes_registro VALUES (910001, '2030-01-09', 'Meio de Semana'), (910002, '2030-01-13', 'Fim de Semana');
        INSERT INTO reunioes_dados VALUES ('2030-01-09', '{"treasures":[{"title":"Parte fictícia"}]}', 'Semana fictícia');
        INSERT INTO designacoes_reuniao VALUES (940001, 900001, '2030-01-09', 'Semana fictícia', 'Parte fictícia');
        INSERT INTO discursos_publicos VALUES (960001, '2030-01-13', 'Orador fictício', 'Tema fictício', 1, 'Congregação fictícia', 900001);
        INSERT INTO limpeza_semanal VALUES (970001, '2030-01-09', 'Tarefa fictícia', 'Grupo fictício', '');
    `);
    const migration = (await readFile(new URL('../scripts/sql/unificar-calendario-designacoes.sql', import.meta.url), 'utf8'))
        .replaceAll('public.', 'pg_temp.');
    await db.query(migration);
    await db.query(migration); // Repeatability, including backfill and indexes.
    const generator = route('reunioes/gerar');
    const preview = await generator.POST(request({ action: 'preview', period: 'mes_especifico', year: 2030, month: 1 }));
    assert.equal(preview.status, 200, preview.body.message);
    assert.equal(preview.body.meetings.length, 9);
    const first = await generator.POST(request({ action: 'create', year: 2030, options: { meetings_to_create: preview.body.meetings } }));
    assert.equal(first.body.created, 7);
    assert.equal(first.body.existing, 2);
    const repeated = await generator.POST(request({ action: 'create', year: 2030, options: { meetings_to_create: preview.body.meetings } }));
    assert.equal(repeated.body.created, 0);
    assert.equal(repeated.body.existing, 9);
    const life = await route('get-reunioes').GET(request());
    const speeches = await route('discursos').GET(request());
    const cleaning = await route('limpeza').GET(request());
    assert.equal(life.status, 200, life.body.message);
    assert.equal(speeches.status, 200, speeches.body.message);
    assert.equal(cleaning.status, 200, cleaning.body.error);
    assert.equal(life.body.length, 5);
    assert.equal(life.body.filter(m => !m.tem_programacao).length, 4);
    assert.equal(speeches.body.length, 4);
    assert.equal(speeches.body.filter(m => !m.id).length, 3);
    assert.equal(cleaning.body.length, 9);
    assert.equal(cleaning.body.filter(m => !m.id).length, 8);
    assert.equal(speeches.body.find(m => m.id === 960001).tema, 'Tema fictício');
    const moved = await route('reunioes/editar').POST(request({ id: 910001, nova_data: '2030-01-08' }));
    assert.equal(moved.status, 200);
    for (const table of ['reunioes_dados', 'designacoes_reuniao', 'limpeza_semanal']) {
        const column = table === 'limpeza_semanal' ? 'data' : 'data_reuniao';
        const record = await db.query(`SELECT ${column}::text AS data FROM ${table} WHERE reuniao_id = 910001`);
        assert.equal(record.rows[0].data, '2030-01-08');
    }
    const imported = await route('parse-rtf').POST(request({
        year: 2030,
        textContent: '7 - 13 de janeiro (SALMO)\nTESOUROS DA PALAVRA DE DEUS\n1. Parte fictícia (10 min)'
    }));
    assert.equal(imported.status, 200, imported.body.message);
    assert.equal(imported.body.meetingDate, '2030-01-08');
    assert.equal(imported.body.reuniao_id, 910001);
    const explicitYearImport = await route('parse-rtf').POST(request({
        year: 2029,
        textContent: '7 - 13 de janeiro de 2030 (SALMO)\nTESOUROS DA PALAVRA DE DEUS\n1. Parte fictícia (10 min)'
    }));
    assert.equal(explicitYearImport.status, 200, explicitYearImport.body.message);
    assert.equal(explicitYearImport.body.reuniao_id, 910001);
    const pendingLife = life.body.find(m => m.dataSQL === '2030-01-16');
    const savedLife = await route('salvar-designacoes').POST(request({
        reuniao_id: pendingLife.reuniao_id, meetingDate: '2030-01-15',
        scheduleData: { treasures: [{ title: 'Parte fictícia' }], ministry: [], living: [], weekDate: 'Semana fictícia' },
        assignments: { presidente: 'Publicador fictício' }
    }));
    assert.equal(savedLife.status, 201, savedLife.body.message);
    assert.equal((await route('get-reunioes').GET(request())).body.find(m => m.dataSQL === '2030-01-16').tem_programacao, true);
    const pendingSpeech = speeches.body.find(m => m.data === '2030-01-20');
    const speech = await route('discursos').POST(request({ reuniao_id: pendingSpeech.reuniao_id, data: '2030-01-19', orador: 'Outro fictício', tema: 'Outro tema', presidente_id: 900001 }));
    assert.equal(speech.status, 201);
    assert.equal(calendar.dateOnly(speech.body.data), '2030-01-20');
    const cleaned = await route('limpeza').POST(request({ reuniao_id: pendingSpeech.reuniao_id, data: '2030-01-19', tarefas: 'Tarefa fictícia', grupo: 'Grupo fictício' }));
    assert.equal(cleaned.status, 200, cleaned.body.error);
    const duplicate = await route('limpeza').POST(request({ reuniao_id: pendingSpeech.reuniao_id, data: '2030-01-20', tarefas: 'Tarefa fictícia', grupo: 'Grupo fictício' }));
    assert.equal(duplicate.status, 400);
    const cancellation = await route('reunioes/deletar').POST(request({ ids: [910001] }));
    assert.equal(cancellation.status, 200);
    const cancelledLife = await route('get-reunioes').GET(request());
    assert.equal(cancelledLife.body.find(m => m.reuniao_id === 910001).cancelado, true);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM designacoes_reuniao WHERE reuniao_id = 910001')).rows[0].n, 1);
    const restored = await route('reunioes/remover-evento-especial').POST(request({ id: 910001 }));
    assert.equal(restored.status, 200);
    assert.equal((await route('get-reunioes').GET(request())).body.find(m => m.reuniao_id === 910001).cancelado, false);
    console.log('SQL validado em tabelas temporárias: migração repetida, geração, quatro agendas, preenchimento, mudança de data, cancelamento e restauração.');
} finally {
    await db.query('ROLLBACK');
    db.release();
    await pool.end();
}
