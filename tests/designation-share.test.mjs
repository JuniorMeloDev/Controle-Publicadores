import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const { publicSpeechMessage, cleaningMessage, mechanicalWeekMessage, writeDesignationPdf } = await loadModule('../../app/lib/designation-share.js');
const { getWeekStart, isMechanicalTypeApplicable } = await loadModule('../../app/lib/mechanical-assignments.js');

test('speech and cleaning exports include saved participants, date and notes', () => {
  const speech = publicSpeechMessage({ data: '2030-01-13', tema: 'Tema fictício', orador: 'Orador', nome_chamado: 'Presidente', cantico: '42', congregacao: 'Congregação' });
  for (const text of ['13/01/2030', 'Tema fictício', 'Orador', 'Presidente', '42', 'Congregação']) assert.ok(speech.includes(text));
  const cleaning = cleaningMessage({ data: '2030-01-09', grupo: 'Grupo 1', tarefas: 'Varrer\nLimpar', responsaveis: 'José' });
  for (const text of ['09/01/2030', 'Grupo 1', 'Varrer\nLimpar', 'José']) assert.ok(cleaning.includes(text));
  assert.match(publicSpeechMessage({ data: '2030-01-13' }), /A definir/);
});

test('mechanical exports exclude cancelled meetings and inapplicable roles and preserve unfilled slots', () => {
  const week = { start: '2030-01-07', end: '2030-01-13', meetings: [
    { id: 1, data: '2030-01-09', tipo: 'Meio de Semana' },
    { id: 2, data: '2030-01-13', tipo: 'Fim de Semana' },
    { id: 3, data: '2030-01-10', tipo: 'Cancelada', cancelado: true },
  ] };
  const message = mechanicalWeekMessage(week, [{ id: 1, nome: 'Volante' }, { id: 2, nome: 'Leitor de A Sentinela' }],
    { 1: { 1: 7 }, 2: { 2: 8 } }, [{ id: 7, nome_completo: 'Pessoa A' }, { id: 8, nome_completo: 'Pessoa B' }], isMechanicalTypeApplicable);
  assert.equal(message.split('Leitor de A Sentinela').length, 2);
  assert.ok(!message.includes('Cancelada'));
  assert.match(message, /Volante: \*Pessoa A\*/); assert.match(message, /Leitor de A Sentinela: \*Pessoa B\*/);
  assert.match(message, /Volante: \*A definir\*/);
  assert.ok(message.includes('\u{1F3E0} *PRIVILÉGIOS MECÂNICOS*'));
  assert.ok(message.includes('\u{1F3A4} Volante'));
  assert.ok(message.includes('\u{1F4D6} Leitor'));
  assert.equal(decodeURIComponent(new URL(`https://api.whatsapp.com/send/?text=${encodeURIComponent(message)}`).search.slice(6)), message);
});

test('PDF wraps long notes, paginates and keeps every line inside the printable area', () => {
  const doc = new jsPDF(); const text = doc.text.bind(doc); const positions = [];
  doc.text = (value, x, y, ...args) => { positions.push(y); return text(value, x, y, ...args); };
  const message = Array.from({ length: 100 }, (_, i) => `${i}: Informações da designação e observações extensas. `.repeat(3)).join('\n');
  writeDesignationPdf(doc, 'Designações', message);
  assert.ok(doc.getNumberOfPages() > 1);
  assert.ok(positions.every(y => y >= 16 && y <= doc.internal.pageSize.getHeight() - 16));
  assert.ok(doc.output('arraybuffer').byteLength > 1000);
});

function deletionRoute({ permitted = true, auditFails = false, rows = [{ id: 1, data: '2030-01-09' }], guard } = {}) {
  const queries = [];
  const handlers = loadRoute('../../app/api/admin/privilegios/atribuicoes/route.js', {
    Pool: class { connect() { return { release() {}, query: async (sql, values) => { queries.push({ sql, values }); return { rows: sql.startsWith('SELECT') ? rows : [] }; } }; } },
    authorizeRequest: async () => guard || null, getUserIdFromRequest: () => 7,
    getUserPermissions: async () => ({}), isAllowed: () => permitted, getWeekStart,
    registerAuditLog: async () => { if (auditFails) throw new Error('Audit unavailable'); },
  });
  return { ...handlers, queries };
}
const request = (ids = '1') => ({ url: `https://example.test/api/admin/privilegios/atribuicoes?reuniao_ids=${ids}` });

test('mechanical deletion clears assignments and legacy references and preserves calendar meetings', async () => {
  const route = deletionRoute();
  assert.equal((await route.DELETE(request())).status, 200);
  assert.ok(route.queries.some(q => q.sql.startsWith('DELETE FROM reunioes_privilegios')));
  assert.ok(route.queries.some(q => q.sql.includes('leitor_id=NULL') && q.sql.includes('anciao_apoio_id=NULL')));
  assert.ok(!route.queries.some(q => q.sql.startsWith('DELETE FROM reunioes_registro')));
  assert.equal(route.queries.at(-1).sql, 'COMMIT');
});

test('mechanical deletion enforces permissions, valid IDs, active meetings, a single week and atomic audit', async () => {
  const denied = deletionRoute({ guard: { status: 401 } });
  assert.equal((await denied.DELETE(request())).status, 401); assert.equal(denied.queries.length, 0);
  const forbidden = deletionRoute({ permitted: false });
  assert.equal((await forbidden.DELETE(request())).status, 403); assert.equal(forbidden.queries.length, 0);
  for (const ids of ['', 'abc', '1,1', '0', '-1']) assert.equal((await deletionRoute().DELETE(request(ids))).status, 400);
  assert.equal((await deletionRoute({ rows: [] }).DELETE(request())).status, 400);
  const weeks = deletionRoute({ rows: [{ id: 1, data: '2030-01-09' }, { id: 2, data: '2030-01-16' }] });
  assert.equal((await weeks.DELETE(request('1,2'))).status, 400);
  assert.ok(!weeks.queries.some(q => q.sql.startsWith('DELETE')));
  const failed = deletionRoute({ auditFails: true });
  assert.equal((await failed.DELETE(request())).status, 500);
  assert.equal(failed.queries.at(-1).sql, 'ROLLBACK');
});
