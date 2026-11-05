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
  const slotNo = s => parseInt(s, 10) || 99;
  const lineLabel = r => (/후보/.test(r.slot) ? "후보" + (r.line ? " · " + r.line : "") : r.line || "");
  const short = s => String(s || "").replace(/등학교$|학교$/, "");
  const REASON = {
    wrong: "코드가 맞지 않습니다. 다시 확인해 주세요.", locked: "여러 번 틀려서 잠시 잠겼습니다. 10분 뒤에 다시 시도해 주세요.",
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
    function start(msg) {
      info = null; code = "";
      const box = el("form", "final-card");
      const input = el("input"); input.type = "text"; input.autocomplete = "off"; input.maxLength = 12; input.placeholder = "예: AB3C D7EF"; input.setAttribute("aria-label", "본인확인 코드");
      const go = el("button", "btn", "확인"); go.type = "submit";
      const status = el("p", "final-status"); status.setAttribute("role", "status"); if (msg) status.textContent = msg;
      box.append(el("h3", "", "본인확인 코드 입력"), el("p", "note", "팀장에게 받은 8자리 코드를 입력하세요. 코드는 학생마다 다르니 다른 사람에게 알려 주지 마세요."), el("div", "final-row"), status);
      box.querySelector(".final-row").append(input, go);
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
      no.addEventListener("click", () => start("코드가 다른 학생 것이면 팀장에게 다시 확인해 주세요."));
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
    const done = rows.filter(r => r.submitted_at).length;
    const head = el("div", "final-admin-head");
    const reload = el("button", "btn ghost small", "새로고침"), dl = el("button", "btn small", "방송 자료 내려받기"); reload.type = dl.type = "button";
    head.append(el("p", "", `제출 ${done}/${rows.length}명 · 마감 11/7(토) 23:59 · 사진·번호는 관리자만 볼 수 있습니다. 화면 밖으로 옮기지 마세요. 11/9 모두 삭제.`), reload, dl);
    reload.addEventListener("click", () => teacher(sb, box, toast));
    dl.addEventListener("click", async () => {
      dl.disabled = true; dl.textContent = "묶는 중…";
      try {
        const files = [], lines = [["부문", "학교", "이름", "라인", "롤 아이디", "각오", "사진 파일"]];
        for (const r of rows.filter(r => r.photo_path)) {
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
    for (const [k, list] of groups) {
      const [division, school] = k.split("|");
      const card = el("section", "card final-school");
      const copy = el("button", "btn ghost small", "코드 복사"); copy.type = "button";
      const h = el("div", "final-school-head");
      h.append(el("h3", "", `${division} · ${school}`), el("span", "final-count", `제출 ${list.filter(r => r.submitted_at).length}/${list.length}`), copy);
      copy.addEventListener("click", async () => {
        const text = `[${school}] 결선 본인확인 코드 (사이트 '결선 본인확인' 탭, 11/7 23:59까지)\n` + list.map(r => `${r.student_name}(${lineLabel(r)}): ${r.code.slice(0, 4)} ${r.code.slice(4)}`).join("\n") + "\n※ 코드는 학생마다 다릅니다. 본인 코드만 전달해 주세요.";
        try { await navigator.clipboard.writeText(text); toast?.("복사했습니다. 팀장에게 디스코드 개인 메시지로 보내 주세요."); }
        catch { window.prompt("아래 내용을 복사하세요", text); }
      });
      const wrap = el("div", "gscroll"), table = el("table", "final-table"), tr = el("tr");
      ["사진", "이름", "라인", "롤 아이디", "휴대폰", "각오", "제출", "코드"].forEach(t => tr.append(el("th", "", t)));
      const thead = el("thead"); thead.append(tr); const tbody = el("tbody"); table.append(thead, tbody); wrap.append(table);
      for (const r of list) {
        const row = el("tr"), ph = el("td", "final-photo");
        if (r.photo_path) {
          const b = el("button", "btn ghost small", "사진 보기"); b.type = "button"; ph.append(b);
          b.addEventListener("click", async () => {
            b.disabled = true;
            const { data: blob, error: e3 } = await sb.storage.from(BUCKET).download(r.photo_path);
            if (e3) { b.disabled = false; toast?.("사진을 불러오지 못했습니다.", true); return; }
            const u = URL.createObjectURL(blob); urls.add(u);
            const im = el("img"); im.src = u; im.alt = r.student_name + " 사진"; ph.replaceChildren(im);
            im.addEventListener("click", () => im.classList.toggle("big"));
          });
        } else ph.append(el("span", "final-miss", "미제출"));
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
        row.append(ph, el("td", "", r.student_name), el("td", "", lineLabel(r)), el("td", "", r.lol_id || ""), el("td", "", r.phone || ""), mot, el("td", "", fmt(r.submitted_at)), cd);
        tbody.append(row);
      }
      card.append(h, wrap); box.append(card);
    }
  }
  window.FinalCheckin = { student, teacher, clear: clearUrls };
})();
