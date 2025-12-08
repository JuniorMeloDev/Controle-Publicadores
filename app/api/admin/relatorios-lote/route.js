import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function POST(request) {
  const client = await pool.connect();
  try {
    const { publisherIds } = await request.json();

    if (!publisherIds || !Array.isArray(publisherIds) || publisherIds.length === 0) {
      return NextResponse.json({ message: 'Lista de IDs inválida.' }, { status: 400 });
    }

    // Busca relatórios dos últimos 2 anos de serviço para os publicadores selecionados
    const res = await client.query(
      `SELECT r.*, 
        p.nome_completo AS pub_nome, 
        p.data_nascimento AS pub_nascimento, 
        p.data_batismo AS pub_batismo, 
        p.sexo AS pub_sexo, 
        p.esperanca AS pub_esperanca, 
        p.privilegios AS pub_privilegios, 
        p.designacoes AS pub_designacoes
       FROM relatorios_mensais r
       JOIN publicadores p ON r.publicador_id = p.id
       WHERE r.publicador_id = ANY($1)
       ORDER BY 
         r.publicador_id,
         r.ano_servico DESC,
         CASE
           WHEN r.mes = 'Setembro' THEN 1
           WHEN r.mes = 'Outubro' THEN 2
           WHEN r.mes = 'Novembro' THEN 3
           WHEN r.mes = 'Dezembro' THEN 4
           WHEN r.mes = 'Janeiro' THEN 5
           WHEN r.mes = 'Fevereiro' THEN 6
           WHEN r.mes = 'Março' THEN 7
           WHEN r.mes = 'Abril' THEN 8
           WHEN r.mes = 'Maio' THEN 9
           WHEN r.mes = 'Junho' THEN 10
           WHEN r.mes = 'Julho' THEN 11
           WHEN r.mes = 'Agosto' THEN 12
           ELSE 13
         END ASC`,
      [publisherIds]
    );

    // Agrupa por Publicador
    const grouped = {};
    publisherIds.forEach(id => {
        grouped[id] = { info: null, reports: [] };
    });

    res.rows.forEach(row => {
        if (!grouped[row.publicador_id].info) {
             grouped[row.publicador_id].info = {
                 nome: row.pub_nome,
                 nascimento: row.pub_nascimento,
                 batismo: row.pub_batismo,
                 sexo: row.pub_sexo,
                 esperanca: row.pub_esperanca,
                 privilegios: row.pub_privilegios || [],
                 designacoes: row.pub_designacoes || []
             };
        }
        grouped[row.publicador_id].reports.push(row);
    });

    // 6. Verificar quais publicadores ficaram sem info (porque não tinham relatórios)
    const idsSemInfo = publisherIds.filter(id => !grouped[id].info);

    if (idsSemInfo.length > 0) {
        const backupRes = await client.query(
            `SELECT id, nome_completo, data_nascimento, data_batismo, sexo, esperanca, privilegios, designacoes FROM publicadores WHERE id = ANY($1)`,
            [idsSemInfo]
        );
        backupRes.rows.forEach(row => {
            if (grouped[row.id]) {
                grouped[row.id].info = {
                    nome: row.nome_completo,
                    nascimento: row.data_nascimento,
                    batismo: row.data_batismo,
                    sexo: row.sexo,
                    esperanca: row.esperanca,
                    privilegios: row.privilegios || [],
                    designacoes: row.designacoes || []
                };
            }
        });
    }

    return NextResponse.json(grouped, { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar relatórios em lote:', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  } finally {
    client.release();
  }
}
