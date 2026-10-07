export function isSuperintendentVisit(event) {
    return event.tipo === 'Visita do Superintendente';
}

export function getVisitTuesday(date) {
    const day = new Date(`${new Date(date).toISOString().slice(0, 10)}T00:00:00Z`);
    const daysSinceMonday = (day.getUTCDay() + 6) % 7;
    day.setUTCDate(day.getUTCDate() - daysSinceMonday + 1);
    return day.toISOString().slice(0, 10);
}

export function findVisitInWeek(events, date) {
    const tuesday = getVisitTuesday(date);
    return events.find(event =>
        isSuperintendentVisit(event) && getVisitTuesday(event.data) === tuesday
    );
}
