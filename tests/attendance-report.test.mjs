import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const report = await loadModule('../../app/lib/attendance-report.js');
const visitors = await loadModule('../../app/lib/meeting-visitors.js');

test('absence average excludes the same groups from population and present publishers while preserving attendance', async () => {
    const route = loadRoute('../../app/api/admin/relatorios/assistencia/route.js', {
        ...report, ...visitors,
        Pool: class { connect() { return { query: async sql => {
            if (sql.includes('SELECT COUNT(*)')) {
                assert.match(sql, /LEFT JOIN grupos g ON g.id = p.grupo_id/);
                assert.ok(sql.includes(`WHERE ${report.ABSENCE_ELIGIBLE_GROUP_SQL}`));
                return { rows: [{ count: '3' }] };
            }
            if (sql.includes('FROM reunioes_registro')) {
                assert.ok(sql.includes(`AND ${report.ABSENCE_ELIGIBLE_GROUP_SQL})::int as presentes_para_faltas`));
                assert.match(sql, /COUNT\(DISTINCT p.id\) FILTER \(WHERE a.modalidade IN \('Presencial', 'Zoom'\)/);
                // Five attended, but only two belong to groups eligible for absence statistics.
                return { rows: [{ data: '2026-11-11', presencial: 4, zoom: 1, total_presente: 5, presentes_para_faltas: 2, visitantes: 2 }] };
            }
            return { rows: [] };
        }, release() {} }; } },
    });
    const response = await route.GET({ url: 'http://localhost/api/admin/relatorios/assistencia' });
    assert.equal(response.status, 200);
    assert.equal(response.body.averages.faltantes, 1);
    assert.equal(response.body.history[0].faltantes, 1);
    assert.equal(response.body.history[0].presencial, 4);
    assert.equal(response.body.history[0].zoom, 1);
    assert.equal(response.body.history[0].total_geral, 7);
});

test('absence ranking filters groups before counting, including publishers with no attendance', async () => {
    const route = loadRoute('../../app/api/admin/relatorios/assistencia/detalhes/route.js', {
        ...report,
        Pool: class { connect() { return { query: async (sql, params) => {
            assert.deepEqual([...params], ['2026-11-01', '2026-11-30']);
            if (sql.includes('SELECT COUNT(*)')) return { rows: [{ count: '4' }] };
            assert.ok(sql.includes(`WHERE ${report.ABSENCE_ELIGIBLE_GROUP_SQL}`));
            assert.match(sql, /LEFT JOIN grupos g ON g.id = p.grupo_id/);
            assert.match(sql, /a.modalidade IN \('Presencial', 'Zoom'\)/);
            return { rows: [{ nome_completo: 'Pessoa do grupo ativo', presence_count: '2' },
                { nome_completo: 'Pessoa sem grupo', presence_count: '0' },
                { nome_completo: 'Pessoa sempre presente', presence_count: '4' }] };
        }, release() {} }; } },
    });
    const response = await route.GET({ url: 'http://localhost/api/admin/relatorios/assistencia/detalhes?type=faltantes&startDate=2026-11-01&endDate=2026-11-30' });
    assert.equal(response.status, 200);
    assert.deepEqual(Array.from(response.body, row => ({ ...row })), [
        { name: 'Pessoa sem grupo', value: 4 }, { name: 'Pessoa do grupo ativo', value: 2 },
    ]);
});
