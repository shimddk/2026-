/* 2026 스쿨리그 · 제작자: 원곡고등학교 교사 심승보. All rights reserved. */
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('const FAQ = [');
const end = html.indexOf('\nconst CATS', start);
if (start < 0 || end < 0) throw new Error('FAQ 위치를 확인해 주세요.');
const faq = {};
vm.createContext(faq);
vm.runInContext(html.slice(start, end) + ';this.faq=FAQ;', faq);
const rules = fs.readFileSync(new URL('../assets/rules.js', import.meta.url), 'utf8');
const ruleStart = rules.indexOf('  const RULEBOOK =');
const ruleEnd = rules.indexOf('  function el(');
if (ruleStart < 0 || ruleEnd < 0) throw new Error('규정 위치를 확인해 주세요.');
const cards = {};
vm.createContext(cards);
vm.runInContext(rules.slice(ruleStart, ruleEnd) + ';this.book=RULEBOOK;this.brief=BRIEFING;', cards);
const knowledge = [
  ...faq.faq.map(x => ({ title: 'FAQ ' + x.id + ' · ' + x.q, text: x.a })),
  ...cards.book.map(x => ({ title: '경기 규정 ' + x.no + ' ' + x.title, text: [...x.key, ...x.more].join('\n') })),
  ...cards.brief.map(x => ({ title: '팀장 교육 · ' + x.title, text: [...x.items, x.warn || ''].join('\n') }))
];
fs.mkdirSync(new URL('../supabase/functions/teacher-ai/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../supabase/functions/teacher-ai/knowledge.json', import.meta.url), JSON.stringify(knowledge, null, 2));
console.log('AI 공식 안내 ' + knowledge.length + '개 갱신');
