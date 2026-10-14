import { authorizeRequest } from '@/app/lib/request-authorization';
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { ensureGroupLeadership } from '@/app/lib/field-group-server';
import { validateGroupLeadership } from '@/app/lib/field-group';
import { registerAuditLog } from '@/app/lib/audit-log';
import { getUserIdFromRequest } from '@/app/lib/server-access';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request) {
  const denied = await authorizeRequest(request, 'GET');
  if (denied) return denied;
  const client = await pool.connect();
  try {
    await ensureGroupLeadership(client);
    if (new URL(request.url).searchParams.get('leaders') === '1') {
      const candidates = await client.query(`SELECT id, COALESCE(NULLIF(TRIM(nome_chamado), ''), nome_completo) AS nome_completo,
        grupo_id, 'anciao' = ANY(privilegios) AS anciao
        FROM publicadores WHERE privilegios && ARRAY['anciao', 'servo_ministerial']::varchar[] ORDER BY nome_completo, id`);
      return NextResponse.json({ candidates: candidates.rows }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    const res = await client.query(
      `SELECT g.id, g.nome_grupo, g.ativo, g.superintendente_id, g.ajudante_id,
        COALESCE(NULLIF(TRIM(s.nome_chamado), ''), s.nome_completo) AS superintendente_nome,
        COALESCE(NULLIF(TRIM(a.nome_chamado), ''), a.nome_completo) AS ajudante_nome
        FROM grupos g LEFT JOIN publicadores s ON s.id = g.superintendente_id
        LEFT JOIN publicadores a ON a.id = g.ajudante_id ORDER BY g.nome_grupo`
    );
    
    const grupos = res.rows.map(row => ({
      id: row.id,
      nome_grupo: row.nome_grupo,
      ativo: row.ativo !== false, superintendente_id: row.superintendente_id, ajudante_id: row.ajudante_id,
      superintendente_nome: row.superintendente_nome, ajudante_nome: row.ajudante_nome,
    }));
    
    return NextResponse.json(grupos, { status: 200 });
  } catch (err) {
    console.error('Erro ao buscar grupos:', err);
    return NextResponse.json({ message: 'Erro ao buscar grupos.' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request) {
  const denied = await authorizeRequest(request, 'POST');
  if (denied) return denied;
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { action, nome_grupo, novo_nome, grupo_id, ativo } = body;

    if (action === 'leadership') {
      let selection;
      try { selection = validateGroupLeadership(body); } catch (error) { return NextResponse.json({ message: error.message }, { status: 400 }); }
      await ensureGroupLeadership(client);
      await client.query('BEGIN');
      try {
        const group = await client.query('SELECT id FROM grupos WHERE id = $1 FOR UPDATE', [selection.groupId]);
        if (!group.rows.length) { await client.query('ROLLBACK'); return NextResponse.json({ message: 'Grupo não encontrado.' }, { status: 404 }); }
        const chosen = [selection.superintendentId, selection.assistantId].filter(Boolean);
        const result = await client.query('SELECT id, grupo_id, privilegios FROM publicadores WHERE id = ANY($1::int[]) FOR SHARE', [chosen]);
        for (const [id, isSuper] of [[selection.superintendentId, true], [selection.assistantId, false]]) {
          if (!id) continue;
          const publisher = result.rows.find(row => row.id === id);
          const roles = publisher?.privilegios || [];
          if (!publisher || publisher.grupo_id !== selection.groupId || !(isSuper ? roles.includes('anciao') : roles.some(role => ['anciao', 'servo_ministerial'].includes(role)))) {
            await client.query('ROLLBACK'); return NextResponse.json({ message: 'Selecione responsáveis do próprio grupo: um ancião como superintendente e um ancião ou servo ministerial como ajudante.' }, { status: 400 });
          }
        }
        await client.query('UPDATE grupos SET superintendente_id = $2, ajudante_id = $3 WHERE id = $1', [selection.groupId, selection.superintendentId, selection.assistantId]);
        await registerAuditLog(client, { userId: getUserIdFromRequest(request), action: 'grupo_responsaveis_salvos', entity: 'grupo', entityId: selection.groupId, details: selection });
        await client.query('COMMIT');
        return NextResponse.json({ message: 'Responsáveis do grupo atualizados.' });
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }

    if (action === 'create') {
      if (!nome_grupo || nome_grupo.trim() === '') {
        return NextResponse.json(
          { message: 'O nome do grupo é obrigatório.' },
          { status: 400 }
        );
      }

      // Verifica se o grupo já existe
      const existe = await client.query(
        'SELECT id FROM grupos WHERE LOWER(nome_grupo) = LOWER($1)',
        [nome_grupo.trim()]
      );

      if (existe.rows.length > 0) {
        return NextResponse.json(
          { message: 'Já existe um grupo com este nome.' },
          { status: 400 }
        );
      }

      // Cria o novo grupo
      const res = await client.query(
        `INSERT INTO grupos (nome_grupo) VALUES ($1) RETURNING id, nome_grupo, COALESCE(ativo, TRUE) as ativo`,
        [nome_grupo.trim()]
      );

      return NextResponse.json(
        {
          message: 'Grupo criado com sucesso!',
          grupo: res.rows[0]
        },
        { status: 201 }
      );
    }

    if (action === 'rename') {
      if (!grupo_id || !novo_nome || novo_nome.trim() === '') {
        return NextResponse.json(
          { message: 'ID do grupo e novo nome são obrigatórios.' },
          { status: 400 }
        );
      }

      // Verifica se já existe um grupo com o novo nome
      const existe = await client.query(
        'SELECT id FROM grupos WHERE LOWER(nome_grupo) = LOWER($1) AND id != $2',
        [novo_nome.trim(), grupo_id]
      );

      if (existe.rows.length > 0) {
        return NextResponse.json(
          { message: 'Já existe um grupo com este nome.' },
          { status: 400 }
        );
      }

      // Atualiza o nome do grupo
      const res = await client.query(
        'UPDATE grupos SET nome_grupo = $1 WHERE id = $2 RETURNING id, nome_grupo, COALESCE(ativo, TRUE) as ativo',
        [novo_nome.trim(), grupo_id]
      );

      if (res.rows.length === 0) {
        return NextResponse.json(
          { message: 'Grupo não encontrado.' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          message: 'Grupo renomeado com sucesso!',
          grupo: res.rows[0]
        },
        { status: 200 }
      );
    }

    if (action === 'toggle') {
      if (!grupo_id || ativo === undefined) {
        return NextResponse.json(
          { message: 'ID do grupo e status são obrigatórios.' },
          { status: 400 }
        );
      }

      // Atualiza o status do grupo
      const res = await client.query(
        `UPDATE grupos SET ativo = $1 WHERE id = $2 RETURNING id, nome_grupo, COALESCE(ativo, TRUE) as ativo`,
        [ativo, grupo_id]
      );

      if (res.rows.length === 0) {
        return NextResponse.json(
          { message: 'Grupo não encontrado.' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          message: `Grupo ${ativo ? 'ativado' : 'desativado'} com sucesso!`,
          grupo: res.rows[0]
        },
        { status: 200 }
      );
    }

    if (action === 'delete') {
      if (!grupo_id) {
        return NextResponse.json(
          { message: 'ID do grupo é obrigatório.' },
          { status: 400 }
        );
      }

      // Verifica se há publicadores neste grupo
      const publicadores = await client.query(
        'SELECT COUNT(*) as count FROM publicadores WHERE grupo_id = $1',
        [grupo_id]
      );

      if (publicadores.rows[0].count > 0) {
        return NextResponse.json(
          {
            message: `Não é possível excluir este grupo. Existem ${publicadores.rows[0].count} publicador(es) associado(s).`
          },
          { status: 400 }
        );
      }

      // Deleta o grupo
      const res = await client.query(
        'DELETE FROM grupos WHERE id = $1 RETURNING id',
        [grupo_id]
      );

      if (res.rows.length === 0) {
        return NextResponse.json(
          { message: 'Grupo não encontrado.' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { message: 'Grupo excluído com sucesso!' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { message: 'Ação não reconhecida.' },
      { status: 400 }
    );
  } catch (err) {
    console.error('Erro ao gerenciar grupos:', err);
    return NextResponse.json(
      { message: 'Erro ao processar a solicitação.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
