/* 2026 경기도 교육감배 미래형 이스포츠 스쿨리그 · 제작자: 원곡고등학교 교사 심승보
   © 2026 심승보. All rights reserved. 허락 없이 복제·수정·배포할 수 없습니다. */
(function () {
  window.createTeacherAI = function (sb) {
    let identity = null, root = null, busy = false, remaining = 0, epoch = 0, parts = null;
    const node = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };
    function remove() {
      epoch++; root?.remove(); root = null; parts = null; busy = false;
    }
    function update() {
      if (!parts) return;
      parts.quota.textContent = '오늘 남은 질문 ' + remaining + '/10 · 한국 시간 자정 초기화';
      parts.send.disabled = busy || remaining <= 0;
      parts.input.disabled = busy || remaining <= 0;
      parts.status.textContent = busy ? '대회 자료를 확인하고 있습니다…' : remaining <= 0 ? '오늘 질문을 모두 사용했습니다. 내일 다시 이용해 주세요.' : '';
    }
    async function status() {
      const version = epoch, id = identity;
      const { data, error } = await sb.rpc('teacher_ai_status');
      if (version !== epoch || identity !== id) return false;
      if (error) {
        if (parts) parts.status.textContent = '이용 권한을 확인하지 못했습니다. 잠시 뒤 다시 열어 주세요.';
        return false;
      }
      if (!data?.allowed) { remove(); return false; }
      remaining = data.remaining;
      update();
      return true;
    }
    function message(text, mine = false) {
      const row = node('div', 'teacher-ai-message' + (mine ? ' mine' : ''), text);
      parts.log.append(row);
      parts.log.scrollTop = parts.log.scrollHeight;
      return row;
    }
    async function submit(event) {
      event.preventDefault();
      if (busy || !parts) return;
      const question = parts.input.value.trim();
      if (question.length < 2) { parts.status.textContent = '두 글자 이상 질문을 적어 주세요.'; return; }
      if (!await status() || remaining <= 0) return;
      const version = epoch;
      message(question, true);
      parts.input.value = '';
      busy = true; update();
      try {
        const { data, error } = await sb.functions.invoke('teacher-ai', { body: { question } });
        if (version !== epoch || !parts) return;
        let result = data;
        if (error?.context && typeof error.context.json === 'function') {
          try { result = await error.context.json(); } catch { /* 인증 오류 등 */ }
        }
        if (version !== epoch || !parts) return;
        if (result?.answer) {
          message(result.answer + (result.truncated ? '\n\n답변이 길어 일부만 표시했습니다. 질문 범위를 좁혀 주세요.' : ''));
          if (typeof result.remaining === 'number') remaining = result.remaining;
        } else message(result?.error || '답변을 받지 못했습니다. 잠시 뒤 다시 질문해 주세요.');
      } catch {
        if (version === epoch && parts) message('연결하지 못했습니다. 잠시 뒤 다시 질문해 주세요.');
      } finally {
        if (version === epoch && parts) {
          busy = false; update();
          await status();
          if (parts && !parts.input.disabled) parts.input.focus();
        }
      }
    }
    function mount() {
      root = node('aside', 'teacher-ai'); root.id = 'teacherAI';
      root.setAttribute('aria-label', '지원단 교사용 AI');
      const toggle = node('button', 'teacher-ai-toggle'); toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'teacherAIPanel');
      toggle.append(node('span', 'teacher-ai-icon', '💬'), node('span', '', '대회에 대해 궁금한 점을 질문해 보세요!'));
      const panel = node('section', 'teacher-ai-panel'); panel.id = 'teacherAIPanel'; panel.hidden = true;
      panel.setAttribute('role', 'region'); panel.setAttribute('aria-labelledby', 'teacherAITitle');
      const head = node('div', 'teacher-ai-head');
      const title = node('h2', '', '스쿨리그 AI 도우미'); title.id = 'teacherAITitle';
      const close = node('button', 'teacher-ai-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'AI 도우미 닫기');
      head.append(title, close);
      const quota = node('p', 'teacher-ai-quota');
      const note = node('p', 'teacher-ai-note', '지원단 교사 전용 · 통계·규정 조회만 가능합니다. 학생 이름·아이디·연락처는 적지 마세요. 질문마다 독립적으로 답하며, AI 답변은 확인이 필요할 수 있습니다.');
      const log = node('div', 'teacher-ai-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite'); log.setAttribute('aria-relevant', 'additions');
      const examples = node('div', 'teacher-ai-examples');
      const form = node('form', 'teacher-ai-form');
      const input = node('textarea'); input.rows = 2; input.maxLength = 700; input.placeholder = '예: 지역별 참가 학교 수를 알려줘'; input.setAttribute('aria-label', '지원단 AI 질문');
      const send = node('button', 'btn small', '질문하기'); send.type = 'submit';
      const statusLine = node('p', 'teacher-ai-status'); statusLine.setAttribute('role', 'status');
      form.append(input, send); form.addEventListener('submit', submit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
      ['지역별 참가 학교 수', '주전·후보를 포함한 전체 등록 인원', '명단 수정 마감은 언제인가요?'].forEach(q => {
        const b = node('button', 'teacher-ai-example', q); b.type = 'button';
        b.addEventListener('click', () => { input.value = q; input.focus(); }); examples.append(b);
      });
      panel.append(head, quota, note, log, examples, form, statusLine); root.append(panel, toggle); document.body.append(root);
      parts = { panel, toggle, quota, input, send, log, status: statusLine };
      const hide = () => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); };
      toggle.addEventListener('click', async () => {
        if (!panel.hidden) { hide(); return; }
        panel.hidden = false; toggle.setAttribute('aria-expanded', 'true');
        if (await status() && parts) input.focus();
      });
      close.addEventListener('click', hide);
      root.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); hide(); } });
      message('안녕하세요. 지역별 학교 수, 등록 인원, 대회 일정과 규정을 물어보세요. 숫자는 최신 명단을 기준으로 확인합니다.');
      update();
    }
    return {
      async setIdentity(me) {
        const next = me.status === 'approved' && !me.external && me.role !== 'referee' && me.staffId ? me.id : null;
        if (next !== identity) { remove(); identity = next; }
        if (!next) return;
        if (await status() && !root) mount();
      }
    };
  };
})();
