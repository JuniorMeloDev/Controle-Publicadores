import { mkdir, writeFile } from 'node:fs/promises';
import { buildEmailHtml } from '../app/lib/email-layout.js';
import { buildPasswordResetEmail } from '../app/lib/password-reset-email.js';
import { generateMeetingHtml } from '../app/lib/meeting-email-template.js';
import { reminderMessage } from '../app/lib/alerts.js';

// Local previews only: no SMTP, tokens, publisher records or production recipients.
const name = 'Publicador de teste';
const week = '7 a 13 de janeiro de 2030';
const schedule = { initialSong: 'Cântico 1', openingComments: 'Comentários iniciais (1 min)',
  treasures: [{ title: 'Uma lição para a semana (10 min)' }, { title: 'Joias espirituais (10 min)' }],
  ministry: [{ title: 'Iniciar conversa (3 min)' }], middleSong: 'Cântico 2',
  living: [{ title: 'Estudo bíblico de congregação (30 min)' }], finalSong: 'Cântico 3' };
const assignments = { presidente: name, tesouro_0: name, ministerio_0_1: name };
const messages = {
  senha: buildPasswordResetEmail({ name, link: 'https://example.test/redefinir-senha?token=fixture' }).html,
  designacoes: buildEmailHtml({ subject: `Designações: ${week}`, preheader: 'Confira suas designações da semana.', label: 'PROGRAMAÇÃO DA REUNIÃO',
    title: 'Suas designações da semana', width: 800, content: `<p>Olá, <strong>${name}</strong>!</p><div style="padding:16px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px"><p>Suas designações: Presidente e Uma lição para a semana.</p></div><h2 style="font-size:16px">Programação completa</h2>${generateMeetingHtml(week, schedule, assignments, new Map([[name, 'Publicador']]))}` }),
  lembrete: reminderMessage({ name, date: '2030-01-09', assignments: [{ categoria: 'Vida e Ministério', nome_parte: 'Leitura da Bíblia' }, { categoria: 'Limpeza Semanal', origem: 'limpeza_semanal', nome_parte: 'Limpeza', descricao_semana: 'Grupo de teste' }] }).html,
};
await mkdir('.next/email-previews', { recursive: true });
for (const [key, html] of Object.entries(messages)) await writeFile(`.next/email-previews/${key}.html`, html.replace('cid:congregacao-logo', 'http://localhost:3002/logo.png'));
console.log('Prévias locais geradas em .next/email-previews. Nenhum e-mail enviado.');
