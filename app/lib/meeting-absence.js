import { buildEmailHtml, brandEmailText, escapeEmailHtml } from './email-layout.js';

export function absenceMessage(meeting, absent) {
    const date = String(meeting.data).slice(0, 10).split('-').reverse().join('/');
    const subject = `Ausentes na reunião de ${date}`;
    const intro = `${meeting.tipo} — ${date}`;
    const note = 'Lista baseada na assistência registrada. Presença presencial e por Zoom são consideradas. Confira possíveis pendências no registro antes de entrar em contato.';
    const summary = absent.length ? `${absent.length} publicador(es) sem presença registrada:` : 'Todos os publicadores tiveram presença registrada.';
    return { subject,
        text: brandEmailText(`${intro}\n\n${summary}\n${absent.map(p => `${p.nome_completo} — ${p.nome_grupo || 'Sem grupo'}`).join('\n')}\n\n${note}`),
        html: buildEmailHtml({ subject, preheader: `${intro}: ${summary}`, label: 'ASSISTÊNCIA À REUNIÃO', title: 'Publicadores ausentes',
            content: `<p>${escapeEmailHtml(intro)}</p><p>${escapeEmailHtml(summary)}</p><ul>${absent.map(p => `<li>${escapeEmailHtml(p.nome_completo)} — ${escapeEmailHtml(p.nome_grupo || 'Sem grupo')}</li>`).join('')}</ul><p style="font-size:13px;color:#71717a">${escapeEmailHtml(note)}</p>` }),
    };
}
