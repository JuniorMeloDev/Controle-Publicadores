'use client';
import { useState } from 'react';
import { MessageCircle, FileText, Trash2, Loader2 } from 'lucide-react';
import { writeDesignationPdf } from '@/app/lib/designation-share';
import { whatsAppShareUrl, copyWhatsAppMessage } from '@/app/lib/whatsapp-share';

export function DesignationRowActions({ label, message = '', filename = 'designacao', onDelete, onWhatsApp, onPdf, buildPdf, disabled = false, canPdf = true }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shareFeedback, setShareFeedback] = useState('');
  function share() {
    setShareFeedback('');
    window.open(whatsAppShareUrl(message, navigator.userAgent), '_blank', 'noopener,noreferrer');
    copyWhatsAppMessage(message, navigator.clipboard).then(copied => {
      if (copied) setShareFeedback('Mensagem copiada com os ícones. Se necessário, cole no WhatsApp.');
    });
  }
  async function pdf() {
    setBusy(true); setError('');
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      (buildPdf ? buildPdf(doc) : writeDesignationPdf(doc, label, message)).save(`${filename}.pdf`);
    } catch { setError('Não foi possível gerar o PDF. Tente novamente.'); }
    finally { setBusy(false); }
  }
  const base = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50';
  return <div className="shrink-0">
    <div className="flex items-center gap-2">
      <button type="button" onClick={onWhatsApp || share} disabled={disabled} title="Compartilhar no WhatsApp" aria-label={`Compartilhar ${label} no WhatsApp`}
        className={`${base} border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100`}><MessageCircle size={16} /></button>
      <button type="button" onClick={onPdf || pdf} disabled={disabled || busy || !canPdf} title="Gerar PDF" aria-label={`Gerar PDF de ${label}`}
        className={`${base} border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}</button>
      {onDelete && <button type="button" onClick={onDelete} disabled={disabled} title="Excluir designações" aria-label={`Excluir ${label}`}
        className={`${base} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}><Trash2 size={16} /></button>}
    </div>
    {error && <p role="alert" className="mt-1 max-w-48 text-xs text-red-700">{error}</p>}
    {shareFeedback && <p role="status" className="mt-1 max-w-56 text-xs text-gray-600">{shareFeedback}</p>}
  </div>;
}
