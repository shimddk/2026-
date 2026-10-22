/* 2026 경기도 교육감배 미래형 이스포츠 스쿨리그 · 제작자: 원곡고등학교 교사 심승보
   © 2026 심승보. All rights reserved. 허락 없이 복제·수정·배포할 수 없습니다. */
/* 교사용 화면: 구글 로그인 → 승인 대기 → 승인 후 교사 전용 탭
   권한은 Supabase RLS가 DB에서 막는다. 이 파일의 화면 제어는 편의용일 뿐이다. */
(function () {
  const SB_URL = "https://vbvkqqagbgqpoavvczvp.supabase.co";
  const SB_KEY = "sb_publishable_d6bAYnQ0cJJefCw6rnWb4g_FpGMaaCD"; // 공개용 키 (RLS로 보호)
  const XLSX_SRC = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";

  const LOGIN_READY = true; // 구글 로그인 설정 완료 (2026-10-15)
  const acct = document.getElementById("acct");
  if (!LOGIN_READY && acct) acct.hidden = true;
  if (!window.supabase) {
    // 오프라인 등으로 라이브러리를 못 불러오면 학생용 화면만 동작
    if (acct) acct.hidden = true;
    return;
  }
  const sb = window.supabase.createClient(SB_URL, SB_KEY, {
    auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true }
  });

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const fmtTime = t => t ? new Date(t).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  function toast(msg, bad) {
    const t = el("div", "toast" + (bad ? " bad" : ""), msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 2600);
  }
  // 버튼이 달린 알림 (예: 삭제 후 되돌리기), 10초 뒤 사라짐
  function toastAction(msg, label, fn) {
    document.querySelectorAll(".toast.action").forEach(t => t.remove());
    const t = el("div", "toast action", msg + " ");
    const b = el("button", "toast-btn", label);
    b.type = "button";
    b.addEventListener("click", async () => { b.disabled = true; await fn(); t.remove(); });
    t.append(b);
    document.body.append(t);
    setTimeout(() => t.remove(), 10000);
  }
  // 명단·연락처·티어 행 삭제 + 되돌리기
  async function deleteSheetRow(r, sheet, redraw) {
    const { error } = await sb.from("sheet_rows").delete().eq("id", r.id);
    if (error) { toast("삭제 실패: " + error.message, true); redraw(); return; }
    toastAction("삭제했습니다.", "되돌리기", async () => {
      const { error: e2 } = await sb.from("sheet_rows").insert({ sheet, row_no: r.row_no, data: r.data });
      toast(e2 ? "되돌리기 실패: " + e2.message : "되돌렸습니다", !!e2);
      redraw();
    });
    redraw();
  }

  /* ---------- 학생용 공개 대진표 ---------- */
  // 공개 시각(app_settings bracket_publish_at, 10/20 19:00) 전에는 학생에게 학교 이름이 안 옴 → 페이지를 열어 둔 채 그 시각이 되면 다시 불러옴
  let bracketTimer = null;
  function loadPublicBracket() {
    Promise.all([sb.rpc("public_bracket"), sb.rpc("public_standings"), sb.rpc("public_schedule"), sb.rpc("public_bracket_publish_at"), sb.rpc("public_lineups").select("school,region")]).then(([m, s, sc, pa, regions]) => {
      const at = pa && !pa.error && pa.data ? Date.parse(pa.data) : null;
      if (window.setBracketPublish) window.setBracketPublish(at);
      if (!m.error && m.data && m.data.length && window.applyBracket) window.applyBracket(m.data, s.error ? [] : s.data, regions.error ? [] : regions.data);
      if (!sc.error && window.applySchedule) window.applySchedule(sc.data);
      const left = at ? at - Date.now() : 0;
      if (!bracketTimer && left > 0 && left < 2147483647) bracketTimer = setTimeout(() => { bracketTimer = null; loadPublicBracket(); }, left + 3000);
    });
  }
  loadPublicBracket();

  /* ---------- 챗봇: 디스코드 질문방 답변 (구글 시트 → 10분마다 DB 갱신) ---------- */
  sb.rpc("public_discord_qa").then(({ data, error }) => {
    if (!error && data && window.setDiscordQA) window.setDiscordQA(data);
  });

  /* ---------- 방문자 수 (하루 1회) ----------
     - 로그인한 선생님: 계정 기준 하루 1번 (여러 기기로 들어와도 1번)
     - 그 외: 브라우저별 무작위 번호로 하루 1번
     - 세지 않음: 로컬 점검, 자동 브라우저·검색 로봇, Claude 앱 점검 브라우저 */
  (async function countVisit() {
    const box = document.getElementById("visits");
    if (!box) return;
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    const robot = navigator.webdriver || /Headless|bot|crawl|spider|slurp|Lighthouse|Claude\//i.test(navigator.userAgent);
    let vid = null;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session && session.user) vid = session.user.id;
    } catch (e) { /* 로그인 확인 실패 → 브라우저 번호로 */ }
    if (!vid) {
      try {
        vid = localStorage.getItem("visitorId");
        if (!vid) { vid = crypto.randomUUID(); localStorage.setItem("visitorId", vid); }
      } catch (e) { vid = null; } // 저장소가 막힌 브라우저는 세지 않고 숫자만 보여 줌
    }
    sb.rpc("record_visit", { vid: local || robot ? null : vid }).then(({ data, error }) => {
      const row = !error && data && data[0];
      if (!row) return;
      box.replaceChildren(
        document.createTextNode("Today "), el("b", "", Number(row.today).toLocaleString("ko-KR")),
        document.createTextNode(" / Total "), el("b", "", Number(row.total).toLocaleString("ko-KR"))
      );
      box.hidden = false;
    });
  })();

  /* ---------- 전적 검색 (학교 → 라인별 LOL 아이디, 학생 실명 제외) ---------- */
  // fow.lol 바로 열기 (복사·붙여넣기 없이)
  //  한 명: /?act=find&region=KR&field=이름#태그 → /find/kr/이름-태그 로 넘어감
  //  여러 명: /multi/kr#이름 #태그,이름 #태그 (fow 멀티서치가 # 뒤를 읽어 바로 검색)
  const fowId = id => { const s = String(id).trim(); const i = s.lastIndexOf("#"); return i > 0 ? s.slice(0, i).trim() + " #" + s.slice(i + 1).trim() : s; };
  const fowOne = id => "https://www.fow.lol/?act=find&region=KR&field=" + encodeURIComponent(fowId(id).replace(" #", "#"));
  // 멀티서치: fow.lol은 휴대폰에서 멀티서치를 지원하지 않아서 휴대폰·태블릿은 OP.GG로 연결
  const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  const fowMulti = ids => isMobile()
    ? "https://op.gg/ko/lol/multisearch/kr?summoners=" + encodeURIComponent(ids.map(id => fowId(id).replace(" #", "#")).join(","))
    : "https://www.fow.lol/multi/kr#" + encodeURIComponent(ids.map(fowId).join(","));
  const SLOT_DEFS = [
    [1, "탑", /^탑 LOL 아이디$/], [2, "정글", /^정글 LOL 아이디$/], [3, "미드", /^미드 LOL 아이디$/],
    [4, "원딜", /^원딜 LOL 아이디$/], [5, "서폿", /서폿 LOL 아이디$/],
    [6, "후보1", /후보1 LOL 아이디$/], [7, "후보2", /후보2 LOL 아이디$/], [8, "후보3", /후보3 LOL 아이디$/],
    [9, "후보4", /후보4 LOL 아이디$/], [10, "후보5", /후보5 LOL 아이디$/],
    [11, "후보6", /후보6 LOL 아이디$/], [12, "후보7", /후보7 LOL 아이디$/], [13, "후보8", /후보8 LOL 아이디$/], [14, "후보9", /후보9 LOL 아이디$/]
  ];
  async function loadLineups() {
    // 승인된 교사는 원본 명단에서, 그 외는 공개 함수(관리자가 공개를 켰을 때만 결과가 있음)에서
    if (ME.status === "approved") {
      const [{ data, error }, { data: flags }] = await Promise.all([
        sb.from("sheet_rows").select("sheet,row_no,data").in("sheet", ["roster_middle", "roster_high"]),
        sb.from("nickname_flags").select("sheet,school,id_key,level,reason")
      ]);
      if (error) return null;
      // 닉네임 점검: 변경 요청(학생에겐 가려짐) / 확인 필요(교사만) — 키는 DB nick_key와 같게(공백 뺀 소문자)
      const nickKey = x => String(x || "").replace(/\s+/g, "").toLowerCase();
      const flagOf = new Map((flags || []).map(f => [f.sheet + "|" + f.school + "|" + f.id_key, f]));
      const out = [];
      // 같은 학교의 신청 행마다 1팀, 2팀 … (아이디가 있는 행만)
      const hasId = r => Object.keys(r.data).some(k => /LOL 아이디/.test(k) && String(r.data[k] || "").trim());
      const teamNo = new Map(), teamCount = {};
      data.filter(r => r.data["학교 이름"] && hasId(r)).sort((a, b) => a.row_no - b.row_no).forEach(r => {
        const k = r.sheet + "|" + normSchool(r.data["학교 이름"]);
        teamCount[k] = (teamCount[k] || 0) + 1;
        teamNo.set(r, teamCount[k]);
      });
      data.forEach(r => {
        const school = r.data["학교 이름"];
        if (!school || !teamNo.has(r)) return;
        const tk = r.sheet + "|" + normSchool(school);
        SLOT_DEFS.forEach(([slot, line, re]) => {
          const key = Object.keys(r.data).find(k => re.test(k));
          const id = key && String(r.data[key] || "").trim();
          const nameKey = Object.keys(r.data).find(k => k.includes(line + "(학생 이름)"));
          const name = nameKey ? String(r.data[nameKey] || "").trim() : "";
          if (id) out.push({ division: r.sheet === "roster_middle" ? "중등부" : "고등부", school, region: r.data["학교 소재 지역"], team_no: teamNo.get(r), team_count: teamCount[tk], slot, line, student_name: name, lol_id: id,
            flag: flagOf.get(r.sheet + "|" + normSchool(school).replace(/\s+/g, "") + "|" + nickKey(id)) || null });
        });
      });
      return { rows: out, teacher: true };
    }
    const { data, error } = await sb.rpc("public_lineups");
    return error ? null : { rows: data || [], teacher: false };
  }
  async function renderRecord(preset) {
    const root = document.getElementById("recordRoot");
    if (!root) return;
    const res = preset || await loadLineups();
    root.replaceChildren();
    if (!res) { root.append(el("p", "note", "불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.")); return; }
    if (!res.rows.length) {
      const c = el("div", "pending");
      c.textContent = "전적 검색은 대진이 확정된 뒤(10/19 이후) 공개됩니다.";
      root.append(c);
      return;
    }
    if (res.teacher) root.append(el("p", "note", "교사용 화면: 학생용 공개 여부와 관계없이 보입니다."));
    // 이용 주의 (학교폭력·사이버폭력 예방): 이름이 보이는 곳 바로 위에 짧게, 자세한 내용은 개인정보 처리방침
    const guard = el("div", "rec-guard");
    guard.setAttribute("role", "note");
    guard.append(el("strong", "", "⚠️ 다른 학교 학생의 이름·아이디로 장난치지 마세요"),
      el("p", "", "여기 공개된 학교·이름·게임 아이디는 대회 준비에만 쓸 수 있습니다. 놀리기·비방·사칭·괴롭힘이나 캡처해서 퍼뜨리는 행동은 학교폭력(사이버폭력)이 될 수 있고, 개인정보 관련 법 위반으로 대회 실격·학교 통보까지 이어질 수 있습니다. 피해를 보거나 목격하면 지도교사나 디스코드 질문방에 바로 알려 주세요."));
    const more = el("a", "", "자세히 보기 (개인정보 처리방침)");
    more.href = "privacy.html"; more.target = "_blank"; more.rel = "noopener";
    guard.lastChild.append(" ", more);
    root.append(guard);
    // 팀장 확인 상태·수정 기간
    const { data: rs } = await sb.rpc("public_roster_status");
    const rsTeams = (rs && rs.teams) || [];
    const editOpen = !!(rs && rs.open);
    clearTimeout(root._rosterDeadlineTimer);
    if (editOpen && rs.until) {
      const remaining = new Date(rs.until).getTime() - Date.now();
      if (remaining >= 0 && remaining < 2147483000) root._rosterDeadlineTimer = setTimeout(() => renderRecord(), remaining + 20);
    }
    const untilText = rs && rs.until ? new Date(rs.until).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }) : "";
    const statusOf = t => rsTeams.find(x => x.division === t.division && normSchool(x.school) === normSchool(t.school));
    // 구글폼 내용 그대로라 틀린 곳이 있을 수 있음 → 팀장이 직접 확인·수정
    const ask = el("div", "pending rec-ask");
    if (editOpen) {
      ask.append(el("b", "", "팀장은 우리 팀 명단을 꼭 확인해 주세요. "),
        document.createTextNode("구글폼 신청서로 만든 목록이라 이름·라인·롤 아이디#태그가 틀린 곳이 있습니다. 학교 이름을 검색한 뒤 카드의 '우리 팀 명단 확인·수정'을 누르고 팀장 휴대폰 뒷자리 4자리를 넣으면 직접 고칠 수 있습니다. 고칠 게 없으면 '이상 없음 확인'을 눌러 주세요. 마감: " + untilText + ". 노란 글씨는 확인이 필요한 아이디입니다."));
    } else {
      ask.append(el("b", "", "명단 수정 기간이 끝났습니다. "), document.createTextNode("변경할 내용은 디스코드 팀장 대화방에 남겨 주세요."));
    }
    root.append(ask);
    // 학교별로 묶기
    const bySchool = new Map();
    res.rows.forEach(r => {
      const k = r.division + "|" + r.school + "|" + (r.team_no || 1);
      if (!bySchool.has(k)) bySchool.set(k, { division: r.division, school: r.school, region: r.region, teamNo: r.team_no || 1, teamCount: r.team_count || 1, ids: [] });
      bySchool.get(k).ids.push(r);
    });
    const teams = [...bySchool.values()].sort((a, b) => a.school.localeCompare(b.school, "ko") || a.teamNo - b.teamNo);
    teams.forEach(t => t.ids.sort((a, b) => a.slot - b.slot));

    const bar = el("div", "gbar");
    const s = el("input", "gsearch");
    s.type = "search"; s.placeholder = "학교 이름 검색 (예: 상록)"; s.setAttribute("aria-label", "학교 이름 검색");
    const sw = el("div", "div-switch");
    let div = "";
    [["", "전체"], ["중등부", "중등부"], ["고등부", "고등부"]].forEach(([v, l]) => {
      const b = el("button", "chip", l);
      b.type = "button";
      b.setAttribute("aria-pressed", v === div);
      b.addEventListener("click", () => { div = v; sw.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); });
      sw.append(b);
    });
    sw.style.margin = "0";
    const done = teams.filter(t => statusOf(t)).length;
    const doneEl = el("span", "rec-done", "팀장 확인 완료 " + done + " / " + teams.length + "팀");
    bar.append(s, sw, doneEl);
    // 교사 확인·취소 → 상태만 다시 받아 카드 다시 그림 (검색어·부문 유지)
    async function teacherConfirm(t, on) {
      if (!confirm(on ? t.school + " 명단을 교사 확인(문제없음)으로 표시할까요?\n학생 화면에도 '확인 완료'로 보이고, '명단 확인 현황'에 기록됩니다."
                      : t.school + "의 교사 확인을 취소할까요? '미확인'으로 돌아갑니다.")) return;
      const { data, error } = await sb.rpc("roster_teacher_confirm", { p_division: t.division, p_school: t.school, p_on: on });
      if (error || !data || data.status !== "saved") { toast("처리하지 못했습니다" + (error ? ": " + error.message : data && data.status === "not_found" ? " (중복 신청 확인 중인 학교)" : ""), true); return; }
      const { data: again } = await sb.rpc("public_roster_status");
      rsTeams.splice(0, rsTeams.length, ...((again && again.teams) || []));
      doneEl.textContent = "팀장 확인 완료 " + teams.filter(x => statusOf(x)).length + " / " + teams.length + "팀";
      toast(on ? "교사 확인으로 표시했습니다" : "교사 확인을 취소했습니다");
      draw();
    }
    const list = el("div", "rec-grid");
    root.append(bar, list);
    s.addEventListener("input", draw);

    // 롤 아이디 모양 점검 (이름 3~16자 + #태그 3~5자). 구글폼에 티어·메모를 같이 적은 경우 등을 찾아 줌
    function idIssue(id, teamIds) {
      const s = String(id).trim();
      if (/[⁦-⁩​-‏]/.test(s)) return "보이지 않는 문자가 섞여 있음 · 확인 필요";
      if (!s.includes("#")) return "태그(#) 없음 · 확인 필요";
      if ((s.match(/#/g) || []).length > 1) return "#가 두 개 · 확인 필요";
      const i = s.indexOf("#"), name = s.slice(0, i).trim(), tag = s.slice(i + 1).trim();
      // 태그 안 띄어쓰기는 허용 (라이엇 태그에 띄어쓰기가 들어간 경우가 있음, 예: #마 이). 쉼표·괄호·빗금이나 6자 이상이면 메모가 붙은 것
      if (/[,/()]/.test(tag) || Array.from(tag).length > 5) return "태그 뒤에 다른 글자(티어·메모 등)가 붙어 있음 · 확인 필요";
      if (Array.from(tag).length < 3) return "태그가 너무 짧음 (띄어쓰기 포함 3~5자) · 확인 필요";
      if (Array.from(name).length < 3 || Array.from(name).length > 16) return "아이디 길이(띄어쓰기 포함 3~16자) 확인 필요";
      const formatError = riotIdError(s);
      if (formatError) return formatError;
      const key = x => String(x).replace(/\s/g, "").toLowerCase();
      if (teamIds.filter(o => key(o.lol_id) === key(s)).length > 1) return "같은 팀의 다른 칸과 아이디가 같음 · 확인 필요";
      return "";
    }
    function idLink(r) {
      const a = el("a", "rec-id" + (idIssue(r.lol_id, []) ? " notag" : ""), r.lol_id);
      a.href = fowOne(r.lol_id);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.title = r.lol_id + " 전적 보기 (fow.lol 새 창)";
      return a;
    }
    function draw() {
      const q = s.value.trim();
      const shown = teams.filter(t => (!div || t.division === div) && (!q || t.school.includes(q)));
      list.replaceChildren();
      if (!shown.length) { list.append(el("p", "note", "검색 결과가 없습니다.")); return; }
      shown.forEach(t => {
        // 부문별 배경색 (디스코드와 같게: 중등부 보라 / 고등부 파랑)
        const card = el("article", "card rec-card " + (t.division === "고등부" ? "div-high" : "div-mid"));
        const head = el("div", "rec-head");
        head.append(el("h3", "", t.school + (t.teamCount > 1 ? " · " + t.teamNo + "팀" : "")), el("span", "rec-meta", t.division + (t.region ? " · " + t.region : "")));
        if (t.teamCount > 1) head.append(el("span", "dupe-badge", "중복 신청 · 확인 필요"));
        const st = statusOf(t);
        if (st) head.append(el("span", "ok-badge", (st.teacher ? "✔ 교사 확인 완료" : "✔ 팀장 " + (st.status === "수정함" ? "수정 완료" : "확인 완료")) + " (" + fmtTime(st.at) + ")"));
        const ul = el("ul", "rec-list");
        const hiddenNames = [];
        t.ids.forEach(r => {
          const li = el("li");
          li.append(el("span", "rec-line" + (r.slot > 5 ? " sub" : ""), r.line), el("span", "rec-name", r.student_name || "-"));
          if (r.id_hidden) {
            // 부적절한 닉네임: 바뀔 때까지 학생용에서 가림
            li.append(el("span", "rec-hidden", "닉네임 변경 중"));
            hiddenNames.push(r.student_name || r.line);
          } else {
            li.append(idLink(r));
            const issue = idIssue(r.lol_id, t.ids);
            if (issue) li.append(el("small", "rec-warn", issue));
            // 교사 화면 전용: 닉네임 점검 표시
            if (r.flag) li.append(el("small", r.flag.level === "change" ? "nick-need" : "nick-warn",
              (r.flag.level === "change" ? "변경 요청 · 학생 화면에서는 '닉네임 변경 중'으로 가려짐" : "확인 필요 · 교사에게만 보임") + (r.flag.reason ? " (" + r.flag.reason + ")" : "")));
          }
          ul.append(li);
        });
        // 멀티서치: 주전 5명 / 후보까지 모두 (누르면 fow.lol에서 바로 검색)
        const multiLink = (label, list, cls) => {
          const a = el("a", cls, label);
          a.href = fowMulti(list); a.target = "_blank"; a.rel = "noopener noreferrer";
          return a;
        };
        const shownIds = t.ids.filter(r => !r.id_hidden && !(r.flag && r.flag.level === "change"));
        const starters = shownIds.filter(r => r.slot <= 5).map(r => r.lol_id);
        const btns = el("div", "rec-btns");
        if (starters.length) btns.append(multiLink("주전 " + starters.length + "명 한 번에 (멀티서치)", starters, "btn small"));
        if (shownIds.length > starters.length) btns.append(multiLink("후보까지 " + shownIds.length + "명", shownIds.map(r => r.lol_id), "btn ghost small"));
        const nickNote = !hiddenNames.length ? null : (el("p", "rec-nick","규정 제6조에 따라 " + hiddenNames.join(", ") + " 선수의 닉네임 변경이 필요합니다. 닉네임을 바꾼 뒤 팀장이 '우리 팀 명단 확인·수정'에서 새 아이디를 저장해 주세요. 부적절한 닉네임 변경 요청에 응하지 않으면 주의 1회입니다."));
        if (editOpen && t.teamCount === 1) {
          const eb = el("button", "btn small edit-roster", "우리 팀 명단 확인·수정");
          eb.type = "button";
          eb.addEventListener("click", () => openRosterEdit(t, untilText));
          btns.append(eb);
        }
        // 교사(고치기·관리자): 학생 문의를 받고 바로 '문제없음(교사 확인)'으로 표시하거나, 교사 확인만 취소
        if (res.teacher && isEditor() && t.teamCount === 1 && (!st || st.teacher)) {
          const tb = el("button", "btn ghost small teacher-ok", st ? "교사 확인 취소" : "✔ 교사 확인 (문제없음)");
          tb.type = "button";
          tb.addEventListener("click", () => teacherConfirm(t, !st));
          btns.append(tb);
        }
        card.append(head, ul, ...(nickNote ? [nickNote] : []), btns, el("p", "note", "아이디를 누르면 그 선수의 전적(fow.lol)이, 멀티서치를 누르면 팀 전체 전적이 새 창에서 바로 열립니다. 휴대폰에서는 멀티서치가 OP.GG로 열립니다."));
        list.append(card);
      });
    }
    draw();
  }

  /* ---------- 팀장 명단 확인·수정 (전적 검색 카드 → 팀장 휴대폰 뒷자리로 본인 확인) ---------- */
  // 라이엇 아이디 규칙: 이름 3~16자 + #태그 3~5자(글자·숫자, 가운데 띄어쓰기 허용)
  function riotIdError(id) {
    const s = String(id || "").trim();
    if (!/^[^#]+#[^#]+$/.test(s)) return "'이름#태그' 모양으로 적어 주세요 (예: Hide on bush#KR1)";
    const name = s.split("#")[0].trim(), tag = s.split("#")[1].trim();
    if (Array.from(name).length < 3 || Array.from(name).length > 16) return "아이디 이름 부분은 띄어쓰기를 포함해 3~16자입니다";
    if (!/^[\p{L}\p{N}][\p{L}\p{N} ]{1,3}[\p{L}\p{N}]$/u.test(tag)) return "태그는 가운데 띄어쓰기를 포함해 3~5자입니다 (앞뒤 공백·기호 제외)";
    return "";
  }
  const SUB_LINES = ["", "탑", "정글", "미드", "원딜", "서폿", "전체"];
  function openRosterEdit(team, untilText) {
    const dlg = el("dialog", "rdlg");
    dlg.setAttribute("aria-label", team.school + " 명단 확인·수정");
    const close = () => { dlg.close(); dlg.remove(); };
    document.body.append(dlg);
    let last4 = "", mid4 = "";

    // 1단계: 본인 확인 (열 때마다)
    function stepVerify(needMid, msg) {
      dlg.replaceChildren();
      const f = el("form", "rdlg-verify");
      f.append(el("h3", "", team.school + " 명단 확인·수정"),
        el("p", "", "팀장 본인 확인을 위해 구글폼에 적은 팀장 휴대폰 번호 뒷자리 4자리를 넣어 주세요."));
      const mk = (label, val) => {
        const l = el("label", "rdlg-field", label);
        const i = el("input"); i.inputMode = "numeric"; i.maxLength = 4; i.autocomplete = "off"; i.pattern = "\\d{4}"; i.required = true; i.value = val;
        l.append(i); f.append(l); return i;
      };
      const i4 = mk("뒷자리 4자리", last4);
      const im = needMid ? mk("가운데 4자리 (다른 학교 팀장과 뒷자리가 같아서 한 번 더 확인합니다)", mid4) : null;
      if (msg) f.append(el("p", "rdlg-err", msg));
      const row = el("div", "rdlg-btns");
      const ok = el("button", "btn small", "확인"); ok.type = "submit";
      const cancel = el("button", "btn ghost small", "닫기"); cancel.type = "button"; cancel.addEventListener("click", close);
      row.append(ok, cancel); f.append(row, el("p", "note", "번호를 3번 틀리면 10분 동안 막힙니다. 번호가 기억나지 않거나 팀장이 바뀌었으면 디스코드 팀장 대화방에 문의해 주세요."));
      f.addEventListener("submit", async e => {
        e.preventDefault();
        last4 = i4.value.trim(); mid4 = im ? im.value.trim() : "";
        ok.disabled = true;
        const { data, error } = await sb.rpc("roster_open_edit", { p_division: team.division, p_school: team.school, p_last4: last4, p_mid4: mid4 || null });
        ok.disabled = false;
        if (error || !data) return stepVerify(needMid, "확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
        if (data.status === "ok") return stepForm(data);
        if (data.status === "need_mid") return stepVerify(true, needMid ? "가운데 4자리를 넣어 주세요." : "");
        if (data.status === "wrong") return stepVerify(needMid, "번호가 맞지 않습니다.");
        if (data.status === "locked") return stepVerify(needMid, "번호를 여러 번 틀려서 " + fmtTime(data.locked_until) + "까지 막혔습니다. 번호가 기억나지 않으면 팀장 대화방에 문의해 주세요.");
        if (data.status === "closed") return stepVerify(needMid, "명단 수정 기간이 끝났습니다. 변경할 내용은 팀장 대화방에 남겨 주세요.");
        return stepVerify(needMid, "이 학교는 최종 팀이 확정된 뒤에 이용할 수 있습니다.");
      });
      dlg.append(f);
      if (!dlg.open) dlg.showModal();
      (im && !mid4 ? im : i4).focus();
    }

    // 2단계: 명단 표 (선수 10칸: 이름·롤 아이디#태그·티어, 후보는 희망 라인)
    function stepForm(data) {
      dlg.replaceChildren();
      const players = data.players || [];
      const extras = data.extras || [];
      const tiers = ["", ...(data.tiers || [])];
      const f = el("form", "rdlg-form");
      f.append(el("h3", "", team.school + " 명단 확인·수정"),
        el("p", "note", "이름·롤 아이디#태그·티어를 확인해 주세요. 라인을 바꾸려면 해당 칸에 옮겨 적으면 됩니다. 아이디는 롤 클라이언트에서 '이름#태그' 전체를 복사해 넣는 것이 가장 정확합니다. 티어는 대진 편성에만 쓰이고 공개되지 않습니다. 수정 마감: " + untilText));
      const table = el("table", "rdlg-table");
      const hr = el("tr");
      ["라인", "학생 이름", "롤 아이디#태그", "티어"].forEach(h => hr.append(el("th", "", h)));
      const thead = el("thead"); thead.append(hr);
      const tb = el("tbody");
      const rows = players.map(p => {
        const tr = el("tr");
        const isSub = p.slot > 5;
        let name = p.name || "", subLine = "";
        const m = isSub && name.match(/^(.*?)\s*\((탑|정글|미드|원딜|서폿|전체)\)\s*$/);
        if (m) { name = m[1]; subLine = m[2]; }
        const lineTd = el("td", "rdlg-line");
        lineTd.append(el("b", "", p.line));
        let lineSel = null;
        if (isSub) {
          lineSel = el("select"); lineSel.setAttribute("aria-label", p.line + " 희망 라인");
          SUB_LINES.forEach(v => { const o = el("option", "", v || "라인"); o.value = v; lineSel.append(o); });
          lineSel.value = subLine; lineTd.append(lineSel);
        }
        const ni = el("input"); ni.value = name; ni.maxLength = 20; ni.placeholder = isSub ? "(없으면 비움)" : "이름"; ni.setAttribute("aria-label", p.line + " 학생 이름");
        const ii = el("input"); ii.value = p.id || ""; ii.maxLength = 40; ii.placeholder = "이름#태그"; ii.setAttribute("aria-label", p.line + " 롤 아이디#태그");
        const ts = el("select"); ts.setAttribute("aria-label", p.line + " 티어");
        tiers.concat(p.tier && !tiers.includes(p.tier) ? [p.tier] : []).forEach(v => { const o = el("option", "", v || "티어 선택"); o.value = v; ts.append(o); });
        ts.value = p.tier || "";
        const err = el("div", "rdlg-rowerr");
        const tdN = el("td"); tdN.append(ni);
        const tdI = el("td"); tdI.append(ii, err);
        const tdT = el("td"); tdT.append(ts);
        tr.append(lineTd, tdN, tdI, tdT);
        tb.append(tr);
        const r = { p, ni, ii, ts, lineSel, err, isSub };
        r.value = () => {
          const n = ni.value.trim(), ln = lineSel ? lineSel.value : "";
          return { slot: p.slot, name: n && ln ? n + " (" + ln + ")" : n, id: ii.value.trim(), tier: ts.value };
        };
        // 규정 제6조 닉네임 변경 요청이 걸린 아이디: 바뀌기 전까지 안내
        const nickKey = x => String(x || "").replace(/\s/g, "").toLowerCase();
        r.needChange = () => !!p.change && nickKey(ii.value) === nickKey(p.id);
        r.needCheck = () => !!p.check && nickKey(ii.value) === nickKey(p.id);
        r.check = () => {
          const v = r.value(), n = ni.value.trim();
          let msg = "";
          if (!n && !v.id) msg = isSub ? "" : "주전 칸은 비울 수 없습니다";
          else if (!n || !v.id) msg = "이름과 롤 아이디를 모두 적어 주세요";
          else msg = riotIdError(v.id);
          // 형식 오류와 닉네임 안내를 함께 보여 줌
          const lines = [];
          if (msg) lines.push(el("div", "", msg));
          if (r.needChange()) lines.push(el("div", "nick-need", "규정 제6조에 따라 이 닉네임은 변경이 필요합니다. 롤에서 닉네임을 바꾼 뒤 새 아이디를 적어 주세요. 변경 요청에 응하지 않으면 주의 1회입니다."));
          else if (r.needCheck()) lines.push(el("div", "nick-warn", "선생님 확인이 필요한 닉네임입니다. 비하·욕설·성적 표현으로 읽힐 수 있다면 바꿔 주세요."));
          err.replaceChildren(...lines);
          tr.classList.toggle("bad", !!msg || r.needChange());
          return !msg;
        };
        [ni, ii, ts, lineSel].filter(Boolean).forEach(x => x.addEventListener("input", refresh));
        return r;
      });
      table.append(thead, tb);
      const scroller = el("div", "gscroll"); scroller.append(table);
      const status = el("p", "rdlg-err");
      const btnRow = el("div", "rdlg-btns");
      const saveBtn = el("button", "btn small", "수정 저장"); saveBtn.type = "submit";
      const okBtn = el("button", "btn small ghost", "이상 없음 확인"); okBtn.type = "button";
      const cancel = el("button", "btn ghost small", "닫기"); cancel.type = "button"; cancel.addEventListener("click", close);
      btnRow.append(okBtn, saveBtn, cancel);
      const orig = JSON.stringify(rows.map(r => r.value()));
      function refresh() {
        const allOk = rows.map(r => r.check()).every(Boolean);
        const ids = rows.map(r => r.value().id.replace(/\s/g, "").toLowerCase()).filter(Boolean);
        const dup = ids.length !== new Set(ids).size;
        const changed = JSON.stringify(rows.map(r => r.value())) !== orig;
        const nickLeft = rows.some(r => r.needChange());
        const extrasLeft = extras.length && !changed;
        status.textContent = dup ? "같은 롤 아이디가 두 번 들어갔습니다." : !allOk ? "빨간 칸을 고친 뒤 저장해 주세요." : changed ? "바뀐 내용이 있습니다. '수정 저장'을 눌러 주세요." + (nickLeft ? " (닉네임 변경이 필요한 선수가 아직 있습니다)" : "") : nickLeft ? "닉네임 변경이 필요한 선수가 있어서 '이상 없음 확인'을 할 수 없습니다." : extrasLeft ? "칸에 들어가지 못한 선수를 정리한 뒤 저장해 주세요." : "";
        saveBtn.disabled = !allOk || dup || !changed;
        okBtn.disabled = !allOk || dup || changed || nickLeft || !!extrasLeft;
        okBtn.title = changed ? "고친 내용이 있으면 '수정 저장'을 눌러 주세요" : !allOk ? "빨간 칸을 먼저 고쳐 주세요" : nickLeft ? "닉네임 변경이 필요한 선수가 있습니다" : "";
        return allOk && !dup;
      }
      async function submit(confirmOnly) {
        if (!refresh()) return;
        saveBtn.disabled = okBtn.disabled = true;
        const { data: res, error } = await sb.rpc("roster_save", {
          p_division: team.division, p_school: team.school, p_last4: last4, p_mid4: mid4 || null,
          p_players: rows.map(r => r.value()), p_confirm_only: confirmOnly
        });
        if (error || !res) { status.textContent = "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요."; refresh(); return; }
        if (res.status === "saved") {
          toast(confirmOnly ? "확인 완료로 표시했습니다. 고맙습니다!" : "명단을 저장했습니다. 전적 검색에 바로 반영됩니다.");
          close(); renderRecord(); return;
        }
        if (res.status === "invalid") { status.textContent = res.message; refresh(); return; }
        if (res.status === "closed") { status.textContent = "명단 수정 기간이 끝났습니다."; return; }
        stepVerify(false, "다시 본인 확인을 해 주세요.");
      }
      okBtn.addEventListener("click", () => submit(true));
      f.addEventListener("submit", e => { e.preventDefault(); submit(false); });
      if (data.confirmed) f.append(el("p", "note", "이전 확인: " + (data.confirmed.status === "수정함" ? "수정 완료" : "확인 완료") + " · " + fmtTime(data.confirmed.at)));
      // 구글폼에서 10칸 밖(후보6 이상)으로 들어간 선수: 칸으로 옮겨 적고 저장하면 정리됨
      if (extras.length) {
        const ex = el("div", "pending rdlg-extras");
        ex.append(el("b", "", "칸에 들어가지 못한 선수 " + extras.length + "명 (구글폼 기준)"),
          el("p", "", "한 팀은 주전 5명 + 후보 최대 5명(총 10명)입니다. 아래 선수를 위 칸에 옮겨 적은 뒤 '수정 저장'을 누르면 이 목록은 정리됩니다."));
        const ul = el("ul");
        extras.forEach(x => ul.append(el("li", "", (x.name || "(이름 없음)") + " - " + x.id)));
        ex.append(ul);
        f.append(ex);
      }
      f.append(scroller, status, btnRow);
      dlg.append(f);
      refresh();
    }

    dlg.addEventListener("cancel", e => { e.preventDefault(); close(); });
    stepVerify(false, "");
  }

  // 로컬 미리보기에서만 화면 점검용으로 노출
  if (location.hostname === "localhost") window.__renderRecord = renderRecord;

  /* ---------- 로그인 상태 ---------- */
  const ME = { status: null, role: null, name: null, email: null };
  const teacherAI = window.createTeacherAI ? window.createTeacherAI(sb) : null;
  const isEditor = () => ME.role === "editor" || ME.role === "owner";
  const isOwner = () => ME.role === "owner";
  const canPreviewPayment = () => ME.status === "approved" && !!ME.paymentAllowed;
  const ROLE_LABEL = { viewer: "보기", editor: "보기·고치기", owner: "관리자", referee: "심판" };

  function renderAcct() {
    acct.replaceChildren();
    if (!ME.email) {
      const b = el("button", "btn small", "교사용");
      b.type = "button";
      b.addEventListener("click", showLoginNotice);
      acct.append(b);
      return;
    }
    const who = el("span", "who", (ME.name || ME.email) + (ME.role && ME.status === "approved" ? " · " + (ME.external ? "외부인 · " : "") + ROLE_LABEL[ME.role] : ""));
    const out = el("button", "btn ghost small", "로그아웃");
    out.type = "button";
    out.addEventListener("click", async () => { await sb.auth.signOut(); location.hash = ""; location.reload(); });
    acct.append(who, out);
  }

  // 로그인 전에 저장 항목과 개인정보 처리방침을 먼저 안내
  function showLoginNotice() {
    const d = document.getElementById("loginNotice");
    if (!d || typeof d.showModal !== "function") { login(); return; }
    d.showModal();
  }
  (function wireLoginNotice() {
    const d = document.getElementById("loginNotice");
    if (!d) return;
    document.getElementById("loginCancel").addEventListener("click", () => d.close());
    document.getElementById("loginGo").addEventListener("click", () => { d.close(); login(); });
  })();
  function login() {
    try { sessionStorage.setItem("openTeacher", "1"); } catch (e) {}
    sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: "select_account" } }
    });
  }
  function wantsTeacher() {
    let flag = false;
    try { flag = sessionStorage.getItem("openTeacher") === "1"; sessionStorage.removeItem("openTeacher"); } catch (e) {}
    return flag || location.hash === "#teacher" || location.hash.startsWith("#t-");
  }

  async function refresh() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { Object.assign(ME, { id: null, status: null, role: null, name: null, email: null, staffId: null, paymentAllowed: false }); teacherAI?.setIdentity(ME); renderAcct(); removeTeacher(); renderRecord(); return; }
    ME.email = session.user.email;
    ME.id = session.user.id;
    const { data, error } = await sb.rpc("touch_login");
    const row = !error && data && data[0];
    ME.status = row ? row.status : "pending";
    ME.role = row ? row.role : null;
    ME.name = row && row.staff_name ? row.staff_name : (session.user.user_metadata.full_name || session.user.email);
    ME.external = !!(row && row.external);
    ME.staffId = row && row.staff_id ? Number(row.staff_id) : null; // 심판 일정에서 본인 칸 판별
    ME.paymentAllowed = false;
    if (ME.status === "approved") { const { data: payment } = await sb.rpc("payment_state"); ME.paymentAllowed = !!payment?.allowed; }
    teacherAI?.setIdentity(ME);
    renderAcct();
    renderRecord();
    if (ME.status === "approved") buildTeacher();
    else showGate(ME.status);
  }

  /* ---------- 승인 대기 / 차단 화면 ---------- */
  function showGate(status) {
    removeTeacher();
    let sec = document.getElementById("gate");
    if (!sec) {
      sec = el("section", "gate");
      sec.id = "gate";
      sec.setAttribute("role", "tabpanel");
      document.querySelector("main").append(sec);
      addTab("gate", "교사용", true);
    }
    sec.replaceChildren();
    const card = el("div", "card gate-card");
    if (status === "blocked") {
      card.append(el("h2", "", "접근이 차단되었습니다"), el("p", "", "이 계정은 교사용 화면을 이용할 수 없습니다. 사이트 관리자에게 문의하세요."));
    } else {
      card.append(el("div", "gate-icon", "⏳"), el("h2", "", "승인 대기중"),
        el("p", "", "로그인되었습니다. 사이트 관리자(심승보 선생님)가 지원단 명단과 확인한 뒤 승인하면 교사용 화면이 열립니다."),
        el("p", "note", "로그인 계정: " + ME.email));
      const again = el("button", "btn ghost", "승인 여부 다시 확인");
      again.type = "button";
      again.addEventListener("click", refresh);
      card.append(again);
    }
    sec.append(card);
    window.showTab("gate");
  }

  /* ---------- 탭 추가·제거 ---------- */
  const nav = document.querySelector('nav[role="tablist"]');
  function addTab(id, label, teacher) {
    if (document.getElementById("tab-" + id)) return;
    // 교사용 탭은 줄을 바꿔 두 번째 줄에 모아 보여 준다 (탭이 많아 가로로 숨지 않게)
    if (teacher && !nav.querySelector(".tab-break")) {
      const br = el("span", "tab-break", "교사용");
      br.setAttribute("aria-hidden", "true");
      nav.append(br);
      nav.classList.add("has-teacher");
    }
    const b = el("button", "tab" + (teacher ? " tab-teacher" : ""), label);
    b.type = "button";
    b.id = "tab-" + id;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", id);
    b.setAttribute("aria-selected", "false");
    b.tabIndex = -1;
    nav.append(b);
  }
  function removeTeacher() {
    clearInterval(teacherTabTimer); teacherTabTimer = null; built = false; teacherViews = [];
    document.querySelectorAll(".tab-teacher, .tab-break").forEach(t => t.remove());
    nav.classList.remove("has-teacher");
    document.body.classList.remove("teacher-mode");
    document.querySelectorAll("section.teacher, #gate").forEach(s => s.remove());
    document.getElementById("tab-gate")?.remove();
  }
  function addSection(id, title, lead) {
    const sec = el("section", "teacher");
    sec.id = id;
    sec.setAttribute("role", "tabpanel");
    sec.setAttribute("aria-labelledby", "tab-" + id);
    sec.hidden = true;
    sec.append(el("h2", "", title));
    if (lead) sec.append(el("p", "lead", lead));
    const body = el("div", "tbody");
    sec.append(body);
    document.querySelector("main").append(sec);
    return body;
  }

  /* ---------- 표 그리기 (보기/고치기 공용) ---------- */
  // columns[i]: { key, label, get, type?, options?, readonly?, cls? (열 구분용), cellClass?(row) }
  // filters: [{ label, values: [...], get(row) }] → 검색창 옆 드롭다운
  // 칩에 쓰는 짧은 학교 이름: 원곡고등학교 → 원곡고, 갈월중학교 → 갈월중
  const shortSchool = s => String(s || "").trim().replace(/고등학교$/, "고").replace(/중학교$/, "중");
  // 맨 위 '할 일' 안내판: 그룹마다 학교 이름 칩. 학교 칩을 누르면 표 검색에 그 학교를 넣어 바로 찾음
  function todoBoard(title, groups, doneText, searchIn) {
    const card = el("div", "todo-board");
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    card.append(el("h3", "", title + (total ? " · " + total + "개 학교" : "")));
    if (!total) { card.classList.add("ok"); card.append(el("p", "todo-done", "✔ " + doneText)); return card; }
    groups.filter(g => g.items.length).forEach(g => {
      const row = el("div", "todo-row");
      row.append(el("span", "todo-label " + (g.cls || ""), g.label + " " + g.items.length));
      g.items.forEach(it => {
        const c = el("button", "todo-chip " + (g.cls || ""), it.text);
        c.type = "button";
        c.title = "표에서 이 학교 찾기";
        c.addEventListener("click", () => {
          const s = searchIn && searchIn.querySelector(".gsearch");
          if (!s) return;
          s.value = it.school; s.dispatchEvent(new Event("input"));
          s.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        row.append(c);
      });
      card.append(row);
    });
    return card;
  }
  // 다른 선생님·팀장이 바꾼 내용을 30초마다 확인해 다시 그림 (탭을 떠났거나 칸을 고치는 중이면 건너뜀)
  function autoRefresh(box, signature, reload, ms = 30000) {
    const id = (box._refreshId || 0) + 1;
    box._refreshId = id;
    let last = null;
    const sync = () => signature().then(s => { last = s; }).catch(() => {});
    sync();
    box._resync = sync; // 내가 저장한 뒤에 부르면 내 수정으로는 다시 그리지 않음 (필터·검색 유지)
    const t = setInterval(async () => {
      if (!box.isConnected || box._refreshId !== id) { clearInterval(t); return; }
      if (document.hidden) return;
      const a = document.activeElement;
      if (a && box.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return;
      try {
        const s = await signature();
        if (last !== null && s !== last) { clearInterval(t); reload(); }
        last = s;
      } catch (e) { /* 다음 번에 다시 */ }
    }, ms);
  }
  // 표의 바뀜 표시: 줄 수 + 가장 최근 수정 시각
  async function tableSig(table, filter) {
    let q = sb.from(table).select("updated_at", { count: "exact" });
    q = filter(q);
    const { data, count, error } = await q.order("updated_at", { ascending: false }).limit(1);
    if (error) throw error;
    return count + "|" + (data[0] ? data[0].updated_at : "");
  }

  function grid(box, { columns, rows, onSave, onDelete, onAdd, exportName, filterable = true, filters = [], canSave }) {
    box.replaceChildren();
    // canSave: 편집자가 아니어도 칸을 고칠 수 있는 표 (예: 심판의 경기 결과 입력). 추가·삭제·내려받기는 그대로 편집자만
    const saveOk = canSave ?? isEditor();
    const bar = el("div", "gbar");
    let q = "";
    const picked = filters.map(f => f.initial || "");
    if (filterable) {
      const s = el("input", "gsearch");
      s.type = "search";
      s.placeholder = "검색 (학교, 이름 등)";
      s.setAttribute("aria-label", "표 검색");
      s.addEventListener("input", () => { q = s.value.trim(); draw(); });
      bar.append(s);
    }
    filters.forEach((f, i) => {
      if (f.hidden) return; // 고를 값이 없는 필터(예: 확인 필요 0건)는 안 보임
      const sel = el("select", "gfilter");
      sel.setAttribute("aria-label", f.label + " 필터");
      const all = el("option", "", f.label + ": 전체"); all.value = ""; sel.append(all);
      f.values.forEach(v => { const o = el("option", "", v); o.value = v; sel.append(o); });
      sel.value = picked[i];
      sel.addEventListener("change", () => { picked[i] = sel.value; if (f.onPick) f.onPick(sel.value); draw(); });
      bar.append(sel);
    });
    bar.append(el("span", "gcount"));
    if (isEditor() && onAdd) {
      const a = el("button", "btn small", "+ 행 추가");
      a.type = "button";
      a.addEventListener("click", onAdd);
      bar.append(a);
    }
    if (isEditor() && exportName) {
      const x = el("button", "btn ghost small", "엑셀로 내려받기");
      x.type = "button";
      x.addEventListener("click", () => exportXlsx(exportName, columns, rows));
      bar.append(x);
    }
    const scroller = el("div", "gscroll");
    const table = el("table", "dtable");
    scroller.append(table);
    box.append(bar, scroller);

    function draw() {
      let shown = q ? rows.filter(r => columns.some(c => String(c.get(r) ?? "").includes(q))) : rows;
      filters.forEach((f, i) => { if (picked[i]) shown = shown.filter(r => f.get(r) === picked[i]); });
      bar.querySelector(".gcount").textContent = shown.length + "행";
      const thead = el("thead");
      const hr = el("tr");
      columns.forEach(c => hr.append(el("th", c.cls || "", c.label)));
      if (isEditor() && onDelete) hr.append(el("th", "", ""));
      thead.append(hr);
      const tb = el("tbody");
      shown.forEach(r => {
        const tr = el("tr");
        columns.forEach(c => {
          const td = el("td", [c.cls, c.cellClass && c.cellClass(r)].filter(Boolean).join(" "));
          const v = c.get(r);
          const ro = typeof c.readonly === "function" ? c.readonly(r) : c.readonly;
          if (c.cell) {
            c.cell(td, r);
          } else if (saveOk && onSave && !ro) {
            if (c.type === "bool") {
              const cb = el("input");
              cb.type = "checkbox";
              cb.checked = !!v;
              cb.setAttribute("aria-label", c.label);
              cb.addEventListener("change", () => onSave(r, c, cb.checked));
              td.append(cb);
            } else if (c.options) {
              const s = el("select");
              s.setAttribute("aria-label", c.label);
              c.options.forEach(o => { const op = el("option", "", o); op.value = o; s.append(op); });
              s.value = v ?? c.options[0];
              s.addEventListener("change", () => onSave(r, c, s.value));
              td.append(s);
            } else {
              const i = el("input", "cell");
              i.value = v ?? "";
              // 칸 너비를 내용 길이에 맞춤 (한글은 두 칸 폭)
              const w = [...String(i.value)].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 2 : 1), 0);
              i.size = Math.max(4, Math.min(40, w + 1));
              if (w > 16) i.title = i.value; // 좁은 칸에서 잘린 긴 값은 마우스를 올리면 전체
              i.setAttribute("aria-label", c.label);
              if (c.list) { const id = c.list(r); if (id) i.setAttribute("list", id); } // 고를 수 있는 값 목록 (예: 심판)
              if (c.type === "int") i.inputMode = "numeric";
              i.addEventListener("change", () => onSave(r, c, c.type === "int" ? (i.value === "" ? null : Number(i.value)) : i.value));
              td.append(i);
            }
          } else {
            td.textContent = c.type === "bool" ? (v ? "O" : "") : (v ?? "");
          }
          tr.append(td);
        });
        if (isEditor() && onDelete) {
          const td = el("td");
          const d = el("button", "del", "삭제");
          d.type = "button";
          d.addEventListener("click", async () => {
            // 어떤 행인지 보여 주고, 지우는 동안 다른 삭제 버튼을 잠가 행이 밀려 올라올 때의 오클릭을 막는다
            const vals = columns.filter(c => c.key !== "_dupe").map(c => String(c.get(r) ?? "").trim()).filter(Boolean);
            const label = vals.length ? vals.slice(0, 2).join(" · ") : "빈 행";
            if (!confirm("'" + label + "' 행을 삭제할까요?" + (vals.length ? "\n(내용이 있는 칸 " + vals.length + "개)" : ""))) return;
            table.querySelectorAll(".del").forEach(b => { b.disabled = true; });
            tr.classList.add("deleting");
            await onDelete(r);
          });
          td.append(d);
          tr.append(td);
        }
        tb.append(tr);
      });
      table.replaceChildren(thead, tb);
    }
    draw();
  }

  async function exportXlsx(name, columns, rows) {
    if (!window.XLSX) {
      await new Promise((ok, bad) => { const s = document.createElement("script"); s.src = XLSX_SRC; s.onload = ok; s.onerror = bad; document.head.append(s); })
        .catch(() => toast("엑셀 도구를 불러오지 못했습니다", true));
    }
    if (!window.XLSX) return;
    const data = rows.map(r => Object.fromEntries(columns.map(c => [c.label, c.get(r) ?? ""])));
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(data), name.slice(0, 30));
    window.XLSX.writeFile(wb, name + ".xlsx");
  }

  async function save(promise, okMsg) {
    const { error } = await promise;
    if (error) { toast("저장 실패: " + error.message, true); return false; }
    toast(okMsg || "저장했습니다");
    return true;
  }

  /* ---------- 교사 전용 탭 ---------- */
  let built = false;
  let teacherTabTimer = null, teacherViews = [];
  let teacherTabGeneration = 0;
  let teacherTabState = { can_manage: false, hidden: [] };
  const TEACHER_TAB_OPTIONS = [["t-staff","지원단 명단"],["t-roster","아이디 명단"],["t-captains","팀장 연락처"],["t-advisors","지도교사 연락처"],["t-tier","팀별 티어 현황"],["t-matches","대진·경기 결과"],["t-referee","심판 일정"],["t-warn","경고 조치"],["t-rcheck","명단 확인 현황"],["t-coaching","젠지 코칭 관리"],["t-inbox","신청 접수"],["t-payment","수당 지급"]];
  const teacherTabVisible = id => id === "t-tab-settings" ? teacherTabState.can_manage : teacherTabState.can_manage || !teacherTabState.hidden.includes(id);
  function applyTeacherTabVisibility() {
    let activeRemoved = false;
    teacherViews.forEach(([id,label,lead,loader]) => {
      const button = document.getElementById("tab-"+id), section = document.getElementById(id);
      if (!teacherTabVisible(id)) {
        if (button?.getAttribute("aria-selected") === "true") activeRemoved = true;
        button?.remove(); section?.remove(); return;
      }
      if (!button) {
        addTab(id,label,true); const body = addSection(id,label,lead);
        document.getElementById("tab-"+id).addEventListener("click", () => {
          if (!teacherTabVisible(id) || body.dataset.loaded) return;
          body.dataset.loaded="1"; loader(body);
        });
      }
      const tab = document.getElementById("tab-"+id);
      tab.textContent = label + (teacherTabState.can_manage && teacherTabState.hidden.includes(id) ? " · 숨김" : "");
      nav.append(tab);
    });
    if (activeRemoved) {
      const next = teacherViews.find(([id]) => teacherTabVisible(id));
      if (next) document.getElementById("tab-"+next[0])?.click();
      window.showTab(next ? next[0] : "home");
      toast("관리자가 이 탭을 숨겼습니다.");
    }
  }
  async function refreshTeacherTabVisibility() {
    if (ME.status !== "approved") return;
    const user = ME.id;
    const generation = teacherTabGeneration;
    const {data,error} = await sb.rpc("teacher_tab_visibility");
    if (error || !data || ME.id !== user || ME.status !== "approved" || generation !== teacherTabGeneration) return;
    teacherTabState = data; applyTeacherTabVisibility();
    const controls = document.querySelector("#t-tab-settings .tbody");
    if (controls?.dataset.loaded) loadTeacherTabSettings(controls);
  }
  function loadTeacherTabSettings(box) {
    box.replaceChildren(); if (!teacherTabState.can_manage) return;
    box.append(el("p","note","체크한 탭만 다른 교사에게 표시됩니다. 관리자는 숨긴 탭도 계속 볼 수 있습니다. 열어 둔 교사 화면에는 최대 30초 안에 반영됩니다. 기존 자료와 데이터 접근 권한은 변경하지 않습니다."));
    const list = el("div","teacher-tab-settings");
    TEACHER_TAB_OPTIONS.forEach(([id,title]) => {
      const label=el("label","pub-toggle"), check=el("input"); check.type="checkbox"; check.checked=!teacherTabState.hidden.includes(id);
      label.append(check,el("span","",title));
      check.addEventListener("change",async()=>{
        teacherTabGeneration++;
        check.disabled=true;
        const {data,error}=await sb.rpc("set_teacher_tab_visibility",{p_tab:id,p_hidden:!check.checked});
        if(error || !data) {check.checked=!check.checked;toast("탭 표시 설정을 저장하지 못했습니다.",true);}
        else {teacherTabState=data;applyTeacherTabVisibility();toast(check.checked?"다른 교사에게 표시합니다.":"다른 교사에게 숨겼습니다.");}
        check.disabled=false;
      }); list.append(label);
    }); box.append(list);
  }
  document.addEventListener("visibilitychange",()=>{if(!document.hidden && built)refreshTeacherTabVisibility();});
  const SHEETS = {
    roster: { title: "팀별 아이디 명단", subs: [["roster_all", "전체"], ["roster_middle", "중등부"], ["roster_high", "고등부"]] },
    captains: { title: "팀장 연락처", subs: [["captains", "전체"]] },
    advisors: { title: "지도교사 연락처", subs: [["advisors", "전체"]] },
    tier: { title: "팀별 티어 현황", subs: [["tier_middle", "중등부"], ["tier_high", "고등부"]] }
  };

  async function buildTeacher() {
    document.getElementById("gate")?.remove();
    document.getElementById("tab-gate")?.remove();
    document.body.classList.add("teacher-mode");
    if (built) return;
    built = true;
    const buildingUser = ME.id;
    const {data:tabSetting,error:tabError}=await sb.rpc("teacher_tab_visibility");
    if(ME.id !== buildingUser || ME.status !== "approved") return;
    if(tabError || !tabSetting) {built=false;toast("교사용 탭 설정을 불러오지 못했습니다. 잠시 후 다시 로그인해 주세요.",true);return;}
    teacherTabState=tabSetting;
    const views = [
      // 지원단 명단은 심판 권한(젠지 코치)에 안 보임 (2026-10-18 사용자 요청)
      ...(ME.role === "referee" ? [] : [["t-staff", "지원단 명단", "지원단 선생님 명단과 업무 분장입니다.", loadStaff]]),
      ["t-roster", SHEETS.roster.title, "학생 실명과 LOL 아이디가 들어 있습니다. 화면 밖으로 옮기지 마세요.", b => loadSheet(b, SHEETS.roster)],
      // 연락처 표는 심판 권한에 안 보임 (DB에서도 막음)
      ...(ME.role === "referee" ? [] : [["t-captains", SHEETS.captains.title, "", b => loadSheet(b, SHEETS.captains)],
        ["t-advisors", SHEETS.advisors.title, "", b => loadSheet(b, SHEETS.advisors)]]),
      ["t-tier", SHEETS.tier.title, "선수 티어를 고르면 주전·후보 상위 5명 평균과 순위가 자동으로 계산됩니다. 점수가 낮을수록 높은 티어입니다.", loadTier],
      ["t-matches", "대진·경기 결과", "여기 입력한 학교 이름·점수는 학생용 대진표에도 표시됩니다. 심판·비고는 교사용에만 보입니다.", loadMatches],
      ["t-referee", "심판 일정", "경기 회차(날짜·시간)마다 총괄·기록원·심판으로 참여 가능한 역할을 체크합니다.", loadReferee],
      ["t-warn", "경고 조치", "팀별 주의·경고 기록입니다. 최종 규정(주의 2회 = 경고 1회, 누적 경고 1회 진영 선택 제한 · 2회 밴카드 전체 제한 + 진영 선택 제한 · 3회 실격패)으로 조치를 보여 줍니다. 지원단 선생님은 누구나 기록할 수 있고, 삭제는 기록한 본인과 편집자만 가능합니다. 학생용 '경고 현황' 탭에는 자세한 내용·기록자 없이 공개됩니다.", loadWarnings]
    ];
    // 코칭 일정은 공개 '젠지 코칭' 탭에서 모두 보이고, 여기서는 고치기 권한자가 관리 (신청자·메모 포함)
    if (isEditor()) views.push(["t-rcheck", "명단 확인 현황", "팀장이 전적 검색에서 직접 확인·수정한 현황입니다. 저장하면 아이디 명단·티어 현황에 바로 반영되고, 잘못된 수정은 여기서 되돌릴 수 있습니다.", loadRosterCheck]);
    // 젠지 코치(심판 권한)도 보기 가능 (2026-10-18 사용자 요청), 고치기는 편집자만
    if (isEditor() || ME.role === "referee") views.push(["t-coaching", "젠지 코칭 관리", "디스코드 [GGA-코칭-지원] 채널로 들어온 코칭 신청 기록입니다. 학교당 최대 3회, 같은 타임은 최대 6팀(코치 6명)입니다. 담당 코치·상태를 바꾸면 공개 '젠지 코칭' 탭에도 바로 반영됩니다(신청자·메모는 공개 안 됨)." + (isEditor() ? "" : " 심판 권한은 보기만 할 수 있습니다(배정·상태는 GGA 시트에서 10분마다 자동 반영)."), loadCoaching]);
    if (isEditor()) views.push(["t-inbox", "신청 접수", "구글폼으로 들어온 신청입니다. 새 학교는 자동으로 추가되고, 같은 팀장의 재신청은 최근 내용으로 덮어씁니다. '확인 필요'는 직접 적용하거나 무시하세요.", loadInbox]);
    // 2026-10-21: 예상 조 편성은 관리자 포함 모두에게 숨김. 미리보기 함수와 기존 데이터는 보존.
    if (isOwner()) views.push(["t-admin", "로그인 승인", "구글로 로그인한 계정을 지원단 이름과 짝지어 승인합니다.", loadAdmin]);
    if (canPreviewPayment()) views.push(["t-payment", "수당 지급", "심판가능 체크 교사의 수당 서류를 비공개로 제출합니다.", loadPaymentPreview]);
    if(teacherTabState.can_manage) views.push(["t-tab-settings","탭 표시 관리","다른 교사에게 보이는 교사용 탭을 설정합니다.",loadTeacherTabSettings]);
    teacherViews=views; applyTeacherTabVisibility();
    clearInterval(teacherTabTimer);
    teacherTabTimer=setInterval(()=>{if(!document.hidden)refreshTeacherTabVisibility();},30000);
    if (wantsTeacher()) {
      const requested = location.hash.startsWith("#t-") ? location.hash.slice(1) : "t-staff";
      const id = views.some(([v])=>v===requested && teacherTabVisible(v)) ? requested : (views.find(([v])=>teacherTabVisible(v))?.[0] || "home");
      document.getElementById("tab-" + id)?.click();
      window.showTab(id);
    }
  }

  async function paymentFileFormat(file, kind) {
    const invalid = () => new Error((kind === "identity" ? "신분증은 PDF·JPG·PNG" : "통장은 PDF") + " 파일로, 파일당 10MB 이하인지 확인해 주세요.");
    if (file.size < 5 || file.size > 10485760) throw invalid();
    const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    let format = null;
    if (/\.pdf$/i.test(file.name) && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") format = { ext: "pdf", mime: "application/pdf" };
    if (kind === "identity" && /\.jpe?g$/i.test(file.name) && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) format = { ext: "jpg", mime: "image/jpeg" };
    if (kind === "identity" && /\.png$/i.test(file.name) && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) format = { ext: "png", mime: "image/png" };
    if (!format || (file.type && file.type !== format.mime)) throw invalid();
    return format;
  }

  async function loadPaymentPreview(box) {
    box.replaceChildren();
    if (!canPreviewPayment()) return;
    const { data: state, error: stateError } = await sb.rpc("payment_state");
    if (stateError || !state || !state.allowed) { box.append(el("p", "note", "서류 제출 권한을 확인하지 못했습니다. 다시 로그인해 주세요.")); return; }
    const current = state.submission;
    const download = (path, title) => {
      const b = el("button", "btn ghost small", title + " 내려받기"); b.type = "button";
      b.addEventListener("click", async () => {
        b.disabled = true;
        try {
          const { data, error } = await sb.storage.from("payment-documents").download(path);
          if (error || !data) throw new Error();
          const url = URL.createObjectURL(data), a = el("a"); a.href = url; a.download = title + "." + (path.match(/\.(pdf|jpg|jpeg|png)$/i)?.[1].toLowerCase() || "pdf");
          document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch { toast("파일을 내려받지 못했습니다. 로그인과 접근 권한을 확인해 주세요.", true); }
        finally { b.disabled = false; }
      }); return b;
    };
    if (state.submitter) {
    const submit = el("section", "card payment-preview");
    submit.append(el("h3", "", "본인 제출"), el("p", "note", "신분증은 PDF·JPG·PNG, 통장은 PDF로 제출해 주세요. 파일당 최대 10MB이며, 불필요한 개인정보는 가려 주세요."));
    const form = el("form"), fields = el("fieldset", "payment-fields"), inputs = {};
    fields.append(el("legend", "", "제출 항목"));
    [["identity", "신분증 사본", "file"], ["bank", "통장 사본", "file"], ["email", "전자계약서 수신용 이메일 주소", "email"], ["phone", "핸드폰 번호", "tel"]].forEach(([key, title, type]) => {
      const label = el("label", "payment-field"), input = el("input");
      input.type = type; input.autocomplete = "off"; input.required = type !== "file" || !current;
      if (type === "file") input.accept = key === "identity" ? ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" : ".pdf,application/pdf";
      else { input.value = current ? current[key] : ""; input.placeholder = "직접 입력해 주세요"; input.maxLength = key === "email" ? 254 : 20; }
      label.append(el("span", "", title + (type === "file" ? (key === "identity" ? " (PDF·JPG·PNG)" : " (PDF)") : "")), input);
      if (type === "file" && current) label.append(el("small", "note", "제출됨 · 새 파일을 선택하지 않으면 기존 파일을 유지합니다."), download(current[key + "_path"], title));
      inputs[key] = input; fields.append(label);
    });
    const button = el("button", "btn small", current ? "수정 제출" : "서류 제출"); button.type = "submit";
    const status = el("p", "note", current ? "제출 완료 · " + fmtTime(current.submitted_at) + (current.checked_at ? " · 담당자 확인 완료" : " · 담당자 확인 대기") : "아직 제출하지 않았습니다."); status.setAttribute("role", "status");
    form.append(fields, el("p", "note", "이메일·휴대폰은 수당 지급과 전자계약을 위해 직접 입력합니다. 수정 제출하면 담당자 확인은 다시 대기 상태가 됩니다."), button, status);
    form.addEventListener("submit", async e => {
      e.preventDefault(); if (button.disabled || !form.reportValidity()) return;
      fields.disabled = button.disabled = true; status.textContent = "서류를 저장하고 있습니다…";
      try {
        if (!/^01[016789][0-9]{7,8}$/.test(inputs.phone.value.replace(/[ -]/g, ""))) throw new Error("휴대폰 번호를 확인해 주세요.");
        // Validate both files before transmitting either. Never retain original filenames.
        const formats = {};
        for (const key of ["identity", "bank"]) {
          const file = inputs[key].files[0];
          if (!file && !current) throw new Error("신분증·통장 사본을 모두 선택해 주세요.");
          if (file) formats[key] = await paymentFileFormat(file, key);
        }
        const paths = {};
        for (const key of ["identity", "bank"]) {
          const file = inputs[key].files[0]; paths[key] = current ? current[key + "_path"] : null;
          if (file) {
            const path = ME.id + "/" + key + "/" + crypto.randomUUID() + "." + formats[key].ext;
            const { error } = await sb.storage.from("payment-documents").upload(path, file, { contentType: formats[key].mime, upsert: false, cacheControl: "0" });
            if (error) throw new Error("파일 업로드에 실패했습니다. 기존 제출 자료는 유지됩니다. 잠시 후 다시 시도해 주세요."); paths[key] = path;
          }
        }
        const { error } = await sb.rpc("payment_submit", { p_email: inputs.email.value.trim(), p_phone: inputs.phone.value.trim(), p_identity: paths.identity, p_bank: paths.bank, p_revision: current ? current.revision : 0 });
        if (error) throw new Error("제출을 완료하지 못했습니다. 이메일·휴대폰을 확인하고, 다른 화면에서 수정했다면 새로고침해 주세요.");
        toast("서류가 제출되었습니다."); await loadPaymentPreview(box);
      } catch (error) { status.textContent = error.message || "제출에 실패했습니다. 다시 시도해 주세요."; fields.disabled = button.disabled = false; }
    });
    submit.append(form); box.append(submit);
    } else box.append(el("p", "note", "수당 서류 열람 전용 계정입니다. 아래에서 제출 현황과 파일을 확인할 수 있습니다."));
    if (state.reader) {
      const review = el("section", "card payment-preview"); review.append(el("h3", "", "제출 현황 · 서류 확인"));
      const { data: list, error } = await sb.rpc("payment_review_list");
      if (error) { review.append(el("p", "note", "제출 현황을 불러오지 못했습니다.")); box.append(review); return; }
      const wrap = el("div", "gscroll"), table = el("table", "dtable"), head = el("thead"), tr = el("tr");
      ["성명", "역할", "신분증 사본", "통장 사본", "이메일", "핸드폰 번호", "확인 상태"].forEach(t => tr.append(el("th", "", t)));
      head.append(tr); const body = el("tbody");
      (list || []).forEach(item => {
        const row = el("tr"), p = item.submission; row.append(el("td", "", item.name), el("td", "", item.duty || "—"));
        ["identity", "bank"].forEach(key => { const td = el("td"); td.append(p ? download(p[key + "_path"], key === "identity" ? "신분증 사본" : "통장 사본") : el("span", "", "미제출")); row.append(td); });
        row.append(el("td", "", p ? p.email : "—"), el("td", "", p ? p.phone : "—"));
        const td = el("td"); td.append(el("span", "", !p ? "미제출" : p.checked_at ? "확인 완료" : "확인 대기"));
        if (p && state.reviewer) { const check = el("button", "btn ghost small", p.checked_at ? "확인 취소" : "확인 완료"); check.type = "button";
          check.addEventListener("click", async () => { check.disabled = true; if (await save(sb.rpc("payment_review", { p_user: item.user_id, p_revision: p.revision, p_checked: !p.checked_at }), "확인 상태를 저장했습니다")) loadPaymentPreview(box); else check.disabled = false; }); td.append(check); }
        row.append(td); body.append(row);
      }); table.append(head, body); wrap.append(table); review.append(wrap); box.append(review);
    }
  }

  // 지원단 명단
  let STAFF = [];
  // 열 순서(2026-10-19 사용자 요청): 순번 · 소속 · 성명 · 역할 및 담당 업무 · 담당 학교 · 심판가능 · 연락처
  // 역할(title)은 담당 업무(pre_duty)에 합침(DB), 지역·직책은 화면에서만 숨김(position은 승인 화면 젠지 코치 판별에 씀)
  // 열 너비(2026-10-19): 칸은 가장 긴 내용에 딱 맞추고(st-fit), 남는 폭은 담당 학교가 차지해 한 화면에 들어오게
  const staffCol = ([k, label, type, cls]) => ({ key: k, label, type, cls, get: r => r[k] });
  const STAFF_COLS = [["seq", "순번", "int", "st-fit st-num"], ["school", "소속", "", "st-fit"], ["name", "성명", "", "st-fit"],
    ["pre_duty", "역할 및 담당 업무", "", "st-fit st-duty"]].map(staffCol);
  // 담당 학교: 관리자만 지정 (DB 트리거 staff_schools_guard가 한 번 더 막음)
  STAFF_COLS.push({
    key: "schools", label: "담당 학교", cls: "col-schools", get: r => (r.schools || []).map(schoolLabel).join(", "),
    cell: (td, r) => {
      const list = r.schools || [];
      const wrap = el("div", "staff-schools");
      if (list.length) wrap.append(el("span", "ss-count", list.length + "개"));
      list.forEach(s => wrap.append(el("span", "tier-chip", schoolLabel(s))));
      if (!list.length && !isOwner()) wrap.append(el("span", "note", "—"));
      if (isOwner()) {
        const b = el("button", "btn ghost small", list.length ? "고치기" : "지정하기");
        b.type = "button";
        b.addEventListener("click", () => openSchoolPicker(r));
        wrap.append(b);
      }
      td.append(wrap);
    }
  });
  STAFF_COLS.push(...[["referee_ok", "심판가능", "bool", "st-fit"], ["phone", "연락처", "", "st-fit"]].map(staffCol));

  // 참가 학교 목록 (아이디 명단 기준, 부문별). 저장은 학교 이름만, 화면은 "(안산)원곡고등학교"
  const SCHOOL_REGION = {};
  const schoolLabel = s => (SCHOOL_REGION[s] ? "(" + SCHOOL_REGION[s] + ")" : "") + s;
  async function fetchSchools() {
    const { data, error } = await sb.from("sheet_rows").select("sheet,data").in("sheet", ["roster_middle", "roster_high"]);
    if (error) return null;
    const out = { 중등부: new Set(), 고등부: new Set() };
    data.forEach(x => {
      const s = String(x.data["학교 이름"] || "").trim();
      if (!s) return;
      out[x.sheet === "roster_middle" ? "중등부" : "고등부"].add(s);
      const rg = String(x.data["학교 소재 지역"] || "").trim().replace(/(시|군)$/, "");
      if (rg) SCHOOL_REGION[s] = rg;
    });
    // 지역순 → 학교 이름순: (광명)… (안산)…
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort((a, b) => schoolLabel(a).localeCompare(schoolLabel(b), "ko"))]));
  }

  async function openSchoolPicker(staffRow) {
    const schools = await fetchSchools();
    if (!schools) { toast("학교 목록을 불러오지 못했습니다", true); return; }
    const owner = {};
    STAFF.forEach(s => { if (s.id !== staffRow.id) (s.schools || []).forEach(x => { (owner[x] = owner[x] || []).push(s.name); }); });
    const chosen = new Set(staffRow.schools || []);
    const dlg = el("dialog", "rdlg");
    dlg.setAttribute("aria-label", staffRow.name + " 선생님 담당 학교");
    const close = () => { dlg.close(); dlg.remove(); };
    const count = el("b");
    const head = el("p", "note");
    head.append("선택한 학교 ", count, " · 다른 선생님이 맡은 학교는 이름이 함께 보입니다. 개수 제한은 없습니다.");
    const q = el("input", "gsearch");
    q.type = "search"; q.placeholder = "학교·지역 검색 (예: 안산)"; q.setAttribute("aria-label", "학교 검색");
    const body = el("div", "ss-body");
    const upd = () => { count.textContent = chosen.size + "개"; };
    function draw() {
      body.replaceChildren();
      const term = q.value.trim();
      Object.entries(schools).forEach(([div, list]) => {
        const shown = list.filter(s => !term || schoolLabel(s).includes(term));
        if (!shown.length) return;
        body.append(el("h4", "", div + " (" + shown.length + ")"));
        const g = el("div", "ss-grid");
        shown.forEach(s => {
          const l = el("label", "ss-item" + (owner[s] ? " taken" : ""));
          const cb = el("input"); cb.type = "checkbox"; cb.checked = chosen.has(s);
          cb.addEventListener("change", () => { cb.checked ? chosen.add(s) : chosen.delete(s); upd(); });
          l.append(cb, document.createTextNode(" " + schoolLabel(s)));
          if (owner[s]) l.append(el("small", "", owner[s].join("·")));
          g.append(l);
        });
        body.append(g);
      });
      // 목록에 없는(이름이 바뀌었거나 빠진) 학교도 지우지 않고 보여 줌
      const known = new Set(Object.values(schools).flat());
      const extra = [...chosen].filter(s => !known.has(s) && (!term || s.includes(term)));
      if (extra.length) {
        body.append(el("h4", "", "명단에 없는 학교"));
        const g = el("div", "ss-grid");
        extra.forEach(s => {
          const l = el("label", "ss-item");
          const cb = el("input"); cb.type = "checkbox"; cb.checked = true;
          cb.addEventListener("change", () => { cb.checked ? chosen.add(s) : chosen.delete(s); upd(); });
          l.append(cb, document.createTextNode(" " + s));
          g.append(l);
        });
        body.append(g);
      }
    }
    q.addEventListener("input", draw);
    const btns = el("div", "rdlg-btns");
    const cancel = el("button", "btn ghost", "닫기"); cancel.type = "button"; cancel.addEventListener("click", close);
    const ok = el("button", "btn", "저장"); ok.type = "button";
    ok.addEventListener("click", async () => {
      ok.disabled = true;
      const v = [...chosen].sort((a, b) => a.localeCompare(b, "ko"));
      if (await save(sb.from("staff").update({ schools: v }).eq("id", staffRow.id), "담당 학교를 저장했습니다")) {
        staffRow.schools = v; close(); if (staffBox) loadStaff(staffBox);
      } else ok.disabled = false;
    });
    btns.append(cancel, ok);
    dlg.append(el("h3", "", staffRow.name + " 선생님 담당 학교"), head, q, body, btns);
    document.body.append(dlg);
    upd(); draw();
    dlg.showModal();
  }

  async function fetchStaff() {
    // 심판(젠지 코치) 권한은 연락처를 뺀 목록만 (DB에서도 staff 표 직접 읽기 막음)
    const { data, error } = ME.role === "referee" ? await sb.rpc("staff_directory")
      : await sb.from("staff").select("*").order("seq", { nullsFirst: false }).order("id");
    if (error) { toast("명단을 불러오지 못했습니다", true); return []; }
    STAFF = data;
    return data;
  }
  let staffBox = null;
  async function loadStaff(box) {
    staffBox = box;
    const [rows] = await Promise.all([fetchStaff(), fetchSchools()]); // 학교 지역 표시용
    grid(box, {
      columns: ME.role === "referee" ? STAFF_COLS.filter(c => c.key !== "phone") : STAFF_COLS, rows, exportName: "지원단 명단",
      onSave: async (r, c, v) => { if (await save(sb.from("staff").update({ [c.key]: v }).eq("id", r.id))) r[c.key] = v; },
      onDelete: async r => { if (await save(sb.from("staff").delete().eq("id", r.id), "삭제했습니다")) loadStaff(box); },
      onAdd: async () => { const n = prompt("추가할 선생님 성명"); if (n && await save(sb.from("staff").insert({ name: n.trim() }), "추가했습니다")) loadStaff(box); }
    });
  }

  // 팀별 티어 현황: 주전·후보 상위 5명 평균·순위 자동 계산 (원래 엑셀 수식을 대신함)
  async function loadTier(box) {
    box.replaceChildren();
    let current = "tier_middle";
    const divOf = s => (s === "tier_middle" ? "중등부" : "고등부");
    const sw = el("div", "div-switch");
    [["tier_middle", "중등부"], ["tier_high", "고등부"]].forEach(([key, label]) => {
      const b = el("button", "chip", label);
      b.type = "button";
      b.setAttribute("aria-pressed", key === current);
      b.addEventListener("click", () => { current = key; sw.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x === b)); load(); });
      sw.append(b);
    });
    const summary = el("div", "tier-summary");
    const inner = el("div");
    box.append(sw, summary, inner);

    let rows = [], scores = [], keys = [], tierCountsOpen = true, report = null, backup = false, loadVersion = 0;
    if (isEditor()) {
      const source = el("select", "gfilter"); source.setAttribute("aria-label", "티어 자료 선택");
      [["current", "현재 티어"], ["backup", "2026-10-20 변경 전 백업 (읽기 전용)"]].forEach(([v,t]) => { const o=el("option", "", t); o.value=v; source.append(o); });
      source.addEventListener("change", () => { backup=source.value === "backup"; load(); }); sw.append(source);
    }
    async function load() {
      inner.replaceChildren(el("p", "note", "불러오는 중…"));
      const version = ++loadVersion;
      const [m, result] = await Promise.all([
        sb.from("sheet_columns").select("columns").eq("sheet", current).maybeSingle(),
        sb.rpc("teacher_tier_report", { p_backup: backup })
      ]);
      if (version !== loadVersion) return;
      if (result.error || !result.data) { inner.replaceChildren(el("p", "note", "불러오지 못했습니다.")); summary.replaceChildren(); return; }
      report = result.data;
      rows = report.rows.filter(r => r.sheet === current); scores = report.scores.filter(s => s.division === divOf(current));
      keys = (m.data && m.data.columns) || [...new Set(rows.flatMap(x => Object.keys(x.data)))];
      render();
      const sheet = current;
      autoRefresh(box, () => tableSig("sheet_rows", q => q.eq("sheet", sheet)), () => { if (current === sheet) load(); });
    }

    function compute() {
      const teams = new Map(report.teams.filter(t => t.division === divOf(current)).map(t => [normSchool(t.school), t]));
      rows.forEach(r => {
        const t = teams.get(normSchool(r.data["학교"]));
        r._top = t?.top_five || []; r._avg = t?.average ?? null;
        r._n = r._top.length; r._unknown = t?.unknown_count || 0;
      });
    }

    // 순위: 확인이 필요한 팀은 빼고, 상위 5명 평균이 낮을수록 1위. 같은 평균은 같은 순위.
    function rankAndSort(isCheck) {
      rows.forEach(r => { r._todo = isCheck(r) ? "확인 필요" : r._unknown ? "티어 확인 필요 (" + r._unknown + "명)" : r._n < 5 ? "티어 미입력 (" + r._n + "/5)" : ""; });
      const sorted = rows.filter(r => !r._todo).map(r => r._avg).sort((a, b) => a - b);
      rows.forEach(r => { r._rank = r._todo ? null : sorted.indexOf(r._avg) + 1; });
      // 할 일이 있는 팀을 맨 위(확인 필요 → 티어 미입력, 학교 이름순), 그 아래 순위순
      const name = r => String(r.data["학교"] || "");
      const group = r => (r._todo === "확인 필요" ? 0 : r._todo ? 1 : 2);
      rows.sort((a, b) => group(a) - group(b) || (group(a) === 2 ? a._rank - b._rank : 0) || name(a).localeCompare(name(b), "ko"));
    }

    function render() {
      compute();
      const chipBox = el("details", "score-editor tier-counts");
      chipBox.open = tierCountsOpen;
      chipBox.addEventListener("toggle", () => { tierCountsOpen = chipBox.open; });
      chipBox.append(el("summary", "", (backup ? "변경 전 백업 · " : "") + "티어별 전체 등록 인원 (주전·후보 포함)"));
      const table = el("table", "dtable");
      const head = el("thead"), hr = el("tr");
      ["티어", "전체 (비율)", "중등부", "고등부"].forEach(t => hr.append(el("th", "", t))); head.append(hr); table.append(head);
      const body = el("tbody");
      const totals = report.counts.reduce((sum, c) => sum.map((n, i) => n + Number([c.total,c.middle,c.high][i])), [0,0,0]);
      const withRatio = n => n + "명 (" + (totals[0] ? n / totals[0] * 100 : 0).toFixed(1) + "%)";
      report.counts.forEach(c => { const tr=el("tr"); [c.tier,withRatio(c.total),c.middle,c.high].forEach(v => tr.append(el("td", "", String(v)))); body.append(tr); });
      const total=el("tr"); ["합계",withRatio(totals[0]),totals[1],totals[2]].forEach(v=>total.append(el("th", "", String(v)))); body.append(total); table.append(body);
      const countScroll=el("div", "gscroll"); countScroll.append(table); chipBox.append(countScroll);
      chipBox.append(el("p", "note", "비율은 주전·후보를 포함한 전체 등록 인원 기준이며, 소수점 첫째 자리까지 표시합니다."));
      summary.replaceChildren(chipBox, el("p", "note", "산정 1~5는 주전·후보 중 티어가 높은 5명입니다. 원래 선수 칸은 유지하며, 구분되지 않은 티어는 확인 대상으로 남깁니다."));
      if (isEditor() && !backup) summary.append(scoreEditor());

      const tierOptions = ["", ...scores.filter(t => !["브론즈,아이언", "아이언, 언랭"].includes(t.tier)).map(t => t.tier)];
      const playerCols = new Set(keys.filter(k => /^(선수|예비)\d/.test(k)));
      const columns = keys.map(k => {
        // '순번' 자리에 자동 순위를 보여 줌 (순번 값은 지우지 않고 화면에서만 뺌)
        if (k === "순번") return { key: "_rank", label: "순위", readonly: true, get: r => r._rank == null ? r._todo : r._rank, cellClass: r => (r._todo ? "dupe" : "") };
        const col = { key: k, label: k, get: r => r.data[k] };
        if (playerCols.has(k)) {
          const extra = [...new Set(rows.map(r => r.data[k]).filter(v => v && !tierOptions.includes(v)))];
          col.options = [...tierOptions, ...extra];
        }
        return col;
      });
      columns.unshift(...[0,1,2,3,4].map(i => ({ key: "_top"+i, label: "산정 "+(i+1), readonly: true, get: r => { const t=r._top[i]; return t ? t.tier+" ("+t.line+")" : "미확인"; } })));
      const filters = [addDupeColumn(columns, rows, "학교")];
      rankAndSort(r => filters[0].get(r) === "확인 필요");
      // 맨 위 할 일: 중복 확인 → 티어 미입력(몇 명 들어왔는지)
      const named = rows.filter(r => String(r.data["학교"] || "").trim());
      const item = (r, extra) => ({ school: String(r.data["학교"]).trim(), text: shortSchool(r.data["학교"]) + (extra || "") });
      summary.prepend(todoBoard("할 일 (" + divOf(current) + ")", [
        { label: "중복 신청 확인", cls: "t-dupe", items: named.filter(r => r._todo === "확인 필요").map(r => item(r)) },
        { label: "티어 확인 필요", cls: "t-tier", items: named.filter(r => r._todo && r._todo !== "확인 필요").map(r => item(r, r._unknown ? " · " + r._unknown + "명 확인" : " · " + r._n + "/5")) }
      ], "모든 학교의 티어가 확인되었습니다.", inner));
      if (!keys.includes("순번")) columns.unshift({ key: "_rank", label: "순위", readonly: true, get: r => r._rank == null ? r._todo : r._rank, cellClass: r => (r._todo ? "dupe" : "") });
      columns.push({ key: "_avg", label: "평균(상위5)", readonly: true, get: r => r._avg == null ? "미입력" : r._avg.toFixed(2) + (r._n < 5 ? " (" + r._n + "명)" : "") });
      grid(inner, {
        columns, rows, filters, canSave: !backup && isEditor(), exportName: "팀별 티어 현황(" + divOf(current) + ")",
        onSave: async (r, c, v) => {
          if (backup) return;
          // 바뀐 칸만 저장 (행 전체를 덮어쓰지 않음)
          if (await save(sb.rpc("set_sheet_cell", { p_id: r.id, p_key: c.key, p_value: String(v ?? "") }))) { await load(); if (box._resync) box._resync(); }
        },
        onDelete: backup ? undefined : r => deleteSheetRow(r, current, load),
        onAdd: backup ? undefined : async () => {
          const next = rows.reduce((mx, r) => Math.max(mx, r.row_no), 0) + 1;
          if (await save(sb.from("sheet_rows").insert({ sheet: current, row_no: next, data: {} }), "행을 추가했습니다")) load();
        }
      });
    }

    // 티어 점수 기준표 (고치기 권한자만)
    function scoreEditor() {
      const d = el("details", "score-editor");
      d.append(el("summary", "", "티어 점수 기준표 (" + divOf(current) + ") 고치기"));
      const t = el("table", "dtable");
      const hr = el("tr");
      ["티어", "점수", ""].forEach(h => hr.append(el("th", "", h)));
      const thead = el("thead"); thead.append(hr);
      const tb = el("tbody");
      scores.forEach(s => {
        const tr = el("tr");
        tr.append(el("td", "", s.tier));
        const td = el("td");
        const i = el("input", "cell");
        i.type = "number"; i.step = "0.5"; i.value = s.score; i.size = 4;
        i.setAttribute("aria-label", s.tier + " 점수");
        i.addEventListener("change", async () => {
          const v = Number(i.value);
          if (await save(sb.from("tier_scores").update({ score: v }).eq("division", s.division).eq("tier", s.tier))) { await load(); }
        });
        td.append(i);
        const del = el("button", "del", "삭제");
        del.type = "button";
        del.addEventListener("click", async () => {
          if (confirm(s.tier + " 티어를 기준표에서 뺄까요? 이 티어를 고른 선수는 평균 계산에서 빠집니다.") &&
              await save(sb.from("tier_scores").delete().eq("division", s.division).eq("tier", s.tier), "삭제했습니다")) load();
        });
        const td2 = el("td"); td2.append(del);
        tr.append(td, td2);
        tb.append(tr);
      });
      t.append(thead, tb);
      const add = el("button", "btn small", "+ 티어 추가");
      add.type = "button";
      add.addEventListener("click", async () => {
        const name = prompt("추가할 티어 이름 (선수 칸에 고를 이름)");
        if (!name) return;
        const sc = Number(prompt(name + "의 점수 (낮을수록 높은 티어)", "5"));
        if (Number.isNaN(sc)) return;
        if (await save(sb.from("tier_scores").insert({ division: divOf(current), tier: name.trim(), score: sc, sort: scores.length + 1 }), "추가했습니다")) load();
      });
      d.append(t, add);
      return d;
    }
    load();
  }

  // 학교 이름 비교용 (공백 제거)
  const normSchool = s => String(s || "").replace(/\s+/g, "");
  // 같은 학교가 두 번 이상 나오거나 '확인 사항'이 적힌 행에 "확인 필요" 열을 맨 앞에 붙이고,
  // 맨 위에서 고를 수 있는 '확인' 필터를 돌려준다
  function addDupeColumn(columns, rows, schoolKey) {
    const count = {};
    rows.forEach(r => { const k = normSchool(r.data[schoolKey]); if (k) count[k] = (count[k] || 0) + 1; });
    const isDupe = r => count[normSchool(r.data[schoolKey])] > 1;
    const note = r => String(r.data["확인 사항"] || "").trim();
    const status = r => (isDupe(r) || note(r) ? "확인 필요" : "정상");
    // 확인이 필요한 줄이 하나도 없으면 '확인'·'확인 사항' 열과 필터를 숨겨 표를 왼쪽으로 당김 (생기면 다시 자동으로 나옴)
    if (!rows.some(r => status(r) === "확인 필요")) {
      const i = columns.findIndex(c => c.key === "확인 사항");
      if (i >= 0) columns.splice(i, 1);
      return { label: "확인", values: ["확인 필요", "정상"], get: status, hidden: true };
    }
    columns.unshift({
      key: "_dupe", label: "확인", readonly: true,
      get: r => (isDupe(r) ? "중복 · 확인 필요" : note(r) ? "확인 필요" : ""),
      cellClass: r => (status(r) === "확인 필요" ? "dupe" : "")
    });
    const noteCol = columns.find(c => c.key === "확인 사항");
    if (noteCol) noteCol.cellClass = r => (note(r) ? "dupe" : "");
    return { label: "확인", values: ["확인 필요", "정상"], get: status };
  }

  // 아이디 명단 열 이름 → 라인 묶음 (이름 칸과 아이디 칸을 같은 묶음으로)
  function lineGroup(key) {
    const m = key.match(/후보\d|탑|정글|미드|원딜|서폿/);
    return m ? m[0] : null;
  }

  // 명단·연락처 시트 (행 단위 JSON)
  async function loadSheet(box, def) {
    box.replaceChildren();
    let current = def.subs[0][0];
    if (def.subs.length > 1) {
      const sw = el("div", "div-switch");
      def.subs.forEach(([key, label]) => {
        const b = el("button", "chip", label);
        b.type = "button";
        b.setAttribute("aria-pressed", key === current);
        b.addEventListener("click", () => {
          current = key;
          sw.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x === b));
          draw();
        });
        sw.append(b);
      });
      box.append(sw);
    }
    const inner = el("div");
    box.append(inner);
    async function draw() {
      inner.replaceChildren(el("p", "note", "불러오는 중…"));
      // '전체'는 중등부·고등부 표를 합쳐서 보여 준다 (각 행은 원래 표에 그대로 저장)
      const isAll = current === "roster_all";
      const sheets = isAll ? ["roster_middle", "roster_high"] : [current];
      const [{ data: metas }, { data: rows, error }] = await Promise.all([
        sb.from("sheet_columns").select("sheet,columns").in("sheet", sheets),
        sb.from("sheet_rows").select("id,sheet,row_no,data").in("sheet", sheets).order("row_no")
      ]);
      if (error) { inner.replaceChildren(el("p", "note", "불러오지 못했습니다.")); return; }
      const keys = [...new Set(sheets.flatMap(s => ((metas || []).find(m => m.sheet === s) || {}).columns || []))];
      if (!keys.length) rows.flatMap(r => Object.keys(r.data)).forEach(k => { if (!keys.includes(k)) keys.push(k); });
      if (!rows.length) { inner.replaceChildren(el("p", "note", "아직 자료가 없습니다.")); }
      const columns = keys.map(k => ({ key: k, label: k, get: r => r.data[k] }));
      if (isAll) columns.unshift({ key: "_division", label: "부문", readonly: true, get: r => (r.sheet === "roster_high" ? "고등부" : "중등부") });
      const filters = [addDupeColumn(columns, rows, keys.includes("학교 이름") ? "학교 이름" : "학교")];
      if (current === "captains" || current === "advisors") {
        // 지역: 아이디 명단의 '학교 소재 지역'을 학교 이름으로 연결해서 보여 줌 (따로 저장하지 않음)
        const { data: ros } = await sb.from("sheet_rows").select("data").in("sheet", ["roster_middle", "roster_high"]);
        const regionOf = {};
        (ros || []).forEach(x => { const s = normSchool(x.data["학교 이름"]); if (s && x.data["학교 소재 지역"] && !regionOf[s]) regionOf[s] = x.data["학교 소재 지역"]; });
        const region = r => regionOf[normSchool(r.data["학교"])] || "";
        const at = columns.findIndex(c => c.key === "급");
        columns.splice(at >= 0 ? at + 1 : 2, 0, { key: "_region", label: "지역", readonly: true, get: region });
        const regions = [...new Set(rows.map(region).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
        filters.push({ label: "지역", values: regions, get: region });
      }
      if (current === "captains" || current === "advisors") {
        // 팀장·지도교사 연락처: 학교 가나다순(같은 학교는 원래 순서, 빈 줄 맨 아래), '순번'은 이 순서대로 화면에서 매김 → 새 학교가 들어와도 자동으로 제자리
        const schoolOf = r => String(r.data["학교"] || "").trim();
        rows.sort((a, b) => (!schoolOf(a)) - (!schoolOf(b)) || schoolOf(a).localeCompare(schoolOf(b), "ko"));
        rows.forEach((r, i) => { r._no = schoolOf(r) ? i + 1 : ""; });
        const seq = { key: "_no", label: "순번", readonly: true, get: r => r._no };
        const at = columns.findIndex(c => c.key === "순번");
        if (at >= 0) columns[at] = seq; else columns.unshift(seq);
        // 표가 한눈에 들어오게: 칸은 글자 길이만큼만, 학교는 좁게(긴 이름은 …, 마우스를 올리면 전체)
        columns.forEach(c => { if (!c.cls) c.cls = c.key === "학교" ? "col-school" : "col-fit"; });
        // 디스코드 팀장 권한 부여 현황: O / X (고치기 권한자가 확인 후 바꿈)
        const perm = columns.find(c => c.key === "권한 부여 현황");
        if (perm) {
          perm.options = ["", "O", "X"];
          perm.cellClass = r => (r.data["권한 부여 현황"] === "X" ? "perm-x" : "");
          perm.redraw = true; // O/X를 바꾸면 칸 색도 바로 바뀌게
          filters.push({ label: "권한 부여", values: ["O", "X"], get: r => r.data["권한 부여 현황"] || "" });
        }
      }
      let badNote = 0;
      if (current.startsWith("roster_")) {
        // 팀장: 팀장 연락처 표에서 학교별 팀장 이름을 가져와 '팀장' 열과 선수 이름 칸 배지로 표시
        const { data: caps } = await sb.from("sheet_rows").select("id,row_no,data").eq("sheet", "captains");
        const capRows = {};
        (caps || []).forEach(c => { const s = normSchool(c.data["학교"]); if (s) (capRows[s] = capRows[s] || []).push(c); });
        const capRowsOf = r => capRows[normSchool(r.data["학교 이름"])] || [];
        const nameKey = n => String(n || "").replace(/\(.*?\)/g, "").replace(/\s+/g, "");
        // 여러 팀이 신청한 학교(팀장 2명 이상)는 팀장을 정하지 않고 비워 둔다
        const multiCap = r => capRowsOf(r).filter(c => c.data["팀장이름"]).length > 1;
        const capName = r => { const l = capRowsOf(r).filter(c => c.data["팀장이름"]); return l.length === 1 ? String(l[0].data["팀장이름"]).trim() : ""; };
        const nameCols = keys.filter(k => /학생 이름/.test(k));
        const capFound = r => { const n = nameKey(capName(r)); return !!n && nameCols.some(k => nameKey(r.data[k]) === n); };
        // 팀장 이름을 팀장 연락처 표에 저장 (그 학교 팀장 행이 없으면 새로 만듦)
        async function saveCaptain(r, name) {
          const list = capRowsOf(r);
          const school = String(r.data["학교 이름"] || "").trim();
          if (!school) { toast("학교 이름이 없어 팀장 연락처와 연결할 수 없습니다", true); return false; }
          if (list.length > 1) { toast("팀장이 여러 명인 학교라 팀장 연락처 표에서 직접 고쳐 주세요", true); return false; }
          if (list.length === 1) {
            if (!await save(sb.rpc("set_sheet_cell", { p_id: list[0].id, p_key: "팀장이름", p_value: name }), "팀장 연락처도 고쳤습니다")) return false;
            list[0].data = { ...list[0].data, "팀장이름": name };
          } else {
            const next = Object.values(capRows).flat().reduce((m, c) => Math.max(m, c.row_no), 0) + 1;
            const data = { "순번": String(next), "학교": school, "급": (r.sheet || current) === "roster_high" ? "고등학교" : "중학교", "팀장이름": name };
            const { data: added, error } = await sb.from("sheet_rows").insert({ sheet: "captains", row_no: next, data }).select("id,row_no,data").single();
            if (error) { toast("팀장 연락처에 추가하지 못했습니다: " + error.message, true); return false; }
            capRows[normSchool(school)] = [added];
            toast("팀장 연락처에 새로 추가했습니다");
          }
          return true;
        }
        const schoolIdx = columns.findIndex(c => c.key === "학교 이름");
        columns.splice(schoolIdx + 1, 0, {
          key: "_captain", label: "팀장",
          // 팀장이 여러 명(중복 신청)인 학교만 여기서 못 고침
          readonly: r => multiCap(r),
          get: r => { const n = capName(r); return !n ? "" : (capFound(r) || isEditor()) ? n : n + " (명단에 없음)"; },
          cellClass: r => (capName(r) && !capFound(r) ? "cap-missing" : ""),
          onSave: async (r, v) => { if (await saveCaptain(r, String(v ?? "").trim())) draw(); }
        });
        nameCols.forEach(k => {
          const col = columns.find(c => c.key === k);
          col.cellClass = r => { const n = nameKey(capName(r)); return n && nameKey(r.data[k]) === n ? "captain" : ""; };
          // 팀장 배지가 붙은 이름 칸을 고치면 팀장 연락처의 팀장 이름도 같이 고침
          col.afterSave = async (r, oldVal, v) => {
            const n = nameKey(capName(r));
            if (n && nameKey(oldVal) === n && nameKey(v) && nameKey(v) !== n) return saveCaptain(r, String(v).replace(/\(.*?\)/g, "").trim());
            return false;
          };
        });
        // 학교 이름 가나다순, 지역 필터, 라인별(이름+아이디) 구분선, 태그 없는 아이디 강조
        // 학교 이름이 빈 줄은 맨 아래. 번호는 이 순서대로 화면에서만 매김(저장 안 함 → 새 학교가 들어와도 자동으로 제자리)
        const schoolOf = r => String(r.data["학교 이름"] || "").trim();
        rows.sort((a, b) => (!schoolOf(a)) - (!schoolOf(b)) || schoolOf(a).localeCompare(schoolOf(b), "ko"));
        rows.forEach((r, i) => { r._no = schoolOf(r) ? i + 1 : ""; });
        columns.unshift({ key: "_no", label: "번호", readonly: true, get: r => r._no });
        const regions = [...new Set(rows.map(r => r.data["학교 소재 지역"]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
        if (isAll) filters.push({ label: "부문", values: ["중등부", "고등부"], get: r => (r.sheet === "roster_high" ? "고등부" : "중등부") });
        filters.push({ label: "지역", values: regions, get: r => r.data["학교 소재 지역"] });
        const idKeys = keys.filter(k => /LOL 아이디/.test(k));
        const badIds = r => idKeys.filter(k => r.data[k] && riotIdError(r.data[k])).length;
        filters.push({ label: "아이디 형식", values: ["오류 있음", "정상"], get: r => (badIds(r) ? "오류 있음" : "정상") });
        const nBad = rows.reduce((n, r) => n + badIds(r), 0);
        badNote = nBad;
        let prev = null, group = 0;
        columns.forEach(c => {
          const g = lineGroup(c.key);
          if (g) {
            if (g !== prev) group++;
            c.cls = "lg lg-" + (group % 2 ? "a" : "b") + (g !== prev ? " lg-start" : "");
            // 라이엇 규칙에 안 맞는 아이디(태그 없음·글자 수 등)는 빨갛게 → '아이디 형식' 필터로 모아 보기
            if (/아이디/.test(c.key)) c.cellClass = r => (r.data[c.key] && riotIdError(r.data[c.key]) ? "notag" : "");
          }
          prev = g;
        });
      }
      const label = def.subs.find(s => s[0] === current)[1];
      grid(inner, {
        columns, rows, filters, exportName: def.title + (def.subs.length > 1 ? "(" + label + ")" : ""),
        onSave: async (r, c, v) => {
          // 바뀐 칸만 저장 (행 전체를 덮어쓰지 않음)
          if (c.onSave) return c.onSave(r, v);
          const oldVal = r.data[c.key];
          if (await save(sb.rpc("set_sheet_cell", { p_id: r.id, p_key: c.key, p_value: String(v ?? "") }))) {
            r.data = { ...r.data, [c.key]: v };
            if (c.redraw || (c.afterSave && await c.afterSave(r, oldVal, v))) { draw(); return; }
            // 중복 신청 학교의 선수 칸을 직접 채웠으면 → 이 명단으로 확정할지 묻는다 (확정하면 전적 검색·팀장 확인에 포함)
            const sheet = r.sheet || current;
            if (sheet.startsWith("roster_") && /중복/.test(String(r.data["확인 사항"] || "")) && /학생 이름|LOL 아이디/.test(c.key) && String(v || "").trim() &&
                confirm("'" + r.data["학교 이름"] + "'은(는) 중복 신청 학교입니다.\n지금 입력한 명단으로 이 학교를 확정할까요?\n\n" +
                  "확정하면 '확인 사항'이 지워지고, 학생 전적 검색과 팀장 명단 확인·수정에 포함됩니다.\n(다른 팀 팀장 줄은 팀장 연락처 표에서 직접 정리해 주세요)")) {
              const { error } = await sb.rpc("confirm_school", { p_sheet: sheet, p_school: r.data["학교 이름"] });
              if (error) toast("확정하지 못했습니다: " + error.message, true); else { toast("확정했습니다"); draw(); }
            }
          }
        },
        onDelete: r => deleteSheetRow(r, r.sheet || current, draw),
        // '전체'에서는 어느 부문에 넣을지 모호하므로 행 추가는 중등부·고등부 보기에서만
        onAdd: isAll ? null : async () => {
          const next = rows.reduce((m, r) => Math.max(m, r.row_no), 0) + 1;
          if (await save(sb.from("sheet_rows").insert({ sheet: current, row_no: next, data: {} }), "행을 추가했습니다")) draw();
        }
      });
      if (badNote) inner.prepend(el("p", "note id-bad-note", "빨간 칸: 라이엇 아이디 형식(이름 3~16자 + #태그 3~5자)에 맞지 않는 아이디 " + badNote + "개 · 아래 '아이디 형식' 필터로 모아 볼 수 있습니다. 전적 검색이 실패할 수 있으니 팀장 확인 후 고쳐 주세요."));
    }
    draw();
  }

  // 대진·경기 결과: 조 편성(중등 64강·고등 32강) → 조별 순위(자동) → 중등 32강 조(자동) → 본선 장로·바론 더블 엘리미네이션 → 4강 리그 → 11/8 결선
  // 출처(src)가 있는 칸은 DB가 자동으로 채움 (G:단계:조:번호 / R:단계:조:순위 / W:코드 승자 / L:코드 패자). 모든 경기 단판(BO1).
  const GRP_NAME = { E: "장로", B: "바론" };
  const STAGE_GROUPS = { "64강": "ABCDEFGHIJKLMNOP".split(""), "32강": "ABCDEFGH".split(""), "4강 리그": ["L"], "본선 진출": ["S"] };
  const FIRST_STAGE = { 중등부: "64강", 고등부: "32강" };
  function srcText(src, matches) {
    if (!src) return "";
    const p = src.split(":");
    if (p[0] === "G" || p[0] === "R") {
      const tail = p[0] === "G" ? p[3] + "번" : p[3] + "위";
      return p[1] === "4강 리그" ? "4강 리그 " + tail : p[1] + " " + p[2] + "조 " + tail;
    }
    const m = matches.find(x => x.code === p[1]);
    const g = GRP_NAME[p[1].split("-")[0]];
    return (g ? g + " " : "") + (m ? m.round_label.replace("라운드", "R") : p[1]) + (p[0] === "W" ? " 승자" : " 패자");
  }
  // 회차 날짜·시간 (+ 본선 라운드별 몇 분 뒤: matches.time_offset_min)
  const sessText = (s, offsetMin = 0) => {
    if (!s) return "";
    const [h, m] = String(s.start_time).split(":").map(Number), t = h * 60 + m + (offsetMin || 0);
    return Number(s.day.slice(5, 7)) + "/" + Number(s.day.slice(8, 10)) + "(" + "일월화수목금토"[new Date(s.day + "T00:00:00+09:00").getDay()] + ") " +
      String(Math.floor(t / 60) % 24).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
  };

  // 상위 5명 평균 티어 점수 (낮을수록 강함, 티어 현황과 같은 계산)
  async function teamStrength(div) {
    const { data, error } = await sb.rpc("teacher_tier_report", { p_backup: false });
    if (error || !data) throw new Error("티어 자료를 불러오지 못했습니다. 다시 시도해 주세요.");
    return Object.fromEntries(data.teams.filter(t => t.division === div).map(t => [normSchool(t.school), t.average]));
  }
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // 자동 조 편성 (2026-10-18 사용자 결정 '(다)'):
  //  티어 평균 순으로 줄 세워 조 수(G)만큼씩 시드(포트)를 자르고, 시드마다 조에 1팀씩 무작위로 넣되
  //  바로 위 시드 팀과의 순위 차이가 G ± 여유(중등 16±6 = 10~22위, 고등 8±3 = 5~11위) 안인 조합만 뽑는다.
  //  조건을 만족하는 조합을 못 찾으면 여유를 1씩 넓혀 다시 뽑는다(결과의 slack으로 알림). 포트 1 = 1번 자리.
  //  기권 예상 학교(risky, 2026-10-18): 3팀 조에는 넣지 않고 4팀 조에만, 한 조에 1개씩(4팀 조보다 많으면 최대 2개).
  //  → 시도마다 4번 시드를 받을 조(4팀 조)를 먼저 무작위로 정해 두고 그 조건으로 짝짓는다.
  function drawCandidate(teams, groups, risky = new Set()) {
    const G = groups.length, base = Math.round(G * 6 / 16);
    const pots = [];
    for (let i = 0; i < teams.length; i += G) pots.push(teams.slice(i, i + G).map((t, j) => ({ t, rank: i + j + 1 })));
    const n4 = pots.length >= 4 ? pots[3].length : 0;          // 4팀 조 수
    const nRisky = teams.filter(t => risky.has(t)).length;
    const cap = nRisky <= n4 ? 1 : 2;
    const riskOk = !nRisky || (nRisky <= n4 * 2 && pots.every(pot => pot.filter(x => risky.has(x.t)).length <= n4)); // 한 포트의 기권 예상 팀도 4팀 조 수 이하여야 가능
    const check = result => {                                   // 결과가 기권 예상 조건을 지키는지
      if (!nRisky) return true;
      return groups.every(g => { const l = result[g].filter(Boolean), r = l.filter(t => risky.has(t)).length; return !r || (l.length === 4 && r <= cap); });
    };
    // 왼쪽(팀) 모두를 오른쪽(조)에 하나씩 짝짓기 — 무작위 순서로 시도하고 막히면 되돌아감
    function match(left, right, ok, budget) {
      const used = new Set(), pick = new Map();
      const L = shuffle(left.slice());
      function go(k) {
        if (k === L.length) return true;
        if (--budget.n < 0) return false;
        for (const r of shuffle(right.filter(x => !used.has(x) && ok(L[k], x)))) {
          used.add(r); pick.set(L[k], r);
          if (go(k + 1)) return true;
          used.delete(r); pick.delete(L[k]);
        }
        return false;
      }
      return go(0) ? pick : null;
    }
    const useRisk = nRisky > 0 && riskOk;
    for (let slack = base; slack <= G; slack++) {
      for (let att = 0; att < (useRisk ? 25 : 1); att++) {
        const four = new Set(shuffle(groups.slice()).slice(0, n4));   // 이번 시도의 4팀 조
        const result = Object.fromEntries(groups.map(g => [g, []]));
        const rankIn = Object.fromEntries(groups.map(g => [g, []]));
        const cnt = Object.fromEntries(groups.map(g => [g, 0]));
        let okAll = true;
        for (let pi = 0; pi < pots.length && okAll; pi++) {
          const pot = pots[pi];
          const ok = (team, g) => (pi === 0 || (rankIn[g][pi - 1] != null && Math.abs(team.rank - rankIn[g][pi - 1] - G) <= slack)) &&
            (!useRisk || ((pi !== 3 || four.has(g)) && (!risky.has(team.t) || (four.has(g) && cnt[g] < cap))));
          let pick = null;
          for (let tries = 0; tries < 30 && !pick; tries++) pick = match(pot, groups, ok, { n: 5000 });
          if (!pick) { okAll = false; break; }
          pick.forEach((g, team) => { result[g][pi] = team.t; rankIn[g][pi] = team.rank; if (risky.has(team.t)) cnt[g]++; });
        }
        if (okAll) return { result, slack, base, G, nRisky, riskMet: check(result), cap };
      }
    }
    // 그래도 안 되면 예전 방식(시드만 지킴)
    const result = Object.fromEntries(groups.map(g => [g, []]));
    pots.forEach((pot, pi) => { const gs = shuffle(groups.slice()).slice(0, pot.length); shuffle(pot.slice()).forEach((x, i) => { result[gs[i]][pi] = x.t; }); });
    return { result, slack: null, base, G, nRisky, riskMet: check(result), cap };
  }
  const cleanRegion = r => String(r || "").trim().replace(/(시|군)$/, "");
  const teamRegion = (t, regions) => cleanRegion(regions[normSchool(t)] || regions[t]);
  const drawSchoolLabel = (t, regions) => t ? t + (teamRegion(t, regions) ? " (" + teamRegion(t, regions) + ")" : "") : "";
  const drawRegions = ros => Object.fromEntries((ros || []).filter(x => x.data["학교 이름"]).map(x => [normSchool(x.data["학교 이름"]), cleanRegion(x.data["학교 소재 지역"])]));
  function regionPairs(result, regions) {
    return Object.values(result).reduce((sum, list) => {
      const counts = {};
      list.filter(Boolean).forEach(t => { const r = teamRegion(t, regions); if (r) counts[r] = (counts[r] || 0) + 1; });
      return sum + Object.values(counts).reduce((n, c) => n + c * (c - 1) / 2, 0);
    }, 0);
  }
  // 같은 포트끼리만 교환하고 순위 차이·기권 예상 조건을 유지하면서 지역 중복을 줄인다.
  function drawGroups(teams, groups, risky = new Set(), regions = {}) {
    const ranks = new Map(teams.map((t, i) => [t, i + 1]));
    const known = teams.filter(t => teamRegion(t, regions)).length;
    let best;
    const valid = (list, d) => {
      const filled = list.filter(Boolean), risk = filled.filter(t => risky.has(t)).length;
      if (d.riskMet && risk && (filled.length !== 4 || risk > d.cap)) return false;
      return d.slack == null || list.every((t, i) => !t || i === 0 || !list[i - 1] || Math.abs(ranks.get(t) - ranks.get(list[i - 1]) - d.G) <= d.slack);
    };
    for (let attempt = 0; attempt < (known ? (risky.size > 6 ? 4 : 24) : 1); attempt++) {
      const d = drawCandidate(teams, groups, risky);
      let pairs = regionPairs(d.result, regions);
      for (let pass = 0; pass < 8 && pairs; pass++) {
        let improved = false;
        for (const seed of shuffle([0, 1, 2, 3])) for (const a of shuffle(groups.slice())) for (const b of shuffle(groups.slice())) {
          if (a === b || !d.result[a][seed] || !d.result[b][seed]) continue;
          const aa = d.result[a].slice(), bb = d.result[b].slice();
          [aa[seed], bb[seed]] = [bb[seed], aa[seed]];
          if (!valid(aa, d) || !valid(bb, d)) continue;
          const before = regionPairs({ a: d.result[a], b: d.result[b] }, regions), after = regionPairs({ a: aa, b: bb }, regions);
          if (after < before) { d.result[a] = aa; d.result[b] = bb; pairs += after - before; improved = true; }
        }
        if (!improved) break;
      }
      d.regionPairs = pairs; d.regionUnknown = teams.length - known;
      // 기존 기권·순위 차이 조건을 우선하고, 같은 조건 안에서 지역 중복이 적은 결과를 고른다.
      const priority = x => [x.riskMet ? 0 : 1, x.slack == null ? 999 : x.slack, x.regionPairs];
      const better = !best || priority(d).some((v, i, p) => v < priority(best)[i] && p.slice(0, i).every((w, j) => w === priority(best)[j]));
      if (better) best = d;
      if (best.regionPairs === 0 && best.riskMet && best.slack === best.base) break;
    }
    return best;
  }
  const drawRegionText = d => " · 같은 지역 대결 " + d.regionPairs + "쌍" + (d.regionPairs ? " (기존 시드·순위 차이·기권 조건 안에서 최대한 분산)" : " (지역 중복 없음)") + (d.regionUnknown ? " · 지역 미입력 " + d.regionUnknown + "팀 제외" : "");
  const drawRiskText = d => !d.nRisky ? "" : d.riskMet
    ? " · 기권 예상 " + d.nRisky + "팀: 모두 4팀 조, 한 조에 최대 " + d.cap + "팀"
    : " · ⚠️ 기권 예상 " + d.nRisky + "팀 조건(4팀 조·한 조 최대 " + d.cap + "팀)을 맞추지 못했습니다";
  const drawRangeText = d => d.slack == null ? "순위 차이 조건을 맞추지 못해 시드만 지켜 무작위로 뽑았습니다"
    : "바로 위 시드 팀과의 순위 차이 " + (d.G - d.slack) + "~" + (d.G + d.slack) + "위" + (d.slack > d.base ? " (기본 " + (d.G - d.base) + "~" + (d.G + d.base) + "위로는 조합이 없어 넓힘)" : "");

  // ── 조 수: 팀 수 ÷ 4 올림 (최대한 4팀 조). 중등 최대 16조, 고등 최대 8조 ──
  const MAX_GROUPS = { 중등부: 16, 고등부: 8 };
  const groupsFor = (div, n) => STAGE_GROUPS[FIRST_STAGE[div]].slice(0, Math.min(MAX_GROUPS[div], Math.max(1, Math.ceil(n / 4))));
  // 다음 단계 자리 수: 중등 32강(1위 자리 16 + 2위 자리 16), 고등 본선(8 + 8)
  const SEATS = { 중등부: 16, 고등부: 8 };
  const fmtDur = sec => sec == null ? "" : Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  function parseDur(v) {
    const m = String(v || "").trim().match(/^(\d{1,3})(?::(\d{1,2}))?$/);
    if (!m) return undefined;
    const sec = Number(m[1]) * 60 + Number(m[2] || 0);
    return sec >= 1 && sec <= 7200 && Number(m[2] || 0) < 60 ? sec : undefined;
  }

  // ── 첫 조별 단계 결과로 다음 단계 진출 팀 고르기 (2026-10-18 사용자 결정) ──
  //  1위 자리 = 각 조 1위 + 잘한 2위, 2위 자리 = 나머지 2위 + 잘한 3위(3팀 조의 3위는 제외)
  //  비교: 2위는 승률, 3위는 승수 → 시간 점수 = (진 경기 시간 합 − 이긴 경기 시간 합) ÷ 경기 수 (클수록 위: 빨리 이기고 오래 버팀)
  function computeAdvance(div, slots, stand, matches, stage = FIRST_STAGE[div]) {
    const problems = [];
    const groups = [...new Set(slots.filter(x => x.stage === stage && x.school).map(x => x.grp))].sort();
    const size = g => slots.filter(x => x.stage === stage && x.grp === g && x.school).length;
    const stats = {};
    matches.filter(m => m.stage === stage && m.team1 && m.team2 && m.winner).forEach(m => {
      [m.team1, m.team2].forEach(t => {
        const st = stats[t] = stats[t] || { games: 0, wins: 0, winSec: 0, lossSec: 0, noTime: 0 };
        st.games++;
        if (m.duration_sec == null) st.noTime++;
        if (m.winner === t) { st.wins++; st.winSec += m.duration_sec || 0; } else st.lossSec += m.duration_sec || 0;
      });
    });
    const row = (x, g) => {
      const st = stats[x.school] || { games: 0, wins: 0, winSec: 0, lossSec: 0, noTime: 0 };
      return { school: x.school, grp: g, rank: x.rank, size: size(g), wins: st.wins, games: st.games, rate: st.games ? st.wins / st.games : 0,
        time: st.games ? (st.lossSec - st.winSec) / st.games : 0, noTime: st.noTime };
    };
    const firsts = [], runners = [], thirds = [];
    groups.forEach(g => {
      const st = stand.filter(x => x.division === div && x.stage === stage && x.grp === g);
      if (!st.length || !st[0].complete) { problems.push(stage + " " + g + "조 경기가 아직 다 끝나지 않았습니다"); return; }
      if (st.some(x => !x.rank)) { problems.push(stage + " " + g + "조 경기 시간 누락 또는 최종 동률 · 확인 후 순위 지정이 필요합니다"); return; }
      st.forEach(x => {
        if (x.rank === 1) firsts.push(row(x, g));
        else if (x.rank === 2) runners.push(row(x, g));
        else if (x.rank === 3 && size(g) === 4) thirds.push(row(x, g)); // 3팀 조의 3위는 제외
      });
    });
    const byTime = (a, b) => b.time - a.time;
    runners.sort((a, b) => b.rate - a.rate || byTime(a, b) || a.school.localeCompare(b.school, "ko"));
    thirds.sort((a, b) => b.wins - a.wins || byTime(a, b) || a.school.localeCompare(b.school, "ko"));
    const seats = stage === "32강" ? 8 : SEATS[div], G = groups.length;
    const promoteN = 0, thirdN = 0; // 2026-10-20 모집 완료: 조 1·2위만, 3위 추가 승급 없음
    if (G !== seats) problems.push("확정 조 수(" + seats + "개)와 현재 조 수(" + G + "개)가 다릅니다. 조 편성을 확인해 주세요. 3위 추가 승급은 하지 않습니다.");
    if (G > seats) problems.push("조가 " + G + "개라 1위만으로도 자리(" + seats + ")를 넘습니다");
    if (thirdN > thirds.length) problems.push("올릴 3위가 " + thirdN + "팀 필요한데 후보가 " + thirds.length + "팀뿐입니다");
    // 자르는 선 바로 앞뒤가 같은 성적이거나 경기 시간이 비어 있으면 표시 → 관리자가 직접 고름
    const tieAt = (list, n, key) => n > 0 && n < list.length && key(list[n - 1]) === key(list[n]);
    const tieR = tieAt(runners, promoteN, x => x.rate + "|" + x.time.toFixed(1)), tieT = tieAt(thirds, thirdN, x => x.wins + "|" + x.time.toFixed(1));
    // 조가 모두 구성되면 각 조 1·2위만 진출하므로 조 간 비교용 경기 시간은 필요 없다.
    const missing = [...(promoteN > 0 && promoteN < runners.length ? runners : []),
      ...(thirdN > 0 && thirdN < thirds.length ? thirds : [])].filter(x => x.noTime).map(x => x.school);
    return { stage, groups, firsts, runners, thirds, promoteN, thirdN, problems, tieR, tieT, missing };
  }

  // ── 진출 팀을 다음 단계 자리에 놓기: 같은 첫 단계 조 출신끼리 최대한 늦게 만나게 (무작위 + 개선 반복) ──
  //  중등: 32강 A~H조의 1·3번 = 1위 자리, 2·4번 = 2위 자리 / 고등: 본선 진출 1~8 = 1위 자리 A~H, 9~16 = 2위 자리 A~H
  function seatKeys(div, stage = FIRST_STAGE[div]) {
    const L = "ABCDEFGH".split("");
    if (div === "중등부" && stage === "64강") {
      const ones = [], twos = [];
      L.forEach((g, i) => { [1, 3].forEach(seed => ones.push({ grp: g, seed, k: [g, "p" + (i >> 1), "h" + (i >> 2)] })); [2, 4].forEach(seed => twos.push({ grp: g, seed, k: [g, "p" + (i >> 1), "h" + (i >> 2)] })); });
      return { ones, twos };
    }
    // 고등 본선 승자조 1R: 장로 A1–B2, C1–D2 … / 바론 B1–A2, D1–C2 …
    const key = (grpName, m) => [grpName + m, grpName + (m >> 1), grpName];
    return {
      ones: L.map((g, i) => ({ grp: "S", seed: i + 1, k: i % 2 === 0 ? key("장로", i >> 1) : key("바론", i >> 1) })),
      twos: L.map((g, j) => ({ grp: "S", seed: j + 9, k: j % 2 === 1 ? key("장로", j >> 1) : key("바론", j >> 1) }))
    };
  }
  function assignSeats(div, ones, twos, regions = {}, stage = FIRST_STAGE[div]) {
    const { ones: s1, twos: s2 } = seatKeys(div, stage);
    const W = [1000, 100, 10]; // 같은 조(고등: 같은 1R 경기) > 1라운드 상대 > 같은 절반(고등: 같은 그룹)
    const cost = (a, b) => {
      const seats = [...a.map((t, i) => [t, s1[i]]), ...b.map((t, i) => [t, s2[i]])];
      let c = 0, regional = 0;
      for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) {
        const region = teamRegion(seats[i][0].school, regions);
        if (region && region === teamRegion(seats[j][0].school, regions) && seats[i][1].k[0] === seats[j][1].k[0]) regional++;
        if (seats[i][0].grp !== seats[j][0].grp) continue;
        const k = seats[i][1].k, l = seats[j][1].k;
        c += k[0] === l[0] ? W[0] : k[1] === l[1] ? W[1] : k[2] === l[2] ? W[2] : 0;
      }
      return c * 1000 + regional; // 재대결 회피를 우선하고, 같은 조건이면 같은 지역 대결을 줄임
    };
    let best = null, bestC = Infinity;
    for (let r = 0; r < 60; r++) {
      const a = shuffle(ones.slice()), b = shuffle(twos.slice());
      let c = cost(a, b), improved = true;
      while (improved) {
        improved = false;
        for (const arr of [a, b]) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
          [arr[i], arr[j]] = [arr[j], arr[i]];
          const c2 = cost(a, b);
          if (c2 < c) { c = c2; improved = true; } else [arr[i], arr[j]] = [arr[j], arr[i]];
        }
      }
      if (c < bestC) { bestC = c; best = { a: a.slice(), b: b.slice() }; }
      if (bestC === 0) break;
    }
    return { seats: [...best.a.map((t, i) => ({ ...s1[i], team: t })), ...best.b.map((t, i) => ({ ...s2[i], team: t }))], cost: Math.floor(bestC / 1000), regionPairs: bestC % 1000 };
  }
  const seatLabel = (div, seat) => div === "중등부" ? "32강 " + seat.grp + "조 " + seat.seed + "번 (" + (seat.seed % 2 ? "1위 자리" : "2위 자리") + ")"
    : (seat.seed <= 8 ? "1위 자리 " + "ABCDEFGH"[seat.seed - 1] : "2위 자리 " + "ABCDEFGH"[seat.seed - 9]);

  async function openAdvance(div, slots, stand, matches, reload, regions = {}, stage = FIRST_STAGE[div]) {
    if (div !== "중등부" || stage !== "64강") { toast("32강 → 본선은 조 순위에 따라 고정 대진으로 자동 연결됩니다"); return; }
    const ad = computeAdvance(div, slots, stand, matches, stage);
    const target = stage === "64강" ? "32강" : "본선 진출";
    const toGroups = target === "32강";
    const dlg = el("dialog", "rdlg");
    dlg.setAttribute("aria-label", div + " 진출 팀 배정");
    const close = () => { dlg.close(); dlg.remove(); };
    const pickR = new Set(ad.runners.slice(0, ad.promoteN).map(x => x.school));
    const pickT = new Set(ad.thirds.slice(0, ad.thirdN).map(x => x.school));
    const body = el("div");
    let placed = null;
    const timeLine = x => (x.time >= 0 ? "+" : "") + (x.time / 60).toFixed(1) + "분" + (x.noTime ? " ⚠시간 " + x.noTime + "경기 비어 있음" : "");
    function pickList(title, list, picked, need, line) {
      const box = el("div", "adv-list");
      box.append(el("h4", "", title + " — " + need + "팀 선택 (" + picked.size + "/" + need + ")"));
      list.forEach((x, i) => {
        const l = el("label", "slot-row" + (picked.has(x.school) ? " adv-on" : ""));
        const cb = el("input"); cb.type = "checkbox"; cb.checked = picked.has(x.school);
        cb.addEventListener("change", () => { cb.checked ? picked.add(x.school) : picked.delete(x.school); placed = null; draw(); });
        l.append(cb, el("span", "", (i + 1) + ". " + drawSchoolLabel(x.school, regions) + " (" + x.grp + "조 " + x.size + "팀)"), el("span", "slot-st", line(x) + " · 시간 점수 " + timeLine(x)));
        box.append(l);
      });
      return box;
    }
    function draw() {
      body.replaceChildren();
      body.append(el("p", "note", div + " " + ad.stage + " 각 조 1·2위만 진출합니다. 3위 승급은 없습니다. 조 1위는 1위 자리, 조 2위는 2위 자리로 배정합니다."));
      ad.problems.forEach(t => body.append(el("p", "rdlg-err", t)));
      if (ad.tieR || ad.tieT) body.append(el("p", "rdlg-err", "자르는 선에 같은 성적인 팀이 있습니다(" + [ad.tieR && "2위", ad.tieT && "3위"].filter(Boolean).join("·") + "). 규정에 따라 직접 골라 주세요."));
      if (ad.missing.length) body.append(el("p", "rdlg-err", "경기 시간이 비어 있는 팀: " + ad.missing.join(", ") + " — 경기 결과 표에 시간을 넣으면 더 정확합니다."));
      if (ad.problems.length) return;
      if (ad.promoteN) body.append(pickList("잘한 2위 → 1위 자리", ad.runners, pickR, ad.promoteN, x => "승률 " + Math.round(x.rate * 100) + "% (" + x.wins + "/" + x.games + ")"));
      if (ad.thirdN) body.append(pickList("잘한 3위 → 2위 자리", ad.thirds, pickT, ad.thirdN, x => x.wins + "승"));
      if (pickR.size !== ad.promoteN || pickT.size !== ad.thirdN) { body.append(el("p", "rdlg-err", "선택한 팀 수를 맞춰 주세요.")); return; }
      const ones = [...ad.firsts, ...ad.runners.filter(x => pickR.has(x.school))];
      const twos = [...ad.runners.filter(x => !pickR.has(x.school)), ...ad.thirds.filter(x => pickT.has(x.school))];
      placed = placed || assignSeats(div, ones, twos, regions, stage);
      body.append(el("p", "note", "같은 조 출신의 재대결 회피를 우선하고 같은 지역 대결을 최대한 줄였습니다. 같은 지역 " + (toGroups ? "조별 대결 " : "본선 1라운드 대결 ") + placed.regionPairs + "쌍"));
      body.append(el("h4", "", "배정 결과 " + (placed.cost === 0 ? "· 같은 조 출신끼리 일찍 만나는 경우 없음" : placed.cost < 100 ? "· 같은 조 출신은 같은 절반에만 일부 (1라운드 재대결 없음)" : "· ⚠ 같은 조 출신이 일찍 만날 수 있음")));
      const wrap = el("div", "slot-grid");
      const groupsOut = {};
      placed.seats.forEach(x => { const k = toGroups ? "32강 " + x.grp + "조" : (x.seed <= 8 ? "1위 자리" : "2위 자리"); (groupsOut[k] = groupsOut[k] || []).push(x); });
      Object.entries(groupsOut).forEach(([k, list]) => {
        const c = el("div", "slot-card");
        c.append(el("h4", "", k));
        list.sort((a, b) => a.seed - b.seed).forEach(x => {
          const r = el("div", "slot-row");
          r.append(el("span", "slot-no", toGroups ? x.seed + "번" : "ABCDEFGH"[(x.seed - 1) % 8]), el("span", "", drawSchoolLabel(x.team.school, regions)), el("span", "slot-st", x.team.grp + "조 " + x.team.rank + "위"));
          c.append(r);
        });
        wrap.append(c);
      });
      body.append(wrap);
    }
    const btns = el("div", "rdlg-btns");
    const again = el("button", "btn ghost", "다시 배정"); again.type = "button";
    again.addEventListener("click", () => { placed = null; draw(); });
    const cancel = el("button", "btn ghost", "닫기"); cancel.type = "button"; cancel.addEventListener("click", close);
    const ok = el("button", "btn", "이대로 저장"); ok.type = "button";
    ok.addEventListener("click", async () => {
      if (!placed) { toast("배정 결과가 없습니다", true); return; }
      if (matches.some(m => m.stage === (toGroups ? "32강" : "본선") && (m.score1 != null || m.score2 != null || m.winner))) { toast("다음 단계에 경기 결과가 있어 재배정할 수 없습니다", true); return; }
      if (placed.seats.some(x => !slots.some(y => y.stage === target && y.grp === x.grp && y.seed === x.seed))) { toast("배정할 자리가 부족합니다. 새로고침 후 다시 확인해 주세요", true); return; }
      const filled = slots.filter(x => x.stage === target && x.school).length;
      if (filled && !confirm(target + " 자리에 이미 학교 " + filled + "개가 있습니다. 이 결과로 바꿀까요?")) return;
      ok.disabled = true;
      for (const x of placed.seats) {
        const slot = slots.find(y => y.stage === target && y.grp === x.grp && y.seed === x.seed);
        if (!slot) continue;
        const { error } = await sb.from("league_slots").update({ school: x.team.school, final_rank: null }).eq("id", slot.id);
        if (error) { toast("저장 실패: " + error.message, true); ok.disabled = false; return; }
      }
      toast("진출 팀을 배정했습니다");
      close(); reload();
    });
    btns.append(again, cancel, ok);
    dlg.append(el("h3", "", div + " 진출 팀 배정 (" + ad.stage + " → " + (toGroups ? "32강" : "본선") + ")"), body, btns);
    document.body.append(dlg);
    draw();
    dlg.showModal();
  }

  // 기권 예상 학교 (교사 전용 표 forfeit_watch, 관리자만 표시·해제): 조 편성 때 3팀 조 제외, 4팀 조에 고르게
  async function loadRisky(div) {
    const { data } = await sb.from("forfeit_watch").select("*").eq("division", div).order("created_at");
    return data || [];
  }
  function riskEditor(div, teams, list, onChange) {
    const box = el("div", "risk-box");
    box.append(el("b", "", "⚠ 기권 예상 학교 " + list.length + "개"), el("span", "note", " 연락 두절 등 · 교사만 보임 · 3팀 조에는 넣지 않고 4팀 조에 한 조 1개씩(많으면 최대 2개)"));
    const chips = el("div", "todo-row");
    list.forEach(x => {
      const c = el("span", "todo-chip t-dupe", shortSchool(x.school) + (x.note ? " · " + x.note : ""));
      if (isOwner()) {
        const del = el("button", "risk-del", "✕"); del.type = "button"; del.setAttribute("aria-label", x.school + " 기권 예상 해제");
        del.addEventListener("click", async () => { if (await save(sb.from("forfeit_watch").delete().eq("id", x.id), "해제했습니다")) onChange(); });
        c.append(del);
      }
      chips.append(c);
    });
    if (isOwner()) {
      const sel = el("select");
      sel.setAttribute("aria-label", "기권 예상 학교 추가");
      const o0 = el("option", "", "+ 학교 추가"); o0.value = ""; sel.append(o0);
      teams.filter(t => !list.some(x => normSchool(x.school) === normSchool(t))).sort((a, b) => a.localeCompare(b, "ko"))
        .forEach(t => { const o = el("option", "", t); o.value = t; sel.append(o); });
      sel.addEventListener("change", async () => {
        if (!sel.value) return;
        const note = prompt(sel.value + "을(를) 기권 예상으로 표시합니다. 사유(선택, 예: 연락 두절)", "연락 두절");
        if (note === null) { sel.value = ""; return; }
        if (await save(sb.from("forfeit_watch").insert({ division: div, school: sel.value, note: note.trim() || null }), "기권 예상으로 표시했습니다")) onChange();
        else sel.value = "";
      });
      chips.append(sel);
    }
    box.append(chips);
    return box;
  }

  // 편성 대상: 확인 사항(중복 신청 등)이 없는 확정 팀만, 상위 5명 평균 티어 순(티어 없는 팀은 맨 뒤)
  async function drawTeams(div, ros) {
    const strength = await teamStrength(div);
    const pending = ros.filter(x => String(x.data["확인 사항"] || "").trim()).map(x => x.data["학교 이름"]);
    const names = [...new Set(ros.filter(x => !String(x.data["확인 사항"] || "").trim()).map(x => String(x.data["학교 이름"] || "").trim()).filter(Boolean))];
    const ranked = names.map(n => ({ n, s: strength[normSchool(n)] })).sort((a, b) => (a.s == null) - (b.s == null) || (a.s ?? 0) - (b.s ?? 0) || a.n.localeCompare(b.n, "ko"));
    return { ranked, teams: ranked.map(x => x.n), pending, regions: drawRegions(ros) };
  }
  async function openDraw(div, slots, ros, reload) {
    const stage = FIRST_STAGE[div];
    const { teams, pending, regions } = await drawTeams(div, ros);
    const groups = groupsFor(div, teams.length);
    const dlg = el("dialog", "rdlg");
    dlg.setAttribute("aria-label", div + " 자동 조 편성");
    const close = () => { dlg.close(); dlg.remove(); };
    let riskList = await loadRisky(div);
    const riskSet = () => new Set(teams.filter(t => riskList.some(x => normSchool(x.school) === normSchool(t))));
    let drawn = drawGroups(teams, groups, riskSet(), regions), result = drawn.result;
    const body = el("div");
    function draw() {
      body.replaceChildren();
      const rs = riskSet();
      body.append(riskEditor(div, teams, riskList, async () => { riskList = await loadRisky(div); drawn = drawGroups(teams, groups, riskSet(), regions); result = drawn.result; draw(); }));
      const n4 = groups.filter(g => result[g].filter(Boolean).length === 4).length;
      const n3 = groups.filter(g => result[g].filter(Boolean).length === 3).length;
      const n2 = groups.filter(g => result[g].filter(Boolean).length <= 2).length;
      body.append(el("p", "note", div + " " + teams.length + "팀 → " + groups.length + "개 조 (4팀 조 " + n4 + " · 3팀 조 " + n3 + (n2 ? " · 2팀 이하 조 " + n2 : "") + ")" +
        " · 포트 = 상위 5명 평균 티어 순위 " + groups.length + "팀씩, 티어 없는 팀은 마지막 포트 · " + drawRangeText(drawn) + drawRiskText(drawn) + drawRegionText(drawn)));
      if (pending.length) body.append(el("p", "rdlg-err", "중복 신청 확인 중이라 빠진 학교: " + pending.join(", ") + " — 확정 후 다시 편성하거나 직접 넣어 주세요."));
      if (teams.length > groups.length * 4) body.append(el("p", "rdlg-err", "팀이 " + groups.length * 4 + "팀보다 많아 " + (teams.length - groups.length * 4) + "팀이 들어가지 못했습니다. 조 수를 늘려야 합니다."));
      const wrap = el("div", "slot-grid");
      groups.forEach(g => {
        const c = el("div", "slot-card");
        c.append(el("h4", "", stage + " " + g + "조"));
        for (let i = 0; i < 4; i++) {
          const t = result[g][i];
          const row = el("div", "slot-row");
          row.append(el("span", "slot-no", (i + 1) + "번"), el("span", "", drawSchoolLabel(t, regions) || "— (빈 자리)"));
          if (t && rs.has(t)) row.append(el("small", "risk-tag", "⚠ 기권 예상"));
          c.append(row);
        }
        wrap.append(c);
      });
      body.append(wrap);
    }
    const btns = el("div", "rdlg-btns");
    const again = el("button", "btn ghost", "다시 뽑기"); again.type = "button";
    again.addEventListener("click", () => { drawn = drawGroups(teams, groups, riskSet(), regions); result = drawn.result; draw(); });
    const cancel = el("button", "btn ghost", "닫기"); cancel.type = "button"; cancel.addEventListener("click", close);
    const ok = el("button", "btn", "이대로 저장"); ok.type = "button";
    ok.addEventListener("click", async () => {
      const filled = slots.filter(s => s.stage === stage && s.school).length;
      if (filled && !confirm("지금 조 편성에 학교 " + filled + "개가 들어 있습니다. 모두 이 결과로 바꿀까요?")) return;
      ok.disabled = true;
      for (const s of slots.filter(x => x.stage === stage)) {
        const v = result[s.grp] && result[s.grp][s.seed - 1] || null;
        if ((s.school || null) !== v || s.final_rank) {
          const { error } = await sb.from("league_slots").update({ school: v, final_rank: null }).eq("id", s.id);
          if (error) { toast("저장 실패: " + error.message, true); ok.disabled = false; return; }
        }
      }
      // 중등 64강: 실제 조 수에 맞춰 14:00 / 18:00 회차를 반씩 나눔
      if (div === "중등부") { const { data: split } = await sb.rpc("rebalance_first_stage_sessions", { p_div: div }); if (split) toast("조 편성을 저장했습니다 · 회차 " + split); else toast("조 편성을 저장했습니다"); }
      else toast("조 편성을 저장했습니다");
      close(); reload();
    });
    btns.append(again, cancel, ok);
    dlg.append(el("h3", "", div + " " + stage + " 자동 조 편성 (미리 보기)"), body, btns);
    document.body.append(dlg);
    draw();
    dlg.showModal();
  }

  // 예상 조 편성 (관리자 전용): 지금까지 확정된 팀으로 미리 뽑아 보기만 함 — 실제 조 편성(league_slots)에는 저장하지 않음
  let previewDiv = "중등부";
  async function loadDrawPreview(box) {
    box.replaceChildren(el("p", "note", "불러오는 중…"));
    const div = previewDiv, stage = FIRST_STAGE[div];
    const { data: ros } = await sb.from("sheet_rows").select("data").eq("sheet", div === "중등부" ? "roster_middle" : "roster_high");
    const { ranked, teams, pending, regions } = await drawTeams(div, ros || []);
    const groups = groupsFor(div, teams.length);
    const info = new Map(ranked.map((x, i) => [x.n, { rank: x.s == null ? null : i + 1, avg: x.s }]));
    const riskList = await loadRisky(div);
    const rs = new Set(teams.filter(t => riskList.some(x => normSchool(x.school) === normSchool(t))));
    box.replaceChildren();
    const sw = el("div", "div-switch");
    ["중등부", "고등부"].forEach(d => {
      const b = el("button", "chip", d);
      b.type = "button";
      b.setAttribute("aria-pressed", d === div);
      b.addEventListener("click", () => { previewDiv = d; loadDrawPreview(box); });
      sw.append(b);
    });
    const again = el("button", "btn small", "다시 뽑기");
    again.type = "button";
    const head = el("div", "slot-head");
    head.append(sw, again);
    const body = el("div");
    box.append(head, el("p", "note", "⚠️ 미리 보기 전용입니다. 실제 조 편성·대진표·학생 화면에는 저장되지 않습니다. 실제 편성은 '대진·경기 결과' 탭의 '자동 조 편성'에서 합니다."), riskEditor(div, teams, riskList, () => loadDrawPreview(box)), body);
    function draw() {
      const drawn = drawGroups(teams, groups, rs, regions), result = drawn.result;
      body.replaceChildren();
      const size = g => result[g].filter(Boolean).length;
      const n4 = groups.filter(g => size(g) === 4).length, n3 = groups.filter(g => size(g) === 3).length, n2 = groups.filter(g => size(g) <= 2).length;
      body.append(el("p", "note", div + " 확정 " + teams.length + "팀 → " + stage + " " + groups.length + "개 조 (4팀 조 " + n4 + " · 3팀 조 " + n3 + (n2 ? " · 2팀 이하 조 " + n2 : "") + ")" +
        " · 1~4시드 = 상위 5명 평균 티어 순위로 " + groups.length + "팀씩, 시드마다 조는 무작위 · " + drawRangeText(drawn) + drawRiskText(drawn) + drawRegionText(drawn)));
      if (pending.length) body.append(el("p", "rdlg-err", "아직 확정되지 않아 빠진 학교(확인 사항 있음): " + pending.join(", ")));
      if (teams.length > groups.length * 4) body.append(el("p", "rdlg-err", "팀이 " + groups.length * 4 + "팀보다 많아 " + (teams.length - groups.length * 4) + "팀이 들어가지 못했습니다."));
      const wrap = el("div", "slot-grid");
      groups.forEach(g => {
        const c = el("div", "slot-card");
        // 조 이름 옆에 시드 사이 순위 차이 (예: 차이 16·14·17)
        const ranks = result[g].filter(Boolean).map(t => info.get(t)).map(x => x && x.rank).filter(Boolean);
        const gaps = ranks.slice(1).map((r, i) => r - ranks[i]);
        c.append(el("h4", "", stage + " " + g + "조" + (gaps.length ? " · 차이 " + gaps.join("·") : "")));
        for (let i = 0; i < 4; i++) {
          const t = result[g][i], x = t && info.get(t);
          const row = el("div", "slot-row");
          row.append(el("span", "slot-no", (i + 1) + "시드"), el("span", t ? "" : "ph", drawSchoolLabel(t, regions) || "— (빈 자리)"));
          if (x) row.append(el("span", "slot-st", x.rank ? "티어 " + x.rank + "위 · " + x.avg.toFixed(2) : "티어 미입력"));
          if (t && rs.has(t)) row.append(el("small", "risk-tag", "⚠ 기권 예상"));
          c.append(row);
        }
        wrap.append(c);
      });
      body.append(wrap);
    }
    again.addEventListener("click", draw);
    draw();
  }

  let matchDiv = "중등부";
  let slotStage = { 중등부: "64강", 고등부: "32강" };
  const matchPick = ["", ""]; // 다시 불러와도 단계·조 필터 유지
  async function loadMatches(box) {
    const [{ data: rows, error }, { data: slots }, { data: stand }, { data: ros }, { data: sessions }, { data: avail }, staff] = await Promise.all([
      sb.from("matches").select("*").eq("division", matchDiv).order("sort").order("match_no"),
      sb.from("league_slots").select("*").eq("division", matchDiv).order("grp").order("seed"),
      sb.rpc("public_standings"),
      sb.from("sheet_rows").select("data").eq("sheet", matchDiv === "중등부" ? "roster_middle" : "roster_high"),
      sb.from("ref_sessions").select("*").order("day").order("start_time").order("sort"),
      sb.from("ref_avail").select("*").eq("available", true),
      fetchStaff()
    ]);
    box.replaceChildren();
    if (error) { box.append(el("p", "note", "불러오지 못했습니다.")); return; }
    loadPublicBracket();
    const reload = () => loadMatches(box);
    const regions = drawRegions(ros);
    const sessById = Object.fromEntries((sessions || []).map(s => [s.id, s]));

    const sw = el("div", "div-switch");
    ["중등부", "고등부"].forEach(d => {
      const b = el("button", "chip", d);
      b.type = "button";
      b.setAttribute("aria-pressed", d === matchDiv);
      b.addEventListener("click", () => { matchDiv = d; reload(); });
      sw.append(b);
    });
    box.append(sw, el("p", "note", "① " + FIRST_STAGE[matchDiv] + " 조 편성(관리자 '자동 조 편성', 조 수 = 팀 수 ÷ 4 올림)으로 경기 칸이 채워집니다. ② 조별리그는 1·2경기 동시 시작, 3·4경기 +1시간, 5·6경기 +2시간입니다. 승자와 경기 시간(분:초)을 입력하면 조 순위가 계산됩니다. " +
      "③ 각 조 1·2위만 진출하며 3위 승급은 없습니다. 중등 64강 → 32강만 관리자가 '진출 팀 배정'을 눌러 미리보기 후 저장합니다. ④ 중등·고등 32강 → 본선은 A조1위 vs B조2위처럼 고정 대진으로 자동 연결됩니다. 장로: A1-B2·C1-D2·E1-F2·G1-H2, 바론: B1-A2·D1-C2·F1-E2·H1-G2. 본선 이후도 점수를 넣으면 자동으로 이어집니다."));

    // 1) 조 편성 + 조별 순위 (단계 고르기)
    const stages = matchDiv === "중등부" ? ["64강", "32강", "4강 리그"] : ["32강", "4강 리그"];
    if (!stages.includes(slotStage[matchDiv])) slotStage[matchDiv] = stages[0];
    const stage = slotStage[matchDiv];
    const editable = stage === FIRST_STAGE[matchDiv]; // 첫 단계만 직접 편성, 나머지는 앞 단계 결과로 자동
    const schools = [...new Set((ros || []).map(x => x.data["학교 이름"]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
    const dl = el("datalist"); dl.id = "slotSchools";
    schools.forEach(s => { const o = el("option"); o.value = s; dl.append(o); });
    const used = {};
    (slots || []).filter(s => s.stage === stage).forEach(s => { if (s.school) used[normSchool(s.school)] = (used[normSchool(s.school)] || 0) + 1; });
    const sec = el("div", "card");
    const head = el("div", "slot-head");
    head.append(el("h3", "", "조 편성 · 조별 순위 (" + matchDiv + ")"));
    const ssw = el("div", "div-switch");
    stages.forEach(st => {
      const b = el("button", "chip", st);
      b.type = "button";
      b.setAttribute("aria-pressed", st === stage);
      b.addEventListener("click", () => { slotStage[matchDiv] = st; reload(); });
      ssw.append(b);
    });
    head.append(ssw);
    if (isOwner() && (stage === "64강" || stage === "32강")) {
      const withdraw = el("button", "btn ghost small", "조별 기권 처리");
      withdraw.type = "button";
      withdraw.addEventListener("click", () => {
        const dlg = el("dialog", "score-editor"), select = el("select"), cancel = el("button", "btn ghost small", "취소"), apply = el("button", "btn small", "남은 경기 부전승 처리");
        const candidates = (slots || []).filter(s => s.stage === stage && s.school).sort((a,b) => a.school.localeCompare(b.school,"ko"));
        const first = el("option", "", "기권 학교 선택"); first.value = ""; select.append(first);
        candidates.forEach(s => { const o = el("option", "", s.grp + "조 · " + s.school); o.value = s.school; select.append(o); });
        const info = el("p", "note", "완료된 결과는 유지합니다. 진행 중인 경기가 있다면 먼저 결과를 입력해 주세요. 기권 학교의 이 단계 미완료 경기만 상대 팀 1:0 부전승으로 처리합니다. 경기 시간은 기록하지 않습니다.");
        cancel.type = apply.type = "button";
        cancel.addEventListener("click", () => dlg.close());
        apply.addEventListener("click", async () => {
          if (!select.value) return;
          const pending = rows.filter(m => m.stage === stage && !m.winner && m.team1 && m.team2 && [m.team1,m.team2].includes(select.value));
          if (!pending.length) { toast("처리할 미완료 경기가 없습니다."); return; }
          if (!confirm(select.value + "의 " + stage + " 미완료 " + pending.length + "경기를 상대 팀 부전승으로 처리할까요?\n이미 끝난 경기와 조 편성은 유지됩니다. 처리 전 기록은 DB에 백업됩니다.")) return;
          apply.disabled = true;
          if (await save(sb.rpc("withdraw_group_team", { p_div: matchDiv, p_stage: stage, p_school: select.value, p_expected: pending.map(m => m.id) }), "기권 처리했습니다")) { dlg.close(); reload(); }
          else apply.disabled = false;
        });
        dlg.append(el("h3", "", "조별 기권 처리 · " + stage), info, select, cancel, apply);
        dlg.addEventListener("close", () => dlg.remove()); document.body.append(dlg); dlg.showModal();
      });
      head.append(withdraw);
    }
    if (editable && isOwner()) {
      const auto = el("button", "btn small", "자동 조 편성");
      auto.type = "button";
      auto.addEventListener("click", () => openDraw(matchDiv, slots || [], ros || [], reload));
      head.append(auto);
    }
    if (isOwner()) for (const sourceStage of (matchDiv === "중등부" ? ["64강"] : [])) {
      const adv = el("button", "btn ghost small", "진출 팀 배정 (" + sourceStage + " → " + (sourceStage === "64강" ? "32강" : "본선") + ")");
      adv.type = "button";
      adv.addEventListener("click", () => openAdvance(matchDiv, slots || [], stand || [], rows, reload, regions, sourceStage));
      head.append(adv);
    }
    sec.append(head, dl);
    const placed = (slots || []).filter(s => s.stage === stage && s.school).length;
    sec.append(el("p", "note", editable
      ? "참가 학교 " + schools.length + "개 중 " + placed + "개 배정 · 3팀 조는 4번 자리를 비워 두면 그 자리 경기는 자동으로 빠집니다." + (isOwner() ? "" : " 자동 조 편성은 관리자만 할 수 있습니다.")
      : stage === "4강 리그" ? "본선 결과로 자동으로 채워집니다." : "앞 단계가 끝난 뒤 관리자가 '진출 팀 배정'으로 채웁니다."));
    sec.append(el("p", "note", "리그 순위: 승수 → 2팀 동률은 승자승. 3팀 이상 동률은 (패배 시간 합 − 승리 시간 합) ÷ 실제 경기 수가 큰 팀 우선. 부전승은 시간에서 제외합니다. 시간 점수까지 2팀 동률이면 승자승, 필요한 시간 누락·3팀 이상 최종 동률은 확인 후 직접 지정합니다."));
    const gwrap = el("div", "slot-grid");
    const usedGroups = new Set((slots || []).filter(s => s.stage === stage && s.school).map(s => s.grp));
    if (editable) sec.append(el("p", "note", usedGroups.size === MAX_GROUPS[matchDiv]
      ? usedGroups.size + "개 조가 모두 구성되어 각 조 1·2위만 진출합니다. 3위 승급은 없습니다."
      : "첫 예선은 중등 64팀·16개 조, 고등 32팀·8개 조입니다. 각 조 1·2위만 진출하며 3위 추가 승급은 없습니다."));
    STAGE_GROUPS[stage].filter(g => !editable || !usedGroups.size || usedGroups.has(g)).forEach(g => {
      const card = el("div", "slot-card");
      card.append(el("h4", "", stage === "4강 리그" ? "4강 리그" : stage === "본선 진출" ? "본선 진출 자리 (1~8 = 1위 자리 A~H, 9~16 = 2위 자리 A~H)" : stage + " " + g + "조"));
      const st = (stand || []).filter(x => x.division === matchDiv && x.stage === stage && x.grp === g);
      const rankOf = s => st.find(y => y.seed === s.seed);
      (slots || []).filter(s => s.stage === stage && s.grp === g).forEach(s => {
        const row = el("div", "slot-row");
        const x = rankOf(s);
        row.append(el("span", "slot-no", s.seed + "번"));
        if (isEditor() && editable) {
          const i = el("input", "cell" + (s.school && used[normSchool(s.school)] > 1 ? " dupe" : ""));
          i.value = s.school || ""; i.setAttribute("list", "slotSchools"); i.placeholder = s.seed === 4 ? "(3팀 조면 비움)" : "학교 이름"; i.size = 12;
          i.setAttribute("aria-label", stage + " " + g + "조 " + s.seed + "번 학교");
          i.addEventListener("change", async () => { if (await save(sb.from("league_slots").update({ school: i.value.trim() || null }).eq("id", s.id))) reload(); });
          row.append(i);
          if (teamRegion(s.school, regions)) row.append(el("small", "slot-st", "(" + teamRegion(s.school, regions) + ")"));
        } else row.append(el("span", s.school ? "" : "ph", drawSchoolLabel(s.school, regions) || "(" + (s.src ? srcText(s.src, rows) : seatLabel(matchDiv, s)) + ")"));
        row.append(el("span", "slot-st" + (x && x.rank && x.rank <= 2 ? " up" : ""), x ? (x.rank ? x.rank + "위 · " : "") + x.wins + "승 " + x.losses + "패" : ""));
        if (s.school && used[normSchool(s.school)] > 1) row.append(el("small", "rec-warn", "다른 조와 중복"));
        card.append(row);
      });
      // 동률이면 순위를 직접 지정 (학교가 있는 자리 모두 지정해야 적용)
      const complete = st.length && st[0].complete;
      const tie = complete && st.some(x => !x.rank);
      const manual = (slots || []).some(s => s.stage === stage && s.grp === g && s.final_rank);
      if (isEditor() && st.length) {
        const d = el("details", "score-editor");
        d.open = tie;
        d.append(el("summary", tie ? "dupe" : "", tie ? "경기 시간 누락·최종 동률 확인 / 순위 직접 지정" : manual ? "순위 직접 지정 중" : "순위 직접 지정"));
        (slots || []).filter(s => s.stage === stage && s.grp === g && s.school).forEach(s => {
          const l = el("label", "slot-row");
          const sel = el("select");
          ["", "1", "2", "3", "4"].forEach(v => { const o = el("option", "", v ? v + "위" : "자동"); o.value = v; sel.append(o); });
          sel.value = s.final_rank ? String(s.final_rank) : "";
          sel.addEventListener("change", async () => { if (await save(sb.from("league_slots").update({ final_rank: sel.value ? Number(sel.value) : null }).eq("id", s.id))) reload(); });
          l.append(el("span", "", drawSchoolLabel(s.school, regions)), sel);
          d.append(l);
        });
        card.append(d);
      }
      gwrap.append(card);
    });
    sec.append(gwrap);
    box.append(sec);

    // 2) 경기 결과 (표). 3팀 조의 빈 자리와 붙는 경기는 숨김
    const emptySeat = new Set((slots || []).filter(s => !s.school && !s.src && (slots || []).some(o => o.stage === s.stage && o.school)).map(s => "G:" + s.stage + ":" + s.grp + ":" + s.seed));
    const shown = rows.filter(r => !emptySeat.has(r.src1) && !emptySeat.has(r.src2));
    // 심판: 그 경기 회차에 '가능'으로 체크한 선생님을 목록 위쪽에
    const avById = {};
    (avail || []).forEach(a => { (avById[a.session_id] = avById[a.session_id] || new Set()).add(a.staff_id); });
    const lists = el("div");
    (sessions || []).forEach(s => {
      const d = el("datalist"); d.id = "refs-" + s.id;
      const ok = staff.filter(x => avById[s.id] && avById[s.id].has(x.id));
      ok.forEach(x => { const o = el("option"); o.value = x.name; o.label = "✔ 이 시간 가능"; d.append(o); });
      staff.filter(x => !ok.includes(x)).forEach(x => { const o = el("option"); o.value = x.name; d.append(o); });
      lists.append(d);
    });
    const dAll = el("datalist"); dAll.id = "refs-all";
    staff.forEach(x => { const o = el("option"); o.value = x.name; dAll.append(o); });
    lists.append(dAll);
    const label = r => (r.stage === "본선" ? r.grp + " · " : "") + r.round_label; // 조별·리그 경기는 이름에 이미 조가 있음
    const teamCol = n => ({
      key: "team" + n, label: "학교" + n,
      readonly: r => !!r["src" + n] || !isEditor(),
      get: r => r["team" + n] || (r["src" + n] ? "(" + srcText(r["src" + n], rows) + ")" : ""),
      cellClass: r => (!r["team" + n] ? "ph" : r.winner ? (r.winner === r["team" + n] ? "win" : "lose") : "")
    });
    const columns = [
      { key: "_stage", label: "단계", readonly: true, get: r => r.stage },
      { key: "_round", label: "경기", readonly: true, get: label },
      { key: "scheduled_at", label: "일시", readonly: r => !!r.session_id || !isEditor(), get: r => r.session_id ? sessText(sessById[r.session_id], r.time_offset_min) : r.scheduled_at },
      teamCol(1), { key: "_region1", label: "지역1", readonly: true, get: r => teamRegion(r.team1, regions) },
      teamCol(2), { key: "_region2", label: "지역2", readonly: true, get: r => teamRegion(r.team2, regions) },
      { key: "winner", label: "승자", get: r => r.winner, cellClass: r => (r.winner ? "win" : ""), cell: (td,r) => matchWinnerCell(td,r,reload) },
      { key: "duration_sec", label: "경기 시간(분:초)", get: r => fmtDur(r.duration_sec) },
      { key: "referee", label: "심판", get: r => r.referee, list: r => (r.session_id ? "refs-" + r.session_id : "refs-all") },
      { key: "note", label: "비고", get: r => r.note }
    ];
    const holder = el("div");
    box.append(el("h3", "bk-sub", "경기 결과 입력"), el("p", "note", "승자 칸에서 해당 경기의 두 학교 중 하나를 선택하면 조 순위와 전체 대진표에 반영됩니다. 일시는 심판 회차에서 자동으로 들어옵니다. '✔ 이 시간 가능'은 해당 회차에 참여 가능한 심판입니다." + (ME.role === "referee" ? " 심판 권한은 승자·경기 시간·심판·비고를 입력할 수 있습니다." : "")), lists, holder);
    grid(holder, {
      columns, rows: shown, exportName: "대진·경기 결과(" + matchDiv + ")",
      canSave: isEditor() || (ME.role === "referee" && ME.status === "approved"),
      filters: [
        { label: "단계", values: matchDiv === "중등부" ? ["64강", "32강", "본선", "4강 리그", "결선"] : ["32강", "본선", "4강 리그", "결선"], get: r => r.stage, initial: matchPick[0], onPick: v => { matchPick[0] = v; } },
        { label: "조·그룹", values: [...(matchDiv === "중등부" ? STAGE_GROUPS["64강"] : STAGE_GROUPS["32강"]), "장로", "바론"], get: r => r.grp || "", initial: matchPick[1], onPick: v => { matchPick[1] = v; } }
      ],
      onSave: async (r, c, v) => {
        let val = typeof v === "string" ? (v.trim() || null) : v;
        if (c.key === "duration_sec" && val != null) {
          val = parseDur(val);
          if (val === undefined) { toast("경기 시간은 28:45처럼 분:초로 적어 주세요", true); return; }
        }
        if (await save(sb.from("matches").update({ [c.key]: val }).eq("id", r.id))) {
          // 점수·학교가 바뀌면 다음 칸이 자동으로 바뀌므로 다시 불러옴
          if (["score1", "score2", "team1", "team2"].includes(c.key)) reload(); else r[c.key] = val;
        }
      }
    });
  }

  // 심판 일정: 경기 회차(날짜·시간)마다 가능한 선생님 체크. 본인 칸만 체크, 관리자는 회차 추가·수정·삭제와 모든 칸 수정
  function matchWinnerCell(td,r,reload) {
    if (ME.status !== "approved" || !(isEditor() || ME.role === "referee")) { td.textContent=r.winner || ""; return; }
    const select=el("select","cell"); select.setAttribute("aria-label",(r.round_label || "경기")+" 승자");
    const empty=el("option","",r.team1 && r.team2 ? "승자 선택" : "대진 확정 후 선택"); empty.value=""; empty.disabled=true; select.append(empty);
    [r.team1,r.team2].filter(Boolean).forEach(team=>{const option=el("option","",team);option.value=team;select.append(option);});
    select.value=r.winner || ""; select.disabled=!r.team1 || !r.team2;
    select.addEventListener("change",async()=>{
      if(![r.team1,r.team2].includes(select.value)) {select.value=r.winner || "";return;}
      select.disabled=true;
      const ok=await save(sb.rpc("select_match_winner",{p_match:r.id,p_winner:select.value,p_team1:r.team1,p_team2:r.team2,p_previous:r.winner || null}),"승자를 저장했습니다");
      if(ok) reload(); else {select.value=r.winner || "";select.disabled=false;}
    }); td.append(select);
  }

  function renderConfirmedRefRota(box, state, reload) {
    const people = state.people || [], sessions = state.sessions || [], entries = state.entries || [];
    const name = id => people.find(p => p.id === id)?.name || "미연결";
    // 색상 계열과 밝기를 함께 나누어 담당자를 구분한다.
    const refColors = ["#d32f2f", "#1565c0", "#fbc02d", "#00845a", "#8e24aa", "#ef6c00", "#00acc1", "#c2185b", "#795548", "#7cb342", "#3949ab", "#f48fb1", "#00838f", "#ff8a65", "#5e35b1", "#a1887f", "#43a047", "#90caf9", "#ad1457", "#c0ca33", "#546e7a", "#ba68c8", "#ffb300", "#00695c", "#e57373", "#4527a0", "#80cbc4", "#6d4c41", "#9e9d24", "#0288d1", "#ec407a", "#455a64"];
    const personColor = (node, id) => {
      const color = refColors[Number(id) - 1] || "hsl(" + ((Number(id) * 137.508) % 360) + " 65% 40%)";
      const rgb = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4) : [0, 0, 0];
      node.style.setProperty("--ref-color", color);
      node.style.setProperty("--ref-ink", .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] > .179 ? "#000000" : "#ffffff");
    };
    let picked = people.some(p => p.id === ME.staffId) ? ME.staffId : null;
    const section = el("div", "ref-confirmed"), chooser = el("div", "ref-person-list"), mine = el("div"), overview = el("div", "ref-rota-grid");
    section.append(el("h3", "bk-sub", "확정 심판 배정표"), el("p", "note", "이름을 누르면 담당 회차와 경기가 같은 색으로 표시됩니다. 아래 참여 가능 응답과는 별개의 확정 배정입니다. 11/8 참석 응답은 기존 표에서 확인하세요."), chooser, mine, overview);
    const refresh = el("button", "btn ghost small", "배정 새로고침"); refresh.type = "button";
    refresh.addEventListener("click", reload); section.insertBefore(refresh, chooser);
    const label = s => s.day.slice(5).replace("-", "/") + " " + s.time + " · " + s.division + " " + s.label;
    const gamesFor = e => (state.matches || []).filter(m => m.session_id === sessions.find(s => s.key === e.session)?.session_id && m.division === sessions.find(s => s.key === e.session)?.division && (e.match_codes || []).includes(m.code));
    function appendGames(holder, e) {
      const games = gamesFor(e);
      if (!games.length) {
        if (e.role === "심판") holder.append(el("p", "note", "세부 경기는 배정 관리자가 지정할 예정입니다."));
        return;
      }
      const list = el("ul", "ref-game-list");
      games.forEach(m => list.append(el("li", "", (m.time || "시간 미정") + " · " + (m.grp ? m.grp + " · " : "") + m.code + " · " + (m.team1 || "진출팀 미정") + " vs " + (m.team2 || "진출팀 미정"))));
      holder.append(list);
    }
    function draw() {
      chooser.replaceChildren(); mine.replaceChildren(); overview.replaceChildren();
      const all = el("button", "btn ghost small", "전체 보기"); all.type = "button"; all.setAttribute("aria-pressed", String(picked === null));
      all.addEventListener("click", () => { picked = null; draw(); }); chooser.append(all);
      people.forEach(p => {
        const b = el("button", "ref-person", p.name + (p.id === ME.staffId ? " (나)" : "")); b.type = "button";
        personColor(b, p.id); b.setAttribute("aria-pressed", String(picked === p.id));
        b.addEventListener("click", () => { picked = p.id; draw(); }); chooser.append(b);
      });
      if (picked !== null) {
        const own = entries.filter(e => e.active && e.staff_id === picked);
        mine.append(el("h4", "", name(picked) + " 담당 일정 · " + own.length + "건"));
        if (!own.length) mine.append(el("p", "note", "현재 확정된 배정이 없습니다."));
        const cards = el("div", "ref-my-rota");
        sessions.forEach(s => own.filter(e => e.session === s.key).forEach(e => {
          const c = el("article", "ref-duty ref-picked"); personColor(c, picked);
          c.append(el("span", "ref-person-tag", name(picked)), el("h4", "", label(s)), el("strong", "", e.role + " · " + e.target)); appendGames(c, e); cards.append(c);
        })); mine.append(cards);
      }
      sessions.forEach(s => {
        const card = el("article", "ref-session-card"); card.append(el("h4", "", label(s)));
        entries.filter(e => e.session === s.key && e.active).forEach(e => {
          const b = el("button", "ref-duty" + (picked === e.staff_id ? " ref-picked" : "")); b.type = "button";
          personColor(b, e.staff_id); b.setAttribute("aria-pressed", String(picked === e.staff_id));
          b.append(el("strong", "ref-person-tag", name(e.staff_id)), el("span", "", e.role + " · " + e.target));
          b.addEventListener("click", () => { picked = e.staff_id; draw(); mine.scrollIntoView({ behavior: "smooth", block: "start" }); }); card.append(b);
        }); overview.append(card);
      });
    }
    draw();
    const guidance = el("section", "ref-role-guide"); guidance.append(el("h3", "bk-sub", "심판 역할"));
    const guideGrid = el("div", "ref-role-guide-grid");
    [
      ["64강·32강 조별리그", ["심판 1명이 1개 조를 담당합니다. 조별 시작 전 사전교육을 진행합니다.", "대진표 위쪽 시드 경기부터 시작합니다.", "먼저 시작한 경기가 인게임에 입장하면, 다음 경기의 밴픽을 시작합니다.", "먼저 끝난 학교는 정각까지 대기하고, 이후 경기는 순서대로 진행합니다."]],
      ["더블 엘리미네이션 · 승자조", ["심판 1명이 4팀을 담당합니다. 위쪽 경기의 밴픽이 끝나면 아래쪽 경기의 밴픽을 시작합니다.", "2라운드는 담당한 1라운드 경기에서 올라온 두 팀을 이어서 담당합니다.", "승자조 결승은 64강 심판에 참여하지 않은 선생님(이의림·이동규·송준엽·강병화)이 담당합니다. 세부 경기는 확정 배정표를 확인하세요."]],
      ["더블 엘리미네이션 · 패자조", ["심판 1명이 1개 팀을 담당합니다.", "1·2라운드 진행 후, 한 사람씩 3라운드와 4라운드를 담당합니다."]],
      ["4강 리그", ["심판 2명이 1개 조(4팀)를 담당합니다.", "두 경기씩 동시에 진행합니다."]]
    ].forEach(([title, items]) => {
      const card = el("article", "ref-role-card"), list = el("ol");
      card.append(el("h4", "", title)); items.forEach(text => list.append(el("li", "", text))); card.append(list); guideGrid.append(card);
    });
    guidance.append(guideGrid);
    section.insertBefore(guidance, section.children[0]);
    section.insertBefore(el("p", "ref-thanks", "학생들의 멋진 경기를 위해 함께해 주시는 심판 선생님들, 진심으로 감사드립니다!"), guidance);
    box.append(section);
    if (!state.can_manage) return;
    const manage = el("details", "ref-rota-manage"); manage.append(el("summary", "", "확정 배정 관리 · 서류용 기록 보기"), el("p", "note", "서류용 취소선과 예비 기록은 보존됩니다. ‘실제 배정’을 켠 항목만 일반 심판에게 표시됩니다. 세부 경기는 이 회차의 경기 중에서 선택하세요. 저장하면 다른 선생님의 확정 배정표에 반영됩니다."));
    sessions.forEach(s => {
      const group = el("details"); group.append(el("summary", "", label(s)));
      entries.filter(e => e.session === s.key).forEach(e => {
        const form = el("form", "ref-edit-entry");
        const source = el("p", "note", "원본 " + e.key + " · " + e.source_text + (e.source_strike ? " · 서류용 취소선" : "") + (e.exception ? " · 실제 배정 예외 적용" : ""));
        const teacherLabel = el("label", "", e.role + " 담당자"), teacher = el("select");
        people.forEach(p => { const o = el("option", "", p.name); o.value = p.id; teacher.append(o); }); teacher.value = e.staff_id; teacherLabel.append(teacher);
        const activeLabel = el("label", "ref-check", ""), active = el("input"); active.type = "checkbox"; active.checked = e.active; activeLabel.append(active, document.createTextNode("실제 배정"));
        const targetLabel = el("label", "", "담당 설명"), target = el("input"); target.type = "text"; target.maxLength = 100; target.value = e.target; targetLabel.append(target);
        const gameDetails = el("details", "ref-edit-games"); gameDetails.append(el("summary", "", "세부 경기 선택"));
        const checks = [];
        (state.matches || []).filter(m => m.session_id === s.session_id && m.division === s.division).forEach(m => {
          const l = el("label", "ref-check"), c = el("input"); c.type = "checkbox"; c.value = m.code; c.checked = (e.match_codes || []).includes(m.code); checks.push(c);
          l.append(c, document.createTextNode((m.time || "") + " · " + m.code + " · " + (m.team1 || "미정") + " vs " + (m.team2 || "미정"))); gameDetails.append(l);
        });
        const submit = el("button", "btn small", "이 배정 저장"); submit.type = "submit";
        form.append(source, teacherLabel, activeLabel, targetLabel, gameDetails, submit);
        form.addEventListener("submit", async event => {
          event.preventDefault(); submit.disabled = true;
          const codes = checks.filter(c => c.checked).map(c => c.value);
          const targetText = codes.length ? target.value.replace(" · 세부 경기 지정 전", "") : target.value;
          const ok = await save(sb.rpc("set_ref_rota_entry", { p_key: e.key, p_staff: Number(teacher.value), p_active: active.checked, p_codes: codes, p_target: targetText, p_revision: state.revision }), "확정 배정을 저장했습니다");
          submit.disabled = false; if (ok) reload();
        }); group.append(form);
      }); manage.append(group);
    }); section.append(manage);
  }

  async function loadReferee(box) {
    const root = box;
    const [staff, { data: sessions, error }, { data: avail, error: availError }, { data: doneRows, error: doneError }, { data: roleRows, error: roleError }, { data: assignments, error: assignmentError }] = await Promise.all([
      fetchStaff(),
      sb.from("ref_sessions").select("*").order("day").order("start_time").order("sort"),
      sb.from("ref_avail").select("*"),
      sb.from("ref_done").select("*"),
      sb.from("ref_role_avail").select("*"),
      sb.from("ref_assignment").select("*")
    ]);
    const done = new Set((doneRows || []).map(d => d.staff_id)); // '입력 완료'를 누른 선생님
    box.replaceChildren();
    if (error || availError || doneError || roleError || assignmentError) { box.append(el("p", "note", "불러오지 못했습니다.")); return; }
    const reload = () => loadReferee(root);
    const rota = await sb.rpc("ref_rota_state");
    if (rota.error) box.append(el("p", "note", "확정 배정표를 불러오지 못했습니다. 새로고침하거나 관리자에게 확인해 주세요."));
    else renderConfirmedRefRota(box, rota.data, reload);
    const availability = el("details", "ref-availability"), availabilityBody = el("div");
    availability.append(el("summary", "", "기존 참여 가능 응답 · 11/8 참석 여부"), availabilityBody); box.append(availability); box = availabilityBody;
    const has = new Set((avail || []).filter(a => a.available).map(a => a.session_id + "|" + a.staff_id));
    const attendance = new Map((avail || []).map(a => [a.session_id + "|" + a.staff_id, a.available]));
    const isFinal = s => s.day === "2026-11-08";
    const rolesFor = s => isFinal(s) ? ["참석/불참"] : ["역할"];
    const choices = new Map((assignments || []).map(x => [x.session_id + "|" + x.staff_id, x]));
    const roles = ["총괄", "기록원", "심판", "불가"];
    const roleHas = new Set((roleRows || []).map(a => a.session_id + "|" + a.staff_id + "|" + a.role));
    const checked = (session, staff, role) => role === "불가" ? attendance.get(session + "|" + staff) === false : role === "심판" ? has.has(session + "|" + staff) : roleHas.has(session + "|" + staff + "|" + role);
    // 심판 명단: '심판가능' 선생님 + 이미 체크한 선생님 + 나 자신(관리자 포함, 긴급 시 투입)
    const refs = staff.filter(s => s.referee_ok || (avail || []).some(a => a.staff_id === s.id) || (roleRows || []).some(a => a.staff_id === s.id) || s.id === ME.staffId);
    const canEdit = s => isOwner() || (ME.staffId && s.id === ME.staffId && !ME.external);
    const sessKey = s => s.day + " " + String(s.start_time).slice(0, 5);
    const sameTime = {};
    (sessions || []).forEach(s => { sameTime[sessKey(s)] = (sameTime[sessKey(s)] || 0) + 1; });
    const wd = d => "일월화수목금토"[new Date(d + "T00:00:00+09:00").getDay()];

    box.append(el("p", "note", isOwner()
      ? "관리자: 모든 선생님 칸을 체크할 수 있고, 아래 '회차 관리'에서 시간·경기·필요 인원을 고치거나 회차를 추가·삭제할 수 있습니다."
      : ME.staffId ? "본인 줄(굵게 표시)만 체크할 수 있습니다. 체크하면 바로 저장됩니다. 가능한 회차를 다 체크했으면 맨 왼쪽 '입력 완료'를 눌러 주세요." : "계정이 지원단 이름과 연결되지 않아 체크할 수 없습니다. 관리자에게 연결을 요청하세요."));
    if (!(sessions || []).length) box.append(el("p", "note", "등록된 경기 회차가 없습니다."));

    box.append(el("p", "note", "회차마다 총괄·기록·심판 중 역할을 선택하면 바로 저장됩니다. 참여하지 못하는 회차는 -를 선택합니다. 기존 복수 역할은 새 역할을 고르기 전까지 보존됩니다. 11/8 결승전은 참석·불참만 선택합니다."));
    const scroller = el("div", "gscroll");
    const table = el("table", "dtable ref ref-equal");
    table.setAttribute("style", "width:" + (290 + (sessions || []).length * 160) + "px");
    const colgroup = el("colgroup");
    ["ref-done-col", "ref-teacher-col", ...(sessions || []).map(() => "ref-session-col")].forEach(cls => colgroup.append(el("col", cls)));
    table.append(colgroup);
    const thead = el("thead");
    const hr = el("tr"), roleHead = el("tr", "ref-role-head");
    const doneHead=el("th", "done-col", "입력 완료"), teacherHead=el("th", "", "선생님");
    doneHead.rowSpan=teacherHead.rowSpan=2; hr.append(doneHead, teacherHead);
    (sessions || []).forEach(s => {
      const th = el("th", "ref-session-head"); th.colSpan = rolesFor(s).length;
      th.append(el("div", "", Number(s.day.slice(5, 7)) + "/" + Number(s.day.slice(8, 10)) + "(" + wd(s.day) + ") " + String(s.start_time).slice(0, 5)), el("small", "", s.label));
      hr.append(th);
      rolesFor(s).forEach((role, i) => roleHead.append(el("th", "ref-role" + (i === 0 ? " ref-group-start" : ""), role)));
    });
    thead.append(hr, roleHead);
    const tb = el("tbody");
    const counts = {};
    (sessions || []).forEach(s => roles.forEach(role => { counts[s.id+"|"+role] = refs.filter(r => checked(s.id,r.id,role)).length; }));
    const foot = el("tr", "sum");
    function drawFoot() {
      const nDone = refs.filter(r => done.has(r.id)).length;
      foot.replaceChildren(el("td", "done-col " + (nDone >= refs.length ? "ok" : "short"), nDone + " / " + refs.length), el("th", "", "가능 / 필요"));
      (sessions || []).forEach(s => rolesFor(s).forEach(role => {
        if (isFinal(s)) {
          const n = refs.filter(r => attendance.get(s.id + "|" + r.id) === true).length;
          const no = refs.filter(r => attendance.get(s.id + "|" + r.id) === false).length;
          const td = el("td", "c"); td.append(el("strong", "", "참석 " + n + "명"), el("div", "state", "불참 " + no + "명 · 미선택 " + (refs.length - n - no) + "명"));
          foot.append(td); return;
        }
        const td = el("td", "c");
        roles.forEach(k => td.append(el("div", "state", (k === "기록원" ? "기록" : k === "불가" ? "-" : k) + " " + counts[s.id+"|"+k] + "명")));
        if (s.needed > 0) td.append(el("div", "state", "필요 심판 " + s.needed + "명"));
        foot.append(td);
      }));
    }

    refs.forEach(r => {
      const tr = el("tr", r.id === ME.staffId ? "me" : "");
      // 맨 왼쪽: 내가 가능한 회차를 다 체크했다는 표시
      const dtd = el("td", "c done-col");
      if (canEdit(r)) {
        const dc = el("input");
        dc.type = "checkbox";
        dc.checked = done.has(r.id);
        dc.setAttribute("aria-label", r.name + " 심판 일정 입력 완료");
        dc.addEventListener("change", async () => {
          const ok = dc.checked
            ? await save(sb.from("ref_done").insert({ staff_id: r.id }), "입력 완료로 표시했습니다")
            : await save(sb.from("ref_done").delete().eq("staff_id", r.id), "입력 완료 표시를 지웠습니다");
          if (!ok) { dc.checked = !dc.checked; return; }
          if (dc.checked) done.add(r.id); else done.delete(r.id);
          tr.classList.toggle("is-done", dc.checked);
          drawFoot();
        });
        dtd.append(dc);
      } else dtd.textContent = done.has(r.id) ? "✔" : "";
      if (done.has(r.id)) tr.classList.add("is-done");
      tr.append(dtd, el("th", "", r.name + (r.school ? " (" + r.school + ")" : "")));
      (sessions || []).forEach(s => rolesFor(s).forEach((role, i) => {
        const td = el("td", "c ref-role" + (i === 0 ? " ref-group-start" : ""));
        if (isFinal(s)) {
          const key = s.id + "|" + r.id, value = attendance.get(key);
          if (canEdit(r)) {
            const select = el("select"); select.setAttribute("aria-label", r.name + " 11/8 결승전 참석 여부");
            [["", "선택"], ["yes", "참석"], ["no", "불참"]].forEach(([v, text]) => { const o = el("option", "", text); o.value = v; if (!v) o.disabled = true; select.append(o); });
            select.value = value === true ? "yes" : value === false ? "no" : "";
            select.addEventListener("change", async () => {
              const previous = attendance.get(key), next = select.value === "yes";
              select.disabled = true;
              const ok = await save(sb.from("ref_avail").upsert({ session_id: s.id, staff_id: r.id, available: next }, { onConflict: "session_id,staff_id" }));
              select.disabled = false;
              if (!ok) { select.value = previous === true ? "yes" : previous === false ? "no" : ""; return; }
              attendance.set(key, next); if (next) has.add(key); else has.delete(key); drawFoot();
            });
            td.append(select);
          } else td.textContent = value === true ? "참석" : value === false ? "불참" : "미선택";
          tr.append(td); return;
        }
        const key = s.id + "|" + r.id, choice = choices.get(key);
        const active = roles.filter(k => k !== "불가" && checked(s.id, r.id, k));
        const selected = choice ? (choice.available ? choice.role : "불가") : (active.length > 1 ? "legacy" : active[0] || (checked(s.id,r.id,"불가") ? "불가" : ""));
        const label = k => k === "기록원" ? "기록" : k === "불가" ? "-" : k;
        if (canEdit(r)) {
          const select = el("select"); select.setAttribute("aria-label", r.name + " " + sessKey(s) + " 역할");
          const empty = el("option", "", "역할 선택"); empty.value = ""; empty.disabled = true; select.append(empty);
          if (selected === "legacy") { const o = el("option", "", "기존: " + active.map(label).join("·")); o.value = "legacy"; o.disabled = true; select.append(o); }
          roles.forEach(k => { const o=el("option", "", label(k)); o.value=k; select.append(o); }); select.value=selected;
          const saveChoice = async (nextRole, nextAvailable) => {
            if (nextAvailable && sameTime[sessKey(s)] > 1) {
              const other=(sessions || []).find(o=>o.id!==s.id && sessKey(o)===sessKey(s) && roles.filter(k=>k!=="불가").some(k=>checked(o.id,r.id,k)));
              if (other && !confirm("같은 시간에 '"+other.label+"'도 참여 가능으로 표시되어 있습니다. 저장할까요?")) { select.value=selected; return; }
            }
            select.disabled=true;
            const ok=await save(sb.rpc("set_ref_assignment", {p_session:s.id,p_staff:r.id,p_role:nextRole,p_available:nextAvailable}));
            select.disabled=false;
            if (!ok) { select.value=selected; return; }
            await reload();
          };
          select.addEventListener("change",()=>saveChoice(select.value,select.value!=="불가"));
          const wrap=el("div", "ref-choice"); wrap.append(select);
          if (selected==="legacy") wrap.append(el("small", "", "기존 복수 역할 · 새 역할 선택 시 정리"));
          td.append(wrap);
        } else td.textContent = selected === "legacy" ? "기존: " + active.map(label).join("·") : selected ? label(selected) : "미선택";
        tr.append(td);
      }));
      tb.append(tr);
    });
    drawFoot();
    tb.append(foot);
    table.append(thead, tb);
    scroller.append(table);
    box.append(scroller);

    if (!isOwner()) return;
    // 관리자: 심판 명단에 선생님 추가 (지원단 명단의 '심판가능' 켜기)
    const others = staff.filter(s => !refs.includes(s));
    if (others.length) {
      const addRow = el("div", "gbar");
      const sel = el("select");
      sel.setAttribute("aria-label", "심판 명단에 추가할 선생님");
      const o0 = el("option", "", "심판 명단에 선생님 추가…"); o0.value = ""; sel.append(o0);
      others.forEach(s => { const o = el("option", "", s.name + (s.school ? " (" + s.school + ")" : "")); o.value = s.id; sel.append(o); });
      sel.addEventListener("change", async () => {
        if (!sel.value) return;
        if (await save(sb.from("staff").update({ referee_ok: true }).eq("id", Number(sel.value)), "심판 명단에 추가했습니다")) reload();
      });
      addRow.append(sel);
      box.append(addRow);
    }
    // 관리자: 회차 관리 (날짜·시간·경기·학생 경기 수·필요 인원, 추가·삭제)
    const holder = el("div");
    box.append(el("h3", "bk-sub", "회차 관리 (관리자)"), el("p", "note", "여기서 바꾼 시간은 대진표 경기 일시와 학생용 '일정' 탭에도 바로 반영됩니다. 회차를 지우면 그 회차의 체크 기록도 지워집니다."), holder);
    grid(holder, {
      columns: [
        { key: "day", label: "날짜(YYYY-MM-DD)", get: r => r.day },
        { key: "start_time", label: "시간(HH:MM)", get: r => String(r.start_time).slice(0, 5) },
        { key: "label", label: "경기", get: r => r.label },
        { key: "student_games", label: "학생 경기 수", get: r => r.student_games },
        { key: "needed", label: "필요 심판", type: "int", get: r => r.needed }
      ],
      rows: sessions || [], filterable: false,
      onSave: async (r, c, v) => {
        let val = typeof v === "string" ? v.trim() : v;
        if (c.key === "day" && !/^\d{4}-\d{2}-\d{2}$/.test(val)) { toast("날짜는 2026-10-24 모양으로 적어 주세요", true); return; }
        if (c.key === "start_time" && !/^\d{1,2}:\d{2}$/.test(val)) { toast("시간은 14:00 모양으로 적어 주세요", true); return; }
        if (c.key === "label" && !val) { toast("경기 이름을 적어 주세요", true); return; }
        if (await save(sb.from("ref_sessions").update({ [c.key]: val === "" ? null : val }).eq("id", r.id))) reload();
      },
      onDelete: async r => { if (await save(sb.from("ref_sessions").delete().eq("id", r.id), "회차를 삭제했습니다")) reload(); },
      onAdd: async () => {
        const last = (sessions || [])[sessions.length - 1];
        const row = { day: last ? last.day : "2026-11-04", start_time: "18:00", label: "새 회차 (경기 이름을 적어 주세요)", needed: 2, sort: (last ? last.sort : 0) + 1 };
        if (await save(sb.from("ref_sessions").insert(row), "회차를 추가했습니다")) reload();
      }
    });
  }


  // 젠지(GGA) 코칭: 날짜별 신청 현황, 학교별 사용 횟수(최대 3회)
  const COACH_SLOTS = {
    weekday: { 1: "19:00~20:20", 2: "20:30~21:50", 3: "22:00~23:20", 4: "23:30~01:00" },
    weekend: { 1: "13:00~14:20", 2: "14:30~15:50", 3: "19:00~20:20", 4: "20:30~21:50", 5: "22:00~23:20", 6: "23:30~01:00" }
  };
  const COACH_TYPES = ["스크림 참관", "라이브 관전", "리플레이 분석"];
  const COACH_STATUS = ["신청", "확정", "완료", "취소"];
  const COACH_LIMIT = 3, SLOT_LIMIT = 6;
  const dayKind = d => { const w = new Date(d + "T00:00:00+09:00").getDay(); return w === 0 || w === 6 ? "weekend" : "weekday"; };
  const slotTime = (d, s) => COACH_SLOTS[dayKind(d)][s] || "";
  const dayLabel = d => d.slice(5).replace("-", "/") + "(" + "일월화수목금토"[new Date(d + "T00:00:00+09:00").getDay()] + ")";

  // 학생용 공개 코칭 일정 (신청자 이름·메모 없이, 취소 제외)
  let coachPick = null; // 고른 코치 (null = 전체, "" = 배정 중)
  async function renderCoachingPublic() {
    const root = document.getElementById("coachRoot");
    if (!root) return;
    const [{ data, error }, { data: syncedAt }] = await Promise.all([sb.rpc("public_coaching"), sb.rpc("public_coaching_synced_at")]);
    root.replaceChildren();
    if (error) { root.append(el("p", "note", "불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.")); return; }
    root.append(el("p", "note", "GGA 공식 배정표 기준으로 10분마다 갱신됩니다." + (syncedAt ? " (마지막 갱신 " + fmtTime(syncedAt) + ")" : "")));
    if (!data.length) { root.append(el("p", "note", "아직 배정된 코칭이 없습니다.")); return; }
    const used = {};
    data.forEach(r => { used[r.school] = (used[r.school] || 0) + 1; });
    const sum = el("div", "card coach-sum");
    sum.append(el("h3", "", "학교별 사용 횟수 (최대 " + COACH_LIMIT + "회)"));
    const chips = el("div", "tier-chips");
    Object.entries(used).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")).forEach(([s, n]) => {
      const c = el("span", "tier-chip" + (n >= COACH_LIMIT ? " spent" : ""));
      c.append(el("b", "", s.replace(/등학교$|학교$/, "")), document.createTextNode(" " + n + "/" + COACH_LIMIT));
      chips.append(c);
    });
    sum.append(chips);
    root.append(sum);
    // 코치 이름 필터: 누르면 그 코치님의 모든 코칭 일정만 보임
    const coaches = {};
    data.forEach(r => { const k = r.coach || ""; coaches[k] = (coaches[k] || 0) + 1; });
    const names = Object.keys(coaches).filter(Boolean).sort((a, b) => a.localeCompare(b, "ko"));
    if (coachPick !== null && !(coachPick in coaches)) coachPick = null;
    const fbox = el("div", "card coach-filter");
    fbox.append(el("h3", "", "담당 코치별 보기"));
    const cats = el("div", "cats");
    const days = el("div");
    const chip = (label, key, n) => {
      const b = el("button", "chip", label + " " + n);
      b.type = "button";
      b.setAttribute("aria-pressed", String(coachPick === key));
      b.addEventListener("click", () => {
        coachPick = key;
        cats.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", String(c === b)));
        drawDays();
      });
      cats.append(b);
    };
    chip("전체", null, data.length);
    names.forEach(n => chip(n + " 코치님", n, coaches[n]));
    if (coaches[""]) chip("배정 중", "", coaches[""]);
    fbox.append(cats);
    root.append(fbox, days);
    drawDays();
    function drawDays() {
      days.replaceChildren();
      const rows = coachPick === null ? data : data.filter(r => (r.coach || "") === coachPick);
      if (coachPick !== null) days.append(el("p", "note", (coachPick ? coachPick + " 코치님" : "배정 중") + " 코칭 일정 " + rows.length + "건"));
      const byDate = {};
      rows.forEach(r => { (byDate[r.session_date] = byDate[r.session_date] || []).push(r); });
      Object.keys(byDate).sort().forEach(d => {
        const sec = el("div", "coach-day");
        sec.append(el("h3", "", dayLabel(d) + " · " + byDate[d].length + "건"));
        const scroller = el("div", "gscroll");
        const t = el("table", "dtable");
        const hr = el("tr");
        ["시간", "학교", "부문", "코칭 유형", "담당 코치", "상태"].forEach(h => hr.append(el("th", "", h)));
        const thead = el("thead"); thead.append(hr);
        const tb = el("tbody");
        byDate[d].forEach(r => {
          const tr = el("tr");
          tr.append(el("td", "", r.slot + "타임 " + slotTime(d, r.slot)), el("td", "", r.school), el("td", "", r.division || ""),
            el("td", "", r.coaching_type), el("td", "", r.coach ? r.coach + " 코치님" : "배정 중"), el("td", "", r.status === "신청" ? "대기" : r.status));
          tb.append(tr);
        });
        t.append(thead, tb);
        scroller.append(t);
        sec.append(scroller);
        days.append(sec);
      });
    }
  }
  renderCoachingPublic();

  async function loadCoaching(box) {
    const { data: rows, error } = await sb.from("coaching_sessions").select("*").order("session_date").order("slot").order("requested_at");
    box.replaceChildren();
    if (error) { box.append(el("p", "note", "불러오지 못했습니다.")); return; }
    renderCoachingPublic();
    // GGA 시트 자동 동기화 상태
    const { data: sync } = await sb.from("app_settings").select("value").eq("key", "gga_sync").maybeSingle();
    const sv = (sync && sync.value) || {};
    const sbar = el("p", "note" + (sv.ok === false ? " sync-bad" : ""));
    sbar.textContent = "GGA 시트 자동 동기화(10분마다): " + (sv.at ? fmtTime(sv.at) + " · " : "") +
      (sv.ok === true ? "정상 · 시트 " + sv.rows + "건, 바뀜 " + sv.updated + ", 추가 " + sv.added + (sv.problems && sv.problems.length ? " · 읽지 못한 줄: " + sv.problems.join(", ") : "")
        : sv.ok === false ? "멈춤 — " + (sv.message || "오류") : "아직 실행 전") +
      ". 담당 코치·상태·유형은 시트 값으로 맞춰지고, 시트에 없는 신청은 메모에 [시트에 없음 · 확인 필요]가 붙습니다(공개 탭에는 안 보임). 취소면 상태를 '취소'로 바꿔 주세요.";
    box.append(sbar);
    const active = rows.filter(r => r.status !== "취소");

    // 1) 학교별 사용 횟수
    const used = {};
    active.forEach(r => { used[r.school] = (used[r.school] || 0) + 1; });
    const sum = el("div", "card coach-sum");
    sum.append(el("h3", "", "학교별 사용 횟수 (취소 제외, 최대 " + COACH_LIMIT + "회)"));
    const chips = el("div", "tier-chips");
    Object.entries(used).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")).forEach(([s, n]) => {
      const c = el("span", "tier-chip" + (n >= COACH_LIMIT ? " spent" : ""));
      c.append(el("b", "", s.replace(/등학교$|학교$/, "")), document.createTextNode(" " + n + "/" + COACH_LIMIT + (n > COACH_LIMIT ? " 초과" : n === COACH_LIMIT ? " 소진" : "")));
      chips.append(c);
    });
    sum.append(chips, el("p", "note", "신청 " + active.length + "건 · " + Object.keys(used).length + "개 학교"));
    box.append(sum);

    // 2) 새 신청 추가 (고치기 권한)
    if (isEditor()) box.append(coachForm(() => loadCoaching(box)));

    // 3) 날짜별 표
    const byDate = {};
    rows.forEach(r => { (byDate[r.session_date] = byDate[r.session_date] || []).push(r); });
    if (!rows.length) box.append(el("p", "note", "아직 기록이 없습니다."));
    Object.keys(byDate).sort().forEach(d => {
      const list = byDate[d];
      const sec = el("div", "coach-day");
      sec.append(el("h3", "", dayLabel(d) + " · " + (dayKind(d) === "weekend" ? "주말 6타임" : "평일 4타임") + " · " + list.filter(r => r.status !== "취소").length + "건"));
      const perSlot = {};
      list.filter(r => r.status !== "취소").forEach(r => { perSlot[r.slot] = (perSlot[r.slot] || 0) + 1; });
      const scroller = el("div", "gscroll");
      const t = el("table", "dtable");
      const hr = el("tr");
      ["타임", "시간", "학교", "부문", "코칭 유형", "담당 코치", "신청자", "상태", "학교 사용", "메모", ""].forEach(h => hr.append(el("th", "", h)));
      const thead = el("thead"); thead.append(hr);
      const tb = el("tbody");
      list.forEach(r => {
        const tr = el("tr", r.status === "취소" ? "coach-cancel" : "");
        const n = used[r.school] || 0;
        const full = perSlot[r.slot] > SLOT_LIMIT;
        tr.append(
          el("td", full ? "dupe" : "", r.slot + "타임" + (full ? " (6팀 초과)" : "")),
          el("td", "", slotTime(d, r.slot)),
          el("td", "", r.school), el("td", "", r.division || ""),
          el("td", "", r.coaching_type)
        );
        const coach = el("td");
        if (isEditor()) {
          const i = el("input", "cell");
          i.value = r.coach || ""; i.size = 6; i.placeholder = "코치 이름";
          i.setAttribute("aria-label", r.school + " 담당 코치");
          i.addEventListener("change", () => save(sb.from("coaching_sessions").update({ coach: i.value.trim() || null }).eq("id", r.id)));
          coach.append(i);
        } else coach.textContent = r.coach || "";
        tr.append(coach, el("td", "", r.applicant || ""));
        const st = el("td");
        if (isEditor()) {
          const s = el("select");
          s.setAttribute("aria-label", r.school + " 상태");
          COACH_STATUS.forEach(v => { const o = el("option", "", v); o.value = v; s.append(o); });
          s.value = r.status;
          s.addEventListener("change", async () => { if (await save(sb.from("coaching_sessions").update({ status: s.value }).eq("id", r.id))) loadCoaching(box); });
          st.append(s);
        } else st.textContent = r.status;
        tr.append(st, el("td", n >= COACH_LIMIT ? "spent-cell" : "", n + "/" + COACH_LIMIT + (n > COACH_LIMIT ? " 초과" : n === COACH_LIMIT ? " 소진" : "")));
        const memo = el("td");
        if (isEditor()) {
          const i = el("input", "cell");
          i.value = r.note || ""; i.size = Math.max(8, Math.min(40, (r.note || "").length + 2));
          i.setAttribute("aria-label", r.school + " 메모");
          i.addEventListener("change", () => save(sb.from("coaching_sessions").update({ note: i.value }).eq("id", r.id)));
          memo.append(i);
        } else memo.textContent = r.note || "";
        const act = el("td");
        if (isEditor()) {
          const del = el("button", "del", "삭제");
          del.type = "button";
          del.addEventListener("click", async () => {
            if (!confirm("'" + r.school + " · " + dayLabel(d) + " " + r.slot + "타임' 코칭 기록을 삭제할까요?\n(취소된 신청은 상태를 '취소'로 바꾸면 기록이 남습니다)")) return;
            if (await save(sb.from("coaching_sessions").delete().eq("id", r.id), "삭제했습니다")) loadCoaching(box);
          });
          act.append(del);
        }
        tr.append(memo, act);
        tb.append(tr);
      });
      t.append(thead, tb);
      scroller.append(t);
      sec.append(scroller);
      box.append(sec);
    });
  }

  function coachForm(done) {
    const f = el("form", "card coach-form");
    f.append(el("h3", "", "코칭 신청 추가"));
    const row = el("div", "coach-fields");
    const field = (label, input) => { const l = el("label", "", label); l.append(input); row.append(l); return input; };
    const school = field("학교", el("input"));
    school.setAttribute("list", "coachSchools"); school.required = true; school.placeholder = "예: 신기중학교";
    const dl = el("datalist"); dl.id = "coachSchools";
    sb.from("sheet_rows").select("sheet,data").in("sheet", ["roster_middle", "roster_high"]).then(({ data }) => {
      [...new Set((data || []).map(x => x.data["학교 이름"]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")).forEach(s => { const o = el("option"); o.value = s; dl.append(o); });
    });
    const date = field("날짜", el("input")); date.type = "date"; date.required = true; date.min = "2026-10-17"; date.max = "2026-11-08";
    const slot = field("타임", el("select"));
    const fillSlots = () => {
      slot.replaceChildren();
      const map = date.value ? COACH_SLOTS[dayKind(date.value)] : COACH_SLOTS.weekend;
      Object.entries(map).forEach(([k, v]) => { const o = el("option", "", k + "타임 " + v); o.value = k; slot.append(o); });
    };
    date.addEventListener("change", fillSlots); fillSlots();
    const type = field("코칭 유형", el("select"));
    COACH_TYPES.forEach(v => { const o = el("option", "", v); o.value = v; type.append(o); });
    const applicant = field("신청자", el("input")); applicant.placeholder = "예: 홍길동 (팀장)";
    const btn = el("button", "btn small", "추가");
    btn.type = "submit";
    f.append(row, dl, btn);
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const name = school.value.trim();
      const division = /고등학교$|고$/.test(name) ? "고등부" : "중등부";
      if (await save(sb.from("coaching_sessions").insert({ school: name, division, session_date: date.value, slot: Number(slot.value), coaching_type: type.value, applicant: applicant.value.trim() || null, requested_at: new Date().toISOString() }), "추가했습니다")) done();
    });
    return f;
  }

  // 경고 조치: 2026-10-19 경기 규정·팀장 교육 최종 통일 (사용자 확정)
  // 주의 2회 = 경고 1회, 누적 경고 1회 라운드 전체 진영 선택 제한 · 2회 밴카드 전체 제한 + 진영 선택 제한 · 3회 실격패, 결승 전 일괄 초기화
  const WARN_STEPS = [
    [1, "해당 라운드 전체 진영 선택 제한"],
    [2, "밴카드 전체 제한 + 진영 선택 제한"],
    [3, "실격패 (해당 날짜의 모든 경기 패배)"]
  ];
  const WARN_KINDS = ["주의", "경고", "세트 패배", "실격"];
  // [구분, 사유, 횟수] — 규정집 조항 기준. 실제 판정은 운영사무국, 발표는 심판장
  const WARN_REASONS = [
    ["주의", "지각 15분 (양 팀장 합의 시 15분까지는 주의 없음)"], ["세트 패배", "지각 20분 – 세트 몰수 및 실격"],
    ["경고", "욕설·폭언·비방, 판정 불복 (제3조)"], ["경고", "GG 외 전체 채팅·인장·이모티콘 (표현 허용 범위)"], ["경고", "퍼즈 2회 이상"],
    ["경고", "심판 지시 없는 게임 중단·무단 일시정지 (제5·8조)"], ["경고", "고의 접속 종료 (제8조)"],
    ["경고", "등록하지 않은 계정 사용 (제6조)"], ["주의", "부적절한 닉네임·변경 요청 불응 (제6·10조)", 1],
    ["경고", "심판·운영사무국 지시 불이행 (제9조)"], ["경고", "스포츠맨십 위반·과도한 도발 (제3조)"],
    ["실격", "심판 허가 없는 경기구역 이탈 (제4조)"], ["실격", "담합·버그 악용 (제7조)"], ["실격", "대리 게임 (제10조)"],
    ["실격", "대회장 흡연 (제4조)"], ["주의", "기타 주의"], ["경고", "기타 경고"]
  ];
  const warnLevel = (warn, caution) => warn + Math.floor(caution / 2);
  const warnAction = n => { if (!n) return ""; const s = WARN_STEPS.filter(([k]) => k <= n).pop(); return s ? s[1] : ""; };
  const warnCls = k => (k === "실격" || k === "세트 패배" ? "dupe" : k === "경고" ? "warn-lv" : "");

  // 팀별 누적표 + 조치 단계 (교사용·학생용 같이 씀). counted(r): 초기화 이후 기록인지
  function warnSummary(rows, counted, resetOn) {
    const per = {};
    rows.filter(counted).forEach(r => {
      const p = per[r.school] = per[r.school] || { school: r.school, division: r.division, warn: 0, caution: 0, set: 0, dq: 0 };
      if (r.kind === "경고") p.warn += r.amount;
      else if (r.kind === "주의") p.caution += r.amount;
      else if (r.kind === "세트 패배") p.set += r.amount;
      else if (r.kind === "실격") p.dq += r.amount;
    });
    const list = Object.values(per).map(p => ({ ...p, level: warnLevel(p.warn, p.caution) }))
      .sort((a, b) => b.dq - a.dq || b.level - a.level || b.set - a.set || b.caution - a.caution || a.school.localeCompare(b.school, "ko"));
    const sum = el("div", "card warn-sum");
    sum.append(el("h3", "", "팀별 누적" + (resetOn ? " (" + resetOn + " 초기화 이후)" : "")));
    if (!list.length) sum.append(el("p", "note", "아직 주의·경고 기록이 없습니다."));
    else {
      const sc = el("div", "gscroll"), t = el("table", "dtable"), hr = el("tr");
      ["학교", "부문", "주의", "경고", "누적 경고(환산)", "누적에 따른 조치", "바로 적용된 조치"].forEach(h => hr.append(el("th", "", h)));
      const th = el("thead"); th.append(hr);
      const tb = el("tbody");
      list.forEach(p => {
        const tr = el("tr");
        const direct = [p.set ? "세트 패배 " + p.set + "회" : "", p.dq ? "실격 " + p.dq + "회" : ""].filter(Boolean).join(" · ");
        tr.append(el("td", "", p.school), el("td", "", p.division), el("td", "", p.caution + "회"), el("td", "", p.warn + "회"),
          el("td", p.level >= 3 ? "dupe" : p.level ? "warn-lv" : "", p.level + "회"),
          el("td", p.level >= 1 ? "dupe" : "", warnAction(p.level) || (p.caution ? "다음 주의 시 경고 1회" : "")),
          el("td", direct ? "dupe" : "", direct));
        tb.append(tr);
      });
      t.append(th, tb); sc.append(t); sum.append(sc);
    }
    const steps = el("details", "score-editor");
    steps.append(el("summary", "", "조치 단계 보기"));
    const ul = el("ul", "warn-steps");
    ul.append(el("li", "", "주의 2회 = 경고 1회"));
    WARN_STEPS.forEach(([k, v]) => ul.append(el("li", "", "누적 경고 " + k + "회: " + v)));
    ul.append(el("li", "", "지각: 15분부터 주의 · 20분부터 세트 몰수 및 실격 (양 팀장 합의 시 15분까지는 주의 없음)"),
      el("li", "", "경기구역 무단 이탈·담합·버그 악용·대리 게임·대회장 흡연은 바로 실격"),
      el("li", "", "누적 경고는 결승 전 일괄 초기화 · 판정 권한은 운영사무국, 발표는 심판장"));
    steps.append(ul);
    sum.append(steps);
    return sum;
  }

  // 학생용 '경고 현황' 탭 (보기 전용, 자세한 내용·기록자 제외)
  async function renderWarningsPublic() {
    const root = document.getElementById("warnRoot");
    if (!root) return;
    const { data, error } = await sb.rpc("public_warnings");
    root.replaceChildren();
    if (error) { root.append(el("p", "note", "불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.")); return; }
    root.append(warnSummary(data, r => r.counted, null));
    if (!data.length) return;
    const sec = el("div", "coach-day");
    sec.append(el("h3", "", "기록 " + data.length + "건"));
    const sc = el("div", "gscroll"), t = el("table", "dtable"), hr = el("tr");
    ["날짜", "학교", "경기", "구분", "횟수", "사유"].forEach(h => hr.append(el("th", "", h)));
    const th = el("thead"); th.append(hr);
    const tb = el("tbody");
    data.forEach(r => {
      const tr = el("tr", r.counted ? "" : "coach-cancel");
      tr.append(el("td", "", r.occurred_on + (r.counted ? "" : " (초기화 전)")), el("td", "", r.school), el("td", "", r.match_label || ""),
        el("td", warnCls(r.kind), r.kind), el("td", "", r.amount + "회"), el("td", "", r.reason));
      tb.append(tr);
    });
    t.append(th, tb); sc.append(t); sec.append(sc);
    root.append(sec);
  }
  renderWarningsPublic();

  async function loadWarnings(box) {
    const [{ data: rows, error }, { data: reset }] = await Promise.all([
      sb.from("team_warnings").select("*").order("occurred_on", { ascending: false }).order("created_at", { ascending: false }),
      sb.from("app_settings").select("value").eq("key", "warn_reset_on").maybeSingle()
    ]);
    box.replaceChildren();
    if (error) { box.append(el("p", "note", "불러오지 못했습니다.")); return; }
    renderWarningsPublic();
    const resetOn = reset && typeof reset.value === "string" ? reset.value : null;
    const counted = r => !resetOn || r.occurred_on > resetOn;
    const canEdit = r => isEditor() || (!ME.external && ME.role !== "referee" && r.recorded_by === ME.id);

    // 1) 학교별 누적 (초기화 이후 기록만)
    const sum = warnSummary(rows, counted, resetOn);
    if (isOwner()) {
      const rb = el("button", "btn ghost small", resetOn ? "초기화 취소 (전체 기록 다시 누적)" : "결승 전 누적 초기화");
      rb.type = "button";
      rb.addEventListener("click", async () => {
        const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
        if (!confirm(resetOn ? "초기화를 취소하고 모든 기록을 다시 누적할까요?" : "오늘(" + today + ")까지의 기록을 누적에서 빼고 새로 셀까요? 기록 자체는 지워지지 않습니다.")) return;
        if (await save(sb.from("app_settings").update({ value: resetOn ? false : today }).eq("key", "warn_reset_on"), resetOn ? "초기화를 취소했습니다" : "누적을 초기화했습니다")) loadWarnings(box);
      });
      sum.append(rb);
    }
    box.append(sum);

    // 2) 기록 추가 (지원단, 외부인 제외)
    if (ME.status === "approved" && !ME.external && ME.role !== "referee") box.append(warnForm(() => loadWarnings(box)));

    // 3) 기록 목록 (자세한 내용·기록자는 교사용에만)
    const sec = el("div", "coach-day");
    sec.append(el("h3", "", "전체 기록 " + rows.length + "건"));
    const sc = el("div", "gscroll"), t = el("table", "dtable"), hr = el("tr");
    ["날짜", "학교", "경기", "구분", "횟수", "사유", "자세한 내용 (교사용)", "기록한 사람", ""].forEach(h => hr.append(el("th", "", h)));
    const th = el("thead"); th.append(hr);
    const tb = el("tbody");
    rows.forEach(r => {
      const tr = el("tr", counted(r) ? "" : "coach-cancel");
      tr.append(el("td", "", r.occurred_on + (counted(r) ? "" : " (초기화 전)")), el("td", "", r.school), el("td", "", r.match_label || ""),
        el("td", warnCls(r.kind), r.kind), el("td", "", r.amount + "회"), el("td", "", r.reason), el("td", "", r.detail || ""), el("td", "", r.recorder_name || ""));
      const act = el("td");
      if (canEdit(r)) {
        const del = el("button", "del", "삭제");
        del.type = "button";
        del.addEventListener("click", async () => {
          if (!confirm("'" + r.school + " · " + r.occurred_on + " · " + r.kind + " " + r.amount + "회 (" + r.reason + ")' 기록을 삭제할까요?")) return;
          if (await save(sb.from("team_warnings").delete().eq("id", r.id), "삭제했습니다")) loadWarnings(box);
        });
        act.append(del);
      }
      tr.append(act);
      tb.append(tr);
    });
    t.append(th, tb); sc.append(t); sec.append(sc);
    if (rows.length) box.append(sec);
  }

  function warnForm(done) {
    const f = el("form", "card coach-form");
    f.append(el("h3", "", "주의·경고 기록하기"));
    const row = el("div", "coach-fields");
    const field = (label, input) => { const l = el("label", "", label); l.append(input); row.append(l); return input; };
    const school = field("학교", el("input"));
    school.setAttribute("list", "warnSchools"); school.required = true; school.placeholder = "예: 신기중학교";
    const dl = el("datalist"); dl.id = "warnSchools";
    sb.from("sheet_rows").select("data").in("sheet", ["roster_middle", "roster_high"]).then(({ data }) => {
      [...new Set((data || []).map(x => x.data["학교 이름"]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")).forEach(s => { const o = el("option"); o.value = s; dl.append(o); });
    });
    const date = field("날짜", el("input")); date.type = "date"; date.required = true;
    date.value = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    const match = field("경기 (선택)", el("input")); match.placeholder = "예: 예선 1R vs 송산중"; match.maxLength = 100;
    const reason = field("사유", el("select"));
    WARN_REASONS.forEach(([k, txt], i) => { const o = el("option", "", txt + " → " + k); o.value = String(i); reason.append(o); });
    const kind = field("구분", el("select"));
    WARN_KINDS.forEach(v => { const o = el("option", "", v); o.value = v; kind.append(o); });
    const amount = field("횟수", el("select"));
    [1, 2, 3, 4].forEach(v => { const o = el("option", "", v + "회"); o.value = String(v); amount.append(o); });
    const memo = field("자세한 내용 (교사용만 보임)", el("input")); memo.placeholder = "예: 2세트 시작 전 25분 지각"; memo.maxLength = 300;
    // 사유를 고르면 구분·횟수를 기준대로 맞춤 (직접 바꿀 수 있음)
    const sync = () => { const [k, , n] = WARN_REASONS[Number(reason.value)]; kind.value = k; amount.value = String(n || 1); };
    reason.addEventListener("change", sync); sync();
    const btn = el("button", "btn small", "기록");
    btn.type = "submit";
    f.append(row, dl, el("p", "note", "학교·날짜·경기·구분·사유는 학생용 '경고 현황'에 공개됩니다. 학생 이름 등은 '자세한 내용'에만 적어 주세요."), btn);
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const name = school.value.trim();
      const text = WARN_REASONS[Number(reason.value)][1];
      if (!confirm(name + " · " + kind.value + " " + amount.value + "회\n사유: " + text + (memo.value.trim() ? "\n자세한 내용: " + memo.value.trim() : "") + "\n기록할까요? (학생용에 공개됩니다)")) return;
      btn.disabled = true;
      const ok = await save(sb.from("team_warnings").insert({
        school: name, division: /고등학교$|고$/.test(name) ? "고등부" : "중등부", occurred_on: date.value,
        match_label: match.value.trim() || null, kind: kind.value, amount: Number(amount.value), reason: text,
        detail: memo.value.trim() || null, recorder_name: ME.name
      }), "기록했습니다");
      btn.disabled = false;
      if (ok) done();
    });
    return f;
  }

  // 명단 확인 현황 (편집자): 학교별 확인 완료 / 수정함 / 미확인, 수정 전→후, 되돌리기
  async function loadRosterCheck(box) {
    const [{ data: ros }, { data: stats }, { data: changes }, { data: win }] = await Promise.all([
      sb.from("sheet_rows").select("sheet,data").in("sheet", ["roster_middle", "roster_high"]),
      sb.from("roster_status").select("*"),
      sb.from("roster_changes").select("*").order("created_at", { ascending: false }),
      sb.from("app_settings").select("value").eq("key", "roster_edit").maybeSingle()
    ]);
    box.replaceChildren();
    const w = (win && win.value) || {};
    const open = w.open && new Date() <= new Date(w.until);
    box.append(el("p", "note", "학생용 수정 기간: " + (open ? "열림" : "닫힘") + (w.until ? " · 마감 " + fmtTime(w.until) : "") + " (관리자 탭에서 켜고 끌 수 있음)"));
    const schools = (ros || []).filter(r => r.data["학교 이름"]).map(r => ({
      sheet: r.sheet, division: r.sheet === "roster_high" ? "고등부" : "중등부",
      school: normSchool(r.data["학교 이름"]), label: r.data["학교 이름"], dupe: !!String(r.data["확인 사항"] || "").trim()
    })).sort((a, b) => a.division.localeCompare(b.division, "ko") || a.label.localeCompare(b.label, "ko"));
    const stOf = s => (stats || []).find(x => x.sheet === s.sheet && x.school === s.school);
    const chOf = s => (changes || []).filter(x => x.sheet === s.sheet && x.school === s.school);
    const stateOf = s => s.dupe ? "중복 확인 중" : stOf(s) ? stOf(s).status : "미확인";
    const counts = {};
    schools.forEach(s => { const k = stateOf(s); counts[k] = (counts[k] || 0) + 1; });
    box.append(el("p", "rec-done", ["확인 완료", "수정함", "미확인", "중복 확인 중"].map(k => k + " " + (counts[k] || 0)).join(" · ")));
    // 맨 위 할 일: 팀장이 아직 확인하지 않은 학교(부문별) → 중복 신청 확정 대기
    const holder = el("div");
    const item = s => ({ school: s.label, text: shortSchool(s.label) });
    box.append(todoBoard("할 일 · 팀장 명단 확인", [
      { label: "중등부 미확인", cls: "t-dupe", items: schools.filter(s => s.division === "중등부" && stateOf(s) === "미확인").map(item) },
      { label: "고등부 미확인", cls: "t-dupe", items: schools.filter(s => s.division === "고등부" && stateOf(s) === "미확인").map(item) },
      { label: "중복 신청 확정 대기", cls: "t-wait", items: schools.filter(s => stateOf(s) === "중복 확인 중").map(item) }
    ], "모든 학교 팀장이 명단을 확인했습니다.", holder));
    autoRefresh(box, async () => (await tableSig("roster_status", q => q)) + "/" + (await tableSig("sheet_rows", q => q.in("sheet", ["roster_middle", "roster_high"]))),
      () => loadRosterCheck(box));

    // 칸 이름 → 사람이 읽는 라인 이름
    const KEY_LABEL = k => k.replace(/^\d+\.\s*/, "").replace(/\(학생 이름\)( 및 라인)?/, " 이름").replace(/LOL 아이디/, "아이디").replace(/^선수(\d)$/, "주전$1 티어").replace(/^예비(\d)$/, "후보$1 티어");
    function diffList(before, after) {
      const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
      return keys.filter(k => String((before || {})[k] || "") !== String((after || {})[k] || ""))
        .map(k => KEY_LABEL(k) + ": " + ((before || {})[k] || "(빈칸)") + " → " + ((after || {})[k] || "(빈칸)"));
    }
    box.append(holder);
    grid(holder, {
      columns: [
        { key: "division", label: "부문", readonly: true, get: s => s.division },
        { key: "label", label: "학교", readonly: true, get: s => s.label },
        { key: "_state", label: "상태", readonly: true, get: stateOf, cellClass: s => stateOf(s) === "미확인" ? "dupe" : stateOf(s) === "중복 확인 중" ? "ph" : "win" },
        { key: "_at", label: "마지막 확인·수정", readonly: true, get: s => stOf(s) ? fmtTime(stOf(s).updated_at) + (stOf(s).confirmed_by ? " · 교사 확인(" + stOf(s).confirmed_by + ")" : "") : "" },
        { key: "_n", label: "기록", readonly: true, get: s => chOf(s).length ? chOf(s).length + "건" : "" }
      ],
      rows: schools, exportName: "명단 확인 현황",
      filters: [{ label: "상태", values: ["확인 완료", "수정함", "미확인", "중복 확인 중"], get: stateOf }, { label: "부문", values: ["중등부", "고등부"], get: s => s.division }]
    });

    // 수정 기록 (최근 순): 수정 전 → 후, 되돌리기
    const edits = (changes || []).filter(c => c.kind === "edit" || c.kind === "revert");
    const logBox = el("details", "card roster-history");
    logBox.append(el("summary", "", "수정 기록 (최근 순) · " + edits.length + "건 · 접기/펴기"));
    if (!edits.length) logBox.append(el("p", "note", "아직 팀장이 수정한 기록이 없습니다."));
    edits.forEach(c => {
      const d = el("details", "score-editor");
      const lbl = (schools.find(s => s.sheet === c.sheet && s.school === c.school) || {}).label || c.school;
      const diffs = diffList(Object.assign({}, c.before_roster, c.before_tier), Object.assign({}, c.after_roster, c.after_tier));
      d.append(el("summary", "", fmtTime(c.created_at) + " · " + lbl + " · " + (c.kind === "revert" ? "선생님이 되돌림" : "팀장 수정") + " · 바뀐 칸 " + diffs.length + "개" + (c.reverted_at ? " (되돌림)" : "")));
      const ul = el("ul", "warn-steps");
      diffs.forEach(t => ul.append(el("li", "", t)));
      d.append(ul);
      if (c.kind === "edit" && !c.reverted_at) {
        const b = el("button", "btn ghost small", "이 수정 되돌리기");
        b.type = "button";
        b.addEventListener("click", async () => {
          if (!confirm(lbl + "의 " + fmtTime(c.created_at) + " 수정을 되돌릴까요? 그 전 명단·티어로 돌아가고, 확인 상태는 '미확인'이 됩니다.")) return;
          const { data, error } = await sb.rpc("roster_revert", { p_change_id: c.id });
          if (error || !data || data.status !== "reverted") { toast("되돌리지 못했습니다" + (data && data.status ? " (" + data.status + ")" : ""), true); return; }
          toast("되돌렸습니다");
          loadRosterCheck(box);
        });
        d.append(b);
      }
      logBox.append(d);
    });
    box.append(logBox);

    // 닉네임 점검 (규정 제6조): 변경 요청 = 학생용에서 가리고 팀 카드에 안내 / 확인 필요 = 교사용에만
    const nick = el("div", "card");
    nick.append(el("h3", "", "닉네임 점검 (규정 제6조)"),
      el("p", "note", "'변경 요청'은 학생용 전적 검색에서 아이디를 가리고 그 팀 카드에 닉네임 변경 안내를 띄웁니다. 팀장이 새 아이디를 저장하면 자동으로 풀립니다. '확인 필요'는 교사용에만 보입니다. 금지어 자동 점검에 걸린 아이디도 함께 보여 줍니다. 부적절한 닉네임 변경 요청 불응은 주의 1회입니다."));
    const { data: scan, error: se } = await sb.rpc("nickname_scan");
    if (se) nick.append(el("p", "note", "불러오지 못했습니다."));
    else if (!scan.length) nick.append(el("p", "note", "걸린 아이디가 없습니다."));
    else {
      const LV = { change: "변경 요청", check: "확인 필요", "": "표시 없음" };
      const sc = el("div", "gscroll"), t = el("table", "dtable"), hr = el("tr");
      ["학교", "칸", "학생", "롤 아이디", "자동 점검", "사유", "처리"].forEach(h => hr.append(el("th", "", h)));
      const th = el("thead"); th.append(hr);
      const tb = el("tbody");
      scan.forEach(x => {
        const tr = el("tr");
        const sel = el("select");
        sel.setAttribute("aria-label", x.lol_id + " 처리");
        ["", "check", "change"].forEach(v => { const o = el("option", "", LV[v]); o.value = v; sel.append(o); });
        sel.value = x.level || "";
        sel.addEventListener("change", async () => {
          const reason = x.reason || (x.suspect ? "자동 점검: " + x.suspect : null);
          const { data, error } = await sb.rpc("set_nickname_flag", { p_sheet: x.sheet, p_school: x.school, p_lol_id: x.lol_id, p_level: sel.value || null, p_reason: reason });
          if (error || !data || data.status === "forbidden") { toast("저장하지 못했습니다", true); sel.value = x.level || ""; return; }
          x.level = sel.value || null;
          tr.className = x.level === "change" ? "nick-change" : x.level === "check" ? "nick-check" : "";
          toast(LV[sel.value] + "(으)로 바꿨습니다");
          renderRecord();
        });
        const td = el("td"); td.append(sel);
        tr.className = x.level === "change" ? "nick-change" : x.level === "check" ? "nick-check" : "";
        tr.append(el("td", "", x.label), el("td", "", String(x.line_key).replace(/^\d+\.\s*/, "").replace(" LOL 아이디", "")), el("td", "", x.student_name || ""),
          el("td", "", x.lol_id), el("td", "", x.suspect || ""), el("td", "", x.reason || ""), td);
        tb.append(tr);
      });
      t.append(th, tb); sc.append(t); nick.append(sc);
    }
    box.append(nick);
  }

  // 신청서 원본 (선수 관련 칸만) 보기 — 자동 분석이 안 된 신청서를 직접 입력할 때
  function showRawSubmission(i) {
    const v = (i.payload && (i.payload.values || i.payload)) || {};
    const dlg = el("dialog", "rdlg");
    dlg.setAttribute("aria-label", (i.school || "") + " 신청서 원본");
    const close = () => { dlg.close(); dlg.remove(); };
    dlg.append(el("h3", "", (i.school || "") + " · 팀장 " + (i.captain || "?") + " 신청서 원본"),
      el("p", "rdlg-err", i.note || ""),
      el("p", "note", "이 신청서는 자동으로 나누지 못해 '적용'할 수 없습니다. 아래 원본을 보고 '아이디 명단'에서 직접 입력한 뒤 '무시'를 눌러 정리하세요. 중복 신청 학교면 입력할 때 확정 여부를 묻습니다."));
    const t = el("table", "dtable");
    const tb = el("tbody");
    Object.keys(v).filter(k => /^(7|8|9|10|11)\./.test(k) || /학교|팀장/.test(k)).forEach(k => {
      const tr = el("tr");
      const td = el("td", "raw-cell", String(v[k] ?? ""));
      tr.append(el("th", "", k), td);
      tb.append(tr);
    });
    t.append(tb);
    const btns = el("div", "rdlg-btns");
    const c = el("button", "btn", "닫기"); c.type = "button"; c.addEventListener("click", close);
    btns.append(c);
    dlg.append(t, btns);
    document.body.append(dlg);
    dlg.showModal();
  }

  // 구글폼 신청 접수함 (고치기 권한자)
  async function loadInbox(box) {
    const { data: items, error } = await sb.from("form_inbox").select("id,received_at,kind,school,division,captain,status,note,handled_by,handled_at,payload")
      .eq("kind", "submission").order("received_at", { ascending: false }).limit(200);
    box.replaceChildren();
    if (error) { box.append(el("p", "note", "불러오지 못했습니다.")); return; }
    const STATUS = { added: "새 학교 추가", overwritten: "재신청 덮어씀", review: "확인 필요", applied: "적용함", ignored: "무시함", error: "오류", received: "접수" };
    const review = items.filter(i => i.status === "review").length;
    const top = el("div", "gbar");
    top.append(el("span", "pending-count", "확인 필요 " + review + "건 · 전체 " + items.length + "건"));
    const reload = el("button", "btn ghost small", "새로고침");
    reload.type = "button";
    reload.addEventListener("click", () => loadInbox(box));
    top.append(reload);
    box.append(top);
    if (!items.length) { box.append(el("p", "note", "아직 구글폼으로 들어온 신청이 없습니다. 시트에 연동 스크립트를 설치하면 이곳에 쌓입니다.")); return; }
    const scroller = el("div", "gscroll");
    const table = el("table", "dtable");
    const hr = el("tr");
    // 적용·무시 버튼 칸은 확인 필요 건이 있을 때만 (없으면 빈 칸만 남음)
    ["접수 시각", "학교", "부문", "팀장", "처리 결과", "설명", "처리한 사람", ...(review ? ["처리"] : [])].forEach(h => hr.append(el("th", "", h)));
    const thead = el("thead"); thead.append(hr);
    const tb = el("tbody");
    items.forEach(i => {
      const tr = el("tr", "st-" + (i.status === "review" ? "pending" : i.status));
      tr.append(el("td", "", fmtTime(i.received_at)), el("td", "", i.school || ""), el("td", "", i.division || ""), el("td", "", i.captain || ""),
        el("td", i.status === "review" ? "dupe" : "", STATUS[i.status] || i.status), el("td", "", i.note || ""), el("td", "", i.handled_by || ""));
      const td = el("td", "actions");
      if (i.status === "review") {
        const apply = el("button", "btn small", "적용");
        const ignore = el("button", "btn ghost small", "무시");
        apply.type = ignore.type = "button";
        const act = async action => {
          if (action === "apply" && !confirm((i.school || "") + " 신청 내용으로 기존 명단·연락처·티어를 덮어쓸까요? 이전 내용은 접수함에 보관됩니다.")) return;
          apply.disabled = ignore.disabled = true;
          const { data, error } = await sb.functions.invoke("form-intake", { body: { action, id: i.id } });
          let why = data && data.error;
          // 서버가 422 등으로 돌려준 실제 이유를 읽는다 (없으면 기본 메시지)
          if (error && !why) { try { why = (await error.context.json()).error; } catch (e) {} }
          if (error || why) { toast("처리 실패: " + (why || error.message), true); apply.disabled = ignore.disabled = false; return; }
          toast(action === "apply" ? "적용했습니다" : "무시했습니다");
          loadInbox(box);
        };
        apply.addEventListener("click", () => act("apply"));
        ignore.addEventListener("click", () => act("ignore"));
        td.append(apply, ignore);
        // 자동으로 나누지 못한 신청서: '적용' 대신 원본을 보고 아이디 명단에 직접 입력
        if (/자동으로 나누지 못했습니다|선수 정보를 자동으로/.test(i.note || "")) {
          const raw = el("button", "btn ghost small", "원본 보기");
          raw.type = "button";
          raw.addEventListener("click", () => showRawSubmission(i));
          td.append(raw);
        }
      }
      if (review) tr.append(td);
      tb.append(tr);
    });
    table.append(thead, tb);
    scroller.append(table);
    box.append(scroller);
  }

  // 로그인 승인 (관리자 전용)
  async function loadAdmin(box) {
    const [staff, { data: profiles, error }] = await Promise.all([
      fetchStaff(),
      sb.from("profiles").select("*").order("status").order("last_login", { ascending: false })
    ]);
    box.replaceChildren();
    if (error) { box.append(el("p", "note", "불러오지 못했습니다.")); return; }
    // 학생용 전적 검색 공개 스위치
    const { data: setting } = await sb.from("app_settings").select("value").eq("key", "show_public_ids").maybeSingle();
    const pub = el("label", "pub-toggle");
    const cb = el("input");
    cb.type = "checkbox";
    cb.checked = !!(setting && setting.value === true);
    const txt = el("span", "", "");
    const sync = () => { txt.textContent = cb.checked ? "학생용 전적 검색 공개 중 (학교·라인·학생 이름·LOL 아이디)" : "학생용 전적 검색 비공개 (교사용에서만 보임)"; };
    sync();
    cb.addEventListener("change", async () => {
      if (cb.checked && !confirm("학생용 화면에 참가팀의 학교·라인·학생 이름·LOL 아이디를 누구나 볼 수 있게 공개할까요?")) { cb.checked = false; return; }
      if (await save(sb.from("app_settings").update({ value: cb.checked }).eq("key", "show_public_ids"), cb.checked ? "공개했습니다" : "비공개로 바꿨습니다")) sync();
      else cb.checked = !cb.checked;
    });
    pub.append(cb, txt);
    box.append(pub);
    // 팀장 명단 수정 받기 (마감 시각이 지나면 자동으로 닫힘)
    const { data: re } = await sb.from("app_settings").select("value").eq("key", "roster_edit").maybeSingle();
    const rv = (re && re.value) || { open: false, until: "2026-10-23T23:59:59.999999+09:00" };
    const rl = el("label", "pub-toggle");
    const rcb = el("input"); rcb.type = "checkbox"; rcb.checked = !!rv.open;
    const rtxt = el("span", "");
    const rsync = () => {
      const past = new Date() > new Date(rv.until);
      rtxt.textContent = "팀장 명단 확인·수정 받기: " + (rcb.checked && !past ? "열림" : "닫힘") + " (마감 " + fmtTime(rv.until) + (past ? ", 지남" : "") + ")";
    };
    rsync();
    rcb.addEventListener("change", async () => {
      const value = { open: rcb.checked, until: rv.until };
      if (await save(sb.from("app_settings").update({ value }).eq("key", "roster_edit"), rcb.checked ? "명단 수정을 열었습니다" : "명단 수정을 닫았습니다")) { rv.open = rcb.checked; rsync(); renderRecord(); }
      else rcb.checked = !rcb.checked;
    });
    rl.append(rcb, rtxt);
    box.append(rl);

    const pending = profiles.filter(p => p.status === "pending").length;
    box.append(el("p", "pending-count", "승인 대기 " + pending + "명 · 전체 " + profiles.length + "명"));
    const linked = new Map(profiles.filter(p => p.staff_id).map(p => [p.staff_id, p.user_id]));
    const scroller = el("div", "gscroll");
    const table = el("table", "dtable");
    const hr = el("tr");
    ["구글 이름", "구글 계정", "처음 로그인", "마지막 로그인", "상태", "지원단 이름 / 외부인", "권한", ""].forEach(h => hr.append(el("th", "", h)));
    const thead = el("thead");
    thead.append(hr);
    const tb = el("tbody");
    const STATUS = { pending: "대기", approved: "승인", blocked: "차단" };
    profiles.forEach(p => {
      const self = p.email && ME.email && p.email.toLowerCase() === ME.email.toLowerCase();
      const tr = el("tr", "st-" + p.status);
      tr.append(el("td", "", p.google_name || ""), el("td", "", p.email || ""), el("td", "", fmtTime(p.first_login)), el("td", "", fmtTime(p.last_login)), el("td", "", STATUS[p.status]));
      const sTd = el("td");
      const sSel = el("select");
      sSel.setAttribute("aria-label", "지원단 이름 선택");
      const none = el("option", "", "— 선택 —"); none.value = ""; sSel.append(none);
      staff.forEach(s => {
        const o = el("option", "", s.name + (s.school ? " (" + s.school + ")" : ""));
        o.value = s.id;
        if (linked.has(s.id) && linked.get(s.id) !== p.user_id) o.disabled = true;
        sSel.append(o);
      });
      // 맨 아래: 지원단이 아닌 외부인 (보기 권한만, DB 규칙으로도 강제)
      const ext = el("option", "", "외부인 (보기 권한만)");
      ext.value = "external";
      sSel.append(ext);
      sSel.value = p.external ? "external" : (p.staff_id || "");
      sTd.append(sSel);
      const rTd = el("td");
      const rSel = el("select");
      rSel.setAttribute("aria-label", "권한 선택");
      [["viewer", "보기"], ["referee", "심판 (심판 일정만 체크)"], ["editor", "보기·고치기"], ["owner", "관리자"]].forEach(([v, l]) => { const o = el("option", "", l); o.value = v; rSel.append(o); });
      rSel.value = p.role;
      rTd.append(rSel);
      // 외부인을 고르면 권한은 '보기'로 고정
      const syncRole = () => {
        const isExt = sSel.value === "external";
        if (isExt) rSel.value = "viewer";
        rSel.disabled = self || isExt;
      };
      sSel.addEventListener("change", () => {
        // 젠지 코치(심판)를 고르면 권한을 '심판'으로 맞춰 줌
        const st = staff.find(x => String(x.id) === sSel.value);
        if (st && /젠지 코치/.test(st.position || st.title || "")) rSel.value = "referee";
        syncRole();
      });
      syncRole();
      const aTd = el("td", "actions");
      const approve = el("button", "btn small", p.status === "approved" ? "저장" : "승인");
      const block = el("button", "btn ghost small", p.status === "blocked" ? "대기로" : "차단");
      const remove = el("button", "btn ghost small danger", "삭제");
      approve.type = block.type = remove.type = "button";
      approve.addEventListener("click", async () => {
        if (!sSel.value) { toast("지원단 이름 또는 '외부인'을 먼저 선택하세요", true); return; }
        const isExt = sSel.value === "external";
        const patch = isExt
          ? { status: "approved", external: true, staff_id: null, role: "viewer" }
          : { status: "approved", external: false, staff_id: Number(sSel.value), role: rSel.value };
        if (await save(sb.from("profiles").update(patch).eq("user_id", p.user_id), isExt ? "외부인(보기 권한)으로 승인했습니다" : "승인했습니다")) loadAdmin(box);
      });
      remove.addEventListener("click", async () => {
        if (!confirm((p.google_name || p.email) + " 계정을 목록에서 삭제할까요?\n삭제하면 바로 아무것도 볼 수 없고, 다시 로그인하면 '승인 대기'로 처음부터 시작합니다.")) return;
        if (await save(sb.from("profiles").delete().eq("user_id", p.user_id), "삭제했습니다")) loadAdmin(box);
      });
      if (self) remove.disabled = true;
      block.addEventListener("click", async () => {
        const next = p.status === "blocked" ? "pending" : "blocked";
        if (next === "blocked" && !confirm((p.google_name || p.email) + " 계정을 차단할까요?")) return;
        if (await save(sb.from("profiles").update({ status: next }).eq("user_id", p.user_id), next === "blocked" ? "차단했습니다" : "대기로 돌렸습니다")) loadAdmin(box);
      });
      if (self) { block.disabled = true; }
      aTd.append(approve, block, remove);
      tr.append(sTd, rTd, aTd);
      tb.append(tr);
    });
    table.append(thead, tb);
    scroller.append(table);
    const reload = el("button", "btn ghost small", "새로고침");
    reload.type = "button";
    reload.addEventListener("click", () => loadAdmin(box));
    box.append(reload, scroller);

    // 최근 수정 기록
    const { data: logs } = await sb.from("audit_log").select("table_name,action,actor_email,at").order("at", { ascending: false }).limit(30);
    const TBL = { coaching_sessions: "젠지 코칭", team_warnings: "경고 조치", form_inbox: "신청 접수", tier_scores: "티어 기준표", app_settings: "사이트 설정", staff: "지원단 명단", sheet_rows: "명단·연락처·티어", matches: "대진·결과", ref_avail: "심판 일정", ref_role_avail: "총괄·기록원 일정", ref_sessions: "심판 회차", profiles: "로그인 승인" };
    const ACT = { INSERT: "추가", UPDATE: "수정", DELETE: "삭제" };
    const d = el("details", "audit");
    d.append(el("summary", "", "최근 수정 기록 " + (logs ? logs.length : 0) + "건"));
    const ul = el("ul");
    (logs || []).forEach(l => ul.append(el("li", "", fmtTime(l.at) + " · " + (l.actor_email || "시스템") + " · " + (TBL[l.table_name] || l.table_name) + " " + (ACT[l.action] || l.action))));
    d.append(ul);
    box.append(d);
  }

  /* ---------- 시작 ---------- */
  if (!LOGIN_READY) return;
  renderAcct();
  sb.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") setTimeout(refresh, 0);
  });
  refresh();
})();
