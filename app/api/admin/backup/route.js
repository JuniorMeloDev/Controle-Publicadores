import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request) {
  const client = await pool.connect();
  try {
    const userId = getUserIdFromRequest(request);
    if (userId) {
      const perms = await getUserPermissions(client, userId);
      if (perms && !isAllowed(perms, 'configuracoes_editar', 'actions')) {
        return NextResponse.json({ message: 'Acesso negado para gerar backup.' }, { status: 403 });
      }
    }

    const backupData = {
      sistema: 'Controle-Publicadores',
      versao: '1.0',
      data_backup: new Date().toISOString(),
      timestamp: Date.now(),
      tabelas: {},
      resumo: {}
    };

    // Lista de tabelas a exportar com suas respectivas queries seguras
    const tabelas = [
      { nome: 'publicadores', query: 'SELECT * FROM publicadores ORDER BY id ASC' },
      { nome: 'grupos', query: 'SELECT * FROM grupos ORDER BY id ASC' },
      { nome: 'reunioes_registro', query: 'SELECT * FROM reunioes_registro ORDER BY data DESC' },
      { nome: 'assistencia_detalhe', query: 'SELECT * FROM assistencia_detalhe ORDER BY id ASC' },
      { nome: 'reunioes_privilegios', query: 'SELECT * FROM reunioes_privilegios ORDER BY id ASC' },
      { nome: 'privilegios_tipos', query: 'SELECT * FROM privilegios_tipos ORDER BY id ASC' },
      { nome: 'discursos_publicos', query: 'SELECT * FROM discursos_publicos ORDER BY data DESC' },
      { nome: 'temas_discursos', query: 'SELECT * FROM temas_discursos ORDER BY id ASC' },
      { nome: 'designacoes_reuniao', query: 'SELECT * FROM designacoes_reuniao ORDER BY id ASC' },
      { nome: 'reunioes_dados', query: 'SELECT * FROM reunioes_dados ORDER BY id ASC' },
      { nome: 'relatorios_mensais', query: 'SELECT * FROM relatorios_mensais ORDER BY id ASC' },
      { nome: 'configuracoes_gerais', query: 'SELECT * FROM configuracoes_gerais ORDER BY id ASC' },
      { nome: 'eventos_especiais', query: 'SELECT * FROM eventos_especiais ORDER BY id ASC' },
      { nome: 'historico_alteracoes', query: 'SELECT * FROM historico_alteracoes ORDER BY id DESC' }
    ];

    for (const tab of tabelas) {
      try {
        const res = await client.query(tab.query);
        let rows = res.rows;
        // Se for publicadores, remove campos de senha se existirem
        if (tab.nome === 'publicadores') {
          rows = rows.map(r => {
            const clean = { ...r };
            delete clean.senha;
            delete clean.password;
            return clean;
          });
        }
        backupData.tabelas[tab.nome] = rows;
        backupData.resumo[tab.nome] = rows.length;
      } catch (tabErr) {
        backupData.tabelas[tab.nome] = [];
        backupData.resumo[tab.nome] = 0;
      }
    }

    const agora = new Date();
    const dataFormatada = agora.toISOString().split('T')[0];
    const horaFormatada = agora.toTimeString().split(' ')[0].replace(/:/g, '');
    const filename = `backup_congregacao_${dataFormatada}_${horaFormatada}.json`;

    const jsonString = JSON.stringify(backupData, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error) {
    console.error('Erro ao gerar backup:', error);
    return NextResponse.json({ message: 'Erro ao gerar backup do banco de dados.' }, { status: 500 });
  } finally {
    client.release();
  }
}
