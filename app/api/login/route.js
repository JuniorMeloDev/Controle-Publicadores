// app/api/login/route.js

import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs'; // Para comparar senhas
import jwt from 'jsonwebtoken'; // Para criar o token de sessão
import { serialize } from 'cookie'; // Para criar o cookie
import { normalizePermissions } from '@/app/lib/access-control';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  // A configuração 'ssl' foi removida
});

// Uma "chave secreta" para assinar nosso token.
// Guarde isso no seu .env.local
const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-de-teste-mude-depois';

async function ensureAccessTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS acessos_app (
      publicador_id INTEGER PRIMARY KEY REFERENCES publicadores(id) ON DELETE CASCADE,
      permissoes JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function POST(req) {
  const body = await req.json();
  const { email, senha } = body; // ALTERADO: nome_completo para email

  const client = await pool.connect();

  try {
    // 1. Encontrar o usuário pelo email
    const userRes = await client.query(
      'SELECT id, nome_completo, senha, privilegios FROM publicadores WHERE email = $1', // ALTERADO: WHERE nome_completo = $1 para WHERE email = $1
      [email] // ALTERADO: nome_completo para email
    );
    const user = userRes.rows[0];

    // 2. Se o usuário não existe, ou não tem senha cadastrada
    if (!user || !user.senha) {
      return NextResponse.json({ message: 'Email ou senha inválidos.' }, { status: 401 }); // ALTERADO: Mensagem
    }

    // 3. Verificar se a pessoa tem permissão (ex: é ancião ou SM)
    //    (Adapte essa lógica para seu caso)
    const isAdmin = user.privilegios?.includes('anciao') || user.privilegios?.includes('servo_ministerial');
    
    if (!isAdmin) {
        await ensureAccessTable(client);
        const accessRes = await client.query(
          'SELECT permissoes FROM acessos_app WHERE publicador_id = $1',
          [user.id]
        );
        const storedPerms = accessRes.rows[0]?.permissoes ?? null;

        // Se há um registro em acessos_app, verifica se tem ao menos uma página liberada.
        // Se NÃO há registro (null), não bloqueia — ausência de restrições = acesso total.
        if (storedPerms !== null) {
          const perms = normalizePermissions(storedPerms);
          const hasAnyPageAccess = Object.values(perms.pages || {}).some(Boolean);
          if (!hasAnyPageAccess) {
            return NextResponse.json({ message: 'Você não tem permissão para acessar esta área.' }, { status: 403 });
          }
        }
    }

    // 4. Comparar a senha digitada com o "hash" salvo no banco
    const senhaCorreta = await bcrypt.compare(senha, user.senha);

    if (!senhaCorreta) {
      return NextResponse.json({ message: 'Email ou senha inválidos.' }, { status: 401 }); // ALTERADO: Mensagem
    }

    // 5. LOGIN BEM-SUCEDIDO! Criar a sessão.
    // Criamos um "token" (um crachá digital)
    const token = jwt.sign(
      { userId: user.id, nome: user.nome_completo }, // O que guardamos no crachá
      JWT_SECRET,
      { expiresIn: '1h' } // Crachá expira em 1 hora
    );

    // 6. Colocamos esse crachá em um "cookie" seguro
    const cookie = serialize('auth_token', token, {
      httpOnly: true, // O JavaScript do navegador não pode ver
      secure: process.env.NODE_ENV === 'production', // Só enviar em HTTPS
      maxAge: 60 * 60, // 1 hora
      path: '/', // Válido para o site inteiro
      sameSite: 'strict',
    });

    // 7. Envia a resposta de sucesso com o cookie no cabeçalho
    return NextResponse.json({ message: 'Login bem-sucedido!' }, {
      status: 200,
      headers: { 'Set-Cookie': cookie }
    });

  } catch (err) {
    console.error('Erro no login:', err);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  } finally {
    client.release();
  }
}
