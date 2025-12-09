'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/app/components/ui/dialog";
import { Loader2, Calendar, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function PublisherSummaryModal({ publisherId, isOpen, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isOpen && publisherId) {
      fetchData();
    } else {
        setData(null);
    }
  }, [isOpen, publisherId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/get-designacoes-publicador?id=${publisherId}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
      onClose();
  };

  const formatDate = (dateStr) => {
    if(!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
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
             Resumo das próximas partes.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-purple-600" /></div>
            ) : !data ? (
                <p className="text-center text-gray-500 text-sm">Carregando...</p>
            ) : data.assignments.length === 0 ? (
                <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                    <p className="text-sm">Nenhuma designação futura encontrada.</p>
                </div>
            ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {data.assignments.map((assign, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:border-purple-200 hover:shadow-md transition-all">
                            <div className="flex flex-col items-center justify-center bg-purple-50 p-2 rounded-md border border-purple-100 min-w-[3.5rem] h-full">
                                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">{new Date(assign.data_reuniao).toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                                <span className="text-xl font-bold text-purple-800 leading-none">{new Date(assign.data_reuniao).getDate()}</span>
                            </div>
                            <div className="flex-1 min-w-0 py-0.5">
                                <p className="text-sm font-semibold text-gray-900 leading-tight mb-1">{assign.nome_parte}</p>
                                <p className="text-xs text-gray-500 capitalize">{new Date(assign.data_reuniao).toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
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
