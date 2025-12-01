// app/api/enviar-relatorio-mensal/route.js

import { Pool } from '@neondatabase/serverless'; 
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

function dmyToISO(dmy) {
  if (!dmy || String(dmy).length < 10) return null;
  const parts = String(dmy).split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (isNaN(day) || isNaN(month) || isNaN(year) || year < 1900 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeString(str) {
  if (!str) return '';
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

  const nomeCompletoNormalizado = normalizeString(nomeSujeito.trim()).toLowerCase(); 
  const isoDataNascimento = dmyToISO(data_nascimento); 
  const dmyDataNascimento = data_nascimento;           

  if (!isoDataNascimento) {
    return NextResponse.json({ message: 'Data inválida.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    // ---------------------------------------------------------
    // 1. BUSCA INTELIGENTE (Resolve o problema Terezinha/Fabrício)
    // ---------------------------------------------------------
    const candidatesRes = await client.query(
      `SELECT id, nome_completo, nome_chamado 
       FROM publicadores 
       WHERE data_nascimento::text = $1 OR data_nascimento::text = $2`,
      [isoDataNascimento, dmyDataNascimento]
    );

    let publicadorEncontrado = null;
    const termosDigitados = nomeCompletoNormalizado.split(/\s+/).filter(w => w.length > 1);

    if (candidatesRes.rows.length > 0) {
        const matches = candidatesRes.rows.filter(p => {
            const nomeBancoNorm = normalizeString(p.nome_completo).toLowerCase();
            const apelidoBancoNorm = normalizeString(p.nome_chamado || '').toLowerCase();
            return termosDigitados.every(termo => 
                nomeBancoNorm.includes(termo) || apelidoBancoNorm.includes(termo)
            );
        });

        if (matches.length === 1) publicadorEncontrado = matches[0];
        else if (matches.length > 1) return NextResponse.json({ message: 'Nome ambíguo. Digite o nome completo.' }, { status: 400 });
    }

    if (!publicadorEncontrado) {
      return NextResponse.json({ message: 'Dados não conferem. Verifique Nome e Data.' }, { status: 404 });
    }
    
    const publicador = publicadorEncontrado;

    // ---------------------------------------------------------
    // 2. VERIFICAÇÃO INTELIGENTE DE DUPLICIDADE
    // ---------------------------------------------------------
    
    // a) O usuário está enviando um relatório vazio (querendo anular)?
    const novosEstudos = parseInt(dadosDoRelatorio.estudos_biblicos) || 0;
    const novasHoras = parseInt(dadosDoRelatorio.horas) || 0;
    const isNovoRelatorioVazio = !dadosDoRelatorio.participou_ministerio &&
                                 !dadosDoRelatorio.pioneiro_auxiliar &&
                                 novosEstudos === 0 && novasHoras === 0;
    
    // b) O que já existe no banco?
    const existingReportRes = await client.query(
      `SELECT * FROM relatorios_mensais 
       WHERE publicador_id = $1 AND mes = $2 AND ano_servico = $3`,
      [publicador.id, mes, ano_servico]
    );

    // Se já existe, vamos analisar se é um relatório "Real" ou um "Fantasma/Vazio"
    let precisaBloquear = false;

    if (existingReportRes.rows.length > 0) {
        const relExistente = existingReportRes.rows[0];
        
        // Verifica se o registro existente tem dados relevantes
        const temDadosRelevantes = relExistente.participou_ministerio === true || 
                                   (relExistente.horas && relExistente.horas > 0) || 
                                   (relExistente.estudos_biblicos && relExistente.estudos_biblicos > 0);

        if (temDadosRelevantes) {
            // Se tem dados, BLOQUEIA (Protege o relatório preenchido)
            precisaBloquear = true;
        } else {
            // Se existe mas é "Não participou" e sem horas (como o de Dezembro no seu log),
            // PERMITE SOBRESCREVER. Removemos ele agora para inserir o novo limpo.
            await client.query(
                `DELETE FROM relatorios_mensais WHERE id = $1`,
                [relExistente.id]
            );
        }
    }

    if (isNovoRelatorioVazio) {
        // CASO A: ANULAÇÃO (Se o usuário enviou vazio, garantimos que foi deletado acima)
        // Se não existia, deletar não faz nada, tudo certo.
        return NextResponse.json({ message: 'Relatório anulado/limpo com sucesso.' }, { status: 200 });
        
    } else if (precisaBloquear) {
        // CASO B: BLOQUEIO (Tinha dados reais lá)
        return NextResponse.json(
            { message: `Erro! O relatório de ${mes}/${ano_servico} já consta preenchido no sistema.` },
            { status: 400 }
        );
        
    } else {
        // CASO C: INSERÇÃO (Caminho livre)
        // Aqui chegamos se não existia nada OU se existia apenas um registro vazio que deletamos acima.
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

        return NextResponse.json({ message: 'Relatório enviado com sucesso!' }, { status: 200 });
    }

  } catch (err) {
    console.error('Erro no envio:', err);
    return NextResponse.json({ message: 'Erro interno ao salvar.' }, { status: 500 });
  } finally {
    client.release();
  }
}