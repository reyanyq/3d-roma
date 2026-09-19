const previewButton=document.querySelector('#detail-photo-button');
const previewImage=document.querySelector('#detail-photo');
const previewHint=document.querySelector('#detail-photo-hint');
const viewer=document.querySelector('#photo-viewer');
const largeImage=document.querySelector('#photo-full');
const viewerStatus=document.querySelector('#photo-status');
let currentPhoto=null,currentLocation=null;

function showLargePhoto(){
 if(!currentPhoto)return;
 document.querySelector('#photo-title').textContent=currentLocation.name+' · 实景';
 document.querySelector('#photo-author').textContent=currentPhoto.author;
 const source=document.querySelector('#photo-source');source.href=currentPhoto.sourceUrl;
 const license=document.querySelector('#photo-license');license.textContent=currentPhoto.license;license.href=currentPhoto.licenseUrl;
 largeImage.alt=currentPhoto.alt;
 viewerStatus.hidden=false;viewerStatus.textContent='正在载入照片…';
 largeImage.onload=()=>{viewerStatus.hidden=true;};
 largeImage.onerror=()=>{viewerStatus.hidden=false;viewerStatus.textContent='照片暂时无法显示，请关闭后重试。';};
 largeImage.src=currentPhoto.src;
 if(largeImage.complete&&largeImage.naturalWidth>0)viewerStatus.hidden=true;
 if(!viewer.open)viewer.showModal();
}
export function setLocationPhoto(location,photo){
 currentLocation=location;currentPhoto=photo;
 previewButton.hidden=!photo;
 if(!photo)return;
 previewButton.disabled=false;previewButton.setAttribute('aria-label','查看'+location.name+'实景大图');
 previewButton.setAttribute('aria-busy','true');
 previewImage.hidden=false;previewImage.alt=photo.alt;previewImage.style.objectPosition=photo.focus||'50% 50%';
 previewHint.textContent='查看大图';
 previewImage.onload=()=>{previewButton.setAttribute('aria-busy','false');};
 previewImage.onerror=()=>{previewButton.setAttribute('aria-busy','false');previewImage.hidden=true;previewHint.textContent='照片暂时无法显示';previewButton.disabled=true;};
 previewImage.src=photo.src;
 if(previewImage.complete&&previewImage.naturalWidth>0)previewButton.setAttribute('aria-busy','false');
 if(viewer.open)showLargePhoto();
}
previewButton.addEventListener('click',showLargePhoto);
document.querySelector('#close-photo').addEventListener('click',()=>viewer.close());
viewer.addEventListener('click',event=>{
 if(event.target!==viewer)return;
 const r=viewer.getBoundingClientRect();
 if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)viewer.close();
});
viewer.addEventListener('close',()=>{if(!previewButton.hidden)previewButton.focus({preventScroll:true});});
