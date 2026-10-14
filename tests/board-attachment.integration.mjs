import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import { createRequire } from 'node:module';
import { jsPDF } from 'jspdf';

nextEnv.loadEnvConfig(process.cwd());
const base = process.argv[2] || 'http://localhost:3002';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use a local application server.');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
const require = createRequire(import.meta.url);
const JSZip = require(require.resolve('jszip', { paths: [require.resolve('mammoth')] }));
const ids = [];
try {
  const publisher = await pool.query(`SELECT p.id FROM publicadores p LEFT JOIN acessos_app a ON a.publicador_id = p.id
    WHERE COALESCE(a.super_admin, FALSE) = FALSE AND NOT (COALESCE(p.privilegios::text[], ARRAY[]::text[]) @> ARRAY['anciao']::text[]) ORDER BY p.id LIMIT 1`);
  const elder = await pool.query(`SELECT p.id FROM publicadores p LEFT JOIN acessos_app a ON a.publicador_id = p.id
    WHERE a.super_admin = TRUE OR p.privilegios::text[] @> ARRAY['anciao']::text[] ORDER BY p.id LIMIT 1`);
  assert.ok(publisher.rows.length && elder.rows.length);
  const cookie = id => ({ Cookie: 'auth_token=' + jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: '5m' }) });
  const document = new jsPDF(); document.text('Material de teste', 20, 20);
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Material de teste</w:t></w:r></w:p></w:body></w:document>');
  for (const [name, content] of [['teste.pdf', Buffer.from(document.output('arraybuffer'))], ['teste.docx', await zip.generateAsync({ type: 'nodebuffer' })]]) {
    const form = new FormData();
    form.append('publicacao', JSON.stringify({ action: 'save', tipo: 'material', titulo: 'Teste temporário de anexo', mensagem: 'Publicação futura de teste; removida ao terminar.', inicio: '2099-01-01' }));
    form.append('anexo', new Blob([content]), name);
    assert.equal((await fetch(base + '/api/mural', { method: 'POST', headers: cookie(publisher.rows[0].id), body: form })).status, 403);
    const response = await fetch(base + '/api/mural', { method: 'POST', headers: cookie(elder.rows[0].id), body: form });
    const saved = await response.json(); assert.equal(response.status, 200, saved.message); ids.push(saved.id);
    const path = base + '/api/mural/anexo/' + saved.id;
    assert.equal((await fetch(path)).status, 401);
    assert.equal((await fetch(path, { headers: cookie(publisher.rows[0].id) })).status, 404);
    const preview = await fetch(path, { headers: cookie(elder.rows[0].id) });
    assert.equal(preview.status, 200); assert.match(preview.headers.get('Content-Disposition'), /^inline/);
    if (name.endsWith('.pdf')) assert.deepEqual(Buffer.from(await preview.arrayBuffer()), content);
    else assert.match(await preview.text(), /Material de teste/);
    const download = await fetch(path + '?download=1', { headers: cookie(elder.rows[0].id) });
    assert.match(download.headers.get('Content-Disposition'), /^attachment/);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), content);
  }
  console.log('PDF and DOCX uploads, private inline previews and optional original downloads passed. Temporary unpublished materials removed.');
} finally {
  if (ids.length) await pool.query('DELETE FROM mural_congregacao WHERE id = ANY($1::int[])', [ids]);
  await pool.end();
}
