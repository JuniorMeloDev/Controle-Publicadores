import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-source.mjs';
const { whatsAppShareUrl, copyWhatsAppMessage } = await loadModule('../../app/lib/whatsapp-share.js');

test('desktop sharing avoids external protocol handlers and preserves emoji, accents and literal percent signs', () => {
  const message = '\u{1F3E0} *PRIVILÉGIOS MECÂNICOS*\n\u{1F3A4} Volante: *José*\n100% confirmado';
  for (const agent of ['Windows NT', 'Macintosh', 'Android', 'iPhone']) {
    const url = new URL(whatsAppShareUrl(message, agent));
    assert.equal(url.searchParams.get('text'), message);
    assert.equal(url.hostname, /Android|iPhone/.test(agent) ? 'api.whatsapp.com' : 'web.whatsapp.com');
  }
});

test('clipboard fallback copies the original Unicode text and handles unavailable or denied clipboard', async () => {
  const message = '\u{1F4D6} Leitor: João'; let copied;
  assert.equal(await copyWhatsAppMessage(message, { writeText: async text => { copied = text; } }), true);
  assert.equal(copied, message);
  assert.equal(await copyWhatsAppMessage(message, undefined), false);
  assert.equal(await copyWhatsAppMessage(message, { writeText: async () => { throw new Error('Denied'); } }), false);
});
