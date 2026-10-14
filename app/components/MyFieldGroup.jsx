'use client';

import { useState } from 'react';
import { Users, Phone, MessageCircle, Search } from 'lucide-react';
import { phoneContactLinks } from '@/app/lib/field-group';

function Contact({ person, role }) {
  const links = phoneContactLinks(person?.phone);
  return <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
    <p className="text-xs font-medium text-purple-700">{role}</p>
    <p className="mt-1 break-words font-semibold text-gray-900">{person?.name || 'Ainda não informado'}</p>
    {person && <>{person.phone ? <p className="mt-1 text-sm text-gray-600">{person.phone}</p> : <p className="mt-1 text-xs text-gray-500">Telefone ainda não informado.</p>}
      {links && <div className="mt-3 flex flex-wrap gap-3"><a href={links.whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${person.name}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700"><MessageCircle className="h-4 w-4" />WhatsApp</a><a href={links.phone} aria-label={`Ligar para ${person.name}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"><Phone className="h-4 w-4" />Ligar</a></div>}
    </>}
  </div>;
}

const normalize = text => text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function MyFieldGroup({ group }) {
  const [search, setSearch] = useState('');
  const members = group?.members || [];
  const filtered = members.filter(member => normalize(`${member.name} ${member.shortName}`).includes(normalize(search.trim())));
  return <section className="rounded-xl border border-gray-200 bg-white p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><Users className="h-5 w-5 text-purple-600" />Meu grupo de campo</h2>{group && <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">{members.length} {members.length === 1 ? 'participante' : 'participantes'}</span>}</div>
    {!group ? <p className="text-sm text-gray-500">Seu grupo ainda não foi informado. Solicite a atualização do cadastro a um responsável.</p> : <>
      <p className="mb-4 font-medium text-gray-900">{group.name}{!group.active && <span className="ml-2 text-xs text-gray-500">Grupo inativo</span>}</p>
      <div className={`grid gap-3 ${group.assistant ? 'sm:grid-cols-2' : ''}`}><Contact person={group.superintendent} role="Superintendente do grupo" />{group.assistant && <Contact person={group.assistant} role="Ajudante do grupo" />}</div>
      <details className="mt-4 rounded-lg border border-gray-200 p-3"><summary className="cursor-pointer text-sm font-medium text-purple-700">Ver participantes do grupo ({members.length})</summary>
        {members.length > 8 && <label className="mt-4 flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-500"><Search className="h-4 w-4" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar participante" aria-label="Buscar participante do grupo" className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none" /></label>}
        {!filtered.length ? <p className="mt-3 text-sm text-gray-500">{search ? 'Nenhum participante encontrado.' : 'Nenhum participante cadastrado.'}</p> : <ul className="mt-3 grid gap-2 sm:grid-cols-2">{filtered.map(member => <li key={member.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700"><span className="break-words">{member.name}</span>{member.isSelf && <span className="text-xs font-medium text-purple-700">Você</span>}{member.id === group.superintendent?.id && <span className="text-xs text-gray-500">Superintendente</span>}{member.id === group.assistant?.id && <span className="text-xs text-gray-500">Ajudante</span>}</li>)}</ul>}
      </details>
    </>}
  </section>;
}
