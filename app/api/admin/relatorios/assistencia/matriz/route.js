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

  if (!startDate || !endDate) {
    return NextResponse.json({ message: 'Datas obrigatórias.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // 1. Get Meetings in Range (Cols)
    // Filter FUTURE meetings to avoid showing "Falta" for unhappened meetings
    const meetingsRes = await client.query(`
      SELECT id, data, visitantes 
      FROM reunioes_registro 
      WHERE data >= $1 AND data <= $2 AND data <= CURRENT_DATE
      ORDER BY data ASC
    `, [startDate, endDate]);
    
    const meetings = meetingsRes.rows.map(m => ({
        id: m.id,
        date: new Date(m.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        fullDate: m.data
    }));

    if (meetings.length === 0) {
        return NextResponse.json({ meetings: [], rows: [] });
    }

    // 2. Get All Publishers (Rows)
    const pubsRes = await client.query('SELECT id, nome_completo, nome_chamado FROM publicadores ORDER BY nome_completo ASC');
    const publishers = pubsRes.rows;

    // 3. Get Attendance Details
    const attRes = await client.query(`
        SELECT a.publicador_id, a.reuniao_id, a.modalidade
        FROM assistencia_detalhe a
        JOIN reunioes_registro r ON a.reuniao_id = r.id
        WHERE r.data >= $1 AND r.data <= $2
    `, [startDate, endDate]);

    // 4. Map Attendance
    // Map: PublisherID -> { MeetingID: Modalidade }
    const attendanceMap = {};
    attRes.rows.forEach(row => {
        if (!attendanceMap[row.publicador_id]) {
            attendanceMap[row.publicador_id] = {};
        }
        attendanceMap[row.publicador_id][row.reuniao_id] = row.modalidade; // 'Presencial' or 'Zoom'
    });

    // 5. Build Rows
    const rows = publishers.map(pub => {
        const pubAttendance = attendanceMap[pub.id] || {};
        const statusByMeeting = {};
        
        meetings.forEach(m => {
            const status = pubAttendance[m.id];
            statusByMeeting[m.id] = status || 'Falta'; // If no record, it's a Falta (since we filtered future meetings)
        });

        return {
            id: pub.id,
            name: pub.nome_completo,
            shortName: pub.nome_chamado,
            attendance: statusByMeeting
        };
    });

    return NextResponse.json({ meetings, rows });

  } catch (err) {
    console.error('Erro ao gerar matriz:', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  } finally {
    client.release();
  }
}
