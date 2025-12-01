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

// --- FUNÇÃO AUXILIAR DE NORMALIZAÇÃO (Remove acentos) ---
function normalizeString(str) {
  if (!str) return '';
  // 1. Normaliza para forma NFD (decomposição de caracteres)
  // 2. Remove todos os diacríticos (acentos) usando regex Unicode
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

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
    return NextResponse.json(
      { message: 'Data de Nascimento está em formato inválido. Use dd/mm/aaaa.' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    
    // =================================================================================
    // 1. BUSCA INTELIGENTE (Correção de Acentos)
    // =================================================================================
    
    // Passo A: Busca TODOS os publicadores que nasceram nessa data.
    // Usamos ::text para garantir que o banco compare como string (YYYY-MM-DD), evitando erros de tipo.
    const candidatesRes = await client.query(
      `SELECT id, nome_completo, nome_chamado 
       FROM publicadores 
       WHERE data_nascimento::text = $1 OR data_nascimento::text = $2`,
      [isoDataNascimento, dmyDataNascimento]
    );

    // Passo B: Filtra no JavaScript (onde conseguimos ignorar acentos perfeitamente)
    let publicadorEncontrado = null;
    
    // Quebra o nome digitado em palavras (ex: "terezinha", "fabricio", "araujo")
    const termosDigitados = nomeCompletoNormalizado.split(/\s+/).filter(w => w.length > 1);

    if (candidatesRes.rows.length > 0) {
        // Procura dentro dos candidatos da data correta
        const matches = candidatesRes.rows.filter(p => {
            // Normaliza o nome que veio do BANCO DE DADOS (remove acentos dele também)
            // Verifica tanto no Nome Completo quanto no Nome Chamado (Apelido)
            const nomeBancoNorm = normalizeString(p.nome_completo).toLowerCase();
            const apelidoBancoNorm = normalizeString(p.nome_chamado || '').toLowerCase();
            
            // Verifica se TODAS as partes digitadas existem no nome ou no apelido
            // Ex: Se digitou "terezinha fabricio", ambas palavras devem estar no cadastro
            return termosDigitados.every(termo => 
                nomeBancoNorm.includes(termo) || apelidoBancoNorm.includes(termo)
            );
        });

        if (matches.length === 1) {
            publicadorEncontrado = matches[0];
        } else if (matches.length > 1) {
            return NextResponse.json(
                { message: 'Encontramos mais de uma pessoa com esse nome e data. Por favor, digite o nome completo exato.' },
                { status: 400 }
            );
        }
    }

    if (!publicadorEncontrado) {
      return NextResponse.json(
        { message: 'Dados não conferem. Verifique se a Data de Nascimento está igual ao cadastro.' },
        { status: 404 }
      );
    }
    
    const publicador = publicadorEncontrado;

    // =================================================================================
    // 2. VERIFICAÇÃO E SALVAMENTO DO RELATÓRIO
    // =================================================================================
    
    // a) Checa se o relatório de entrada é VAZIO (pedido de anulação)
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
    
    if (relatorioVazio) {
        // CASO A: ANULAÇÃO (O usuário enviou um relatório vazio para apagar o anterior)
        const deleteRes = await client.query(
            `DELETE FROM relatorios_mensais 
             WHERE publicador_id = $1 AND mes = $2 AND ano_servico = $3`,
            [publicador.id, mes, ano_servico]
        );
        
        const message = deleteRes.rowCount > 0 ? 'Relatório anulado com sucesso.' : 'Nenhum relatório a ser anulado.';
        return NextResponse.json({ message }, { status: 200 });
        
    } else if (reportExists) {
        // CASO B: BLOQUEIO (Já enviou e tentou enviar de novo com dados)
        return NextResponse.json(
            { message: `Erro! Relatorio de ${mes} já enviado.` },
            { status: 400 }
        );
        
    } else {
        // CASO C: INSERÇÃO (Novo relatório)
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
    console.error('Erro ao processar relatório:', err);
    return NextResponse.json(
      { message: 'Erro interno ao salvar/atualizar o relatório.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}