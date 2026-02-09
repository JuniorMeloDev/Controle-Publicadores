import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { registerAuditLog } from '@/app/lib/audit-log';
import {
  generateMeetingHtml,
  getFriendlyTitleWithSection,
  getPartTitlesMap
} from '@/app/lib/meeting-email-template';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const CRON_SECRET = process.env.CRON_SECRET;
const TIMEZONE = 'America/Sao_Paulo';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const formatYMD = (date) => date.toISOString().slice(0, 10);

const parseYMD = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const addDays = (dateStr, days) => {
  const base = parseYMD(dateStr);
  base.setUTCDate(base.getUTCDate() + days);
  return formatYMD(base);
};

const getTodayInTZ = () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
};

const isAuthorized = (request) => {
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron) return true;
  if (!CRON_SECRET) return true;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const alt = request.headers.get('x-cron-secret') || '';
  if (token && token === CRON_SECRET) return true;
  if (alt && alt === CRON_SECRET) return true;
  return false;
};

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const todayStr = getTodayInTZ();
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS designacoes_envios (
        id SERIAL PRIMARY KEY,
        data_reuniao DATE NOT NULL,
        data_envio DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (data_reuniao, data_envio)
      );
    `);

    const meetingRes = await client.query(
      `
        SELECT data
        FROM reunioes_registro
        WHERE tipo = 'Meio de Semana' AND data >= $1
        ORDER BY data ASC
        LIMIT 1
      `,
      [todayStr]
    );

    if (meetingRes.rows.length === 0) {
      return NextResponse.json({ message: 'Nenhuma reunião encontrada.' }, { status: 200 });
    }

    const meetingDateObj = meetingRes.rows[0].data;
    const meetingDateStr = meetingDateObj instanceof Date ? formatYMD(meetingDateObj) : String(meetingDateObj);
    const twoDaysBeforeStr = addDays(meetingDateStr, -2);

    if (todayStr !== meetingDateStr && todayStr !== twoDaysBeforeStr) {
      return NextResponse.json({ message: 'Hoje não é dia de envio.' }, { status: 200 });
    }

    const alreadySent = await client.query(
      `
        INSERT INTO designacoes_envios (data_reuniao, data_envio)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        RETURNING id
      `,
      [meetingDateStr, todayStr]
    );

    if (alreadySent.rows.length === 0) {
      return NextResponse.json({ message: 'Envio já realizado hoje.' }, { status: 200 });
    }

    const scheduleRes = await client.query(
      'SELECT dados_json, descricao_texto FROM reunioes_dados WHERE data_reuniao = $1',
      [meetingDateStr]
    );

    if (scheduleRes.rows.length === 0) {
      return NextResponse.json({ message: 'Sem programação para esta reunião.' }, { status: 200 });
    }

    const scheduleData = scheduleRes.rows[0].dados_json;
    const weekText = scheduleRes.rows[0].descricao_texto || 'Semana';

    const assignRes = await client.query(
      `
        SELECT d.nome_parte, p.nome_completo, p.nome_chamado, p.email
        FROM designacoes_reuniao d
        JOIN publicadores p ON d.publicador_id = p.id
        WHERE d.data_reuniao = $1
        ORDER BY d.id ASC
      `,
      [meetingDateStr]
    );

    if (assignRes.rows.length === 0) {
      return NextResponse.json({ message: 'Sem designações para esta reunião.' }, { status: 200 });
    }

    const assignments = {};
    const titlesMap = getPartTitlesMap(scheduleData);
    const titleToKeys = {};
    Object.entries(titlesMap).forEach(([key, title]) => {
      if (!titleToKeys[title]) titleToKeys[title] = [];
      titleToKeys[title].push(key);
    });
    Object.keys(titleToKeys).forEach((title) => titleToKeys[title].sort());

    const consumed = {};
    assignRes.rows.forEach((row) => {
      const title = row.nome_parte;
      const name = row.nome_completo;
      if (!titleToKeys[title]) return;
      const idx = consumed[title] || 0;
      const keys = titleToKeys[title];
      if (idx < keys.length) {
        assignments[keys[idx]] = name;
        consumed[title] = idx + 1;
      }
    });

    const publicadoresRes = await client.query('SELECT nome_completo, nome_chamado, email FROM publicadores');
    const emailToPubMap = new Map();
    const nameFormattingMap = new Map();

    publicadoresRes.rows.forEach((p) => {
      if (p.email) emailToPubMap.set(p.email.toLowerCase().trim(), p);
      let formattedName = p.nome_chamado;
      if (!formattedName && p.nome_completo) {
        const parts = p.nome_completo.split(' ').filter(Boolean);
        formattedName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : p.nome_completo;
      }
      if (formattedName) {
        nameFormattingMap.set(p.nome_completo, formattedName);
      }
    });

    const recipientsList = Array.from(
      new Set(
        assignRes.rows
          .map((row) => (row.email ? row.email.toLowerCase().trim() : ''))
          .filter(Boolean)
      )
    );

    if (recipientsList.length === 0) {
      return NextResponse.json({ message: 'Nenhum destinatário com e-mail.' }, { status: 200 });
    }

    const tabelaHtml = generateMeetingHtml(weekText, scheduleData, assignments, nameFormattingMap);

    const emailPromises = recipientsList.map(async (email) => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) return;

      const publicador = emailToPubMap.get(cleanEmail);
      let personalBlock = '';

      if (publicador) {
        const nomeDoPublicador = publicador.nome_completo;
        const nomeCurto = publicador.nome_chamado || nomeDoPublicador.split(' ')[0];
        const isPresidente = assignments['presidente'] === nomeDoPublicador;

        const minhasPartes = Object.entries(assignments)
          .filter(([_, val]) => val === nomeDoPublicador)
          .filter(([key]) => {
            if (isPresidente) {
              return !['comentarios_iniciais', 'comentarios_finais', 'cantico_meio'].includes(key);
            }
            return true;
          })
          .map(([key]) => {
            const fullTitle = getFriendlyTitleWithSection(key, scheduleData);
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
      userId: null,
      action: 'emails_designacoes_enviados_auto',
      entity: 'designacoes',
      details: { total: recipientsList.length, weekText, data_reuniao: meetingDateStr, data_envio: todayStr }
    });

    return NextResponse.json({ message: 'Envio automático concluído.', total: recipientsList.length }, { status: 200 });
  } catch (err) {
    console.error('Erro no envio automático:', err);
    return NextResponse.json({ message: 'Erro ao processar envios.' }, { status: 500 });
  } finally {
    client.release();
  }
}
