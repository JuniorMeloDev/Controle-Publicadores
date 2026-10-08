import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { registerAuditLog } from '@/app/lib/audit-log';
import { lockAssignmentMeeting } from '@/app/lib/meeting-calendar-service';
import { getPartTitles } from '@/app/lib/life-ministry-parts';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

function normalizeStr(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export async function POST(request) {
  const body = await request.json();
  const { scheduleData, assignments, reuniao_id } = body;
  let { meetingDate } = body;

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
    let meetingId = reuniao_id;
    if (!meetingId) {
      const existing = await client.query("SELECT id FROM reunioes_registro WHERE data = $1 AND tipo = 'Meio de Semana'", [meetingDate]);
      meetingId = existing.rows[0]?.id;
    }
    if (meetingId) meetingDate = (await lockAssignmentMeeting(client, meetingId, 'Meio de Semana')).data;

    const partTitles = getPartTitles(scheduleData);
    const pubRes = await client.query('SELECT id, nome_completo FROM publicadores');
    const publicadorMap = new Map(pubRes.rows.map(p => [p.nome_completo, p.id]));
    const participantesExternos = [];
    for (const [partId, nome] of Object.entries(assignments)) {
      if (!nome || publicadorMap.has(nome)) continue;
      const titulo = partTitles[partId];
      const parteEstudante = (/^tesouro_\d+$/.test(partId) && normalizeStr(titulo).includes('leitura da biblia')) ||
        (/^ministerio_\d+(?:_[12])?$/.test(partId) && !normalizeStr(titulo).includes('consideracao'));
      if (!titulo || !parteEstudante || typeof nome !== 'string' || !nome.trim()) {
        await client.query('ROLLBACK');
        return NextResponse.json({ message: 'Participantes sem cadastro são permitidos apenas em partes de estudantes.' }, { status: 400 });
      }
      participantesExternos.push({ parte_id: partId, nome_parte: titulo, nome_completo: nome.trim() });
    }

    // 1. Salva o Programa
    await client.query(`
      INSERT INTO reunioes_dados (data_reuniao, dados_json, descricao_texto, reuniao_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (data_reuniao) 
      DO UPDATE SET dados_json = $2, descricao_texto = $3, reuniao_id = COALESCE($4, reunioes_dados.reuniao_id)
    `, [meetingDate, JSON.stringify({ ...scheduleData, participantes_externos: participantesExternos }), scheduleData.weekDate, meetingId || null]);

    // 2. Salva as Designações
    const weekDateString = scheduleData.weekDate || 'Semana';

    // Limpa anteriores
    await client.query('DELETE FROM designacoes_reuniao WHERE data_reuniao = $1', [meetingDate]);

    const insertQuery = `
      INSERT INTO designacoes_reuniao (publicador_id, data_reuniao, descricao_semana, nome_parte, reuniao_id)
      VALUES ($1, $2, $3, $4, $5)
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
              nomeParte,
              meetingId || null
            ]);
        }
      }
    }

    await registerAuditLog(client, {
      userId,
      action: 'designacoes_salvas',
      entity: 'reuniao',
      entityId: meetingDate,
      details: { descricao: scheduleData.weekDate }
    });
    await client.query('COMMIT');
    return NextResponse.json({ message: 'Salvo com sucesso!' }, { status: 201 });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao salvar:', err);
    return NextResponse.json({ message: err.code ? 'Erro interno ao salvar.' : err.message }, { status: err.code ? 500 : 400 });
  } finally {
    client.release();
  }
}
