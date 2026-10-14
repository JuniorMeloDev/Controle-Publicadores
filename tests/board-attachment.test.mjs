import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import mammoth from 'mammoth';
import { load } from 'cheerio';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const require = createRequire(import.meta.url);
const JSZip = require(require.resolve('jszip', { paths: [require.resolve('mammoth')] }));
const { MAX_ATTACHMENT_BYTES } = await loadModule('../../app/lib/attachment-info.js');
const source = readFileSync(new URL('../app/lib/board-attachment.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const context = vm.createContext({ mammoth, load, MAX_ATTACHMENT_BYTES, Buffer, TextDecoder });
vm.runInContext(source + '\nglobalThis.helpers = { prepareAttachment, sanitizeDocumentHtml, attachmentPreview };', context);
const { prepareAttachment, sanitizeDocumentHtml, attachmentPreview } = context.helpers;
const file = (name, buffer) => ({ name, size: buffer.length, arrayBuffer: async () => buffer });
const pdf = Buffer.from('%PDF-1.4\nfixture');

test('attachment validation checks size and actual content rather than caller MIME', async () => {
  const prepared = await prepareAttachment(file('document.pdf', pdf));
  assert.equal(prepared.mime, 'application/pdf'); assert.equal(prepared.preview, null);
  await assert.rejects(prepareAttachment(file('document.pdf', Buffer.from('<script>'))), /conteúdo/);
  await assert.rejects(prepareAttachment(file('document.doc', pdf)), /Formato/);
  await assert.rejects(prepareAttachment({ name: 'large.pdf', size: MAX_ATTACHMENT_BYTES + 1 }), /4 MB/);
  await assert.rejects(prepareAttachment(file('empty.pdf', Buffer.alloc(0))), /4 MB/);
});
test('text and document previews escape hostile markup and remove active content', async () => {
  const prepared = await prepareAttachment(file('notice.txt', Buffer.from('<script>alert(1)</script>')));
  assert.match(prepared.preview, /&lt;script&gt;/);
  const html = sanitizeDocumentHtml('<h1 onclick="x()">Title</h1><script>alert(1)</script><p><a href="javascript:x()">Text</a><img src="https://foreign.example"></p>');
  assert.match(html, /<h1>Title<\/h1>/); assert.ok(!/script|onclick|javascript|img/.test(html));
  const embedded = sanitizeDocumentHtml('<img src="data:image/png;base64,aGVsbG8=" onerror="alert(1)" style="position:fixed">');
  assert.match(embedded, /<img src="data:image\/png;base64,aGVsbG8="/); assert.ok(!/onerror|style/.test(embedded));
  assert.ok(!attachmentPreview('<img>', '<p>Safe</p>').includes('<title><img>'));
});
test('a real DOCX produces a readable browser preview and oversized ZIP expansion is rejected', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Material de teste</w:t></w:r></w:p></w:body></w:document>');
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const prepared = await prepareAttachment(file('material.docx', buffer));
  assert.match(prepared.preview, /Material de teste/);
  const oversized = Buffer.from(buffer);
  const directory = oversized.indexOf(Buffer.from([80, 75, 1, 2]));
  oversized.writeUInt32LE(21 * 1024 * 1024, directory + 24);
  await assert.rejects(prepareAttachment(file('oversized.docx', oversized)), /complexo/);
});

test('private attachment route rejects other groups, expired publications and anonymous requests', async () => {
  let userId = 10, visible = [], elder = false, reads = 0;
  const route = loadRoute('../../app/api/mural/anexo/[id]/route.js', {
    Pool: class { connect() { return { release() {}, query: async () => { reads++; return { rows: [{ nome: 'test.pdf', mime: 'application/pdf', conteudo: pdf, previa_html: null }] }; } }; } },
    getUserIdFromRequest: () => userId, getUserAccess: async () => ({ elder }), canManageBoard: access => access.elder,
    ensureBoardTables: async () => {}, getVisiblePosts: async () => visible, attachmentPreview, Response, Uint8Array,
  });
  const req = { url: 'http://localhost/api/mural/anexo/1' }, params = { params: Promise.resolve({ id: '1' }) };
  assert.equal((await route.GET(req, params)).status, 404); assert.equal(reads, 0);
  visible = [{ id: 1 }];
  const response = await route.GET(req, params);
  assert.equal(response.status, 200); assert.match(response.headers.get('Content-Disposition'), /^inline/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  visible = []; elder = true; assert.equal((await route.GET(req, params)).status, 200);
  userId = null; assert.equal((await route.GET(req, params)).status, 401);
});

test('file and publication save together and a material may use an attachment without a public link', async () => {
  const calls = [];
  const route = loadRoute('../../app/api/mural/route.js', {
    Pool: class { connect() { return { release() {}, query: async (sql, params) => { calls.push({ sql, params }); return { rows: /RETURNING id/.test(sql) ? [{ id: 1 }] : [] }; } }; } },
    getUserIdFromRequest: () => 10, getUserAccess: async () => ({}), canManageBoard: () => true,
    ensureBoardTables: async () => {}, prepareAttachment, registerAuditLog: async () => {},
    validateBoardPost: (_body, options) => { assert.equal(options.hasAttachment, true); return { tipo: 'material' }; },
  });
  const req = { url: 'http://localhost/api/mural', headers: { get: key => key === 'content-type' ? 'multipart/form-data' : null },
    formData: async () => ({ get: key => key === 'publicacao' ? JSON.stringify({ action: 'save', tipo: 'material' }) : file('material.pdf', pdf) }) };
  assert.equal((await route.POST(req)).status, 200);
  assert.equal(calls[0].sql, 'BEGIN'); assert.equal(calls.at(-1).sql, 'COMMIT');
  const inserted = calls.find(call => call.sql.startsWith('INSERT INTO mural_anexos'));
  assert.equal(inserted.params[0], 1); assert.equal(inserted.params[1], 'material.pdf');
});
