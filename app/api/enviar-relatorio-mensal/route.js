// app/api/enviar-relatorio-mensal/route.js

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

// --- FUNÇÃO AUXILIAR DE NORMALIZAÇÃO (Remove acentos) ---
function normalizeString(str) {
  if (!str) return '';
  // 1. Normaliza para forma NFD (decomposição de caracteres)
  // 2. Remove todos os diacríticos (acentos) usando regex Unicode
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
// --- FIM DA FUNÇÃO DE NORMALIZAÇÃO ---


export async function POST(req) {
  const body = await req.json();
  
  const {
    nome_completo: nomeSujeito,
    data_nascimento, 
    mes,
    ano_servico,
    ...dadosDoRelatorio 
  } = body;

  // 1. LIMPEZA E NORMALIZAÇÃO DO NOME DO USUÁRIO
  const nomeCompletoLimpo = nomeSujeito.trim();
  const nomeCompletoNormalizado = normalizeString(nomeCompletoLimpo).toLowerCase(); 
  
  const isoDataNascimento = dmyToISO(data_nascimento); 
  const dmyDataNascimento = data_nascimento;           

  if (!isoDataNascimento) {
    console.error("[ERRO] Data de Nascimento inválida:", data_nascimento);
    return NextResponse.json(
      { message: 'Data de Nascimento está em formato inválido. Use dd/mm/aaaa.' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    
    // --- 1. LÓGICA ROBUSTA DE PESQUISA POR PALAVRAS ---
    const searchTerms = nomeCompletoNormalizado.split(/\s+/).filter(word => word.length >= 2); 
    
    if (searchTerms.length === 0) {
        return NextResponse.json(
            { message: 'Digite pelo menos a primeira parte do seu nome para a pesquisa.' },
            { status: 400 }
        );
    }
    
    const nameSearchConditions = searchTerms.map((_, index) => {
        const placeholderIndex = index + 3; 
        // Pesquisa ILIKE (case-insensitive) em Nome Completo ou Nome Chamado
        return `(p.nome_completo ILIKE $${placeholderIndex} OR COALESCE(p.nome_chamado, '') ILIKE $${placeholderIndex})`;
    }).join(' AND ');
    
    const searchValues = searchTerms.map(term => `%${term}%`);

    const publicadorRes = await client.query(
      `SELECT p.id 
       FROM publicadores p
       WHERE (p.data_nascimento = $1 OR p.data_nascimento = $2)
       AND ${nameSearchConditions}`,
      [
        isoDataNascimento,        // $1
        dmyDataNascimento,        // $2
        ...searchValues           // $3, $4, $5...
      ]
    );

    if (publicadorRes.rows.length === 0 || publicadorRes.rows.length > 1) {
      const message = publicadorRes.rows.length === 0
          ? 'Identificação falhou. Verifique se Nome e Data de Nascimento estão corretos.'
          : 'Identificação falhou. Mais de um publicador foi encontrado com esses dados. Por favor, digite seu nome mais completo.';
      return NextResponse.json({ message }, { status: publicadorRes.rows.length === 0 ? 404 : 400 });
    }
    
    const publicador = publicadorRes.rows[0];

    // --- 2. VERIFICAÇÃO DE STATUS DE RELATÓRIO ---
    
    // a) Checa se o relatório de entrada é VAZIO (anulação)
    const estudos = parseInt(dadosDoRelatorio.estudos_biblicos) || 0;
    const horas = parseInt(dadosDoRelatorio.horas) || 0;

    const relatorioVazio = !dadosDoRelatorio.participou_ministerio &&
                         !dadosDoRelatorio.pioneiro_auxiliar &&
                         estudos === 0 &&
                         horas === 0;
    
    // b) Checa se JÁ EXISTE um relatório para o período
    const existingReportRes = await client.query(
      `SELECT publicador_id
       FROM relatorios_mensais 
       WHERE publicador_id = $1 AND mes = $2 AND ano_servico = $3`,
      [publicador.id, mes, ano_servico]
    );
    const reportExists = existingReportRes.rows.length > 0;
    
    // --- 3. LÓGICA DE BLOQUEIO / INSERÇÃO / ANULAÇÃO ---

    if (relatorioVazio) {
        // CASO A: ANULAÇÃO (Relatório de entrada é vazio)
        const deleteRes = await client.query(
            `DELETE FROM relatorios_mensais 
             WHERE publicador_id = $1 AND mes = $2 AND ano_servico = $3`,
            [publicador.id, mes, ano_servico]
        );
        
        const message = deleteRes.rowCount > 0 ? 'Relatório anulado com sucesso.' : 'Nenhum relatório a ser anulado.';
        return NextResponse.json({ message }, { status: 200 });
        
    } else if (reportExists) {
        // CASO B: BLOQUEIO (Relatório de entrada NÃO é vazio E JÁ EXISTE)
        return NextResponse.json(
            { message: `Erro! Relatorio de ${mes} já enviado` },
            { status: 400 }
        );
        
    } else {
        // CASO C: INSERÇÃO (Relatório de entrada NÃO é vazio E NÃO EXISTE)
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
    }

  } catch (err) {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('!!! ERRO DURANTE A TRANSAÇÃO: ROLLBACK !!!', err);
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    return NextResponse.json(
      { message: 'Erro interno ao salvar/atualizar o relatório.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}