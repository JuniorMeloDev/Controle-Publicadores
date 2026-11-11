import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { getStudentSlips, createStudentSlipsPdf, buildStudentSlipFiles } from '../app/lib/student-slips-pdf.js';
import { loadRoute, loadModule } from './helpers/load-source.mjs';

const schedule = {
    treasures: [{ title: 'Discurso dos tesouros' }, { title: 'Joias espirituais' }, { title: 'Leitura da Bíblia (4 min)' }],
    ministry: [{ title: 'Iniciando conversas (3 min) DE CASA EM CASA.' },
        { title: 'Explicando suas crenças (5 min) Discurso.' }, { title: 'O que você diria? (5 min) Consideração.' }],
};
const assignments = { tesouro_0: 'Outro participante', tesouro_2: 'João Antônio', ministerio_0_1: 'Ana Carolina',
    ministerio_0_2: 'Maria José', ministerio_1: 'José Luís', ministerio_2_1: 'Dirigente' };

test('student cards include reading, student/assistant pairs and speeches with number and accented title', () => {
    const cards = getStudentSlips(schedule, assignments, '2026-11-25');
    assert.equal(cards.length, 3);
    assert.deepEqual(cards.map(c => [c.number, c.title, c.student, c.assistant]), [
        ['3', 'LEITURA DA BÍBLIA', 'João Antônio', ''],
        ['4', 'INICIANDO CONVERSAS', 'Ana Carolina', 'Maria José'],
        ['5', 'EXPLICANDO SUAS CRENÇAS', 'José Luís', ''],
    ]);
    assert.equal(getStudentSlips(schedule, {}, '2026-11-25').length, 0);
    assert.throws(() => getStudentSlips(schedule, assignments, '2026-02-30'));
});

test('S-89 export keeps independent editable fields, accents, actual meeting date and main hall', async () => {
    const cards = getStudentSlips(schedule, assignments, '2026-11-25');
    const bytes = await createStudentSlipsPdf(await readFile(new URL('../public/templates/S-89_T.pdf', import.meta.url)), cards);
    const pdf = await PDFDocument.load(bytes);
    const form = pdf.getForm();
    assert.equal(pdf.getPageCount(), 3);
    assert.equal(form.getFields().length, 21);
    assert.equal(form.getTextField('s89_1_900_1_Text_SanSerif').getText(), 'João Antônio');
    assert.equal(form.getTextField('s89_2_900_2_Text_SanSerif').getText(), 'Maria José');
    assert.equal(form.getTextField('s89_3_900_4_Text_SanSerif').getText(), '5 - EXPLICANDO SUAS CRENÇAS');
    assert.equal(form.getTextField('s89_1_900_3_Text_SanSerif').getText(), '25/11/2026');
    for (let i = 1; i <= 3; i++) {
        assert.equal(form.getCheckBox(`s89_${i}_900_5_CheckBox`).isChecked(), true);
        assert.equal(form.getCheckBox(`s89_${i}_900_6_CheckBox`).isChecked(), false);
        assert.equal(form.getCheckBox(`s89_${i}_900_7_CheckBox`).isChecked(), false);
    }
    form.getTextField('s89_1_900_1_Text_SanSerif').setText('Editado');
    assert.equal(form.getTextField('s89_2_900_1_Text_SanSerif').getText(), 'Ana Carolina');
    const edited = await PDFDocument.load(await pdf.save());
    assert.equal(edited.getForm().getTextField('s89_1_900_1_Text_SanSerif').getText(), 'Editado');
    await assert.rejects(createStudentSlipsPdf(new Uint8Array(), []), /Não há estudantes/);
});

test('Joias espirituais never generates a student slip even when its instructions mention Bible reading', () => {
    const withJoias = { ...schedule, treasures: [schedule.treasures[0],
        { title: '2. Joias espirituais (10 min) Que joias encontrou na leitura da Bíblia desta semana?' },
        { title: '3. Leitura da Bíblia (4 min)' }] };
    const cards = getStudentSlips(withJoias, { ...assignments, tesouro_1: 'Responsável pelas joias' }, '2026-11-25');
    assert.equal(cards.length, 3);
    assert.ok(cards.every(card => !card.title.includes('JOIAS') && card.student !== 'Responsável pelas joias'));
    assert.deepEqual(cards.map(card => card.number), ['3', '4', '5']);
});

test('saved meeting details prefer the called name and fall back to the full name', async () => {
    const parts = await loadModule('../../app/lib/life-ministry-parts.js');
    const route = loadRoute('../../app/api/admin/get-meeting-details/route.js', {
        ...parts,
        Pool: class { connect() { return { query: async sql => ({ rows: sql.includes('SELECT dados_json')
            ? [{ dados_json: schedule, descricao_texto: 'Semana fictícia' }]
            : [{ nome_parte: 'Leitura da Bíblia (4 min)', nome_completo: 'João Antônio da Silva', nome_chamado: 'João Antônio' },
                { nome_parte: 'Iniciando conversas (3 min)', nome_completo: 'Ana Carolina', nome_chamado: '' }] }), release() {} }; } },
    });
    const response = await route.GET({ url: 'http://localhost/api/admin/get-meeting-details?date=2026-11-25' });
    assert.equal(response.status, 200);
    assert.equal(response.body.assignments.tesouro_2, 'João Antônio');
    assert.equal(response.body.assignments.ministerio_0_1, 'Ana Carolina');
});

test('individual download creates one named, editable PDF per student; combined download keeps all pages', async () => {
    const template = await readFile(new URL('../public/templates/S-89_T.pdf', import.meta.url));
    const cards = getStudentSlips(schedule, assignments, '2026-11-25');
    const files = await buildStudentSlipFiles(template, cards, 'individual');
    assert.equal(files.length, 3);
    assert.deepEqual(files.map(file => file.filename), [
        'S-89_25-11-2026_João Antônio_parte-3.pdf',
        'S-89_25-11-2026_Ana Carolina_parte-4.pdf',
        'S-89_25-11-2026_José Luís_parte-5.pdf',
    ]);
    for (const [index, file] of files.entries()) {
        const pdf = await PDFDocument.load(file.bytes);
        assert.equal(pdf.getPageCount(), 1);
        assert.equal(pdf.getForm().getFields().length, 7);
        assert.equal(pdf.getForm().getTextField('s89_1_900_1_Text_SanSerif').getText(), cards[index].student);
    }
    const combined = await buildStudentSlipFiles(template, cards, 'combined');
    assert.equal(combined.length, 1);
    assert.equal(combined[0].filename, 'S-89_25-11-2026.pdf');
    assert.equal((await PDFDocument.load(combined[0].bytes)).getPageCount(), 3);
    const repeated = await buildStudentSlipFiles(template, [{ ...cards[0], student: 'João/Antônio' }, { ...cards[1], student: 'João/Antônio' }], 'individual');
    assert.ok(repeated.every(file => !file.filename.includes('/')));
    assert.notEqual(repeated[0].filename, repeated[1].filename);
    await assert.rejects(buildStudentSlipFiles(template, [], 'combined'), /Não há estudantes/);
    await assert.rejects(buildStudentSlipFiles(template, cards, 'unknown'), /formato/);
});
