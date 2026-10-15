import { authorizeRequest } from '@/app/lib/request-authorization';
import { fieldDate } from '@/app/lib/field-service';
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function GET(request) {
  const denied = await authorizeRequest(request, 'GET');
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  let start, end;
  try {
    start = fieldDate(params.get('start'));
    end = fieldDate(params.get('end'));
    if (start > end) throw new Error('A data final deve ser igual ou posterior à inicial.');
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  try {
    const result = await pool.query(`SELECT s.id, s.data::text AS data, s.horario,
      s.dirigente_publicador_id, s.local_id, s.grupos,
      COALESCE(NULLIF(TRIM(p.nome_chamado), ''), p.nome_completo, 'A definir') AS dirigente,
      COALESCE(l.nome, 'A definir') AS local,
      COALESCE((SELECT string_agg(t.numero::text, ', ' ORDER BY t.numero)
        FROM campo_territorios t WHERE t.id = ANY(s.territorios)), '—') AS territorios_numeros,
      (SELECT COALESCE(json_agg(json_build_object('id', g.id, 'nome', g.nome_grupo) ORDER BY g.nome_grupo), '[]'::json)
        FROM grupos g WHERE g.id = ANY(s.grupos)) AS grupos_detalhes,
      COALESCE((SELECT string_agg(g.nome_grupo, ', ' ORDER BY g.nome_grupo)
        FROM grupos g WHERE g.id = ANY(s.grupos)), 'Todos') AS grupos_nomes
      FROM campo_saidas s
      LEFT JOIN publicadores p ON p.id = s.dirigente_publicador_id
      LEFT JOIN campo_locais l ON l.id = s.local_id
      WHERE s.data BETWEEN $1::date AND $2::date
      ORDER BY s.data, s.horario, s.id`, [start, end]);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Erro ao consultar designações de campo:', error);
    return NextResponse.json({ message: 'Não foi possível carregar as designações do serviço de campo.' }, { status: 500 });
  }
}
