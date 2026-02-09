'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/app/components/ui/dialog";
import { User, BookOpen, Music, Mic, Users, Save, Loader2, Printer, Edit2, Check, X, ChevronDown, Search, Wand2, Sparkles, History } from "lucide-react";
import { useState, useEffect, useRef } from 'react';
import { usePermissions } from '@/app/components/PermissionsContext';
import { isAllowed } from '@/app/lib/access-control';

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

// HELPER: Truncate Title for Display
const formatPartTitle = (title) => {
   if (!title) return "";
   if (title.toLowerCase().includes('cÃ¢ntico')) return title;

   // Strict truncation: Stop exactly at "(XX min)"
   const match = title.match(/^(.*?)(\(\d+\s*min\))/i);
   if (match) {
      const base = match[1] + match[2];

      // Check if there is "ConsideraÃ§Ã£o" immediately following
      const afterTime = title.substring(match.index + match[0].length);
      let suffix = "";
      if (afterTime.match(/^[:\s]*ConsideraÃ§Ã£o/i)) {
         suffix = ": ConsideraÃ§Ã£o";
      }
      return base + suffix;
   }
   return title;
};

const normalizeText = (text) => {
   if (!text) return '';
   return text
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
};

export function MobileDesignationModal({ isOpen, onClose, schedule, assignments, weekDescription, publicadores, historyData = [], onAssignmentChange, onSave, isSaving, onPrint, onScheduleUpdate }) {
   const { permissions } = usePermissions();
   const canSave = isAllowed(permissions, 'designacoes_salvar', 'actions');
   const canPdf = isAllowed(permissions, 'designacoes_pdf', 'actions');
   // State for Editing Title
   const [editingPartIndex, setEditingPartIndex] = useState(null); // { section: 'living', index: 0 }
   const [editingTitleValue, setEditingTitleValue] = useState('');

   // State for History Modal
   const [historyModalOpen, setHistoryModalOpen] = useState(false);
   const [selectedPubHistory, setSelectedPubHistory] = useState(null);

   if (!schedule || !assignments) return null;

   // Prepare Options for Select
   const pubOptions = publicadores?.map(p => ({
      value: p.nome_completo,
      label: p.nome_curto || p.nome_completo
   })) || [];

   // -- SMART AUTO FILL LOGIC (RANDOM + UNIQUE) --
   const handleAutoFill = () => {
      const newAssigns = {};
      const usedNames = new Set(); // Track used publishers for this generation

      // Helper to pick random unique
      const pickUnique = (pool) => {
         if (!pool || pool.length === 0) return '';

         // Filter out already used names
         const available = pool.filter(p => !usedNames.has(p.nome_completo));

         if (available.length === 0) return ''; // No one left available

         const idx = Math.floor(Math.random() * available.length);
         const chosen = available[idx].nome_completo;

         usedNames.add(chosen);
         return chosen;
      };

      // 1. Define Pools
      const elders = publicadores.filter(p => p.privilegios?.includes('anciao'));
      const eldersAndMSUnique = publicadores.filter(p => p.privilegios?.includes('anciao') || p.privilegios?.includes('servo_ministerial'));

      const males = publicadores.filter(p => p.sexo === 'Masculino');
      const females = publicadores.filter(p => p.sexo === 'Feminino');

      const malesNotElder = males.filter(p => !p.privilegios?.includes('anciao'));
      const malesForBibleReading = males.filter(p => !p.privilegios?.includes('anciao') && !p.privilegios?.includes('servo_ministerial'));

      // 2. Assign Roles

      // Presidente (Exception: assigned to multiple parts)
      // Pick president first to ensure availability
      const presName = pickUnique(elders);
      if (presName) {
         newAssigns['presidente'] = presName;
         newAssigns['comentarios_iniciais'] = presName;
         newAssigns['comentarios_finais'] = presName;
         newAssigns['cantico_meio'] = presName;
         // Note: presName is already added to usedNames by pickUnique
      }

      // OraÃ§Ãµes
      newAssigns['oracao_inicial'] = pickUnique(males);
      newAssigns['oracao_final'] = pickUnique(males);

      // Tesouros
      schedule.treasures?.forEach((part, idx) => {
         const isBibleReading = part.title.toLowerCase().includes('leitura');
         if (isBibleReading) {
            newAssigns[`tesouro_${idx}`] = pickUnique(malesForBibleReading);
         } else {
            newAssigns[`tesouro_${idx}`] = pickUnique(eldersAndMSUnique);
         }
      });

      // FaÃ§a Seu Melhor
      schedule.ministry?.forEach((part, idx) => {
         const isDiscurso = part.title.toLowerCase().includes('discurso');
         if (isDiscurso) {
            newAssigns[`ministerio_${idx}`] = pickUnique(malesNotElder);
         } else {
            newAssigns[`ministerio_${idx}_1`] = pickUnique(females);
            newAssigns[`ministerio_${idx}_2`] = pickUnique(females);
         }
      });

      // Nossa Vida CristÃ£
      schedule.living?.forEach((part, idx) => {
         const isBibleStudy = normalizeText(part.title).includes('estudo biblico');
         if (isBibleStudy) {
            newAssigns[`vida_${idx}_1`] = pickUnique(elders);
            newAssigns[`vida_${idx}_2`] = pickUnique(malesNotElder);
         } else {
            newAssigns[`vida_${idx}`] = pickUnique(elders);
         }
      });

      if (onAssignmentChange) {
         onAssignmentChange(newAssigns);
      }
   };

   // -- MANUAL SELECTION INTERCEPT --
   const handleManualChange = (key, val) => {
      // 1. Update the assignment immediately
      if (onAssignmentChange) {
         onAssignmentChange(key, val);
      }

      // 2. Show history modal if a value was selected
      if (val) {
         const hist = historyData.filter(h => h.nome_completo === val);
         setSelectedPubHistory({ name: val, history: hist });
         setHistoryModalOpen(true);
      }
   };

   const handleStartEditing = (section, idx, title) => {
      setEditingPartIndex({ section, index: idx ?? null });
      setEditingTitleValue(title);
   };

   const handleCancelEditing = () => {
      setEditingPartIndex(null);
      setEditingTitleValue('');
   };

   const handleSaveEditing = (section, idx) => {
      if (onScheduleUpdate) {
         onScheduleUpdate(section, idx ?? null, editingTitleValue);
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
      // Truncate label if it's too long (Modal View)
      const displayLabel = formatPartTitle(label);

      // Helper to render searchable select
      const renderSelect = (key, currentVal) => (
         <SearchableSelect
            value={currentVal || ''}
            options={pubOptions}
            onChange={(val) => handleManualChange(key, val)}
         />
      );

      const isEditingThisContext = editConfig && editingPartIndex?.section === editConfig.section && editingPartIndex?.index === (editConfig.idx ?? null);

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
                     {displayLabel}
                     {editConfig && editConfig.allowEdit && (
                        <button
                           onClick={() => handleStartEditing(editConfig.section, editConfig.idx, label)}
                           className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-purple-600 p-1"
                           title="Editar TÃ­tulo"
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

            {/* --- HISTORY MODAL (NESTED ABSOLUTE OVERLAY) --- */}
            {historyModalOpen && selectedPubHistory && (
               <div className="absolute inset-x-0 bottom-0 z-[60] bg-white border-t-2 border-purple-500 shadow-2xl p-4 animate-in slide-in-from-bottom-10 fade-in duration-300 rounded-b-xl flex flex-col max-h-[50%]">
                  <div className="flex justify-between items-center mb-2">
                     <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <History size={16} className="text-purple-600" />
                        Histórico (3 Meses): {selectedPubHistory.name}
                     </h3>
                     <button onClick={() => setHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                     {selectedPubHistory.history.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">Nenhuma designaÃ§Ã£o recente.</p>
                     ) : (
                        selectedPubHistory.history
                           .filter(h => {
                              const part = h.nome_parte.toLowerCase();
                              return !part.includes('comentÃ¡rios') && !part.includes('cÃ¢ntico');
                           })
                           .map((h, i) => (
                              <div key={i} className="text-xs flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                                 <span className="font-medium text-gray-700">{h.nome_parte}</span>
                                 <span className="text-gray-500">{new Date(h.data_reuniao).toLocaleDateString('pt-BR')}</span>
                              </div>
                           ))
                     )}
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-100">
                     <button onClick={() => setHistoryModalOpen(false)} className="w-full py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-md text-xs font-bold uppercase tracking-wide">
                        OK, Confirmar
                     </button>
                  </div>
               </div>
            )}

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
                        onChange={(val) => handleManualChange('presidente', val)}
                     />
                  </div>
                  <div>
                     <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Ajudante</div>
                     <SearchableSelect
                        value={assignments.ajudante || ''}
                        options={pubOptions}
                        onChange={(val) => handleManualChange('ajudante', val)}
                     />
                  </div>
               </div>
               <div className="space-y-2">
                  {renderEditableItem("Oração Inicial", "oracao_inicial", assignments.oracao_inicial)}
                  {renderEditableItem(
                     schedule.openingComments || "ComentÃ¡rios Iniciais",
                     "comentarios_iniciais",
                     assignments.comentarios_iniciais,
                     null,
                     null,
                     null,
                     { allowEdit: true, section: 'openingComments', idx: null }
                  )}
               </div>

               {/* TESOUROS */}
               {renderSectionHeader(<BookOpen className="w-5 h-5" />, "Tesouros da Palavra de Deus", "text-blue-700 border-blue-200")}
               {schedule.treasures?.map((part, idx) => (
                  <div key={`tesouro-${idx}`}>
                     {renderEditableItem(
                        part.title,
                        `tesouro_${idx}`,
                        assignments[`tesouro_${idx}`],
                        null,
                        null,
                        null,
                        { allowEdit: true, section: 'treasures', idx }
                     )}
                  </div>
               ))}

               {/* FAÇA SEU MELHOR */}
               {renderSectionHeader(<Users className="w-5 h-5" />, "Faça Seu Melhor no Ministério", "text-orange-600 border-orange-100")}
               {schedule.ministry?.map((part, idx) => {
                  const isDiscurso = part.title.toLowerCase().includes('discurso');
                  const studentKey = isDiscurso ? `ministerio_${idx}` : `ministerio_${idx}_1`;
                  const assistantKey = isDiscurso ? null : `ministerio_${idx}_2`;

                  const studentVal = assignments[studentKey];
                  const assistantVal = assignments[assistantKey];

                  return (
                     <div key={`min-${idx}`}>
                        {renderEditableItem(
                           part.title,
                           studentKey,
                           studentVal,
                           "Ajudante",
                           assistantKey,
                           assistantVal,
                           { allowEdit: true, section: 'ministry', idx }
                        )}
                     </div>
                  );
               })}

               {/* NOSSA VIDA CRISTÃ */}
               {renderSectionHeader(<Music className="w-5 h-5" />, "Nossa Vida Cristã", "text-red-600 border-red-100")}
               {renderEditableItem(
                  schedule.middleSong || "CÃ¢ntico do Meio",
                  "cantico_meio",
                  assignments.cantico_meio,
                  null,
                  null,
                  null,
                  { allowEdit: true, section: 'middleSong', idx: null }
               )}

               {schedule.living?.map((part, idx) => {
                  const isBibleStudy = normalizeText(part.title).includes('estudo biblico');

                  const mainKey = isBibleStudy ? `vida_${idx}_1` : `vida_${idx}`;
                  const readerKey = isBibleStudy ? `vida_${idx}_2` : null;

                  const mainVal = assignments[mainKey];
                  const readerVal = assignments[readerKey];

                  return (
                     <div key={`vida-${idx}`}>
                        {renderEditableItem(
                           part.title,
                           mainKey,
                           mainVal,
                           "Leitor",
                           readerKey,
                           readerVal,
                           { allowEdit: true, section: 'living', idx }
                        )}
                     </div>
                  )
               })}

               <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  {renderEditableItem(
                     schedule.finalComments || "ComentÃ¡rios Finais",
                     "comentarios_finais",
                     assignments.comentarios_finais,
                     null,
                     null,
                     null,
                     { allowEdit: true, section: 'finalComments', idx: null }
                  )}
                  {renderEditableItem("Oração Final", "oracao_final", assignments.oracao_final)}
               </div>

            </div>

            <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
               {/* AUTO INSERT BUTTON */}
               <button onClick={handleAutoFill} className="px-3 py-2 bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 rounded-md text-sm font-medium shadow-sm flex items-center gap-2 transition-colors mr-auto">
                  <Sparkles size={16} /> Inserir Automático
               </button>

               <button onClick={onPrint} disabled={!canPdf} className="px-3 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md text-sm font-medium shadow-sm flex items-center gap-2 disabled:opacity-50">
                  <Printer size={16} /> PDF
               </button>
               <button onClick={() => { onSave && onSave(); onClose(); }} disabled={isSaving || !canSave} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium shadow-sm flex items-center gap-2 disabled:opacity-50">
                  {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar
               </button>
            </div>

         </DialogContent>
      </Dialog>
   );
}

