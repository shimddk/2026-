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

  /* ---------- 학생용 공개 대진표 ---------- */
  sb.rpc("public_bracket").then(({ data, error }) => {
    if (!error && data && data.length && window.applyBracket) window.applyBracket(data);
  });

  /* ---------- 방문자 수 (브라우저별 무작위 번호로 하루 1회) ---------- */
  (function countVisit() {
    const box = document.getElementById("visits");
    if (!box) return;
    let vid = null;
    try {
      vid = localStorage.getItem("visitorId");
      if (!vid) { vid = crypto.randomUUID(); localStorage.setItem("visitorId", vid); }
    } catch (e) { vid = null; } // 저장소가 막힌 브라우저는 세지 않고 숫자만 보여 줌
    sb.rpc("record_visit", { vid }).then(({ data, error }) => {
      const row = !error && data && data[0];
      if (!row) return;
      box.replaceChildren(
        document.createTextNode("Today "), el("b", "", Number(row.today).toLocaleString("ko-KR")),
        document.createTextNode(" / Total "), el("b", "", Number(row.total).toLocaleString("ko-KR"))
      );
      box.hidden = false;
    });
  })();

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
      b.addEventListener("click", login);
      acct.append(b);
      return;
    }
    const who = el("span", "who", (ME.name || ME.email) + (ME.role && ME.status === "approved" ? " · " + ROLE_LABEL[ME.role] : ""));
    const out = el("button", "btn ghost small", "로그아웃");
    out.type = "button";
    out.addEventListener("click", async () => { await sb.auth.signOut(); location.hash = ""; location.reload(); });
    acct.append(who, out);
  }

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
    if (!session) { Object.assign(ME, { status: null, role: null, name: null, email: null }); renderAcct(); removeTeacher(); return; }
    ME.email = session.user.email;
    const { data, error } = await sb.rpc("touch_login");
    const row = !error && data && data[0];
    ME.status = row ? row.status : "pending";
    ME.role = row ? row.role : null;
    ME.name = row && row.staff_name ? row.staff_name : (session.user.user_metadata.full_name || session.user.email);
    renderAcct();
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
  function grid(box, { columns, rows, onSave, onDelete, onAdd, exportName, filterable = true }) {
    box.replaceChildren();
    const bar = el("div", "gbar");
    let q = "";
    if (filterable) {
      const s = el("input", "gsearch");
      s.type = "search";
      s.placeholder = "검색 (학교, 이름 등)";
      s.setAttribute("aria-label", "표 검색");
      s.addEventListener("input", () => { q = s.value.trim(); draw(); });
      bar.append(s);
    }
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
      const shown = q ? rows.filter(r => columns.some(c => String(c.get(r) ?? "").includes(q))) : rows;
      bar.querySelector(".gcount").textContent = shown.length + "행";
      const thead = el("thead");
      const hr = el("tr");
      columns.forEach(c => hr.append(el("th", "", c.label)));
      if (isEditor() && onDelete) hr.append(el("th", "", ""));
      thead.append(hr);
      const tb = el("tbody");
      shown.forEach(r => {
        const tr = el("tr");
        columns.forEach(c => {
          const td = el("td");
          const v = c.get(r);
          if (isEditor() && onSave && !c.readonly) {
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
          d.addEventListener("click", () => { if (confirm("이 행을 삭제할까요? 수정 기록에는 남습니다.")) onDelete(r); });
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
    roster: { title: "팀별 아이디 명단", subs: [["roster_middle", "중등부"], ["roster_high", "고등부"]] },
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
      ["t-tier", SHEETS.tier.title, "", b => loadSheet(b, SHEETS.tier)],
      ["t-matches", "대진·경기 결과", "여기 입력한 학교 이름·점수는 학생용 대진표에도 표시됩니다. 심판·비고는 교사용에만 보입니다.", loadMatches],
      ["t-referee", "심판 일정", "심판 가능한 선생님의 날짜별 참여 여부입니다.", loadReferee]
    ];
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

  // 명단·연락처·티어 시트 (행 단위 JSON)
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
      const [{ data: meta }, { data: rows, error }] = await Promise.all([
        sb.from("sheet_columns").select("columns").eq("sheet", current).maybeSingle(),
        sb.from("sheet_rows").select("id,row_no,data").eq("sheet", current).order("row_no")
      ]);
      if (error) { inner.replaceChildren(el("p", "note", "불러오지 못했습니다.")); return; }
      const keys = (meta && meta.columns) || [...new Set(rows.flatMap(r => Object.keys(r.data)))];
      if (!rows.length) { inner.replaceChildren(el("p", "note", "아직 자료가 없습니다.")); }
      const columns = keys.map(k => ({ key: k, label: k, get: r => r.data[k] }));
      const label = def.subs.find(s => s[0] === current)[1];
      grid(inner, {
        columns, rows, exportName: def.title + (def.subs.length > 1 ? "(" + label + ")" : ""),
        onSave: async (r, c, v) => {
          const data = { ...r.data, [c.key]: v };
          if (await save(sb.from("sheet_rows").update({ data }).eq("id", r.id))) r.data = data;
        },
        onDelete: async r => { if (await save(sb.from("sheet_rows").delete().eq("id", r.id), "삭제했습니다")) draw(); },
        onAdd: async () => {
          const next = rows.reduce((m, r) => Math.max(m, r.row_no), 0) + 1;
          if (await save(sb.from("sheet_rows").insert({ sheet: current, row_no: next, data: {} }), "행을 추가했습니다")) draw();
        }
      });
    }
    draw();
  }

  // 대진·경기 결과
  const MATCH_COLS = [
    ["division", "부문", null, ["중등부", "고등부"]], ["stage", "단계"], ["grp", "조"], ["match_no", "경기", "int"],
    ["team1", "학교1"], ["score1", "점수1", "int"], ["team2", "학교2"], ["score2", "점수2", "int"],
    ["winner", "승자"], ["scheduled_at", "일시"], ["referee", "심판"], ["note", "비고"]
  ].map(([k, label, type, options]) => ({ key: k, label, type, options, get: r => r[k] }));
  async function loadMatches(box) {
    const { data: rows, error } = await sb.from("matches").select("*").order("division").order("stage").order("grp").order("match_no");
    if (error) { box.replaceChildren(el("p", "note", "불러오지 못했습니다.")); return; }
    if (!rows.length) box.replaceChildren(el("p", "note", "2026 대진은 모집 마감(10/19) 이후 입력합니다."));
    const holder = el("div");
    box.append(holder);
    grid(holder, {
      columns: MATCH_COLS, rows, exportName: "대진·경기 결과",
      onSave: async (r, c, v) => { if (await save(sb.from("matches").update({ [c.key]: v }).eq("id", r.id))) r[c.key] = v; },
      onDelete: async r => { if (await save(sb.from("matches").delete().eq("id", r.id), "삭제했습니다")) { box.replaceChildren(); loadMatches(box); } },
      onAdd: async () => { if (await save(sb.from("matches").insert({ division: "중등부", stage: "조별예선" }), "행을 추가했습니다")) { box.replaceChildren(); loadMatches(box); } }
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

  // 로그인 승인 (관리자 전용)
  async function loadAdmin(box) {
    const [staff, { data: profiles, error }] = await Promise.all([
      fetchStaff(),
      sb.from("profiles").select("*").order("status").order("last_login", { ascending: false })
    ]);
    box.replaceChildren();
    if (error) { box.append(el("p", "note", "불러오지 못했습니다.")); return; }
    const pending = profiles.filter(p => p.status === "pending").length;
    box.append(el("p", "pending-count", "승인 대기 " + pending + "명 · 전체 " + profiles.length + "명"));
    const linked = new Map(profiles.filter(p => p.staff_id).map(p => [p.staff_id, p.user_id]));
    const scroller = el("div", "gscroll");
    const table = el("table", "dtable");
    const hr = el("tr");
    ["구글 이름", "구글 계정", "처음 로그인", "마지막 로그인", "상태", "지원단 이름", "권한", ""].forEach(h => hr.append(el("th", "", h)));
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
      sSel.value = p.staff_id || "";
      sTd.append(sSel);
      const rTd = el("td");
      const rSel = el("select");
      rSel.setAttribute("aria-label", "권한 선택");
      [["viewer", "보기"], ["editor", "보기·고치기"], ["owner", "관리자"]].forEach(([v, l]) => { const o = el("option", "", l); o.value = v; rSel.append(o); });
      rSel.value = p.role;
      rSel.disabled = self;
      rTd.append(rSel);
      const aTd = el("td", "actions");
      const approve = el("button", "btn small", p.status === "approved" ? "저장" : "승인");
      const block = el("button", "btn ghost small", p.status === "blocked" ? "대기로" : "차단");
      approve.type = block.type = "button";
      approve.addEventListener("click", async () => {
        if (!sSel.value) { toast("지원단 이름을 먼저 선택하세요", true); return; }
        if (await save(sb.from("profiles").update({ status: "approved", staff_id: Number(sSel.value), role: rSel.value }).eq("user_id", p.user_id), "승인했습니다")) loadAdmin(box);
      });
      block.addEventListener("click", async () => {
        const next = p.status === "blocked" ? "pending" : "blocked";
        if (next === "blocked" && !confirm((p.google_name || p.email) + " 계정을 차단할까요?")) return;
        if (await save(sb.from("profiles").update({ status: next }).eq("user_id", p.user_id), next === "blocked" ? "차단했습니다" : "대기로 돌렸습니다")) loadAdmin(box);
      });
      if (self) { block.disabled = true; }
      aTd.append(approve, block);
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
    const TBL = { staff: "지원단 명단", sheet_rows: "명단·연락처·티어", matches: "대진·결과", referee_availability: "심판 일정", profiles: "로그인 승인" };
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
