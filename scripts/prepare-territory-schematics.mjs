import env from '@next/env';
import pg from 'pg';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtemp,writeFile,readFile,unlink,rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
env.loadEnvConfig(process.cwd());
const temporary=await mkdtemp(path.join(tmpdir(),'territory-schematics-'));
const pool=new pg.Pool({connectionString:process.env.POSTGRES_URL_NON_POOLING||process.env.POSTGRES_URL});
try {
  const maps=(await pool.query(`SELECT chave,territorio_id,md5(conteudo) AS hash,
    esquema_hash=md5(conteudo) AND esquema_conteudo IS NOT NULL AS ready FROM campo_mapas ORDER BY chave`)).rows;
  for(const map of maps) {
    if(!map.ready) {
      const current=(await pool.query('SELECT conteudo FROM campo_mapas WHERE chave=$1',[map.chave])).rows[0];
      if(!current||createHash('md5').update(current.conteudo).digest('hex')!==map.hash)throw new Error('O PDF mudou durante a preparação. Execute novamente.');
      const pdf=path.join(temporary,'source.pdf'),png=path.join(temporary,'render.png');
      await writeFile(pdf,current.conteudo);
      const rendered=spawnSync(process.env.PYTHON||'python',['scripts/render-territory-schematic.py',pdf,png],{encoding:'utf8',timeout:30000,windowsHide:true});
      if(rendered.status!==0)throw new Error(`Falha em ${map.chave}. Verifique Python e PyMuPDF. ${rendered.stderr?.slice(-300)||''}`);
      const [width,height]=rendered.stdout.trim().split(/\s+/).map(Number);
      if(!width||!height)throw new Error('Dimensões inválidas.');
      const result=await pool.query(`UPDATE campo_mapas SET esquema_conteudo=$2,
        esquema_pontos=CASE WHEN esquema_hash=$3 THEN esquema_pontos ELSE NULL END,
        esquema_hash=$3,esquema_largura=$4,esquema_altura=$5
        WHERE chave=$1 AND md5(conteudo)=$3 RETURNING chave`,[map.chave,await readFile(png),map.hash,width,height]);
      if(!result.rows.length)throw new Error('O PDF mudou. Execute novamente.');
      await unlink(pdf);await unlink(png);
    }
    if(map.territorio_id)await pool.query('UPDATE campo_territorios SET mapa_share_token=COALESCE(mapa_share_token,$2) WHERE id=$1',[map.territorio_id,randomBytes(32).toString('base64url')]);
    console.log(`Disponível no banco: ${map.chave}`);
  }
  console.log('Imagens armazenadas no PostgreSQL; nenhum PNG foi criado no código.');
} finally {
  await unlink(path.join(temporary,'source.pdf')).catch(()=>{});await unlink(path.join(temporary,'render.png')).catch(()=>{});await rmdir(temporary).catch(()=>{});await pool.end();
}
