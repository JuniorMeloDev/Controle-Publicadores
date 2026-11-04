const unavailable = () => Object.assign(new Error('O esquema precisa ser preparado novamente após atualizar o PDF.'), { status: 503 });
const validKey = key => typeof key === 'string' && /^(geral|territorio-\d+)$/.test(key);
export async function preparedSchematicInfo(client, key, hash) {
  if (!validKey(key)) throw unavailable();
  const row = (await client.query(`SELECT esquema_largura AS width, esquema_altura AS height,
    esquema_pontos AS points FROM campo_mapas
    WHERE chave=$1 AND esquema_hash=$2 AND md5(conteudo)=$2 AND esquema_conteudo IS NOT NULL`, [key,hash])).rows[0];
  if (!row) throw unavailable();
  return row;
}
export async function readPreparedSchematic(client, key, hash) {
  if (!validKey(key)) throw unavailable();
  const row = (await client.query(`SELECT esquema_conteudo FROM campo_mapas
    WHERE chave=$1 AND esquema_hash=$2 AND md5(conteudo)=$2`,[key,hash])).rows[0];
  if (!row?.esquema_conteudo) throw unavailable();
  return row.esquema_conteudo;
}
export async function findSharedSchematic(client, token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return (await client.query(`SELECT t.numero,t.descricao,t.referencias,t.mapa_url,t.limites,
    t.mapa_layout,t.mapa_prototipo,g.nome_grupo AS grupo_nome,g.cor_mapa AS grupo_cor,
    m.chave AS imagem_chave,md5(m.conteudo) AS imagem_hash
    FROM campo_territorios t LEFT JOIN grupos g ON g.id=t.mapa_grupo_id
    LEFT JOIN campo_mapas m ON m.territorio_id=t.id
    WHERE t.mapa_share_token=$1 AND t.ativo=TRUE
      AND (t.mapa_layout IS NOT NULL OR m.chave IS NOT NULL)`,[token])).rows[0] || null;
}
