"use client";
import { Plus, Trash2 } from 'lucide-react';
import { IMaskInput } from 'react-imask';
import { MAX_EMERGENCY_CONTACTS } from '@/app/lib/emergency-contacts';
export default function EmergencyContactsFields({ value = [], onChange, disabled = false }) {
  const contacts = value.length ? value : [{ nome: '', telefone: '' }];
  function change(index, key, next) { onChange(contacts.map((contact, i) => i === index ? { ...contact, [key]: next } : contact)); }
  const inputClass = 'h-11 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50';
  return <fieldset disabled={disabled} className="min-w-0 space-y-4">
    <legend className="mb-4 w-full border-b border-gray-200 pb-2 text-sm font-bold text-gray-900">Contatos de emergência</legend>
    {contacts.map((contact, index) => <div key={index} className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Contato {index + 1}</span>
        {(contacts.length > 1 || contact.nome || contact.telefone) && <button type="button" onClick={() => onChange(contacts.filter((_, i) => i !== index))} aria-label={`Remover contato ${index + 1}`} className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block min-w-0 space-y-1.5"><span className="text-sm font-medium text-gray-700">Nome do contato</span><input aria-label="Contato de Emergência" value={contact.nome} maxLength={100} onChange={e => change(index, 'nome', e.target.value)} className={inputClass} placeholder="Nome do contato" /></label>
        <label className="block min-w-0 space-y-1.5"><span className="text-sm font-medium text-gray-700">Telefone do contato</span><IMaskInput aria-label="Telefone do Contato de Emergência" type="tel" inputMode="tel" mask="(00) 00000-0000" value={contact.telefone} onAccept={telefone => { if (telefone !== contact.telefone) change(index, 'telefone', telefone); }} className={inputClass} placeholder="(99) 99999-9999" /></label>
      </div>
    </div>)}
    <button type="button" onClick={() => onChange([...contacts, { nome: '', telefone: '' }])} disabled={contacts.length >= MAX_EMERGENCY_CONTACTS} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"><Plus size={15} />Adicionar contato</button>
  </fieldset>;
}
