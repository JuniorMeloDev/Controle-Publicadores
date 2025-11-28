// app/api/admin/batch-update-grupos/route.js

import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function PUT(request) {
  const body = await request.json();
  const { publicadorIds, nome_grupo } = body;

  if (!Array.isArray(publicadorIds) || publicadorIds.length === 0 || !nome_grupo) {
    return NextResponse.json({ message: 'Dados incompletos ou inválidos.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Encontrar o ID do grupo de destino
    const grupoRes = await client.query('SELECT id FROM grupos WHERE nome_grupo = $1', [nome_grupo]);
    if (grupoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: 'Grupo de destino não encontrado.' }, { status: 404 });
    }
    const grupo_id_destino = grupoRes.rows[0].id;

    // 2. Processa cada publicador
    for (const idString of publicadorIds) {
      const publicadorId = parseInt(idString, 10);
      if (isNaN(publicadorId)) {
         console.error(`[ERRO DE DADOS] ID inválido: ${idString}`);
         continue; 
      } 

      // PASSO CRÍTICO 1: Busca o grupo_id antigo e bloqueia APENAS a tabela publicadores
      const pubRes = await client.query(
        `SELECT grupo_id 
         FROM publicadores 
         WHERE id = $1 FOR UPDATE`, // Apenas publicadores está sendo bloqueado
        [publicadorId]
      );
      
      const dadosAntigos = pubRes.rows[0];
      if (!dadosAntigos) continue; // Pula se o publicador não for encontrado

      let nomeGrupoAntigo = 'N/A'; // Valor padrão para publicadores sem grupo
      
      // PASSO CRÍTICO 2: Busca o nome do grupo antigo SE o ID existir (sem bloqueio)
      if (dadosAntigos.grupo_id) {
          const nomeGrupoRes = await client.query(
              'SELECT nome_grupo FROM grupos WHERE id = $1',
              [dadosAntigos.grupo_id]
          );
          if (nomeGrupoRes.rows.length > 0) {
              nomeGrupoAntigo = nomeGrupoRes.rows[0].nome_grupo;
          }
      }
      
      // Verifica se o grupo mudou antes de atualizar
      if (dadosAntigos.grupo_id !== grupo_id_destino) {
          
        // 2a. Atualiza o publicador
        await client.query(
          `UPDATE publicadores SET grupo_id = $1 WHERE id = $2`,
          [grupo_id_destino, publicadorId]
        );

        // 2b. Registra a mudança no histórico
        await client.query(
          `INSERT INTO publicador_historico 
           (publicador_id, campo_alterado, valor_antigo, valor_novo, data_mudanca) 
           VALUES ($1, $2, $3, $4, NOW())`,
          [publicadorId, 'nome_grupo', nomeGrupoAntigo, nome_grupo]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ 
        message: `${publicadorIds.length} publicador(es) movido(s) para o grupo ${nome_grupo}.` 
    }, { status: 200 });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro na transação de troca de grupo:', err);
    // Retorna a mensagem de erro padrão
    return NextResponse.json({ message: 'Erro interno ao processar a troca de grupo.' }, { status: 500 });
  } finally {
    client.release();
  }
}