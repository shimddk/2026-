/* 2026 경기도 교육감배 미래형 이스포츠 스쿨리그 · 제작자: 원곡고등학교 교사 심승보
   © 2026 심승보. All rights reserved. 허락 없이 복제·수정·배포할 수 없습니다. */
// 2026-11-05 결선 본인확인: 학생은 개인 코드로 휴대폰 번호·얼굴 사진·각오(선택)를 제출, 관리자는 확인·코드 관리·방송 참고 자료 내려받기.
// 사진·번호는 비공개 저장(관리자만 열람), 2026-11-09 개인정보 정리 때 모두 삭제.
(function () {
  const BUCKET = "final-checkin";
  const UNTIL = Date.parse("2026-11-07T23:59:59+09:00");
  const MAX = 10 * 1024 * 1024;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = t => t ? new Date(t).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const fmtShort = t => { if (!t) return ""; const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t)).map(x => [x.type, x.value])); return `${p.month}/${p.day} ${p.hour}:${p.minute}`; };
  const slotNo = s => parseInt(s, 10) || 99;
  const lineLabel = r => (/후보/.test(r.slot) ? "후보" + (r.line ? " · " + r.line : "") : r.line || "");
  const short = s => String(s || "").replace(/등학교$|학교$/, "");
  const REASON = {
    wrong: "코드가 맞지 않습니다. 다시 확인해 주세요.", pin_wrong: "학교·이름·휴대폰 뒷자리가 맞지 않습니다. 신청서에 적은 번호인지 확인해 주세요.",
    pin_format: "휴대폰 번호 뒷자리 숫자 4자리를 입력해 주세요.", student_locked: "이 학생은 여러 번 틀려서 30분 동안 잠겼습니다. 팀장에게 받은 코드로 들어오거나 잠시 뒤 다시 시도해 주세요.", locked: "여러 번 틀려서 잠시 잠겼습니다. 10분 뒤에 다시 시도해 주세요.",
    busy: "잠시 뒤에 다시 시도해 주세요.", bad: "페이지를 새로고침한 뒤 다시 시도해 주세요.", closed: "제출 기간(11/7 23:59)이 끝났습니다.",
    consent: "개인정보 수집·이용과 제공에 동의해 주세요.", phone: "휴대폰 번호를 010-0000-0000 형식으로 입력해 주세요.",
    motto: "부적절합니다. 조금 더 건강한 표현으로 작성해 주세요.", photo: "사진을 다시 선택해 올려 주세요(JPG·PNG·WEBP, 10MB 이하).", ext: "JPG·PNG·WEBP 사진만 올릴 수 있습니다."
  };
  const say = r => REASON[r?.reason] || "처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
  function visitor() {
    try { let v = localStorage.getItem("finalVid"); if (!v) { v = crypto.randomUUID(); localStorage.setItem("finalVid", v); } return v; }
    catch { return (window.__finalVid ||= (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now())); }
  }
  async function imageType(file) {
    const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ["jpg", "image/jpeg"];
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return ["png", "image/png"];
    if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return ["webp", "image/webp"];
    return null;
  }

  /* ---------- 학생 화면 ---------- */
  function student(sb) {
    const root = document.getElementById("finalRoot");
    if (!root) return;
    let code = "", info = null, preview = null;
    const vid = visitor();
    // 2026-11-05 기본 로그인: 학교·이름·휴대폰 뒷자리 4자리(신청서 번호, 없으면 처음 입력한 번호로 등록). 코드 입력은 예비.
    let schools = null;
    async function start(msg) {
      info = null; code = "";
      const box = el("form", "final-card");
      const school = el("select"); school.setAttribute("aria-label", "학교"); school.required = true;
      const name = el("input"); name.type = "text"; name.autocomplete = "off"; name.maxLength = 20; name.placeholder = "이름"; name.setAttribute("aria-label", "이름"); name.required = true;
      const pin = el("input"); pin.type = "password"; pin.inputMode = "numeric"; pin.autocomplete = "off"; pin.maxLength = 4; pin.placeholder = "뒷자리 4자리"; pin.setAttribute("aria-label", "휴대폰 번호 뒷자리 4자리"); pin.required = true;
      const go = el("button", "btn", "확인"); go.type = "submit";
      const toCode = el("button", "btn ghost small", "팀장에게 받은 코드로 들어오기"); toCode.type = "button";
      const status = el("p", "final-status"); status.setAttribute("role", "status"); if (msg) status.textContent = msg;
      const grid = el("div", "final-login");
      grid.append(school, name, pin, go);
      box.append(el("h3", "", "본인 확인"), el("p", "note", "학교를 고르고 이름과 휴대폰 번호 뒷자리 4자리를 입력하세요. 참가 신청서에 적은 번호를 씁니다. 신청서에 번호가 없던 학생은 지금 입력한 뒷자리가 등록되니, 다음에도 같은 숫자를 입력하세요."), grid, status, toCode);
      toCode.addEventListener("click", () => startCode());
      box.addEventListener("submit", async e => {
        e.preventDefault();
        if (!/^\d{4}$/.test(pin.value)) { status.textContent = "휴대폰 번호 뒷자리 숫자 4자리를 입력해 주세요."; return; }
        go.disabled = true; status.textContent = "확인하는 중…";
        const { data, error } = await sb.rpc("final_checkin_login", { p_school: school.value, p_name: name.value, p_pin: pin.value, p_vid: vid });
        if (error || !data?.ok) { go.disabled = false; status.textContent = error ? say() : say(data); return; }
        const o = await sb.rpc("final_checkin_open", { p_code: data.code, p_vid: vid });
        go.disabled = false;
        if (o.error || !o.data?.ok) { status.textContent = say(o.data); return; }
        code = data.code; info = o.data; form();
        if (data.registered) root.querySelector(".final-status").textContent = "신청서에 번호가 없어 방금 입력한 뒷자리로 등록했습니다. 다시 들어올 때도 같은 숫자를 입력하세요.";
      });
      root.replaceChildren(box);
      if (!schools) { const { data } = await sb.rpc("final_checkin_schools"); schools = data || []; }
      school.append(el("option", "", "학교 선택"));
      school.firstChild.value = "";
      schools.forEach(s => { const o = el("option", "", `${s.school} (${s.division})`); o.value = s.school; school.append(o); });
      school.focus();
    }
    function startCode(msg) {
      info = null; code = "";
      const box = el("form", "final-card");
      const input = el("input"); input.type = "text"; input.autocomplete = "off"; input.maxLength = 12; input.placeholder = "예: AB3C D7EF"; input.setAttribute("aria-label", "본인확인 코드");
      const go = el("button", "btn", "확인"); go.type = "submit";
      const status = el("p", "final-status"); status.setAttribute("role", "status"); if (msg) status.textContent = msg;
      box.append(el("h3", "", "본인확인 코드 입력"), el("p", "note", "팀장에게 받은 8자리 코드를 입력하세요. 코드는 학생마다 다르니 다른 사람에게 알려 주지 마세요."), el("div", "final-row"), status);
      box.querySelector(".final-row").append(input, go);
      const back = el("button", "btn ghost small", "휴대폰 번호로 들어오기"); back.type = "button"; back.addEventListener("click", () => start()); box.append(back);
      box.addEventListener("submit", async e => {
        e.preventDefault(); go.disabled = true; status.textContent = "확인하는 중…";
        const { data, error } = await sb.rpc("final_checkin_open", { p_code: input.value, p_vid: vid });
        go.disabled = false;
        if (error || !data?.ok) { status.textContent = error ? say() : say(data); return; }
        code = input.value; info = data; confirmMe();
      });
      root.replaceChildren(box); input.focus();
    }
    function confirmMe() {
      const box = el("div", "final-card");
      const yes = el("button", "btn", "네, 맞아요"), no = el("button", "btn ghost", "아니에요"); yes.type = no.type = "button";
      box.append(el("h3", "", `${info.school} ${info.name} 선수가 맞나요?`), el("p", "note", `${info.division}${info.line ? " · " + info.line : ""}`), el("div", "final-row"));
      box.lastChild.append(yes, no);
      yes.addEventListener("click", form);
      no.addEventListener("click", () => startCode("코드가 다른 학생 것이면 팀장에게 다시 확인해 주세요."));
      root.replaceChildren(box); yes.focus();
    }
    function form() {
      const box = el("form", "final-card final-form");
      box.append(el("h3", "", `${info.school} ${info.name}`));
      if (info.closed) { box.append(el("p", "note", REASON.closed + (info.submitted_at ? " 제출이 완료되어 있습니다." : " 지원단 선생님께 문의하세요."))); root.replaceChildren(box); return; }
      if (info.submitted_at) box.append(el("p", "final-done", `✔ ${fmt(info.submitted_at)}에 제출했습니다. 마감 전까지 고칠 수 있어요.`));
      const phone = el("input"); phone.type = "tel"; phone.inputMode = "numeric"; phone.autocomplete = "tel"; phone.placeholder = "010-0000-0000"; phone.value = info.phone || ""; phone.required = true;
      const file = el("input"); file.type = "file"; file.accept = "image/jpeg,image/png,image/webp";
      const img = el("img", "final-preview"); img.alt = "선택한 사진 미리보기"; img.hidden = true;
      const motto = el("input"); motto.type = "text"; motto.maxLength = 30; motto.placeholder = "예: 끝까지 즐기면서 최선을 다하겠습니다!"; motto.value = info.motto || "";
      const agree = el("input"); agree.type = "checkbox"; agree.id = "finalAgree";
      const send = el("button", "btn", info.submitted_at ? "고쳐서 다시 제출" : "제출하기"); send.type = "submit";
      const status = el("p", "final-status"); status.setAttribute("role", "status");
      const field = (label, input, help) => { const l = el("label", "final-field"); l.append(el("span", "", label), input); if (help) l.append(el("small", "", help)); return l; };
      box.append(
        field("휴대폰 번호 (필수)", phone, "결선 당일 비상 연락에만 씁니다."),
        field(info.has_photo ? "얼굴 사진 (제출됨 · 바꿀 때만 새로 선택)" : "얼굴 사진 (필수)", file, "어깨 위 정면 사진 1장, 단순한 배경, 모자·마스크 없이. 학생증 사진도 괜찮아요(학번·주소는 가리고). JPG·PNG·WEBP, 10MB 이하."),
        img,
        field("각오 한마디 (선택, 30자 이내)", motto, "해설진이 선수를 소개할 때 참고할 수 있어요. 상대를 비하하거나 불쾌감을 주는 표현은 저장되지 않습니다.")
      );
      const consent = el("div", "final-consent");
      consent.append(el("strong", "", "개인정보 수집·이용 및 제공 동의 (필수)"),
        el("p", "", "· 수집 항목: 이름, 학교, 휴대폰 번호, 얼굴 사진, 각오 한마디(선택)"),
        el("p", "", "· 목적: 결선(11/8) 현장 본인확인, 당일 비상 연락, 중계·해설진이 선수 얼굴과 이름을 알아보기 위한 참고 자료"),
        el("p", "", "· 제공: 대회 결선 중계·해설진에게 사진·이름·학교·라인·롤 아이디·각오만 참고 자료로 제공(휴대폰 번호 제외, 방송 화면 송출용 아님, 결선 뒤 파기 요청)"),
        el("p", "", "· 보관: 대회 관리자만 열람, 2026-11-09에 모두 삭제"),
        el("p", "", "· 동의하지 않을 수 있으나, 이 경우 결선 본인확인 절차를 현장에서 따로 진행해야 합니다."));
      const al = el("label", "final-agree"); al.append(agree, el("span", "", " 위 내용을 확인했고 동의합니다."));
      consent.append(al);
      box.append(consent, send, status);
      file.addEventListener("change", () => {
        if (preview) URL.revokeObjectURL(preview); preview = null; img.hidden = true;
        const f = file.files[0]; if (!f) return;
        preview = URL.createObjectURL(f); img.src = preview; img.hidden = false;
      });
      box.addEventListener("submit", async e => {
        e.preventDefault(); status.textContent = "";
        if (!agree.checked) { status.textContent = REASON.consent; return; }
        if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone.value.trim())) { status.textContent = REASON.phone; return; }
        const f = file.files[0];
        if (!f && !info.has_photo) { status.textContent = "얼굴 사진을 선택해 주세요."; return; }
        send.disabled = true; status.textContent = "제출하는 중…";
        try {
          // 사진을 올리기 전에 번호·각오를 먼저 검사(거절될 제출의 사진이 남지 않게)
          const pre = await sb.rpc("final_checkin_precheck", { p_code: code, p_vid: vid, p_phone: phone.value, p_motto: motto.value });
          if (pre.error || !pre.data?.ok) throw pre.data || {};
          let path = null;
          if (f) {
            if (f.size > MAX) throw { reason: "photo" };
            const t = await imageType(f);
            if (!t) { status.textContent = "JPG·PNG·WEBP 사진만 올릴 수 있습니다. 아이폰 사진(HEIC)이면 화면을 캡처해 올려 주세요."; return; }
            const tk = await sb.rpc("final_checkin_ticket", { p_code: code, p_vid: vid, p_ext: t[0] });
            if (tk.error || !tk.data?.ok) throw tk.data || {};
            const up = await sb.storage.from(BUCKET).upload(tk.data.path, f, { contentType: t[1], upsert: false });
            if (up.error) throw { reason: "photo" };
            path = tk.data.path;
          }
          const { data, error } = await sb.rpc("final_checkin_save", { p_code: code, p_vid: vid, p_phone: phone.value, p_photo_path: path, p_motto: motto.value, p_consent: true });
          if (error || !data?.ok) throw data || {};
          const again = await sb.rpc("final_checkin_open", { p_code: code, p_vid: vid });
          if (again.data?.ok) info = again.data;
          form(); root.querySelector(".final-status").textContent = "제출했습니다. 결선 당일 지원단 선생님이 사진과 대조합니다.";
        } catch (err) { status.textContent = say(err); }
        finally { send.disabled = false; }
      });
      root.replaceChildren(box);
    }
    if (Date.now() > UNTIL + 24 * 3600e3) { root.replaceChildren(el("p", "note", "결선 본인확인이 끝났습니다.")); return; }
    start();
  }

  /* ---------- ZIP(압축 없이 묶기) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), parts = [], dir = []; let off = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = f.data, crc = crc32(data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(10, 0, true); h.setUint16(12, 0x5d65, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x5d65, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      dir.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    }
    const size = dir.reduce((s, p) => s + p.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...dir, new Uint8Array(e.buffer)], { type: "application/zip" });
  }

  /* ---------- 관리자 화면 ---------- */
  const urls = new Set();
  function clearUrls() { urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); }
  async function teacher(sb, box, toast) {
    clearUrls();
    box.replaceChildren(el("p", "note", "불러오는 중…"));
    const { data, error } = await sb.rpc("final_checkin_admin_list");
    if (error) { box.replaceChildren(el("p", "note", "불러오지 못했습니다(관리자만 볼 수 있습니다).")); return; }
    const rows = (data || []).sort((a, b) => (a.division === b.division ? 0 : a.division === "중등부" ? -1 : 1) || a.school.localeCompare(b.school, "ko") || slotNo(a.slot) - slotNo(b.slot));
    // 2026-11-05 대상은 주전(active)만. 후보는 학교별 접힌 칸에서 "대상에 넣기"로 켤 수 있음
    const targets = rows.filter(r => r.active !== false), done = targets.filter(r => r.submitted_at).length;
    const head = el("div", "final-admin-head");
    const reload = el("button", "btn ghost small", "새로고침"), dl = el("button", "btn small", "방송 자료 내려받기"); reload.type = dl.type = "button";
    // 2026-11-08 결선 당일 출석 체크(관리자). 전체·학교별 출석 수는 체크할 때 바로 다시 셈
    const attTotal = el("strong", "final-att-total");
    const countAll = () => { attTotal.textContent = `출석 ${targets.filter(r => r.attended_at).length}/${targets.length}명`; };
    const attCounters = [countAll];
    const recount = () => attCounters.forEach(f => f());
    head.append(attTotal, el("p", "", `사진 ${targets.filter(r => r.photo_path).length}/${targets.length}명 · 학생 제출 ${done}명 · 사진·번호는 관리자만 볼 수 있습니다. 화면 밖으로 옮기지 마세요.`), reload, dl);
    reload.addEventListener("click", () => teacher(sb, box, toast));
    dl.addEventListener("click", async () => {
      dl.disabled = true; dl.textContent = "묶는 중…";
      try {
        const files = [], lines = [["부문", "학교", "이름", "라인", "롤 아이디", "각오", "사진 파일"]];
        for (const r of targets.filter(r => r.photo_path)) {
          const { data: blob, error: e2 } = await sb.storage.from(BUCKET).download(r.photo_path);
          if (e2) throw e2;
          const ext = r.photo_path.split(".").pop(), name = `${r.division}_${short(r.school)}_${lineLabel(r).replace(/\s·\s/g, "-")}_${r.student_name}.${ext}`.replace(/[\\/:*?"<>|]/g, "");
          files.push({ name: "사진/" + name, data: new Uint8Array(await blob.arrayBuffer()) });
          lines.push([r.division, r.school, r.student_name, lineLabel(r), r.lol_id || "", r.motto_hidden ? "" : r.motto || "", name]);
        }
        const csv = "﻿" + lines.map(l => l.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\r\n");
        files.unshift({ name: "선수목록.csv", data: new TextEncoder().encode(csv) },
          { name: "안내.txt", data: new TextEncoder().encode("결선 중계·해설진 참고용 자료입니다(선수 얼굴·이름 확인용).\r\n방송 화면 송출용이 아니며, 결선이 끝나면 파기해 주세요.\r\n휴대폰 번호는 들어 있지 않습니다.\r\n") });
        const a = el("a"); a.href = URL.createObjectURL(zip(files)); a.download = "결선_선수_참고자료.zip"; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        toast?.(`사진 ${files.length - 2}장을 묶었습니다`);
      } catch { toast?.("내려받지 못했습니다. 다시 시도해 주세요.", true); }
      finally { dl.disabled = false; dl.textContent = "방송 자료 내려받기"; }
    });
    box.replaceChildren(head);
    const groups = new Map();
    rows.forEach(r => { const k = r.division + "|" + r.school; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
    for (const [k, all] of groups) {
      const list = all.filter(r => r.active !== false), off = all.filter(r => r.active === false);
      const toggle = (r, on) => async () => {
        if (!on && !confirm(`${r.student_name} 학생을 본인확인 대상에서 뺄까요? 제출한 자료는 남고, 학생은 로그인할 수 없게 됩니다.`)) return;
        const { error: e7 } = await sb.rpc("final_checkin_admin_action", { p_id: r.id, p_action: on ? "activate" : "deactivate" });
        if (e7) toast?.("바꾸지 못했습니다.", true); else teacher(sb, box, toast);
      };
      const [division, school] = k.split("|");
      const card = el("section", "card final-school");
      const copy = el("button", "btn ghost small", "코드 복사"); copy.type = "button";
      const h = el("div", "final-school-head");
      const attCount = el("span", "final-count final-att-count");
      attCounters.push(() => { const n = list.filter(r => r.attended_at).length; attCount.textContent = `출석 ${n}/${list.length}`; attCount.classList.toggle("all", n === list.length && n > 0); });
      h.append(el("h3", "", `${division} · ${school}`), attCount, el("span", "final-count", `사진 ${list.filter(r => r.photo_path).length}/${list.length}`), copy);
      // 팀장 연락처 이름이 결선 대상 선수와 맞지 않으면 알려 줌(관리자가 행의 '팀장 지정'으로 고름)
      let capNote = null;
      if (!list.some(r => r.is_captain)) {
        const capName = all.find(r => r.cap_name)?.cap_name, capOff = off.find(r => r.is_captain);
        capNote = (el("p", "final-cap-note", capOff ? `팀장(${capOff.student_name})은 후보로 되어 있어 아래 접힌 '후보'에 있습니다. 결선에 뛰면 '대상에 넣기'를 누르세요.`
          : `팀장 연락처의 이름${capName ? `(${capName})` : ""}이 이 표의 선수와 맞지 않아 팀장 표시를 못 했습니다. 팀장인 선수 행에서 '팀장 지정'을 누르세요.`));
      }
      copy.addEventListener("click", async () => {
        const text = `[${school}] 결선 본인확인 코드 (사이트 '결선 본인확인' 탭, 11/7 23:59까지)\n` + list.map(r => `${r.student_name}(${lineLabel(r)}): ${r.code.slice(0, 4)} ${r.code.slice(4)}`).join("\n") + "\n※ 코드는 학생마다 다릅니다. 본인 코드만 전달해 주세요.";
        try { await navigator.clipboard.writeText(text); toast?.("복사했습니다. 팀장에게 디스코드 개인 메시지로 보내 주세요."); }
        catch { window.prompt("아래 내용을 복사하세요", text); }
      });
      const wrap = el("div", "gscroll"), table = el("table", "final-table"), tr = el("tr");
      ["사진", "이름", "라인", "롤 아이디", "휴대폰", "각오", "제출", "로그인", "코드", "출석"].forEach(t => tr.append(el("th", "", t)));
      const thead = el("thead"); thead.append(tr); const tbody = el("tbody"); table.append(thead, tbody); wrap.append(table);
      for (const r of list) {
        const row = el("tr", r.is_captain ? "final-captain" : ""), ph = el("td", "final-photo");
        const showImg = blob => {
          const u = URL.createObjectURL(blob); urls.add(u);
          const im = el("img"); im.src = u; im.alt = r.student_name + " 사진"; ph.replaceChildren(im);
          if (r.photo_source === "teacher") ph.append(el("small", "final-by-teacher", "교사 업로드"));
          im.addEventListener("click", () => im.classList.toggle("big"));
        };
        if (r.photo_path) {
          const b = el("button", "btn ghost small", "사진 보기"); b.type = "button"; ph.append(b);
          if (r.photo_source === "teacher") ph.append(el("small", "final-by-teacher", "교사 업로드"));
          b.addEventListener("click", async () => {
            b.disabled = true;
            const { data: blob, error: e3 } = await sb.storage.from(BUCKET).download(r.photo_path);
            if (e3) { b.disabled = false; toast?.("사진을 불러오지 못했습니다.", true); return; }
            showImg(blob);
          });
        } else {
          // 2026-11-08 사진을 안 낸 학생은 관리자가 대신 올림(학생 제출과 같은 비공개 저장소·형식 검사)
          ph.append(el("span", "final-miss", "미제출"));
          const fi = el("input"); fi.type = "file"; fi.accept = "image/jpeg,image/png,image/webp"; fi.hidden = true;
          const ub = el("button", "btn ghost small", "사진 올리기"); ub.type = "button";
          ub.addEventListener("click", () => fi.click());
          fi.addEventListener("change", async () => {
            const f = fi.files[0]; fi.value = ""; if (!f) return;
            if (f.size > MAX) { toast?.("10MB 이하 사진만 올릴 수 있습니다.", true); return; }
            const t = await imageType(f);
            if (!t) { toast?.("JPG·PNG·WEBP 사진만 올릴 수 있습니다(아이폰 HEIC는 캡처해서 올려 주세요).", true); return; }
            ub.disabled = true; ub.textContent = "올리는 중…";
            try {
              const tk = await sb.rpc("final_checkin_admin_ticket", { p_id: r.id, p_ext: t[0] });
              if (tk.error || !tk.data?.ok) throw 0;
              const up = await sb.storage.from(BUCKET).upload(tk.data.path, f, { contentType: t[1], upsert: false });
              if (up.error) throw 0;
              const sv = await sb.rpc("final_checkin_admin_set_photo", { p_id: r.id, p_path: tk.data.path });
              if (sv.error || !sv.data?.ok) throw 0;
              r.photo_path = tk.data.path; r.photo_source = "teacher";
              showImg(f); toast?.(`${r.student_name} 사진을 올렸습니다`);
            } catch { ub.disabled = false; ub.textContent = "사진 올리기"; toast?.("사진을 올리지 못했습니다. 다시 시도해 주세요.", true); }
          });
          ph.append(ub, fi);
        }
        const nm = el("td", "final-name", r.student_name);
        if (r.is_captain) nm.append(el("span", "final-cap-badge", "팀장"));
        const mot = el("td");
        if (r.motto) {
          mot.append(el("span", r.motto_hidden ? "final-hidden" : "", r.motto));
          const t = el("button", "btn ghost small", r.motto_hidden ? "방송 자료에 넣기" : "방송 자료에서 빼기"); t.type = "button";
          t.addEventListener("click", async () => { const { error: e4 } = await sb.rpc("final_checkin_admin_action", { p_id: r.id, p_action: r.motto_hidden ? "show_motto" : "hide_motto" }); if (e4) toast?.("바꾸지 못했습니다.", true); else teacher(sb, box, toast); });
          mot.append(t);
        }
        const cd = el("td", "final-code"); cd.append(el("code", "", r.code.slice(0, 4) + " " + r.code.slice(4)));
        const regen = el("button", "btn ghost small", "새 코드"); regen.type = "button";
        regen.addEventListener("click", async () => {
          if (!confirm(`${r.student_name} 학생 코드를 새로 만들까요? 예전 코드는 바로 쓸 수 없게 됩니다.`)) return;
          const { data: d5, error: e5 } = await sb.rpc("final_checkin_admin_action", { p_id: r.id, p_action: "regen" });
          if (e5 || !d5?.ok) toast?.("만들지 못했습니다.", true); else teacher(sb, box, toast);
        });
        cd.append(regen);
        if (/후보/.test(r.slot)) { const outBtn = el("button", "btn ghost small", "대상에서 빼기"); outBtn.type = "button"; outBtn.addEventListener("click", toggle(r, false)); cd.append(outBtn); }
        const lg = el("td"); lg.append(el("span", r.pin_source === "self" ? "final-self" : r.pin_source ? "" : "final-miss", r.pin_source === "sheet" ? "신청서 번호" : r.pin_source === "self" ? "학생 직접 등록" : "미등록"));
        if (r.pin_source) {
          const rs = el("button", "btn ghost small", "로그인 초기화"); rs.type = "button";
          rs.addEventListener("click", async () => {
            if (!confirm(`${r.student_name} 학생의 휴대폰 뒷자리 로그인을 초기화할까요? 다음에 처음 입력하는 뒷자리로 다시 등록됩니다.`)) return;
            const { data: d6, error: e6 } = await sb.rpc("final_checkin_admin_action", { p_id: r.id, p_action: "reset_pin" });
            if (e6 || !d6?.ok) toast?.("초기화하지 못했습니다.", true); else teacher(sb, box, toast);
          });
          lg.append(rs);
        }
        // 팀장 표시를 관리자가 바꿈(자동 = 팀장 연락처 이름과 같은 선수)
        const cap = el("button", "btn ghost small", r.is_captain ? "팀장 해제" : "팀장 지정"); cap.type = "button";
        cap.addEventListener("click", async () => {
          const act = r.is_captain ? (r.cap_auto ? "captain_off" : "captain_auto") : (r.cap_auto ? "captain_auto" : "captain_on");
          const { error: e8 } = await sb.rpc("final_checkin_admin_action", { p_id: r.id, p_action: act });
          if (e8) toast?.("바꾸지 못했습니다.", true); else teacher(sb, box, toast);
        });
        cd.append(cap);
        // 출석 체크: 누르면 바로 저장, 실패하면 원래대로
        const at = el("td", "final-att"), lab = el("label", "final-att-box"), chk = el("input"), when = el("small", "");
        chk.type = "checkbox"; chk.checked = !!r.attended_at; chk.setAttribute("aria-label", `${r.student_name} 출석`);
        const paint = () => { lab.classList.toggle("on", chk.checked); when.textContent = r.attended_at ? new Date(r.attended_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }) : ""; row.classList.toggle("final-attended", chk.checked); };
        lab.append(chk, el("span", "", "출석"));
        at.append(lab, when); paint();
        chk.addEventListener("change", async () => {
          const want = chk.checked; chk.disabled = true;
          const { data: d9, error: e9 } = await sb.rpc("final_checkin_admin_action", { p_id: r.id, p_action: want ? "attend" : "unattend" });
          chk.disabled = false;
          if (e9 || !d9?.ok) { chk.checked = !want; toast?.("출석을 저장하지 못했습니다. 다시 눌러 주세요.", true); return; }
          r.attended_at = want ? (d9.attended_at || new Date().toISOString()) : null;
          paint(); recount();
        });
        row.append(ph, nm, el("td", "", lineLabel(r)), el("td", "", r.lol_id || ""), el("td", "", r.phone || ""), mot, el("td", "", fmtShort(r.submitted_at)), lg, cd, at);
        tbody.append(row);
      }
      card.append(h);
      if (capNote) card.append(capNote);
      card.append(wrap);
      if (off.length) {
        const d = el("details", "final-off"); d.append(el("summary", "", `후보 ${off.length}명 (본인확인 대상 아님 · 결선에 뛰게 되면 대상에 넣기)`));
        const ul = el("ul");
        off.forEach(r => { const li = el("li"); const b = el("button", "btn ghost small", "대상에 넣기"); b.type = "button"; b.addEventListener("click", toggle(r, true)); li.append(el("span", "", `${r.student_name}${r.is_captain ? " [팀장]" : ""} (${lineLabel(r)})${r.submitted_at ? " · 제출 기록 있음" : ""} `), b); ul.append(li); });
        d.append(ul); card.append(d);
      }
      box.append(card);
    }
    recount();
  }
  window.FinalCheckin = { student, teacher, clear: clearUrls };
})();
