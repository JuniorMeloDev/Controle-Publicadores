'use client';

import { CheckCircle, X, AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function StatusToast({ message, type, onClose }) {
  const [visible, setVisible] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!message) return;
    const show = window.setTimeout(() => setVisible(true), 0);
    const timer = window.setTimeout(() => { setVisible(false); closeRef.current?.(); }, 3000);
    return () => { window.clearTimeout(show); window.clearTimeout(timer); };
  }, [message, type]);
  if (!message || !visible) return null;
    
  const isError = type === 'error';
  
  // Define cores e ícones com base no tipo
  const bgColor = isError ? 'bg-red-600' : 'bg-green-600';
  const hoverColor = isError ? 'hover:bg-red-700' : 'hover:bg-green-700';
  const Icon = isError ? AlertTriangle : CheckCircle; 

  // O Toast flutuante usa animação slide-in do Tailwind CSS
  return createPortal(
    <div className="fixed top-4 right-4 left-4 sm:left-auto z-[10000] max-w-md animate-in slide-in-from-right duration-300 print:hidden">
      <div 
        className={`${bgColor} text-white p-4 rounded-lg shadow-xl flex items-center justify-between`}
        role={isError ? 'alert' : 'status'}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5" />
          <span className="font-semibold break-words">{message}</span>
        </div>
        <button type="button" aria-label="Fechar mensagem" onClick={() => { setVisible(false); closeRef.current?.(); }} className={`p-1 ${hoverColor} rounded-full ml-4`}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>, document.body
  );
}
