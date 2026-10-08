import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyAddress, programLink, parseWeeklyProgram, fetchWeeklyProgram } from '../app/lib/jw-program.js';
import { importMeetingProgram } from '../app/lib/jw-program-service.js';
import { importCreatedPrograms, requestMeetingProgram } from '../app/lib/import-programs-client.js';
import { loadRoute } from './helpers/load-source.mjs';

// Artificial publication: no real people, assignments or persistent database access.
const html = `<article class="pub-mwb"><header><h1><span class="pageNum">2</span>7-13 DE JANEIRO</h1><h2>LEITURA FICTÍCIA 1-2</h2></header>
<h3>Cântico 1 e oração | Comentários iniciais (1 min)</h3>
<h2>TESOUROS DA PALAVRA DE DEUS</h2>
<h3>1. Tema fictício</h3><p>(10 min)</p><p>Referência fictícia.</p>
<h3>2. Joias espirituais</h3><p>(10 min)</p><p>Pergunta fictícia.</p><div class="gen-field"><p>Sua resposta</p></div>
<h3>3. Leitura da Bíblia</h3><p>(4 min) Referência 1:1-5 (lição 2)</p>
<h2>FAÇA SEU MELHOR NO MINISTÉRIO</h2><h3>4. Conversa fictícia</h3><p>(3 min) Referência de estudante.</p>
<h2>NOSSA VIDA CRISTÃ</h2><h3>Cântico 2</h3><h3>5. Estudo bíblico de congregação</h3><p>(30 min) Capítulo fictício.</p>
<h3>Comentários finais (3 min) | Cântico 3 e oração</h3></article>`;
const date = '2030-01-09';
const schedule = { ...parseWeeklyProgram(html, date), source: { url: 'https://wol.jw.org/pt/wol/d/r5/lp-t/999999', weekStart: '2030-01-07' } };

test('weekly addresses use ISO weeks across year and month boundaries', () => {
    assert.equal(weeklyAddress(date).url, 'https://wol.jw.org/pt/wol/meetings/r5/lp-t/2030/2');
    assert.equal(weeklyAddress('2027-01-01').url, 'https://wol.jw.org/pt/wol/meetings/r5/lp-t/2026/53');
    assert.equal(weeklyAddress('2026-12-31').monday, '2026-12-28');
    assert.throws(() => weeklyAddress('2030-02-30'), /inválida/);
});

test('parser extracts timed parts, references and songs without answer fields', () => {
    assert.deepEqual([schedule.treasures.length, schedule.ministry.length, schedule.living.length], [3, 1, 1]);
    assert.deepEqual([schedule.initialSong, schedule.middleSong, schedule.finalSong], ['Cântico 1', 'Cântico 2', 'Cântico 3']);
    assert.equal(schedule.treasures[2].duration, 4);
    assert.match(schedule.treasures[2].title, /Referência 1:1-5/);
    assert.ok(!JSON.stringify(schedule).includes('Sua resposta'));
    assert.equal(schedule.weekDate, '7-13 DE JANEIRO DE 2030');
});

test('parser fails closed for missing durations, sections, songs or wrong weeks', () => {
    for (const bad of [html.replace('(4 min)', ''), html.replace('FAÇA SEU MELHOR NO MINISTÉRIO', 'Outra seção'),
        html.replace('Cântico 3', ''), html.replace('7-13 DE JANEIRO', '14-20 DE JANEIRO'), html.replace('4. Conversa', '6. Conversa')]) {
        assert.throws(() => parseWeeklyProgram(bad, date));
    }
});

test('parser validates week ranges that cross month and year boundaries', () => {
    assert.equal(parseWeeklyProgram(html.replace('7-13 DE JANEIRO', '28 DE DEZEMBRO–3 DE JANEIRO'), '2026-12-30').weekDate, '28 DE DEZEMBRO–3 DE JANEIRO DE 2027');
    assert.throws(() => parseWeeklyProgram(html.replace('7-13 DE JANEIRO', '28 DE NOVEMBRO–3 DE JANEIRO'), '2026-12-30'));
});

test('retrieval follows only the weekly workbook and records its source', async () => {
    const requested = [];
    const fetcher = async (url, options) => {
        requested.push(url);
        assert.equal(options.redirect, 'error');
        return { ok: true, text: async () => requested.length === 1
            ? '<a href="/pt/wol/d/r5/lp-t/999999">7-13 de janeiro Apostila Vida e Ministério — 2030</a>' : html };
    };
    const result = await fetchWeeklyProgram(date, fetcher);
    assert.equal(requested.length, 2);
    assert.equal(result.source.url, 'https://wol.jw.org/pt/wol/d/r5/lp-t/999999');
    assert.equal(result.source.weekStart, '2030-01-07');
    assert.ok(result.source.importedAt);
    assert.throws(() => programLink('<a href="/pt/wol/d/r5/lp-t/99">A Sentinela</a>'), /disponível/);
    await assert.rejects(fetchWeeklyProgram(date, async () => ({ ok: false })), /acessar/);
    await assert.rejects(fetchWeeklyProgram(date, async () => { throw new DOMException('timeout', 'TimeoutError'); }), /Tente novamente/);
    await assert.rejects(fetchWeeklyProgram(date, async () => ({ ok: true, text: async () => '<a href="https://example.test/pt/wol/d/r5/lp-t/99">Apostila Vida e Ministério</a>' })), /Fonte inválida/);
});

