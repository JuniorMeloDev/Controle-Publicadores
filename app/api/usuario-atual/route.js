import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { buildAllPermissions, normalizePermissions } from '@/app/lib/access-control';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-de-teste-mude-depois';

export const dynamic = 'force-dynamic';

async function ensureAccessTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS acessos_app (
      publicador_id INTEGER PRIMARY KEY REFERENCES publicadores(id) ON DELETE CASCADE,
      permissoes JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

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
      const res = await client.query(
        'SELECT nome_completo, nome_chamado, privilegios FROM publicadores WHERE id = $1', 
        [decoded.userId]
      );
      
      if (res.rows.length === 0) {
        return NextResponse.json({ message: 'UsuÃ¡rio nÃ£o encontrado' }, { status: 404 });
      }

      const user = res.rows[0];
      const privilegios = Array.isArray(user.privilegios) ? user.privilegios : [];
      
      // Verifica privilÃ©gios
      const isAnciao = privilegios.includes('anciao');
      const isServo = privilegios.includes('servo_ministerial');

      await ensureAccessTable(client);
      const accessRes = await client.query(
        'SELECT permissoes FROM acessos_app WHERE publicador_id = $1',
        [decoded.userId]
      );

      const storedPerms = accessRes.rows[0]?.permissoes || null;
      const permissions = (isAnciao || isServo) ? buildAllPermissions() : normalizePermissions(storedPerms);

      return NextResponse.json({ 
        id: String(decoded.userId), // <--- FORÇA O ID COMO STRING
        nome_completo: user.nome_completo, 
        nome_chamado: user.nome_chamado,
        isAnciao: isAnciao,
        isServo: isServo,
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
