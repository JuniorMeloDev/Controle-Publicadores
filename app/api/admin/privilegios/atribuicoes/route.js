
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { registerAuditLog } from '@/app/lib/audit-log';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// GET: Fetch assignments for a specific meeting
export async function GET(request) {
  const client = await pool.connect();
  const url = new URL(request.url);
  const meetingId = url.searchParams.get('reuniao_id');

  if (!meetingId) return NextResponse.json([], { status: 200 });

  try {
    const res = await client.query(`
        SELECT rp.*, pt.nome as privilegio_nome, p.nome_completo as publicador_nome
        FROM reunioes_privilegios rp
        JOIN privilegios_tipos pt ON rp.privilegio_tipo_id = pt.id
        LEFT JOIN publicadores p ON rp.publicador_id = p.id
        WHERE rp.reuniao_id = $1
    `, [meetingId]);
    
    // Transform to simple object map: { [privilegio_tipo_id]: publicador_id }
    // Or return list? List is better for detailed view.
    return NextResponse.json(res.rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Erro ao buscar atribuições' }, { status: 500 });
  } finally {
    client.release();
  }
}

// POST: Save Assignments (Batch)
export async function POST(request) {
  const client = await pool.connect();
  try {
    const userId = getUserIdFromRequest(request);
    const perms = await getUserPermissions(client, userId);
    if (!isAllowed(perms, 'privilegios_mecanicos_editar', 'actions')) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }
        const { reuniao_id, assignments } = await request.json(); // assignments: [{ tipo_id, publicador_id }]

        if (!reuniao_id) return NextResponse.json({ message: 'ID Reunião missing' }, { status: 400 });

        await client.query('BEGIN');

        // Clear existing for this meeting (or Upsert? Clear is simpler for full save)
        // But we might want to keep history? No, this is "current state" of the meeting.
        // We only delete assignments for types that are being updated? 
        // Or just wipe and recreate? Wipe and recreate is safest for a "Save Form" action.
        // But be careful not to delete things not in the payload if the payload is partial.
        // The UI will likely send ALL assignments.
        
        await client.query('DELETE FROM reunioes_privilegios WHERE reuniao_id = $1', [reuniao_id]);

        if (assignments && assignments.length > 0) {
            for (const a of assignments) {
                if (a.publicador_id) { // Only save if a publisher is selected
                    await client.query(`
                        INSERT INTO reunioes_privilegios (reuniao_id, privilegio_tipo_id, publicador_id)
                        VALUES ($1, $2, $3)
                    `, [reuniao_id, a.tipo_id, a.publicador_id]);
                }
            }
        }

        await client.query('COMMIT');
        await registerAuditLog(client, {
            userId,
            action: 'privilegios_atribuidos',
            entity: 'reuniao',
            entityId: reuniao_id,
            details: { total: assignments?.length || 0 }
        });
        return NextResponse.json({ message: 'Salvo com sucesso' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        return NextResponse.json({ message: 'Erro ao salvar' }, { status: 500 });
    } finally {
        client.release();
    }
}
