import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      'SELECT id, nome_grupo, ativo FROM grupos ORDER BY nome_grupo ASC'
    );
    
    const grupos = res.rows.map(row => ({
      id: row.id,
      nome_grupo: row.nome_grupo,
      ativo: row.ativo !== false
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
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { action, nome_grupo, novo_nome, grupo_id, ativo } = body;

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
