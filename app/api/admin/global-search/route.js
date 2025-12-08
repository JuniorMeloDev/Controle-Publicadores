import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const APP_PAGES = [
    { name: 'Visão Geral (Dashboard)', href: '/admin/dashboard', keywords: ['dashboard', 'home', 'inicio', 'painel'] },
    { name: 'Gerenciar Publicadores', href: '/admin/gerenciar', keywords: ['publicadores', 'cadastro', 'novo', 'pessoas'] },
    { name: 'Designações', href: '/admin/designacoes', keywords: ['designacoes', 'partes', 'reuniao', 'programa', 'vida e ministerio'] },
    { name: 'Reuniões', href: '/admin/reunioes', keywords: ['reunioes', 'atas', 'registros', 'frequencia'] },
    { name: 'Central de Relatórios', href: '/admin/relatorios', keywords: ['relatorios', 'imprimir', 'dados'] },
    { name: 'Análise de Campo', href: '/admin/relatorios/analise-campo', keywords: ['analise', 'campo', 'servico', 'horas', 'estudos', 'totais'] },
    { name: 'Cartão S-21', href: '/admin/relatorios/registro-publicador', keywords: ['s21', 'cartao', 'registro', 'historico'] },
];

// Helper to remove accents and lowercase
const normalizeStr = (str) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.length < 2) {
      return NextResponse.json({ publishers: [], pages: [] });
  }

  const term = normalizeStr(q);

  // 1. Filter Pages (Accent Insensitive)
  const matchedPages = APP_PAGES.filter(p => {
      const normName = normalizeStr(p.name);
      // Check name OR keywords
      if (normName.includes(term)) return true;
      if (p.keywords.some(k => normalizeStr(k).includes(term))) return true;
      return false;
  });

  const client = await pool.connect();
  try {
      // 2. Search Publishers (Accent Insensitive via JS)
      // Since dataset is small (<200), we fetch all names and filter in memory 
      // to avoid Postgres 'unaccent' extension dependency issues.
      const pubQuery = `
          SELECT id, nome_completo, grupo_id 
          FROM publicadores 
          ORDER BY nome_completo ASC
      `;
      const pubRes = await client.query(pubQuery);
      
      const matchedPublishers = pubRes.rows.filter(p => {
          const normName = normalizeStr(p.nome_completo);
          return normName.includes(term);
      }).slice(0, 5); // Limit to top 5

      return NextResponse.json({
          pages: matchedPages,
          publishers: matchedPublishers
      });

  } catch (err) {
      console.error('Search error:', err);
      return NextResponse.json({ message: 'Erro na busca' }, { status: 500 });
  } finally {
      client.release();
  }
}
