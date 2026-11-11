import { PDFDocument, PDFName, PDFString, StandardFonts, drawCheckMark, rgb } from 'pdf-lib';
import { normalizePartTitle, truncatePartTitle } from './life-ministry-parts.js';
import { isCalendarDate } from './meeting-calendar.js';
import { formatDateBR, formatDateForFile } from './date-format.js';

export const STUDENT_SLIP_TEMPLATE = '/templates/S-89_T.pdf';
const TEXT_FIELDS = ['900_1_Text_SanSerif', '900_2_Text_SanSerif', '900_3_Text_SanSerif', '900_4_Text_SanSerif'];

export function getStudentSlips(schedule, assignments, date) {
    if (!isCalendarDate(date)) throw new Error('Data da reunião inválida.');
    const cards = [];
    const add = (part, number, student, assistant = '') => {
        if (!student?.trim()) return;
        const title = truncatePartTitle(part.title).replace(/^\s*\d+\.\s*/, '').replace(/\s*\(\d+\s*min\).*$/i, '').trim();
        cards.push({ student: student.trim(), assistant: assistant?.trim() || '', date,
            number: String(part.title.match(/^\s*(\d+)\./)?.[1] || number), title: title.toLocaleUpperCase('pt-BR') });
    };
    schedule.treasures?.forEach((part, index) => {
        const title = normalizePartTitle(part.title).replace(/^\d+\.\s*/, '');
        // Match the part's heading, not references to Bible reading inside the Joias instructions.
        if (/^leitura da biblia\b/.test(title)) add(part, index + 1, assignments[`tesouro_${index}`]);
    });
    schedule.ministry?.forEach((part, index) => {
        const title = normalizePartTitle(part.title);
        // Discussions led from the platform are not student assignments.
        if (/\bconsideracao\b/.test(title) || title.startsWith('o que voce diria')) return;
        const speech = title.includes('discurso');
        add(part, (schedule.treasures?.length || 0) + index + 1,
            assignments[`ministerio_${index}`] || assignments[`ministerio_${index}_1`],
            speech ? '' : assignments[`ministerio_${index}_2`]);
    });
    return cards;
}

export async function createStudentSlipsPdf(templateBytes, cards) {
    if (!cards.length) throw new Error('Não há estudantes designados nesta semana para gerar o S-89.');
    const output = await PDFDocument.create();
    const outputForm = output.getForm();
    const editableFont = await output.embedFont(StandardFonts.Helvetica);
    outputForm.acroForm.dict.set(PDFName.of('DR'), output.context.obj({ Font: { Helvetica: editableFont.ref } }));
    outputForm.acroForm.dict.set(PDFName.of('DA'), PDFString.of('/Helvetica 11 Tf 0 g'));
    for (const [index, card] of cards.entries()) {
        const source = await PDFDocument.load(templateBytes);
        const form = source.getForm();
        const font = await source.embedFont(StandardFonts.Helvetica);
        const values = [card.student, card.assistant, formatDateBR(card.date), `${card.number} - ${card.title}`];
        for (const [i, name] of TEXT_FIELDS.entries()) {
            const field = form.getTextField(name);
            const width = field.acroField.getWidgets()[0].getRectangle().width - 4;
            const text = values[i] || '';
            field.acroField.setDefaultAppearance('/Helv 11 Tf 0 g');
            if (i === 3 && font.widthOfTextAtSize(text, 8) > width) {
                field.enableMultiline();
                field.setFontSize(7);
            } else field.setFontSize(Math.min(11, width / Math.max(font.widthOfTextAtSize(text, 1), 1)));
            field.setText(text);
        }
        form.getCheckBox('900_5_CheckBox').check();
        for (const name of ['900_6_CheckBox', '900_7_CheckBox']) form.getCheckBox(name).uncheck();
        form.updateFieldAppearances(font);
        for (const name of ['900_5_CheckBox', '900_6_CheckBox', '900_7_CheckBox']) {
            form.getCheckBox(name).updateAppearances((_field, widget) => {
                const { width, height } = widget.getRectangle();
                return { normal: { on: drawCheckMark({ x: width / 2, y: height / 2,
                    size: Math.min(width, height), thickness: 1.2, color: rgb(0, 0, 0) }), off: [] } };
            });
        }
        // Unique field names prevent one student's edits changing another card.
        for (const field of form.getFields()) field.acroField.setPartialName(`s89_${index + 1}_${field.getName()}`);
        const [page] = await output.copyPages(source, [0]);
        output.addPage(page);
        for (const widgetRef of page.node.Annots()?.asArray() || []) {
            let fieldRef = widgetRef;
            let field = output.context.lookup(fieldRef);
            while (field.has(PDFName.of('Parent'))) {
                fieldRef = field.get(PDFName.of('Parent'));
                field = output.context.lookup(fieldRef);
            }
            outputForm.acroForm.addField(fieldRef);
        }
    }
    output.setTitle('Designações dos estudantes - Vida e Ministério');
    output.setSubject('Formulários S-89 preenchidos por semana');
    return output.save({ updateFieldAppearances: false });
}

export async function buildStudentSlipFiles(templateBytes, cards, mode) {
    if (!['individual', 'combined'].includes(mode)) throw new Error('Escolha o formato de download.');
    if (!cards.length) throw new Error('Não há estudantes designados nesta semana para gerar o S-89.');
    if (mode === 'combined') return [{ filename: `S-89_${formatDateForFile(cards[0].date)}.pdf`, bytes: await createStudentSlipsPdf(templateBytes, cards) }];
    return Promise.all(cards.map(async card => {
        const name = card.student.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
        return { filename: `S-89_${formatDateForFile(card.date)}_${name}_parte-${card.number}.pdf`, bytes: await createStudentSlipsPdf(templateBytes, [card]) };
    }));
}
