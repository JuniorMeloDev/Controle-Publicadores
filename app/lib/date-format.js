const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

// Civil dates keep their calendar day. Instants (Date objects) use Brasília time.
export function formatDateBR(value, fallback = '—') {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'string') {
        const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|T| )/.exec(value);
        const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
        if (iso || br) {
            const [year, month, day] = iso ? iso.slice(1) : [br[3], br[2], br[1]];
            const civil = `${year}-${month}-${day}`;
            const parsed = new Date(`${civil}T12:00:00Z`);
            if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== civil) return fallback;
            return `${day}/${month}/${year}`;
        }
        return fallback;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return fallback;
    return new Intl.DateTimeFormat('pt-BR', { timeZone: BRAZIL_TIME_ZONE,
        day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function formatDateForFile(value = new Date(), fallback = 'sem-data') {
    return formatDateBR(value, fallback).replaceAll('/', '-');
}
