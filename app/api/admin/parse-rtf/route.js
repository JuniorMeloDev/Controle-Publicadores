import { NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { registerAuditLog } from '@/app/lib/audit-log';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

/**
 * Parser local 100% nativo (sem API externa).
 * Extrai programações da Apostila Vida e Ministério em milissegundos,
 * sem erros de quota (429), sem sobrecarga (503) e sem modelos que expiram.
 */
function parseRTFMeeting(rtf) {
  // 1. Decodificar caracteres Unicode e formatações básicas de RTF
  let text = rtf.replace(/\\u(-?\d+)\??/g, (_, code) => {
    let c = parseInt(code, 10);
    if (c < 0) c += 65536;
    return String.fromCharCode(c);
  });
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  text = text.replace(/\\(par|line)\b/g, '\n');
  text = text.replace(/\\(\*\/)?[a-zA-Z]+(-?\d+)? ?/g, '');
  text = text.replace(/[{}]/g, '');
  const lines = text.split('\n').map(l => l.trim().replace(/\s+/g, ' ')).filter(Boolean);

  let weekDate = '';
  let bibleReading = '';
  let initialSong = '';
  let openingComments = 'Comentários iniciais (1 min)';
  let middleSong = '';
  let finalSong = '';
  let finalComments = 'Comentários finais (3 min)';
  const treasures = [];
  const ministry = [];
  const living = [];

  const cleanLine = (str) => {
    return str
      .replace(/HYPERLINK\s*"[^"]*"/g, '')
      .replace(/[\\*_]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Extrair data da semana e leitura da Bíblia do cabeçalho
  for (const line of lines.slice(0, 15)) {
    const cleaned = cleanLine(line);
    const match = cleaned.match(/(\d{1,2}(?:\s+de\s+[a-zá-úãõ]+)?\s*(?:a|-)\s*\d{1,2}\s+de\s+[a-zá-úãõ]+)\s*\(([^)]+)\)/i);
    if (match) {
      weekDate = match[1].trim().toUpperCase();
      bibleReading = cleanLine(match[2]).trim().toUpperCase();
      break;
    }
  }

  let currentSection = 'start';

  for (let i = 0; i < lines.length; i++) {
    const line = cleanLine(lines[i]);

    // Cântico inicial
    if (/c[âa]ntico\s+\d+/i.test(line) && !initialSong && currentSection === 'start') {
      const m = line.match(/(c[âa]ntico\s+\d+)/i);
      if (m) initialSong = m[1].replace(/c[âa]ntico/i, 'Cântico');
    }

    // Seções
    if (/tesouros\s+da\s+palavra/i.test(line)) {
      currentSection = 'treasures';
      continue;
    }
    if (/fa[çc]a\s+seu\s+melhor\s+no\s+minist[ée]rio/i.test(line)) {
      currentSection = 'ministry';
      continue;
    }
    if (/nossa\s+vida\s+crist[ãa]/i.test(line)) {
      currentSection = 'living';
      continue;
    }

    // Cântico do meio
    if (currentSection === 'living' && !middleSong && /c[âa]ntico\s+\d+/i.test(line)) {
      const m = line.match(/(c[âa]ntico\s+\d+)/i);
      if (m) {
        middleSong = m[1].replace(/c[âa]ntico/i, 'Cântico');
        continue;
      }
    }

    // Partes numeradas (ex: 1. ..., 2. Joias..., 4. Iniciando conversas...)
    const partMatch = line.match(/^(\d+)\.\s*(.*?\((\d+)\s*min\).*)/i);
    if (partMatch) {
      let fullTitle = cleanLine(partMatch[2]);

      // Para partes do ministério, anexa a instrução da linha seguinte se existir
      if (currentSection === 'ministry' && lines[i + 1] && !lines[i + 1].match(/^\d+\./)) {
        let nextLine = cleanLine(lines[i + 1]);
        if (nextLine && !nextLine.toLowerCase().startsWith('cântico') && !nextLine.toLowerCase().startsWith('nossa vida')) {
          fullTitle += ` - ${nextLine}`;
        }
      }

      if (currentSection === 'treasures') {
        treasures.push({ title: fullTitle });
      } else if (currentSection === 'ministry') {
        ministry.push({ title: fullTitle });
      } else if (currentSection === 'living') {
        living.push({ title: fullTitle });
      }
    }

    // Comentários finais
    if (/coment[áa]rios\s+finais/i.test(line)) {
      finalComments = line;
    }

    // Cântico final
    if (currentSection === 'living' && middleSong && /c[âa]ntico\s+\d+/i.test(line)) {
      const m = line.match(/(c[âa]ntico\s+\d+)/i);
      if (m && m[1].toLowerCase() !== middleSong.toLowerCase() && m[1].toLowerCase() !== initialSong.toLowerCase()) {
        finalSong = m[1].replace(/c[âa]ntico/i, 'Cântico');
      }
    }
  }

  return {
    weekDate,
    bibleReading,
    initialSong,
    openingComments,
    treasures,
    ministry,
    middleSong,
    living,
    finalSong,
    finalComments
  };
}

// Rota POST
export async function POST(req) {
  const client = await pool.connect();
  try {
    const userId = getUserIdFromRequest(req);
    const perms = await getUserPermissions(client, userId);
    if (!isAllowed(perms, 'designacoes_importar', 'actions')) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { textContent } = await req.json();

    if (!textContent) {
      return NextResponse.json({ message: 'Nenhum conteúdo de texto fornecido.' }, { status: 400 });
    }

    const parsedData = parseRTFMeeting(textContent);
    const hasParts = (parsedData?.treasures?.length > 0) || (parsedData?.ministry?.length > 0) || (parsedData?.living?.length > 0);

    if (!parsedData?.weekDate || !hasParts) {
      return NextResponse.json(
        { message: 'Não foi possível identificar as partes da reunião no arquivo. Certifique-se de importar o arquivo de uma semana (ex: mwb_T_..._01.rtf).' },
        { status: 400 }
      );
    }

    await registerAuditLog(client, {
      userId,
      action: 'rtf_importado',
      entity: 'designacoes',
      details: { weekDate: parsedData.weekDate, method: 'local_parser' }
    });

    return NextResponse.json(parsedData, { status: 200 });

  } catch (error) {
    console.error('Erro na API /api/admin/parse-rtf:', error);
    return NextResponse.json({ message: error.message || 'Falha ao processar o arquivo no servidor.' }, { status: 500 });
  } finally {
    client.release();
  }
}
