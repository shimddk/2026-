/* 경기별 팀 챔피언 기록 · 제작자: 원곡고등학교 교사 심승보 */
(() => {
  "use strict";
  const BUCKET="match-captures",LIMIT=10*1024*1024;
  let sb,allowed=()=>false,catalogPromise,activeDialog;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  const catalog=()=>catalogPromise ||= fetch("assets/champions/catalog.json").then(r=>{if(!r.ok)throw Error("챔피언 목록을 불러오지 못했습니다");return r.json();}).catch(e=>{catalogPromise=null;throw e;});
  const legal="챔피언 자료: Riot Games Data Dragon. 이 사이트는 Riot Games의 보증을 받지 않으며 Riot Games의 견해를 대변하지 않습니다. League of Legends 및 관련 자산의 상표권은 Riot Games에 있습니다.";
  function icon(c){const image=el("img");image.src="assets/champions/"+c.image;image.alt="";image.width=32;image.height=32;image.loading="lazy";return image;}
  function lineup(ids,all){const list=el("ul","champ-lineup");ids.forEach(id=>{const c=all.find(c=>c.id===id),item=el("li");if(c)item.append(icon(c),el("span","",c.name));else item.append(el("span","","챔피언 "+id));list.append(item);});return list;}
  async function showPublic(holder,division,school){
    const cards=[...holder.querySelectorAll("[data-champion-code]")];
    cards.forEach(card=>{const box=el("div","champ-public");box.append(el("p","note","챔피언 기록을 불러오는 중…"));card.append(box);});
    try{
      const [{data,error},c]=await Promise.all([sb.rpc("public_match_champions",{p_division:division,p_school:school}),catalog()]);
      if(error)throw error;
      cards.forEach(card=>{const box=card.querySelector(".champ-public"),r=(data||[]).find(r=>r.code===card.dataset.championCode);box.replaceChildren();
        if(!r){box.append(el("p","note","챔피언 기록 미등록"));return;}
        [[r.team1,r.champions1],[r.team2,r.champions2]].forEach(([team,ids])=>{box.append(el("strong","",team+(team===school?" · 우리 팀":" · 상대 팀")),lineup(ids,c.champions));});
      });
      if((data||[]).length)holder.append(el("p","champ-credit",legal));
    }catch{cards.forEach(card=>{card.querySelector(".champ-public").textContent="챔피언 기록을 불러오지 못했습니다. 다시 열어 주세요.";});}
  }
  async function validateFile(file){
    if(!file||file.size<1||file.size>LIMIT)throw Error("이미지는 최대 10MB까지 제출할 수 있습니다");
    const ext=file.name.split(".").pop().toLowerCase(),bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
    const png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,
      webp=String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
    const type=png?"image/png":jpg?"image/jpeg":webp?"image/webp":"";
    if(!type||!(type==="image/png"&&ext==="png"||type==="image/jpeg"&&["jpg","jpeg"].includes(ext)||type==="image/webp"&&ext==="webp")||(file.type&&file.type!==type))throw Error("PNG·JPG·WEBP 형식과 파일 내용을 확인하세요");
    return {type,ext:png?"png":jpg?"jpg":"webp"};
  }
  async function open(match,label,source=null){
    if(!allowed())return;
    if(activeDialog)return;
    const dialog=el("dialog","champ-editor"),heading=el("h2","",label+" · 챔피언 기록"),close=el("button","btn ghost small","닫기"),header=el("div","bracket-school-header"),status=el("p","note","불러오는 중…"),body=el("div");
    heading.id="champEditorTitle";dialog.setAttribute("aria-labelledby",heading.id);close.type="button";header.append(heading,close);dialog.append(header,status,body);document.body.append(dialog);activeDialog=dialog;dialog.showModal();
    let dirty=false,busy=false,urls=[],generation=0;
    const leave=e=>{if(dirty){e.preventDefault();e.returnValue="";}};window.addEventListener("beforeunload",leave);
    const canClose=()=>!busy&&(!dirty||confirm("저장하지 않은 입력이 있습니다. 닫을까요?"));
    close.addEventListener("click",()=>{if(canClose())dialog.close();});dialog.addEventListener("cancel",e=>{if(!canClose())e.preventDefault();});
    dialog.addEventListener("close",()=>{generation++;urls.forEach(URL.revokeObjectURL);window.removeEventListener("beforeunload",leave);activeDialog=null;dialog.remove();});
    try{
      const [{data:state,error},c]=await Promise.all([sb.rpc("teacher_champion_record",{p_match:match.id}),catalog()]);
      if(!dialog.open)return;if(error)throw error;
      let revision=state.revision,path=state.capture_path,selectedFile=null,uploadedPath=null;
      if(source?.capturePath&&source.capturePath!==path&&(!path||confirm('기존 캡처를 이 디스코드 캡처로 바꿀까요? 입력된 챔피언과 공개 기록은 유지됩니다.'))){path=source.capturePath;dirty=true;}
      body.append(el("p","",(match.scheduled_at||"시간 미정")+" · "+(state.team1||"미정")+" vs "+(state.team2||"미정")));
      if(state.stale_teams)body.append(el("p","note","대진이 바뀌어 이전 입력을 새 경기에는 적용하지 않습니다. 다시 확인해 주세요."));
      const layout=el("div","champ-edit-layout"),capture=el("section"),form=el("section"),preview=el("img","champ-capture-preview"),file=el("input"),fileLabel=el("label","","결과 캡처 (PNG·JPG·WEBP, 최대 10MB)"),fileNote=el("p","note"),note=el("textarea"),noteLabel=el("label","","내부 메모 · 학생에게 공개되지 않습니다");
      preview.alt="교사용 결과 캡처 원본";preview.hidden=true;file.type="file";file.accept="image/png,image/jpeg,image/webp";fileLabel.append(file);capture.append(fileLabel,fileNote,preview,el("p","note","원본 캡처는 경기 결과 입력 권한이 있는 지원단 교사만 열람합니다. 친구 목록 등 불필요한 부분은 잘라서 올려 주세요."));
      const showBlob=blob=>{const url=URL.createObjectURL(blob);urls.push(url);preview.src=url;preview.hidden=false;};
      if(path){const token=++generation;sb.storage.from(BUCKET).download(path).then(({data,error})=>{if(dialog.open&&token===generation){if(error)fileNote.textContent="기존 캡처를 불러오지 못했습니다. 새 파일로 바꿀 수 있습니다.";else showBlob(data);}});}
      file.addEventListener("change",async()=>{const token=++generation;fileNote.textContent="";try{const f=file.files[0];await validateFile(f);if(!dialog.open||token!==generation)return;selectedFile=f;uploadedPath=null;showBlob(f);dirty=true;publish.disabled=true;fileNote.textContent="선택됨 · 임시 저장을 누르면 업로드됩니다.";}catch(e){if(token!==generation)return;file.value="";fileNote.textContent=e.message;}});
      const choices=el("datalist");choices.id="championChoices";c.champions.forEach(ch=>{const o=el("option");o.value=ch.name;choices.append(o);});form.append(choices);
      const inputs=[[],[]];[state.team1,state.team2].forEach((team,t)=>{const group=el("fieldset");group.append(el("legend","",team||"학교 미정"));
        for(let i=0;i<5;i++){const l=el("label","champ-choice","챔피언 "+(i+1)),input=el("input"),p=el("span","champ-choice-icon");input.setAttribute("list",choices.id);input.autocomplete="off";input.value=c.champions.find(x=>x.id===(t?state.champions2:state.champions1)[i])?.name||"";
          const paint=()=>{p.replaceChildren();const ch=c.champions.find(x=>x.name===input.value.trim());if(ch)p.append(icon(ch));};paint();input.addEventListener("input",()=>{paint();dirty=true;publish.disabled=true;});l.append(input,p);group.append(l);inputs[t].push(input);}
        form.append(group);
      });
      const trial=el('section','champ-trial'),recognize=el('button','btn ghost small','무료 챔피언 인식 시험'),trialNote=el('p','note','일부 원형 초상화 결과 화면만 지원합니다. 배치·스킨이 다르면 인식하지 못할 수 있습니다. 서버·AI 전송 없이 이 브라우저에서만 처리하며, 추천은 자동 저장하지 않습니다.'),recommendations=el('div');recognize.type='button';trial.append(recognize,trialNote,recommendations);capture.append(trial);
      recognize.addEventListener('click',async()=>{
        recognize.disabled=true;trialNote.textContent='아이콘을 비교하는 중입니다…';recommendations.replaceChildren();
        try{
          const found=await window.ChampionRecognizer.recognize(preview,c.champions);if(!dialog.open)return;
          trialNote.textContent='확신이 낮은 칸은 적용하지 않습니다. 스킨·크기·화면 배치에 따라 틀릴 수 있으니 반드시 확인하세요.';
          const orientationLabel=el('label','','캡처의 위쪽 팀은 어느 학교인가요?'),orientation=el('select');[['','학교 선택'],['0',state.team1],['1',state.team2]].forEach(([value,text])=>{const o=el('option','',text);o.value=value;orientation.append(o);});orientationLabel.append(orientation);recommendations.append(orientationLabel);
          found.forEach((r,i)=>{const p=el('p','note'),sample=el('img');sample.src=r.thumbnail;sample.alt='실제로 읽은 초상화';sample.width=sample.height=32;p.append(sample,document.createTextNode(' '+(i<5?'위쪽 ':'아래쪽 ')+(i%5+1)+': '+r.candidates.map(x=>c.champions.find(ch=>ch.id===x.id)?.name||x.id).join(' / ')+(r.reliable?' · 비교상 우선 후보':' · 직접 확인 필요')));recommendations.append(p);});
          const checkedLabel=el('label','',''),checked=el('input');checked.type='checkbox';checkedLabel.append(checked,document.createTextNode(' 초상화와 추천 챔피언이 맞는지 직접 확인했습니다.'));recommendations.append(checkedLabel);
          const apply=el('button','btn small','확인한 추천을 입력란에 적용');apply.type='button';apply.disabled=true;checked.addEventListener('change',()=>{apply.disabled=!checked.checked;});recommendations.append(apply);apply.addEventListener('click',()=>{if(!checked.checked)return;if(orientation.value===''){trialNote.textContent='먼저 캡처 위쪽 팀의 학교를 선택하세요.';return;}if(inputs.flat().some(i=>i.value)&&!confirm('현재 입력란의 챔피언을 추천으로 바꿀까요? 공개된 기록은 저장·공개 전까지 유지됩니다.'))return;
            found.forEach((r,i)=>{if(!r.reliable)return;const team=i<5?Number(orientation.value):1-Number(orientation.value),ch=c.champions.find(ch=>ch.id===r.candidates[0].id);inputs[team][i%5].value=ch?.name||'';inputs[team][i%5].dispatchEvent(new Event('input',{bubbles:true}));});dirty=true;publish.disabled=true;trialNote.textContent='추천을 입력했습니다. 중복·양 팀 구분과 캡처를 확인한 뒤 임시 저장하세요.';
          });
        }catch(e){trialNote.textContent=e.message;}finally{recognize.disabled=false;}
      });
      note.maxLength=1000;note.value=state.note;note.rows=3;noteLabel.append(note);form.append(noteLabel);note.addEventListener("input",()=>{dirty=true;publish.disabled=true;});
      const actions=el("div","champ-actions"),draft=el("button","btn small","임시 저장"),publish=el("button","btn small","확인 후 공개"),unpublish=el("button","btn ghost small","공개 취소");
      [draft,publish,unpublish].forEach(b=>{b.type="button";actions.append(b);});publish.disabled=!revision||dirty;unpublish.hidden=!state.has_published;
      layout.append(capture,form);body.append(layout,actions,el("p","champ-credit",legal));status.textContent=state.has_published?"공개 중 · 수정본은 임시 저장 후 다시 공개하세요.":"학생에게 공개되지 않은 임시 기록입니다.";
      const read=()=>inputs.map(team=>{const ids=team.filter(i=>i.value.trim()).map(i=>{const ch=c.champions.find(ch=>ch.name===i.value.trim());if(!ch)throw Error("챔피언 이름을 목록에서 선택하세요");return ch.id;});if(new Set(ids).size!==ids.length)throw Error("한 팀에 같은 챔피언을 중복 선택할 수 없습니다");return ids;});
      async function save(action){
        if(busy||!allowed())return;
        try{
          const ids=read();if(action==="publish"&&(ids.some(x=>x.length!==5)||(!path&&!selectedFile)||!state.winner))throw Error("양 팀 5개·캡처·확정된 승자가 필요합니다. 승자는 경기 결과에서 먼저 입력하세요.");
          if(action==="publish"&&!confirm("양 팀 챔피언 5개씩을 확인했나요? 확인한 챔피언 목록만 학생에게 공개합니다."))return;
          busy=true;form.inert=true;capture.inert=true;actions.inert=true;close.disabled=true;status.textContent="저장 중…";
          if(selectedFile&&!uploadedPath){const format=await validateFile(selectedFile),{data:{user}}=await sb.auth.getUser();if(!user)throw Error("다시 로그인하세요");const target=user.id+"/"+match.id+"/"+crypto.randomUUID()+"."+format.ext;
            const {error}=await sb.storage.from(BUCKET).upload(target,selectedFile,{contentType:format.type,upsert:false});if(error)throw error;uploadedPath=target;
          }
          const {data,error}=await sb.rpc("save_match_champions",{p_match:match.id,p_revision:revision,p_team1:state.team1,p_team2:state.team2,p_champions1:ids[0],p_champions2:ids[1],p_capture:uploadedPath||path,p_note:note.value,p_action:action});if(error)throw error;
          revision=data;path=uploadedPath||path;selectedFile=null;uploadedPath=null;dirty=false;publish.disabled=false;
          if(action==="publish")state.has_published=true;if(action==="unpublish")state.has_published=false;unpublish.hidden=!state.has_published;
          status.textContent=action==="publish"?"확인한 챔피언 목록을 공개했습니다.":action==="unpublish"?"공개를 취소했습니다.":"임시 저장했습니다. 확인 후 공개할 수 있습니다.";
          fileNote.textContent=path?"캡처 저장 완료":"캡처 미등록";
        }catch(e){status.textContent="저장하지 못했습니다: "+e.message+" · 입력 내용은 유지됩니다.";}
        finally{busy=false;form.inert=false;capture.inert=false;actions.inert=false;close.disabled=false;}
      }
      draft.addEventListener("click",()=>save("draft"));publish.addEventListener("click",()=>save("publish"));unpublish.addEventListener("click",()=>save("unpublish"));
    }catch(e){status.textContent=e.message||"불러오지 못했습니다";}
  }
  // 2026-10-30 챔피언 사용 통계(본선 진출 32개 학교, 결과 캡처 AI 판독 결과를 모은 공개 파일 — 학교 이름·챔피언 번호·횟수만)
  let statsPromise=null;
  const stats=()=>statsPromise ||= fetch("assets/champion-stats.json",{cache:"no-cache"}).then(r=>{if(!r.ok)throw Error("no stats");return r.json();}).catch(e=>{statsPromise=null;throw e;});
  function statList(rows,all,limit){const list=el("ol","champ-stats");rows.slice(0,limit).forEach(([id,n,w],i)=>{const c=all.find(x=>x.id===id),item=el("li");
    item.append(el("span","rank",String(i+1)),c?icon(c):el("span"),el("span","",c?c.name:"챔피언 "+id),el("span","cnt",n+"회 · 승률 "+Math.round(w/n*100)+"%"));list.append(item);});return list;}
  async function showSchoolStats(holder,division,school){
    try{const [s,c]=await Promise.all([stats(),catalog()]),x=s.schools?.[school];if(!x||!x.picks.length)return;
      const box=el("section","champ-stats-box");box.append(el("h3","","많이 쓴 챔피언 TOP 5"),statList(x.picks,c.champions,5),
        el("p","note","예선 "+x.games+"경기 결과 캡처를 AI로 판독한 기준입니다. 오차가 있을 수 있어요."+(x.pending?" (확인하지 못한 "+x.pending+"칸 제외)":"")));holder.append(box);
    }catch{/* 통계 파일이 없으면 표시하지 않음 */}
  }
  async function renderTop(holder){
    try{const [s,c]=await Promise.all([stats(),catalog()]);if(!s.top)return;
      const card=el("section","card champ-top"),grid=el("div","champ-top-grid");
      card.append(el("h3","","📊 본선 진출 팀 인기 챔피언 TOP 10"));
      ["중등부","고등부"].forEach(d=>{const col=el("div");col.append(el("h4","",d),statList(s.top[d]||[],c.champions,10));grid.append(col);});
      card.append(grid,el("p","note","본선 진출 32개 학교가 예선에서 고른 챔피언입니다(결과 캡처 AI 판독, 오차 가능). 학교 이름을 누르면 그 학교가 많이 쓴 챔피언 TOP 5를 볼 수 있어요. 갱신: "+new Date(s.updated).toLocaleString("ko-KR",{timeZone:"Asia/Seoul",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})),el("p","champ-credit",legal));
      holder.replaceChildren(card);
    }catch{holder.replaceChildren();}
  }
  window.ChampionRecords={init(client,canEdit){sb=client;allowed=canEdit;},open,showPublic,showSchoolStats,renderTop,validateFile,close(){activeDialog?.close();}};
})();
