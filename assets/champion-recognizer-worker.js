/* Local-only icon comparison. No network or AI. */
self.onmessage=event=>{
 const {templates,crops}=event.data,N=24,mask=[];
 for(let y=0;y<N;y++)for(let x=0;x<N;x++)if((x-11.5)**2+(y-11.5)**2<100)mask.push((y*N+x)*4);
 const results=crops.map(group=>{const best=new Map();for(const crop of group)for(const t of templates){let total=0;for(const i of mask)for(let c=0;c<3;c++)total+=(crop[i+c]-t.data[i+c])**2;const score=total/(mask.length*3);if(score<(best.get(t.id)??Infinity))best.set(t.id,score);}const sorted=[...best].map(([id,score])=>({id,score})).sort((a,b)=>a.score-b.score).slice(0,3);return{candidates:sorted,reliable:sorted.length>1&&sorted[0].score<1800&&sorted[1].score>sorted[0].score*1.35};});
 self.postMessage(results);
};
