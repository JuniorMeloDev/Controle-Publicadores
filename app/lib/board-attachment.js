import mammoth from 'mammoth';
import { load } from 'cheerio';
import { MAX_ATTACHMENT_BYTES } from './attachment-info';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const types = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain; charset=utf-8', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

// Bound DOCX expansion before parsing its ZIP contents. ZIP64 is deliberately unsupported.
function checkArchive(buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('Arquivo Word inválido.');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16), total = 0, document = false;
  if (count > 2000 || count === 0 || buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0) throw new Error('Arquivo Word inválido ou muito complexo.');
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Arquivo Word inválido.');
    const size = buffer.readUInt32LE(offset + 24), nameLength = buffer.readUInt16LE(offset + 28);
    total += size;
    if (total > 20 * 1024 * 1024 || (buffer.readUInt16LE(offset + 8) & 1)) throw new Error('Arquivo Word muito complexo ou protegido por senha.');
    const next = offset + 46 + nameLength + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
    if (next > end) throw new Error('Arquivo Word inválido.');
    if (buffer.subarray(offset + 46, offset + 46 + nameLength).toString() === 'word/document.xml') document = true;
    offset = next;
  }
  if (!document) throw new Error('Envie um documento Word no formato .docx.');
}

export function sanitizeDocumentHtml(html) {
  const $ = load(html, {}, false);
  $('script,style,iframe,object,embed,svg,math').remove();
  $('img').each((_, element) => {
    if (!/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test($(element).attr('src') || '')) $(element).remove();
  });
  const allowed = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'strong', 'em', 'b', 'i', 'u', 's', 'sup', 'sub', 'br', 'blockquote', 'img']);
  $('*').each((_, element) => {
    if (!allowed.has(element.tagName)) $(element).replaceWith($(element).contents());
    else for (const key of Object.keys(element.attribs || {})) {
      if (element.tagName !== 'img' || !['src', 'alt'].includes(key)) $(element).removeAttr(key);
    }
  });
  return $.html();
}

export async function prepareAttachment(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size || file.size > MAX_ATTACHMENT_BYTES) throw new Error('Envie um arquivo de até 4 MB.');
  const name = String(file.name || '').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180);
  const ext = name.split('.').pop().toLowerCase();
  if (!types[ext]) throw new Error('Formato não suportado. Use PDF, Word (.docx), TXT, PNG, JPG ou WebP.');
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_ATTACHMENT_BYTES) throw new Error('Envie um arquivo de até 4 MB.');
  let preview = null;
  const starts = bytes => buffer.subarray(0, bytes.length).equals(Buffer.from(bytes));
  if ((ext === 'pdf' && !starts([37, 80, 68, 70, 45])) ||
    (ext === 'png' && !starts([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (['jpg', 'jpeg'].includes(ext) && !starts([255, 216, 255])) ||
    (ext === 'webp' && !(buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'))) throw new Error('O conteúdo do arquivo não corresponde ao formato informado.');
  if (ext === 'docx') {
    checkArchive(buffer);
    try {
      const result = await mammoth.convertToHtml({ buffer }, { externalFileAccess: false, convertImage: mammoth.images.imgElement(async image => {
        if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(image.contentType)) return { src: '' };
        return { src: `data:${image.contentType};base64,${await image.read('base64')}` };
      }) });
      preview = sanitizeDocumentHtml(result.value);
      if (!preview.trim()) throw new Error('empty');
      if (Buffer.byteLength(preview, 'utf8') > MAX_ATTACHMENT_BYTES - 16384) throw new Error('preview too large');
    } catch { throw new Error('Não foi possível gerar a prévia deste Word. Envie uma versão em PDF.'); }
  }
  if (ext === 'txt') {
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { throw new Error('Envie um arquivo de texto em UTF-8.'); }
    if (text.includes('\0')) throw new Error('Arquivo de texto inválido.');
    preview = `<pre>${escape(text)}</pre>`;
  }
  return { name, mime: types[ext], buffer, preview };
}

export function attachmentPreview(name, content) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(name)}</title><style>body{margin:0;background:#f3f4f6;color:#111827;font:16px/1.6 system-ui}header,main{max-width:900px;margin:0 auto;padding:24px;overflow-wrap:anywhere}main{background:white}h1{font-size:1.6rem}header h1{font-size:1.2rem;margin:0}header p{font-size:.85rem;color:#4b5563}table{border-collapse:collapse;display:block;overflow:auto}td,th{border:1px solid #d1d5db;padding:8px}pre{white-space:pre-wrap;font:inherit}img{max-width:100%;height:auto}@media(prefers-color-scheme:dark){body{background:#111;color:#eee}main{background:#18181b}header p{color:#aaa}}</style></head><body><header><h1>${escape(name)}</h1><p>Prévia do conteúdo. A formatação pode variar em relação ao arquivo original.</p></header><main>${content}</main></body></html>`;
}
