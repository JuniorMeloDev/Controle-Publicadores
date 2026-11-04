export function lookupPoint(boundary,side) {
  const ring=boundary?.coordinates?.[0];
  if(!ring||!Number.isInteger(side)||side<0||side>=ring.length-1)throw new Error('Escolha um trecho do limite geográfico.');
  const a=ring[side],b=ring[side+1];
  return {lat:(a[1]+b[1])/2,lng:(a[0]+b[0])/2};
}
export function streetCandidates(results) {
  const candidates=[];const seen=new Set();
  const ordered=[...results].sort((a,b)=>Number(Boolean(b.types?.includes('route')))-Number(Boolean(a.types?.includes('route'))));
  for(const result of ordered){
    const route=result.address_components?.find(c=>c.types?.includes('route'));
    if(!route?.long_name||!result.place_id||seen.has(route.long_name))continue;
    seen.add(route.long_name);candidates.push({name:route.long_name,placeId:result.place_id});
    if(candidates.length===5)break;
  }
  return candidates;
}
export function geocodingMessage(code) {
  if(/REQUEST_DENIED|API_KEY|Referer|ApiNotActivated|Geocoding Service/i.test(code))return 'O Google recusou a consulta. Confira se a Geocoding API está ativa no mesmo projeto da chave e incluída nas restrições de API dessa chave.';
  if(/OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED|OVER_DAILY_LIMIT/i.test(code))return 'A cota de consultas ao Google foi atingida. Tente novamente após a renovação da cota.';
  if(/ZERO_RESULTS/i.test(code))return 'O Google não encontrou uma rua para este ponto. Escolha outro trecho para conferir.';
  return 'Não foi possível consultar a rua no Google. Verifique a conexão e tente novamente.';
}
