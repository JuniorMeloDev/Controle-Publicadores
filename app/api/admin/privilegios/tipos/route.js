
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { registerAuditLog } from '@/app/lib/audit-log';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// GET: List all privilege types (ordered)
export async function GET() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM privilegios_tipos ORDER BY ordem ASC, nome ASC');
    return NextResponse.json(res.rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Erro ao buscar tipos' }, { status: 500 });
  } finally {
    client.release();
  }
}

// POST: Create or Update Privilege Type
export async function POST(request) {
  const client = await pool.connect();
  try {
    const userId = getUserIdFromRequest(request);
    const perms = await getUserPermissions(client, userId);
    if (!isAllowed(perms, 'privilegios_mecanicos_editar', 'actions')) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }
    const { id, nome, ativo } = await request.json();
    
    if (!nome) return NextResponse.json({ message: 'Nome obrigatÃ³rio' }, { status: 400 });

    if (id) {
        // Update
        await client.query(
            'UPDATE privilegios_tipos SET nome = $1, ativo = $2 WHERE id = $3',
            [nome, ativo !== undefined ? ativo : true, id]
        );
        await registerAuditLog(client, {
          userId,
          action: 'privilegio_tipo_atualizado',
          entity: 'privilegio_tipo',
          entityId: id,
          details: { nome, ativo: ativo !== undefined ? ativo : true }
        });
        return NextResponse.json({ message: 'Atualizado com sucesso' });
    } else {
        // Create - Find max order
        const maxOrder = await client.query('SELECT MAX(ordem) as max_ordem FROM privilegios_tipos');
        const nextOrder = (maxOrder.rows[0].max_ordem || 0) + 1;

        const res = await client.query(
            'INSERT INTO privilegios_tipos (nome, ativo, ordem) VALUES ($1, $2, $3) RETURNING *',
            [nome, true, nextOrder]
        );
        await registerAuditLog(client, {
          userId,
          action: 'privilegio_tipo_criado',
          entity: 'privilegio_tipo',
          entityId: res.rows[0]?.id,
          details: { nome, ativo: true }
        });
        return NextResponse.json(res.rows[0], { status: 201 });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Erro ao salvar' }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE: Remove a type
export async function DELETE(request) {
  const client = await pool.connect();
  try {
    const userId = getUserIdFromRequest(request);
    const perms = await getUserPermissions(client, userId);
    if (!isAllowed(perms, 'privilegios_mecanicos_editar', 'actions')) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        if(!id) return NextResponse.json({ message: 'ID missing' }, { status: 400 });

        await client.query('DELETE FROM privilegios_tipos WHERE id = $1', [id]);
        await registerAuditLog(client, {
            userId,
            action: 'privilegio_tipo_excluido',
            entity: 'privilegio_tipo',
            entityId: id
        });
        return NextResponse.json({ message: 'ExcluÃ­do' });
    } catch(err) {
        return NextResponse.json({ message: 'Erro ao excluir' }, { status: 500 });
    } finally {
        client.release();
    }
}
