import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadModule } from './helpers/load-source.mjs';

const { mechanicalPdfSections, writeMechanicalPdf } = await loadModule('../../app/lib/mechanical-pdf.js');
const { isMechanicalTypeApplicable } = await loadModule('../../app/lib/mechanical-assignments.js');
const input = {
  week: { start: '2030-01-07', end: '2030-01-13', meetings: [
    { id: 1, data: '2030-01-09', tipo: 'Meio de Semana' }, { id: 2, data: '2030-01-13', tipo: 'Fim de Semana' }
  ] },
  types: [{ id: 1, nome: 'Indicador Interno' }, { id: 2, nome: 'Leitor de A Sentinela' }],
  assignments: { 1: { 1: 7 }, 2: { 1: 8, 2: 7 } },
  publishers: [{ id: 7, nome_completo: 'Publicador Fictício Alfa' }, { id: 8, nome_completo: 'Publicador Fictício Beta' }]
};

test('weekly PDF separates the two meetings into tables with applicable roles and saved names', () => {
  const sections = mechanicalPdfSections(input);
  assert.equal(sections.length, 2); assert.equal(sections[0].date, '09/01/2030');
  assert.equal(sections[0].rows.length, 1); assert.equal(sections[1].rows.length, 2);
  assert.equal(sections[1].rows[1].name, 'Publicador Fictício Alfa');
  const doc = writeMechanicalPdf(new jsPDF(), input);
  assert.equal(doc.getNumberOfPages(), 1);
  assert.ok(doc.output('arraybuffer').byteLength > 1500);
});

test('per-day export excludes the other meeting and handles pending and cancelled slots', () => {
  const day = { ...input, week: { ...input.week, meetings: [input.week.meetings[1]] }, assignments: {} };
  const sections = mechanicalPdfSections(day);
  assert.equal(sections.length, 1); assert.equal(sections[0].date, '13/01/2030');
  assert.ok(sections[0].rows.every(row => row.name === 'A definir'));
  assert.equal(mechanicalPdfSections({ ...day, week: { ...day.week, meetings: [{ ...day.week.meetings[0], cancelado: true }] } }).length, 0);
});

test('long custom roles and names wrap and paginate within margins', () => {
  const doc = new jsPDF(); const original = doc.text.bind(doc); const positions = [];
  doc.text = (text, x, y, ...args) => { positions.push({ text, x, y }); return original(text, x, y, ...args); };
  writeMechanicalPdf(doc, { ...input, types: Array.from({ length: 35 }, (_, i) => ({ id: i + 1, nome: 'Privilégio com uma descrição detalhada '.repeat(4) })), publishers: [{ id: 7, nome_completo: 'Nome extenso '.repeat(50) }] });
  assert.ok(doc.getNumberOfPages() > 1);
  for (const position of positions) {
    const lines = Array.isArray(position.text) ? position.text.length : 1;
    assert.ok(position.y >= 10 && position.y <= doc.internal.pageSize.getHeight() - 10);
    if (position.y > 37 && position.y < 280) assert.ok(position.y + (lines - 1) * 5 < 276, 'Table cell crosses footer');
  }
});

test('single-meeting editor submits only the selected day and leaves the other day untouched', () => {
  const source = readFileSync(new URL('../app/components/designacoes/MechanicalWeekModal.jsx', import.meta.url), 'utf8');
  const payload = source.slice(source.indexOf('    function payload()'), source.indexOf('    async function insertAutomatic()'));
  const context = vm.createContext({ meetings: [input.week.meetings[1]], types: input.types, draft: input.assignments, isMechanicalTypeApplicable });
  vm.runInContext(payload + '\nglobalThis.result = payload();', context);
  assert.equal(context.result.length, 1); assert.equal(context.result[0].reuniao_id, 2);
  assert.equal(input.assignments[1][1], 7);
});
