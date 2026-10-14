export const MAX_FIELD_MAP_BYTES = 10 * 1024 * 1024;

export async function prepareFieldMap(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size || file.size > MAX_FIELD_MAP_BYTES) throw Object.assign(new Error('Envie um PDF de até 10 MB.'), { status: 400 });
  const name = String(file.name || '').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180);
  if (!/\.pdf$/i.test(name)) throw Object.assign(new Error('O mapa deve estar em PDF.'), { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_FIELD_MAP_BYTES || buffer.subarray(0, 5).toString() !== '%PDF-' || !buffer.subarray(-2048).includes(Buffer.from('%%EOF'))) throw Object.assign(new Error('Arquivo PDF inválido ou maior que 10 MB.'), { status: 400 });
  return { name, buffer };
}

export async function saveFieldMap(client, territoryId, file) {
  const key = territoryId ? `territorio-${territoryId}` : 'geral';
  await client.query(`INSERT INTO campo_mapas (chave, territorio_id, nome, conteudo, tamanho) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (chave) DO UPDATE SET nome = EXCLUDED.nome, conteudo = EXCLUDED.conteudo, tamanho = EXCLUDED.tamanho, atualizado_em = NOW()`, [key, territoryId || null, file.name, file.buffer, file.buffer.length]);
  return key;
}

