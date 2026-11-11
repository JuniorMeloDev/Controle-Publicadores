import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createStudentSlipsPdf } from '../app/lib/student-slips-pdf.js';

const template = await readFile(new URL('../public/templates/S-89_T.pdf', import.meta.url));
const cards = [
    { student: 'João Antônio', assistant: '', date: '2026-11-25', number: '3', title: 'LEITURA DA BÍBLIA' },
    { student: 'Ana Carolina', assistant: 'Maria José', date: '2026-11-25', number: '4', title: 'INICIANDO CONVERSAS' },
    { student: 'José Luís Gonçalves', assistant: 'Débora Conceição', date: '2026-11-25', number: '5', title: 'EXPLICANDO SUAS CRENÇAS' },
    { student: 'Ana Carolina de Vasconcelos Albuquerque dos Santos', assistant: 'Maria José de Oliveira Gonçalves', date: '2026-11-25', number: '6', title: 'CULTIVANDO O INTERESSE DAS PESSOAS' },
];
await mkdir(new URL('../output/pdf/', import.meta.url), { recursive: true });
await writeFile(new URL('../output/pdf/s89-exemplo.pdf', import.meta.url), await createStudentSlipsPdf(template, cards));
console.log('Preview generated: output/pdf/s89-exemplo.pdf');
