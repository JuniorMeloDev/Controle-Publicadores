import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { registerAuditLog } from '@/app/lib/audit-log';
import nodemailer from 'nodemailer';
import {
  generateMeetingHtml,
  getFriendlyTitleWithSection,
  normalizeText,
  formatName
} from '@/app/lib/meeting-email-template';

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


export async function POST(request) {
  const body = await request.json();
  const { recipientsList, weekText, schedule, assignments } = body;

  if (!recipientsList || !schedule || !assignments) {
    return NextResponse.json({ message: 'Dados incompletos.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    const userId = getUserIdFromRequest(request);
    const perms = await getUserPermissions(client, userId);
    if (!isAllowed(perms, 'designacoes_email', 'actions')) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }
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

    await registerAuditLog(client, {
      userId,
      action: 'emails_designacoes_enviados',
      entity: 'designacoes',
      details: { total: recipientsList.length, weekText }
    });

    return NextResponse.json({ message: 'Envio concluído.' }, { status: 200 });

  } catch (err) {
    console.error('Erro no envio em lote:', err);
    return NextResponse.json({ message: 'Erro ao processar envios.' }, { status: 500 });
  } finally {
    client.release();
  }
}

