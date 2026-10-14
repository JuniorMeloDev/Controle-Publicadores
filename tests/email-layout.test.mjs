import assert from 'node:assert/strict';
import test from 'node:test';
import { load } from 'cheerio';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const layout = await loadModule('../../app/lib/email-layout.js');
const meeting = await loadModule('../../app/lib/meeting-email-template.js');
const { buildPasswordResetEmail } = await loadModule('../../app/lib/password-reset-email.js');
const { reminderMessage } = await loadModule('../../app/lib/alerts.js');
const schedule = { treasures: [{ title: 'Uma lição para a semana (10 min)' }], ministry: [{ title: 'Iniciar conversa (3 min)' }], living: [{ title: 'Estudo bíblico de congregação (30 min)' }] };

test('password and reminder templates share the header, inline logo and footer', () => {
  const messages = [buildPasswordResetEmail({ name: 'Pessoa de teste', link: 'https://example.test/redefinir-senha?token=fixture' }),
    reminderMessage({ name: 'Pessoa de teste', date: '2030-01-09', assignments: [{ categoria: 'Vida e Ministério', nome_parte: 'Leitura da Bíblia' }] })];
  for (const message of messages) {
    const $ = load(message.html);
    assert.equal($('img[src="cid:congregacao-logo"]').length, 1);
    assert.equal($('body').text().split('Mensagem automática do Controle de Publicadores.').length, 2);
    assert.match(message.html, /background-color:#302043/);
    assert.match(message.text, /PRAIA DOS CORAIS/);
  }
  assert.match(messages[0].html, /Não solicitou esta alteração/);
  assert.match(messages[1].html, /Leitura da Bíblia/);
});

test('dynamic template titles and programme names cannot introduce active HTML', () => {
  const html = layout.buildEmailHtml({ subject: '<script>Title</script>', preheader: '<img>', label: 'Label', title: '<b>Title</b>', content: '<p>Safe content</p>' });
  assert.ok(!html.includes('<script>')); assert.match(html, /&lt;script&gt;/);
  const programme = meeting.generateMeetingHtml('<img src=x>', { ...schedule, treasures: [{ title: '<script>fake</script> (10 min)' }] },
    { presidente: 'Full name', tesouro_0: 'Full name' }, new Map([['Full name', '<img src=x onerror=alert(1)>']]));
  assert.ok(!programme.includes('<script>')); assert.ok(!programme.includes('<img src=x'));
  assert.match(programme, /&lt;img/);
});

test('bulk assignment mail preserves the personal summary and programme under the shared brand', async () => {
  const outgoing = [];
  const route = loadRoute('../../app/api/admin/enviar-emails-lote/route.js', {
    Pool: class { connect() { return { query: async () => ({ rows: [{ nome_completo: 'Pessoa de teste', nome_chamado: 'Pessoa', email: 'recipient@example.test' }] }), release() {} }; } },
    process: { env: { EMAIL_USER: 'sender@example.test' } },
    nodemailer: { createTransport: () => ({ sendMail: async mail => { outgoing.push(mail); return { accepted: [mail.to] }; } }) },
    getUserIdFromRequest: () => 10, getUserPermissions: async () => ({}), isAllowed: () => true, registerAuditLog: async () => {},
    ...layout, generateMeetingHtml: meeting.generateMeetingHtml, getFriendlyTitleWithSection: meeting.getFriendlyTitleWithSection,
    getEmailLogoAttachment: async () => ({ filename: 'logo.png', cid: 'congregacao-logo', content: Buffer.from('fixture') }), load,
  });
  const response = await route.POST({ json: async () => ({ recipientsList: ['recipient@example.test'], weekText: '7 a 13 de janeiro de 2030', schedule,
    assignments: { presidente: 'Pessoa de teste', comentarios_iniciais: 'Pessoa de teste', tesouro_0: 'Pessoa de teste' } }) });
  assert.equal(response.status, 200); assert.equal(outgoing.length, 1);
  const mail = outgoing[0];
  assert.equal(mail.from.name, layout.EMAIL_SENDER_NAME); assert.equal(mail.from.address, 'sender@example.test');
  assert.equal(mail.attachments[0].cid, 'congregacao-logo');
  assert.match(mail.html, /Olá, Pessoa!/); assert.match(mail.html, /Programação completa/);
  assert.match(mail.html, /cid:congregacao-logo/); assert.match(mail.html, /Uma lição para a semana/);
  assert.match(mail.text, /Pessoa/); assert.match(mail.text, /Uma lição para a semana/);
  assert.ok(!mail.text.includes('<table')); assert.equal(load(mail.html)('img[src="cid:congregacao-logo"]').length, 1);
});
