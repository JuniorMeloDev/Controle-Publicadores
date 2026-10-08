import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers/load-source.mjs';

const { buildLifeMinistryWhatsAppMessage, lifeMinistryWhatsAppUrl } = await loadModule('../../app/lib/life-ministry-whatsapp.js');
const schedule = {
    initialSong: 'Cântico 1', middleSong: 'Cântico 2', finalSong: 'Cântico 3',
    openingComments: 'Comentários iniciais (1 min)', finalComments: 'Comentários finais (3 min)',
    treasures: [{ title: 'Parte fictícia (10 min)' }],
    ministry: [{ title: 'Conversa fictícia: (3 min)' }, { title: 'Discurso fictício (5 min)' }],
    living: [{ title: 'Estudo bíblico de congregação (30 min)' }, { title: 'Vida cristã fictícia (15 min)' }]
};
const assignments = { presidente: 'Presidente fictício', ministerio_0_1: 'Estudante fictício', ministerio_0_2: 'Ajudante fictício',
    ministerio_1: 'Orador fictício', vida_0_1: 'Dirigente fictício', vida_0_2: 'Leitor fictício' };

test('WhatsApp message preserves section emoji and accents through URL encoding', () => {
    const text = buildLifeMinistryWhatsAppMessage('Semana fictícia', schedule, assignments);
    assert.equal(decodeURIComponent(encodeURIComponent(text)), text);
    const url = new URL(lifeMinistryWhatsAppUrl(text));
    assert.equal(url.hostname, 'api.whatsapp.com');
    assert.equal(url.searchParams.get('text'), text);
    assert.ok(!text.includes('\uFFFD'));
    for (const icon of ['\u{1F48E}', '\u{1F33E}', '\u{1F411}', '\u{1F3B5}', '\u{1F64F}', '\u{1F3A4}']) assert.ok(text.includes(icon));
    assert.ok(!text.includes('\u271D'));
    assert.match(text, /FAÇA SEU MELHOR NO MINISTÉRIO/);
});

test('WhatsApp distinguishes participants and removes duplicated colons', () => {
    const text = buildLifeMinistryWhatsAppMessage('Semana fictícia', schedule, assignments);
    assert.match(text, /👤 \*Estudante fictício\* \/ 🤝 Ajudante fictício/u);
    assert.match(text, /👤 \*Dirigente fictício\* \/ 📖 Leitor fictício/u);
    assert.match(text, /Discurso fictício: \*Orador fictício\*/);
    assert.ok(!text.includes('::'));
    assert.ok(!text.includes('undefined'));
    assert.match(buildLifeMinistryWhatsAppMessage('Semana fictícia', {}, {}), /Cântico inicial: \*---\*/);
});

test('WhatsApp uses preferred names in every assignment without changing saved names', () => {
    const fullName = 'Publicador Nome Completo Fictício';
    const parts = ['presidente', 'ajudante', 'oracao_inicial', 'comentarios_iniciais', 'tesouro_0',
        'ministerio_0_1', 'ministerio_0_2', 'ministerio_1', 'cantico_meio', 'vida_0_1', 'vida_0_2', 'vida_1', 'comentarios_finais', 'oracao_final'];
    const saved = Object.freeze(Object.fromEntries(parts.map(part => [part, fullName])));
    const text = buildLifeMinistryWhatsAppMessage('Semana fictícia', schedule, saved,
        [{ nome_completo: fullName, nome_chamado: '  Nome Chamado  ', apelido: 'Outro apelido' }]);
    assert.ok(!text.includes(fullName));
    assert.equal(text.match(/Nome Chamado/g).length, parts.length);
    assert.equal(saved.presidente, fullName);
    assert.equal(new URL(lifeMinistryWhatsAppUrl(text)).searchParams.get('text'), text);
});

test('WhatsApp falls back to nickname or a short name, including external participants', () => {
    const text = buildLifeMinistryWhatsAppMessage('Semana fictícia', {}, {
        presidente: 'Publicador Completo Fictício', ajudante: 'Pessoa Sem Apelido Fictícia',
        oracao_inicial: 'Visitante Nome Completo Fictício', oracao_final: 'Nome Único'
    }, [{ nome_completo: 'Publicador Completo Fictício', nome_chamado: ' ', apelido: 'Apelido' },
        { nome_completo: 'Pessoa Sem Apelido Fictícia', nome_chamado: null }]);
    assert.match(text, /Presidente: \*Apelido\*/);
    assert.match(text, /Ajudante: Pessoa Fictícia/);
    assert.match(text, /Oração: \*Visitante Fictício\*/);
    assert.match(text, /Oração final: \*Nome Único\*/);
    assert.ok(!text.includes('Nome Completo'));
});
