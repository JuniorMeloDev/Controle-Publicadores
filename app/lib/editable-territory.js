const error = message => { throw new Error(message); };
export function automaticReferenceGroups(landmarks) {
  const groups=[];
  for(const marker of landmarks.filter(item=>item.id.startsWith('osm-point-'))){
    let group=groups.find(item=>Math.hypot(item.position[0]-marker.position[0],item.position[1]-marker.position[1])<42);
    if(!group){group={number:groups.length+1,position:[...marker.position],markers:[]};groups.push(group);}
    group.markers.push(marker);
    group.position=[0,1].map(axis=>group.markers.reduce((sum,item)=>sum+item.position[axis],0)/group.markers.length);
  }
  return groups;
}

export function validateEditableLayout(value) {
  if (!value || value.version !== 1) error('Desenho inválido.');
  const point = p => {
    if(!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='number'||!Number.isFinite(n))||p[0]<0||p[0]>1000||p[1]<0||p[1]>700)error('Um ponto está fora da área do desenho.');
    return p.map(n=>Math.round(n*100)/100);
  };
  const text = (s,max=100) => {if(typeof s!=='string'||!s.trim()||s.trim().length>max)error('Preencha os nomes com até 100 caracteres.');return s.trim();};
  const id = s => {if(typeof s!=='string'||!/^[-\w]{1,80}$/.test(s))error('Identificação de elemento inválida.');return s;};
  if(!Array.isArray(value.outline)||value.outline.length<3||value.outline.length>200)error('A forma precisa de 3 a 200 pontos.');
  const outline=value.outline.map(point);
  if(new Set(outline.map(p=>p.join(','))).size!==outline.length)error('A forma possui pontos repetidos.');
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  let area=0;
  for(let i=0;i<outline.length;i++) {
    const a=outline[i],b=outline[(i+1)%outline.length];area+=a[0]*b[1]-b[0]*a[1];
    for(let j=i+2;j<outline.length;j++) {
      if(i===0&&j===outline.length-1)continue;
      const c=outline[j],d=outline[(j+1)%outline.length];
      if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0
        &&Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))
        &&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1])))error('A forma possui linhas cruzadas.');
    }
  }
  if(Math.abs(area)<100)error('A forma precisa ter uma área visível.');
  if(!Array.isArray(value.roads)||value.roads.length>100||!Array.isArray(value.landmarks)||value.landmarks.length>100)error('Limite de 100 ruas e 100 referências por desenho.');
  const roads=value.roads.map(r=>{
    if(!Array.isArray(r.points)||r.points.length<2||r.points.length>50)error('Uma rua precisa de 2 a 50 pontos.');
    const road={id:id(r.id),name:text(r.name),points:r.points.map(point)};
    if(r.labelFontSize!==undefined){
      if(typeof r.labelFontSize!=='number'||!Number.isFinite(r.labelFontSize)||r.labelFontSize < 8||r.labelFontSize > 32)error('O tamanho da fonte deve estar entre 8 e 32.');
      road.labelFontSize=Math.round(r.labelFontSize*100)/100;
    }
    if(r.kind==='boundary')road.kind='boundary';
    if(r.googlePlaceId!==undefined){
      if(typeof r.googlePlaceId!=='string'||!/^[-\w]{1,300}$/.test(r.googlePlaceId))error('Identificação da rua no Google inválida.');
      road.googlePlaceId=r.googlePlaceId;
      if(typeof r.boundaryFingerprint!=='string'||!/^[-\w]{1,80}$/.test(r.boundaryFingerprint))error('Referência do limite inválida.');
      road.boundaryFingerprint=r.boundaryFingerprint;
      if(r.boundarySides!==undefined){
        if(!Array.isArray(r.boundarySides)||!r.boundarySides.length||r.boundarySides.length>value.outline.length||r.boundarySides.some(n=>!Number.isInteger(n)||n<0||n>=value.outline.length))error('Laterais da rua inválidas.');
        road.boundarySides=[...new Set(r.boundarySides)];
      }
    }
    return road;
  });
  const landmarks=value.landmarks.map(p=>{
    const marker={id:id(p.id),name:text(p.name),position:point(p.position),kind:['reference','school','shop','square','pharmacy','supermarket','restaurant','bakery','church','hairdresser','hospital'].includes(p.kind)?p.kind:'reference'};
    if(p.labelRotation!==undefined){
      if(typeof p.labelRotation!=='number'||!Number.isFinite(p.labelRotation)||p.labelRotation < -180||p.labelRotation > 180)error('A rotação da referência deve estar entre -180 e 180 graus.');
      marker.labelRotation=Math.round(p.labelRotation*100)/100;
    }
    if(p.labelFontSize!==undefined){
      if(typeof p.labelFontSize!=='number'||!Number.isFinite(p.labelFontSize)||p.labelFontSize < 8||p.labelFontSize > 32)error('O tamanho da fonte deve estar entre 8 e 32.');
      marker.labelFontSize=Math.round(p.labelFontSize*100)/100;
    }
    return marker;
  });
  const ids=[...roads,...landmarks].map(p=>p.id);if(new Set(ids).size!==ids.length)error('Dois elementos têm a mesma identificação.');
  const result={version:1,outline,roads,landmarks};
  if(value.autoBoundaryFingerprint!==undefined){
    if(typeof value.autoBoundaryFingerprint!=='string'||!/^[-\w]{1,80}$/.test(value.autoBoundaryFingerprint))error('Referência do contorno automático inválida.');
    result.autoBoundaryFingerprint=value.autoBoundaryFingerprint;
  }
  if(value.autoDrawingRevision!==undefined){
    if(!Number.isInteger(value.autoDrawingRevision)||value.autoDrawingRevision<1)error('Versão do cartão automático inválida.');
    result.autoDrawingRevision=value.autoDrawingRevision;
  }
  if(value.selectedReferenceIds!==undefined){
    if(!Array.isArray(value.selectedReferenceIds)||value.selectedReferenceIds.length>100||value.selectedReferenceIds.some(key=>typeof key!=='string'||!/^[-\w]{1,80}$/.test(key)))error('Seleção de referências inválida.');
    result.selectedReferenceIds=[...new Set(value.selectedReferenceIds)];
  }
  return result;
}

