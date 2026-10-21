import { authorizeRequest } from '@/app/lib/request-authorization';
import { ensureEmergencyContactsColumn } from '@/app/lib/emergency-contacts-server';
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function GET(request) {
  const denied = await authorizeRequest(request, 'GET');
  if (denied) return denied;

  const url = new URL(request.url);
  const grupoParam = url.searchParams.get('grupo_id');

  const client = await pool.connect();
  try {
    await ensureEmergencyContactsColumn(client);

    const gruposRes = await client.query(`
      SELECT id, nome_grupo
      FROM grupos
      WHERE ativo = TRUE OR ativo IS NULL
      ORDER BY nome_grupo ASC
    `);

    let query = `
      SELECT 
        p.id,
        p.nome_completo,
        p.nome_chamado,
        p.grupo_id,
        COALESCE(g.nome_grupo, 'Sem Grupo') AS nome_grupo,
        p.sexo,
        p.esperanca,
        p.data_nascimento,
        p.data_batismo,
        p.telefone,
        p.email,
        p.privilegios,
        p.designacoes,
        p.cep,
        p.logradouro,
        p.numero,
        p.complemento,
        p.bairro,
        p.cidade,
        p.estado,
        p.contatos_emergencia
      FROM publicadores p
      LEFT JOIN grupos g ON p.grupo_id = g.id
    `;

    const params = [];
    if (grupoParam && grupoParam !== 'todos') {
      if (grupoParam === 'sem_grupo') {
        query += ` WHERE p.grupo_id IS NULL `;
      } else {
        query += ` WHERE p.grupo_id = $1 `;
        params.push(Number(grupoParam));
      }
    }

    query += ` ORDER BY g.nome_grupo ASC NULLS LAST, p.nome_completo ASC `;

    const res = await client.query(query, params);

    return NextResponse.json({
      grupos: gruposRes.rows,
      publicadores: res.rows
    });
  } catch (error) {
    console.error('Erro ao consultar relatório de publicadores:', error);
    return NextResponse.json({ message: 'Não foi possível carregar o relatório de publicadores.' }, { status: 500 });
  } finally {
    client.release();
  }
}
