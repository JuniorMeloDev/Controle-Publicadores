import env from '@next/env';import pg from 'pg';import {randomBytes} from 'node:crypto';
import {fieldId} from '../app/lib/field-service.js';import {layoutFromBoundary} from '../app/lib/editable-territory.js';
env.loadEnvConfig(process.cwd());
const options=Object.fromEntries(process.argv.slice(2).map(p=>p.replace(/^--/,'').split('=')));
const number=fieldId(options.numero),groupId=fieldId(options.grupo,true);
const pool=new pg.Pool({connectionString:process.env.POSTGRES_URL});const client=await pool.connect();
try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(73428191)');
  const t=(await client.query('SELECT id,limites,referencias,mapa_layout FROM campo_territorios WHERE numero=$1 FOR UPDATE',[number])).rows[0];
  if(!t)throw new Error('Território não encontrado.');if(t.mapa_layout)throw new Error('O desenho existente foi preservado. Edite pelo aplicativo.');
  if(groupId&&!(await client.query('SELECT id FROM grupos WHERE id=$1 AND COALESCE(ativo,TRUE)=TRUE',[groupId])).rows.length)throw new Error('Grupo indisponível.');
  const layout=layoutFromBoundary(t.limites,t.referencias);
  await client.query(`UPDATE campo_territorios SET mapa_prototipo=TRUE,mapa_grupo_id=$2,mapa_layout=$3::jsonb,
    mapa_share_token=COALESCE(mapa_share_token,$4) WHERE id=$1`,[t.id,groupId,JSON.stringify(layout),randomBytes(32).toString('base64url')]);
  await client.query('COMMIT');console.log('Protótipo ativado no cadastro selecionado. Nenhum PDF ou limite foi alterado.');
}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
