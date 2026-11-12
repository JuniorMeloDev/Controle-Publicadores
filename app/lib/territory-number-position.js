import { automaticReferenceGroups } from './editable-territory.js';

function segmentDistance(point,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)):0;
  return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);
}

function inside(point,outline) {
  let result=false;
  for(let i=0,j=outline.length-1;i<outline.length;j=i++){
    const a=outline[i],b=outline[j];
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])result=!result;
  }
  return result;
}

// Find room for the entire badge, considering street surfaces and visible references.
export function territoryNumberPosition(layout,editing=false) {
  const outline=layout.outline;
  const edges=outline.map((point,i)=>[point,outline[(i+1)%outline.length]]);
  const roads=layout.roads.flatMap(road=>road.points.slice(1).map((point,i)=>[road.points[i],point]));
  const markers=layout.landmarks.filter(marker=>editing||!marker.id.startsWith('osm-point-'));
  const groups=editing?[]:automaticReferenceGroups(layout.landmarks);
  const labels=markers.map(marker=>{
    const size=marker.labelFontSize||16,lines=marker.name.split(/\r?\n/),height=(lines.length-1)*size*1.25;
    const angle=(marker.labelRotation||0)*Math.PI/180;
    return {position:marker.position,cos:Math.cos(angle),sin:Math.sin(angle),left:25,right:35+Math.max(...lines.map(line=>line.length))*size*0.65,top:5-height/2-size-2,bottom:9+height/2};
  });
  const center=outline.reduce((sum,point)=>[sum[0]+point[0]/outline.length,sum[1]+point[1]/outline.length],[0,0]);
  const score=point=>{
    if(!inside(point,outline))return -Infinity;
    let clearance=Math.min(...edges.map(([a,b])=>segmentDistance(point,a,b)));
    for(const [a,b] of roads)clearance=Math.min(clearance,segmentDistance(point,a,b)-13.5);
    for(const marker of markers)clearance=Math.min(clearance,Math.hypot(point[0]-marker.position[0],point[1]-marker.position[1])-20);
    for(const group of groups)clearance=Math.min(clearance,Math.hypot(point[0]-group.position[0],point[1]-group.position[1])-16);
    for(const label of labels){
      const dx=point[0]-label.position[0],dy=point[1]-label.position[1];
      const x=dx*label.cos+dy*label.sin,y=-dx*label.sin+dy*label.cos;
      const outsideX=Math.max(label.left-x,0,x-label.right),outsideY=Math.max(label.top-y,0,y-label.bottom);
      const distance=outsideX||outsideY?Math.hypot(outsideX,outsideY):-Math.min(x-label.left,label.right-x,y-label.top,label.bottom-y);
      clearance=Math.min(clearance,distance);
    }
    // Once comfortably clear, favor the middle over a distant empty corner.
    return Math.min(clearance,70)-Math.hypot(point[0]-center[0],point[1]-center[1])*0.025;
  };
  const minX=Math.min(...outline.map(p=>p[0])),maxX=Math.max(...outline.map(p=>p[0]));
  const minY=Math.min(...outline.map(p=>p[1])),maxY=Math.max(...outline.map(p=>p[1]));
  let best=center,bestScore=score(best);
  const consider=point=>{const value=score(point);if(value>bestScore){best=point;bestScore=value;}};
  for(let x=0;x<=32;x++)for(let y=0;y<=32;y++)consider([minX+(maxX-minX)*x/32,minY+(maxY-minY)*y/32]);
  let step=Math.max(maxX-minX,maxY-minY)/32;
  for(let iteration=0;iteration<5;iteration++){
    const origin=best;step/=2;
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)consider([origin[0]+x*step,origin[1]+y*step]);
  }
  return best;
}
