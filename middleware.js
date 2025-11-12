import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-de-teste-mude-depois';
export const runtime = 'nodejs';

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const tokenCookie = request.cookies.get('auth_token');

  let hasVerifiedToken = false;

  if (tokenCookie) {
    try {
      verify(tokenCookie.value, JWT_SECRET);
      hasVerifiedToken = true;
    } catch (err) {
      hasVerifiedToken = false;
    }
  }

  // --- MUDANÇA AQUI ---
  // Se a rota começar com /admin OU /api/admin...
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (!hasVerifiedToken) {
      // Se for uma API, retorna erro JSON. Se for uma página, redireciona.
      if (pathname.startsWith('/api/admin')) {
        return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
      }
      
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }
  // --- FIM DA MUDANÇA ---

  if (pathname === '/') {
    if (hasVerifiedToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/dashboard'; 
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/', 
    '/admin/:path*',
    '/api/admin/:path*' 
  ],
};