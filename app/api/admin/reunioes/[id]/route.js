import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// GET: Get meeting details with assignments
export async function GET(request, { params }) {
    const { id } = await params;
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM reunioes_registro WHERE id = $1', [id]);
        if (res.rows.length === 0) {
            return NextResponse.json({ message: 'Reunião não encontrada' }, { status: 404 });
        }
        const meeting = res.rows[0];
        const dateStr = new Date(meeting.data).toISOString().split('T')[0];

        // 1. Privilégios mecânicos
        let privilegios = [];
        try {
            const privRes = await client.query(`
                SELECT pt.nome as tipo, COALESCE(p.nome_chamado, p.nome_completo) as nome
                FROM reunioes_privilegios rp
                JOIN privilegios_tipos pt ON rp.privilegio_tipo_id = pt.id
                JOIN publicadores p ON rp.publicador_id = p.id
                WHERE rp.reuniao_id = $1
                ORDER BY pt.ordem ASC, pt.nome ASC
            `, [id]);
            privilegios = privRes.rows;
        } catch (_) {}

        // Fallback para colunas legadas se reunioes_privilegios estiver vazio
        if (privilegios.length === 0) {
            const legacyCols = [
                { col: 'leitor_id', label: 'Leitor de A Sentinela' },
                { col: 'indicador_interno_id', label: 'Indicador Interno' },
                { col: 'indicador_externo_volante_id', label: 'Ind. Externo / Volante' },
                { col: 'indicador_externo_id', label: 'Indicador Externo' },
                { col: 'volante_id', label: 'Volante' },
                { col: 'anciao_apoio_id', label: 'Ancião de Apoio' }
            ];
            for (const item of legacyCols) {
                if (meeting[item.col]) {
                    try {
                        const pRes = await client.query('SELECT COALESCE(nome_chamado, nome_completo) as nome FROM publicadores WHERE id = $1', [meeting[item.col]]);
                        if (pRes.rows[0]?.nome) {
                            privilegios.push({ tipo: item.label, nome: pRes.rows[0].nome });
                        }
                    } catch (_) {}
                }
            }
        }

        // 2. Discurso Público da data ou da mesma semana (Fim de Semana)
        let discurso = null;
        try {
            const discRes = await client.query(`
                SELECT d.*, COALESCE(p.nome_chamado, p.nome_completo) as presidente_nome
                FROM discursos_publicos d
                LEFT JOIN publicadores p ON d.presidente_id = p.id
                WHERE d.data = $1
                   OR (d.data >= date_trunc('week', $1::date)::date 
                       AND d.data <= (date_trunc('week', $1::date) + interval '6 days')::date)
                ORDER BY d.data ASC
                LIMIT 1
            `, [dateStr]);
            if (discRes.rows.length > 0) {
                discurso = discRes.rows[0];
            }
        } catch (_) {}

        // 3. Designações da Reunião Vida e Ministério da data ou da mesma semana (Meio de Semana)
        let vidaMinisterio = [];
        try {
            const vmRes = await client.query(`
                SELECT d.nome_parte, COALESCE(p.nome_chamado, p.nome_completo) as nome_completo
                FROM designacoes_reuniao d
                JOIN publicadores p ON d.publicador_id = p.id
                WHERE d.data_reuniao = $1
                   OR (d.data_reuniao >= date_trunc('week', $1::date)::date 
                       AND d.data_reuniao <= (date_trunc('week', $1::date) + interval '6 days')::date)
                ORDER BY d.id ASC
            `, [dateStr]);
            vidaMinisterio = vmRes.rows;
        } catch (_) {}

        return NextResponse.json({
            ...meeting,
            data: dateStr,
            designacoes: {
                privilegios,
                discurso,
                vidaMinisterio
            }
        });
    } catch (error) {
        console.error('Error fetching meeting:', error);
        return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
    } finally {
        client.release();
    }
}

// PUT: Update meeting details (e.g., visitors)
export async function PUT(request, { params }) {
    const { id } = await params;
    const { visitantes } = await request.json();
    const client = await pool.connect();
    try {
        await client.query('UPDATE reunioes_registro SET visitantes = $1 WHERE id = $2', [visitantes, id]);
        return NextResponse.json({ message: 'Reunião atualizada com sucesso' });
    } catch (error) {
        console.error('Error updating meeting:', error);
        return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
    } finally {
        client.release();
    }
}
