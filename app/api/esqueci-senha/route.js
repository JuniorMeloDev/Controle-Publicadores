import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
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
      const transporter = nodemailer.createTransport({ service: 'gmail', auth: {
        user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS,
      } });
      await transporter.sendMail({
        from: process.env.EMAIL_USER, to: email,
        subject: 'Redefinição de senha — Controle de Publicadores',
        text: `Para definir uma nova senha, acesse:\n${link.href}\n\nEste link expira em 30 minutos e só pode ser usado uma vez. Se você não solicitou esta alteração, ignore este e-mail.`,
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
