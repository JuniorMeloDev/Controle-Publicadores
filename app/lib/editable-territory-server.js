import { fieldId } from './field-service.js';
import { validateEditableLayout } from './editable-territory.js';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export async function readEditableTerritory(client,id) {
  const territory=(await client.query(`SELECT t.id,t.numero,t.descricao,t.referencias,t.limites,t.mapa_grupo_id,t.mapa_layout,t.mapa_layout_revisao,t.mapa_prototipo,
    g.nome_grupo AS grupo_nome,g.cor_mapa AS grupo_cor FROM campo_territorios t LEFT JOIN grupos g ON g.id=t.mapa_grupo_id WHERE t.id=$1`,[id])).rows[0];
  if(!territory)throw fail('Território não encontrado.',404);
  if(!territory.mapa_prototipo)throw fail('O editor está liberado somente para o território do teste.',409);
  const groups=(await client.query('SELECT id,nome_grupo AS nome,cor_mapa,cor_mapa_revisao,COALESCE(ativo,TRUE) AS ativo FROM grupos ORDER BY nome_grupo')).rows;
  return {territory,groups};
}
export async function saveEditableTerritory(client,body) {
  let id,groupId,number,layout;
  try {id=fieldId(body.territorio);groupId=fieldId(body.grupo_id,true);number=fieldId(body.numero);layout=validateEditableLayout(body.layout);}catch(e){throw fail(e.message);}
  if(!Number.isInteger(body.revisao)||body.revisao<0)throw fail('Revisão inválida.');
  if(groupId&&(!/^#[0-9a-fA-F]{6}$/.test(body.cor)||!Number.isInteger(body.grupo_revisao)))throw fail('Cor ou revisão do grupo inválida.');
  await client.query('SELECT pg_advisory_xact_lock(73428191)');
  const current=(await client.query('SELECT id,mapa_prototipo,mapa_layout_revisao,mapa_grupo_id FROM campo_territorios WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!current)throw fail('Território não encontrado.',404);
  if(!current.mapa_prototipo)throw fail('O editor está liberado somente para o território do teste.',409);
  if(current.mapa_layout_revisao!==body.revisao)throw fail('O desenho foi alterado por outra pessoa. Recarregue antes de editar.',409);
  if(groupId) {
    const group=(await client.query('SELECT id,ativo,cor_mapa,cor_mapa_revisao FROM grupos WHERE id=$1 FOR UPDATE',[groupId])).rows[0];
    if(!group||(group.ativo===false&&current.mapa_grupo_id!==groupId))throw fail('Grupo indisponível.');
    if(group.cor_mapa!==body.cor) {
      if(group.cor_mapa_revisao!==body.grupo_revisao)throw fail('A cor do grupo foi alterada. Recarregue o desenho.',409);
      await client.query('UPDATE grupos SET cor_mapa=$2,cor_mapa_revisao=cor_mapa_revisao+1 WHERE id=$1',[groupId,body.cor]);
    }
  }
  await client.query(`UPDATE campo_territorios SET numero=$2,mapa_grupo_id=$3,mapa_layout=$4::jsonb,
    mapa_layout_revisao=mapa_layout_revisao+1 WHERE id=$1`,[id,number,groupId,JSON.stringify(layout)]);
  return {id,revisao:body.revisao+1};
}
