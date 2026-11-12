'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { generateFieldSchedule, TERRITORY_PERIODS, territoryPeriod } from '@/app/lib/field-planner';
import { BatchField, FieldBatchDialog, fieldControl, saveFieldBatch } from './FieldBatchDialog';

const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const newRule = () => ({ dia: 6, horario: '08:30', quantidade: 4, grupos: [], local_id: '' });
const alignedFields = 'grid items-start gap-3 [&>label]:min-w-0 [&>label]:content-start [&_input]:h-11 [&_select]:h-11 sm:[&>label]:row-span-3 sm:[&>label]:grid-rows-subgrid';

export function FieldScheduleGenerator({ data, onClose, onSaved }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const monthEnd = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const [config, setConfig] = useState({ inicio: today, fim: monthEnd, intervalo: 14, regras: [newRule()] });
  const [periods, setPeriods] = useState(Object.fromEntries(data.territorios.filter(t => t.ativo).map(t => [t.id, territoryPeriod(t)])));
  const [preview, setPreview] = useState(null), [error, setError] = useState('');
  const change = patch => { setConfig(current => ({ ...current, ...patch })); setPreview(null); setError(''); };
  const changeRule = (index, patch) => change({ regras: config.regras.map((rule, i) => i === index ? { ...rule, ...patch } : rule) });
  const changeRow = (index, patch) => setPreview(current => ({ ...current, rows: current.rows.map((row, i) => i === index ? { ...row, ...patch } : row) }));
  return <FieldBatchDialog title="Gerar programação com territórios sugeridos" description="Crie várias saídas no período escolhido. O sistema sugere os números dos territórios, priorizando os que estão há mais tempo sem trabalhar. Depois, confira as sugestões e escolha o dirigente de cada saída antes de salvar."
    onClose={onClose} disabled={!preview?.rows.length} saveLabel="Salvar saídas na agenda" onSave={async () => {
      if (preview.rows.some(row => !row.territorios.length)) throw new Error('Remova as saídas sem territórios ou ajuste as regras e gere novamente.');
      const result = await saveFieldBatch({ entity: 'saidas', action: 'batch', records: preview.rows, periodos: periods, intervalo: config.intervalo });
      await onSaved(`${result.ids.length} saída(s) criada(s).`); onClose();
    }}>
    <div className={`${alignedFields} sm:grid-cols-3`}>
      <BatchField label="Data inicial da programação"><input type="date" required className={fieldControl} value={config.inicio} onChange={e => change({ inicio: e.target.value })} /></BatchField>
      <BatchField label="Data final (período de até 93 dias)"><input type="date" required min={config.inicio} className={fieldControl} value={config.fim} onChange={e => change({ fim: e.target.value })} /></BatchField>
      <BatchField label="Dias mínimos para repetir um território"><input type="number" min="1" max="365" required aria-describedby="ajuda-intervalo-territorio" className={fieldControl} value={config.intervalo} onChange={e => change({ intervalo: e.target.value })} /><span id="ajuda-intervalo-territorio" className="text-xs text-gray-500">Ex.: 14 evita sugerir o mesmo território em saídas separadas por menos de 14 dias.</span></BatchField>
    </div>
    <div className="space-y-3"><h3 className="font-medium">Dias e horários que se repetem no período</h3><p className="text-sm text-gray-500">Cada horário cria uma saída em todas as datas daquele dia da semana entre o início e o fim escolhidos.</p>{config.regras.map((rule, index) => <div key={index} className="space-y-3 rounded-lg border border-gray-200 p-3">
      <div className={`${alignedFields} sm:grid-cols-2 lg:grid-cols-4`}>
        <BatchField label="Dia da semana"><select className={fieldControl} value={rule.dia} onChange={e => changeRule(index, { dia: Number(e.target.value) })}>{days.map((day, i) => <option key={day} value={i}>{day}</option>)}</select></BatchField>
        <BatchField label="Horário"><input type="time" required className={fieldControl} value={rule.horario} onChange={e => changeRule(index, { horario: e.target.value })} /></BatchField>
        <BatchField label="Quantidade de territórios por saída"><input type="number" min="1" max="100" required aria-describedby={`ajuda-quantidade-${index}`} className={fieldControl} value={rule.quantidade} onChange={e => changeRule(index, { quantidade: e.target.value })} /><span id={`ajuda-quantidade-${index}`} className="text-xs text-gray-500">Digite 1 para sugerir um território em cada data. Digitar 24 pede 24 territórios; não escolhe o território nº 24.</span></BatchField>
        <BatchField label="Local da consideração"><select className={fieldControl} value={rule.local_id} onChange={e => {
          const local = data.locais.find(l => l.id === Number(e.target.value)); changeRule(index, { local_id: e.target.value, grupos: local?.grupos || [] });
        }}><option value="">A definir</option>{data.locais.filter(l => l.ativo).map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></BatchField>
      </div>
      <fieldset><legend className="mb-2 text-sm">Grupos (nenhum = congregação)</legend><div className="flex flex-wrap gap-3">{data.grupos.filter(g => g.ativo).map(g => <label key={g.id} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={rule.grupos.includes(g.id)} onChange={e => changeRule(index, { grupos: e.target.checked ? [...rule.grupos, g.id] : rule.grupos.filter(id => id !== g.id) })} />{g.nome}</label>)}</div></fieldset>
      <Button type="button" variant="outline" disabled={config.regras.length === 1} onClick={() => change({ regras: config.regras.filter((_, i) => i !== index) })}>Remover horário</Button>
    </div>)}<Button type="button" variant="outline" disabled={config.regras.length >= 21} onClick={() => change({ regras: [...config.regras, newRule()] })}>Adicionar horário</Button></div>
    <details className="rounded-lg border border-gray-200 p-3"><summary className="cursor-pointer font-medium">Territórios durante a semana e no fim de semana</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{data.territorios.filter(t => t.ativo).map(t => <BatchField key={t.id} label={`Território ${t.numero}`}><select className={fieldControl} value={periods[t.id]} onChange={e => { setPeriods(current => ({ ...current, [t.id]: e.target.value })); setPreview(null); }}>{Object.entries(TERRITORY_PERIODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></BatchField>)}</div></details>
    <p className="text-sm text-gray-500">Territórios entregues e ainda não concluídos ficam fora da sugestão. O intervalo para repetir considera as conclusões e as saídas já planejadas. Se a quantidade disponível for menor que a pedida, você verá um aviso.</p>
    <p className="text-sm text-gray-500">No sábado e no domingo, as sugestões usam apenas os territórios vinculados no mapa aos grupos selecionados. Adicione um horário para cada grupo, mesmo que saiam na mesma hora. Sem grupos selecionados, a saída é da congregação e pode usar territórios de qualquer grupo.</p>
    <p className="text-sm text-gray-500">As opções de uso durante a semana ou no fim de semana serão salvas no cadastro dos territórios ao salvar a programação.</p>
    <Button type="button" variant="outline" onClick={() => { try { setError(''); setPreview(generateFieldSchedule(data, { ...config, periodos: periods })); } catch (err) { setError(err.message); } }}>Sugerir territórios e conferir saídas</Button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {preview && <div className="space-y-3"><h3 className="font-medium">Confira {preview.rows.length} saída(s)</h3>{preview.warnings.length > 0 && <div role="status" className="space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{preview.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</div>}
      {preview.rows.map((row, index) => <div key={`${row.data}-${row.horario}-${index}`} className="grid items-end gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="text-sm"><p className="font-medium">{row.data.split('-').reverse().join('/')} · {row.horario}</p><p>Números dos territórios sugeridos: {row.territorios.map(id => data.territorios.find(t => t.id === id)?.numero).join(', ') || 'Nenhum disponível'}</p><p className="text-gray-500">{data.locais.find(l => l.id === row.local_id)?.nome || 'Local a definir'} · {row.grupos.map(id => data.grupos.find(g => g.id === id)?.nome).join(', ') || 'Congregação'}</p></div>
        <BatchField label="Dirigente desta saída"><select className={fieldControl} value={row.dirigente_publicador_id || ''} onChange={e => changeRow(index, { dirigente_publicador_id: e.target.value })}><option value="">A definir</option>{data.publicadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></BatchField>
        <Button type="button" variant="outline" onClick={() => setPreview(current => ({ ...current, rows: current.rows.filter((_, i) => i !== index) }))}>Remover saída</Button>
      </div>)}
    </div>}
  </FieldBatchDialog>;
}
