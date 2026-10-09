"use client";
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const storage = event => {
      if (event.key === 'congregacao-theme') {
        const next = event.newValue === 'dark';
        document.documentElement.classList.toggle('dark', next);
        document.documentElement.style.colorScheme = next ? 'dark' : 'light';
      }
    };
    window.addEventListener('storage', storage);
    return () => { observer.disconnect(); window.removeEventListener('storage', storage); };
  }, []);
  function toggle() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.style.colorScheme = next ? 'dark' : 'light';
    setDark(next);
    try { localStorage.setItem('congregacao-theme', next ? 'dark' : 'light'); } catch { /* Theme still works without storage. */ }
  }
  const label = dark ? 'Ativar modo claro' : 'Ativar modo escuro';
  return <button type="button" onClick={toggle} aria-label={label} aria-pressed={dark} title={label} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500">{dark ? <Sun size={19} /> : <Moon size={19} />}</button>;
}
