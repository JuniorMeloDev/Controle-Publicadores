
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function POST(request) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { 
        id, 
        leitor_id, 
        indicador_interno_id, 
        indicador_externo_volante_id, 
        indicador_externo_id, 
        volante_id, 
        anciao_apoio_id 
    } = body;
    
    if (!id) {
        return NextResponse.json({ message: 'ID da reunião é obrigatório.' }, { status: 400 });
    }

    // We assume columns already exist (migration was lazy in main route).
    // Just in case, this route assumes they exist. If they don't, main route usage usually triggers migration. 
    // Or we can add lazy migration here too, but it's duplicate.
    
    await client.query(`
        UPDATE reunioes_registro 
        SET 
            leitor_id = $1,
            indicador_interno_id = $2,
            indicador_externo_volante_id = $3,
            indicador_externo_id = $4,
            volante_id = $5,
            anciao_apoio_id = $6
        WHERE id = $7
    `, [leitor_id, indicador_interno_id, indicador_externo_volante_id, indicador_externo_id, volante_id, anciao_apoio_id, id]);

    return NextResponse.json({ message: 'Privilégios atualizados com sucesso.' }, { status: 200 });
  } catch (err) {
    console.error('Erro ao atualizar privilégios:', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  } finally {
    client.release();
  }
}
