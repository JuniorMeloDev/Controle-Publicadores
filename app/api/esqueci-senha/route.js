import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { buildPasswordResetEmail } from '@/app/lib/password-reset-email';
import { RESET_MESSAGE, ensurePasswordResetTable, issuePasswordReset, hashResetToken } from '@/app/lib/password-reset';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export const runtime = 'nodejs';

export async function POST(request) {
  let client;
  let token;
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: 'Informe um e-mail válido.' }, { status: 400 });
    }
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) throw new Error('Email configuration missing');
    const origin = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
    if (!origin && process.env.NODE_ENV === 'production') throw new Error('APP_URL missing');
    const link = new URL('/redefinir-senha', origin || request.url);
    client = await pool.connect();
    await ensurePasswordResetTable(client);
    token = await issuePasswordReset(client, email);
    if (token) {
      link.searchParams.set('token', token);
      const userResult = await client.query(`SELECT p.nome_completo FROM publicadores p
        JOIN password_resets r ON r.publicador_id = p.id WHERE r.token_hash = $1`, [hashResetToken(token)]);
      const message = buildPasswordResetEmail({ name: userResult.rows[0]?.nome_completo, link: link.href });
      const transporter = nodemailer.createTransport({ service: 'gmail', auth: {
        user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS,
      } });
      await transporter.sendMail({
        from: { name: 'Praia dos Corais | Controle de Publicadores', address: process.env.EMAIL_USER }, to: email,
        ...message,
      });
    }
    return NextResponse.json({ message: RESET_MESSAGE });
  } catch {
    if (client && token) {
      await client.query('DELETE FROM password_resets WHERE token_hash = $1', [hashResetToken(token)]).catch(() => {});
    }
    console.error('Falha ao solicitar redefinição de senha.');
    return NextResponse.json({ message: 'Não foi possível enviar o link. Tente novamente mais tarde.' }, { status: 500 });
  } finally {
    client?.release();
  }
}
