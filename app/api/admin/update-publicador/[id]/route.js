import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// --- FUNÇÕES AUXILIARES DE DATA ---
function dmyToISO(dmy) {
  if (!dmy || String(dmy).length < 10) return null;
  const parts = String(dmy).split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (isNaN(day) || isNaN(month) || isNaN(year) || year < 1900 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateToISO(date) {
    if (!date) return null;
    try {
        const d = new Date(date);
        const dLocal = new Date(d.valueOf() + d.getTimezoneOffset() * 60000);
        return dLocal.toISOString().split('T')[0];
    } catch(e) {
        return null;
    }
}
// --- FIM DAS FUNÇÕES DE DATA ---


/**
 * Função auxiliar para registrar uma mudança no histórico.
 */
async function registrarHistorico(client, publicadorId, campo, valorAntigo, valorNovo) {
  const vAntigo = Array.isArray(valorAntigo) ? valorAntigo.join(', ') : valorAntigo;
  const vNovo = Array.isArray(valorNovo) ? valorNovo.join(', ') : valorNovo;

  if (String(vAntigo || '') === String(vNovo || '')) {
    return;
  }
  
  await client.query(
    `INSERT INTO publicador_historico 
     (publicador_id, campo_alterado, valor_antigo, valor_novo, data_mudanca) 
     VALUES ($1, $2, $3, $4, NOW())`,
    [publicadorId, campo, vAntigo, vNovo]
  );
}

// Rota: PUT /api/admin/update-publicador/123
export async function PUT(request, context) {
  const { id } = await context.params; 
  const body = await request.json();   


  const { 
    nome_completo, nome_chamado, // <-- RECEBENDO NOVO CAMPO
    data_nascimento, data_batismo, nome_grupo, senha, 
    privilegios, designacoes, telefone, email, cep, 
    logradouro, numero, complemento, bairro, cidade, estado,
    sexo, esperanca
  } = body;

  if (!id || !nome_completo || !data_nascimento || !nome_grupo || !sexo) {
    console.error("[ERRO] Validação principal falhou.");
    return NextResponse.json({ message: 'ID, Nome, Data de Nascimento, Sexo e Grupo são obrigatórios.' }, { status: 400 });
  }

  const isoDataNascimento = dmyToISO(data_nascimento);
  const isoDataBatismo = dmyToISO(data_batismo); 

  if (!isoDataNascimento) {
     console.error("[ERRO] Data de Nascimento inválida.");
     return NextResponse.json({ message: 'Data de Nascimento está em formato inválido. Use dd/mm/aaaa.' }, { status: 400 });
  }
  if (data_batismo && !isoDataBatismo) {
     console.error("[ERRO] Data de Batismo inválida.");
     return NextResponse.json({ message: 'Data de Batismo está em formato inválido. Use dd/mm/aaaa.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const grupoRes = await client.query('SELECT id FROM grupos WHERE nome_grupo = $1', [nome_grupo]);
    if (grupoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      console.error(`[ERRO] Grupo '${nome_grupo}' não encontrado.`);
      return NextResponse.json({ message: 'Grupo não encontrado.' }, { status: 404 });
    }
    const grupo_id = grupoRes.rows[0].id;

    // Buscando dados antigos APENAS da tabela publicadores (evita o erro FOR UPDATE no LEFT JOIN)
    const dadosAntigosRes = await client.query(
      `SELECT * FROM publicadores WHERE id = $1 FOR UPDATE`,
      [id]
    );
    
    if (dadosAntigosRes.rows.length === 0) {
      await client.query('ROLLBACK');
      console.error(`[ERRO] Publicador ID ${id} não encontrado no DB.`);
      return NextResponse.json({ message: 'Publicador não encontrado para atualizar.' }, { status: 404 });
    }
    
    const dadosAntigos = dadosAntigosRes.rows[0];
    
    // Buscamos o nome do grupo antigo separadamente
    let nomeGrupoAntigo = null;
    if (dadosAntigos.grupo_id) {
        const grupoAntigoRes = await client.query(
            'SELECT nome_grupo FROM grupos WHERE id = $1',
            [dadosAntigos.grupo_id]
        );
        if (grupoAntigoRes.rows.length > 0) {
            nomeGrupoAntigo = grupoAntigoRes.rows[0].nome_grupo;
        }
    }
    dadosAntigos.nome_grupo_antigo = nomeGrupoAntigo;
       
    // Datas
    const isoDataNascimentoAntiga = dateToISO(dadosAntigos.data_nascimento);
    const isoDataBatismoAntigo = dateToISO(dadosAntigos.data_batismo);
    if (isoDataNascimentoAntiga !== isoDataNascimento) await registrarHistorico(client, id, 'data_nascimento', isoDataNascimentoAntiga, isoDataNascimento);
    if (isoDataBatismoAntigo !== isoDataBatismo) await registrarHistorico(client, id, 'data_batismo', isoDataBatismoAntigo, isoDataBatismo);
    
    // Campos Pessoais
    if (dadosAntigos.nome_completo !== nome_completo) await registrarHistorico(client, id, 'nome_completo', dadosAntigos.nome_completo, nome_completo);
    if (dadosAntigos.nome_chamado !== (nome_chamado || null)) await registrarHistorico(client, id, 'nome_chamado', dadosAntigos.nome_chamado, nome_chamado); // <-- NOVO LOG
    if (dadosAntigos.sexo !== sexo) await registrarHistorico(client, id, 'sexo', dadosAntigos.sexo, sexo);
    if (dadosAntigos.esperanca !== (esperanca || null)) await registrarHistorico(client, id, 'esperanca', dadosAntigos.esperanca, esperanca);
    if (dadosAntigos.nome_grupo_antigo !== nome_grupo) await registrarHistorico(client, id, 'nome_grupo', dadosAntigos.nome_grupo_antigo, nome_grupo);
    
    // Contato e Endereço
    if (dadosAntigos.telefone !== (telefone || null)) await registrarHistorico(client, id, 'telefone', dadosAntigos.telefone, telefone);
    if (dadosAntigos.email !== (email || null)) await registrarHistorico(client, id, 'email', dadosAntigos.email, email);
    if (dadosAntigos.cep !== (cep || null)) await registrarHistorico(client, id, 'cep', dadosAntigos.cep, cep);
    if (dadosAntigos.logradouro !== (logradouro || null)) await registrarHistorico(client, id, 'logradouro', dadosAntigos.logradouro, logradouro);
    if (dadosAntigos.numero !== (numero || null)) await registrarHistorico(client, id, 'numero', dadosAntigos.numero, numero);
    if (dadosAntigos.complemento !== (complemento || null)) await registrarHistorico(client, id, 'complemento', dadosAntigos.complemento, complemento);
    if (dadosAntigos.bairro !== (bairro || null)) await registrarHistorico(client, id, 'bairro', dadosAntigos.bairro, bairro);
    if (dadosAntigos.cidade !== (cidade || null)) await registrarHistorico(client, id, 'cidade', dadosAntigos.cidade, cidade);
    if (dadosAntigos.estado !== (estado || null)) await registrarHistorico(client, id, 'estado', dadosAntigos.estado, estado);

    // Privilégios e Designações
    const finalPrivilegios = privilegios.length > 0 ? privilegios : null;
    const finalDesignacoes = designacoes.length > 0 ? designacoes : null;
    if (String(dadosAntigos.privilegios || '') !== String(finalPrivilegios || '')) await registrarHistorico(client, id, 'privilegios', dadosAntigos.privilegios, finalPrivilegios);
    if (String(dadosAntigos.designacoes || '') !== String(finalDesignacoes || '')) await registrarHistorico(client, id, 'designacoes', dadosAntigos.designacoes, finalDesignacoes);

    let hashSenha = null;
    if (senha && senha.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      hashSenha = await bcrypt.hash(senha, salt);
      await registrarHistorico(client, id, 'senha', '********', '********');
    }
    
    // --- QUERY UPDATE ATUALIZADA (20 PARÂMETROS) ---
    await client.query(
      `UPDATE publicadores
       SET 
         nome_completo = $1, data_nascimento = $2, data_batismo = $3, grupo_id = $4, 
         privilegios = $5, designacoes = $6, telefone = $7, email = $8,
         cep = $9, logradouro = $10, numero = $11, complemento = $12,
         bairro = $13, cidade = $14, estado = $15,
         sexo = $16, esperanca = $17,
         senha = COALESCE($18, senha),
         nome_chamado = $19  -- <-- NOVO CAMPO
       WHERE id = $20`,
      [
        nome_completo, isoDataNascimento, isoDataBatismo, grupo_id,
        finalPrivilegios, finalDesignacoes, telefone || null, email || null,
        cep || null, logradouro || null, numero || null, complemento || null,
        bairro || null, cidade || null, estado || null,
        sexo, esperanca || null,
        hashSenha, // $18
        nome_chamado || null, // $19
        id // $20
      ]
    );
    
    await client.query('COMMIT');
    
    return NextResponse.json({ message: 'Publicador atualizado com sucesso!' }, { status: 200 });
  
  } catch (err) {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('!!! ERRO DURANTE A TRANSAÇÃO: ROLLBACK !!!', err);
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    await client.query('ROLLBACK');

    if (err.code === '23505') {
      return NextResponse.json({ message: 'Outro publicador já existe com este Nome Completo.' }, { status: 409 });
    }
    if (err.code === '23514') {
      return NextResponse.json({ message: `Valor inválido para Sexo ou Esperança. Verifique os dados.` }, { status: 400 });
    }
    console.error('Erro detalhado ao atualizar publicador:', err);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  } finally {
    client.release();
  }
}