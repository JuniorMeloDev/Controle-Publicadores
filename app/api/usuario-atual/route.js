import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-de-teste-mude-depois';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');

  if (!token) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  try {
    // Decodifica o token
    const decoded = verify(token.value, JWT_SECRET);
    
    const client = await pool.connect();
    try {
      const res = await client.query(
        'SELECT nome_completo, nome_chamado, privilegios FROM publicadores WHERE id = $1', 
        [decoded.userId]
      );
      
      if (res.rows.length === 0) {
        return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });
      }

      const user = res.rows[0];
      const privilegios = Array.isArray(user.privilegios) ? user.privilegios : [];
      
      // Verifica privilégios
      const isAnciao = privilegios.includes('anciao');
      const isServo = privilegios.includes('servo_ministerial');

      return NextResponse.json({ 
        id: String(decoded.userId), // <--- FORÇA O ID COMO STRING
        nome_completo: user.nome_completo, 
        nome_chamado: user.nome_chamado,
        isAnciao: isAnciao,
        isServo: isServo 
      }, { status: 200 });

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro ao verificar token:', err);
    return NextResponse.json({ message: 'Token inválido' }, { status: 401 });
  }
}