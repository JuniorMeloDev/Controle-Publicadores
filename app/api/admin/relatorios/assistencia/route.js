import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const client = await pool.connect();
  try {
    // 1. Get Total Active Publishers (Current)
    const totalPubRes = await client.query('SELECT COUNT(*) FROM publicadores');
    const totalPublishers = parseInt(totalPubRes.rows[0].count);

    // 2. Build Query
    let query = `
      SELECT 
        r.data,
        r.visitantes,
        COUNT(CASE WHEN a.modalidade = 'Presencial' THEN 1 END)::int as presencial,
        COUNT(CASE WHEN a.modalidade = 'Zoom' THEN 1 END)::int as zoom,
        COUNT(a.id)::int as total_presente
      FROM reunioes_registro r
      LEFT JOIN assistencia_detalhe a ON r.id = a.reuniao_id
    `;
    
    const params = [];
    
    // Always filter out future meetings
    query += ` WHERE r.data <= CURRENT_DATE`;

    if (startDate && endDate) {
        query += ` AND r.data >= $${params.length + 1} AND r.data <= $${params.length + 2}`;
        params.push(startDate, endDate);
    } 
    
    query += `
      GROUP BY r.id, r.data, r.visitantes
      ORDER BY r.data DESC
    `;
    
    if (!startDate && !endDate) {
         query += ` LIMIT $${params.length + 1}`;
         params.push(limit || 20);
    }

    const res = await client.query(query, params);
    
    // 3. Format Data
    const history = res.rows.map(row => {
        const total_presente = parseInt(row.total_presente);
        const visitantes = parseInt(row.visitantes || 0);
        // Faltantes calculation logic might need review if visitors are counted separately or integrated. 
        // Usually Faltantes = Total Pubs - (Presencial + Zoom). Visitors are extra.
        const faltantes = Math.max(0, totalPublishers - total_presente);
        
        return {
            date: new Date(row.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
            fullDate: row.data,
            presencial: parseInt(row.presencial),
            zoom: parseInt(row.zoom),
            visitantes: visitantes,
            faltantes: faltantes,
            total_publishers: totalPublishers,
            total_geral: total_presente + visitantes
        };
    }).reverse(); 

    // Calculate Averages
    const averages = {
        presencial: Math.round(history.reduce((acc, curr) => acc + curr.presencial, 0) / (history.length || 1)),
        zoom: Math.round(history.reduce((acc, curr) => acc + curr.zoom, 0) / (history.length || 1)),
        visitantes: Math.round(history.reduce((acc, curr) => acc + curr.visitantes, 0) / (history.length || 1)),
        faltantes: Math.round(history.reduce((acc, curr) => acc + curr.faltantes, 0) / (history.length || 1)),
    };

    return NextResponse.json({
        history,
        averages,
        totalPublishers
    });

  } catch (err) {
    console.error('Erro ao buscar assistência:', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  } finally {
    client.release();
  }
}
