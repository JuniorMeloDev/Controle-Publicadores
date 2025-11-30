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

// --- NOVO: FUNÇÃO AUXILIAR DE NORMALIZAÇÃO (Remove acentos) ---
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
    nome_completo: nomeSujeito, // Renomeia a variável localmente
    data_nascimento, 
    mes,
    ano_servico,
    ...dadosDoRelatorio 
  } = body;

  // 1. LIMPEZA E NORMALIZAÇÃO DO NOME DO USUÁRIO
  const nomeCompletoLimpo = nomeSujeito.trim(); // ✅ Remove espaços em branco
  const nomeCompletoNormalizado = normalizeString(nomeCompletoLimpo).toLowerCase(); // ✅ Remove acentos e padroniza para minúsculas
  
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
    
    // 1. Identificação do Publicador: Usa o termo normalizado na pesquisa
    // A função UNACCENT() é usada no SQL para permitir a busca insensível a acentos.
    const searchTermNormalizado = `%${nomeCompletoNormalizado}%`; 

    const publicadorRes = await client.query(
      `SELECT id FROM publicadores 
       WHERE (UNACCENT(nome_completo) ILIKE $1 OR UNACCENT(COALESCE(nome_chamado, '')) ILIKE $1)
       AND (data_nascimento = $2 OR data_nascimento = $3)`,
      [
        searchTermNormalizado,    // $1: Nome limpo, sem acentos e em minúsculas
        isoDataNascimento,        // $2: Data no formato ISO
        dmyDataNascimento,        // $3: Data no formato DD/MM/AAAA 
      ]
    );
    
    if (publicadorRes.rows.length === 0 || publicadorRes.rows.length > 1) {
      const message = publicadorRes.rows.length === 0
          ? 'Identificação falhou. Verifique se Nome e Data de Nascimento estão corretos.'
          : 'Identificação falhou. Mais de um publicador foi encontrado com esses dados. Por favor, digite seu nome mais completo.';
      return NextResponse.json({ message }, { status: publicadorRes.rows.length === 0 ? 404 : 400 });
    }
    
    const publicador = publicadorRes.rows[0];

    // 2. Lógica de Anulação/Exclusão (Ajustado para tratar strings vazias/nulls)
    const estudos = parseInt(dadosDoRelatorio.estudos_biblicos) || 0;
    const horas = parseInt(dadosDoRelatorio.horas) || 0;

    const relatorioVazio = !dadosDoRelatorio.participou_ministerio &&
                         !dadosDoRelatorio.pioneiro_auxiliar &&
                         estudos === 0 &&
                         horas === 0;

    if (relatorioVazio) {
        // Se o relatório está vazio, deletamos o registro existente para anular.
        const deleteRes = await client.query(
            `DELETE FROM relatorios_mensais 
             WHERE publicador_id = $1 AND mes = $2 AND ano_servico = $3`,
            [publicador.id, mes, ano_servico]
        );
        
        if (deleteRes.rowCount > 0) {
            return NextResponse.json({ message: 'Relatório anulado com sucesso.' }, { status: 200 });
        } else {
            return NextResponse.json({ message: 'Nenhum relatório a ser anulado.' }, { status: 200 });
        }
    }


    // 3. Lógica de Inserção/Atualização (UPSERT)
    await client.query(
      `INSERT INTO relatorios_mensais 
       (publicador_id, mes, ano_servico, participou_ministerio, pioneiro_auxiliar, estudos_biblicos, horas, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (publicador_id, mes, ano_servico) 
       DO UPDATE SET
           participou_ministerio = EXCLUDED.participou_ministerio,
           pioneiro_auxiliar = EXCLUDED.pioneiro_auxiliar,
           estudos_biblicos = EXCLUDED.estudos_biblicos,
           horas = EXCLUDED.horas,
           observacoes = EXCLUDED.observacoes`,
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
    console.error('Erro no banco de dados:', err);
    return NextResponse.json(
      { message: 'Erro interno ao salvar/atualizar o relatório.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}