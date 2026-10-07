'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/app/components/ui/dialog";
import { Loader2, Calendar } from 'lucide-react';

const assignmentDate = value => new Date(`${String(value).slice(0, 10)}T00:00:00Z`);

export function PublisherSummaryModal({ publisherId, isOpen, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !publisherId) return;
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/get-designacoes-publicador?id=${publisherId}`, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error('Não foi possível carregar as designações.');
        const result = await res.json();
        if (!controller.signal.aborted) setData(result);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchData();
    window.addEventListener('designacoes-atualizadas', fetchData);
    return () => {
      controller.abort();
      window.removeEventListener('designacoes-atualizadas', fetchData);
    };
  }, [isOpen, publisherId]);

  const handleClose = () => {
      onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
             <Calendar className="w-5 h-5 text-purple-600" />
             <span className="truncate">{data?.publisher ? `Designações: ${data.publisher}` : 'Designações Futuras'}</span>
          </DialogTitle>
          <DialogDescription className="text-gray-500">
             Próximas designações em todas as atividades.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-purple-600" /></div>
            ) : error ? (
                <p role="alert" className="text-sm text-red-600">{error}</p>
            ) : !data ? (
                <p className="text-center text-gray-500 text-sm">Carregando...</p>
            ) : data.assignments.length === 0 ? (
                <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                    <p className="text-sm">Nenhuma designação futura encontrada.</p>
                </div>
            ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {data.assignments.map(assign => (
                        <div key={assign.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:border-purple-200 hover:shadow-md transition-all">
                            <div className="flex flex-col items-center justify-center bg-purple-50 p-2 rounded-md border border-purple-100 min-w-[3.5rem] h-full">
                                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">{assignmentDate(assign.data_reuniao).toLocaleString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '')}</span>
                                <span className="text-xl font-bold text-purple-800 leading-none">{assignmentDate(assign.data_reuniao).getUTCDate()}</span>
                            </div>
                            <div className="flex-1 min-w-0 py-0.5">
                                <p className="text-[11px] font-medium text-purple-600 mb-1">{assign.categoria}</p>
                                <p className="text-sm font-semibold text-gray-900 leading-tight mb-1">{assign.nome_parte}</p>
                                <p className="text-xs text-gray-500 capitalize">{assignmentDate(assign.data_reuniao).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', timeZone: 'UTC' })}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
