import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers/load-source.mjs';

const { canExportMeeting, fetchLifeMinistryExportDetails } = await loadModule('../../app/lib/life-ministry-export.js');
const meeting = (date, extra = {}) => ({ dataSQL: date, tem_programacao: true, ...extra });
const response = (status, data) => ({ ok: status === 200, status, json: async () => data });

test('pending and cancelled meetings cannot be exported or requested', async () => {
    for (const extra of [{ tem_programacao: false }, { cancelado: true }]) {
        const item = meeting('2030-01-09', extra);
        assert.equal(canExportMeeting(item), false);
        await assert.rejects(fetchLifeMinistryExportDetails([item], new Set([item.dataSQL]), () => {
            assert.fail('Pending or cancelled meeting must not request details');
        }), /09\/01\/2030/);
    }
});

test('404 identifies the date and stops the batch instead of returning a partial export', async () => {
    const dates = ['2030-01-09', '2030-01-16', '2030-01-23'];
    let calls = 0;
    await assert.rejects(fetchLifeMinistryExportDetails(dates.map(date => meeting(date)), new Set(dates), async () => {
        calls++;
        return calls === 1 ? response(200, { schedule: { treasures: [] } }) : response(404, { message: 'Dados não encontrados.' });
    }), /16\/01\/2030: Programação não encontrada/);
    assert.equal(calls, 2);
});

test('expired session and API errors are reported', async () => {
    const items = [meeting('2030-01-09')];
    const selected = new Set(['2030-01-09']);
    await assert.rejects(fetchLifeMinistryExportDetails(items, selected, async () => response(401, {})), /sessão expirou/);
    await assert.rejects(fetchLifeMinistryExportDetails(items, selected, async () => response(500, { error: 'Falha fictícia' })), /09\/01\/2030: Falha fictícia/);
});

test('valid details remain chronological and allow participants to be pending', async () => {
    const items = [meeting('2030-01-16'), meeting('2030-01-09')];
    const requested = [];
    const results = await fetchLifeMinistryExportDetails(items, new Set(items.map(item => item.dataSQL)), async url => {
        requested.push(url);
        return response(200, { schedule: { treasures: [{ title: 'Parte fictícia' }] } });
    });
    assert.match(requested[0], /2030-01-09$/);
    assert.equal(results.length, 2);
    assert.deepEqual(results[0].assignments, {});
    assert.equal(results[0].weekDescription, '09/01/2030');
    assert.equal(items[0].dataSQL, '2030-01-16');
});
