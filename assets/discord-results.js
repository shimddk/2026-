/* 디스코드 결과 캡처 검토 · 원곡고등학교 교사 심승보 */
(() => {
 const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n;};
 let sb,allowed=()=>false,cleanup=()=>{};
 function render(box,matches,division,label){
  if(!allowed())return;
  cleanup();
  const section=el('details','discord-inbox'),summary=el('summary','','디스코드 결과 캡처 · 불러오는 중'),body=el('div');section.append(summary,body);box.append(section);
  let offset=0,filter='review',generation=0,urls=[];
  cleanup=()=>{generation++;urls.forEach(URL.revokeObjectURL);urls=[];section.remove();};
  async function load(){
   const request=++generation;const {data,error}=await sb.rpc('discord_results_inbox',{p_division:division,p_offset:offset,p_filter:filter});if(request!==generation||!section.isConnected||!allowed())return;
   body.replaceChildren();urls.forEach(URL.revokeObjectURL);urls=[];
   if(error){summary.textContent='디스코드 결과 캡처 · 조회 실패';body.append(el('p','note','권한과 연결 상태를 확인하고 다시 열어 주세요.'));return;}
   const counts=data.counts||{};summary.textContent='디스코드 결과 캡처 · '+division+' '+counts.captured+'/'+counts.total+'개 보관 · 연결 전 '+counts.unlinked+'개';
   const controls=el('div','discord-inbox-controls'),refresh=el('button','btn ghost small','목록 새로고침'),select=el('select');refresh.type='button';refresh.addEventListener('click',load);
   [['review','전체 검토'],['linked','경기 연결됨'],['ignored','제외한 캡처']].forEach(([v,t])=>{const o=el('option','',t);o.value=v;select.append(o);});select.value=filter;select.setAttribute('aria-label','결과 캡처 필터');select.addEventListener('change',()=>{filter=select.value;offset=0;load();});controls.append(select,refresh);body.append(controls);
   const backfill=(data.channels||[]).filter(c=>!c.backfill_done).length;
   const sync=data.sync;body.append(el('p','note',(backfill?'과거 기록을 가져오는 중입니다. ':'과거 메시지 확인을 마쳤습니다. ')+(sync?.finished_at?'최근 수집: '+new Date(sync.finished_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' · ':'')+(sync?.last_ok===false?'수집이 지연되었습니다. 권한·연결 상태를 확인 중입니다. ':'')+'새 결과는 2분마다 확인합니다. 캡처는 교사용이며 결과는 자동 저장하지 않습니다. 심판이 입력한 승패·경기 시간 확인용입니다.'));
   const list=el('div','discord-report-list');body.append(list);
   if(!data.rows?.length)list.append(el('p','note','이 조건에 맞는 캡처가 없습니다.'));
   (data.rows||[]).forEach(r=>{
    const card=el('article','discord-report'),title=el('h4'),status=el('p','note'),matchSelect=el('select'),actions=el('div','discord-inbox-controls'),link=el('button','btn small','경기 연결'),open=el('button','btn small','챔피언 입력'),ignore=el('button','btn ghost small',r.ignored?'제외 해제':'이 캡처 제외'),previewButton=el('button','btn ghost small','캡처 미리보기'),preview=el('img','discord-capture-preview');
    preview.hidden=true;preview.alt='교사용 결과 캡처';[link,open,ignore,previewButton].forEach(b=>b.type='button');
    const source=el('a','','디스코드 원문');source.href='https://discord.com/channels/1545075931545206795/'+r.channel_id+'/'+r.message_id;source.target='_blank';source.rel='noopener noreferrer';
    const none=el('option','','연결할 경기 선택');none.value='';matchSelect.append(none);matchSelect.setAttribute('aria-label','연결할 경기');
    const choices=matches.filter(m=>m.division===division&&m.team1&&m.team2).sort((a,b)=>Number((r.candidates||[]).includes(b.id))-Number((r.candidates||[]).includes(a.id)));
    choices.forEach(m=>{const candidate=(r.candidates||[]).includes(m.id),o=el('option','',(candidate?'[후보] ':'')+label(m)+' · '+(m.scheduled_at||m.round_label||'')+' · '+m.team1+' vs '+m.team2);o.value=m.id;matchSelect.append(o);});matchSelect.value=String(r.match_id||((r.candidates||[]).length===1?r.candidates[0]:'')||'');
    const paint=()=>{const m=matches.find(m=>m.id===r.match_id);title.textContent=new Date(r.sent_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' · '+(m?label(m)+' · '+m.team1+' vs '+m.team2:'경기 연결 확인 필요');status.textContent=(r.ignored?'제외됨':r.stale_teams?'대진이 바뀌었습니다. 경기를 다시 연결하세요.':r.match_id?'경기 연결됨 · 캡처로 승패·경기 시간을 확인하세요.':'후보는 제안일 뿐입니다. 캡처와 학교를 확인하고 경기 연결을 눌러 주세요.')+(r.capture_path?'':r.error==='no_image'?' · 글만 있는 기록':r.error?' · '+({too_large:'10MB 초과 · 용량을 줄여 직접 업로드해 주세요',source_missing:'원문 이미지가 삭제되었거나 접근할 수 없습니다',invalid_image:'지원 이미지인지 확인해 주세요',blocked_url:'허용되지 않은 첨부 주소',retry:'이미지를 다시 가져오는 중입니다'}[r.error]||'이미지 수집 확인 필요'):' · 이미지 보관 대기');previewButton.disabled=!r.capture_path;open.disabled=!r.match_id||!r.capture_path||r.ignored||r.stale_teams;};
    async function review(ignored,preserve=false){link.disabled=true;ignore.disabled=true;const chosen=preserve?r.match_id:(matchSelect.value?Number(matchSelect.value):null);const {data,error}=await sb.rpc('review_discord_result',{p_id:r.id,p_revision:r.revision,p_match:chosen,p_ignore:ignored});link.disabled=false;ignore.disabled=false;if(error){status.textContent='저장하지 못했습니다. '+error.message;return false;}r.revision=data;r.match_id=chosen;r.ignored=ignored;if(!preserve)r.stale_teams=false;ignore.textContent=ignored?'제외 해제':'이 캡처 제외';paint();return true;}
    link.addEventListener('click',async()=>{if(!matchSelect.value){status.textContent='경기를 먼저 선택하세요.';return;}await review(false);});ignore.addEventListener('click',()=>review(!r.ignored,true));
    open.addEventListener('click',()=>{const m=matches.find(m=>m.id===r.match_id);if(m)window.ChampionRecords.open(m,label(m),{capturePath:r.capture_path});});
    previewButton.addEventListener('click',async()=>{previewButton.disabled=true;const {data,error}=await sb.storage.from('match-captures').download(r.capture_path);if(error){status.textContent='캡처를 불러오지 못했습니다.';previewButton.disabled=false;return;}if(!card.isConnected||!allowed())return;const url=URL.createObjectURL(data);urls.push(url);preview.src=url;preview.hidden=false;});
    actions.append(link,previewButton,ignore,source);/* 2026-10-30 챔피언 입력 버튼(open) 숨김: 결과 확인용으로만 사용 */card.append(title,status,matchSelect,actions,preview);paint();list.append(card);
   });
   const pager=el('div','discord-inbox-controls'),previous=el('button','btn ghost small','이전 30개'),next=el('button','btn ghost small','다음 30개');previous.type=next.type='button';previous.disabled=offset===0;next.disabled=(data.rows||[]).length<30;previous.addEventListener('click',()=>{offset=Math.max(0,offset-30);load();});next.addEventListener('click',()=>{offset+=30;load();});pager.append(previous,next);body.append(pager);
  }
  load();
 }
 window.DiscordResults={init(client,canRead){sb=client;allowed=canRead;},render,clear(){cleanup();cleanup=()=>{};}};
})();
