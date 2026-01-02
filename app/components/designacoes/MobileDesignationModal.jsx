'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/app/components/ui/dialog";
import { User, BookOpen, Music, Mic, Users, Save, Loader2, Printer, Edit2, Check, X, ChevronDown, Search } from "lucide-react";
import { useState, useEffect, useRef } from 'react';

// Internal SearchableSelect Component
const SearchableSelect = ({ value, options, onChange, placeholder }) => {
   const [isOpen, setIsOpen] = useState(false);
   const [searchTerm, setSearchTerm] = useState('');
   const wrapperRef = useRef(null);

   // Close when clicking outside
   useEffect(() => {
      function handleClickOutside(event) {
         if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
            setIsOpen(false);
         }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
   }, [wrapperRef]);

   // Find label for current value
   const selectedOption = options?.find(o => o.value === value);
   const displayValue = selectedOption ? selectedOption.label : '';

   const filteredOptions = options?.filter(o =>
      o.label.toLowerCase().includes(searchTerm.toLowerCase())
   );

   const handleSelect = (val) => {
      onChange(val);
      setIsOpen(false);
      setSearchTerm('');
   };

   return (
      <div className="relative w-full" ref={wrapperRef}>
         <div
            className="w-full text-sm p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 cursor-pointer flex justify-between items-center"
            onClick={() => {
               setIsOpen(!isOpen);
               if (!isOpen && displayValue) setSearchTerm(''); // Clear on open usually, or prefill
               // To be more user friendly let's focus input
            }}
         >
            <span className={!value ? "text-gray-400" : ""}>{value ? displayValue : (placeholder || "Selecione...")}</span>
            <ChevronDown size={14} className="text-gray-400" />
         </div>

         {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
               <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                  <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded-md border border-gray-200">
                     <Search size={14} className="text-gray-400" />
                     <input
                        type="text"
                        className="w-full bg-transparent outline-none text-xs text-gray-700 placeholder:text-gray-400"
                        placeholder="Buscar..."
                        autoFocus
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                     />
                  </div>
               </div>
               <div className="py-1">
                  <div
                     className={`px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer ${value === "" ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-500'}`}
                     onClick={() => handleSelect('')}
                  >
                     Selecione...
                  </div>
                  {filteredOptions?.length === 0 && (
                     <div className="px-3 py-2 text-xs text-gray-400 text-center">Nenhum encontrado</div>
                  )}
                  {filteredOptions?.map(opt => (
                     <div
                        key={opt.value}
                        className={`px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer flex justify-between items-center ${value === opt.value ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-900'}`}
                        onClick={() => handleSelect(opt.value)}
                     >
                        {opt.label}
                        {value === opt.value && <Check size={14} />}
                     </div>
                  ))}
               </div>
            </div>
         )}
      </div>
   );
};


