import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { loadDestination } from './destination-loader.js';
import { createSummerLandmark, createCoveredCorridors } from './summer-models.js';
let CONFIG;
try{
 CONFIG=await loadDestination();
}catch(error){
 console.error(error);
 const loading=document.querySelector('#loading');
 loading.innerHTML='<strong>景区数据加载失败</strong><p>请确认本地服务已启动，并检查景区配置文件。</p>';
 throw error;
}
const {geo:GEO,photos:PHOTOS,transport:TRANSPORT,locations}=CONFIG;
const terrain=CONFIG.terrain,halfX=terrain.width/2,halfZ=terrain.depth/2,gridX=terrain.width/terrain.step,gridZ=terrain.depth/terrain.step;
import { createTransportLayer } from './transport-layer.js';
import { setLocationPhoto } from './photo-viewer.js';
import { metres, BUILDING_DIMENSIONS, createPagoda, createBridge, createStoneTower } from './scale-models.js';

const $=s=>document.querySelector(s);
const viewport=$('#viewport'), markerLayer=$('#markers');
let renderer, scene, camera, controls, flight=null, selected=null, labelsVisible=true, topView=false, ready=false;
const v=new THREE.Vector3(), markers=[], waterMeshes=[];
const homeTarget=new THREE.Vector3(...CONFIG.home.target), homeOffset=new THREE.Vector3(...CONFIG.home.offset);
const fittedHomeOffset=()=>homeOffset.clone().multiplyScalar(Math.max(1,(window.innerWidth<=700?.95:.73)/(viewport.clientWidth/viewport.clientHeight)));
let initialSize=true, overview=true, transportLayer, selectedStation=null, terrainSurfaceHeight=height;
const destinationName=()=>selected?locations.find(l=>l.id===selected).name:selectedStation?selectedStation.name+'站':null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let rngSeed=57019;
const rand=()=>{rngSeed=(1664525*rngSeed+1013904223)>>>0;return rngSeed/4294967296;};
const pos=(lng,lat)=>new THREE.Vector3((lng-CONFIG.projection.lng)*CONFIG.projection.xFactor,0,(CONFIG.projection.lat-lat)*CONFIG.projection.zFactor);
const within=(x,z,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!=(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
const outer=GEO.water.outer, inner=GEO.water.inner;
const waterShapes=outer.map(p=>({p,minX:Math.min(...p.map(a=>a[0])),maxX:Math.max(...p.map(a=>a[0])),minZ:Math.min(...p.map(a=>a[1])),maxZ:Math.max(...p.map(a=>a[1])),holes:inner.filter(h=>within(h[0][0],h[0][1],p))}));
function isWater(x,z){return waterShapes.some(s=>x>=s.minX&&x<=s.maxX&&z>=s.minZ&&z<=s.maxZ&&within(x,z,s.p)&&!s.holes.some(h=>within(x,z,h)));}
const buildingBounds=GEO.buildings.map(b=>({p:b.p,minX:Math.min(...b.p.map(a=>a[0])),maxX:Math.max(...b.p.map(a=>a[0])),minZ:Math.min(...b.p.map(a=>a[1])),maxZ:Math.max(...b.p.map(a=>a[1]))}));
const borders=outer.concat(inner).flatMap(p=>p.filter((_,i)=>i%3===0));
function rawHeight(x,z){let h=terrain.base;const hills=terrain.hills;for(const [a,b,c,wx,wz]of hills)h+=c*Math.exp(-(((x-a)/wx)**2)-((z-b)/wz)**2);return h;}
function height(x,z){if(isWater(x,z))return .3;let h=rawHeight(x,z);if(h<3)return h;let d=Infinity;for(const p of borders){const ds=(x-p[0])**2+(z-p[1])**2;if(ds<d)d=ds;}return terrain.base+(h-terrain.base)*Math.min(1,Math.sqrt(d)/terrain.shoreBlend);}
const materials={
 roof:new THREE.MeshStandardMaterial({color:CONFIG.palette.roof,roughness:1}),
 wall:new THREE.MeshStandardMaterial({color:CONFIG.palette.wall,roughness:1}),
 red:new THREE.MeshStandardMaterial({color:CONFIG.palette.red,roughness:1}),
 stone:new THREE.MeshStandardMaterial({color:CONFIG.palette.stone,roughness:1})
};
function makeMesh(geo,mat,parent=scene){const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(w,h,d,x,y,z,mat,parent){const m=makeMesh(new THREE.BoxGeometry(w,h,d),mat,parent);m.position.set(x,y,z);return m;}
function pathMesh(points,width,color,yOffset=.08){
 if(points.length<2)return;const vertices=[];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.001)continue;
  const nx=-dz/length*width/2,nz=dx/length*width/2;
  const ay=Math.max(1.6,height(...a)+yOffset),by=Math.max(1.6,height(...b)+yOffset);
  const corners=[[a[0]+nx,ay,a[1]+nz],[a[0]-nx,ay,a[1]-nz],[b[0]+nx,by,b[1]+nz],[b[0]-nx,by,b[1]-nz]];
  for(const index of [0,1,2,2,1,3])vertices.push(...corners[index]);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
 const mesh=makeMesh(geometry,new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide}));mesh.castShadow=false;
}
function landmark(loc){
 const p=pos(loc.lng,loc.lat),ground=(CONFIG.id==='summer-palace'&&['bridge17','marbleboat'].includes(loc.id))?1.06:loc.kind==='bridge'?Math.max(1.6,height(p.x,p.z)):height(p.x,p.z);
 let model=null,total=metres(6);
 if(CONFIG.id==='summer-palace'){const built=createSummerLandmark(loc,materials,GEO,pos);if(built){model=built.group;total=built.height;}}
 else if(loc.kind==='pagoda'){model=createPagoda(materials);total=metres(BUILDING_DIMENSIONS.leifeng.heightM);}
 else if(loc.kind==='bridge'){model=createBridge(materials);total=metres(1.4);}
 // Parks and temples use mapped building footprints, not oversized landmark symbols.
 if(model){model.position.set(p.x,ground,p.z);scene.add(model);}
 loc.point=new THREE.Vector3(p.x,ground+total+metres(5),p.z);
 loc.ground=new THREE.Vector3(p.x,ground,p.z);
 loc.focusHeight=loc.id==='foxiang'?total*.45:loc.kind==='pagoda'?total*.4:metres(4);
}
function mergeBufferGeometry(geometries,material){
 if(!geometries.length)return;
 const size=geometries.reduce((n,g)=>n+g.attributes.position.array.length,0);
 const positions=new Float32Array(size),normals=new Float32Array(size);let offset=0;
 for(const g of geometries){positions.set(g.attributes.position.array,offset);normals.set(g.attributes.normal.array,offset);offset+=g.attributes.position.array.length;g.dispose();}
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.BufferAttribute(positions,3));result.setAttribute('normal',new THREE.BufferAttribute(normals,3));result.computeBoundingSphere();
 makeMesh(result,material);
}
function mappedBuildings(buildings){
 const walls=[],roofs=[];
 for(const b of buildings){
  if(CONFIG.excludedBuildings.includes(b.id))continue; // Replace the OSM tower block once with the dimensioned pagoda.
  const polygon=b.p.slice(0,-1);if(polygon.length<3)continue;
  const x=polygon.reduce((n,p)=>n+p[0],0)/polygon.length,z=polygon.reduce((n,p)=>n+p[1],0)/polygon.length;
  const floor=Math.max(1.05,Math.min(...polygon.map(([px,pz])=>height(px,pz))));
  const pitched=['gabled','hipped'].includes(b.roof)||(CONFIG.id==='summer-palace'&&z<-40&&x<55),roofH=pitched?Math.min(metres(2.4),b.h*.3):0;
  const shape=new THREE.Shape(polygon.map(p=>new THREE.Vector2(p[0],-p[1])));
  let wall=new THREE.ExtrudeGeometry(shape,{depth:b.h-roofH,bevelEnabled:false,steps:1,curveSegments:1});wall.rotateX(-Math.PI/2);wall.translate(0,floor,0);if(wall.index)wall=wall.toNonIndexed();walls.push(wall);
  if(pitched){const vertices=[];
   for(let i=0;i<polygon.length;i++){const a=polygon[i],next=polygon[(i+1)%polygon.length];vertices.push(a[0],floor+b.h-roofH,a[1],next[0],floor+b.h-roofH,next[1],x,floor+b.h,z);}
   const roof=new THREE.BufferGeometry();roof.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));roof.computeVertexNormals();roofs.push(roof);
  }
 }
 mergeBufferGeometry(walls,new THREE.MeshStandardMaterial({color:0xdedfd2,roughness:1}));
 mergeBufferGeometry(roofs,new THREE.MeshStandardMaterial({color:CONFIG.id==='summer-palace'?0x7d8974:0x566558,roughness:1,side:THREE.DoubleSide}));
}
function createTerrain(){
 const geo=new THREE.PlaneGeometry(terrain.width,terrain.depth,gridX,gridZ);geo.rotateX(-Math.PI/2);const a=geo.attributes.position,col=[];const green=new THREE.Color(),base=new THREE.Color(0xabc38e),high=new THREE.Color(0x537d60),urban=new THREE.Color(0xe2e4d4);
 for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i),h=height(x,z);a.setY(i,h);const city=CONFIG.id==='westlake'?Math.min(1,Math.max(0,(x-95)/80)):Math.min(.85,Math.max(0,(x-55)/65));green.copy(base).lerp(high,Math.min(.85,(h-terrain.base)/(CONFIG.id==='westlake'?65:8))).lerp(urban,city);green.multiplyScalar(.97+rand()*.06);col.push(green.r,green.g,green.b);}
 // Interpolate the same two triangles used by the 5-unit terrain grid.
 terrainSurfaceHeight=(x,z)=>{
  const gx=THREE.MathUtils.clamp((x+halfX)/terrain.step,0,gridX-.000001),gz=THREE.MathUtils.clamp((z+halfZ)/terrain.step,0,gridZ-.000001);
  const ix=Math.floor(gx),iz=Math.floor(gz),tx=gx-ix,tz=gz-iz,stride=gridX+1,index=iz*stride+ix;
  const ha=a.getY(index),hb=a.getY(index+stride),hc=a.getY(index+stride+1),hd=a.getY(index+1);
  return tx+tz<=1?ha*(1-tx-tz)+hd*tx+hb*tz:hc*(tx+tz-1)+hb*(1-tx)+hd*(1-tz);
 };
 let visibleTerrain=geo;
 if(CONFIG.landTriangles){
  // Clip land to the exact water shoreline, including narrow channels and the stone boat.
  // Heights still follow the original grid planes, so roads retain the same surface.
  const positions=[],colors=[];
  for(let i=0;i<CONFIG.landTriangles.length;i+=2){
   const x=CONFIG.landTriangles[i],z=CONFIG.landTriangles[i+1],h=terrainSurfaceHeight(x,z);
   positions.push(x,h,z);
   const city=Math.min(.85,Math.max(0,(x-55)/65));
   green.copy(base).lerp(high,Math.min(.85,Math.max(0,(h-terrain.base)/8))).lerp(urban,city);
   colors.push(green.r,green.g,green.b);
  }
  visibleTerrain=new THREE.BufferGeometry();visibleTerrain.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));visibleTerrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 }else geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 visibleTerrain.computeVertexNormals();const groundMesh=makeMesh(visibleTerrain,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true}));groundMesh.castShadow=false;
 box(terrain.width,13,terrain.depth,0,-6.6,0,new THREE.MeshStandardMaterial({color:0xb3ba9e,roughness:1}));
 box(terrain.width+1,3,terrain.depth+1,0,-14,0,new THREE.MeshStandardMaterial({color:0xd4d8c3,roughness:1}));
 const floor=makeMesh(new THREE.PlaneGeometry(4000,4000),new THREE.ShadowMaterial({opacity:.11}));floor.rotation.x=-Math.PI/2;floor.position.y=-19;floor.castShadow=false;
 // OSM multipolygon shorelines retain the real islands and causeways.
 outer.forEach(poly=>{
  const s=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0],-p[1])));
  inner.filter(h=>within(h[0][0],h[0][1],poly)).forEach(h=>s.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(p[0],-p[1])))));
  const g=new THREE.ShapeGeometry(s);g.rotateX(-Math.PI/2);
  const mat=new THREE.MeshStandardMaterial({color:CONFIG.palette.water,roughness:.34,metalness:.15,side:THREE.DoubleSide});const m=makeMesh(g,mat);m.position.y=1.05;m.castShadow=false;waterMeshes.push(m);
 });
 if(CONFIG.id==='summer-palace'){
  const boat=locations.find(l=>l.id==='marbleboat'),p=pos(boat.lng,boat.lat);
  const g=new THREE.PlaneGeometry(boat.planWidth,metres(36));g.rotateX(-Math.PI/2);
  const m=makeMesh(g,waterMeshes[0].material);m.position.set(p.x,1.05,p.z);m.rotation.y=boat.bearing;m.castShadow=false;
 }
 // Shore edges and map roads are based on the downloaded OSM geometry.
 const edgePos=[];outer.concat(inner).forEach(poly=>{for(let i=1;i<poly.length;i++){edgePos.push(poly[i-1][0],1.28,poly[i-1][1],poly[i][0],1.28,poly[i][1]);}});
 const eg=new THREE.BufferGeometry();eg.setAttribute('position',new THREE.Float32BufferAttribute(edgePos,3));scene.add(new THREE.LineSegments(eg,new THREE.LineBasicMaterial({color:0xd3dcc0,transparent:true,opacity:.78})));
 const roadPos=[],walkingPos=[];
 for(const road of GEO.roads){const arr=['footway','path','service'].includes(road.type)?walkingPos:roadPos;for(let i=1;i<road.p.length;i++){const [x,z]=road.p[i-1],[u,w]=road.p[i];arr.push(x,height(x,z)+.36,z,u,height(u,w)+.36,w);}}
 for(const [arr,c,o]of [[roadPos,0xf6f0df,.85],[walkingPos,0xe8e5c8,.48]]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));scene.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:c,transparent:true,opacity:o})));}
 // Emphasize the two lake causeways while preserving their mapped alignment.
 for(const road of GEO.roads.filter(r=>(['苏堤','白堤','西堤','长廊'].includes(r.name)||r.bridge)&&!(CONFIG.id==='summer-palace'&&r.name==='十七孔桥')))pathMesh(road.p,road.name==='长廊'?.25:road.name==='苏堤'?.9:road.name==='白堤'||road.name==='断桥'?.86:.55,0xded5b4);
 mappedBuildings(GEO.buildings);
 if(CONFIG.id==='summer-palace')createCoveredCorridors(GEO,terrainSurfaceHeight,materials,scene);
 const treePoints=[];
 for(let i=0;i<100000&&treePoints.length<CONFIG.treeCount;i++){const x=-halfX+5+rand()*(terrain.width-10),z=-halfZ+7+rand()*(terrain.depth-15);if(isWater(x,z))continue;if(x>(CONFIG.id==='westlake'?115:90)&&rand()>.09)continue;if(rawHeight(x,z)<(CONFIG.id==='westlake'?7:3)&&rand()>.38)continue;if(CONFIG.id==='summer-palace'&&buildingBounds.some(b=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ&&within(x,z,b.p)))continue;const h=height(x,z);treePoints.push({x,z,h,s:.32+rand()*.4});}
 const trees=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshStandardMaterial({roughness:1,flatShading:true}),treePoints.length);const dummy=new THREE.Object3D();
 treePoints.forEach((p,i)=>{dummy.position.set(p.x,p.h+p.s*1.1,p.z);dummy.scale.set(p.s,p.s*(1.1+rand()*.65),p.s);dummy.rotation.y=rand()*6.28;dummy.updateMatrix();trees.setMatrixAt(i,dummy.matrix);trees.setColorAt(i,new THREE.Color().setHSL(.28+rand()*.06,.19+rand()*.14,.31+rand()*.14));});trees.castShadow=true;trees.receiveShadow=true;scene.add(trees);
 // Quiet glints and a few small boats make the water readable from a distance.
 const ripples=[];for(let i=0;i<950;i++){const x=-halfX*.8+rand()*halfX*1.6,z=-halfZ*.8+rand()*halfZ*1.6;if(isWater(x,z)&&isWater(x+3,z)){ripples.push(x,1.13,z,x+1+rand()*2,1.13,z);}}
 const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(ripples,3));scene.add(new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:0xe0ece2,opacity:.19,transparent:true})));
 for(const [lng,lat]of CONFIG.boats){const p=pos(lng,lat),g=new THREE.Group();g.position.set(p.x,1.13,p.z);g.scale.setScalar(.18);g.rotation.y=rand()*3;scene.add(g);const boat=makeMesh(new THREE.CylinderGeometry(1.3,.6,.7,6),materials.wall,g);boat.scale.z=2.5;box(1.4,1,2.1,0,.7,0,materials.roof,g);}
 locations.forEach(landmark);
 for(const [lng,lat] of CONFIG.features?.stoneTowers||[]){const p=pos(lng,lat),tower=createStoneTower(materials);tower.position.set(p.x,1.05-metres(.32),p.z);scene.add(tower);}
}
function createMarkers(){locations.forEach((loc,i)=>{const b=document.createElement('button');b.className='map-marker';b.dataset.id=loc.id;b.setAttribute('aria-label',`飞往${loc.name}`);b.innerHTML=`<span class="marker-dot"></span><span class="marker-name">${loc.name}</span>`;b.onclick=()=>flyTo(loc.id);markerLayer.append(b);markers.push({loc,el:b});});
 const label=document.createElement('div');label.className='lake-label';label.innerHTML=`${CONFIG.lake.name}<small>${CONFIG.lake.en}</small>`;markerLayer.append(label);markers.push({loc:{point:pos(CONFIG.lake.lng,CONFIG.lake.lat)},el:label,isLake:true});
}
function updateMarkers(){const width=viewport.clientWidth,height=viewport.clientHeight;const distance=camera.position.distanceTo(controls.target);const occupied=[],labelBoxes=[];
 const sorted=[...markers].sort((a,b)=>(b.loc.id===selected?1:0)-(a.loc.id===selected?1:0));
 for(const m of sorted){v.copy(m.loc.point).project(camera);const x=(v.x*.5+.5)*width,y=(-v.y*.5+.5)*height;let visible=v.z<1&&v.z>0&&x>15&&x<width-15&&y>70&&y<height-85&&(labelsVisible||m.loc.id===selected||m.isLake);
 if(m.isLake){visible=visible&&distance>Math.min(290,terrain.width*.48);m.el.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;}
 else{if(m.loc.id!==selected&&occupied.some(p=>Math.abs(p[0]-x)<106&&Math.abs(p[1]-y)<36))visible=false;if(visible)occupied.push([x,y]);m.el.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`;}
 m.el.style.visibility=visible?'visible':'hidden';
 if(visible){const w=m.el.offsetWidth,h=m.el.offsetHeight,top=m.isLake?y-h/2:y-h;labelBoxes.push({left:x-w/2,right:x+w/2,top,bottom:top+h,el:m.el,canYield:m.loc.id!==selected});}
 }
 const origin=viewport.getBoundingClientRect();
 const blocked=[...document.querySelectorAll('#sidebar,#detail,.map-controls,.transport-controls,.destination-switch')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none').map(el=>{const r=el.getBoundingClientRect();return {left:r.left-origin.left,right:r.right-origin.left,top:r.top-origin.top,bottom:r.bottom-origin.top};});
 transportLayer?.update(camera,width,height,labelBoxes,blocked);
 $('#compass-needle').style.transform=`rotate(${-THREE.MathUtils.radToDeg(controls.getAzimuthalAngle())}deg)`;
 const d=camera.position.distanceTo(controls.target);$('#altitude').textContent=d<250?'近景视角':'全景视角';
}
function smooth(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
function animateTo(target,offset,duration=1800){flight={start:performance.now(),duration:reduced?1:duration,from:camera.position.clone(),fromTarget:controls.target.clone(),to:target.clone().add(offset),target:target.clone()};controls.autoRotate=false;$('#orbit').setAttribute('aria-pressed','false');}
function flyTo(id){const loc=locations.find(l=>l.id===id);if(!loc||!ready)return;selected=id;selectedStation=null;transportLayer?.select(null);overview=false;topView=false;$('#topview').setAttribute('aria-pressed','false');document.querySelectorAll('[data-id]').forEach(e=>{e.classList.toggle('active',e.dataset.id===id);if(e.classList.contains('place'))e.setAttribute('aria-pressed',String(e.dataset.id===id));});
 $('#detail').hidden=false;$('#detail').scrollTop=0;setLocationPhoto(loc,PHOTOS[loc.id]);updateFraming();$('#detail-title').textContent=loc.name;$('#detail-en').textContent=loc.en;$('#detail-tag').textContent=loc.tag;$('#detail-description').textContent=loc.desc;$('#detail-tip').textContent=loc.tip;$('#detail-index').textContent=String(locations.indexOf(loc)+1).padStart(2,'0');$('#coordinates').textContent=`${loc.lat.toFixed(4)}° N · ${loc.lng.toFixed(4)}° E`;
 $('#status').textContent=`正在飞往 · ${loc.name}`;$('#live').textContent=`正在飞往${loc.name}`;
 const offset=loc.cameraOffset?new THREE.Vector3(...loc.cameraOffset):loc.kind==='pagoda'?new THREE.Vector3(16,20,28):loc.kind==='bridge'?new THREE.Vector3(10,14,19):loc.kind==='temple'?new THREE.Vector3(16,22,32):new THREE.Vector3(28,32,42);
 animateTo(loc.ground.clone().add(new THREE.Vector3(0,loc.focusHeight,0)),offset,1900);$('#sidebar').classList.remove('mobile-open');$('#open-places').setAttribute('aria-expanded','false');}
function resetView(){selected=null;selectedStation=null;transportLayer?.select(null);overview=true;$('#detail').hidden=true;updateFraming();document.querySelectorAll('[data-id]').forEach(e=>{e.classList.remove('active');if(e.classList.contains('place'))e.setAttribute('aria-pressed','false');});topView=false;$('#topview').setAttribute('aria-pressed','false');$('#status').textContent=CONFIG.name+'全景';animateTo(homeTarget,fittedHomeOffset());}
function flyToStation(station,point){
 if(!ready)return;selected=null;selectedStation=station;overview=false;topView=false;transportLayer.select(station.id);
 $('#topview').setAttribute('aria-pressed','false');$('#detail').hidden=true;updateFraming();
 document.querySelectorAll('[data-id]').forEach(el=>{el.classList.remove('active');if(el.classList.contains('place'))el.setAttribute('aria-pressed','false');});
 $('#sidebar').classList.remove('mobile-open');$('#open-places').setAttribute('aria-expanded','false');
 $('#status').textContent=`正在飞往 · ${station.name}站`;$('#live').textContent=`正在飞往${station.name}站，${station.lines.map(line=>/^\d+$/.test(String(line))?line+'号线':line).join('、')}`;
 animateTo(point,new THREE.Vector3(55,95,115),1500);
}
function cancelFlight(){if(flight){flight=null;$('#status').textContent=destinationName()||'自由探索';} }
function init(){try{
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xeef1ea,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
 viewport.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label',CONFIG.name+'三维地图：拖动旋转，滚轮缩放，点击景点飞近');renderer.domElement.tabIndex=0;
 scene=new THREE.Scene();scene.fog=new THREE.Fog(0xeef1ea,1100,1900);camera=new THREE.PerspectiveCamera(39,1,.1,2200);camera.position.copy(homeTarget).add(homeOffset);
 scene.add(new THREE.HemisphereLight(0xfaf8e9,0x778e74,1.8));const sun=new THREE.DirectionalLight(0xfff3d7,2.4);sun.position.set(-220,450,190);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-430,right:430,top:400,bottom:-400,near:50,far:900});sun.shadow.bias=-.0007;sun.shadow.normalBias=.65;scene.add(sun);
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=4;controls.maxDistance=1600;controls.minPolarAngle=.03;controls.maxPolarAngle=Math.PI*.455;controls.target.copy(homeTarget);controls.autoRotateSpeed=.45;controls.panSpeed=.8;controls.screenSpacePanning=false;controls.zoomSpeed=.8;controls.addEventListener('start',()=>{overview=false;cancelFlight();});controls.addEventListener('end',()=>{$('#status').textContent=destinationName()||'自由探索';});
 createTerrain();createMarkers();transportLayer=createTransportLayer({roads:TRANSPORT.roads,stations:TRANSPORT.stations,scene,layer:$('#transport-labels'),height:terrainSurfaceHeight,projection:CONFIG.projection,terrain,onStationSelect:flyToStation});ready=true;document.body.classList.add('ready');$('#loading').hidden=true;$('#status').textContent=CONFIG.name+'全景';resize();requestAnimationFrame(render);
 }catch(error){console.error(error);$('#loading').hidden=false;$('#loading').innerHTML='<strong>暂时无法显示 3D 地图</strong><p>请使用支持 WebGL 的现代浏览器，并开启硬件加速。</p><button onclick="location.reload()">重新加载</button>';$('#status').textContent='地图加载失败';}}
function updateFraming(){
 if(!camera)return;
 const w=viewport.clientWidth,h=viewport.clientHeight,detail=$('#detail');
 if(!detail.hidden){
  if(window.innerWidth<=700)camera.setViewOffset(w,h,0,h*.18,w,h);
  else{const freeWidth=detail.getBoundingClientRect().left-viewport.getBoundingClientRect().left;camera.setViewOffset(w,h,Math.max(0,(w-freeWidth)/2),0,w,h);}
 }else camera.clearViewOffset();
}
function resize(){if(!renderer)return;const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;updateFraming();camera.updateProjectionMatrix();if(initialSize||overview){if(flight){flight.to.copy(homeTarget).add(fittedHomeOffset());}else{camera.position.copy(homeTarget).add(fittedHomeOffset());controls.target.copy(homeTarget);}initialSize=false;}}
function render(now){requestAnimationFrame(render);if(document.hidden)return;
 if(flight){const t=Math.min(1,(now-flight.start)/flight.duration),e=smooth(t);camera.position.lerpVectors(flight.from,flight.to,e);camera.position.y+=Math.sin(Math.PI*t)*Math.min(65,flight.from.distanceTo(flight.to)*.12);controls.target.lerpVectors(flight.fromTarget,flight.target,e);if(t>=1){flight=null;$('#status').textContent=destinationName()?`已抵达 · ${destinationName()}`:CONFIG.name+'全景';$('#live').textContent=$('#status').textContent;}}
 controls.update();const target=controls.target;if(Math.abs(target.x)>halfX||Math.abs(target.z)>halfZ){const old=target.clone();target.x=THREE.MathUtils.clamp(target.x,-halfX,halfX);target.z=THREE.MathUtils.clamp(target.z,-halfZ,halfZ);camera.position.add(target.clone().sub(old));}
 camera.position.y=Math.max(camera.position.y,height(camera.position.x,camera.position.z)+metres(4));
 updateMarkers();renderer.render(scene,camera);
}
const list=$('#place-list');locations.forEach((l,i)=>{const b=document.createElement('button');b.className='place';b.dataset.id=l.id;b.setAttribute('aria-pressed','false');b.innerHTML=`<span class="place-number">${String(i+1).padStart(2,'0')}</span><span class="place-name">${l.name}</span><span class="place-arrow" aria-hidden="true">↗</span>`;b.onclick=()=>flyTo(l.id);list.append(b);});
$('#reset').onclick=()=>{if(ready)resetView();};$('#close-detail').onclick=()=>{$('#detail').hidden=true;updateFraming();};
$('#zoom-in').onclick=()=>{overview=false;if(ready)animateTo(controls.target,camera.position.clone().sub(controls.target).multiplyScalar(Math.max(.72,4/camera.position.distanceTo(controls.target))),450);};
$('#zoom-out').onclick=()=>{overview=false;if(ready)animateTo(controls.target,camera.position.clone().sub(controls.target).multiplyScalar(Math.min(1.38,1600/camera.position.distanceTo(controls.target))),450);};
$('#topview').onclick=()=>{if(!ready)return;overview=false;topView=!topView;$('#topview').setAttribute('aria-pressed',String(topView));animateTo(controls.target,topView?new THREE.Vector3(0,Math.max(camera.position.distanceTo(controls.target),250),1):homeOffset.clone().normalize().multiplyScalar(camera.position.distanceTo(controls.target)),1000);};
$('#toggle-roads').onclick=()=>{if(ready)$('#toggle-roads').setAttribute('aria-pressed',String(transportLayer.toggleRoads()));};
$('#toggle-metro').onclick=()=>{if(ready)$('#toggle-metro').setAttribute('aria-pressed',String(transportLayer.toggleStations()));};
$('#labels').onclick=()=>{labelsVisible=!labelsVisible;$('#labels').setAttribute('aria-pressed',String(labelsVisible));};
$('#orbit').onclick=()=>{if(!ready)return;overview=false;cancelFlight();controls.autoRotate=!controls.autoRotate;$('#orbit').setAttribute('aria-pressed',String(controls.autoRotate));};
$('#compass').onclick=()=>{overview=false;if(ready)animateTo(controls.target,new THREE.Vector3(0,camera.position.y-controls.target.y,Math.hypot(camera.position.x-controls.target.x,camera.position.z-controls.target.z)),800);};
$('#open-places').onclick=()=>{const open=$('#sidebar').classList.toggle('mobile-open');$('#open-places').setAttribute('aria-expanded',String(open));};
$('#close-places').onclick=()=>{$('#sidebar').classList.remove('mobile-open');$('#open-places').setAttribute('aria-expanded','false');};
$('#sources-button').onclick=()=>$('#sources').showModal();$('#close-sources').onclick=()=>$('#sources').close();$('#sources').addEventListener('click',e=>{if(e.target===$('#sources'))$('#sources').close();});
window.addEventListener('resize',resize);
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(document.querySelector('dialog[open]'))return;cancelFlight();$('#detail').hidden=true;updateFraming();$('#sidebar').classList.remove('mobile-open');}if(e.target===renderer?.domElement){if(e.key==='Home'){e.preventDefault();resetView();}if(e.key==='+'||e.key==='=')$('#zoom-in').click();if(e.key==='-')$('#zoom-out').click();}});
setTimeout(init,70);
window.travelMap={flyTo,resetView,getState:()=>({ready,selected,flying:!!flight,camera:camera?.position.toArray(),target:controls?.target.toArray(),locations:locations.map(l=>({id:l.id,lng:l.lng,lat:l.lat})),drawCalls:renderer?.info.render.calls})};
