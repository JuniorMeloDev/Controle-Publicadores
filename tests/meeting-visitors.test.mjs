import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const visitors = await loadModule('../../app/lib/meeting-visitors.js');
const absenceReport = await loadModule('../../app/lib/attendance-report.js');

test('visitor separation preserves old totals and derives the sum for new records', () => {
    assert.deepEqual(visitors.meetingVisitors({ visitantes: 8 }), { visitantes_presencial: 8, visitantes_zoom: 0, visitantes: 8 });
    assert.deepEqual(visitors.meetingVisitors({ visitantes: 99, visitantes_presencial: 3, visitantes_zoom: 5 }), { visitantes_presencial: 3, visitantes_zoom: 5, visitantes: 8 });
    assert.equal(visitors.meetingVisitors({ visitantes: 9, visitantes_presencial: 0, visitantes_zoom: 2 }).visitantes, 2);
});

test('visitor input rejects fractional, negative, missing and overflowing values', () => {
    for (const value of [null, {}, { visitantes: 3 }, { visitantes_presencial: -1, visitantes_zoom: 0 },
        { visitantes_presencial: 1.5, visitantes_zoom: 0 }, { visitantes_presencial: '3', visitantes_zoom: 0 },
        { visitantes_presencial: 2147483647, visitantes_zoom: 1 }]) assert.throws(() => visitors.validateMeetingVisitors(value));
    assert.equal(visitors.validateMeetingVisitors({ visitantes_presencial: 0, visitantes_zoom: 0 }).visitantes, 0);
});

test('meeting update persists both modalities and the compatible total and detects a missing meeting', async () => {
    const calls = [];
    let exists = true;
    const route = loadRoute('../../app/api/admin/reunioes/[id]/route.js', {
        ...visitors,
        Pool: class { connect() { return { query: async (sql, values) => {
            calls.push({ sql, values }); return { rows: sql.includes('UPDATE') && exists ? [{ id: 30 }] : [] };
        }, release() {} }; } },
    });
    const params = { params: Promise.resolve({ id: '30' }) };
    const request = { json: async () => ({ visitantes_presencial: 4, visitantes_zoom: 2 }) };
    assert.equal((await route.PUT(request, params)).status, 200);
    assert.deepEqual([...calls.find(c => c.sql.includes('UPDATE')).values], [6, 4, 2, '30']);
    exists = false;
    assert.equal((await route.PUT(request, params)).status, 404);
    calls.length = 0;
    assert.equal((await route.PUT({ json: async () => ({ visitantes_presencial: -1, visitantes_zoom: 2 }) }, params)).status, 400);
    assert.equal(calls.length, 0);
});

test('assistance report keeps visitors separate from publisher attendance and absence counts', async () => {
    const route = loadRoute('../../app/api/admin/relatorios/assistencia/route.js', {
        ...visitors,
        ...absenceReport,
        Pool: class { connect() { return { query: async sql => ({ rows: sql.includes('SELECT COUNT(*)') ? [{ count: '20' }]
            : sql.includes('FROM reunioes_registro') ? [{ data: '2026-11-11', presencial: 10, zoom: 3, total_presente: 13, presentes_para_faltas: 13, visitantes: 6, visitantes_presencial: 4, visitantes_zoom: 2 }] : [] }), release() {} }; } },
    });
    const response = await route.GET({ url: 'http://localhost/api/admin/relatorios/assistencia' });
    assert.equal(response.status, 200);
    const row = response.body.history[0];
    assert.equal(row.visitantes_presencial, 4); assert.equal(row.visitantes_zoom, 2);
    assert.equal(row.total_geral, 19); assert.equal(row.faltantes, 7);
    assert.equal(response.body.averages.visitantes_presencial, 4); assert.equal(response.body.averages.visitantes_zoom, 2);
});
