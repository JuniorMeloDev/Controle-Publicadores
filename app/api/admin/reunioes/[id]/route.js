import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// GET: Get meeting details
export async function GET(request, { params }) {
    const { id } = await params;
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM reunioes_registro WHERE id = $1', [id]);
        if (res.rows.length === 0) {
            return NextResponse.json({ message: 'Reunião não encontrada' }, { status: 404 });
        }
        return NextResponse.json(res.rows[0]);
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
