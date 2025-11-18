import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// --- FUNÇÃO getPartTitles ATUALIZADA ---
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
  
  // --- LÓGICA ATUALIZADA AQUI ---
  scheduleData.ministry?.forEach((part, index) => {
    // Verifica se é um discurso
    const isDiscurso = part.title.toLowerCase().includes('discurso');
    
    if (isDiscurso) {
      // Se for discurso, registra apenas uma chave
      titles[`ministerio_${index}`] = part.title;
    } else {
      // Se NÃO for discurso, registra duas chaves (_1 e _2)
      // ambas apontando para o mesmo título de parte.
      titles[`ministerio_${index}_1`] = part.title;
      titles[`ministerio_${index}_2`] = part.title;
    }
  });
  // --- FIM DA LÓGICA ATUALIZADA ---

  scheduleData.living?.forEach((part, index) => {
    titles[`vida_${index}`] = part.title;
  });

  return titles;
}
// --- FIM DA FUNÇÃO ---


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

    // 1. Buscar publicadores (sem alteração)
    const pubRes = await client.query('SELECT id, nome_completo FROM publicadores');
    const publicadorMap = new Map(pubRes.rows.map(p => [p.nome_completo, p.id]));

    // 2. Preparar INSERTS (sem alteração)
    const insertQuery = `
      INSERT INTO designacoes_reuniao (publicador_id, data_reuniao, descricao_semana, nome_parte)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (publicador_id, data_reuniao, nome_parte) DO NOTHING
    `;
    
    // 3. Loop de Inserção (sem alteração)
    // Este loop já funciona, pois 'partTitles' agora resolve
    // 'ministerio_1_1' e 'ministerio_1_2' para o título correto.
    for (const [partId, nomeCompleto] of Object.entries(assignments)) {
      if (nomeCompleto && publicadorMap.has(nomeCompleto)) {
        const publicadorId = publicadorMap.get(nomeCompleto);
        const nomeParte = partTitles[partId] || partId; 

        await client.query(insertQuery, [
          publicadorId,
          meetingDate,
          weekDateString,
          nomeParte
        ]);
      }
    }

    // 4. Confirmar transação (sem alteração)
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