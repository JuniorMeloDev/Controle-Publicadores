import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

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
    const isDiscurso = part.title.toLowerCase().includes('discurso');
    if (isDiscurso) {
      titles[`ministerio_${index}`] = part.title;
    } else {
      titles[`ministerio_${index}_1`] = part.title;
      titles[`ministerio_${index}_2`] = part.title;
    }
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
    return NextResponse.json({ message: 'Dados incompletos.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Cria a tabela para guardar o JSON do programa (se não existir)
    await client.query(`
      CREATE TABLE IF NOT EXISTS reunioes_dados (
        data_reuniao DATE PRIMARY KEY,
        dados_json JSONB NOT NULL,
        descricao_texto TEXT
      );
    `);

    // 2. Salva ou Atualiza o Programa da Reunião (JSON)
    await client.query(`
      INSERT INTO reunioes_dados (data_reuniao, dados_json, descricao_texto)
      VALUES ($1, $2, $3)
      ON CONFLICT (data_reuniao) 
      DO UPDATE SET dados_json = $2, descricao_texto = $3
    `, [meetingDate, JSON.stringify(scheduleData), scheduleData.weekDate]);

    // 3. Salva as Designações (Publicadores)
    const partTitles = getPartTitles(scheduleData);
    const weekDateString = scheduleData.weekDate || 'Semana';

    const pubRes = await client.query('SELECT id, nome_completo FROM publicadores');
    const publicadorMap = new Map(pubRes.rows.map(p => [p.nome_completo, p.id]));

    const insertQuery = `
      INSERT INTO designacoes_reuniao (publicador_id, data_reuniao, descricao_semana, nome_parte)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (publicador_id, data_reuniao, nome_parte) DO NOTHING
    `;
    
    // Remove designações anteriores dessa data para evitar duplicatas/lixo se mudar o nome da parte
    await client.query('DELETE FROM designacoes_reuniao WHERE data_reuniao = $1', [meetingDate]);

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

    await client.query('COMMIT');
    return NextResponse.json({ message: 'Designações e Programa salvos com sucesso!' }, { status: 201 });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao salvar:', err);
    return NextResponse.json({ message: 'Erro interno ao salvar.' }, { status: 500 });
  } finally {
    client.release();
  }
}