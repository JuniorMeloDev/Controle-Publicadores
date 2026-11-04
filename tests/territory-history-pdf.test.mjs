import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { territoryHistoryReport, territoryHistoryYears, writeTerritoryHistoryPdf } from '../app/lib/territory-history-pdf.js';

const data = {
  territorios: [{ id: 1, numero: 1, ativo: true, periodo: 'fim_semana' }, { id: 2, numero: 2, ativo: true }, { id: 3, numero: 3, ativo: false }],
  publicadores: [{ id: 1, nome: 'Dirigente cadastrado' }],
  designacoes: [
    { id: 1, territorio_id: 1, publicador_id: 1, data_designacao: '2026-08-20', data_conclusao: '2026-09-03' },
    { id: 2, territorio_id: 1, responsavel_nome: 'Nome original', data_designacao: '2026-09-04', data_conclusao: '2026-09-04' },
    { id: 3, territorio_id: 1, responsavel_nome: 'Visita', data_designacao: '2027-08-31', data_conclusao: '2027-09-02' },
    { id: 4, territorio_id: 3, publicador_id: 1, data_designacao: '2026-10-01', data_conclusao: null },
    { id: 5, territorio_id: 2, publicador_id: 1, data_designacao: '2026-07-01', data_conclusao: '2026-07-02' },
    { id: 6, territorio_id: 2, publicador_id: 1, data_designacao: '2027-09-01', data_conclusao: null }
  ]
};

test('service-year export includes overlapping handovers and original names, and excludes later conclusions from latest date', () => {
  const report = territoryHistoryReport(data, 2027);
  assert.equal(report.start, '2026-09-01'); assert.equal(report.end, '2027-08-31');
  assert.equal(report.count, 4);
  assert.equal(report.territories[0].latest, '2026-09-04');
  assert.equal(report.territories[0].weekend, true);
  assert.deepEqual(report.territories[0].assignments.map(d => d.name), ['Dirigente cadastrado', 'Nome original', 'Visita']);
  assert.equal(report.territories[1].assignments.length, 0);
  assert.equal(report.territories[1].latest, '2026-07-02');
  assert.equal(report.territories[2].assignments[0].end, '');
  assert.throws(() => territoryHistoryReport(data, '2027x'));
});

test('service-year choices include intervening years of long or pending assignments', () => {
  const years = territoryHistoryYears({ designacoes: [{ data_designacao: '2023-09-01', data_conclusao: null }] }, '2026-11-04');
  assert.deepEqual(years, [2027, 2026, 2025, 2024]);
});

test('PDF keeps all assignments beyond five slots, and wraps very long names within page margins', () => {
  const state = { ...data, designacoes: Array.from({ length: 13 }, (_, i) => ({ id: i + 1, territorio_id: 1, responsavel_nome: `Pessoa ${i + 1} ` + (i === 12 ? 'Nome extenso '.repeat(150) : ''), data_designacao: '2026-10-01', data_conclusao: null })) };
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const text = [], original = doc.text.bind(doc);
  doc.text = (value, x, y, ...args) => { text.push({ value, x, y, page: doc.getNumberOfPages() }); return original(value, x, y, ...args); };
  writeTerritoryHistoryPdf(doc, state, 2027);
  assert.ok(doc.getNumberOfPages() > 1);
  for (let i = 1; i <= 13; i++) assert.ok(text.some(t => String(t.value).startsWith(`Pessoa ${i} `) || String(t.value) === `Pessoa ${i}`), `Missing person ${i}`);
  assert.ok(text.some(t => t.value === 'Pendente'));
  assert.ok(text.some(t => t.value === '(cont.)'));
  assert.ok(text.every(t => t.x >= 10 && t.x <= 287.01 && t.y >= 10 && t.y < 202.01));
  assert.ok(doc.output('arraybuffer').byteLength > 2000);
});
