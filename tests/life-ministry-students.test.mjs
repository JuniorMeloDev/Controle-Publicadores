import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { loadRoute } from './helpers/load-source.mjs';

// Names, dates and IDs below are fictitious. These tests never connect to a database.
const guest = 'Estudante Fictício Ômega';
const publisher = 'Publicador Fictício Alfa';
const schedule = {
    weekDate: 'Semana fictícia de 2030',
    treasures: [{ title: 'Leitura da Bíblia (4 min)' }],
    ministry: [{ title: 'Iniciando conversas (3 min)' }], living: []
};

function savingRoute() {
    const calls = [];
    const client = { query: async (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes('SELECT id, nome_completo')) return { rows: [{ id: 900001, nome_completo: publisher }] };
        return { rows: [] };
    }, release() {} };
    const route = loadRoute('../../app/api/admin/salvar-designacoes/route.js', {
        Pool: class { connect() { return client; } },
        getUserIdFromRequest: () => 990001, getUserPermissions: async () => ({}),
        isAllowed: () => true, registerAuditLog: async () => {}
    });
    return { ...route, calls };
}

test('a student without a publisher record is saved in the program without creating a publisher', async () => {
    const route = savingRoute();
    const result = await route.POST({ json: async () => ({
        scheduleData: schedule, meetingDate: '2030-01-09', assignments: { tesouro_0: guest, presidente: publisher }
    }) });
    assert.equal(result.status, 201);
    const program = JSON.parse(route.calls.find(c => c.sql.includes('INSERT INTO reunioes_dados')).params[1]);
    assert.equal(program.participantes_externos[0].nome_completo, guest);
    assert.equal(program.participantes_externos[0].parte_id, 'tesouro_0');
    assert.equal(route.calls.filter(c => c.sql.includes('INSERT INTO designacoes_reuniao')).length, 1);
    assert.equal(route.calls.some(c => c.sql.includes('INSERT INTO publicadores')), false);
});

test('participants without records cannot be silently assigned as chairman', async () => {
    const route = savingRoute();
    const result = await route.POST({ json: async () => ({
        scheduleData: schedule, meetingDate: '2030-01-09', assignments: { presidente: guest }
    }) });
    assert.equal(result.status, 400);
    assert.ok(route.calls.some(c => c.sql === 'ROLLBACK'));
    assert.equal(route.calls.some(c => c.sql.includes('INSERT INTO reunioes_dados')), false);
});

test('clearing an external student also clears the stored guest entry', async () => {
    const route = savingRoute();
    const result = await route.POST({ json: async () => ({
        scheduleData: { ...schedule, participantes_externos: [{ parte_id: 'tesouro_0', nome_completo: guest }] },
        meetingDate: '2030-01-09', assignments: { tesouro_0: '' }
    }) });
    assert.equal(result.status, 201);
    const program = JSON.parse(route.calls.find(c => c.sql.includes('INSERT INTO reunioes_dados')).params[1]);
    assert.equal(program.participantes_externos.length, 0);
});

test('restoring an external student keeps student and assistant in the correct slots', () => {
    const source = readFileSync(new URL('../app/components/designacoes/LifeMinistryTab.jsx', import.meta.url), 'utf8');
    const truncate = source.slice(source.indexOf('function truncatePartTitle('), source.indexOf('function getShortName('));
    const mapping = source.slice(source.indexOf('const mapSavedToAssignments ='), source.indexOf('const generateWhatsAppText ='));
    const context = vm.createContext({});
    vm.runInContext(truncate + mapping + '\nglobalThis.map = mapSavedToAssignments;', context);
    const title = 'Iniciando conversas (3 min)';
    const result = context.map([
        { nome_parte: title, nome_completo: publisher },
        { nome_parte: title, nome_completo: guest }
    ], { ...schedule, participantes_externos: [{ parte_id: 'ministerio_0_1', nome_completo: guest, nome_parte: title }] });
    assert.equal(result.ministerio_0_1, guest);
    assert.equal(result.ministerio_0_2, publisher);
});
