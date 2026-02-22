import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { registerAuditLog } from '@/app/lib/audit-log';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

function normalizeStr(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getPartTitles(scheduleData) {
  const titles = {
    'presidente': 'Presidente',
    'ajudante': 'Ajudante',
    'oracao_inicial': 'Oração Inicial',
    'oracao_final': 'Oração Final',
    'comentarios_iniciais': scheduleData.openingComments || 'Comentários Iniciais',
    'comentarios_finais': scheduleData.finalComments || 'Comentários Finais',
    'cantico_meio': scheduleData.middleSong || 'Cântico do Meio',
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
    const isBibleStudy = normalizeStr(part.title).includes('estudo biblico');
    if (isBibleStudy) {
       titles[`vida_${index}_1`] = part.title; 
       titles[`vida_${index}_2`] = part.title; 
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
    const userId = getUserIdFromRequest(request);
    const perms = await getUserPermissions(client, userId);
    if (!isAllowed(perms, 'designacoes_salvar', 'actions')) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    await client.query('BEGIN');

    // 1. Salva o Programa
    await client.query(`
      INSERT INTO reunioes_dados (data_reuniao, dados_json, descricao_texto)
      VALUES ($1, $2, $3)
      ON CONFLICT (data_reuniao) 
      DO UPDATE SET dados_json = $2, descricao_texto = $3
    `, [meetingDate, JSON.stringify(scheduleData), scheduleData.weekDate]);

    // 2. Salva as Designações
    const partTitles = getPartTitles(scheduleData);
    const weekDateString = scheduleData.weekDate || 'Semana';

    // Busca IDs
    const pubRes = await client.query('SELECT id, nome_completo FROM publicadores');
    const publicadorMap = new Map(pubRes.rows.map(p => [p.nome_completo, p.id]));

    // Limpa anteriores
    await client.query('DELETE FROM designacoes_reuniao WHERE data_reuniao = $1', [meetingDate]);

    const insertQuery = `
      INSERT INTO designacoes_reuniao (publicador_id, data_reuniao, descricao_semana, nome_parte)
      VALUES ($1, $2, $3, $4)
    `;

    for (const [partId, nomeCompleto] of Object.entries(assignments)) {
      if (nomeCompleto && publicadorMap.has(nomeCompleto)) {
        const publicadorId = publicadorMap.get(nomeCompleto);
        const nomeParte = partTitles[partId]; 

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
    await registerAuditLog(client, {
      userId,
      action: 'designacoes_salvas',
      entity: 'reuniao',
      entityId: meetingDate,
      details: { descricao: scheduleData.weekDate }
    });
    return NextResponse.json({ message: 'Salvo com sucesso!' }, { status: 201 });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao salvar:', err);
    return NextResponse.json({ message: 'Erro interno ao salvar.' }, { status: 500 });
  } finally {
    client.release();
  }
}
