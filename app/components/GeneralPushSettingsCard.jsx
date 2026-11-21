'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { ConfirmationDialog } from '@/app/components/ui/confirmation-dialog';
import { usePermissions } from '@/app/components/PermissionsContext';

export function GeneralPushSettingsCard() {
  const { user } = usePermissions();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [publishedId, setPublishedId] = useState(null);
  if (!user?.isSuperAdmin) return null;

  async function publish() {
    const response = await fetch('/api/admin/notificacoes/avisos-gerais', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draftId, title, message }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    setPublishedId(result.id);
    setDraftId(null);
    setTitle('');
    setMessage('');
  }

  return <Card className="border-gray-200 bg-white text-gray-900">
    <CardHeader>
      <CardTitle>Avisos gerais no aparelho</CardTitle>
      <CardDescription className="text-gray-600">Envie um aviso a quem ativou avisos gerais, incluindo visitantes. O texto será exibido na notificação e ficará disponível em uma página pública.</CardDescription>
    </CardHeader>
    <CardContent>
      <form className="space-y-3" onSubmit={event => {
        event.preventDefault();
        if (!title.trim() || !message.trim()) return;
        setDraftId(current => current || crypto.randomUUID());
        setConfirming(true);
      }}>
        <label className="block space-y-1 text-sm font-medium">
          <span>Título</span>
          <input className="w-full rounded-md border px-3 py-2" value={title} maxLength={80} required
            onChange={event => { setTitle(event.target.value); setDraftId(null); }} />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          <span>Mensagem pública</span>
          <textarea className="w-full rounded-md border px-3 py-2" value={message} maxLength={240} rows={3} required
            onChange={event => { setMessage(event.target.value); setDraftId(null); }} />
        </label>
        <Button type="submit" disabled={!title.trim() || !message.trim()}>Publicar aviso geral</Button>
        {publishedId && <p className="text-sm" role="status">Aviso publicado. <Link className="text-purple-700 underline" href={`/avisos/${publishedId}`}>Abrir aviso</Link></p>}
      </form>
    </CardContent>
    {confirming && <ConfirmationDialog title="Publicar aviso geral?"
      description="O aviso será publicado e o envio será iniciado para os aparelhos que ativaram avisos gerais."
      confirmLabel="Publicar" onConfirm={publish} onCancel={() => setConfirming(false)} />}
  </Card>;
}
