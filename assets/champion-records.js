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
  async function open(match,label){
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
      note.maxLength=1000;note.value=state.note;note.rows=3;noteLabel.append(note);form.append(noteLabel);note.addEventListener("input",()=>{dirty=true;publish.disabled=true;});
      const actions=el("div","champ-actions"),draft=el("button","btn small","임시 저장"),publish=el("button","btn small","확인 후 공개"),unpublish=el("button","btn ghost small","공개 취소");
      [draft,publish,unpublish].forEach(b=>{b.type="button";actions.append(b);});publish.disabled=!revision;unpublish.hidden=!state.has_published;
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
  window.ChampionRecords={init(client,canEdit){sb=client;allowed=canEdit;},open,showPublic,validateFile,close(){activeDialog?.close();}};
})();