export function MobileDesignationModal({ isOpen, onClose, schedule, assignments, weekDescription, publicadores, onAssignmentChange, onSave, isSaving, onPrint, onScheduleUpdate }) {
   // State for Editing Title
   const [editingPartIndex, setEditingPartIndex] = useState(null); // { section: 'living', index: 0 }
   const [editingTitleValue, setEditingTitleValue] = useState('');

   if (!schedule || !assignments) return null;

   // Prepare Options for Select
   const pubOptions = publicadores?.map(p => ({
      value: p.nome_completo,
      label: p.nome_curto || p.nome_completo
   })) || [];

   const handleStartEditing = (section, idx, title) => {
      setEditingPartIndex({ section, index: idx });
      setEditingTitleValue(title);
   };

   const handleCancelEditing = () => {
      setEditingPartIndex(null);
      setEditingTitleValue('');
   };

   const handleSaveEditing = (section, idx) => {
      if (onScheduleUpdate) {
         onScheduleUpdate(section, idx, editingTitleValue);
      }
      handleCancelEditing();
   };

   const renderSectionHeader = (icon, title, colorClass) => (
      <div className={`flex items-center gap-2 font-bold text-sm uppercase tracking-wider mb-2 mt-4 pb-1 border-b ${colorClass}`}>
         {icon}
         <span>{title}</span>
      </div>
   );

   const renderEditableItem = (label, partKey, value, subLabel = null, subPartKey = null, subValue = null, editConfig = null) => {
      // Helper to render searchable select
      const renderSelect = (key, currentVal) => (
         <SearchableSelect
            value={currentVal || ''}
            options={pubOptions}
            onChange={(val) => onAssignmentChange && onAssignmentChange(key, val)}
         />
      );

      const isEditingThisContext = editConfig && editingPartIndex?.section === editConfig.section && editingPartIndex?.index === editConfig.idx;

      return (
         <div className="mb-3 last:mb-0">
            <div className="flex items-center justify-between mb-1">
               {isEditingThisContext ? (
                  <div className="flex items-center gap-2 flex-1 mr-2">
                     <input
                        className="flex-1 text-xs font-semibold border border-purple-300 rounded px-2 py-1 outline-none text-gray-700 bg-white"
                        value={editingTitleValue}
                        onChange={(e) => setEditingTitleValue(e.target.value)}
                        autoFocus
                     />
                     <button onClick={() => handleSaveEditing(editConfig.section, editConfig.idx)} className="text-green-600 hover:text-green-700 p-1"><Check size={14} /></button>
                     <button onClick={handleCancelEditing} className="text-red-500 hover:text-red-600 p-1"><X size={14} /></button>
                  </div>
               ) : (
                  <div className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-2 group">
                     {/* Strip time for simpler reading in edit mode check if desired, else just label */}
                     {label}
                     {editConfig && editConfig.allowEdit && (
                        <button
                           onClick={() => handleStartEditing(editConfig.section, editConfig.idx, label)}
                           className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-purple-600 p-1"
                           title="Editar Título"
                        >
                           <Edit2 size={12} />
                        </button>
                     )}
                  </div>
               )}
            </div>

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
                     <SearchableSelect
                        value={assignments.presidente || ''}
                        options={pubOptions}
                        onChange={(val) => onAssignmentChange('presidente', val)}
                     />
                  </div>
                  <div>
                     <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Ajudante</div>
                     <SearchableSelect
                        value={assignments.ajudante || ''}
                        options={pubOptions}
                        onChange={(val) => onAssignmentChange('ajudante', val)}
                     />
                  </div>
               </div>
               <div className="space-y-2">
                  {renderEditableItem("Oração Inicial", "oracao_inicial", assignments.oracao_inicial)}
                  {renderEditableItem(schedule.openingComments || "Comentários Iniciais", "comentarios_iniciais", assignments.comentarios_iniciais)}
               </div>

               {/* TESOUROS */}
               {renderSectionHeader(<BookOpen className="w-5 h-5" />, "Tesouros da Palavra", "text-blue-700 border-blue-200")}
               {schedule.treasures?.map((part, idx) => (
                  <div key={`tesouro-${idx}`}>
                     {renderEditableItem(part.title, `tesouro_${idx}`, assignments[`tesouro_${idx}`])}
                  </div>
               ))}

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
               {renderSectionHeader(<Music className="w-5 h-5" />, "Nossa Vida Cristã", "text-red-600 border-red-100")}
               {renderEditableItem(schedule.middleSong || "Cântico do Meio", "cantico_meio", assignments.cantico_meio)}

               {schedule.living?.map((part, idx) => {
                  const isBibleStudy = part.title.toLowerCase().includes('estudo bíblico');
                  const isLocalNeeds = part.title.toLowerCase().includes('necessidades locais') || part.title.toLowerCase().includes('necessidades da congregação');

                  const mainKey = isBibleStudy ? `vida_${idx}_1` : `vida_${idx}`;
                  const readerKey = isBibleStudy ? `vida_${idx}_2` : null;

                  const mainVal = assignments[mainKey];
                  const readerVal = assignments[readerKey];

                  // Config for editing
                  const editConfig = isLocalNeeds ? { allowEdit: true, section: 'living', idx } : null;

                  return (
                     <div key={`vida-${idx}`}>
                        {renderEditableItem(part.title, mainKey, mainVal, "Leitor", readerKey, readerVal, editConfig)}
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
                  {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar
               </button>
            </div>

         </DialogContent>
      </Dialog>
   );
}
