import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const limit = parseInt(searchParams.get('limit') || '10');

  const client = await pool.connect();

  try {
    let query = `
      SELECT 
        r.id,
        r.data,
        r.tipo,
        
        p_leitor.nome_completo as leitor_nome,
        p_leitor.nome_chamado as leitor_chamado,
        
        p_ind_int.nome_completo as ind_int_nome,
        p_ind_int.nome_chamado as ind_int_chamado,
        
        p_ind_ext_vol.nome_completo as ind_ext_vol_nome,
        p_ind_ext_vol.nome_chamado as ind_ext_vol_chamado,
        
        p_ind_ext.nome_completo as ind_ext_nome,
        p_ind_ext.nome_chamado as ind_ext_chamado,
        
        p_volante.nome_completo as volante_nome,
        p_volante.nome_chamado as volante_chamado,
        
        p_apoio.nome_completo as apoio_nome,
        p_apoio.nome_chamado as apoio_chamado

      FROM reunioes_registro r
      LEFT JOIN publicadores p_leitor ON r.leitor_id = p_leitor.id
      LEFT JOIN publicadores p_ind_int ON r.indicador_interno_id = p_ind_int.id
      LEFT JOIN publicadores p_ind_ext_vol ON r.indicador_externo_volante_id = p_ind_ext_vol.id
      LEFT JOIN publicadores p_ind_ext ON r.indicador_externo_id = p_ind_ext.id
      LEFT JOIN publicadores p_volante ON r.volante_id = p_volante.id
      LEFT JOIN publicadores p_apoio ON r.anciao_apoio_id = p_apoio.id
      
      WHERE r.data >= $1
    `;

    const params = [start];
    
    if (end) {
        query += ` AND r.data <= $2`;
        params.push(end);
    }

    query += ` ORDER BY r.data ASC LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await client.query(query, params);
    
    return NextResponse.json(res.rows, { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar privilégios:', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  } finally {
    client.release();
  }
}
