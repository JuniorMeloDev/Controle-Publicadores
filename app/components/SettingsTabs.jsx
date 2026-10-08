'use client';

import { createContext, useContext, useRef, useSyncExternalStore } from 'react';
import { Bell, Calendar, Database, Users } from 'lucide-react';

const sections = [
    { value: 'reunioes', label: 'Reuniões e eventos', shortLabel: 'Reuniões', icon: Calendar },
    { value: 'grupos', label: 'Grupos', icon: Users },
    { value: 'alertas', label: 'Alertas', icon: Bell },
    { value: 'backup', label: 'Backup', icon: Database },
];
const SettingsTabContext = createContext('reunioes');
const getActiveTab = () => {
    const value = window.location.hash.slice(1);
    return sections.some(section => section.value === value) ? value : 'reunioes';
};
const subscribe = callback => {
    window.addEventListener('hashchange', callback);
    window.addEventListener('popstate', callback);
    return () => {
        window.removeEventListener('hashchange', callback);
        window.removeEventListener('popstate', callback);
    };
};

export function SettingsTabs({ children }) {
    const activeTab = useSyncExternalStore(subscribe, getActiveTab, () => 'reunioes');
    const buttons = useRef([]);
    const select = value => {
        window.history.replaceState(window.history.state, '', `#${value}`);
        window.dispatchEvent(new Event('hashchange'));
    };
    function navigate(event, index) {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % sections.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + sections.length) % sections.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = sections.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        select(sections[next].value);
        buttons.current[next]?.focus();
    }

    return <SettingsTabContext.Provider value={activeTab}>
        <div className="min-w-0 space-y-3">
            <div role="tablist" aria-label="Seções de configurações" className="grid grid-cols-2 lg:grid-cols-4 gap-1 rounded-xl bg-gray-100/80 p-1">
                {sections.map(({ value, label, shortLabel, icon: Icon }, index) => <button
                    key={value} ref={element => { buttons.current[index] = element; }} type="button"
                    role="tab" id={`settings-tab-${value}`} aria-controls={`settings-panel-${value}`}
                    aria-selected={activeTab === value} aria-label={label} tabIndex={activeTab === value ? 0 : -1}
                    onClick={() => select(value)} onKeyDown={event => navigate(event, index)}
                    className={`flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2 ${activeTab === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'}`}
                >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {shortLabel ? <><span className="sm:hidden">{shortLabel}</span><span className="hidden sm:inline">{label}</span></> : <span>{label}</span>}
                </button>)}
            </div>
            {children}
        </div>
    </SettingsTabContext.Provider>;
}

export function SettingsPanel({ value, className = 'space-y-4', children }) {
    const activeTab = useContext(SettingsTabContext);
    const selected = value === activeTab;
    // Keep forms mounted so changing tabs preserves unsaved input.
    return <section role="tabpanel" id={`settings-panel-${value}`} aria-labelledby={`settings-tab-${value}`}
        hidden={!selected} tabIndex={0} className={selected ? `min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 rounded-xl ${className}` : 'hidden'}>
        {children}
    </section>;
}
