import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { fieldLeadersReport, writeFieldLeadersPdf } from '../app/lib/field-leaders-pdf.js';

const data = {
  publicadores: [{ id: 1, nome: 'Dirigente de teste' }], locais: [{ id: 2, nome: 'Local de teste' }], grupos: [{ id: 3, nome: 'Grupo 3' }], territorios: [{ id: 4, numero: 17 }],
  saidas: [
    { id: 1, data: '2026-11-08', horario: '09:00', dirigente_publicador_id: 1, local_id: 2, grupos: [3], territorios: [4], modalidade: 'territorio' },
    { id: 2, data: '2026-11-01', horario: '08:30', dirigente_publicador_id: null, local_id: null, grupos: [], territorios: [], modalidade: 'cartas' },
    { id: 3, data: '2026-12-01', horario: '08:30', dirigente_publicador_id: 1, local_id: 2, grupos: [], territorios: [4], modalidade: 'territorio' }
  ]
};

test('monthly leader table filters calendar month, sorts outings, resolves labels and keeps unassigned leaders', () => {
  const report = fieldLeadersReport(data, '2026', '11');
  assert.equal(report.rows.length, 2); assert.equal(report.leaders, 1); assert.equal(report.pending, 1);
  assert.equal(report.rows[0].date, '2026-11-01'); assert.equal(report.rows[0].leader, 'A definir');
  assert.equal(report.rows[0].groups, 'Congregação'); assert.equal(report.rows[0].territories, 'Cartas');
  assert.equal(report.rows[1].leader, 'Dirigente de teste'); assert.equal(report.rows[1].place, 'Local de teste');
  assert.equal(report.rows[1].territories, '17'); assert.equal(report.rows[1].groups, 'Grupo 3');
  assert.equal(report.label, 'Novembro de 2026');
  assert.equal(fieldLeadersReport(data, 2027, 1).rows.length, 0);
  for (const [year, month] of [[2026, 13], ['2026x', 11], [2026, 0]]) assert.throws(() => fieldLeadersReport(data, year, month));
});

test('monthly PDF wraps and paginates long cells without losing names or crossing the footer', () => {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const positions = [], text = doc.text.bind(doc);
  doc.text = (value, x, y, ...args) => { positions.push({ value, x, y }); return text(value, x, y, ...args); };
  writeFieldLeadersPdf(doc, { ...data, publicadores: [{ id: 1, nome: 'Dirigente nome longo '.repeat(100) }], saidas: Array.from({ length: 20 }, (_, i) => ({ ...data.saidas[0], id: i + 1 })) }, 2026, 11);
  assert.ok(doc.getNumberOfPages() > 1);
  assert.ok(positions.some(p => String(p.value).includes('Dirigente nome longo')));
  for (const p of positions) {
    assert.ok(p.x >= 16 && p.x <= 281.1);
    assert.ok(p.y >= 10 && p.y <= 199.1);
    if (Array.isArray(p.value)) assert.ok(p.y + (p.value.length - 1) * 4 <= 187);
  }
});
