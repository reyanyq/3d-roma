import * as THREE from './vendor/three.module.js';

// Geographic road ribbons and screen-space labels share the scene's 10 m unit.
export function createTransportLayer({roads,stations,scene,layer,height,onStationSelect,projection,terrain}){
 const halfX=terrain.width/2,halfZ=terrain.depth/2,step=terrain.step,gridX=terrain.width/step,gridZ=terrain.depth/step;
 const roadGroup=new THREE.Group(),stationGroup=new THREE.Group();
 scene.add(roadGroup,stationGroup);
 const roadMaterial=new THREE.MeshBasicMaterial({color:0xc49a55,side:THREE.DoubleSide});
 const roadLabels=[],stationLabels=[],projected=new THREE.Vector3();
 const svgNS='http://www.w3.org/2000/svg',connectors=document.createElementNS(svgNS,'svg');
 connectors.classList.add('transport-connectors');connectors.setAttribute('aria-hidden','true');layer.append(connectors);
 let roadsVisible=true,stationsVisible=true,activeStation=null;
 const point=([x,z],offset=1)=>new THREE.Vector3(x,Math.max(1.8,height(x,z)+offset),z);
 const overlap=(a,b)=>a.left<b.right+5&&a.right>b.left-5&&a.top<b.bottom+4&&a.bottom>b.top-4;
 function clipToTriangle(polygon,triangle){
  for(let edge=0;edge<3&&polygon.length;edge++){
   const a=triangle[edge],b=triangle[(edge+1)%3],side=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
   const output=[];let previous=polygon[polygon.length-1],before=side(previous);
   for(const current of polygon){
    const after=side(current);
    if((before>=0)!==(after>=0)){const t=before/(before-after);output.push([previous[0]+(current[0]-previous[0])*t,previous[1]+(current[1]-previous[1])*t]);}
    if(after>=0)output.push(current);previous=current;before=after;
   }
   polygon=output;
  }
  return polygon;
 }
 function drapeQuad(quad,vertices){
  const xs=quad.map(p=>p[0]),zs=quad.map(p=>p[1]);
  const xmin=Math.max(0,Math.floor((Math.min(...xs)+halfX)/step)),xmax=Math.min(gridX-1,Math.floor((Math.max(...xs)+halfX)/step));
  const zmin=Math.max(0,Math.floor((Math.min(...zs)+halfZ)/step)),zmax=Math.min(gridZ-1,Math.floor((Math.max(...zs)+halfZ)/step));
  for(let ix=xmin;ix<=xmax;ix++)for(let iz=zmin;iz<=zmax;iz++){
   const x=ix*step-halfX,z=iz*step-halfZ;
   for(const triangle of [[[x,z],[x+step,z],[x,z+step]],[[x+step,z],[x+step,z+step],[x,z+step]]]){
    const polygon=clipToTriangle(quad,triangle).map(([px,pz])=>[px,Math.max(1.8,height(px,pz)+.12),pz]);
    for(let i=1;i<polygon.length-1;i++)vertices.push(...polygon[0],...polygon[i],...polygon[i+1]);
   }
  }
 }

 for(const road of roads){
  const vertices=[];
  for(const path of road.paths)for(let i=1;i<path.length;i++){
   const start=path[i-1],end=path[i],segments=Math.max(1,Math.ceil(Math.hypot(end[0]-start[0],end[1]-start[1])/1.5));
   for(let step=0;step<segments;step++){
   const at=t=>[start[0]+(end[0]-start[0])*t,start[1]+(end[1]-start[1])*t];
   const a=at(step/segments),b=at((step+1)/segments),dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   if(length<.001)continue;
   const nx=-dz/length*.85,nz=dx/length*.85;
   // Split at the terrain's triangle edges so hills cannot cover the road.
   drapeQuad([[a[0]+nx,a[1]+nz],[a[0]-nx,a[1]-nz],[b[0]-nx,b[1]-nz],[b[0]+nx,b[1]+nz]],vertices);
   }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  roadGroup.add(new THREE.Mesh(geometry,roadMaterial));
  const el=document.createElement('span');el.className='road-label';el.textContent=road.name;el.dataset.road=road.name;layer.append(el);
  roadLabels.push({el,anchors:road.anchors.map(a=>({point:point(a.point),from:point(a.from),to:point(a.to)}))});
 }
 const dotGeometry=new THREE.CircleGeometry(1.9,20);dotGeometry.rotateX(-Math.PI/2);
 const rimGeometry=new THREE.RingGeometry(1.9,2.7,20);rimGeometry.rotateX(-Math.PI/2);
 const dotMaterial=new THREE.MeshBasicMaterial({color:0x3679a7});
 const rimMaterial=new THREE.MeshBasicMaterial({color:0xf8fcff});
 for(const station of stations){
  const x=(station.lng-projection.lng)*projection.xFactor,z=(projection.lat-station.lat)*projection.zFactor;
  const anchor=point([x,z],1.1);
  for(const [g,m] of [[dotGeometry,dotMaterial],[rimGeometry,rimMaterial]]){const mesh=new THREE.Mesh(g,m);mesh.position.copy(anchor);stationGroup.add(mesh);}
  const el=document.createElement('button');el.type='button';el.className='metro-marker';el.dataset.station=station.id;
  const numericLines=station.lines.every(line=>/^\d+$/.test(String(line))),lineText=numericLines?station.lines.join(' / ')+'号线':station.lines.join(' / ');
  el.setAttribute('aria-label',`飞往${station.name}站，${lineText}`);el.setAttribute('aria-pressed','false');
  const icon=document.createElement('span');icon.className='metro-symbol';icon.textContent=numericLines?'M':'T';icon.setAttribute('aria-hidden','true');
  const name=document.createElement('span');name.className='metro-name';name.textContent=station.name+'站';
  const lines=document.createElement('span');lines.className='metro-lines';lines.textContent=lineText;
  el.append(icon,name,lines);el.onclick=()=>onStationSelect(station,anchor.clone());layer.append(el);
  const connector=document.createElementNS(svgNS,'line');connectors.append(connector);
  stationLabels.push({station,el,point:anchor,connector});
 }

 function project(p,camera,width,height){projected.copy(p).project(camera);return {x:(projected.x*.5+.5)*width,y:(-.5*projected.y+.5)*height,z:projected.z};}
 function update(camera,width,height,occupied,blocked){
  const valid=(p,box)=>p.z>0&&p.z<1&&box.left>4&&box.right<width-4&&box.top>75&&box.bottom<height-75&&!blocked.some(b=>overlap(box,b));
  const stationOrder=[...stationLabels].sort((a,b)=>Number(b.station.id===activeStation)-Number(a.station.id===activeStation));
  for(const marker of stationOrder){
   const {el}=marker,p=project(marker.point,camera,width,height),w=el.offsetWidth,h=el.offsetHeight;
   let placed=false;
   const positions=[p.x,Math.max(w/2+6,Math.min(width-w/2-6,p.x)),p.x-w/2-12,p.x+w/2+12,Math.min(p.x-w/2-12,width-65-w/2)];
   if(stationsVisible&&p.x>2&&p.x<width-2)placement:for(const allowSceneOverlap of (width<=700?[false,true]:[false]))for(const labelX of positions)for(const below of [false,true]){
    const y=p.y+(below?10:-9),box={left:labelX-w/2,right:labelX+w/2,top:below?y:y-h,bottom:below?y+h:y};
    const collisions=occupied.filter(b=>overlap(box,b));
    if(!valid(p,box)||collisions.some(b=>!allowSceneOverlap||!b.canYield))continue;
    for(const old of collisions){old.el.style.visibility='hidden';occupied.splice(occupied.indexOf(old),1);}
    el.style.transform=`translate(${labelX}px,${y}px) translate(-50%,${below?'0':'-100%'})`;
    const endpointX=Math.max(box.left+4,Math.min(box.right-4,p.x)),endpointY=below?box.top:box.bottom;
    for(const [key,value] of Object.entries({x1:p.x,y1:p.y,x2:endpointX,y2:endpointY}))marker.connector.setAttribute(key,String(value));
    occupied.push(box);placed=true;break placement;
   }
   el.style.visibility=placed?'visible':'hidden';
   marker.connector.style.visibility=placed?'visible':'hidden';
  }
  for(const road of roadLabels){
   let placed=false;const w=road.el.offsetWidth,h=road.el.offsetHeight;
   if(roadsVisible)for(const anchor of road.anchors){
    const p=project(anchor.point,camera,width,height),from=project(anchor.from,camera,width,height),to=project(anchor.to,camera,width,height);
    // Don't label a road when its visible section is too compressed to read.
    if(Math.hypot(to.x-from.x,to.y-from.y)<4)continue;
    let angle=Math.atan2(to.y-from.y,to.x-from.x);if(angle>Math.PI/2)angle-=Math.PI;if(angle<-Math.PI/2)angle+=Math.PI;
    const rw=Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*h,rh=Math.abs(Math.sin(angle))*w+Math.abs(Math.cos(angle))*h;
    const box={left:p.x-rw/2,right:p.x+rw/2,top:p.y-rh/2,bottom:p.y+rh/2};
    if(!valid(p,box)||occupied.some(b=>overlap(box,b)))continue;
    road.el.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-50%) rotate(${angle}rad)`;
    occupied.push(box);placed=true;break;
   }
   road.el.style.visibility=placed?'visible':'hidden';
  }
 }
 return {
  update,
  select(id){activeStation=id;for(const m of stationLabels){m.el.classList.toggle('active',m.station.id===id);m.el.setAttribute('aria-pressed',String(m.station.id===id));}},
  toggleRoads(){roadsVisible=!roadsVisible;roadGroup.visible=roadsVisible;return roadsVisible;},
  toggleStations(){stationsVisible=!stationsVisible;stationGroup.visible=stationsVisible;return stationsVisible;}
 };
}
