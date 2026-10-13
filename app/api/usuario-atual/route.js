import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserAccess } from '@/app/lib/server-access';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');

  if (!token) {
    return NextResponse.json({ message: 'NÃ£o autenticado' }, { status: 401 });
  }

  try {
    // Decodifica o token
    const decoded = verify(token.value, JWT_SECRET);
    
    const client = await pool.connect();
    try {
      const access = await getUserAccess(client, decoded.userId);
      
      if (!access) {
        return NextResponse.json({ message: 'UsuÃ¡rio nÃ£o encontrado' }, { status: 404 });
      }

      const user = access.user;
      const privilegios = Array.isArray(user.privilegios) ? user.privilegios : [];
      
      // Verifica privilÃ©gios
      const isAnciao = privilegios.includes('anciao');
      const isServo = privilegios.includes('servo_ministerial');

      const permissions = access?.permissions;

      return NextResponse.json({ 
        id: String(decoded.userId), // <--- FORÇA O ID COMO STRING
        nome_completo: user.nome_completo, 
        nome_chamado: user.nome_chamado,
        isAnciao: isAnciao,
        isServo: isServo,
        isSuperAdmin: access?.isSuperAdmin === true,
        permissions
      }, { status: 200 });

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro ao verificar token:', err);
    return NextResponse.json({ message: 'Token invÃ¡lido' }, { status: 401 });
  }
}
