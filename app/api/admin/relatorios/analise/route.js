import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mes = searchParams.get('mes');
  const ano_servico = searchParams.get('ano_servico');
  const tipo_pioneiro = searchParams.get('tipo_pioneiro'); // 'regular', 'auxiliar', 'all'
  const grupo_id = searchParams.get('grupo_id');

  if (!mes || !ano_servico) {
      return NextResponse.json({ message: 'Mês e Ano de serviço são obrigatórios.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Base WHERE clause
    let whereClause = `WHERE r.mes = $1 AND r.ano_servico = $2`;
    const params = [mes, ano_servico];
    let paramIndex = 3;

    // Filters
    if (grupo_id) {
        whereClause += ` AND p.grupo_id = $${paramIndex}`;
        params.push(grupo_id);
        paramIndex++;
    }

    if (tipo_pioneiro === 'regular') {
        whereClause += ` AND 'pioneiro_regular' = ANY(p.designacoes)`;
    } else if (tipo_pioneiro === 'auxiliar') {
        // Check report checkbox first, usually strict for that month
        whereClause += ` AND r.pioneiro_auxiliar = true`;
    } else if (tipo_pioneiro === 'publicador') {
        // Exclude Regular (via designacoes) AND Auxiliary (via report flag)
        whereClause += ` AND (NOT ('pioneiro_regular' = ANY(p.designacoes)) OR p.designacoes IS NULL)`;
        whereClause += ` AND (r.pioneiro_auxiliar IS DISTINCT FROM true)`;
    }

    // Main Query: Aggregated Stats
    const query = `
        SELECT 
            COUNT(DISTINCT r.publicador_id) as total_publicadores,
            COUNT(CASE WHEN r.participou_ministerio = true THEN 1 END) as total_participantes,
            COALESCE(SUM(r.horas), 0) as soma_horas,
            COALESCE(SUM(r.estudos_biblicos), 0) as soma_estudos,
            COUNT(CASE WHEN r.pioneiro_auxiliar = true THEN 1 END) as count_auxiliares
        FROM relatorios_mensais r
        JOIN publicadores p ON r.publicador_id = p.id
        ${whereClause}
    `;

    const result = await client.query(query, params);
    const stats = result.rows[0];

    // Detailed List for Table
    const listQuery = `
        SELECT 
            p.id, 
            p.nome_completo, 
            g.nome_grupo,
            r.participou_ministerio,
            r.pioneiro_auxiliar,
            ('pioneiro_regular' = ANY(p.designacoes)) as is_regular,
            r.horas,
            r.estudos_biblicos,
            r.observacoes
        FROM relatorios_mensais r
        JOIN publicadores p ON r.publicador_id = p.id
        LEFT JOIN grupos g ON p.grupo_id = g.id
        ${whereClause}
        ORDER BY p.nome_completo ASC
    `;
    
    const listResult = await client.query(listQuery, params);

    // Calculate Averages
    const totalPubs = parseInt(stats.total_publicadores) || 0;
    const totalPart = parseInt(stats.total_participantes) || 0;
    const totalHoras = parseFloat(stats.soma_horas) || 0;
    const totalEstudos = parseInt(stats.soma_estudos) || 0;

    const data = {
        totals: {
            publicadores_reportaram: totalPubs,
            participantes: totalPart,
            horas: totalHoras,
            estudos: totalEstudos,
            auxiliares: parseInt(stats.count_auxiliares) || 0
        },
        averages: {
            horas_por_publicador: totalPubs > 0 ? (totalHoras / totalPubs).toFixed(1) : 0,
            estudos_por_publicador: totalPubs > 0 ? (totalEstudos / totalPubs).toFixed(1) : 0
        },
        details: listResult.rows
    };

    return NextResponse.json(data, { status: 200 });

  } catch (err) {
    console.error('Erro ao gerar análise:', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  } finally {
    client.release();
  }
}
