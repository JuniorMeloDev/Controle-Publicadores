import { authorizeRequest } from '@/app/lib/request-authorization';
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { ensureGroupLeadership } from '@/app/lib/field-group-server';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function GET(request) {
  const denied = await authorizeRequest(request, 'GET');
  if (denied) return denied;
  const client = await pool.connect();
  try {
    await ensureGroupLeadership(client);
    const result = await client.query(`SELECT g.nome_grupo,
      COALESCE(NULLIF(TRIM(s.nome_chamado), ''), s.nome_completo) AS superintendente_nome,
      COALESCE(NULLIF(TRIM(a.nome_chamado), ''), a.nome_completo) AS ajudante_nome
      FROM grupos g
      LEFT JOIN publicadores s ON s.id = g.superintendente_id AND s.grupo_id = g.id
        AND 'anciao' = ANY(s.privilegios)
      LEFT JOIN publicadores a ON a.id = g.ajudante_id AND a.grupo_id = g.id
        AND a.privilegios && ARRAY['anciao', 'servo_ministerial']::varchar[]
      ORDER BY g.nome_grupo`);
    return NextResponse.json(result.rows, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Não foi possível carregar os responsáveis dos grupos.' }, { status: 500 });
  } finally {
    client.release();
  }
}
