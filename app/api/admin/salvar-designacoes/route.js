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
    // 1. CORREÇÃO: Adicionamos o mapeamento para o Cântico do Meio ser salvo
    'cantico_meio': scheduleData.middleSong || 'Cântico do Meio',
  };

  scheduleData.treasures?.forEach((part, index) => {
    titles[`tesouro_${index}`] = part.title;
  });
  
  scheduleData.ministry?.forEach((part, index) => {
    // 2. CORREÇÃO: Verificação mais flexível para 'discurso' (sem os dois pontos obrigatórios)
    const isDiscurso = part.title.toLowerCase().includes('discurso');
    
    if (isDiscurso) {
      titles[`ministerio_${index}`] = part.title;
    } else {
      titles[`ministerio_${index}_1`] = part.title;
      titles[`ministerio_${index}_2`] = part.title;
    }
  });

  scheduleData.living?.forEach((part, index) => {
    // 3. CORREÇÃO: Detectar Estudo Bíblico para salvar as duas partes (Dirigente/Leitor)
    const isBibleStudy = part.title.toLowerCase().includes('estudo bíblico');
    
    if (isBibleStudy) {
       titles[`vida_${index}_1`] = part.title; // Dirigente
       titles[`vida_${index}_2`] = part.title; // Leitor
    } else {
       titles[`vida_${index}`] = part.title;
    }
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

    // 1. Salva ou Atualiza o Programa da Reunião (JSON)
    await client.query(`
      INSERT INTO reunioes_dados (data_reuniao, dados_json, descricao_texto)
      VALUES ($1, $2, $3)
      ON CONFLICT (data_reuniao) 
      DO UPDATE SET dados_json = $2, descricao_texto = $3
    `, [meetingDate, JSON.stringify(scheduleData), scheduleData.weekDate]);

    // 2. Salva as Designações (Publicadores)
    const partTitles = getPartTitles(scheduleData);
    const weekDateString = scheduleData.weekDate || 'Semana';

    const pubRes = await client.query('SELECT id, nome_completo FROM publicadores');
    const publicadorMap = new Map(pubRes.rows.map(p => [p.nome_completo, p.id]));

    // Limpa designações anteriores desta data para evitar duplicidade ou lixo
    await client.query('DELETE FROM designacoes_reuniao WHERE data_reuniao = $1', [meetingDate]);

    const insertQuery = `
      INSERT INTO designacoes_reuniao (publicador_id, data_reuniao, descricao_semana, nome_parte)
      VALUES ($1, $2, $3, $4)
    `;

    // Itera sobre as designações enviadas pelo front
    for (const [partId, nomeCompleto] of Object.entries(assignments)) {
      if (nomeCompleto && publicadorMap.has(nomeCompleto)) {
        const publicadorId = publicadorMap.get(nomeCompleto);
        
        // Pega o título real da parte usando o ID (ex: 'vida_0_1' vira 'Estudo Bíblico...')
        const nomeParte = partTitles[partId]; 

        // Só salva se tivermos um título de parte válido mapeado
        if (nomeParte) {
            await client.query(insertQuery, [
              publicadorId,
              meetingDate,
              weekDateString,
              nomeParte
            ]);
        }
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