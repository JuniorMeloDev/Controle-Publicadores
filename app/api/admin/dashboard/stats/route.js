import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET() {
  const client = await pool.connect();
  try {
    const today = new Date();
    // Adjust date to simulate local time or consistent UTC handling
    // Simplest approach: formatting YYYY-MM-DD parts manually
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const todayStr = `${year}-${month}-${day}`;
    const startOfMonth = `${year}-${month}-01`;
    // End of month: get day 0 of next month
    const lastDayObj = new Date(year, today.getMonth() + 1, 0);
    const endOfMonth = `${year}-${month}-${lastDayObj.getDate()}`;

    // 1. Próxima Reunião
    const nextMeetingQuery = `
      SELECT data 
      FROM reunioes_registro 
      WHERE data >= $1
      ORDER BY data ASC 
      LIMIT 1
    `;
    const nextMeetingResult = await client.query(nextMeetingQuery, [todayStr]);
    
    // 2. Quantidade de reuniões no mês atual
    const countQuery = `
      SELECT COUNT(*) 
      FROM reunioes_registro 
      WHERE data >= $1 AND data <= $2
    `;
    const countResult = await client.query(countQuery, [startOfMonth, endOfMonth]);

    return NextResponse.json({
      nextMeeting: nextMeetingResult.rows[0]?.data || null,
      meetingsThisMonth: parseInt(countResult.rows[0].count) || 0
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas do dashboard:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  } finally {
    client.release();
  }
}
