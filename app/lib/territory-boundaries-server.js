import { randomBytes } from 'node:crypto';
import { fieldId } from './field-service.js';
import { validateBoundary, checkBoundaryPlacement } from './territory-boundaries.js';
import { territoryBoundaryProposal } from './territory-boundary-proposals.js';
import { withTerritoryDrawing } from './territory-map-display.js';
import { territoryReferenceOptions, applyTerritoryReferenceSelection } from './territory-reference-selection.js';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export async function readTerritoryBoundaries(client) {
  const geral = (await client.query('SELECT limites, revisao FROM campo_mapa_geral WHERE id = 1')).rows[0];
  const territorios = (await client.query(`SELECT t.id, t.numero, t.descricao, t.limites, t.mapa_revisao, t.mapa_share_token, t.ativo, t.mapa_layout, t.mapa_layout_revisao,
    md5(m.conteudo) AS pdf_hash
    FROM campo_territorios t LEFT JOIN campo_mapas m ON m.territorio_id = t.id ORDER BY t.numero`)).rows;
  return { geral, territorios: territorios.map(territory => {
    const sugestao = territoryBoundaryProposal(territory, territorios);
    const { pdf_hash, ...details } = territory;
    return { ...details, sugestao };
  }) };
}

export async function saveTerritoryBoundary(client, body) {
  let id;
  try { id = body.territorio === null ? null : fieldId(body.territorio); } catch { throw fail('Território inválido.'); }
  if (!Number.isInteger(body.revisao) || body.revisao < 0) throw fail('Revisão inválida. Atualize o mapa.');
  let boundary;
  try { boundary = validateBoundary(body.limites); } catch (e) { throw fail(e.message); }
  await client.query('SELECT pg_advisory_xact_lock(73428191)');
  const { geral, territorios } = await readTerritoryBoundaries(client);
  const selected = id === null ? geral : territorios.find(t => t.id === id);
  if (!selected) throw fail('Mapa não encontrado.', 404);
  const revision = id === null ? selected.revisao : selected.mapa_revisao;
  if (revision !== body.revisao) throw fail('Outra pessoa alterou este mapa. Atualize a página antes de editar novamente.', 409);
  let drawing;
  if(id!==null&&body.referencia_ids!==undefined){
    if(body.desenho_revisao!==selected.mapa_layout_revisao)throw fail('O cartão foi alterado. Atualize a página antes de escolher as referências.',409);
    try{
      const current=withTerritoryDrawing({...selected,limites:boundary}).mapa_layout;
      drawing=applyTerritoryReferenceSelection(current,territoryReferenceOptions(boundary,selected.mapa_layout),body.referencia_ids);
    }catch(error){throw fail(error.message);}
  }
  try {
    if (id === null) {
      for (const territory of territorios.filter(t => t.limites)) checkBoundaryPlacement(territory.limites, boundary);
    } else {
      checkBoundaryPlacement(boundary, geral?.limites, territorios.filter(t => t.id !== id && t.limites));
      const peer = territorios.find(t => t.numero === selected.sugestao?.conflito_com);
      if (peer?.sugestao) {
        try { checkBoundaryPlacement(boundary, geral?.limites, [{ numero: peer.numero, limites: peer.sugestao.limites }]); }
        catch { throw new Error(`Confira e ajuste a faixa comum dos cartões 19 e 20 antes de validar. O contorno ainda sobrepõe a sugestão do território ${peer.numero}.`); }
      }
    }
  } catch (e) { throw fail(e.message); }
  if (id === null) await client.query('UPDATE campo_mapa_geral SET limites = $1::jsonb, revisao = revisao + 1 WHERE id = 1', [JSON.stringify(boundary)]);
  else if(drawing)await client.query(`UPDATE campo_territorios SET limites=$2::jsonb,mapa_revisao=mapa_revisao+1,
    mapa_share_token=COALESCE(mapa_share_token,$3),mapa_layout=$4::jsonb,mapa_layout_revisao=mapa_layout_revisao+1,mapa_prototipo=TRUE WHERE id=$1`,
    [id,JSON.stringify(boundary),randomBytes(32).toString('base64url'),JSON.stringify(drawing)]);
  else await client.query(`UPDATE campo_territorios SET limites = $2::jsonb, mapa_revisao = mapa_revisao + 1,
    mapa_share_token = COALESCE(mapa_share_token, $3) WHERE id = $1`, [id, JSON.stringify(boundary), randomBytes(32).toString('base64url')]);
  return { id, revisao: revision + 1, ...(drawing?{mapa_layout:drawing,desenho_revisao:selected.mapa_layout_revisao+1}:{}) };
}

export async function findPublicTerritory(client, token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return (await client.query(`SELECT numero, descricao, referencias, limites FROM campo_territorios
    WHERE mapa_share_token = $1 AND ativo = TRUE AND limites IS NOT NULL`, [token])).rows[0] || null;
}
