import { authorizeRequest } from '@/app/lib/request-authorization';
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getSpecialParticipants } from '@/app/lib/special-participants';

export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function GET(request) {
    const denied = await authorizeRequest(request, 'GET');
    if (denied) return denied;
    const client = await pool.connect();
    try {
        return NextResponse.json(await getSpecialParticipants(client));
    } catch (error) {
        console.error('Erro ao buscar pessoas especiais:', error);
        return NextResponse.json({ message: 'Erro ao carregar pessoas especiais.' }, { status: 500 });
    } finally {
        client.release();
    }
}
