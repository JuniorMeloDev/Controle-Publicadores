import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const type = searchParams.get('type'); // 'presencial', 'zoom', 'faltantes'

  if (!startDate || !endDate || !type) {
    return NextResponse.json({ message: 'Parâmetros inválidos.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    let results = [];

    if (type === 'presencial' || type === 'zoom') {
      const query = `
        SELECT 
          p.nome_completo, 
          COUNT(*) as total
        FROM assistencia_detalhe a
        JOIN publicadores p ON a.publicador_id = p.id
        JOIN reunioes_registro r ON a.reuniao_id = r.id
        WHERE r.data >= $1 AND r.data <= $2
        AND a.modalidade ILIKE $3
        GROUP BY p.nome_completo
        ORDER BY total DESC
      `;
      // 'Presencial' or 'Zoom' (case insensitive match just in case)
      const res = await client.query(query, [startDate, endDate, type]);
      results = res.rows.map(r => ({ name: r.nome_completo, value: parseInt(r.total) }));

    } else if (type === 'faltantes') {
      // 1. Get Totals
      const totalMeetingsRes = await client.query(
        'SELECT COUNT(*) FROM reunioes_registro WHERE data >= $1 AND data <= $2 AND data <= CURRENT_DATE',
        [startDate, endDate]
      );
      const totalMeetings = parseInt(totalMeetingsRes.rows[0].count);

      if (totalMeetings === 0) {
          return NextResponse.json([], { status: 200 });
      }

      // 2. Get Attendance per Publisher
      // We count how many times they showed up (Presencial OR Zoom)
      const attendanceRes = await client.query(`
        SELECT 
          p.id,
          p.nome_completo,
          COUNT(r.id) as presence_count
        FROM publicadores p
        LEFT JOIN assistencia_detalhe a ON p.id = a.publicador_id
        LEFT JOIN reunioes_registro r ON a.reuniao_id = r.id AND r.data >= $1 AND r.data <= $2 AND r.data <= CURRENT_DATE
        GROUP BY p.id, p.nome_completo
      `, [startDate, endDate]);

      // 3. Calculate Absences
      results = attendanceRes.rows.map(row => {
          const presenceCount = parseInt(row.presence_count);
          const absences = totalMeetings - presenceCount;
          return {
              name: row.nome_completo,
              value: absences
          };
      })
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
    }

    return NextResponse.json(results);

  } catch (err) {
    console.error('Erro ao buscar detalhes:', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  } finally {
    client.release();
  }
}
