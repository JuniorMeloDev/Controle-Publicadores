import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { registerAuditLog } from '@/app/lib/audit-log';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function ensureTables(client) {
    // Tabela para dias de reunião (Uma linha por ano)
    await client.query(`
        CREATE TABLE IF NOT EXISTS configuracoes_gerais (
            ano INTEGER PRIMARY KEY,
            dia_meio_semana VARCHAR(20),
            dia_fim_semana VARCHAR(20),
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Tabela para eventos especiais
    await client.query(`
        CREATE TABLE IF NOT EXISTS eventos_especiais (
            id SERIAL PRIMARY KEY,
            data DATE NOT NULL,
            nome VARCHAR(255) NOT NULL,
            tipo VARCHAR(50) NOT NULL, -- 'Assembleia', 'Congresso', 'Visita', 'Feriado', 'Outro'
            ano INTEGER NOT NULL,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || new Date().getFullYear();

  const client = await pool.connect();
  try {
    await ensureTables(client);

    // Buscar configurações do ano
    const configRes = await client.query('SELECT * FROM configuracoes_gerais WHERE ano = $1', [year]);

    // Buscar eventos do ano
    const eventsRes = await client.query('SELECT * FROM eventos_especiais WHERE ano = $1 ORDER BY data ASC', [year]);

    return NextResponse.json({
        config: configRes.rows[0] || { dia_meio_semana: '', dia_fim_semana: '' },
        events: eventsRes.rows
    });

  } catch (err) {
    console.error('Erro ao buscar configurações:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request) {
    const client = await pool.connect();
    try {
        const userId = getUserIdFromRequest(request);
        const perms = await getUserPermissions(client, userId);
        if (!isAllowed(perms, 'configuracoes_editar', 'actions')) {
            return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
        }

        const body = await request.json();
        const { action } = body; // 'save_weekdays' or 'add_event' or 'delete_event'

        await ensureTables(client);

        if (action === 'save_weekdays') {
            const { ano, dia_meio_semana, dia_fim_semana } = body;
            // Upsert configuration
            await client.query(`
                INSERT INTO configuracoes_gerais (ano, dia_meio_semana, dia_fim_semana)
                VALUES ($1, $2, $3)
                ON CONFLICT (ano) DO UPDATE 
                SET dia_meio_semana = EXCLUDED.dia_meio_semana,
                    dia_fim_semana = EXCLUDED.dia_fim_semana
            `, [ano, dia_meio_semana, dia_fim_semana]);
            
            await registerAuditLog(client, {
                userId,
                action: 'configuracoes_dias_salvos',
                entity: 'configuracoes',
                entityId: ano,
                details: { dia_meio_semana, dia_fim_semana }
            });
            return NextResponse.json({ message: 'Dias salvos com sucesso' });
        }

        if (action === 'add_event') {
            const { data, nome, tipo, ano } = body;
            const res = await client.query(`
                INSERT INTO eventos_especiais (data, nome, tipo, ano)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [data, nome, tipo, ano]);
            await registerAuditLog(client, {
                userId,
                action: 'configuracoes_evento_criado',
                entity: 'evento',
                entityId: res.rows[0]?.id,
                details: { data, nome, tipo, ano }
            });
            return NextResponse.json(res.rows[0]);
        }

        if (action === 'delete_event') {
            const { id } = body;
            await client.query('DELETE FROM eventos_especiais WHERE id = $1', [id]);
            await registerAuditLog(client, {
                userId,
                action: 'configuracoes_evento_excluido',
                entity: 'evento',
                entityId: id
            });
            return NextResponse.json({ message: 'Evento removido' });
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

    } catch (err) {
        console.error('Erro ao salvar configurações:', err);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    } finally {
        client.release();
    }
}
