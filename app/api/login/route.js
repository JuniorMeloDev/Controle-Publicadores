import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs'; // Para comparar senhas
import jwt from 'jsonwebtoken'; // Para criar o token de sessão
import { serialize } from 'cookie'; // Para criar o cookie

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  // A configuração 'ssl' foi removida
});

// Uma "chave secreta" para assinar nosso token.
// Guarde isso no seu .env.local
const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-de-teste-mude-depois';

export async function POST(req) {
  const body = await req.json();
  const { nome_completo, senha } = body;

  const client = await pool.connect();

  try {
    // 1. Encontrar o usuário pelo nome
    const userRes = await client.query(
      'SELECT id, nome_completo, senha, privilegios FROM publicadores WHERE nome_completo = $1',
      [nome_completo]
    );
    const user = userRes.rows[0];

    // 2. Se o usuário não existe, ou não tem senha cadastrada
    if (!user || !user.senha) {
      return NextResponse.json({ message: 'Nome de usuário ou senha inválidos.' }, { status: 401 });
    }

    // 3. Verificar se a pessoa tem permissão (ex: é ancião ou SM)
    //    (Adapte essa lógica para seu caso)
    const isAdmin = user.privilegios?.includes('anciao') || user.privilegios?.includes('servo_ministerial');
    
    if (!isAdmin) {
        return NextResponse.json({ message: 'Você não tem permissão para acessar esta área.' }, { status: 403 }); // 403 Forbidden
    }

    // 4. Comparar a senha digitada com o "hash" salvo no banco
    const senhaCorreta = await bcrypt.compare(senha, user.senha);

    if (!senhaCorreta) {
      return NextResponse.json({ message: 'Nome de usuário ou senha inválidos.' }, { status: 401 });
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