import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '12'; // Default last 12 meetings

  const client = await pool.connect();
  try {
    // 1. Get Total Active Publishers (Current)
    // Assuming all in 'publicadores' are active for now as we don't have a status col
    const totalPubRes = await client.query('SELECT COUNT(*) FROM publicadores');
    const totalPublishers = parseInt(totalPubRes.rows[0].count);

    // 2. Get Meeting Attendance
    const res = await client.query(`
      SELECT 
        r.data,
        COUNT(CASE WHEN a.modalidade = 'Presencial' THEN 1 END)::int as presencial,
        COUNT(CASE WHEN a.modalidade = 'Zoom' THEN 1 END)::int as zoom,
        COUNT(a.id)::int as total_presente
      FROM reunioes_registro r
      LEFT JOIN assistencia_detalhe a ON r.id = a.reuniao_id
      GROUP BY r.id, r.data
      ORDER BY r.data DESC
      LIMIT $1
    `, [limit]);
    
    // 3. Format Data
    const history = res.rows.map(row => {
        const total_presente = parseInt(row.total_presente);
        const faltantes = Math.max(0, totalPublishers - total_presente);
        
        return {
            date: new Date(row.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
            fullDate: row.data,
            presencial: parseInt(row.presencial),
            zoom: parseInt(row.zoom),
            faltantes: faltantes,
            total_publishers: totalPublishers
        };
    }).reverse(); // Reverse to show oldest to newest in chart

    // Calculate Averages
    const averages = {
        presencial: Math.round(history.reduce((acc, curr) => acc + curr.presencial, 0) / (history.length || 1)),
        zoom: Math.round(history.reduce((acc, curr) => acc + curr.zoom, 0) / (history.length || 1)),
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
