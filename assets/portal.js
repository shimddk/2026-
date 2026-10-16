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
  function loadPublicBracket() {
    Promise.all([sb.rpc("public_bracket"), sb.rpc("public_standings")]).then(([m, s]) => {
      if (!m.error && m.data && m.data.length && window.applyBracket) window.applyBracket(m.data, s.error ? [] : s.data);
    });
  }
  loadPublicBracket();

  /* ---------- 챗봇: 디스코드 질문방 답변 (구글 시트 → 10분마다 DB 갱신) ---------- */
  sb.rpc("public_discord_qa").then(({ data, error }) => {
    if (!error && data && window.setDiscordQA) window.setDiscordQA(data);
  });

  /* ---------- 방문자 수 (브라우저별 무작위 번호로 하루 1회) ---------- */
  (function countVisit() {
    const box = document.getElementById("visits");
    if (!box) return;
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname); // 로컬 점검은 세지 않음
    let vid = null;
    try {
      vid = localStorage.getItem("visitorId");
      if (!vid) { vid = crypto.randomUUID(); localStorage.setItem("visitorId", vid); }
    } catch (e) { vid = null; } // 저장소가 막힌 브라우저는 세지 않고 숫자만 보여 줌
    sb.rpc("record_visit", { vid: local ? null : vid }).then(({ data, error }) => {
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
  const fowMulti = ids => "https://www.fow.lol/multi/kr#" + encodeURIComponent(ids.map(fowId).join(","));
  const SLOT_DEFS = [
    [1, "탑", /^탑 LOL 아이디$/], [2, "정글", /^정글 LOL 아이디$/], [3, "미드", /^미드 LOL 아이디$/],
    [4, "원딜", /^원딜 LOL 아이디$/], [5, "서폿", /서폿 LOL 아이디$/],
    [6, "후보1", /후보1 LOL 아이디$/], [7, "후보2", /후보2 LOL 아이디$/], [8, "후보3", /후보3 LOL 아이디$/],
    [9, "후보4", /후보4 LOL 아이디$/], [10, "후보5", /후보5 LOL 아이디$/]
  ];
  async function loadLineups() {
    // 승인된 교사는 원본 명단에서, 그 외는 공개 함수(관리자가 공개를 켰을 때만 결과가 있음)에서
    if (ME.status === "approved") {
      const { data, error } = await sb.from("sheet_rows").select("sheet,row_no,data").in("sheet", ["roster_middle", "roster_high"]);
      if (error) return null;
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
          if (id) out.push({ division: r.sheet === "roster_middle" ? "중등부" : "고등부", school, region: r.data["학교 소재 지역"], team_no: teamNo.get(r), team_count: teamCount[tk], slot, line, student_name: name, lol_id: id });
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
    // 구글폼 내용 그대로라 틀린 곳이 있을 수 있음 → 팀장 확인 요청
    const ask = el("div", "pending rec-ask");
    ask.append(el("b", "", "우리 팀 정보를 꼭 확인해 주세요. "),
      document.createTextNode("구글폼 신청서에 적힌 내용으로 만든 목록이라 이름·라인·아이디#태그가 틀린 곳이 있습니다. 팀장은 10/18(일)까지 팀장 대화방에 정확한 '이름 - 라인 - 롤 아이디#태그'를 남겨 주세요. 노란 글씨는 확인이 필요한 아이디입니다."));
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
    bar.append(s, sw);
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
      if (/[\s,/(]/.test(tag) || tag.length > 5) return "태그 뒤에 다른 글자(티어·메모 등)가 붙어 있음 · 확인 필요";
      if (tag.length < 3) return "태그가 너무 짧음 · 확인 필요";
      if (name.length < 3 || name.length > 16) return "아이디 길이(3~16자) 확인 필요";
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
        const ul = el("ul", "rec-list");
        t.ids.forEach(r => {
          const li = el("li");
          li.append(el("span", "rec-line" + (r.slot > 5 ? " sub" : ""), r.line), el("span", "rec-name", r.student_name || "-"), idLink(r));
          const issue = idIssue(r.lol_id, t.ids);
          if (issue) li.append(el("small", "rec-warn", issue));
          ul.append(li);
        });
        // 멀티서치: 주전 5명 / 후보까지 모두 (누르면 fow.lol에서 바로 검색)
        const multiLink = (label, list, cls) => {
          const a = el("a", cls, label);
          a.href = fowMulti(list); a.target = "_blank"; a.rel = "noopener noreferrer";
          return a;
        };
        const starters = t.ids.filter(r => r.slot <= 5).map(r => r.lol_id);
        const btns = el("div", "rec-btns");
        if (starters.length) btns.append(multiLink("주전 " + starters.length + "명 한 번에 (멀티서치)", starters, "btn small"));
        if (t.ids.length > starters.length) btns.append(multiLink("후보까지 " + t.ids.length + "명", t.ids.map(r => r.lol_id), "btn ghost small"));
        card.append(head, ul, btns, el("p", "note", "아이디를 누르면 그 선수의 전적이, 멀티서치를 누르면 팀 전체 전적이 fow.lol 새 창에서 바로 열립니다."));
        list.append(card);
      });
    }
    draw();
  }

  // 로컬 미리보기에서만 화면 점검용으로 노출
  if (location.hostname === "localhost") window.__renderRecord = renderRecord;

  /* ---------- 로그인 상태 ---------- */
  const ME = { status: null, role: null, name: null, email: null };
  const isEditor = () => ME.role === "editor" || ME.role === "owner";
  const isOwner = () => ME.role === "owner";
  const ROLE_LABEL = { viewer: "보기", editor: "보기·고치기", owner: "관리자" };

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
    if (!session) { Object.assign(ME, { status: null, role: null, name: null, email: null }); renderAcct(); removeTeacher(); renderRecord(); return; }
    ME.email = session.user.email;
    ME.id = session.user.id;
    const { data, error } = await sb.rpc("touch_login");
    const row = !error && data && data[0];
    ME.status = row ? row.status : "pending";
    ME.role = row ? row.role : null;
    ME.name = row && row.staff_name ? row.staff_name : (session.user.user_metadata.full_name || session.user.email);
    ME.external = !!(row && row.external);
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
  function grid(box, { columns, rows, onSave, onDelete, onAdd, exportName, filterable = true, filters = [] }) {
    box.replaceChildren();
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
          if (isEditor() && onSave && !ro) {
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
              i.setAttribute("aria-label", c.label);
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
    const views = [
      ["t-staff", "지원단 명단", "지원단 선생님 명단과 업무 분장입니다.", loadStaff],
      ["t-roster", SHEETS.roster.title, "학생 실명과 LOL 아이디가 들어 있습니다. 화면 밖으로 옮기지 마세요.", b => loadSheet(b, SHEETS.roster)],
      ["t-captains", SHEETS.captains.title, "", b => loadSheet(b, SHEETS.captains)],
      ["t-advisors", SHEETS.advisors.title, "", b => loadSheet(b, SHEETS.advisors)],
      ["t-tier", SHEETS.tier.title, "선수 티어를 고르면 주전 5명 평균과 순위가 자동으로 계산됩니다. 점수가 낮을수록 높은 티어입니다.", loadTier],
      ["t-matches", "대진·경기 결과", "여기 입력한 학교 이름·점수는 학생용 대진표에도 표시됩니다. 심판·비고는 교사용에만 보입니다.", loadMatches],
      ["t-referee", "심판 일정", "심판 가능한 선생님의 날짜별 참여 여부입니다.", loadReferee],
      ["t-warn", "경고 조치", "팀별 주의·경고 기록입니다. 규정집 제9조 기준(주의 2회 = 경고 1회, 누적 경고 2회 세트 패배 · 3회 실격)으로 조치를 보여 줍니다. 지원단 선생님은 누구나 기록할 수 있고, 삭제는 기록한 본인과 편집자만 가능합니다. 학생용 '경고 현황' 탭에는 자세한 내용·기록자 없이 공개됩니다.", loadWarnings]
    ];
    // 코칭 일정은 공개 '젠지 코칭' 탭에서 모두 보이고, 여기서는 고치기 권한자가 관리 (신청자·메모 포함)
    if (isEditor()) views.push(["t-coaching", "젠지 코칭 관리", "디스코드 [GGA-코칭-지원] 채널로 들어온 코칭 신청 기록입니다. 학교당 최대 3회, 같은 타임은 최대 6팀(코치 6명)입니다. 담당 코치·상태를 바꾸면 공개 '젠지 코칭' 탭에도 바로 반영됩니다(신청자·메모는 공개 안 됨).", loadCoaching]);
    if (isEditor()) views.push(["t-inbox", "신청 접수", "구글폼으로 들어온 신청입니다. 새 학교는 자동으로 추가되고, 같은 팀장의 재신청은 최근 내용으로 덮어씁니다. '확인 필요'는 직접 적용하거나 무시하세요.", loadInbox]);
    if (isOwner()) views.push(["t-admin", "로그인 승인", "구글로 로그인한 계정을 지원단 이름과 짝지어 승인합니다.", loadAdmin]);
    views.forEach(([id, label, lead, loader]) => {
      addTab(id, label, true);
      const body = addSection(id, label, lead);
      body.append(el("p", "note", "불러오는 중…"));
      document.getElementById("tab-" + id).addEventListener("click", () => { if (!body.dataset.loaded) { body.dataset.loaded = "1"; loader(body); } }, { once: false });
    });
    if (wantsTeacher()) {
      const id = location.hash.startsWith("#t-") ? location.hash.slice(1) : "t-staff";
      document.getElementById("tab-" + id)?.click();
      window.showTab(id);
    }
  }

  // 지원단 명단
  let STAFF = [];
  const STAFF_COLS = [
    ["seq", "순번", "int"], ["region", "지역"], ["school", "소속"], ["position", "직책"], ["name", "성명"],
    ["title", "역할"], ["title2", "역할2"], ["referee_ok", "심판가능", "bool"], ["phone", "연락처"],
    ["pre_duty", "대회 전 업무 분장"], ["duty_note", "추가 설명"], ["duty_checked", "확인"], ["event_duty", "대회 업무"]
  ].map(([k, label, type]) => ({ key: k, label, type, get: r => r[k] }));

  async function fetchStaff() {
    const { data, error } = await sb.from("staff").select("*").order("seq", { nullsFirst: false }).order("id");
    if (error) { toast("명단을 불러오지 못했습니다", true); return []; }
    STAFF = data;
    return data;
  }
  async function loadStaff(box) {
    const rows = await fetchStaff();
    grid(box, {
      columns: STAFF_COLS, rows, exportName: "지원단 명단",
      onSave: async (r, c, v) => { if (await save(sb.from("staff").update({ [c.key]: v }).eq("id", r.id))) r[c.key] = v; },
      onDelete: async r => { if (await save(sb.from("staff").delete().eq("id", r.id), "삭제했습니다")) loadStaff(box); },
      onAdd: async () => { const n = prompt("추가할 선생님 성명"); if (n && await save(sb.from("staff").insert({ name: n.trim() }), "추가했습니다")) loadStaff(box); }
    });
  }

  // 팀별 티어 현황: 주전 5명 평균·순위 자동 계산 (원래 엑셀 수식을 대신함)
  const STARTERS = ["선수1", "선수2", "선수3", "선수4", "선수5"];
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

    let rows = [], scores = [], keys = [], tierCountsOpen = false;
    async function load() {
      inner.replaceChildren(el("p", "note", "불러오는 중…"));
      const [m, r, s] = await Promise.all([
        sb.from("sheet_columns").select("columns").eq("sheet", current).maybeSingle(),
        sb.from("sheet_rows").select("id,row_no,data").eq("sheet", current).order("row_no"),
        sb.from("tier_scores").select("*").eq("division", divOf(current)).order("sort")
      ]);
      if (r.error || s.error) { inner.replaceChildren(el("p", "note", "불러오지 못했습니다.")); return; }
      rows = r.data; scores = s.data;
      keys = (m.data && m.data.columns) || [...new Set(rows.flatMap(x => Object.keys(x.data)))];
      render();
    }

    function compute() {
      const map = new Map(scores.map(t => [t.tier, Number(t.score)]));
      rows.forEach(r => {
        const nums = STARTERS.map(k => map.get(r.data[k])).filter(v => typeof v === "number");
        r._avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
        r._n = nums.length;
      });
      // 순위: 평균이 낮을수록(높은 티어) 1위, 같은 평균은 같은 순위
      const sorted = rows.filter(r => r._avg != null).map(r => r._avg).sort((a, b) => a - b);
      rows.forEach(r => { r._rank = r._avg == null ? null : sorted.indexOf(r._avg) + 1; });
    }

    function render() {
      compute();
      // 요약: 주전 티어별 인원
      const counts = scores.map(t => [t.tier, rows.reduce((n, r) => n + STARTERS.filter(k => r.data[k] === t.tier).length, 0)]);
      const done = rows.filter(r => r._n === 5).length;
      // 티어별 인원은 접어 두고 화살표로 펼침 (표가 바로 보이도록)
      const chipBox = el("details", "score-editor tier-counts");
      chipBox.open = tierCountsOpen;
      chipBox.addEventListener("toggle", () => { tierCountsOpen = chipBox.open; });
      chipBox.append(el("summary", "", "티어별 주전 인원 (" + divOf(current) + ") · 주전 5명 티어가 모두 입력된 팀 " + done + " / " + rows.length + "팀"));
      const chips = el("div", "tier-chips");
      counts.forEach(([t, n]) => {
        const c = el("span", "tier-chip");
        c.append(el("b", "", t), document.createTextNode(" " + n + "명"));
        chips.append(c);
      });
      chipBox.append(chips);
      summary.replaceChildren(chipBox);
      if (isEditor()) summary.append(scoreEditor());

      const tierOptions = ["", ...scores.map(t => t.tier)];
      const playerCols = new Set(keys.filter(k => /^(선수|예비)\d/.test(k)));
      const columns = keys.map(k => {
        const col = { key: k, label: k, get: r => r.data[k] };
        if (playerCols.has(k)) {
          const extra = [...new Set(rows.map(r => r.data[k]).filter(v => v && !tierOptions.includes(v)))];
          col.options = [...tierOptions, ...extra];
        }
        return col;
      });
      const filters = [addDupeColumn(columns, rows, "학교")];
      columns.push(
        { key: "_avg", label: "평균(주전5)", readonly: true, get: r => r._avg == null ? "미입력" : r._avg.toFixed(2) + (r._n < 5 ? " (" + r._n + "명)" : "") },
        { key: "_rank", label: "순위", readonly: true, get: r => r._rank == null ? "" : r._rank }
      );
      grid(inner, {
        columns, rows, filters, exportName: "팀별 티어 현황(" + divOf(current) + ")",
        onSave: async (r, c, v) => {
          // 바뀐 칸만 저장 (행 전체를 덮어쓰지 않음)
          if (await save(sb.rpc("set_sheet_cell", { p_id: r.id, p_key: c.key, p_value: String(v ?? "") }))) { r.data = { ...r.data, [c.key]: v }; render(); }
        },
        onDelete: r => deleteSheetRow(r, current, load),
        onAdd: async () => {
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
          if (await save(sb.from("tier_scores").update({ score: v }).eq("division", s.division).eq("tier", s.tier))) { s.score = v; render(); }
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
        rows.sort((a, b) => String(a.data["학교 이름"] || "").localeCompare(String(b.data["학교 이름"] || ""), "ko"));
        const regions = [...new Set(rows.map(r => r.data["학교 소재 지역"]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
        if (isAll) filters.push({ label: "부문", values: ["중등부", "고등부"], get: r => (r.sheet === "roster_high" ? "고등부" : "중등부") });
        filters.push({ label: "지역", values: regions, get: r => r.data["학교 소재 지역"] });
        let prev = null, group = 0;
        columns.forEach(c => {
          const g = lineGroup(c.key);
          if (g) {
            if (g !== prev) group++;
            c.cls = "lg lg-" + (group % 2 ? "a" : "b") + (g !== prev ? " lg-start" : "");
            if (/아이디/.test(c.key)) c.cellClass = r => (r.data[c.key] && !String(r.data[c.key]).includes("#") ? "notag" : "");
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
            if (c.afterSave && await c.afterSave(r, oldVal, v)) draw();
          }
        },
        onDelete: r => deleteSheetRow(r, r.sheet || current, draw),
        // '전체'에서는 어느 부문에 넣을지 모호하므로 행 추가는 중등부·고등부 보기에서만
        onAdd: isAll ? null : async () => {
          const next = rows.reduce((m, r) => Math.max(m, r.row_no), 0) + 1;
          if (await save(sb.from("sheet_rows").insert({ sheet: current, row_no: next, data: {} }), "행을 추가했습니다")) draw();
        }
      });
    }
    draw();
  }

  // 대진·경기 결과: 조 편성 → 예선 순위(자동) → 본선 장로·바론 더블 엘리미네이션 → 결선
  // 출처(src)가 있는 학교 칸은 DB가 자동으로 채움 (G:조:번호 / R:조:순위 / W:코드 승자 / L:코드 패자)
  const GRP_NAME = { E: "장로", B: "바론" };
  function srcText(src, matches) {
    if (!src) return "";
    const p = src.split(":");
    if (p[0] === "G") return p[1] + "조 " + p[2] + "번";
    if (p[0] === "R") return p[1] + "조 " + p[2] + "위";
    const m = matches.find(x => x.code === p[1]);
    const g = GRP_NAME[p[1].split("-")[0]];
    return (g ? g + " " : "") + (m ? m.round_label.replace("라운드", "R") : p[1]) + (p[0] === "W" ? " 승자" : " 패자");
  }
  let matchDiv = "중등부";
  const matchPick = ["", ""]; // 다시 불러와도 단계·조 필터 유지
  async function loadMatches(box) {
    const [{ data: rows, error }, { data: slots }, { data: stand }, { data: ros }] = await Promise.all([
      sb.from("matches").select("*").eq("division", matchDiv).order("sort").order("match_no"),
      sb.from("league_slots").select("*").eq("division", matchDiv).order("grp").order("seed"),
      sb.rpc("public_standings"),
      sb.from("sheet_rows").select("data").eq("sheet", matchDiv === "중등부" ? "roster_middle" : "roster_high")
    ]);
    box.replaceChildren();
    if (error) { box.append(el("p", "note", "불러오지 못했습니다.")); return; }
    loadPublicBracket();
    const reload = () => loadMatches(box);

    const sw = el("div", "div-switch");
    ["중등부", "고등부"].forEach(d => {
      const b = el("button", "chip", d);
      b.type = "button";
      b.setAttribute("aria-pressed", d === matchDiv);
      b.addEventListener("click", () => { matchDiv = d; reload(); });
      sw.append(b);
    });
    box.append(sw, el("p", "note", "① 조 편성에 학교를 넣으면 예선 경기 칸이 채워집니다. ② 점수를 넣으면 승자가 정해지고, 조의 6경기가 끝나면 1·2위가 본선 칸에 자동으로 들어갑니다. ③ 본선·결선도 점수를 넣으면 승자·패자가 다음 경기 칸으로 이동합니다. 앞 경기 결과를 고치면 뒤 칸도 같이 바뀝니다."));

    // 1) 조 편성 + 예선 순위
    const schools = [...new Set((ros || []).map(x => x.data["학교 이름"]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
    const dl = el("datalist"); dl.id = "slotSchools";
    schools.forEach(s => { const o = el("option"); o.value = s; dl.append(o); });
    const used = {};
    (slots || []).forEach(s => { if (s.school) used[normSchool(s.school)] = (used[normSchool(s.school)] || 0) + 1; });
    const sec = el("div", "card");
    sec.append(el("h3", "", "조 편성 · 예선 순위 (" + matchDiv + ")"), dl);
    const gwrap = el("div", "slot-grid");
    "ABCDEFGH".split("").forEach(g => {
      const card = el("div", "slot-card");
      card.append(el("h4", "", g + "조"));
      const st = (stand || []).filter(x => x.division === matchDiv && x.grp === g);
      const rankOf = s => { const x = st.find(y => y.seed === s.seed); return x; };
      (slots || []).filter(s => s.grp === g).forEach(s => {
        const row = el("div", "slot-row");
        const x = rankOf(s);
        row.append(el("span", "slot-no", s.seed + "번"));
        if (isEditor()) {
          const i = el("input", "cell" + (s.school && used[normSchool(s.school)] > 1 ? " dupe" : ""));
          i.value = s.school || ""; i.setAttribute("list", "slotSchools"); i.placeholder = "학교 이름"; i.size = 12;
          i.setAttribute("aria-label", g + "조 " + s.seed + "번 학교");
          i.addEventListener("change", async () => { if (await save(sb.from("league_slots").update({ school: i.value.trim() || null }).eq("id", s.id))) reload(); });
          row.append(i);
        } else row.append(el("span", "", s.school || "-"));
        row.append(el("span", "slot-st" + (x && x.rank && x.rank <= 2 ? " up" : ""), x ? (x.rank ? x.rank + "위 · " : "") + x.wins + "승 " + x.losses + "패 " + (x.diff > 0 ? "+" : "") + x.diff : ""));
        if (s.school && used[normSchool(s.school)] > 1) row.append(el("small", "rec-warn", "다른 조와 중복"));
        card.append(row);
      });
      // 동률이면 순위를 직접 지정 (4팀 모두 지정해야 적용)
      const complete = st.length && st[0].complete;
      const tie = complete && st.some(x => !x.rank);
      const manual = (slots || []).some(s => s.grp === g && s.final_rank);
      if (isEditor() && st.length) {
        const d = el("details", "score-editor");
        d.open = tie;
        d.append(el("summary", tie ? "dupe" : "", tie ? "동률 · 순위 직접 지정 필요" : manual ? "순위 직접 지정 중" : "순위 직접 지정"));
        (slots || []).filter(s => s.grp === g && s.school).forEach(s => {
          const l = el("label", "slot-row");
          const sel = el("select");
          ["", "1", "2", "3", "4"].forEach(v => { const o = el("option", "", v ? v + "위" : "자동"); o.value = v; sel.append(o); });
          sel.value = s.final_rank ? String(s.final_rank) : "";
          sel.addEventListener("change", async () => { if (await save(sb.from("league_slots").update({ final_rank: sel.value ? Number(sel.value) : null }).eq("id", s.id))) reload(); });
          l.append(el("span", "", s.school), sel);
          d.append(l);
        });
        card.append(d);
      }
      gwrap.append(card);
    });
    sec.append(gwrap);
    box.append(sec);

    // 2) 경기 결과 (표)
    const label = r => (r.grp && r.stage !== "예선" ? r.grp + " · " : r.grp ? r.grp + "조 · " : "") + r.round_label;
    const teamCol = n => ({
      key: "team" + n, label: "학교" + n,
      readonly: r => !!r["src" + n],
      get: r => r["team" + n] || (r["src" + n] ? "(" + srcText(r["src" + n], rows) + ")" : ""),
      cellClass: r => (!r["team" + n] ? "ph" : r.winner ? (r.winner === r["team" + n] ? "win" : "lose") : "")
    });
    const columns = [
      { key: "_stage", label: "단계", readonly: true, get: r => r.stage },
      { key: "_round", label: "경기", readonly: true, get: label },
      { key: "scheduled_at", label: "일시", get: r => r.scheduled_at },
      { key: "best_of", label: "세트", options: ["1", "3", "5"], get: r => String(r.best_of) },
      teamCol(1), { key: "score1", label: "점수1", type: "int", get: r => r.score1 },
      { key: "score2", label: "점수2", type: "int", get: r => r.score2 }, teamCol(2),
      { key: "winner", label: "승자", readonly: true, get: r => r.winner, cellClass: r => (r.winner ? "win" : "") },
      { key: "referee", label: "심판", get: r => r.referee },
      { key: "note", label: "비고", get: r => r.note }
    ];
    const holder = el("div");
    box.append(el("h3", "bk-sub", "경기 결과 입력"), holder);
    grid(holder, {
      columns, rows, exportName: "대진·경기 결과(" + matchDiv + ")",
      filters: [
        { label: "단계", values: ["예선", "본선", "결선"], get: r => r.stage, initial: matchPick[0], onPick: v => { matchPick[0] = v; } },
        { label: "조·그룹", values: ["A", "B", "C", "D", "E", "F", "G", "H", "장로", "바론"], get: r => r.grp || "", initial: matchPick[1], onPick: v => { matchPick[1] = v; } }
      ],
      onSave: async (r, c, v) => {
        const val = c.key === "best_of" ? Number(v) : typeof v === "string" ? (v.trim() || null) : v;
        if (await save(sb.from("matches").update({ [c.key]: val }).eq("id", r.id))) {
          // 점수·학교가 바뀌면 다음 칸이 자동으로 바뀌므로 다시 불러옴
          if (["score1", "score2", "team1", "team2"].includes(c.key)) reload(); else r[c.key] = val;
        }
      }
    });
  }

  // 심판 일정
  async function loadReferee(box) {
    const [staff, { data: days }, { data: avail }] = await Promise.all([
      fetchStaff(),
      sb.from("referee_days").select("*").order("day"),
      sb.from("referee_availability").select("*")
    ]);
    const refs = staff.filter(s => s.referee_ok);
    const has = new Set((avail || []).filter(a => a.available).map(a => a.day + "|" + a.staff_id));
    box.replaceChildren();
    if (!refs.length) { box.append(el("p", "note", "지원단 명단에서 '심판가능'이 표시된 선생님이 없습니다.")); return; }
    const wd = d => "일월화수목금토"[new Date(d + "T00:00:00+09:00").getDay()];
    const scroller = el("div", "gscroll");
    const table = el("table", "dtable ref");
    const thead = el("thead");
    const hr = el("tr");
    hr.append(el("th", "", "선생님"));
    days.forEach(d => { const th = el("th"); th.append(el("div", "", d.day.slice(5).replace("-", "/") + "(" + wd(d.day) + ")"), el("small", "", d.label || "")); hr.append(th); });
    thead.append(hr);
    const tb = el("tbody");
    const counts = {};
    days.forEach(d => { counts[d.day] = refs.filter(s => has.has(d.day + "|" + s.id)).length; });
    const foot = el("tr", "sum");
    function drawFoot() {
      foot.replaceChildren(el("th", "", "신청 / 필요"));
      days.forEach(d => {
        const td = el("td", counts[d.day] >= d.needed ? "ok" : "short");
        td.append(el("strong", "", counts[d.day] + " / "));
        if (isEditor()) {
          const n = el("input", "need");
          n.type = "number"; n.min = 0; n.value = d.needed;
          n.setAttribute("aria-label", d.day + " 필요 인원");
          n.addEventListener("change", async () => {
            const v = Number(n.value);
            if (await save(sb.from("referee_days").update({ needed: v }).eq("day", d.day))) { d.needed = v; drawFoot(); }
          });
          td.append(n);
        } else td.append(document.createTextNode(String(d.needed)));
        td.append(el("div", "state", counts[d.day] >= d.needed ? "충분" : "부족"));
        foot.append(td);
      });
    }
    refs.forEach(s => {
      const tr = el("tr");
      tr.append(el("th", "", s.name + (s.school ? " (" + s.school + ")" : "")));
      days.forEach(d => {
        const td = el("td", "c");
        const on = has.has(d.day + "|" + s.id);
        if (isEditor()) {
          const cb = el("input");
          cb.type = "checkbox";
          cb.checked = on;
          cb.setAttribute("aria-label", s.name + " " + d.day + " 가능");
          cb.addEventListener("change", async () => {
            const ok = cb.checked
              ? await save(sb.from("referee_availability").upsert({ day: d.day, staff_id: s.id, available: true }))
              : await save(sb.from("referee_availability").delete().eq("day", d.day).eq("staff_id", s.id));
            if (!ok) { cb.checked = !cb.checked; return; }
            counts[d.day] += cb.checked ? 1 : -1;
            drawFoot();
          });
          td.append(cb);
        } else td.textContent = on ? "가능" : "";
        tr.append(td);
      });
      tb.append(tr);
    });
    drawFoot();
    tb.append(foot);
    table.append(thead, tb);
    scroller.append(table);
    box.append(scroller, el("p", "note", isEditor() ? "체크하면 바로 저장됩니다. 실제 경기 배정은 '대진·경기 결과' 탭의 심판 칸에 적어 주세요." : "보기 권한입니다. 변경은 관리자 선생님께 요청하세요."));
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
    const byDate = {};
    data.forEach(r => { (byDate[r.session_date] = byDate[r.session_date] || []).push(r); });
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
      root.append(sec);
    });
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

  // 경고 조치: 공식 규정집 제9조 기준
  // 주의 2회 = 경고 1회, 누적 경고 1회 조치 없음 · 2회 세트 패배 · 3회 실격(그날 모든 경기 패배), 결승 전 일괄 초기화
  const WARN_STEPS = [
    [1, "조치 없음 (다음 경고 시 세트 패배)"],
    [2, "세트 패배 (해당 라운드를 치르지 않고 패배)"],
    [3, "실격패 (해당 날짜의 모든 경기 패배)"]
  ];
  const WARN_KINDS = ["주의", "경고", "세트 패배", "실격"];
  // [구분, 사유, 횟수] — 규정집 조항 기준. 실제 판정은 운영사무국, 발표는 심판장
  const WARN_REASONS = [
    ["주의", "지각 10분 (제9조)"], ["경고", "지각 15분 (제9조)"], ["세트 패배", "지각 20분 (제9조)"],
    ["경고", "욕설·폭언·비방, 판정 불복 (제3조)"], ["경고", "전체 채팅 (제7조)"],
    ["경고", "심판 지시 없는 게임 중단·무단 일시정지 (제5·8조)"], ["경고", "고의 접속 종료 (제8조)"],
    ["경고", "등록하지 않은 계정 사용 (제6조)"], ["경고", "부적절한 닉네임·변경 요청 불응 (제6·10조)"],
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
          el("td", p.level >= 2 ? "dupe" : "", warnAction(p.level) || (p.caution ? "다음 주의 시 경고 1회" : "")),
          el("td", direct ? "dupe" : "", direct));
        tb.append(tr);
      });
      t.append(th, tb); sc.append(t); sum.append(sc);
    }
    const steps = el("details", "score-editor");
    steps.append(el("summary", "", "조치 단계 보기 (규정집 제9조)"));
    const ul = el("ul", "warn-steps");
    ul.append(el("li", "", "주의 2회 = 경고 1회"));
    WARN_STEPS.forEach(([k, v]) => ul.append(el("li", "", "누적 경고 " + k + "회: " + v)));
    ul.append(el("li", "", "지각: 10분 주의 · 15분 경고 · 20분 세트 몰수/실격"),
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
    const canEdit = r => isEditor() || (!ME.external && r.recorded_by === ME.id);

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
    if (ME.status === "approved" && !ME.external) box.append(warnForm(() => loadWarnings(box)));

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

  // 구글폼 신청 접수함 (고치기 권한자)
  async function loadInbox(box) {
    const { data: items, error } = await sb.from("form_inbox").select("id,received_at,kind,school,division,captain,status,note,handled_by,handled_at")
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
          if (error || (data && data.error)) { toast("처리 실패: " + ((data && data.error) || error.message), true); apply.disabled = ignore.disabled = false; return; }
          toast(action === "apply" ? "적용했습니다" : "무시했습니다");
          loadInbox(box);
        };
        apply.addEventListener("click", () => act("apply"));
        ignore.addEventListener("click", () => act("ignore"));
        td.append(apply, ignore);
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
      [["viewer", "보기"], ["editor", "보기·고치기"], ["owner", "관리자"]].forEach(([v, l]) => { const o = el("option", "", l); o.value = v; rSel.append(o); });
      rSel.value = p.role;
      rTd.append(rSel);
      // 외부인을 고르면 권한은 '보기'로 고정
      const syncRole = () => {
        const isExt = sSel.value === "external";
        if (isExt) rSel.value = "viewer";
        rSel.disabled = self || isExt;
      };
      sSel.addEventListener("change", syncRole);
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
    const TBL = { coaching_sessions: "젠지 코칭", team_warnings: "경고 조치", form_inbox: "신청 접수", tier_scores: "티어 기준표", app_settings: "사이트 설정", staff: "지원단 명단", sheet_rows: "명단·연락처·티어", matches: "대진·결과", referee_availability: "심판 일정", profiles: "로그인 승인" };
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
