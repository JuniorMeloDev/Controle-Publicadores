'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Smartphone, X, Share } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

const DISMISSED_KEY = 'publicadores-pwa-install-dismissed-until';
const WEEK = 7 * 24 * 60 * 60 * 1000;

export default function PwaInstallBanner() {
  const promptEvent = useRef(null);
  const [mode, setMode] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const installed = () => media.matches || navigator.standalone === true;
    const dismissed = () => {
      try { return Number(localStorage.getItem(DISMISSED_KEY)) > Date.now(); } catch { return false; }
    };
    const agent = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const safari = /Safari/.test(agent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(agent);
    if (!installed() && !dismissed() && ios && safari) setMode('ios');

    const beforeInstall = event => {
      event.preventDefault();
      promptEvent.current = event;
      if (!installed() && !dismissed()) setMode('native');
    };
    const hide = () => {
      promptEvent.current = null; setMode(null); setInstructions(false);
    };
    const displayChanged = () => { if (installed()) hide(); };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', hide);
    media.addEventListener('change', displayChanged);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', hide);
      media.removeEventListener('change', displayChanged);
      promptEvent.current = null;
    };
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now() + WEEK)); } catch { /* Banner still closes when storage is unavailable. */ }
    setMode(null); setInstructions(false);
  }

  async function install() {
    if (mode === 'ios') { setInstructions(true); return; }
    const event = promptEvent.current;
    if (!event || installing) return;
    setInstalling(true); setError('');
    try {
      // A browser installation event can only be prompted once.
      promptEvent.current = null;
      await event.prompt();
      const result = await event.userChoice;
      if (result.outcome === 'dismissed') dismiss();
      else setMode(null);
    } catch {
      setError('Não foi possível abrir a instalação. Use a opção de instalar aplicativo no menu do navegador.');
    } finally { setInstalling(false); }
  }

  if (!mode) return null;
  return <>
    <section aria-label="Instalar aplicativo" className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 right-3 z-40 rounded-2xl border border-purple-200 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.16)] sm:left-auto sm:right-6 sm:w-[560px] print:hidden">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-sm sm:h-14 sm:w-14"><Smartphone className="h-7 w-7" aria-hidden="true" /></div>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-bold text-gray-900">Instalar o App</h2><p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">Acesse mais rápido pela tela inicial do celular ou computador.</p></div>
        <button type="button" disabled={installing} onClick={install} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:opacity-60 sm:px-4"><Download className="h-4 w-4" aria-hidden="true" />{installing ? 'Abrindo...' : 'Instalar'}</button>
        <button type="button" aria-label="Fechar convite de instalação" onClick={dismiss} className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"><X className="h-4 w-4" /></button>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
    </section>
    <Dialog open={instructions} onOpenChange={setInstructions}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Instalar o App no iPhone ou iPad</DialogTitle><DialogDescription>Adicione o aplicativo à tela inicial pelo Safari.</DialogDescription></DialogHeader><ol className="list-decimal space-y-3 pl-5 text-sm text-gray-700"><li>Toque no botão de compartilhar <Share className="inline h-4 w-4" aria-label="Compartilhar" /> do Safari. Se necessário, abra primeiro o menu do navegador.</li><li>Escolha <strong>Adicionar à Tela de Início</strong>.</li><li>Se aparecer a opção <strong>Abrir como App da Web</strong>, mantenha-a ativada e toque em <strong>Adicionar</strong>.</li></ol></DialogContent></Dialog>
  </>;
}