export function editableDrawingBounds(layout) {
  const points=[...layout.outline,...layout.roads.flatMap(r=>r.points),...layout.landmarks.flatMap(p=>{
    if(p.id.startsWith('osm-point-'))return [p.position];
    const angle=(p.labelRotation||0)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    const lines=p.name.split(/\r?\n/),size=p.labelFontSize||16,lineHeight=size*1.25;
    const top=5-(lines.length-1)*lineHeight/2-size-2,bottom=5+(lines.length-1)*lineHeight/2+4;
    const right=35+Math.max(...lines.map(line=>line.length))*size*0.65;
    return [p.position,...[[25,top],[right,top],[25,bottom],[right,bottom]].map(([x,y])=>[p.position[0]+x*cos-y*sin,p.position[1]+x*sin+y*cos])];
  })];
  const left=Math.min(...points.map(p=>p[0]))-45,top=Math.min(...points.map(p=>p[1]))-45;
  const right=Math.max(...points.map(p=>p[0]))+45,bottom=Math.max(...points.map(p=>p[1]))+45;
  return {left,top,width:Math.max(1,right-left),height:Math.max(1,bottom-top)};
}

export function boundaryFingerprint(boundary) {
  const value=JSON.stringify(boundary?.coordinates||[]);
  let hash=2166136261;
  for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16);
}

