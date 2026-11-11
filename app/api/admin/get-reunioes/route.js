import { authorizeRequest } from '@/app/lib/request-authorization';
// app/api/admin/get-reunioes/route.js
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getCalendarContext, withCalendarState } from '@/app/lib/meeting-calendar-service';
import { getLifeMinistrySummary } from '@/app/lib/life-ministry-summary';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request) {
  const denied = await authorizeRequest(request, 'GET');
  if (denied) return denied;
  const client = await pool.connect();
  try {
    const context = await getCalendarContext(client);
    const res = await client.query(`
      SELECT r.id AS reuniao_id, COALESCE(r.data, d.data_reuniao) AS data_reuniao,
        r.tipo, r.cancelada, r.motivo_cancelamento, d.descricao_texto,
        d.dados_json IS NOT NULL AS tem_programacao,
        d.dados_json AS programacao, a.designacoes
      FROM (SELECT * FROM reunioes_registro WHERE tipo = 'Meio de Semana') r
      FULL OUTER JOIN (
        SELECT d.*, COALESCE(d.reuniao_id, legacy.id) AS calendario_id
        FROM reunioes_dados d LEFT JOIN reunioes_registro legacy
          ON legacy.data = d.data_reuniao AND legacy.tipo = 'Meio de Semana'
      ) d ON d.calendario_id = r.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('nome_parte', a.nome_parte,
            'nome_completo', p.nome_completo) ORDER BY a.id), '[]'::jsonb) AS designacoes
        FROM designacoes_reuniao a JOIN publicadores p ON p.id = a.publicador_id
        WHERE a.reuniao_id = r.id OR (a.reuniao_id IS NULL
            AND a.data_reuniao = COALESCE(r.data, d.data_reuniao))
      ) a ON d.dados_json IS NOT NULL
      ORDER BY COALESCE(r.data, d.data_reuniao) DESC
    `);
    
    // Formata a data para exibição
    const reunioes = res.rows.map(({ programacao, designacoes, ...row }) => ({
      ...withCalendarState({ ...row, data: row.data_reuniao }, context),
      dataSQL: new Date(row.data_reuniao).toISOString().split('T')[0],
      descricao: row.descricao_texto || 'Reunião de meio de semana',
      preenchimento: getLifeMinistrySummary(programacao, designacoes || []),
      dataFormatada: new Date(row.data_reuniao).toLocaleDateString('pt-BR', {
        timeZone: 'UTC'
      })
    }));

    return NextResponse.json(reunioes, { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar lista de reuniões:', err);
    return NextResponse.json({ message: 'Erro ao buscar histórico.' }, { status: 500 });
  } finally {
    client.release();
  }
}
