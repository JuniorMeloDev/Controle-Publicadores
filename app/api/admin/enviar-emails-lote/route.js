import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// --- HELPER: Formata nome ---
function formatName(fullName, nameMap) {
  if (!fullName || fullName === '---') return '';
  if (nameMap.has(fullName)) return nameMap.get(fullName);
  const parts = fullName.split(' ').filter(Boolean);
  if (parts.length <= 1) return fullName;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

// --- HELPER: Gera a Tabela HTML ---
function generateMeetingHtml(weekText, schedule, assignments, nameMap) {
  // Estilos
  const sTable = 'width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 14px; border: 2px solid #000;';
  const sHeaderTitle = 'background-color: #f3f4f6; padding: 10px; text-align: center; border-right: 2px solid #000; width: 65%;';
  const sHeaderRoles = 'width: 35%; padding: 0; vertical-align: top;';
  const sHeaderRolesTitle = 'background-color: #e5e7eb; padding: 5px; font-weight: bold; text-align: center; border-bottom: 1px solid #000; font-size: 12px;';
  
  // ALTERAÇÃO: Fonte maior e negrito para os nomes no cabeçalho
  const sHeaderRoleLabel = 'padding: 4px 8px; font-size: 13px; font-weight: bold; width: 80px;';
  const sHeaderRoleValue = 'padding: 4px 8px; font-size: 13px; font-weight: bold;';
  
  const sSection = 'background-color: #1e3a8a; color: white; font-weight: bold; padding: 5px 10px; text-transform: uppercase; border: 1px solid #000; text-align: center;';
  const sTime = 'width: 60px; padding: 8px; border: 1px solid #000; background-color: #e5e7eb; text-align: center; font-weight: bold; color: #000;';
  const sPart = 'padding: 8px; border: 1px solid #000; color: #000;';
  const sName = 'width: 30%; padding: 8px; border: 1px solid #000; font-weight: bold; text-align: center; color: #000; vertical-align: middle;';

  const headerHtml = `
    <table style="width: 100%; border: 2px solid #000; border-bottom: none; border-collapse: collapse; font-family: Arial, sans-serif;">
      <tr>
        <td style="${sHeaderTitle}">
           <h2 style="margin:0; color:#1e3a8a; text-transform: uppercase;">${weekText}</h2>
           <p style="margin:5px 0 0; font-size: 16px;">Nossa Vida e Ministério Cristão</p>
        </td>
        <td style="${sHeaderRoles}">
           <div style="${sHeaderRolesTitle}">Salão Principal</div>
           <table style="width: 100%; border-collapse: collapse;">
             <tr>
               <td style="${sHeaderRoleLabel}">Presidente:</td>
               <td style="${sHeaderRoleValue}">${formatName(assignments['presidente'], nameMap)}</td>
             </tr>
             <tr>
               <td style="${sHeaderRoleLabel}">Ajudante:</td>
               <td style="${sHeaderRoleValue}">${formatName(assignments['ajudante'], nameMap)}</td>
             </tr>
           </table>
        </td>
      </tr>
    </table>
  `;

  let rows = '';

  // 1. Abertura
  rows += `
    <tr>
      <td style="${sTime}">19:30</td>
      <td style="${sPart}"><span style="color: #1e40af; font-weight: bold;">${schedule.initialSong}</span> <span style="float: right;">Oração Inicial &rarr;</span></td>
      <td style="${sName}">${formatName(assignments['oracao_inicial'], nameMap)}</td>
    </tr>
    <tr>
      <td style="${sTime}">19:35</td>
      <td style="${sPart}"><strong>${schedule.openingComments || 'Comentários Iniciais'}</strong></td>
      <td style="${sName}">${formatName(assignments['comentarios_iniciais'], nameMap)}</td>
    </tr>
  `;

  // 2. Tesouros
  rows += `<tr><td colspan="3" style="${sSection}">TESOUROS DA PALAVRA DE DEUS</td></tr>`;
  schedule.treasures?.forEach((part, idx) => {
    rows += `<tr><td style="${sTime}"></td><td style="${sPart}">${part.title}</td><td style="${sName}">${formatName(assignments[`tesouro_${idx}`], nameMap)}</td></tr>`;
  });

  // 3. Ministério
  rows += `<tr><td colspan="3" style="${sSection}">FAÇA SEU MELHOR NO MINISTÉRIO</td></tr>`;
  schedule.ministry?.forEach((part, idx) => {
    const isDiscurso = part.title.toLowerCase().includes('discurso');
    let assignedHtml = '';
    if (isDiscurso) {
      assignedHtml = formatName(assignments[`ministerio_${idx}`], nameMap);
    } else {
      const est = formatName(assignments[`ministerio_${idx}_1`], nameMap);
      const aju = formatName(assignments[`ministerio_${idx}_2`], nameMap);
      if (aju && aju !== '---' && aju !== '') {
          assignedHtml = `<div>${est}</div><div style="border-top: 1px dashed #9ca3af; margin-top: 4px; padding-top: 4px;">${aju}</div>`;
      } else {
          assignedHtml = est;
      }
    }
    rows += `<tr><td style="${sTime}"></td><td style="${sPart}">${part.title}</td><td style="${sName}">${assignedHtml}</td></tr>`;
  });

  // 4. Vida Cristã
  rows += `<tr><td colspan="3" style="${sSection}">NOSSA VIDA CRISTÃ</td></tr>`;
  rows += `<tr><td style="${sTime}"></td><td style="${sPart}"><span style="color: #1e40af; font-weight: bold;">${schedule.middleSong || 'Cântico'}</span></td><td style="${sName}">${formatName(assignments['cantico_meio'], nameMap)}</td></tr>`;

  schedule.living?.forEach((part, idx) => {
    const isBibleStudy = part.title.toLowerCase().includes('estudo bíblico');
    let assignedHtml = '';
    if (isBibleStudy) {
      const dirig = formatName(assignments[`vida_${idx}_1`], nameMap);
      const leitor = formatName(assignments[`vida_${idx}_2`], nameMap);
      assignedHtml = `<div>${dirig}</div><div style="border-top: 1px dashed #9ca3af; margin-top: 4px; padding-top: 4px;">${leitor}</div>`;
    } else {
      assignedHtml = formatName(assignments[`vida_${idx}`], nameMap);
    }
    rows += `<tr><td style="${sTime}"></td><td style="${sPart}">${part.title}</td><td style="${sName}">${assignedHtml}</td></tr>`;
  });

  // 5. Encerramento
  rows += `
    <tr>
      <td style="${sTime}">20:50</td>
      <td style="${sPart}"><strong>${schedule.finalComments || 'Comentários Finais'}</strong></td>
      <td style="${sName}">${formatName(assignments['comentarios_finais'], nameMap)}</td>
    </tr>
    <tr>
      <td style="${sTime}">21:00</td>
      <td style="${sPart}"><span style="color: #1e40af; font-weight: bold;">${schedule.finalSong}</span> <span style="float: right;">Oração Final &rarr;</span></td>
      <td style="${sName}">${formatName(assignments['oracao_final'], nameMap)}</td>
    </tr>
  `;

  return `
    ${headerHtml}
    <table style="${sTable}">
      <tbody>${rows}</tbody>
    </table>
  `;
}

function getFriendlyTitleWithSection(key, schedule) {
  if (key === 'presidente') return 'Presidente';
  if (key === 'ajudante') return 'Ajudante';
  if (key === 'oracao_inicial') return 'REUNIÃO - Oração Inicial';
  if (key === 'oracao_final') return 'REUNIÃO - Oração Final';
  if (key === 'comentarios_iniciais') return 'REUNIÃO - Comentários Iniciais';
  if (key === 'comentarios_finais') return 'REUNIÃO - Comentários Finais';
  if (key === 'cantico_meio') return 'NOSSA VIDA CRISTÃ - Cântico do Meio';

  if (key.startsWith('tesouro_')) {
    const idx = parseInt(key.split('_')[1]);
    const title = schedule.treasures[idx]?.title || 'Parte';
    return `TESOUROS DA PALAVRA DE DEUS - ${title}`;
  }
  if (key.startsWith('ministerio_')) {
    const parts = key.split('_');
    const idx = parseInt(parts[1]);
    const suffix = parts[2];
    const baseTitle = schedule.ministry[idx]?.title || 'Parte';
    const role = suffix === '1' ? ' (Estudante)' : (suffix === '2' ? ' (Ajudante)' : '');
    return `FAÇA SEU MELHOR NO MINISTÉRIO - ${baseTitle}${role}`;
  }
  if (key.startsWith('vida_')) {
    const parts = key.split('_');
    const idx = parseInt(parts[1]);
    const suffix = parts[2];
    const baseTitle = schedule.living[idx]?.title || 'Parte';
    if (baseTitle.toLowerCase().includes('estudo bíblico')) {
        const role = suffix === '1' ? ' (Dirigente)' : ' (Leitor)';
        return `NOSSA VIDA CRISTÃ - ${baseTitle}${role}`;
    }
    return `NOSSA VIDA CRISTÃ - ${baseTitle}`;
  }
  return key;
}

export async function POST(request) {
  const body = await request.json();
  const { recipientsList, weekText, schedule, assignments } = body;

  if (!recipientsList || !schedule || !assignments) {
    return NextResponse.json({ message: 'Dados incompletos.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    const pubRes = await client.query('SELECT nome_completo, nome_chamado, email FROM publicadores');
    const emailToPubMap = new Map();
    const nameFormattingMap = new Map();

    pubRes.rows.forEach(p => {
        if(p.email) emailToPubMap.set(p.email.toLowerCase().trim(), p);
        
        let formattedName = p.nome_chamado;
        if (!formattedName && p.nome_completo) {
            const parts = p.nome_completo.split(' ').filter(Boolean);
            formattedName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : p.nome_completo;
        }
        if (formattedName) {
            nameFormattingMap.set(p.nome_completo, formattedName);
        }
    });

    const tabelaHtml = generateMeetingHtml(weekText, schedule, assignments, nameFormattingMap);

    const emailPromises = recipientsList.map(async (email) => {
        const cleanEmail = email.trim().toLowerCase();
        if(!cleanEmail) return;

        const publicador = emailToPubMap.get(cleanEmail);
        let personalBlock = '';
        
        if (publicador) {
            const nomeDoPublicador = publicador.nome_completo;
            const nomeCurto = publicador.nome_chamado || nomeDoPublicador.split(' ')[0];

            // --- ALTERAÇÃO: FILTRO INTELIGENTE DE PARTES ---
            // Verifica se o publicador é o presidente nesta semana
            const isPresidente = assignments['presidente'] === nomeDoPublicador;

            const minhasPartes = Object.entries(assignments)
                .filter(([key, val]) => val === nomeDoPublicador)
                .filter(([key]) => {
                    // SE FOR PRESIDENTE, EXCLUI AS PARTES IMPLÍCITAS DO RESUMO
                    if (isPresidente) {
                        return !['comentarios_iniciais', 'comentarios_finais', 'cantico_meio'].includes(key);
                    }
                    return true;
                })
                .map(([key, val]) => {
                    const fullTitle = getFriendlyTitleWithSection(key, schedule);
                    const [secao, ...resto] = fullTitle.split(' - ');
                    const tituloParte = resto.join(' - ');

                    return `<li style="margin-bottom: 8px;">
                              <span style="font-weight: bold; color: #1e3a8a; font-size: 13px;">${secao}</span><br/>
                              <span style="color: #333; font-weight: normal;">${tituloParte}</span>
                            </li>`;
                })
                .join('');

            if (minhasPartes) {
                personalBlock = `
                    <div style="background-color: #eef2ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #c7d2fe;">
                        <h2 style="color: #3730a3; margin-top: 0;">Olá, ${nomeCurto}!</h2>
                        <p style="font-size: 16px;">Suas designações para a semana de <strong>${weekText}</strong>:</p>
                        <ul style="list-style-type: none; padding-left: 0;">
                            ${minhasPartes}
                        </ul>
                    </div>
                `;
            } else {
                // Caso raro: tem email cadastrado, estava na lista, mas não tem partes (ou foi filtrado)
                 personalBlock = `
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
                        <p style="margin: 0; font-size: 14px;">Olá <strong>${nomeCurto}</strong>, segue a programação da semana.</p>
                    </div>
                `;
            }
        } else {
            personalBlock = `
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 14px;">Segue a programação da reunião desta semana.</p>
                </div>
            `;
        }

        const htmlBody = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto;">
                ${personalBlock}
                <p style="font-size: 14px; margin-bottom: 10px; font-weight: bold;">Programação completa:</p>
                ${tabelaHtml}
                <p style="font-size: 11px; color: #888; text-align: center; margin-top: 20px;">
                    Gerado automaticamente pelo Sistema de Gestão Congregacional.
                </p>
            </div>
        `;

        return transporter.sendMail({
            from: `"Gestão Congregacional" <${process.env.EMAIL_USER}>`,
            to: cleanEmail,
            subject: `Designações: ${weekText}`,
            html: htmlBody,
        });
    });

    await Promise.allSettled(emailPromises);

    return NextResponse.json({ message: 'Envio concluído.' }, { status: 200 });

  } catch (err) {
    console.error('Erro no envio em lote:', err);
    return NextResponse.json({ message: 'Erro ao processar envios.' }, { status: 500 });
  } finally {
    client.release();
  }
}