export function boundaryStreetPoints(outline,side) {
  if(!Number.isInteger(side)||side<0||side>=outline.length)throw new Error('Selecione uma lateral do desenho.');
  const a=outline[side],b=outline[(side+1)%outline.length];
  const area=outline.reduce((sum,p,i)=>sum+p[0]*outline[(i+1)%outline.length][1]-outline[(i+1)%outline.length][0]*p[1],0);
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;
  const normal=area>0?[dy/length,-dx/length]:[-dy/length,dx/length];
  const points=[a,b].map(p=>[Math.max(10,Math.min(990,p[0]+normal[0]*32)),Math.max(10,Math.min(690,p[1]+normal[1]*32))]);
  // Keep street labels readable from left to right or bottom to top.
  return points[0][0]>points[1][0]?points.reverse():points;
}

export function addGoogleBoundaryStreet(layout,street,side,fingerprint) {
  boundaryStreetPoints(layout.outline,side);
  const count=layout.outline.length,assigned=new Map();
  const sourced=road=>road.kind==='boundary'&&road.googlePlaceId;
  for(const road of layout.roads.filter(sourced)){
    const sides=road.boundarySides||[Number(road.id.match(/boundary-road-(\d+)/)?.[1])];
    for(const index of sides)if(Number.isInteger(index)&&index>=0&&index<count)assigned.set(index,{name:road.name,placeId:road.googlePlaceId,fingerprint:road.boundaryFingerprint});
  }
  assigned.set(side,{...street,fingerprint});
  const same=(a,b)=>a&&b&&a.name===b.name&&a.fingerprint===b.fingerprint;
  const visited=new Set(),roads=layout.roads.filter(r=>!sourced(r));
  let selectedId;
  for(let candidate=0;candidate<count;candidate++){
    if(!assigned.has(candidate)||visited.has(candidate))continue;
    let start=candidate;
    for(let n=0;n<count-1;n++){const prev=(start-1+count)%count;if(!same(assigned.get(prev),assigned.get(candidate))||visited.has(prev))break;start=prev;}
    const sides=[];let index=start;
    while(!visited.has(index)&&same(assigned.get(index),assigned.get(start))){sides.push(index);visited.add(index);index=(index+1)%count;}
    const segments=sides.map(edge=>{
      const p=boundaryStreetPoints(layout.outline,edge),a=layout.outline[edge];
      return Math.hypot(p[0][0]-a[0],p[0][1]-a[1])<=Math.hypot(p[1][0]-a[0],p[1][1]-a[1])?p:[...p].reverse();
    });
    let points=[segments[0][0]];
    for(let n=0;n<segments.length-1;n++)points.push([(segments[n][1][0]+segments[n+1][0][0])/2,(segments[n][1][1]+segments[n+1][0][1])/2]);
    points.push(segments.at(-1)[1]);if(points[0][0]>points.at(-1)[0])points=points.reverse();
    let id=`google-boundary-${start}`;while(roads.some(r=>r.id===id))id+='-new';
    const entry=assigned.get(start);
    roads.push({id,name:entry.name,kind:'boundary',points,googlePlaceId:entry.placeId,boundaryFingerprint:entry.fingerprint,boundarySides:sides});
    if(sides.includes(side))selectedId=id;
  }
  return {layout:{...layout,roads},selectedId};
}
export function layoutFromBoundary(boundary, reference = '') {
  if(!boundary?.coordinates?.[0])throw new Error('Desenhe primeiro o limite geográfico.');
  const ring=boundary.coordinates[0].slice(0,-1);
  const cos=Math.cos(ring.reduce((s,p)=>s+p[1],0)/ring.length*Math.PI/180);
  const projected=ring.map(([lng,lat])=>[lng*cos,-lat]);
  const west=Math.min(...projected.map(p=>p[0])),north=Math.min(...projected.map(p=>p[1]));
  const width=Math.max(...projected.map(p=>p[0]))-west,height=Math.max(...projected.map(p=>p[1]))-north;
  const scale=Math.min(700/width,480/height);
  const outline=projected.map(([x,y])=>[150+(x-west)*scale+(700-width*scale)/2,110+(y-north)*scale+(480-height*scale)/2]);
  return validateEditableLayout({version:1,outline,roads:[],landmarks:reference?[{id:'initial-reference',name:reference.slice(0,100),position:[580,300],kind:'reference'}]:[]});
}
