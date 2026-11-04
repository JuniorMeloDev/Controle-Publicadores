'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleTerritoryMap } from './GoogleTerritoryMap';
import { Button } from '@/app/components/ui/button';

export function TerritoryBoundaryEditor({ canEdit, onSaved, territories, onEditingChange }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState('geral');
  const [mode, setMode] = useState('');
  const [draft, setDraft] = useState(null);
  const [pointCount, setPointCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const saving = useRef(false);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/servico-campo/limites', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const result = await response.json(); if (!response.ok) throw new Error(result.message); setData(result);
    }).catch(err => { if (err.name !== 'AbortError') setError(err.message); });
    return () => controller.abort();
  }, [territories]);
  useEffect(() => { onEditingChange?.(Boolean(mode)); return () => onEditingChange?.(false); }, [mode, onEditingChange]);
  useEffect(() => {
    if (!mode) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [mode]);
  const areas = useMemo(() => data ? [{ id: 'geral', numero: 'Geral', limites: data.geral?.limites }, ...data.territorios.filter(t => t.ativo || t.limites)] : [], [data]);
  const current = areas.find(a => a.id === selected);
  function choose(value) { if (mode || busy) return; setSelected(value); setError(''); setFeedback(''); }
  function begin(next) { setDraft(next === 'edit' ? current.limites : null); setPointCount(next === 'edit' ? current.limites.coordinates[0].length - 1 : 0); setMode(next); setError(''); setFeedback(''); }
  async function save() {
    if (saving.current || !draft) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const revision = selected === 'geral' ? data.geral.revisao : data.territorios.find(t => t.id === selected).mapa_revisao;
      const response = await fetch('/api/admin/servico-campo/limites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ territorio: selected === 'geral' ? null : selected, revisao: revision, limites: draft }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      // Apply the acknowledged revision immediately, even if refreshing the parent fails.
      setData(old => selected === 'geral' ? { ...old, geral: { limites: draft, revisao: result.revisao } } : { ...old, territorios: old.territorios.map(t => t.id === selected ? { ...t, limites: draft, mapa_revisao: result.revisao } : t) });
      setMode(''); setFeedback('Limites salvos.'); await onSaved();
    } catch (err) { setError(err.message || 'Não foi possível salvar os limites.'); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
    <div><h3 className="font-semibold text-gray-900">Mapa da congregação</h3><p className="mt-1 text-sm text-gray-500">Desenhe primeiro o limite geral e depois as divisas de cada território, usando os PDFs como referência.</p></div>
    {data && <div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm font-medium text-gray-700">Área selecionada<select disabled={Boolean(mode) || busy} className="rounded-lg border border-gray-300 bg-white p-2" value={selected} onChange={e => choose(e.target.value === 'geral' ? 'geral' : Number(e.target.value))}><option value="geral">Limite geral da congregação</option>{data.territorios.map(t => <option key={t.id} value={t.id}>Território {t.numero}{t.limites ? ' · Desenhado' : ' · Pendente'}{!t.ativo ? ' · Inativo' : ''}</option>)}</select></label><span className="pb-2 text-sm text-gray-500">{data.territorios.filter(t => t.limites).length} de {data.territorios.length} territórios desenhados</span></div>}
    <GoogleTerritoryMap areas={areas} selected={selected} mode={mode} initialGeometry={current?.limites || null} onChange={setDraft} onSelect={choose} pointCount={pointCount} onPointCountChange={setPointCount} focusBoundary={data?.geral?.limites || null} />
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{feedback && <p role="status" className="text-sm text-green-700">{feedback}</p>}
    {data && <div className="flex flex-wrap items-center gap-3"><a className="text-sm text-purple-700 underline" href={`/api/admin/servico-campo/mapas${selected === 'geral' ? '' : `?territorio=${selected}`}`} target="_blank" rel="noopener noreferrer">Abrir PDF de referência</a>{canEdit && key && !mode && <><Button type="button" disabled={selected !== 'geral' && !data.geral?.limites} onClick={() => begin('draw')} variant="outline">{current?.limites ? 'Redesenhar limite' : 'Desenhar limite'}</Button>{current?.limites && <Button type="button" variant="outline" onClick={() => begin('edit')}>Ajustar pontos</Button>}</>}{mode && <><Button type="button" disabled={busy || !draft} onClick={save} className="bg-purple-600 text-white">{busy ? 'Salvando…' : 'Salvar limites'}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { setMode(''); setDraft(null); setError(''); }}>Cancelar edição</Button></>}</div>}
    {mode && <p className="text-sm text-orange-800">{mode === 'draw' ? 'Clique nas divisas para adicionar os pontos. Com pelo menos três pontos, salve o contorno.' : 'Arraste os pontos para ajustar as divisas; use os pontos intermediários para adicionar vértices.'} Clique com o botão direito em um ponto para removê-lo. A edição só será publicada ao salvar.</p>}
    {data && !data.geral?.limites && <p className="text-sm text-gray-500">Os territórios individuais serão liberados para desenho após salvar o limite geral.</p>}
  </section>;
}
