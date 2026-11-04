'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { generateFieldSchedule, TERRITORY_PERIODS, territoryPeriod } from '@/app/lib/field-planner';
import { BatchField, FieldBatchDialog, fieldControl, saveFieldBatch } from './FieldBatchDialog';

const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const newRule = () => ({ dia: 6, horario: '08:30', quantidade: 4, grupos: [], local_id: '' });

export function FieldScheduleGenerator({ data, onClose, onSaved }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const monthEnd = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const [config, setConfig] = useState({ inicio: today, fim: monthEnd, intervalo: 14, regras: [newRule()] });
  const [periods, setPeriods] = useState(Object.fromEntries(data.territorios.filter(t => t.ativo).map(t => [t.id, territoryPeriod(t)])));
  const [preview, setPreview] = useState(null), [error, setError] = useState('');
  const change = patch => { setConfig(current => ({ ...current, ...patch })); setPreview(null); setError(''); };
  const changeRule = (index, patch) => change({ regras: config.regras.map((rule, i) => i === index ? { ...rule, ...patch } : rule) });
  const changeRow = (index, patch) => setPreview(current => ({ ...current, rows: current.rows.map((row, i) => i === index ? { ...row, ...patch } : row) }));
  return <FieldBatchDialog title="Gerar programação de campo" description="Defina as saídas e os territórios permitidos. A prévia prioriza os menos recentes e deixa os dirigentes a definir. As regras dos territórios serão salvas junto com a programação."
    onClose={onClose} disabled={!preview?.rows.length} saveLabel="Salvar programação em lote" onSave={async () => {
      if (preview.rows.some(row => !row.territorios.length)) throw new Error('Remova as saídas sem territórios ou ajuste as regras e gere novamente.');
      const result = await saveFieldBatch({ entity: 'saidas', action: 'batch', records: preview.rows, periodos: periods, intervalo: config.intervalo });
      await onSaved(`${result.ids.length} saída(s) criada(s).`); onClose();
    }}>
    <div className="grid gap-3 sm:grid-cols-3">
      <BatchField label="Início"><input type="date" required className={fieldControl} value={config.inicio} onChange={e => change({ inicio: e.target.value })} /></BatchField>
      <BatchField label="Fim (até 93 dias)"><input type="date" required min={config.inicio} className={fieldControl} value={config.fim} onChange={e => change({ fim: e.target.value })} /></BatchField>
      <BatchField label="Intervalo mínimo entre usos (dias)"><input type="number" min="1" max="365" required className={fieldControl} value={config.intervalo} onChange={e => change({ intervalo: e.target.value })} /></BatchField>
    </div>
    <div className="space-y-3"><h3 className="font-medium">Dias e horários das saídas</h3>{config.regras.map((rule, index) => <div key={index} className="space-y-3 rounded-lg border border-gray-200 p-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <BatchField label="Dia"><select className={fieldControl} value={rule.dia} onChange={e => changeRule(index, { dia: Number(e.target.value) })}>{days.map((day, i) => <option key={day} value={i}>{day}</option>)}</select></BatchField>
        <BatchField label="Horário"><input type="time" required className={fieldControl} value={rule.horario} onChange={e => changeRule(index, { horario: e.target.value })} /></BatchField>
        <BatchField label="Territórios por saída"><input type="number" min="1" max="100" required className={fieldControl} value={rule.quantidade} onChange={e => changeRule(index, { quantidade: e.target.value })} /></BatchField>
        <BatchField label="Local"><select className={fieldControl} value={rule.local_id} onChange={e => {
          const local = data.locais.find(l => l.id === Number(e.target.value)); changeRule(index, { local_id: e.target.value, grupos: local?.grupos || [] });
        }}><option value="">A definir</option>{data.locais.filter(l => l.ativo).map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></BatchField>
      </div>
      <fieldset><legend className="mb-2 text-sm">Grupos (nenhum = congregação)</legend><div className="flex flex-wrap gap-3">{data.grupos.filter(g => g.ativo).map(g => <label key={g.id} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={rule.grupos.includes(g.id)} onChange={e => changeRule(index, { grupos: e.target.checked ? [...rule.grupos, g.id] : rule.grupos.filter(id => id !== g.id) })} />{g.nome}</label>)}</div></fieldset>
      <Button type="button" variant="outline" disabled={config.regras.length === 1} onClick={() => change({ regras: config.regras.filter((_, i) => i !== index) })}>Remover horário</Button>
    </div>)}<Button type="button" variant="outline" disabled={config.regras.length >= 21} onClick={() => change({ regras: [...config.regras, newRule()] })}>Adicionar horário</Button></div>
    <details className="rounded-lg border border-gray-200 p-3"><summary className="cursor-pointer font-medium">Territórios durante a semana e no fim de semana</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{data.territorios.filter(t => t.ativo).map(t => <BatchField key={t.id} label={`Território ${t.numero}`}><select className={fieldControl} value={periods[t.id]} onChange={e => { setPeriods(current => ({ ...current, [t.id]: e.target.value })); setPreview(null); }}>{Object.entries(TERRITORY_PERIODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></BatchField>)}</div></details>
    <p className="text-sm text-gray-500">Territórios com entrega pendente ficam fora da sugestão. Saídas já planejadas também contam no intervalo. Quando faltarem territórios, a prévia avisará.</p>
    <Button type="button" variant="outline" onClick={() => { try { setError(''); setPreview(generateFieldSchedule(data, { ...config, periodos: periods })); } catch (err) { setError(err.message); } }}>Gerar prévia</Button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {preview && <div className="space-y-3"><h3 className="font-medium">Confira {preview.rows.length} saída(s)</h3>{preview.warnings.length > 0 && <div role="status" className="space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{preview.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</div>}
      {preview.rows.map((row, index) => <div key={`${row.data}-${row.horario}-${index}`} className="grid items-end gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="text-sm"><p className="font-medium">{row.data.split('-').reverse().join('/')} · {row.horario}</p><p>Territórios: {row.territorios.map(id => data.territorios.find(t => t.id === id)?.numero).join(', ') || 'Nenhum disponível'}</p><p className="text-gray-500">{data.locais.find(l => l.id === row.local_id)?.nome || 'Local a definir'} · {row.grupos.map(id => data.grupos.find(g => g.id === id)?.nome).join(', ') || 'Congregação'}</p></div>
        <BatchField label="Dirigente"><select className={fieldControl} value={row.dirigente_publicador_id || ''} onChange={e => changeRow(index, { dirigente_publicador_id: e.target.value })}><option value="">A definir</option>{data.publicadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></BatchField>
        <Button type="button" variant="outline" onClick={() => setPreview(current => ({ ...current, rows: current.rows.filter((_, i) => i !== index) }))}>Remover saída</Button>
      </div>)}
    </div>}
  </FieldBatchDialog>;
}
