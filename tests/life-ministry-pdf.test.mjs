import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { jsPDF } from 'jspdf';

const source = readFileSync(new URL('../app/utils/generateLifeMinistryPDF.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export const ', 'const ');
const context = vm.createContext({ jsPDF });
vm.runInContext(source + '\nglobalThis.generate = generateLifeMinistryPDF;', context);
export const generate = context.generate;
export const schedule = {
    initialSong: 'Cântico 33', middleSong: 'Cântico 17', finalSong: 'Cântico 44',
    treasures: [{ title: '1. Tesouro fictício (10 min)' }, { title: '2. Joias espirituais (10 min)' }, { title: '3. Leitura da Bíblia (4 min)' }],
    ministry: Array.from({ length: 4 }, (_, i) => ({ title: `${i + 4}. Iniciando conversas (3 min): Uma demonstração fictícia com instruções de abordagem e uma explicação para o estudante e seu ajudante. (lição fictícia de treinamento)` })),
    living: [{ title: '8. Parte fictícia (15 min): Consideração' }, { title: '9. Estudo bíblico de congregação (30 min)' }]
};
export const assignments = { presidente: 'Presidente Fictício', comentarios_finais: 'Comentador Fictício', oracao_final: 'Oração Fictícia' };

test('a full programme with wrapped instructions fits one page with a bottom margin and closing song', () => {
    const doc = new jsPDF();
    const rect = doc.rect.bind(doc);
    const text = doc.text.bind(doc);
    const bottoms = [];
    const texts = [];
    doc.rect = (x, y, w, h, ...args) => { bottoms.push(y + h); return rect(x, y, w, h, ...args); };
    doc.text = (value, ...args) => { texts.push(value); return text(value, ...args); };
    // A supplied document represents a preceding week in a batch.
    generate(schedule, assignments, 'Semana fictícia', doc, false);
    assert.equal(doc.getNumberOfPages(), 2);
    assert.ok(Math.max(...bottoms) <= 287, `Content ends at ${Math.max(...bottoms)} mm`);
    assert.ok(texts.includes('44'));
    assert.ok(texts.includes('Oração Fictícia'));
});

test('a batch keeps both closing prayers inside their respective pages', () => {
    let doc = generate(schedule, assignments, 'Semana fictícia 1', null, false);
    doc = generate(schedule, { ...assignments, oracao_final: 'Segunda Oração Fictícia' }, 'Semana fictícia 2', doc, false);
    assert.equal(doc.getNumberOfPages(), 2);
});
