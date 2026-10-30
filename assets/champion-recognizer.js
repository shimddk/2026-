/* 시험용 무료 아이콘 인식 · 모든 캡처 처리는 현재 브라우저 안에서만 수행 */
(() => {
 let templatePromise;
 const loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('챔피언 아이콘을 불러오지 못했습니다'));img.src=src;});
 async function templates(champions){
  if(templatePromise)return templatePromise;
  templatePromise=(async()=>{const result=[],canvas=document.createElement('canvas');canvas.width=canvas.height=24;const ctx=canvas.getContext('2d',{willReadFrequently:true});
   for(let start=0;start<champions.length;start+=4){const batch=champions.slice(start,start+4),images=await Promise.all(batch.map(c=>loadImage('assets/champions/'+c.image)));batch.forEach((c,i)=>{const image=images[i];for(const inset of [0,6,12]){ctx.clearRect(0,0,24,24);ctx.drawImage(image,inset,inset,image.naturalWidth-inset*2,image.naturalHeight-inset*2,0,0,24,24);result.push({id:c.id,data:ctx.getImageData(0,0,24,24).data});}});}return result;
  })().catch(e=>{templatePromise=null;throw e;});return templatePromise;
 }
 async function recognize(image,champions){
  if(!image.complete||!image.naturalWidth)throw Error('캡처를 먼저 불러오세요');
  const ratio=image.naturalWidth/image.naturalHeight;if(image.naturalWidth<960||Math.abs(ratio-1280/717)>.06)throw Error('시험 기능은 잘리지 않은 16:9 결과 화면만 지원합니다. 이 캡처는 직접 선택해 주세요.');
  const scale=image.naturalWidth/1280,centers=[281,316,350,385,420,498,533,567,602,637],guard=document.createElement('canvas');guard.width=guard.height=37;const guardCtx=guard.getContext('2d',{willReadFrequently:true});
  // Aspect ratio does not identify a results layout. Require all ten expected
  // circular frames before comparing portraits; otherwise do not guess.
  for(const y of centers){guardCtx.clearRect(0,0,37,37);guardCtx.drawImage(image,(123-18)*scale,(y-18)*scale,37*scale,37*scale,0,0,37,37);const pixels=guardCtx.getImageData(0,0,37,37).data;let gold=0,total=0;
   for(let dy=-18;dy<=18;dy++)for(let dx=-18;dx<=18;dx++){const radius=Math.hypot(dx,dy);if(radius<14||radius>17)continue;const i=((dy+18)*37+dx+18)*4,R=pixels[i],G=pixels[i+1],B=pixels[i+2];total++;if(R>100&&G>65&&R>G*1.05&&G>B*1.1)gold++;}
   if(gold/total<.16)throw Error('이 캡처는 초상화 위치·표시 방식이 달라 무료 인식을 지원하지 않습니다. 잘못된 추천을 방지하기 위해 중단했습니다. 챔피언을 직접 선택해 주세요.');
  }
  const canvas=document.createElement('canvas');canvas.width=canvas.height=24;const ctx=canvas.getContext('2d',{willReadFrequently:true}),crops=[],thumbnails=[];
  for(const y of centers){const group=[];ctx.clearRect(0,0,24,24);ctx.drawImage(image,(123-13)*scale,(y-13)*scale,26*scale,26*scale,0,0,24,24);thumbnails.push(canvas.toDataURL('image/png'));for(const size of [24,26,28,30])for(const dx of [-1,0,1])for(const dy of [-1,0,1]){ctx.clearRect(0,0,24,24);ctx.drawImage(image,(123-size/2+dx)*scale,(y-size/2+dy)*scale,size*scale,size*scale,0,0,24,24);group.push(ctx.getImageData(0,0,24,24).data);}crops.push(group);}
  const bank=await templates(champions);
  return new Promise((resolve,reject)=>{const worker=new Worker('assets/champion-recognizer-worker.js'),timer=setTimeout(()=>{worker.terminate();reject(Error('인식 시간이 길어졌습니다. 직접 선택하거나 다시 시도하세요'));},45000);worker.onmessage=e=>{clearTimeout(timer);worker.terminate();resolve(e.data.map((r,i)=>({...r,thumbnail:thumbnails[i]})));};worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(Error('아이콘 인식에 실패했습니다. 직접 선택해 주세요'));};worker.postMessage({templates:bank,crops});});
 }
 window.ChampionRecognizer={recognize};
})();
