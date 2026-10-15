import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { Pool } from '@neondatabase/serverless';
import { getUserAccess } from '@/app/lib/server-access';
import { canAccessRoute } from '@/app/lib/route-access';

const JWT_SECRET = process.env.JWT_SECRET;
export const runtime = 'nodejs';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const protectedExtra = ['/api/recuperar-designacoes', '/api/enviar-relatorio-mensal/manual'].includes(pathname);
  const ownPages = pathname === '/relatorio-mensal';
  const personalPage = ['/admin/dashboard', '/admin/meus-dados', '/admin/minhas-designacoes', '/admin/meu-s21', '/admin/configuracoes/preferencias'].includes(pathname);
  const tokenCookie = request.cookies.get('auth_token');

  let hasVerifiedToken = false;
  let userId;

  if (tokenCookie) {
    try {
      const decoded = verify(tokenCookie.value, JWT_SECRET);
      userId = decoded.userId;
      hasVerifiedToken = Number.isInteger(userId) && userId > 0;
    } catch (err) {
      hasVerifiedToken = false;
    }
  }
  // API handlers authorize against the database themselves. Personal pages fetch only session-owned data.
  if (hasVerifiedToken && pathname.startsWith('/admin/') && !personalPage) {
    let client;
    try {
      client = await pool.connect();
      const access = await getUserAccess(client, userId);
      if (!access) {
        const response = NextResponse.redirect(new URL('/', request.url));
        response.cookies.delete('auth_token');
        return response;
      }
      if (!canAccessRoute(access, pathname, request.method)) {
        const url = request.nextUrl.clone();
        url.pathname = '/admin/dashboard'; url.search = '';
        return NextResponse.redirect(url);
      }
    } catch {
      return NextResponse.json({ message: 'Não foi possível verificar seu acesso.' }, { status: 503 });
    } finally { client?.release(); }
  }

  // --- MUDANÇA AQUI ---
  // Se a rota começar com /admin OU /api/admin...
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin') || protectedExtra || ownPages) {
    if (!hasVerifiedToken) {
      // Se for uma API, retorna erro JSON. Se for uma página, redireciona.
      if (pathname.startsWith('/api/')) {
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

  const response = NextResponse.next();
  if (pathname.startsWith('/api/')) response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: [
    '/', 
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/recuperar-designacoes',
    '/api/enviar-relatorio-mensal/manual'
    , '/relatorio-mensal', '/atualizacao-cadastral'
  ],
};
