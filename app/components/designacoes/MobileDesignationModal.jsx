'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/app/components/ui/dialog";
import { User, BookOpen, Music, Mic, Users, Save, Loader2, Printer } from "lucide-react";

export function MobileDesignationModal({ isOpen, onClose, schedule, assignments, weekDescription, publicadores, onAssignmentChange, onSave, isSaving, onPrint }) {
  if (!schedule || !assignments) return null;

  const renderSectionHeader = (icon, title, colorClass) => (
    <div className={`flex items-center gap-2 font-bold text-sm uppercase tracking-wider mb-2 mt-4 pb-1 border-b ${colorClass}`}>
      {icon}
      <span>{title}</span>
    </div>
  );

  const renderEditableItem = (label, partKey, value, subLabel = null, subPartKey = null, subValue = null) => {
     // Helper to render a select box
     const renderSelect = (key, currentVal) => (
        <select 
          value={currentVal || ''} 
          onChange={(e) => onAssignmentChange && onAssignmentChange(key, e.target.value)}
          className="w-full text-sm p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none appearance-none"
          style={{ backgroundImage: 'none' }} // Remove default arrow if desired, or keep it. Native checks usually okay.
        >
           <option value="">Selecione...</option>
           {publicadores?.map(p => (
              <option key={p.id || p.nome_completo} value={p.nome_completo}>
                 {p.nome_curto || p.nome_completo}
              </option>
           ))}
        </select>
     );

     return (
        <div className="mb-3 last:mb-0">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-1">{label}</div>
          <div className="mb-1">{renderSelect(partKey, value)}</div>
          
          {subPartKey && (
             <div className="mt-2 pl-3 border-l-2 border-gray-100">
                <div className="text-xs font-semibold text-gray-400 uppercase mb-1">{subLabel || 'Ajudante/Leitor'}</div>
                <div>{renderSelect(subPartKey, subValue)}</div>
             </div>
          )}
        </div>
     );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-50 w-full max-w-md max-h-[90vh] p-0 gap-0 overflow-hidden rounded-xl bg-white flex flex-col border shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:rounded-xl">
        <DialogHeader className="p-4 border-b border-gray-100 bg-gray-50/50">
          <DialogTitle className="text-lg font-bold text-gray-900 leading-tight">
            Designações da Semana
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 font-medium">
            {weekDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          
          {/* SALÃO PRINCIPAL */}
          {renderSectionHeader(<Users size={16} />, "Salão Principal", "text-blue-600 border-blue-100")}
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
               <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Presidente</div>
               <select 
                  value={assignments.presidente || ''} 
                  onChange={(e) => onAssignmentChange('presidente', e.target.value)}
                  className="w-full text-sm p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
               >
                  <option value="">Selecione...</option>
                  {publicadores?.map(p => <option key={p.id || p.nome_completo} value={p.nome_completo}>{p.nome_curto}</option>)}
               </select>
            </div>
            <div>
               <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Ajudante</div>
                <select 
                  value={assignments.ajudante || ''} 
                  onChange={(e) => onAssignmentChange('ajudante', e.target.value)}
                   className="w-full text-sm p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
               >
                  <option value="">Selecione...</option>
                  {publicadores?.map(p => <option key={p.id || p.nome_completo} value={p.nome_completo}>{p.nome_curto}</option>)}
               </select>
            </div>
          </div>
          <div className="space-y-2">
            {renderEditableItem("Oração Inicial", "oracao_inicial", assignments.oracao_inicial)}
            {renderEditableItem(schedule.openingComments || "Comentários Iniciais", "comentarios_iniciais", assignments.comentarios_iniciais)}
          </div>

          {/* TESOUROS */}
          {/* TESOUROS */}
          {renderSectionHeader(<BookOpen className="w-5 h-5" />, "Tesouros da Palavra", "text-blue-700 border-blue-200")}
          {schedule.treasures?.map((part, idx) => (
             <div key={`tesouro-${idx}`}>
                {renderEditableItem(part.title, `tesouro_${idx}`, assignments[`tesouro_${idx}`])}
             </div>
          ))}

          {/* FAÇA SEU MELHOR */}
          {/* FAÇA SEU MELHOR */}
          {renderSectionHeader(<Users className="w-5 h-5" />, "Faça Seu Melhor", "text-orange-600 border-orange-100")}
          {schedule.ministry?.map((part, idx) => {
             const isDiscurso = part.title.toLowerCase().includes('discurso');
             const studentKey = isDiscurso ? `ministerio_${idx}` : `ministerio_${idx}_1`;
             const assistantKey = isDiscurso ? null : `ministerio_${idx}_2`;
             
             const studentVal = assignments[studentKey];
             const assistantVal = assignments[assistantKey];
             
             return (
               <div key={`min-${idx}`}>
                 {renderEditableItem(part.title, studentKey, studentVal, "Ajudante", assistantKey, assistantVal)}
               </div>
             );
          })}

          {/* NOSSA VIDA CRISTÃ */}
          {/* NOSSA VIDA CRISTÃ */}
          {renderSectionHeader(<Music className="w-5 h-5" />, "Nossa Vida Cristã", "text-red-600 border-red-100")}
          {renderEditableItem(schedule.middleSong || "Cântico do Meio", "cantico_meio", assignments.cantico_meio)}
          
          {schedule.living?.map((part, idx) => {
             const isBibleStudy = part.title.toLowerCase().includes('estudo bíblico');
             const mainKey = isBibleStudy ? `vida_${idx}_1` : `vida_${idx}`;
             const readerKey = isBibleStudy ? `vida_${idx}_2` : null;

             const mainVal = assignments[mainKey];
             const readerVal = assignments[readerKey];

             return (
               <div key={`vida-${idx}`}>
                  {renderEditableItem(part.title, mainKey, mainVal, "Leitor", readerKey, readerVal)}
               </div>
             )
          })}
          
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
             {renderEditableItem(schedule.finalComments || "Comentários Finais", "comentarios_finais", assignments.comentarios_finais)}
             {renderEditableItem("Oração Final", "oracao_final", assignments.oracao_final)}
          </div>

        </div>
        
        <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
             <button onClick={onPrint} className="px-3 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md text-sm font-medium shadow-sm flex items-center gap-2">
                <Printer size={16} /> PDF
             </button>
             <button onClick={() => { onSave && onSave(); onClose(); }} disabled={isSaving} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium shadow-sm flex items-center gap-2 disabled:opacity-50">
                {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Salvar
             </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