function fixture({ saved = false, race = false, assigned = false, cancelled = false, moved = false, networkFailure = false } = {}) {
    const calls = [];
    let locks = 0;
    let fetches = 0;
    const client = { query: async (sql, params) => {
        calls.push({ sql, params });
        if (sql.startsWith('SELECT 1 FROM reunioes_dados')) return { rowCount: saved || (race && locks === 2) ? 1 : 0 };
        if (sql.startsWith('SELECT 1 FROM designacoes_reuniao')) return { rowCount: assigned ? 1 : 0 };
        return { rowCount: 1 };
    } };
    const dependencies = {
        lockMeeting: async () => { locks++; if (cancelled && locks === 2) throw new Error('Reunião cancelada'); return { id: 910001, data: moved && locks === 2 ? '2030-01-10' : date }; },
        fetchProgram: async () => { fetches++; if (networkFailure) throw new Error('Sem conexão'); return schedule; },
        audit: async () => {}, userId: 990001
    };
    return { calls, run: () => importMeetingProgram(client, 910001, dependencies), fetches: () => fetches };
}

test('import saves unassigned parts with a canonical meeting link and metadata', async () => {
    const f = fixture();
    assert.equal((await f.run()).status, 'imported');
    const write = f.calls.find(c => c.sql.includes('INSERT INTO'));
    assert.equal(write.params[0], date);
    assert.equal(write.params[3], 910001);
    assert.equal(JSON.parse(write.params[1]).source.url, schedule.source.url);
    assert.ok(!f.calls.some(c => /DELETE|UPDATE/.test(c.sql)));
});

test('saved programmes, concurrent imports and legacy participants are preserved', async () => {
    for (const options of [{ saved: true }, { race: true }, { assigned: true }]) {
        const f = fixture(options);
        assert.equal((await f.run()).status, 'preserved');
        assert.ok(!f.calls.some(c => c.sql.includes('INSERT INTO')));
        if (options.saved) assert.equal(f.fetches(), 0);
    }
});

test('network failures, cancellation and date changes cannot save a stale programme', async () => {
    for (const options of [{ networkFailure: true }, { cancelled: true }, { moved: true }]) {
        const f = fixture(options);
        await assert.rejects(f.run());
        assert.ok(!f.calls.some(c => c.sql.includes('INSERT INTO')));
    }
});

test('endpoint checks permissions and rejects invalid IDs before import', async () => {
    let allowed = false;
    let imports = 0;
    let userId = 990001;
    let connections = 0;
    const client = { release() {} };
    const route = loadRoute('../../app/api/admin/reunioes/importar-programacao/route.js', {
        Pool: class { async connect() { connections++; return client; } }, getUserIdFromRequest: () => userId,
        getUserPermissions: async () => ({}), isAllowed: () => allowed,
        lockAssignmentMeeting() {}, fetchWeeklyProgram() {}, registerAuditLog() {},
        importMeetingProgram: async () => { imports++; return { status: 'imported' }; }
    });
    const request = id => ({ json: async () => ({ reuniao_id: id }) });
    assert.equal((await route.POST(request(910001))).status, 403);
    allowed = true;
    assert.equal((await route.POST(request(-1))).status, 400);
    assert.equal(imports, 0);
    assert.equal((await route.POST(request(910001))).body.status, 'imported');
    userId = null;
    const previousConnections = connections;
    assert.equal((await route.POST(request(910001))).status, 401);
    assert.equal(connections, previousConnections);
});

test('programme request explicitly sends session cookies and reports expired sessions', async () => {
    await requestMeetingProgram(910001, async (url, options) => {
        assert.equal(url, '/api/admin/reunioes/importar-programacao');
        assert.equal(options.credentials, 'same-origin');
        assert.equal(options.cache, 'no-store');
        assert.deepEqual(JSON.parse(options.body), { reuniao_id: 910001 });
        return { ok: true, status: 200, json: async () => ({ status: 'imported' }) };
    });
    await assert.rejects(requestMeetingProgram(910001, async () => ({ ok: false, status: 401 })),
        error => error.status === 401 && /Entre novamente/.test(error.message) && /preservadas/.test(error.message));
    await assert.rejects(requestMeetingProgram(910001, async () => ({ ok: false, status: 403,
        json: async () => ({ message: 'Permissão negada.' }) })), error => error.status === 403 && error.message === 'Permissão negada.');
});

test('batch pauses network requests after session expiry and keeps remaining weeks pending', async () => {
    const original = globalThis.fetch;
    let requests = 0;
    try {
        globalThis.fetch = async () => { requests++; return { ok: false, status: 401 }; };
        const result = await importCreatedPrograms([{ id: 910001, data: date }, { id: 910002, data: '2030-01-16' }]);
        assert.equal(requests, 1);
        assert.equal(result.sessionRequired, true);
        assert.equal(result.details.length, 2);
        assert.ok(result.details.every(detail => /Entre novamente/.test(detail)));
        assert.match(result.message, /2 pendentes/);
    } finally { globalThis.fetch = original; }
});

test('client continues after an unavailable week and reports preserved and pending dates', async () => {
    const original = globalThis.fetch;
    let requests = 0;
    try {
        globalThis.fetch = async () => { requests++; if (requests === 1) throw new Error('offline'); return { ok: true, json: async () => ({ status: 'preserved' }) }; };
        const result = await importCreatedPrograms([{ id: 910001, data: date }, { id: 910002, data: '2030-01-16' }]);
        assert.equal(requests, 2);
        assert.match(result.message, /1 preservadas; 1 pendentes/);
        assert.match(result.details[0], /09\/01\/2030/);
    } finally { globalThis.fetch = original; }
});
