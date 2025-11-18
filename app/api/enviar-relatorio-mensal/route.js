import { Pool } from '@neondatabase/serverless'; 
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// --- FUNÇÃO AUXILIAR DE DATA ---
function dmyToISO(dmy) {
  if (!dmy || String(dmy).length < 10) return null;
  const parts = String(dmy).split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (isNaN(day) || isNaN(month) || isNaN(year) || year < 1900 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
// --- FIM DA FUNÇÃO DE DATA ---

export async function POST(req) {
  const body = await req.json();
  
  const {
    nome_completo,
    data_nascimento, // <-- Vem como 'dd/mm/aaaa'
    nome_grupo,
    mes,
    ano_servico,
    ...dadosDoRelatorio 
  } = body;

  // --- CORREÇÃO: Vamos preparar AMBOS os formatos de data ---
  const isoDataNascimento = dmyToISO(data_nascimento); // Formato 'YYYY-MM-DD'
  const dmyDataNascimento = data_nascimento;           // Formato 'DD/MM/YYYY'

  if (!isoDataNascimento) {
    console.error("[ERRO] Data de Nascimento inválida:", data_nascimento);
    return NextResponse.json(
      { message: 'Data de Nascimento está em formato inválido. Use dd/mm/aaaa.' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    const grupoRes = await client.query(
      'SELECT id FROM grupos WHERE nome_grupo = $1',
      [nome_grupo]
    );
    const grupo = grupoRes.rows[0];

    if (!grupo) {
      console.error("[ERRO] Grupo não encontrado:", nome_grupo);
      return NextResponse.json(
        { message: 'Grupo de Campo não encontrado. Verifique o nome digitado.' },
        { status: 404 }
      );
    }
    
    // --- MUDANÇA NA QUERY SQL ---
    // Agora verifica os dois formatos de data
    const publicadorRes = await client.query(
      `SELECT id FROM publicadores 
       WHERE nome_completo ILIKE $1 
       AND (data_nascimento = $2 OR data_nascimento = $3)
       AND grupo_id = $4`,
      [
        `%${nome_completo}%`, // $1
        isoDataNascimento,      // $2 ('YYYY-MM-DD')
        dmyDataNascimento,      // $3 ('DD/MM/YYYY')
        grupo.id                // $4
      ]
    );
    // --- FIM DA MUDANÇA ---
    
   

    if (publicadorRes.rows.length === 0) {
      return NextResponse.json(
        { message: 'Identificação falhou. Verifique se Nome, Data de Nascimento ou Grupo estão corretos.' },
        { status: 404 }
      );
    }
    
    if (publicadorRes.rows.length > 1) {
      console.warn("[AVISO] Busca ambígua. Múltiplos publicadores encontrados.");
      return NextResponse.json(
        { message: 'Identificação falhou. Mais de um publicador foi encontrado com esses dados. Por favor, digite seu nome mais completo.' },
        { status: 400 }
      );
    }
    
    const publicador = publicadorRes.rows[0];

    await client.query(
      `INSERT INTO relatorios_mensais 
       (publicador_id, mes, ano_servico, participou_ministerio, pioneiro_auxiliar, estudos_biblicos, horas, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        publicador.id,
        mes,
        ano_servico,
        dadosDoRelatorio.participou_ministerio,
        dadosDoRelatorio.pioneiro_auxiliar,
        dadosDoRelatorio.estudos_biblicos || null,
        dadosDoRelatorio.horas || null,
        dadosDoRelatorio.observacoes || null
      ]
    );

    return NextResponse.json(
      { message: 'Relatório enviado com sucesso!' },
      { status: 200 }
    );

  } catch (err) {
    if (err.code === '23505') {
      console.warn("[AVISO] Conflito (23505): Relatório duplicado.");
      return NextResponse.json(
        { message: `O relatório de ${mes} já foi enviado.` },
        { status: 409 }
      );
    }
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('!!! ERRO FATAL NA API DE RELATÓRIO:', err);
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    return NextResponse.json(
      { message: 'Erro interno ao salvar o relatório.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}