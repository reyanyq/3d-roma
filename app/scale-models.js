import * as THREE from './vendor/three.module.js';

// Matches the WGS84 projection in map-data.json: one world unit is 10 metres.
export const METRES_PER_UNIT = 10;
export const metres = value => value / METRES_PER_UNIT;
export const BUILDING_DIMENSIONS = {
  leifeng: { heightM:71.7, baseDiameterM:60, bodyDiameterM:28, galleryDiameterM:35.25 },
  broken: { lengthM:8.8, widthM:8.6 },
  stoneTower: { heightM:2.32, bodyDiameterM:.92, aboveWaterM:2 }
};
function add(group,geometry,material,x,y,z){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
export function createPagoda(materials){
 const group=new THREE.Group();group.name='雷峰塔（71.7 m）';
 const d=BUILDING_DIMENSIONS.leifeng;
 const baseH=metres(9.7),spireH=metres(16.1),floorH=(metres(d.heightM)-baseH-spireH)/5;
 add(group,new THREE.CylinderGeometry(metres(28.5),metres(d.baseDiameterM/2),baseH,8),materials.stone,0,baseH/2,0);
 for(let i=0;i<5;i++){
  const y=baseH+i*floorH,taper=1-i*.035,r=metres(d.bodyDiameterM/2)*taper,roofH=metres(1.5);
  add(group,new THREE.CylinderGeometry(r,r,floorH-roofH,8),materials.wall,0,y+(floorH-roofH)/2,0);
  add(group,new THREE.CylinderGeometry(r*.56,metres(d.galleryDiameterM/2)*taper,roofH,8),materials.roof,0,y+floorH-roofH/2,0);
  for(let j=0;j<8;j++){const a=j*Math.PI/4;add(group,new THREE.BoxGeometry(metres(.45),floorH-roofH,metres(.45)),materials.red,Math.cos(a)*r*.97,y+(floorH-roofH)/2,Math.sin(a)*r*.97);}
 }
 add(group,new THREE.ConeGeometry(metres(.8),spireH,8),materials.roof,0,metres(d.heightM)-spireH/2,0);
 return group;
}
export function createBridge(materials){
 const group=new THREE.Group();group.name='断桥（8.8 × 8.6 m）';
 const w=metres(8.6),l=metres(8.8);
 // The published bridge length/width are known; deck and rail heights are visual estimates.
 add(group,new THREE.BoxGeometry(w,metres(.5),l),materials.stone,0,metres(.25),0);
 for(const x of [-w/2+metres(.09),w/2-metres(.09)])add(group,new THREE.BoxGeometry(metres(.18),metres(.9),l),materials.stone,x,metres(.95),0);
 group.rotation.y=-Math.atan2(73.3,98.6);
 return group;
}
export function createStoneTower(materials){
 const profile=[[0,0],[.64,0],[.64,.20],[.28,.32],[.36,.46],[.46,.73],[.36,1.08],[.28,1.14],[.62,1.30],[.18,1.44],[.18,1.75],[.38,1.90],[.12,2.01],[.18,2.15],[0,2.32]];
 const group=new THREE.Group();group.name='三潭石塔（2.32 m）';
 add(group,new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(metres(r),metres(y))),12),materials.stone,0,0,0);
 return group;
}
