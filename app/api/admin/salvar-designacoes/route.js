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

// Extrai só o título curto da parte: "Relatório anual de serviço (15 min): Consideração"
// Descarta o restante do texto de instrução que vem do RTF
function truncatePartTitle(title) {
  if (!title) return '';
  // If it's a song/cântico, return as-is
  if (normalizeStr(title).includes('cantico') || normalizeStr(title).startsWith('cantemos')) return title;

  // Try to extract: text up to and including "(XX min)" + optional ": Consideração"
  const match = title.match(/^(.*?\(\d+\s*min\))/i);
  if (match) {
    let base = match[1].trim();
    // Check if "Consideração" immediately follows the time
    const afterTime = title.substring(match[0].length);
    if (afterTime.match(/^[:\s]*Considera/i)) {
      base += ': Consideração';
    }
    return base;
  }
  // Fallback: truncate at first period or 100 chars
  const dotIdx = title.indexOf('.');
  if (dotIdx > 0 && dotIdx < 100) return title.substring(0, dotIdx).trim();
  return title.substring(0, 100).trim();
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
    titles[`tesouro_${index}`] = truncatePartTitle(part.title);
  });
  
  scheduleData.ministry?.forEach((part, index) => {
    const isDiscurso = normalizeStr(part.title).includes('discurso');
    if (isDiscurso) {
      titles[`ministerio_${index}`] = truncatePartTitle(part.title);
    } else {
      titles[`ministerio_${index}_1`] = truncatePartTitle(part.title);
      titles[`ministerio_${index}_2`] = truncatePartTitle(part.title);
    }
  });

  scheduleData.living?.forEach((part, index) => {
    const isBibleStudy = normalizeStr(part.title).includes('estudo biblico');
    if (isBibleStudy) {
       titles[`vida_${index}_1`] = truncatePartTitle(part.title);
       titles[`vida_${index}_2`] = truncatePartTitle(part.title);
    } else {
       titles[`vida_${index}`] = truncatePartTitle(part.title);
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
