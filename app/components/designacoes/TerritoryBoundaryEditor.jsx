'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleTerritoryMap } from './GoogleTerritoryMap';
import { Button } from '@/app/components/ui/button';
import { StatusToast } from '@/app/components/ui/status-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { validateBoundary, checkBoundaryPlacement } from '@/app/lib/territory-boundaries';
import { boundaryOverlap, firstBoundaryConflict, removeBoundaryOverlap, fitBoundaryToGeneral, repairBoundaryCrossings } from '@/app/lib/territory-boundary-conflicts';
import { territoryReferenceOptions } from '@/app/lib/territory-reference-selection';
import { TerritoryReferencePicker } from './TerritoryReferencePicker';

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
  const [referenceIds,setReferenceIds]=useState([]);
  const [focusedReferenceId,setFocusedReferenceId]=useState(null);
  const saving = useRef(false);
  const drafts = useRef(new Map());
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
  const correctedPdf = current?.numero === 19;
  const correctedPdfNotice = 'As divisas corretas do território 19 são Beira-Mar e Av. Presidente Castelo Branco. O PDF original contém nomes de ruas incorretos; use as divisas corrigidas para conferir o mapa.';
  const pendingProposal = data?.territorios.find(t => t.sugestao);
  const pendingCount = data?.territorios.filter(t => t.sugestao).length || 0;
  const conflict = useMemo(() => {
    if (selected === 'geral') return null;
    try { return firstBoundaryConflict(draft, (data?.territorios || []).filter(t => t.id !== selected && !(current?.numero === 19 && t.numero === 18))); }
    catch { return null; }
  }, [draft, data, selected, current?.numero]);
  const conflictPeer = conflict?.territory;
  const peerGeometry = conflictPeer?.limites;
  const overlap = conflict?.overlap;
  // Keep the editable polygon stable while its vertices update the draft.
  const comparisonAreas = useMemo(() => initialGeometry ? [{ id: selected, limites: initialGeometry }] : [], [initialGeometry, selected]);
  const referencePreview=useMemo(()=>{
    if(!draft||selected==='geral')return {options:[], pending:false};
    try{return {options:territoryReferenceOptions(draft,current?.mapa_layout),pending:false};}
    catch {
      // A crossing during a drag must not make all references disappear.
      for (const geometry of [draft, initialGeometry, current?.limites, suggestion?.limites]) {
        try { return {options:territoryReferenceOptions(repairBoundaryCrossings(geometry),current?.mapa_layout),pending:true}; }
        catch { /* Try a valid outline already available for this territory. */ }
      }
      return {options:[],pending:true};
    }
  },[draft,selected,initialGeometry,current?.limites,current?.mapa_layout,suggestion?.limites]);
  const referenceOptions = referencePreview.options;
  const availableReferenceIds=referenceIds.filter(id=>referenceOptions.some(option=>option.id===id));
  const referenceMarkers=useMemo(()=>referenceOptions.map(option=>({...option,selected:referenceIds.includes(option.id)})),[referenceOptions,referenceIds]);
  const manualBorder18 = useMemo(() => {
    if (current?.numero !== 19) return false;
    try { return Boolean(boundaryOverlap(draft, data?.territorios.find(t => t.numero === 18)?.limites)); }
    catch { return false; }
  }, [current?.numero, draft, data]);
  const reviewIssue = useMemo(() => {
    if (!draft || selected === 'geral' || !data) return '';
    try {
      const boundary = validateBoundary(draft);
      checkBoundaryPlacement(boundary, data.geral?.limites, data.territorios.filter(t => t.id !== selected && t.limites && !(manualBorder18 && t.numero === 18)));
      return '';
    } catch (err) { return err.message; }
  }, [draft, selected, data, manualBorder18]);
  function choose(value) {
    if (busy || value === selected) return;
    if (mode) drafts.current.set(selected, { geometry: draft, referenceIds, mode });
    const target = areas.find(area => area.id === value);
    const savedDraft = drafts.current.get(value);
    const geometry = savedDraft ? savedDraft.geometry : target?.limites || target?.sugestao?.limites || null;
    if (mode || savedDraft) {
      let options = [];
      try { if (geometry && value !== 'geral') options = territoryReferenceOptions(geometry, target?.mapa_layout); } catch { /* An unfinished draft can still be resumed. */ }
      setReferenceIds(savedDraft?.referenceIds ?? target?.mapa_layout?.selectedReferenceIds ?? (target?.limites ? options.map(option => option.id) : []));
      setInitialGeometry(geometry); setDraft(geometry);
      setPointCount(geometry ? geometry.coordinates[0].length - 1 : 0);
      setMode(savedDraft?.mode || (geometry ? 'edit' : 'draw'));
      setReviewOpen((reviewOpen || Boolean(savedDraft)) && value !== 'geral' && Boolean(geometry));
    }
    setSelected(value); setConfirmed(false); setFocusedReferenceId(null); setError(''); setFeedback('');
  }
  function returnToMap() {
    setInitialGeometry(draft); setReviewOpen(false); setConfirmed(false);
    if (mode === 'references') setMode('');
  }
  function removeSharedStrip() {
    if (busy || !overlap) return;
    try {
      const geometry = removeBoundaryOverlap(draft, peerGeometry);
      setInitialGeometry(geometry); setDraft(geometry); setMode('edit');
      setPointCount(geometry.coordinates[0].length - 1);
      setConfirmed(false); setFocusedReferenceId(null); setError('');
    } catch (err) { setError(err.message); }
  }
  function fitToGeneral() {
    if (busy || !draft) return;
    try {
      const geometry = fitBoundaryToGeneral(draft, data.geral?.limites);
      setInitialGeometry(geometry); setDraft(geometry); setMode('edit');
      setPointCount(geometry.coordinates[0].length - 1);
      setConfirmed(false); setFocusedReferenceId(null); setError('');
    } catch (err) { setError(err.message); }
  }
  function repairCrossings() {
    if (busy || !draft) return;
    try {
      const geometry = repairBoundaryCrossings(draft);
      setInitialGeometry(geometry); setDraft(geometry); setMode('edit');
      setPointCount(geometry.coordinates[0].length - 1);
      setConfirmed(false); setError('');
    } catch (err) { setError(err.message); }
  }
  function begin(next, proposal = false) {
    const savedDraft = next === 'draw' ? null : drafts.current.get(selected);
    const geometry = savedDraft ? savedDraft.geometry : next === 'edit'||next==='references' ? (proposal ? suggestion.limites : current.limites) : null;
    let options=[];
    try{if(geometry&&selected!=='geral')options=territoryReferenceOptions(geometry,current?.mapa_layout);}catch{/* Drawing can be completed before choosing references. */}
    const previousIds=savedDraft?.referenceIds??current?.mapa_layout?.selectedReferenceIds??(current?.limites?options.map(option=>option.id):[]);
    setReferenceIds(previousIds.filter(id=>options.some(option=>option.id===id)));
    setFocusedReferenceId(null);
    setInitialGeometry(geometry); setDraft(geometry);
    setPointCount(geometry ? geometry.coordinates[0].length - 1 : 0);
    setReviewOpen(proposal||next==='references'); setConfirmed(false); setMode(next); setError(''); setFeedback('');
  }
  async function save() {
    if (saving.current || !draft || (selected !== 'geral' && (!reviewOpen || !confirmed || reviewIssue))) return;
    saving.current = true; setInitialGeometry(draft); setBusy(true); setError('');
    try {
      const revision = selected === 'geral' ? data.geral.revisao : data.territorios.find(t => t.id === selected).mapa_revisao;
      const response = await fetch('/api/admin/servico-campo/limites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ territorio: selected === 'geral' ? null : selected, revisao: revision, limites: draft,
        ...(selected!=='geral'?{referencia_ids:availableReferenceIds,desenho_revisao:current?.mapa_layout_revisao}:{}),
        ...(manualBorder18 && confirmed ? { confirmar_divisa_com_18: true } : {}),
      }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      // Apply the acknowledged revision immediately, even if refreshing the parent fails.
      setData(old => selected === 'geral' ? { ...old, geral: { limites: draft, revisao: result.revisao } } : { ...old, territorios: old.territorios.map(t => t.id === selected ? { ...t, limites: draft, mapa_revisao: result.revisao, sugestao: null,mapa_layout:result.mapa_layout??t.mapa_layout,mapa_layout_revisao:result.desenho_revisao??t.mapa_layout_revisao } : t) });
      drafts.current.delete(selected);
      setMode(''); setReviewOpen(false);
      setFeedback(selected === 'geral' ? 'Limites da congregação salvos com sucesso!' : `Mapa do território ${current?.numero} validado e salvo com sucesso!`);
      await onSaved();
    } catch (err) { setError(err.message || 'Não foi possível salvar os limites.'); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
    <StatusToast message={feedback} type="success" onClose={() => setFeedback('')} />
    <div><h3 className="font-semibold text-gray-900">Mapa da congregação</h3><p className="mt-1 text-sm text-gray-500">Desenhe primeiro o limite geral e depois as divisas de cada território, usando os PDFs como referência.</p></div>
    {pendingProposal && !mode && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p>{pendingCount} {pendingCount === 1 ? 'território tem uma demarcação sugerida aguardando conferência' : 'territórios têm demarcações sugeridas aguardando conferência'}.</p>{selected !== pendingProposal.id && <Button type="button" variant="outline" className="mt-2" disabled={busy} onClick={() => choose(pendingProposal.id)}>Ver território {pendingProposal.numero}</Button>}</div>}
    {data && <div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm font-medium text-gray-700">Área selecionada<select disabled={busy} className="rounded-lg border border-gray-300 bg-white p-2" value={selected} onChange={e => choose(e.target.value === 'geral' ? 'geral' : Number(e.target.value))}><option value="geral">Limite geral da congregação</option>{data.territorios.map(t => <option key={t.id} value={t.id}>Território {t.numero}{t.limites ? ' · Desenhado' : t.sugestao ? ' · A validar' : ' · Pendente'}{!t.ativo ? ' · Inativo' : ''}</option>)}</select></label><span className="pb-2 text-sm text-gray-500">{data.territorios.filter(t => t.limites).length} de {data.territorios.length} territórios desenhados</span></div>}
    {suggestion && <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-slate-800"><h4 className="font-semibold">{suggestion.titulo}</h4><p>Divisas de referência: {suggestion.divisas.join('; ')}.</p><p>{suggestion.observacao}</p><p>O contorno só será publicado após você validar e salvar.</p>{canEdit && key && !mode && <Button type="button" variant="outline" disabled={busy || !data.geral?.limites} onClick={() => begin('edit', true)}>Conferir demarcação sugerida</Button>}</div>}
    <GoogleTerritoryMap areas={areas} selected={selected} mode={reviewOpen||mode==='references'?'':mode} initialGeometry={initialGeometry} onChange={value => { setDraft(value); setConfirmed(false); }} onSelect={choose} pointCount={pointCount} onPointCountChange={setPointCount} focusBoundary={data?.geral?.limites || null} />
    {selected!=='geral'&&current?.limites&&canEdit&&key&&!mode&&<Button type="button" variant="outline" disabled={busy} onClick={()=>begin('references')}>Escolher referências</Button>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{feedback && <p role="status" className="text-sm text-green-700">{feedback}</p>}
    {data && <div className="flex flex-wrap items-center gap-3"><a className="text-sm text-purple-700 underline" href={`/api/admin/servico-campo/mapas${selected === 'geral' ? '' : `?territorio=${selected}`}`} target="_blank" rel="noopener noreferrer">Abrir PDF de referência</a>{canEdit && key && !mode && <><Button type="button" disabled={selected !== 'geral' && !data.geral?.limites} onClick={() => begin('draw')} variant="outline">{current?.limites ? 'Redesenhar limite' : 'Desenhar limite'}</Button>{current?.limites && <Button type="button" variant="outline" onClick={() => begin('edit')}>Ajustar pontos</Button>}</>}{mode && <><Button type="button" disabled={busy || !draft} onClick={() => { if (selected === 'geral') save(); else { setInitialGeometry(draft); setConfirmed(false); setReviewOpen(true); } }} className="bg-purple-600 text-white">{busy ? 'Salvando…' : selected === 'geral' ? 'Salvar limites' : 'Validar limites'}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { drafts.current.delete(selected); setMode(''); setDraft(null); setReviewOpen(false); setConfirmed(false); setError(''); }}>Cancelar edição</Button></>}</div>}
    {mode&&mode!=='references' && <p className="text-sm text-orange-800">{mode === 'draw' ? 'Clique nas divisas para adicionar os pontos. Com pelo menos três pontos, salve o contorno.' : 'Arraste os pontos para ajustar as divisas; use os pontos intermediários para adicionar vértices.'} Clique com o botão direito em um ponto para removê-lo. A edição só será publicada ao salvar.</p>}
    {data && !data.geral?.limites && <p className="text-sm text-gray-500">Os territórios individuais serão liberados para desenho após salvar o limite geral.</p>}
    <Dialog open={reviewOpen} onOpenChange={open => { if (!busy) { if (!open) returnToMap(); else setReviewOpen(true); } }}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-[1500px] max-h-[96dvh] overflow-y-auto bg-white p-4 text-gray-900 sm:p-6" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => event.preventDefault()}>
        <DialogHeader><DialogTitle>Validar território {current?.numero}</DialogTitle><DialogDescription>Compare as ruas e o contorno com o cartão PDF. O contorno só será salvo quando você confirmar.</DialogDescription></DialogHeader>
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white py-3">
          <label className="flex items-center gap-2 text-sm font-medium">Território
            <select aria-label="Território em validação" disabled={busy} className="rounded-lg border border-gray-300 bg-white p-2" value={selected} onChange={event => choose(Number(event.target.value))}>
              {areas.filter(area => area.id !== 'geral' && (area.limites || area.sugestao || area.id === selected)).map(area => <option key={area.id} value={area.id}>Território {area.numero}</option>)}
            </select>
          </label>
          {mode === 'references' && <Button type="button" variant="outline" disabled={busy} onClick={() => { setInitialGeometry(draft); setMode('edit'); }}>Ajustar pontos</Button>}
          <p className="text-sm text-gray-600">Ao trocar de território, seus ajustes ficam em rascunho enquanto esta página estiver aberta. Valide e salve cada território.</p>
        </div>
        {(correctedPdf || suggestion?.observacao) && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{correctedPdf ? correctedPdfNotice : suggestion.observacao}</p>}
        {overlap && <div role="alert" className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-950">
          <h4 className="font-semibold">Sobreposição com o limite salvo do território {conflictPeer.numero}</h4>
          <p>A faixa vermelha mede {conflict.areaM2.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m² ({conflict.percentage.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% deste território). O contorno laranja é o {current?.numero}; o azul é a divisa salva do {conflictPeer.numero}.</p>
          <p>Uma pequena diferença entre os pontos das divisas já pode gerar este aviso. Se a divisa salva do {conflictPeer.numero} está correta, recorte somente a faixa vermelha do {current?.numero} com o botão abaixo e confira o resultado. O território {conflictPeer.numero} será mantido.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="border-gray-300 bg-white text-gray-900 hover:bg-gray-100 hover:text-gray-900" disabled={busy} onClick={removeSharedStrip}>Ajustar {current?.numero} à divisa salva do {conflictPeer.numero}</Button>
            <Button type="button" variant="outline" className="border-gray-300 bg-white text-gray-900 hover:bg-gray-100 hover:text-gray-900" disabled={busy} onClick={() => choose(conflictPeer.id)}>Abrir território {conflictPeer.numero} para ajustar</Button>
          </div>
          <p>Isso prepara um rascunho. O mapa só será publicado ao clicar em Validar e salvar.</p>
        </div>}
        {peerGeometry && !overlap && !reviewIssue && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-950">Não há sobreposição com o território {conflictPeer.numero}. Confira o contorno com o PDF, marque a confirmação abaixo e clique em Validar e salvar. As referências são opcionais.</p>}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="min-w-0 space-y-2"><h4 className="text-sm font-semibold">Mapa do território e ruas das divisas</h4><GoogleTerritoryMap areas={comparisonAreas} selected={selected} mode={!busy && mode !== 'references' ? 'edit' : ''} initialGeometry={initialGeometry} onChange={value => { setDraft(value); setConfirmed(false); }} pointCount={pointCount} onPointCountChange={setPointCount} appearance="territory-review" overlapGeometry={overlap} neighborGeometry={peerGeometry} heightClassName="h-[min(46dvh,460px)] min-h-[260px]" references={referenceMarkers} focusedReferenceId={focusedReferenceId} onReferenceClick={setFocusedReferenceId} /></section>
          <section className="min-w-0 space-y-2"><div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Cartão PDF original</h4><a className="text-sm text-purple-700 underline" href={`/api/admin/servico-campo/mapas?territorio=${selected}`} target="_blank" rel="noopener noreferrer">Abrir PDF</a></div><iframe title={`PDF de referência do território ${current?.numero}`} src={`/api/admin/servico-campo/mapas?territorio=${selected}#view=Fit&navpanes=0`} className="h-[min(46dvh,460px)] min-h-[260px] w-full rounded-xl border border-gray-200" /></section>
        </div>
        {mode !== 'references' && <p className="text-sm text-orange-800">Arraste os pontos laranja no mapa para ajustar as divisas. Use os pontos intermediários para adicionar vértices ou clique com o botão direito em um ponto para removê-lo.</p>}
        {referencePreview.pending && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">As referências abaixo usam uma prévia do contorno corrigido. Clique em Corrigir cruzamentos para aplicar a correção ao mapa e conferir antes de salvar.</p>}
        <TerritoryReferencePicker options={referenceOptions} selectedIds={availableReferenceIds} onChange={setReferenceIds} focusedId={focusedReferenceId} onFocus={setFocusedReferenceId} disabled={busy} />
        {suggestion?.conflito_com && <a className="text-sm text-purple-700 underline" href={`/api/admin/servico-campo/mapas?territorio=${data?.territorios.find(t => t.numero === suggestion.conflito_com)?.id}`} target="_blank" rel="noopener noreferrer">Comparar também com o PDF do território {suggestion.conflito_com}</a>}
        <DialogFooter className="sticky bottom-0 z-20 flex-col gap-3 border-t border-gray-200 bg-white py-3 sm:flex-col sm:space-x-0">
          {manualBorder18 && !reviewIssue && <p className="w-full text-sm text-gray-600">Divisa do 19 com o 18 conferida manualmente: o salvamento está liberado após a confirmação abaixo. O território 18 não será alterado.</p>}
          {(reviewIssue || error) && <div role="alert" className="w-full space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            <p>{error || reviewIssue}</p>
            {overlap && <Button type="button" variant="outline" className="border-gray-300 bg-white text-gray-900 hover:bg-gray-100" disabled={busy} onClick={removeSharedStrip}>Ajustar divisa com o {conflictPeer.numero}</Button>}
            {(reviewIssue.includes('cruzamentos') || reviewIssue.includes('pontos repetidos')) && <Button type="button" variant="outline" className="border-gray-300 bg-white text-gray-900 hover:bg-gray-100" disabled={busy} onClick={repairCrossings}>Corrigir cruzamentos</Button>}
            {reviewIssue.includes('limite geral') && <><p>Parte do contorno está fora da área cadastrada da congregação. Se o limite geral está correto, recorte o rascunho para caber nele. Se ele está errado, corrija o limite geral antes de salvar este território.</p><Button type="button" variant="outline" className="border-gray-300 bg-white text-gray-900 hover:bg-gray-100" disabled={busy} onClick={fitToGeneral}>Recortar ao limite geral cadastrado</Button></>}
          </div>}
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-purple-600" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />{manualBorder18 ? 'Confirmo o contorno do 19 e a divisa com o território 18 conforme meu ajuste manual.' : 'Conferi o contorno no mapa e as divisas corretas do território.'}</label>
            <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={returnToMap}>{mode==='references'?'Cancelar':'Voltar para ajustar pontos'}</Button><Button type="button" disabled={!canEdit || busy || !draft || !confirmed || Boolean(reviewIssue)} onClick={save} className="bg-purple-600 text-white">{busy ? 'Salvando…' : 'Validar e salvar'}</Button></div>
          </div>
          {!reviewIssue && !error && !confirmed && <p className="w-full text-sm text-gray-600">Marque a confirmação acima para habilitar Validar e salvar.</p>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
