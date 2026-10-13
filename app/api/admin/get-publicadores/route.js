import { authorizeRequest } from '@/app/lib/request-authorization';
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserPermissions, getUserIdFromRequest } from '@/app/lib/server-access';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request) {
  const denied = await authorizeRequest(request, 'GET');
  if (denied) return denied;
  const client = await pool.connect();
  try {
    const permissions = await getUserPermissions(client, getUserIdFromRequest(request));
    const res = await client.query(`
      SELECT 
        p.id, 
        p.nome_completo, 
        p.data_nascimento, 
        p.data_batismo,
        p.email,
        p.nome_chamado,
        g.nome_grupo, 
        p.privilegios, 
        p.designacoes,
        p.sexo,         
        p.esperanca    
      FROM publicadores p
      LEFT JOIN grupos g ON p.grupo_id = g.id
      WHERE g.id IS NULL OR g.ativo = TRUE
      ORDER BY p.nome_completo ASC
    `);
    
    const fullProfile = permissions?.pages?.publicadores === true || permissions?.pages?.relatorios === true;
    const canReadEmail = permissions?.pages?.publicadores === true || permissions?.actions?.designacoes_email === true;
    const allowedFields = ['id', 'nome_completo', 'nome_chamado', 'nome_grupo', 'privilegios', 'designacoes', 'sexo',
      ...(fullProfile ? ['data_nascimento', 'data_batismo', 'esperanca'] : []), ...(canReadEmail ? ['email'] : [])];
    return NextResponse.json(res.rows.map(row => Object.fromEntries(allowedFields.map(key => [key, row[key]]))), { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar publicadores:', err);
    return NextResponse.json({ message: 'Erro ao buscar publicadores.' }, { status: 500 });
  } finally {
    client.release();
  }
}
