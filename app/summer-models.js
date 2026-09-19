import * as THREE from './vendor/three.module.js';
import { metres } from './scale-models.js';

function add(group,geometry,material,x=0,y=0,z=0){
 const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
}
function box(group,w,h,d,material,x=0,y=0,z=0){return add(group,new THREE.BoxGeometry(w,h,d),material,x,y,z);}

export function createSummerLandmark(loc,materials){
 const group=new THREE.Group();group.name=loc.name;
 if(loc.id==='foxiang'){
  // Height: 36.44 m pavilion + 20 m terrace. Plan radius follows its OSM footprint.
  const r=loc.planRadius,terrace=metres(20),bodyHeight=metres(36.44);
  box(group,r*3.35,terrace,r*3.35,materials.stone,0,terrace/2,0);
  box(group,r*3.6,.09,r*3.6,materials.stone,0,terrace+.045,0);
  let y=terrace;
  for(const [i,[wallH,roofH]] of [[.88,.24],[.80,.22],[.76,.22]].entries()){
   const radius=r*(1-i*.08);
   add(group,new THREE.CylinderGeometry(radius,radius,wallH,8),materials.wall,0,y+wallH/2,0);
   for(let k=0;k<8;k++){const a=k*Math.PI/4;box(group,.045,wallH,.045,materials.red,Math.cos(a)*radius,y+wallH/2,Math.sin(a)*radius);}
   add(group,new THREE.CylinderGeometry(radius*.6,radius*1.24,roofH,8),materials.roof,0,y+wallH+roofH/2,0);
   y+=wallH+roofH;
  }
  add(group,new THREE.ConeGeometry(r*.92,.34,8),materials.roof,0,y+.17,0);y+=.34;
  add(group,new THREE.CylinderGeometry(.015,.06,.184,8),materials.roof,0,y+.092,0);
  return {group,height:terrace+bodyHeight};
 }
 if(loc.id==='bridge17'){
  const length=metres(150),span=loc.mappedSpan,width=metres(8),shape=new THREE.Shape();
  const deck=x=>.34+.62*Math.max(0,1-(2*x/length)**2);
  shape.moveTo(-length/2,0);shape.lineTo(-length/2,deck(-length/2));
  for(let i=1;i<=60;i++){const x=-length/2+length*i/60;shape.lineTo(x,deck(x));}
  shape.lineTo(length/2,0);shape.closePath();
  for(let i=0;i<17;i++){
   const x=-span/2+span*(i+.5)/17,rx=span/17*.4,archHeight=Math.min(.7,deck(x)-.15),hole=new THREE.Path();
   hole.moveTo(x-rx,.01);hole.lineTo(x+rx,.01);
   for(let j=0;j<=16;j++){const a=j*Math.PI/16;hole.lineTo(x+rx*Math.cos(a),.01+archHeight*Math.sin(a));}
   hole.closePath();shape.holes.push(hole);
  }
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false,curveSegments:8,steps:1});
  add(group,geometry,materials.stone,0,0,-width/2);
  for(const z of [-width/2,width/2]){
   for(let i=0;i<=50;i++){const x=-length/2+length*i/50;box(group,.035,.095,.04,materials.stone,x,deck(x)+.0475,z);}
   const points=[];for(let i=0;i<=60;i++){const x=-length/2+length*i/60;points.push(new THREE.Vector3(x,deck(x)+.085,z));}
   add(group,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),60,.023,4,false),materials.stone);
  }
  group.rotation.y=loc.bearing;
  return {group,height:1.06};
 }
 if(loc.id==='marbleboat'){
  const length=metres(36),width=loc.planWidth;
  box(group,width,.12,length,materials.stone,0,.06,0);
  const cabinLength=length*.7;
  for(let level=0;level<2;level++){
   const y=.13+level*.3;
   box(group,width*.72,.22,cabinLength,materials.wall,0,y+.11,0);
   box(group,width*.98,.065,cabinLength*1.07,materials.stone,0,y+.265,0);
   for(let j=0;j<5;j++)for(const side of [-1,1])box(group,.04,.24,.04,materials.stone,side*width*.45,y+.12,-cabinLength*.42+j*cabinLength*.21);
  }
  const paddle=new THREE.CylinderGeometry(.22,.22,.10,16);paddle.rotateZ(Math.PI/2);
  for(const side of [-1,1])add(group,paddle,materials.stone,side*width*.57,.18,0);
  group.rotation.y=loc.bearing;
  return {group,height:.76};
 }
 return null;
}

export function createCoveredCorridors(geo,height,materials,scene){
 for(const road of geo.roads.filter(r=>r.name==='长廊')){
  const group=new THREE.Group();group.name='长廊及连接廊道（OSM走向）';scene.add(group);
  for(let i=1;i<road.p.length;i++){
   const a=road.p[i-1],b=road.p[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   if(length<.02)continue;
   const count=Math.max(1,Math.ceil(length/.8));
   for(let j=0;j<count;j++){
    const t=(j+.5)/count,x=a[0]+dx*t,z=a[1]+dz*t,y=height(x,z),segment=length/count;
    const piece=new THREE.Group();piece.position.set(x,y,z);piece.rotation.y=-Math.atan2(dz,dx);group.add(piece);
    box(piece,segment+.015,.075,.34,materials.roof,0,.42,0);
    for(const side of [-1,1])box(piece,.035,.37,.035,materials.red,-segment/2,.185,side*.12);
   }
  }
 }
}
