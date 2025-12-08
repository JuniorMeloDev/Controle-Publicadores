'use client';

import { CheckCircle, X, AlertTriangle } from 'lucide-react';

export function StatusToast({ message, type, onClose }) {
  if (!message) return null;
    
  const isError = type === 'error';
  
  // Define cores e ícones com base no tipo
  const bgColor = isError ? 'bg-red-600' : 'bg-green-600';
  const hoverColor = isError ? 'hover:bg-red-700' : 'hover:bg-green-700';
  const Icon = isError ? AlertTriangle : CheckCircle; 

  // O Toast flutuante usa animação slide-in do Tailwind CSS
  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-500">
      <div 
        className={`${bgColor} text-white p-4 rounded-lg shadow-xl flex items-center justify-between min-w-[300px]`}
        role="alert"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5" />
          <span className="font-semibold">{message}</span>
        </div>
        <button onClick={onClose} className={`p-1 ${hoverColor} rounded-full ml-4`}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
