import { load } from 'cheerio';
import { calendarWeekStart, addCalendarDays, isCalendarDate } from './meeting-calendar.js';

const ORIGIN = 'https://wol.jw.org';
const clean = text => text.replace(/\s+/g, ' ').trim();
const norm = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function weeklyAddress(date) {
    if (!isCalendarDate(date)) throw new Error('Data inválida.');
    const monday = calendarWeekStart(date);
    const thursday = new Date(`${addCalendarDays(monday, 3)}T00:00:00Z`);
    const year = thursday.getUTCFullYear();
    const first = calendarWeekStart(`${year}-01-04`);
    const week = Math.round((new Date(`${monday}T00:00:00Z`) - new Date(`${first}T00:00:00Z`)) / 604800000) + 1;
    return { monday, year, week, url: `${ORIGIN}/pt/wol/meetings/r5/lp-t/${year}/${week}` };
}

export function programLink(html) {
    const $ = load(html);
    const links = $('a[href]').toArray().filter(el => /apostila vida e minist[eé]rio/i.test(clean($(el).text())) && /\/pt\/wol\/d\/r5\/lp-t\/\d+/.test($(el).attr('href')));
    if (!links.length) throw new Error('A programação desta semana ainda não está disponível.');
    return new URL($(links[0]).attr('href'), ORIGIN).href;
}

export function parseWeeklyProgram(html, date) {
    const $ = load(html);
    const article = $('article.pub-mwb');
    article.find('.pageNum, .gen-field, script, style').remove();
    const heading = clean(article.find('h1').first().text());
    const monday = calendarWeekStart(date);
    const sunday = addCalendarDays(monday, 6);
    const range = heading.match(/^(\d{1,2})(?:\s+de\s+([\p{L}]+))?\s*[-–—]\s*(\d{1,2})\s+de\s+([\p{L}]+)/iu);
    const months = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    if (!range || Number(range[1]) !== Number(monday.slice(8)) || Number(range[3]) !== Number(sunday.slice(8)) ||
        norm(range[4]) !== months[Number(sunday.slice(5, 7)) - 1] ||
        (range[2] && norm(range[2]) !== months[Number(monday.slice(5, 7)) - 1])) {
        throw new Error('A página encontrada não corresponde à semana da reunião.');
    }
    const schedule = { weekDate: `${heading} DE ${sunday.slice(0, 4)}`, bibleReading: clean(article.find('header h2').text()),
        initialSong: '', openingComments: '', treasures: [], ministry: [], middleSong: '', living: [], finalSong: '', finalComments: '' };
    const blocks = article.find('h2, h3, p').toArray();
    let section = '';
    const numbers = [];
    for (let i = 0; i < blocks.length; i++) {
        const el = blocks[i];
        const text = clean($(el).text());
        const normalized = norm(text);
        if (el.tagName === 'h2') {
            if (normalized === 'tesouros da palavra de deus') section = 'treasures';
            else if (normalized === 'faca seu melhor no ministerio') section = 'ministry';
            else if (normalized === 'nossa vida crista') section = 'living';
        }
        if (el.tagName !== 'h3') continue;
        const song = text.match(/Cântico\s+\d+/i)?.[0];
        if (normalized.includes('comentarios iniciais')) {
            schedule.initialSong = song || '';
            schedule.openingComments = text.match(/Comentários iniciais\s*\(\d+\s*min\)/i)?.[0] || '';
        } else if (normalized.includes('comentarios finais')) {
            schedule.finalSong = song || '';
            schedule.finalComments = text.match(/Comentários finais\s*\(\d+\s*min\)/i)?.[0] || '';
        } else if (song && section === 'living') schedule.middleSong = song;
        const part = text.match(/^(\d+)\.\s*(.+)/);
        if (!part || !section) continue;
        const paragraphs = [];
        for (let j = i + 1; j < blocks.length && !/^h[23]$/.test(blocks[j].tagName); j++) paragraphs.push(clean($(blocks[j]).text()));
        const duration = paragraphs[0]?.match(/^\((\d+)\s*min\)/);
        if (!duration) throw new Error('Não foi possível reconhecer a duração de todas as partes.');
        const details = paragraphs.join(' ');
        schedule[section].push({ title: `${part[2]} ${details}`, duration: Number(duration[1]) });
        numbers.push(Number(part[1]));
    }
    if (!schedule.bibleReading || !schedule.initialSong || !schedule.middleSong || !schedule.finalSong ||
        !schedule.openingComments || !schedule.finalComments || schedule.treasures.length !== 3 ||
        !schedule.ministry.length || !schedule.living.length || numbers.some((n, i) => n !== i + 1)) {
        throw new Error('A estrutura da programação não foi reconhecida. Use a importação RTF ou tente novamente depois.');
    }
    return schedule;
}

async function fetchHtml(url, fetcher) {
    const parsed = new URL(url);
    if (parsed.origin !== ORIGIN || !parsed.pathname.startsWith('/pt/wol/')) throw new Error('Fonte inválida.');
    try {
        const response = await fetcher(url, { signal: AbortSignal.timeout(12000), redirect: 'error',
            headers: { Accept: 'text/html', 'Accept-Language': 'pt-BR' }, cache: 'no-store' });
        if (!response.ok) throw new Error('Não foi possível acessar a programação.');
        const html = await response.text();
        if (html.length > 2000000) throw new Error('A resposta da fonte é inválida.');
        return html;
    } catch {
        throw new Error('Não foi possível acessar a programação no jw.org. Tente novamente depois ou importe o RTF.');
    }
}

export async function fetchWeeklyProgram(date, fetcher = fetch) {
    const { url, monday } = weeklyAddress(date);
    const sourceUrl = programLink(await fetchHtml(url, fetcher));
    const schedule = parseWeeklyProgram(await fetchHtml(sourceUrl, fetcher), date);
    return { ...schedule, source: { provider: 'jw.org', url: sourceUrl, weekStart: monday, importedAt: new Date().toISOString() } };
}
