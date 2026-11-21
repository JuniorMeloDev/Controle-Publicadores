import { boardAudienceSql, boardTodaySql } from './congregation-board-server.js';
import { deliverPushRows, fieldPushVapid } from './field-push.js';

export async function deliverBoardPushes(db, { postId = null, vapid = fieldPushVapid(), send } = {}) {
  if (!vapid) return null;
  // The immediate delivery and the scheduler may overlap. Only one can take a pending post.
  const { rows } = await db.query(`WITH publicacoes AS (
    DELETE FROM mural_push_pendentes fila USING mural_congregacao post
    WHERE fila.publicacao_id = post.id AND ($1::int IS NULL OR post.id = $1)
      AND post.inicio <= ${boardTodaySql}
    RETURNING post.id, post.tipo, post.grupo_id, post.fim, post.publico
  )
  SELECT m.id::text AS aviso_id, s.aparelho_id, s.endpoint, s.chaves
  FROM publicacoes m CROSS JOIN web_push_inscricoes s
  JOIN publicadores p ON p.id = s.publicador_id
  WHERE m.tipo = 'anuncio' AND ${boardAudienceSql}
    AND (m.fim IS NULL OR m.fim >= ${boardTodaySql})
    AND s.chave_vapid = $2 AND (s.expira_em IS NULL OR s.expira_em > NOW())`, [postId, vapid.publicKey]);
  return deliverPushRows(db, rows, row => ({
    payload: { boardId: row.aviso_id },
    topic: `mural-${row.aviso_id}`,
  }), vapid, send);
}
