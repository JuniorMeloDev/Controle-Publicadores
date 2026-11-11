'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleTerritoryMap } from './GoogleTerritoryMap';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { validateBoundary, checkBoundaryPlacement } from '@/app/lib/territory-boundaries';

export function TerritoryBoundaryEditor({ canEdit, onSaved, territories, onEditingChange }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState('geral');
  const [mode, setMode] = useState('');
  const [draft, setDraft] = useState(null);
  const [initialGeometry, setInitialGeometry] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
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
  const suggestion = current?.sugestao;
  const pendingProposal = data?.territorios.find(t => t.sugestao);
  const pendingCount = data?.territorios.filter(t => t.sugestao).length || 0;
  const comparisonAreas = useMemo(() => draft ? [{ id: selected, limites: draft }] : [], [draft, selected]);
  const reviewIssue = useMemo(() => {
    if (!draft || selected === 'geral' || !data) return '';
    try {
      const boundary = validateBoundary(draft);
      checkBoundaryPlacement(boundary, data.geral?.limites, data.territorios.filter(t => t.id !== selected && t.limites));
      const peer = data.territorios.find(t => t.numero === suggestion?.conflito_com);
      if (peer?.sugestao) {
        try { checkBoundaryPlacement(boundary, data.geral?.limites, [{ numero: peer.numero, limites: peer.sugestao.limites }]); }
        catch { return `A faixa comum com a sugestão do território ${peer.numero} ainda precisa ser ajustada. Volte para ajustar os pontos antes de validar.`; }
      }
      return '';
    } catch (err) { return err.message; }
  }, [draft, selected, data, suggestion]);
  function choose(value) { if (mode || busy) return; setSelected(value); setError(''); setFeedback(''); }
  function begin(next, proposal = false) {
    const geometry = next === 'edit' ? (proposal ? suggestion.limites : current.limites) : null;
    setInitialGeometry(geometry); setDraft(geometry);
    setPointCount(geometry ? geometry.coordinates[0].length - 1 : 0);
    setReviewOpen(proposal); setConfirmed(false); setMode(next); setError(''); setFeedback('');
  }
  async function save() {
    if (saving.current || !draft || (selected !== 'geral' && (!reviewOpen || !confirmed || reviewIssue))) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const revision = selected === 'geral' ? data.geral.revisao : data.territorios.find(t => t.id === selected).mapa_revisao;
      const response = await fetch('/api/admin/servico-campo/limites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ territorio: selected === 'geral' ? null : selected, revisao: revision, limites: draft }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      // Apply the acknowledged revision immediately, even if refreshing the parent fails.
      setData(old => selected === 'geral' ? { ...old, geral: { limites: draft, revisao: result.revisao } } : { ...old, territorios: old.territorios.map(t => t.id === selected ? { ...t, limites: draft, mapa_revisao: result.revisao, sugestao: null } : t) });
      setMode(''); setReviewOpen(false); setFeedback('Limites salvos.'); await onSaved();
    } catch (err) { setError(err.message || 'Não foi possível salvar os limites.'); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
    <div><h3 className="font-semibold text-gray-900">Mapa da congregação</h3><p className="mt-1 text-sm text-gray-500">Desenhe primeiro o limite geral e depois as divisas de cada território, usando os PDFs como referência.</p></div>
    {pendingProposal && !mode && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p>{pendingCount} {pendingCount === 1 ? 'território tem uma demarcação sugerida aguardando conferência' : 'territórios têm demarcações sugeridas aguardando conferência'}.</p>{selected !== pendingProposal.id && <Button type="button" variant="outline" className="mt-2" disabled={busy} onClick={() => choose(pendingProposal.id)}>Ver território {pendingProposal.numero}</Button>}</div>}
    {data && <div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm font-medium text-gray-700">Área selecionada<select disabled={Boolean(mode) || busy} className="rounded-lg border border-gray-300 bg-white p-2" value={selected} onChange={e => choose(e.target.value === 'geral' ? 'geral' : Number(e.target.value))}><option value="geral">Limite geral da congregação</option>{data.territorios.map(t => <option key={t.id} value={t.id}>Território {t.numero}{t.limites ? ' · Desenhado' : t.sugestao ? ' · A validar' : ' · Pendente'}{!t.ativo ? ' · Inativo' : ''}</option>)}</select></label><span className="pb-2 text-sm text-gray-500">{data.territorios.filter(t => t.limites).length} de {data.territorios.length} territórios desenhados</span></div>}
    {suggestion && <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-slate-800"><h4 className="font-semibold">{suggestion.titulo}</h4><p>Divisas no PDF: {suggestion.divisas.join('; ')}.</p><p>{suggestion.observacao}</p><p>O contorno só será publicado após você validar e salvar.</p>{canEdit && key && !mode && <Button type="button" variant="outline" disabled={busy || !data.geral?.limites} onClick={() => begin('edit', true)}>Conferir demarcação sugerida</Button>}</div>}
    <GoogleTerritoryMap areas={areas} selected={selected} mode={mode} initialGeometry={initialGeometry} onChange={value => { setDraft(value); setConfirmed(false); }} onSelect={choose} pointCount={pointCount} onPointCountChange={setPointCount} focusBoundary={data?.geral?.limites || null} />
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{feedback && <p role="status" className="text-sm text-green-700">{feedback}</p>}
    {data && <div className="flex flex-wrap items-center gap-3"><a className="text-sm text-purple-700 underline" href={`/api/admin/servico-campo/mapas${selected === 'geral' ? '' : `?territorio=${selected}`}`} target="_blank" rel="noopener noreferrer">Abrir PDF de referência</a>{canEdit && key && !mode && <><Button type="button" disabled={selected !== 'geral' && !data.geral?.limites} onClick={() => begin('draw')} variant="outline">{current?.limites ? 'Redesenhar limite' : 'Desenhar limite'}</Button>{current?.limites && <Button type="button" variant="outline" onClick={() => begin('edit')}>Ajustar pontos</Button>}</>}{mode && <><Button type="button" disabled={busy || !draft} onClick={() => { if (selected === 'geral') save(); else { setConfirmed(false); setReviewOpen(true); } }} className="bg-purple-600 text-white">{busy ? 'Salvando…' : selected === 'geral' ? 'Salvar limites' : 'Validar limites'}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { setMode(''); setDraft(null); setReviewOpen(false); setConfirmed(false); setError(''); }}>Cancelar edição</Button></>}</div>}
    {mode && <p className="text-sm text-orange-800">{mode === 'draw' ? 'Clique nas divisas para adicionar os pontos. Com pelo menos três pontos, salve o contorno.' : 'Arraste os pontos para ajustar as divisas; use os pontos intermediários para adicionar vértices.'} Clique com o botão direito em um ponto para removê-lo. A edição só será publicada ao salvar.</p>}
    {data && !data.geral?.limites && <p className="text-sm text-gray-500">Os territórios individuais serão liberados para desenho após salvar o limite geral.</p>}
    <Dialog open={reviewOpen} onOpenChange={open => { if (!busy) { setReviewOpen(open); setConfirmed(false); } }}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-[1500px] max-h-[96dvh] overflow-y-auto bg-white p-4 text-gray-900 sm:p-6" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => event.preventDefault()}>
        <DialogHeader><DialogTitle>Validar território {current?.numero}</DialogTitle><DialogDescription>Compare as ruas e o contorno azul com o cartão PDF. O contorno só será salvo quando você confirmar.</DialogDescription></DialogHeader>
        {suggestion?.observacao && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{suggestion.observacao}</p>}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="min-w-0 space-y-2"><h4 className="text-sm font-semibold">Mapa do território e ruas das divisas</h4><GoogleTerritoryMap areas={comparisonAreas} selected={selected} appearance="territory-review" heightClassName="h-[min(46dvh,460px)] min-h-[260px]" /></section>
          <section className="min-w-0 space-y-2"><div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Cartão PDF original</h4><a className="text-sm text-purple-700 underline" href={`/api/admin/servico-campo/mapas?territorio=${selected}`} target="_blank" rel="noopener noreferrer">Abrir PDF</a></div><iframe title={`PDF de referência do território ${current?.numero}`} src={`/api/admin/servico-campo/mapas?territorio=${selected}#view=Fit&navpanes=0`} className="h-[min(46dvh,460px)] min-h-[260px] w-full rounded-xl border border-gray-200" /></section>
        </div>
        {reviewIssue && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{reviewIssue}</p>}
        {suggestion?.conflito_com && <a className="text-sm text-purple-700 underline" href={`/api/admin/servico-campo/mapas?territorio=${data?.territorios.find(t => t.numero === suggestion.conflito_com)?.id}`} target="_blank" rel="noopener noreferrer">Comparar também com o PDF do território {suggestion.conflito_com}</a>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={busy || Boolean(reviewIssue)} onChange={event => setConfirmed(event.target.checked)} />Conferi o contorno no mapa e as divisas do cartão PDF.</label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => { setReviewOpen(false); setConfirmed(false); }}>Voltar para ajustar pontos</Button><Button type="button" disabled={!canEdit || busy || !draft || !confirmed || Boolean(reviewIssue)} onClick={save} className="bg-purple-600 text-white">{busy ? 'Salvando…' : 'Validar e salvar limites'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
