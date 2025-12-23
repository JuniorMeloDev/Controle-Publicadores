import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Helper to reconstruct titles map (same as in saving logic)
function getPartTitlesMap(scheduleData) {
  const titles = {};

  // Standard parts
  titles['presidente'] = 'Presidente';
  titles['ajudante'] = 'Ajudante'; // If saved as Ajudante
  titles['oracao_inicial'] = 'Oração Inicial';
  titles['oracao_final'] = 'Oração Final';
  titles['comentarios_iniciais'] = scheduleData.openingComments || 'Comentários Iniciais';
  titles['comentarios_finais'] = scheduleData.finalComments || 'Comentários Finais';
  titles['cantico_meio'] = scheduleData.middleSong || 'Cântico do Meio';

  // Dynamic parts
  scheduleData.treasures?.forEach((part, index) => {
    titles[`tesouro_${index}`] = part.title;
  });
  
  scheduleData.ministry?.forEach((part, index) => {
    const isDiscurso = part.title.toLowerCase().includes('discurso');
    if (isDiscurso) {
      titles[`ministerio_${index}`] = part.title;
    } else {
      titles[`ministerio_${index}_1`] = part.title;
      titles[`ministerio_${index}_2`] = part.title; // Note: In DB we save the TITLE. 
      // If title is unique enough. 
      // Issue: Student and Assistant shares same Title?
      // In `salvar-designacoes`:
      // titles[`ministerio_${index}_1`] = part.title;
      // titles[`ministerio_${index}_2`] = part.title;
      // When saving, we loop assignments keys. 
      // If we have `ministerio_0_1` assigned to "Bob" -> we insert (Bob, meeting, "Some Title").
      // If we have `ministerio_0_2` assigned to "Alice" -> we insert (Alice, meeting, "Some Title").
      // DB has 2 entries for "Some Title".
      // When recovering, we get 2 entries for "Some Title".
      // How do we map back to _1 and _2?
      // We need to assume order or role. 
      // But DB `designacoes_reuniao` table structure: `publicador_id, data_reuniao, descricao_semana, nome_parte`.
      // It lacks "ROLE" or "SLOT".
      // However, `recuperar-designacoes` orders by ID ASC. 
      // If we inserted _1 then _2, the IDs should be sequential.
      // So first match is _1, second is _2.
    }
  });

  scheduleData.living?.forEach((part, index) => {
    const isBibleStudy = part.title.toLowerCase().includes('estudo bíblico');
    if (isBibleStudy) {
       titles[`vida_${index}_1`] = part.title; 
       titles[`vida_${index}_2`] = part.title; 
    } else {
       titles[`vida_${index}`] = part.title;
    }
  });

  return titles;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ message: 'Data inválida.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // 1. Fetch Schedule JSON
    const resData = await client.query('SELECT dados_json, descricao_texto FROM reunioes_dados WHERE data_reuniao = $1', [date]);
    if (resData.rows.length === 0) {
      return NextResponse.json({ message: 'Dados não encontrados.' }, { status: 404 });
    }
    const scheduleData = resData.rows[0].dados_json;
    const weekDescription = resData.rows[0].descricao_texto;

    // 2. Fetch Assignments
    const resAssign = await client.query(`
      SELECT d.nome_parte, p.nome_completo, p.nome_chamado
      FROM designacoes_reuniao d
      JOIN publicadores p ON d.publicador_id = p.id
      WHERE d.data_reuniao = $1
      ORDER BY d.id ASC
    `, [date]);

    // 3. Reconstruct Assignments Object
    const assignments = {};
    const titlesMap = getPartTitlesMap(scheduleData);
    
    // Reverse Map: Title -> [Keys]
    // Since multiple keys can have same title (student/assistant), we need a list.
    const titleToKeys = {};
    for (const [key, title] of Object.entries(titlesMap)) {
       if (!titleToKeys[title]) titleToKeys[title] = [];
       titleToKeys[title].push(key);
    }

    // Sort keys in titleToKeys to ensure _1 comes before _2?
    for(const title in titleToKeys) {
        titleToKeys[title].sort(); 
    }

    // Map fetched rows to keys
    const consumedCount = {}; 

    resAssign.rows.forEach(row => {
        const title = row.nome_parte; 
        // Prefer nome_chamado, fallback to nome_completo
        // Also handle "Ajudante" logic if needed, but for now just pass the name.
        const name = row.nome_chamado || row.nome_completo;
        
        if (titleToKeys[title]) {
            const possibleKeys = titleToKeys[title];
            const idx = consumedCount[title] || 0;
            
            if (idx < possibleKeys.length) {
                const targetKey = possibleKeys[idx];
                assignments[targetKey] = name;
                consumedCount[title] = idx + 1;
            }
        }
    });

    return NextResponse.json({
        schedule: scheduleData,
        assignments: assignments,
        weekDescription: weekDescription
    }, { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar detalhes da reunião:', err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
