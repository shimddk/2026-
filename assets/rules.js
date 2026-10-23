/* 2026 경기도 교육감배 미래형 이스포츠 스쿨리그 · 제작자: 원곡고등학교 교사 심승보
   © 2026 심승보. All rights reserved. 허락 없이 복제·수정·배포할 수 없습니다. */
/* 경기 규정 탭: 공식 규정집(Ver 1.0)과 팀장 교육 자료를 카드뉴스로 정리 */
(function () {
  // key: 핵심 3줄(숫자는 **로 강조), more: 자세히
  const RULEBOOK = [
    { no: "제1조", icon: "🏛️", title: "대회 운영 사무국",
      key: ["주최: **경기도교육청**", "일정·시간 변경 시 사유를 선수·팀에 고지", "규정 변경은 확정 후 **24시간** 안에 디스코드 공지"],
      more: ["행사 업체·방송사가 진행을 도울 수 있음", "변경된 일정이 특정 선수에게 불이익이 되지 않게 함", "규정에 없는 일은 상관례·신의성실 원칙으로 판단"] },
    { no: "제2조", icon: "🪪", title: "선수 자격",
      key: ["만 **12세** 이상 대한민국 국적 (2014.10.17. 이전 출생)", "경기도 소재 중·고등학교 재학생", "LoL 한국 서버 **본인 명의** 계정 1개 이상"],
      more: ["게임물 이용등급 연령을 충족해야 함", "최근 **2년** 안에 LCK·LCK CL 로스터 등록 선수는 출전 불가", "범죄 행위·수사 중이면 출전 불가", "사회적 물의·게임 제재 이력이 있으면 참가 제한 가능", "출전 권한은 양도·판매 불가"] },
    { no: "제3조", icon: "🤝", title: "선수의 의무",
      key: ["규정 질문은 경기 시작 **1시간 전**까지", "공지된 규정 변경 확인은 선수 책임", "욕설·폭언·비방 금지, 판정에 승복"],
      more: ["본인 행동으로 생긴 불이익은 본인 책임", "승부조작·과도한 도발 등 스포츠맨십 위반 금지", "오프라인에서는 주최측 장비를 그대로 사용", "문제 소지가 있는 외부 프로그램은 심판 허가 후 설치", "LoL 운영 정책 위반 시 즉시 참가 자격 박탈"] },
    { no: "제4조", icon: "📍", title: "경기구역",
      key: ["심판 허가 없이 경기구역 이탈 금지 (무단 이탈은 **실격**)", "복귀·집결 시간 반드시 준수", "선수 외 제3자 출입 금지 (응급·장비 문제는 예외)"],
      more: ["오프라인 경기장: 대회 PC에 무단 설치·변조 금지", "경기 부스·선수 대기실은 심판 허가 하에 출입", "대회장은 금연, 흡연 시 **실격**", "부스 반입 금지: 휴대폰·전자기기, 뚜껑 없는 음료·음식"] },
    { no: "제5조", icon: "⏱️", title: "경기 절차",
      key: ["지정 시간에 체크인, 본인 확인 요청에 따라야 함", "경기 시작 전 장비·설정 세팅 완료 (온라인은 장비 지원 없음)", "경기 후 **승리팀**이 결과 스크린샷 업로드"],
      more: ["지각 사유가 생기면 즉시 운영사무국에 연락하고 증빙 제출", "심판이 정한 시간에 정시 착석", "돌발 상황은 즉시 심판·운영사무국에 보고", "심판 지시 없이 게임 중단 금지, 고의 돌발 상황은 최대 실격", "경기 중 이의는 심판에게, 판정 이의는 경기 후 디스코드로"] },
    { no: "제6조", icon: "🎮", title: "경기 규칙",
      key: ["모드: **토너먼트 드래프트** · 소환사의 협곡 · 5인", "온라인 진영 선택: 조별리그는 **하위팀**, 본선(더블 엘리)부터는 **상위팀**", "방은 **레드** 팀장이 만들고 블루 팀장을 초대"],
      more: ["라이브 서버 최신 버전 사용", "평소 쓰는 본인 계정만 사용 (직계가족 계정은 서류·사전 허가)", "부적절한 닉네임은 변경 요청에 따라야 함 · 불응 시 **주의 1회**", "챔피언 교환·소환사 주문은 게임 시작 **20초 전**까지", "로비 관전자 공개, 승리 조건은 넥서스 파괴", "오프라인 진영은 심판 코인토스 후 번갈아 선택"] },
    { no: "제7조", icon: "🕹️", title: "게임 규칙",
      key: ["경기 시작 후 입장하면 **그날 경기 참가 불가**", "전체 채팅·감정 표현 금지 (**GG**만 허용)", "담합·버그 악용은 **실격**"],
      more: ["리그 기간 중 나온 신챔피언 사용 가능", "버그가 알려진 아이템·챔피언 등은 운영사무국이 수시로 제한 가능", "게임 버전 업데이트 시 규정이 바뀔 수 있음"] },
    { no: "제8조", icon: "⏸️", title: "게임 중단",
      key: ["선수 일시정지는 장비 오작동·신체 방해·FPS/핑 문제만", "정지 후 재개는 **심판 승인** 후에만", "중단 중 경기 관련 대화 금지"],
      more: ["질병 등은 심판에게 미리 알리고, **10분** 안에 복귀 못하면 기권패 가능", "무단 정지·고의 접속 종료는 페널티", "재경기는 문제가 생긴 **해당 세트만**", "선수 귀책 접속 해제·장비 미흡·게임 버그는 재경기 아님", "10분 넘게 재개 못하면 판정승 가능: 골드 33% 초과 · 포탑 7개 · 억제기 2개 · 넥서스 포탑 2개 · 생존 4명(부활 40초 이상) 차이"] },
    { no: "제9조", icon: "🟨", title: "규정 위반",
      key: ["경고 **1회** 진영 선택 제한 · **2회** 밴카드 전체 제한 + 진영 선택 제한 · **3회** 실격패", "지각 **15분**부터 주의 · **20분**부터 세트 몰수 및 실격", "주의 **2회** = 경고 **1회**"],
      more: ["진영 선택 제한은 해당 라운드 전체에 적용", "양 팀장이 서로 합의하면 **15분**까지는 주의 없음", "판정 권한은 운영사무국, 발표는 심판장", "실격패: 해당 날짜의 모든 경기 패배", "누적 경고는 **결승 전** 일괄 초기화", "지시에 따르지 않으면 실격·상금 몰수 가능"] },
    { no: "제10조", icon: "👕", title: "게임 외 규칙",
      key: ["대리 게임은 **실격**", "팀원 변경은 부득이한 사유 + 서류 제출 시에만", "대회 중 닉네임 변경은 사전 승인 필요"],
      more: ["교체 가능 사유: 친족 부고, 입영, 입원, 해외 이민, 국가 공인 시험 등", "부적절한 복장 제재 가능", "대회 정보를 SNS·커뮤니티에 무단 배포 금지", "자료 제출·인터뷰·사진 촬영에 협조", "과격한 언행·상대와의 채팅·부적절한 닉네임 금지"] },
    { no: "제11조", icon: "📎", title: "기타 사항",
      key: ["대회 콘텐츠 저작권은 운영사무국", "대회 후라도 부정이 발견되면 수상 몰수 가능", "규정에 없는 상황은 현장 심판·운영진 판단"],
      more: [] }
  ];

  // 팀장 교육 자료 (경고 기준 포함)
  const BRIEFING = [
    { title: "리그전 동률 기준", icon: "⏱️", items: ["승수가 많은 팀이 먼저!", "2팀이 같으면 서로 붙어서 이긴 팀이 위! (승자승)", "3팀 이상 같으면 경기 시간 비교: 빠르게 이기고 지더라도 오래 버틴 팀이 유리"], warn: "경기 시간까지 같으면 지원단 확인 · 자세한 기준은 질문/FAQ" },
    { title: "원칙", icon: "🧭", items: ["문제 발생 → 양 팀장 협의 → 관전 중인 지도/지원단 교사 → 지원단 선생님 호출", "지원단 선생님 지시에 따름, 이의는 학교 지도교사를 통해", "정해지지 않은 문제는 지원단 협의로 해결", "다른 학교에 매너·예의 지키기"], warn: "지시 거부 시 경고 1회" },
    { title: "대회 운영 방식", icon: "📋", items: ["토너먼트 드래프트가 원칙 (라인별로 줄 서기)", "양 팀 챔피언이 부족하면 합의 후 밴픽툴 사용 가능", "모든 경기 단판(BO1) · 피어리스 규칙 없음", "첫 예선: 중등 64팀·16개 조, 고등 32팀·8개 조(모두 4팀 1조), 각 조 1·2위만 진출, 3위 승급 없음", "조별리그 1·2경기 동시 시작, 3·4경기 1시간 뒤, 5·6경기 2시간 뒤(팀당 3경기)", "중등 32강(8개 조)은 각 조 1·2위만 본선 진출", "중등·고등 모두 32강 조 순위로 본선 자동 연결(재배정 없음): 장로 A1-B2·C1-D2·E1-F2·G1-H2 / 바론 B1-A2·D1-C2·F1-E2·H1-G2"] },
    { title: "닉네임 변경 요청", icon: "🪪", items: ["부적절한 닉네임은 변경 요청에 따라 바꿔야 함", "게임에서 닉네임을 바꾼 뒤 팀장이 사이트에 새 아이디 저장"], warn: "변경 요청 불응 시 주의 1회" },
    { title: "경기 미입장 (지각)", icon: "🚪", items: ["15분부터 주의 (양 팀장이 서로 합의하면 15분까지는 주의 없음)", "20분부터 세트 몰수 및 실격", "기다리는 동안 지도/지원단 선생님에게 연락", "연락 안 되는 팀원·팀은 지원단 선생님(빨간색)에게 연락", "불가피한 사정이면 재경기, 피해 팀에 진영 선택권"], warn: "상호 합의로 시간 이동 가능 (지원단 보고)" },
    { title: "게임 시작 전 상황", icon: "🔀", items: ["게임 시작 전 라인 교환은 상대 팀장에게 보고 (게임 중 라인스왑은 문제 없음)", "드래프트 중 닷지·가픽: 상대 픽 전이면 양해 구하고 리셋 가능", "상대가 이미 밴·픽을 진행했다면 상대 동의 없이 리셋 불가"], warn: "발생 시 경고 1회" },
    { title: "표현 허용 범위", icon: "💬", items: ["욕설 금지", "전체 채팅·인장·이모티콘 등 표현은 GG만 허용, 나머지는 모두 금지", "퍼즈(일시정지)는 팀원도 사용 가능"], warn: "경고 1회" },
    { title: "게임 중 상황", icon: "🎯", items: ["퍼즈는 1회 가능", "기권패는 하지 않음 (비매너 행위)", "조별리그 도중 기권: 완료한 결과 유지, 이후 경기는 상대 팀 부전승(1:0)", "기권 학교는 내년도(2027년) 대회 참가 불가"], warn: "퍼즈 2회부터 경고 1회 · 기권패 시 경고 2회 + 내년 참가 제한" },
    { title: "관전·음성 채팅", icon: "🎧", items: ["예비 선수·코치·지도교사 관전 가능, 친구·타교 선수는 허락 후", "경기 중 보이스는 선수만 (선생님은 가능)", "예비 선수·지도교사·코치: 밴픽·쉬는 시간 참여 가능", "친구·타교 관전자: 음성 채팅 불가"], warn: "디스코드 채팅이나 경기 중 선수 외 사람과 경기 내용으로 대화하면 무효패 처리" },
    { title: "스크림은 디스코드에서", icon: "🧪", items: ["후보 선수가 아닌 친구를 대타로 불러도 됨", "지도교사에게 요청하면 임시 권한으로 대화방 입장 가능"], warn: "사설방 진행 시 경고 1회" },
    { title: "학교 폭력 발생 시", icon: "🛡️", items: ["채팅·게임 내 발생: 증거를 모아 즉시 심판·지원단 선생님에게 보고", "오프라인 갈등: 직접 해결하지 말고 지원단 선생님에게 도움 요청"] },
    { title: "경고 누적 조치", icon: "📈", items: ["경고 1회: 해당 라운드 전체 진영 선택 제한", "경고 2회: 밴카드 전체 제한 + 진영 선택 제한", "경고 3회: 실격패", "주의 2회 = 경고 1회 · 누적 경고는 결승 전 일괄 초기화"] }
  ];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  // **강조** 를 <strong class="hl"> 로 (textContent 기반이라 안전)
  function rich(text) {
    const p = el("span");
    text.split(/(\*\*[^*]+\*\*)/).forEach(part => {
      if (part.startsWith("**")) p.append(el("strong", "hl", part.slice(2, -2)));
      else if (part) p.append(document.createTextNode(part));
    });
    return p;
  }

  function carousel(id, cards) {
    const wrap = el("div", "carousel");
    const track = el("div", "track");
    track.id = id;
    track.tabIndex = 0;
    track.setAttribute("aria-label", "카드 넘기기 (좌우 화살표)");
    cards.forEach((c, i) => {
      c.setAttribute("aria-roledescription", "카드");
      c.setAttribute("aria-label", (i + 1) + " / " + cards.length);
      track.append(c);
    });
    const prev = el("button", "nav prev", "‹");
    const next = el("button", "nav next", "›");
    prev.type = next.type = "button";
    prev.setAttribute("aria-label", "이전 카드");
    next.setAttribute("aria-label", "다음 카드");
    const step = dir => track.scrollBy({ left: dir * (track.firstElementChild?.offsetWidth || 300) + dir * 16, behavior: "smooth" });
    prev.addEventListener("click", () => step(-1));
    next.addEventListener("click", () => step(1));
    track.addEventListener("keydown", e => {
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    });
    // 'n / 전체' 숫자는 한 화면에 카드가 여러 장 보이면 끝까지 넘겨도 마지막 번호가 안 나와서 없앰 (2026-10-19 사용자 요청)
    wrap.append(prev, track, next);
    return wrap;
  }

  function ruleCard(r) {
    const c = el("article", "rcard");
    const head = el("div", "rhead");
    head.append(el("span", "ricon", r.icon), el("span", "rno", r.no));
    c.append(head, el("h3", "", r.title));
    if (r.conflict) c.append(el("span", "badge-wait", "지원단 최종 확인 중"));
    const ul = el("ul", "rkey");
    r.key.forEach(k => { const li = el("li"); li.append(rich(k)); ul.append(li); });
    c.append(ul);
    if (r.more.length) {
      const d = el("details");
      d.append(el("summary", "", "자세히 보기"));
      const ul2 = el("ul");
      r.more.forEach(k => { const li = el("li"); li.append(rich(k)); ul2.append(li); });
      d.append(ul2);
      c.append(d);
    }
    return c;
  }

  function briefCard(b, i) {
    const c = el("article", "rcard brief");
    const head = el("div", "rhead");
    head.append(el("span", "ricon", b.icon), el("span", "rno", "교육 " + (i + 1)));
    c.append(head, el("h3", "", b.title));
    if (b.conflict) c.append(el("span", "badge-wait", "지원단 최종 확인 중"));
    const ul = el("ul", "rkey");
    b.items.forEach(k => ul.append(el("li", "", k)));
    c.append(ul);
    if (b.warn) c.append(el("p", "warn", "⚠ " + b.warn));
    return c;
  }

  const root = document.getElementById("rulesRoot");
  if (!root) return;
  root.append(
    el("h3", "rsec", "공식 규정집 (Ver 1.0) · 제1조~제11조"),
    carousel("ruleTrack", RULEBOOK.map(ruleCard)),
    el("h3", "rsec", "팀장 교육 · 운영 세부 지침 " + BRIEFING.length + "개"),
    (() => {
      // 교육이 끝나면(10/21 22:30) 안내가 저절로 바뀜 (열어 둔 페이지도)
      const p = el("p", "notice-line"), END = Date.parse("2026-10-21T22:30:00+09:00");
      // 문구 조각: 문자열 = 보통 글자, [글자] = 굵게, null = 줄바꿈 (innerHTML 없이 만듦)
      const put = parts => p.replaceChildren(...parts.map(x => x === null ? el("br") : Array.isArray(x) ? el("strong", "", x[0]) : document.createTextNode(x)));
      const draw = () => put(Date.now() >= END
        ? ["📢 ", ["팀장 대상 대회 교육"], "은 10월 21일(수)에 진행했습니다. 교육 내용은 아래 카드에서 언제든 확인하세요."]
        : ["📢 ", ["팀장 대상 대회 교육"], ": 10월 21일(수) ", ["오후 8시(20:00) / 10시(22:00)"], " 2회 진행 · 둘 중 한 번 참여 · 교육 시간 20분", null, "팀장과 함께 ", ["팀원 최소 1명 이상"], " 포함해서 참여해 주세요."]);
      draw();
      const left = END - Date.now();
      if (left > 0 && left < 2147483647) setTimeout(draw, left + 500);
      return p;
    })(),
    carousel("briefTrack", BRIEFING.map(briefCard))
  );
})();
