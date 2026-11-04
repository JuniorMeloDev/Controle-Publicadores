'use client';

import { History } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { recentTerritoryWork } from '@/app/lib/territory-recent-history';

export function TerritoryRecentHistory({ territoryId, data, onClose }) {
  const territory = data.territorios.find(row => row.id === Number(territoryId));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const entries = recentTerritoryWork(data, territoryId, today);
  return <Dialog open={Boolean(territory)} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[85dvh] overflow-y-auto bg-white text-gray-900">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 pr-5"><History className="h-5 w-5 shrink-0 text-purple-600" />Histórico do território {territory?.numero}</DialogTitle>
        <DialogDescription>Últimas 3 datas em que o território foi concluído.</DialogDescription>
      </DialogHeader>
      {entries.length ? <ol className="space-y-2">{entries.map(entry => <li key={entry.date} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
        <time dateTime={entry.date} className="text-sm font-semibold text-purple-700">{entry.date.split('-').reverse().join('/')}</time>
        <p className="mt-1 break-words text-sm text-gray-600">{entry.names}</p>
      </li>)}</ol> : <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">Este território ainda não tem conclusão registrada.</p>}
      <DialogFooter><Button type="button" className="w-full bg-purple-100 text-purple-700 hover:bg-purple-200" onClick={onClose}>OK, continuar</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
