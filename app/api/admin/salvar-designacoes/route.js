import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Função auxiliar para mapear IDs de partes para títulos legíveis
function getPartTitles(scheduleData) {
  const titles = {
    'presidente': 'Presidente',
    'ajudante': 'Ajudante',
    'oracao_inicial': 'Oração Inicial',
    'oracao_final': 'Oração Final',
    'comentarios_iniciais': scheduleData.openingComments || 'Comentários Iniciais',
    'comentarios_finais': scheduleData.finalComments || 'Comentários Finais',
  };

  scheduleData.treasures?.forEach((part, index) => {
    titles[`tesouro_${index}`] = part.title;
  });
  scheduleData.ministry?.forEach((part, index) => {
    titles[`ministerio_${index}`] = part.title;
  });
  scheduleData.living?.forEach((part, index) => {
    titles[`vida_${index}`] = part.title;
  });

  return titles;
}

export async function POST(request) {
  const body = await request.json();
  const { scheduleData, assignments, meetingDate } = body;

  if (!scheduleData || !assignments || !meetingDate) {
    return NextResponse.json({ message: 'Dados incompletos. É necessário data da reunião, dados do programa e designações.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partTitles = getPartTitles(scheduleData);
    const weekDateString = scheduleData.weekDate || 'Semana';

    // 1. Buscar todos os publicadores de uma vez para evitar múltiplas queries
    const pubRes = await client.query('SELECT id, nome_completo FROM publicadores');
    const publicadorMap = new Map(pubRes.rows.map(p => [p.nome_completo, p.id]));

    // 2. Preparar os INSERTS
    const insertQuery = `
      INSERT INTO designacoes_reuniao (publicador_id, data_reuniao, descricao_semana, nome_parte)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (publicador_id, data_reuniao, nome_parte) DO NOTHING
    `;

    for (const [partId, nomeCompleto] of Object.entries(assignments)) {
      if (nomeCompleto && publicadorMap.has(nomeCompleto)) {
        const publicadorId = publicadorMap.get(nomeCompleto);
        const nomeParte = partTitles[partId] || partId; // Usa o título legível ou o ID como fallback

        await client.query(insertQuery, [
          publicadorId,
          meetingDate,       // ex: '2025-11-10'
          weekDateString,    // ex: '10-16 DE NOVEMBRO'
          nomeParte          // ex: 'A importância da beleza interior (10 min)'
        ]);
      }
    }

    // 3. Confirmar a transação
    await client.query('COMMIT');

    return NextResponse.json({ message: 'Designações salvas no histórico com sucesso!' }, { status: 201 });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao salvar designações:', err);
    return NextResponse.json({ message: 'Erro interno ao salvar o histórico de designações.' }, { status: 500 });
  } finally {
    client.release();
  }
}