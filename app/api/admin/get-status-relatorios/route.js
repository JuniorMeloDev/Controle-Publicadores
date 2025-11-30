// app/api/admin/get-status-relatorios/route.js
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Mapeamento de meses para a ordem de ano de serviço
const MES_ORDEM = {
  'Setembro': 1, 'Outubro': 2, 'Novembro': 3, 'Dezembro': 4,
  'Janeiro': 5, 'Fevereiro': 6, 'Março': 7, 'Abril': 8, 
  'Maio': 9, 'Junho': 10, 'Julho': 11, 'Agosto': 12
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get('mes');
  const ano_servico = searchParams.get('ano');

  if (!mes || !ano_servico) {
    return NextResponse.json({ message: 'Mês e Ano de serviço são obrigatórios.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // 1. Busca todos os publicadores (Nome e Grupo)
    const publicadoresRes = await client.query(`
      SELECT 
        p.id, 
        p.nome_completo, 
        p.nome_chamado,
        g.nome_grupo
      FROM publicadores p
      LEFT JOIN grupos g ON p.grupo_id = g.id
      ORDER BY g.nome_grupo ASC, p.nome_completo ASC
    `);

    const todosPublicadores = publicadoresRes.rows;

    // 2. Busca os IDs dos publicadores que enviaram relatórios válidos para o período
    // Um relatório é 'válido' se participou_ministerio for TRUE
    // OU se tiver horas/estudos (para PRs, etc.)
    const relatoriosRes = await client.query(`
      SELECT 
        publicador_id,
        participou_ministerio
      FROM relatorios_mensais
      WHERE mes = $1 AND ano_servico = $2
      -- Filtra relatórios que não são nulos (participou ou tem dados)
      AND (participou_ministerio = TRUE OR horas IS NOT NULL OR estudos_biblicos IS NOT NULL)
    `, [mes, ano_servico]);

    const publicadoresComRelatorio = new Set(relatoriosRes.rows.map(row => String(row.publicador_id)));

    // 3. Combina os dados para obter o status de cada um
    const statusGeral = todosPublicadores.map(pub => {
      const idStr = String(pub.id);
      
      // O status considera a participação ou ter algum dado registrado (horas, estudos)
      const enviou = publicadoresComRelatorio.has(idStr);
      
      return {
        id: idStr,
        nome_completo: pub.nome_completo,
        nome_curto: pub.nome_chamado || pub.nome_completo.split(' ')[0],
        nome_grupo: pub.nome_grupo || 'Sem Grupo',
        status: enviou ? 'Enviado' : 'Pendente'
      };
    });

    return NextResponse.json(statusGeral, { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar status de relatórios:', err);
    return NextResponse.json({ message: 'Erro interno ao buscar o status dos relatórios.' }, { status: 500 });
  } finally {
    client.release();
  }
}