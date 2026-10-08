'use client';

import { createContext, useContext, useState } from 'react';

const PeriodContext = createContext(null);

export function DesignationPeriodProvider({ children }) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const [month, setMonth] = useState(today.slice(5, 7));
    const [year, setYear] = useState(today.slice(0, 4));
    return <PeriodContext.Provider value={{ month, setMonth, year, setYear }}>{children}</PeriodContext.Provider>;
}

export function useDesignationPeriod() {
    return useContext(PeriodContext);
}
