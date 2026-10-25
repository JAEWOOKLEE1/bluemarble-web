// game.js — 부루마블 규칙, 턴 진행, 화면(패널·로그·모달), 혼자/온라인 시작 흐름
'use strict';

// 게임 버전: 고칠 때마다 올림. 온라인 대전은 같은 버전끼리만 입장 가능
const GAME_VERSION = '5.3';
// 앱이 인터넷에서 최신 파일을 받아 실행 중인지 (아니면 앱에 들어 있는 버전)
const IS_ONLINE_BUILD = location.protocol.startsWith('http');

// ───────── 설정 (금액 단위: 만) ─────────
const START_CASH = 300;
const SALARY = 30;
const TAX_AMOUNT = 15;
const SPACE_FEE = 20; // 우주여행 이용료: 컬럼비아호 주인에게 (주인 없으면 은행에)
const AI_DELAY = 700;
const SELL_RATE = 0.5;                  // 매각 시 투자액의 50%
// 건물은 별장·빌딩·호텔을 따로따로 지음 (인덱스 0·1·2). 칸마다 c.bld = [별장?, 빌딩?, 호텔?]
const BUILD_NAMES = ['별장', '빌딩', '호텔'];
const BUILD_ICONS = ['🏠', '🏢', '🏨'];
const BUILD_RATE = [0.5, 1.0, 1.5];     // 건설비 = 땅값 × 비율
// 통행료 = 땅값 × (땅 0.5 + 지은 건물마다 더하기). 실제 부루마블처럼 건물이 있으면 산 값보다 훨씬 비싸게 받음
// 예) 별장만 1.5배, 별장+빌딩 3.5배, 셋 다 6배, 호텔만 3배
const TOLL_LAND = 0.5;
const TOLL_ADD = [1.0, 2.0, 2.5];
const NO_BLD = () => [false, false, false];
const SEAT_COLORS = ['#ff7043', '#2979ff', '#00c853', '#ab47bc'];
const MAX_SEATS = 4;
const ANIMALS = {
  kangaroo: { name: '캥거루', emoji: '🦘' },
  deer: { name: '사슴', emoji: '🦌' },
  wolf: { name: '늑대', emoji: '🐺' },
  hippo: { name: '하마', emoji: '🦛' },
  koala: { name: '코알라', emoji: '🐨' },
};

const GROUPS = [
  { name: '갈색', color: '#a1887f' },
  { name: '하늘', color: '#4fc3f7' },
  { name: '분홍', color: '#f48fb1' },
  { name: '주황', color: '#ffb74d' },
  { name: '빨강', color: '#e57373' },
  { name: '노랑', color: '#fff176' },
  { name: '초록', color: '#81c784' },
  { name: '남색', color: '#5c6bc0' },
];
// 실제 부루마블(씨앗사) 판과 같은 지역·순서·땅값 (단위: 만)
// 색 그룹은 판 위에서 이웃한 도시끼리 묶음. 관광지(제주도·콩코드·부산·퀸엘리자베스·컬럼비아·서울)는 건물을 못 지음
const BOARD_DEF = [
  { type: 'start', name: '출발', icon: '🏁' },
  { type: 'city', name: '타이베이', g: 0, price: 5 },
  { type: 'key', name: '황금열쇠', icon: '🔑' },
  { type: 'city', name: '베이징', g: 0, price: 8 },
  { type: 'city', name: '마닐라', g: 0, price: 8 },
  { type: 'tour', name: '제주도', price: 20, toll: 30, ticon: '🏝️' },
  { type: 'city', name: '싱가포르', g: 1, price: 10 },
  { type: 'key', name: '황금열쇠', icon: '🔑' },
  { type: 'city', name: '카이로', g: 1, price: 10 },
  { type: 'city', name: '이스탄불', g: 1, price: 12 },
  { type: 'island', name: '무인도', icon: '🏝️' },
  { type: 'city', name: '아테네', g: 2, price: 14 },
  { type: 'key', name: '황금열쇠', icon: '🔑' },
  { type: 'city', name: '코펜하겐', g: 2, price: 16 },
  { type: 'city', name: '스톡홀름', g: 2, price: 16 },
  { type: 'tour', name: '콩코드 여객기', short: '콩코드', price: 20, toll: 30, ticon: '✈️' },
  { type: 'city', name: '베른', g: 3, price: 18 },
  { type: 'key', name: '황금열쇠', icon: '🔑' },
  { type: 'city', name: '베를린', g: 3, price: 18 },
  { type: 'city', name: '오타와', g: 3, price: 20 },
  { type: 'fund', name: '사회복지기금', short: '복지기금', icon: '💝' },
  { type: 'city', name: '부에노스아이레스', short: '부에노스', g: 4, price: 22 },
  { type: 'key', name: '황금열쇠', icon: '🔑' },
  { type: 'city', name: '상파울루', g: 4, price: 24 },
  { type: 'city', name: '시드니', g: 4, price: 24 },
  { type: 'tour', name: '부산', price: 50, toll: 75, ticon: '⚓' },
  { type: 'city', name: '하와이', g: 5, price: 26 },
  { type: 'city', name: '리스본', g: 5, price: 26 },
  { type: 'tour', name: '퀸엘리자베스호', short: '퀸엘리자베스', price: 30, toll: 45, ticon: '🚢' },
  { type: 'city', name: '마드리드', g: 5, price: 28 },
  { type: 'space', name: '우주여행', icon: '🚀' },
  { type: 'city', name: '도쿄', g: 6, price: 30 },
  { type: 'tour', name: '컬럼비아호', price: 45, toll: 70, ticon: '🛰️' },
  { type: 'city', name: '파리', g: 6, price: 32 },
  { type: 'city', name: '로마', g: 6, price: 32 },
  { type: 'key', name: '황금열쇠', icon: '🔑' },
  { type: 'city', name: '런던', g: 7, price: 35 },
  { type: 'city', name: '뉴욕', g: 7, price: 35 },
  { type: 'tax', name: '사회복지기금 접수처', short: '기금납부', icon: '💸' },
  { type: 'tour', name: '서울', price: 100, toll: 200, ticon: '🏯' },
];

// ───────── 황금열쇠 카드 ─────────
const KEY_CARDS = [
  { title: '복권 당첨', desc: '복권에 당첨되었습니다! 20만 받기', act: async p => { p.cash += 20; render(); await moneyFx('bank', p.id, 20); } },
  { title: '장학금', desc: '장학금 10만을 받습니다', act: async p => { p.cash += 10; render(); await moneyFx('bank', p.id, 10); } },
  { title: '과속 벌금', desc: '과속 벌금 10만을 사회복지기금에 냅니다', act: async p => { await pay(p, 10, 'fund'); } },
  { title: '병원비', desc: '병원비 15만을 사회복지기금에 냅니다', act: async p => { await pay(p, 15, 'fund'); } },
  { title: '무인도 탈출권', desc: '무인도에서 바로 나올 수 있는 탈출권을 받습니다', act: async p => { p.escapeCards++; } },
  { title: '무인도 표류', desc: '배가 난파되어 무인도로 갑니다 (월급 없음)', act: async p => { sendToIsland(p); } },
  { title: '출발지로', desc: '출발지로 이동해 월급을 받습니다', act: async p => { await moveTo(p, 0); await resolveCell(p); } },
  { title: '뒤로 3칸', desc: '뒤로 3칸 이동합니다', act: async p => { await moveBackward(p, 3); await resolveCell(p); } },
  { title: '우주여행 초대', desc: '우주여행 칸으로 이동합니다', act: async p => { await moveTo(p, 30); await resolveCell(p); } },
  { title: '기금 수령처로', desc: '사회복지기금 칸으로 이동합니다', act: async p => { await moveTo(p, 20); await resolveCell(p); } },
  { title: '생일 축하', desc: '생일입니다! 모든 플레이어에게 5만씩 받습니다', act: async p => {
      for (const o of alivePlayers()) if (o !== p) await pay(o, 5, p);
    } },
  { title: '건물 수리비', desc: '건물 하나당 3만의 수리비를 냅니다', act: async p => {
      const cost = propsOf(p).reduce((s, c) => s + bCount(c), 0) * 3;
      if (cost > 0) await pay(p, cost, 'fund'); else log(`${j(p.name, '은/는')} 건물이 없어 수리비를 내지 않습니다`);
    } },
  { title: '서울 여행', desc: '서울로 이동합니다', act: async p => { await moveTo(p, 39); await resolveCell(p); } },
  { title: '제주도 관광', desc: '제주도로 이동합니다', act: async p => { await moveTo(p, 5); await resolveCell(p); } },
  { title: '종합소득세', desc: '현금의 10%를 세금으로 사회복지기금에 냅니다', act: async p => {
      const tax = Math.floor(p.cash * 0.1);
      if (tax > 0) await pay(p, tax, 'fund');
    } },
  { title: '통행료 면제권', desc: '다음 통행료 1회를 면제받습니다', act: async p => { p.freePass++; } },
  { title: '해외 유학', desc: '유학비 20만을 사회복지기금에 냅니다', act: async p => { await pay(p, 20, 'fund'); } },
];

// ───────── 상태 ─────────
// 플레이어 ctrl: 'local'(이 폰의 사람) | 'remote'(온라인 친구) | 'ai'
const game = {
  players: [],
  cells: [],
  turn: 0,
  round: 1,
  maxRounds: 30,
  fund: 0,
  over: false,
  started: false,
  current: null,
  keyDeck: [],
  speed: 1,           // 대기 시간 배율 (0이면 애니메이션 없이 즉시 진행 — 테스트용)
  rollResolver: null,
  choosing: null,
};

const $ = id => document.getElementById(id);
const sleep = ms => game.speed === 0 ? Promise.resolve() : new Promise(r => setTimeout(r, ms * game.speed));
const rnd6 = () => 1 + Math.floor(Math.random() * 6);
const fmt = n => `${n.toLocaleString()}만`;
const alivePlayers = () => game.players.filter(p => !p.bankrupt);
const isPerson = p => p.ctrl !== 'ai';
// 닉네임은 화면 HTML에 들어가므로 특수문자를 빼고 8자로 자름
const cleanName = s => String(s || '').replace(/[<>&"'`]/g, '').trim().slice(0, 8);

// 이 폰에서 플레이하는 사람
function myPlayer() {
  if (Net.isClient) return game.players[Net.myId] || null;
  return game.players.find(p => p.ctrl === 'local') || null;
}

// ───────── 연출 (방장이면 친구 폰에도 똑같이 전달) ─────────
function moneyFx(from, to, amount) {
  if (game.speed === 0) return Promise.resolve();
  if (Net.isHost) Net.broadcast({ t: 'money', from, to, amount });
  return Board3D.moneyFlow(from, to, amount);
}
const payee = creditor => creditor === 'fund' ? 'fund' : creditor ? creditor.id : 'bank';
function hopFx(p, idx, ms) {
  if (Net.isHost && ms > 0) Net.broadcast({ t: 'hop', pid: p.id, idx, ms });
  return Board3D.hop(p, idx, ms);
}
function sfx(name) {
  Sound[name]();
  if (Net.isHost) Net.broadcast({ t: 'sfx', name });
}
// 음성 안내 (온라인이면 모두의 폰에서). vid에 해당하는 녹음 파일(voice/vid.mp3)이 있으면 그걸 틀고, 없으면 기계 음성으로 읽음
function voice(text, vid) {
  if (game.speed === 0) return;
  Sound.say(text, vid);
  if (Net.isHost) Net.broadcast({ t: 'say', text, vid });
}
// 그 사람 폰에서만 들리는 음성 (예: "마이턴!", "원하는 도시를 선택하세요~")
function sayTo(p, text, vid) {
  if (game.speed === 0) return;
  if (p.ctrl === 'local') Sound.say(text, vid);
  else if (p.ctrl === 'remote') Net.send(p.conn, { t: 'say', text, vid });
}
// 주사위 합 읽기 (2와 12는 항상 더블이라 숫자 대신 "더블!")
const NUM_WORDS = { 3: '삼', 4: '사', 5: '오', 6: '육', 7: '칠', 8: '팔', 9: '구', 10: '십', 11: '십일' };
const CHOOSE_SPEECH = '원하는 도시를 선택하세요~';
// 황금열쇠 카드의 녹음 파일 이름: 카드 순서대로 key01 ~ key17
const keyVid = card => 'key' + String(KEY_CARDS.indexOf(card) + 1).padStart(2, '0');
// 읽어줄 대사: 느낌표로 끊지 않고 사람이 말하듯 이어지는 '~요' 말투 (기계 음성이 덜 딱딱하게 들림)
const SPEECH = {
  '복권 당첨': '황금열쇠예요! 복권에 당첨돼서 20만 원을 받아요!',
  '장학금': '황금열쇠예요! 장학금으로 10만 원을 받아요!',
  '과속 벌금': '황금열쇠예요. 앗, 과속 벌금으로 10만 원을 내야 해요.',
  '병원비': '황금열쇠예요. 병원비로 15만 원을 내요.',
  '무인도 탈출권': '황금열쇠예요! 무인도 탈출권을 받았어요!',
  '무인도 표류': '황금열쇠예요. 배가 난파돼서 무인도로 떠내려가요.',
  '출발지로': '황금열쇠예요! 출발지로 가서 월급을 받아요!',
  '뒤로 3칸': '황금열쇠예요. 뒤로 세 칸 이동해요.',
  '우주여행 초대': '황금열쇠예요! 우주여행에 초대받았어요!',
  '기금 수령처로': '황금열쇠예요! 사회복지기금 칸으로 이동해요!',
  '생일 축하': '황금열쇠예요! 생일 축하해요! 모두에게 5만 원씩 받아요!',
  '건물 수리비': '황금열쇠예요. 건물 하나에 3만 원씩 수리비를 내요.',
  '서울 여행': '황금열쇠예요! 서울로 여행을 떠나요!',
  '제주도 관광': '황금열쇠예요! 제주도로 관광을 떠나요!',
  '종합소득세': '황금열쇠예요. 종합소득세로 현금의 10퍼센트를 내요.',
  '통행료 면제권': '황금열쇠예요! 통행료 면제권을 받았어요!',
  '해외 유학': '황금열쇠예요. 해외 유학비로 20만 원을 내요.',
};
const TAX_SPEECH = `사회복지기금에 ${TAX_AMOUNT}만 원을 내요!`;
const ESCAPE_SPEECH = '탈출~!';
const ESCAPE_NOW_SPEECH = '이번 턴에 탈출이에요~';

// 사람이 고민하는 동안 그 말 위에 "선택중……" 말풍선 (모든 폰에)
function thinkFx(p, on) {
  if (game.speed === 0) return;
  Board3D.setThinking(p.id, on);
  if (Net.isHost) Net.broadcast({ t: 'think', pid: p.id, on });
}
async function thinking(p, task) {
  thinkFx(p, true);
  try { return await task; } finally { thinkFx(p, false); }
}

// 황금열쇠: 금색 열쇠 카드가 뜨고 → 뒤집혀서 내용이 크게 보임 (모든 폰에)
function showKeyCard(k) {
  hideKeyCard(true);
  const wrap = document.createElement('div');
  wrap.className = 'keycard-wrap';
  wrap.id = 'keycard';
  wrap.innerHTML = `<div class="keycard">
      <div class="face back"><div class="kicon">🗝️</div><div class="klabel">GOLDEN KEY</div></div>
      <div class="face front">
        <div class="kbrand">BLUE MARBLE</div><div class="kno">${k.no}</div>
        <div class="ktitle">${k.title}</div><div class="kdesc">${k.desc}</div>
        <div class="kplanet">🌏</div><div class="kwho">${k.who}</div>
      </div></div>`;
  document.body.appendChild(wrap);
  setTimeout(() => { const c = wrap.querySelector('.keycard'); if (c) c.classList.add('flip'); }, 900);
}
function hideKeyCard(now) {
  const el = $('keycard');
  if (!el) return;
  if (now) { el.remove(); return; }
  el.classList.add('out');
  setTimeout(() => el.remove(), 300);
}

// 말이 도착할 칸을 미리 반짝여 보여줌
function sparkFx(idx) {
  if (game.speed === 0) return Promise.resolve();
  if (Net.isHost) Net.broadcast({ t: 'spark', idx });
  return Board3D.sparkTile(idx, 900 * game.speed);
}
function tileLabelFx(idx, text, color) {
  if (game.speed === 0) return;
  if (Net.isHost) Net.broadcast({ t: 'tlabel', idx, text, color });
  Board3D.tileLabel(idx, text, color);
}
// 화면 위쪽에 잠깐 뜨는 알림 (매각·파산 내역 등)
function toast(html, cls = '') {
  if (Net.isHost) Net.broadcast({ t: 'toast', html, cls });
  showToast(html, cls);
}
function showToast(html, cls) {
  const el = document.createElement('div');
  el.className = 'toast ' + cls;
  el.innerHTML = html;
  const box = $('toasts');
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 4500);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[k]] = [arr[k], arr[i]];
  }
  return arr;
}

// 한국어 조사: j('AI 1', '이/가') → 'AI 1이'
function j(word, pair) {
  if (word === '나' && pair === '이/가') return '내가';
  const [withJong, noJong] = pair.split('/');
  const last = word[word.length - 1];
  const code = last.charCodeAt(0);
  let jong = false, rieul = false;
  if (code >= 0xac00 && code <= 0xd7a3) {
    const t = (code - 0xac00) % 28;
    jong = t !== 0;
    rieul = t === 8;
  } else if ('0136789'.includes(last)) {
    jong = last !== '9';
    rieul = '178'.includes(last);
  }
  if (pair === '으로/로') return word + (jong && !rieul ? withJong : noJong);
  return word + (jong ? withJong : noJong);
}

// ───────── 땅 관련 계산 ─────────
function hasMonopoly(ownerId, group) {
  return game.cells.filter(c => c.type === 'city' && c.group === group).every(c => c.owner === ownerId);
}
const bldOf = c => c.bld || NO_BLD();
const bCount = c => bldOf(c).filter(Boolean).length;
const bIcons = c => bldOf(c).map((b, i) => b ? BUILD_ICONS[i] : '').join('');
const bNames = c => bldOf(c).map((b, i) => b ? BUILD_NAMES[i] : '').filter(Boolean).join('·');
// 같은 그룹의 다른 도시를 이 사람이 모두 가졌는지 (이 칸까지 가지면 독점)
function monoFactor(c, ownerId) {
  return c.type === 'city' && game.cells.filter(x => x.type === 'city' && x.group === c.group && x !== c)
    .every(x => x.owner === ownerId) ? 2 : 1;
}
// 건물 조합(bld)일 때 통행료
function tollWith(c, bld, ownerId) {
  if (c.type === 'tour') return c.toll;
  // 땅·건물 몫을 각각 반올림해 더함 (구매 창에서 보여주는 합계와 정확히 같게)
  const sum = Math.round(c.price * TOLL_LAND) + bld.reduce((s, b, i) => s + (b ? Math.round(c.price * TOLL_ADD[i]) : 0), 0);
  return sum * monoFactor(c, ownerId);
}
function tollOf(cell) {
  if (cell.type === 'tour') return cell.toll; // 관광지는 정해진 통행료 (서울 200만 등)
  return tollWith(cell, bldOf(cell), cell.owner);
}
function buildCostOf(c, i) { return Math.round(c.price * BUILD_RATE[i]); }
function investment(cell) {
  return cell.price + bldOf(cell).reduce((s, b, i) => s + (b ? buildCostOf(cell, i) : 0), 0);
}
function sellValue(cell) { return Math.floor(investment(cell) * SELL_RATE); }
function propsOf(p) { return game.cells.filter(c => c.owner === p.id); }
function assetsOf(p) { return p.cash + propsOf(p).reduce((s, c) => s + investment(c), 0); }

// 바퀴 수에 따라 지을 수 있는 건물: 1바퀴째 별장, 2바퀴째부터 빌딩, 3바퀴째부터 호텔
function maxLevelFor(p) { return Math.min(3, p.laps + 1); }
const canBuildType = (p, i) => i < maxLevelFor(p);
const allowedText = p => BUILD_NAMES.slice(0, maxLevelFor(p)).join('·');
// 이 칸에 아직 안 지었고 지금 바퀴에 지을 수 있는 건물 종류
function buildable(p, c) {
  if (c.type !== 'city') return [];
  return [0, 1, 2].filter(i => !bldOf(c)[i] && canBuildType(p, i));
}

// ───────── 로그 / 메시지 / 모달 ─────────
function log(msg, cls = '') {
  if (Net.isHost) Net.broadcast({ t: 'log', msg, cls });
  const el = document.createElement('div');
  el.className = 'log-entry ' + cls;
  el.textContent = msg;
  const box = $('log');
  box.prepend(el);
  while (box.children.length > 300) box.lastChild.remove();
}
// localOnly: 이 폰에만 보여줄 안내 (예: "내 차례!")
function setMessage(html, localOnly = false) {
  if (Net.isHost && !localOnly) Net.broadcast({ t: 'msg', html });
  $('message').innerHTML = html;
}

// checks가 있으면 켜고 끄는 선택지(예: 별장·빌딩·호텔)를 보여주고 { v: 누른 버튼 값, sel: [켠 것들] }을 돌려줌.
// summary { baseCost, baseToll, cash }가 있으면 고른 것에 따라 '내는 돈 / 받는 통행료'를 바로 계산해 보여줌
function showModal({ title, body, buttons, checks, summary }) {
  return new Promise(resolve => {
    $('modal-title').textContent = title;
    $('modal-body').innerHTML = body;
    const sel = new Set((checks || []).filter(c => c.on).map(c => c.id));
    let sumEl = null;
    const buttonEls = [];
    const refresh = () => {
      if (!summary) return;
      const picked = (checks || []).filter(c => sel.has(c.id));
      const cost = summary.baseCost + picked.reduce((s, c) => s + c.cost, 0);
      const toll = summary.baseToll + picked.reduce((s, c) => s + c.toll, 0);
      const over = cost > summary.cash;
      sumEl.innerHTML = `내는 돈 <b class="minus">-${fmt(cost)}</b> · 상대가 걸리면 <b class="plus">+${fmt(toll)}</b>` +
        (over ? `<br><span class="minus">현금이 부족해요 (내 현금 ${fmt(summary.cash)})</span>` : '');
      for (const [el, b] of buttonEls) if (b.needsCash) el.disabled = over;
    };
    if (checks && checks.length) {
      const wrap = document.createElement('div');
      wrap.className = 'checks';
      for (const c of checks) {
        const el = document.createElement('button');
        el.className = 'check' + (sel.has(c.id) ? ' on' : '');
        el.innerHTML = `<span class="ck">${sel.has(c.id) ? '✔' : ''}</span><span class="cl">${c.label}</span><span class="cs">${c.sub || ''}</span>`;
        el.onclick = () => {
          if (sel.has(c.id)) sel.delete(c.id); else sel.add(c.id);
          el.classList.toggle('on', sel.has(c.id));
          el.querySelector('.ck').textContent = sel.has(c.id) ? '✔' : '';
          refresh();
        };
        wrap.appendChild(el);
      }
      $('modal-body').appendChild(wrap);
    }
    if (summary) {
      sumEl = document.createElement('div');
      sumEl.className = 'summary';
      $('modal-body').appendChild(sumEl);
    }
    const box = $('modal-buttons');
    box.innerHTML = '';
    for (const b of buttons) {
      const el = document.createElement('button');
      el.textContent = b.label;
      // 두 번째 줄 설명 (예: 내는 돈 · 받는 돈)
      if (b.sub) {
        const sub = document.createElement('span');
        sub.className = 'b-sub';
        sub.textContent = b.sub;
        el.appendChild(sub);
      }
      if (b.cls) el.className = b.cls;
      el.onclick = () => {
        $('modal').classList.add('hidden');
        resolve(checks ? { v: b.value, sel: [...sel] } : b.value);
      };
      box.appendChild(el);
      buttonEls.push([el, b]);
    }
    refresh();
    $('modal').classList.remove('hidden');
  });
}
const yesNo = (title, body, yes, no) =>
  ({ title, body, buttons: [{ label: yes, value: true }, { label: no, value: false, cls: 'secondary' }] });

// ───────── 사람에게 묻기 (이 폰이면 바로, 친구면 네트워크로) ─────────
function askChoice(p, spec, fallback) {
  if (p.ctrl === 'local') return showModal(spec);
  return Net.ask(p.conn, 'modal', spec, fallback);
}
async function askRoll(p) {
  if (p.ctrl === 'local') return waitForRoll();
  const v = await Net.ask(p.conn, 'roll', null, null);
  if (!v || !v.dir || !isFinite(v.dir.x) || !isFinite(v.dir.z)) return null;
  return { dir: new THREE.Vector3(v.dir.x, 0, v.dir.z), power: Math.min(15, Math.max(7, +v.power || 10)) };
}
async function askCell(p, msg) {
  if (p.ctrl === 'local') return chooseCell(msg);
  const fallback = AI.chooseSpaceTarget(game, p);
  const v = await Net.ask(p.conn, 'cell', { msg }, fallback);
  return Number.isInteger(v) && v >= 0 && v < 40 && v !== 30 ? v : fallback;
}

// ───────── 화면 갱신 ─────────
function labelOf(p) {
  const me = myPlayer();
  return p.label + (Net.mode !== 'solo' && me && me.id === p.id ? ' (나)' : '');
}

const lastCash = {};
function renderPanel() {
  // 돈이 늘면 초록, 줄면 빨강으로 반짝
  const flashes = {};
  for (const p of game.players) {
    const prev = lastCash[p.id];
    flashes[p.id] = prev === undefined || prev === p.cash ? '' : p.cash > prev ? 'up' : 'down';
    lastCash[p.id] = p.cash;
  }
  // 가로 화면용 작은 표시: 말 · 이름 · 돈 (지금 차례인 사람은 반짝반짝)
  const me = myPlayer();
  $('mini-players').innerHTML = game.players.map(p =>
    `<div class="mini ${game.current === p ? 'cur' : ''} ${p.bankrupt ? 'dead' : ''}" style="--pc:${p.color}">
      <span class="em">${ANIMALS[p.animal].emoji}</span><span class="nm">${p.name}${Net.mode !== 'solo' && me && me.id === p.id ? ' (나)' : ''}</span><span class="cs ${flashes[p.id]}">${fmt(p.cash)}</span></div>`
  ).join('');
  $('players').innerHTML = game.players.map(p => {
    const flash = flashes[p.id];
    const chips = propsOf(p).map(c => {
      const g = c.type === 'city' ? GROUPS[c.group].color : '#90a4ae';
      return `<span class="chip" style="--g:${g}">${c.name}${bIcons(c)}</span>`;
    }).join('') || '<span class="none">보유 땅 없음</span>';
    const status = [`${p.laps + 1}바퀴째`];
    if (p.bankrupt) status.push('💥 파산');
    if (p.islandTurns > 0) status.push(`🏝️ 무인도 ${p.islandTurns}턴`);
    if (p.spaceTravel) status.push('🚀 우주여행 대기');
    if (p.escapeCards) status.push(`🎫 탈출권×${p.escapeCards}`);
    if (p.freePass) status.push(`🎟️ 면제권×${p.freePass}`);
    return `<div class="pcard ${game.current === p ? 'active' : ''} ${p.bankrupt ? 'dead' : ''}" style="--pc:${p.color}">
      <div class="phead"><span class="animal">${ANIMALS[p.animal].emoji}</span><b>${labelOf(p)}</b><span class="cash ${flash}">${fmt(p.cash)}</span></div>
      <div class="psub">총자산 ${fmt(assetsOf(p))} · ${status.join(' · ')}</div>
      <div class="chips">${chips}</div></div>`;
  }).join('');
}

function renderCenter() {
  $('round-info').textContent = `${game.round} / ${game.maxRounds} 라운드`;
  $('fund-info').innerHTML = `💝 기금 <b>${fmt(game.fund)}</b>`;
}

// 친구 폰에 보낼 게임 상태 (연결 객체 등은 빼고)
function snapshot() {
  return {
    players: game.players.map(p => ({
      id: p.id, name: p.name, label: p.label, color: p.color, animal: p.animal, ctrl: p.ctrl === 'ai' ? 'ai' : 'person',
      profile: p.profile, wasPerson: !!p.wasPerson,
      cash: p.cash, pos: p.pos, laps: p.laps, islandTurns: p.islandTurns, escapeCards: p.escapeCards,
      freePass: p.freePass, spaceTravel: p.spaceTravel, bankrupt: p.bankrupt, leaveIsland: !!p.leaveIsland,
    })),
    cells: game.cells.map(c => ({ idx: c.idx, type: c.type, name: c.name, short: c.short, icon: c.icon, ticon: c.ticon, group: c.group, price: c.price, toll: c.toll, owner: c.owner, bld: bldOf(c).slice() })),
    fund: game.fund, round: game.round, maxRounds: game.maxRounds, turn: game.turn,
    currentId: game.current ? game.current.id : null,
    hostId: myPlayer() ? myPlayer().id : null,
  };
}
// 방장 이어받기·재접속용: 황금열쇠 순서와 최근 기록까지 포함
function fullSnapshot() {
  return {
    ...snapshot(),
    keyDeck: game.keyDeck.map(c => c.title),
    logs: [...$('log').children].slice(0, 40).map(e => [e.textContent, e.className.replace('log-entry', '').trim()]),
  };
}
function applyState(s) {
  game.players = s.players;
  game.cells = s.cells;
  game.fund = s.fund;
  game.round = s.round;
  game.maxRounds = s.maxRounds;
  game.turn = s.turn;
  game.current = s.currentId === null ? null : game.players[s.currentId];
  render();
}

function render() {
  Board3D.sync(game);
  renderPanel();
  renderCenter();
  if (Net.isHost && game.started) Net.broadcast({ t: 'state', state: snapshot() });
}

function onCellClick(idx) {
  const c = game.cells[idx];
  if (game.choosing) {
    if (c.type === 'space') return;
    const done = game.choosing;
    game.choosing = null;
    Board3D.setChoosing(false);
    done(idx);
    return;
  }
  $('cell-info').innerHTML = cellInfoText(c);
}

function cellInfoText(c) {
  if (c.type === 'city' || c.type === 'tour') {
    const owner = c.owner !== null ? game.players[c.owner] : null;
    let s = `<b>${c.name}</b>${c.type === 'city' ? ` (${GROUPS[c.group].name})` : ' (관광지)'} · 땅값 ${fmt(c.price)}`;
    if (owner) {
      s += ` · 주인 ${owner.name} · ${bCount(c) ? bIcons(c) + ' ' + bNames(c) : '땅만'} · 통행료 ${fmt(tollOf(c))}`;
      if (c.type === 'city' && hasMonopoly(c.owner, c.group)) s += ' (독점 2배)';
    } else if (c.type === 'city') {
      s += `<br>통행료 땅 ${Math.round(c.price * TOLL_LAND)} + 별장 ${Math.round(c.price * TOLL_ADD[0])} + 빌딩 ${Math.round(c.price * TOLL_ADD[1])} + 호텔 ${Math.round(c.price * TOLL_ADD[2])} (지은 것만 더함)`;
    } else {
      s += ` · 통행료 ${fmt(tollOf(c))} (건물 없음)`;
    }
    return s;
  }
  const desc = {
    start: `지나갈 때마다 월급 ${fmt(SALARY)}`,
    island: '3턴 쉬거나 더블이 나오면 탈출',
    fund: `도착하면 모인 기금 ${fmt(game.fund)}을 가져감`,
    space: `다음 턴에 원하는 칸으로 이동 (이용료 ${fmt(SPACE_FEE)} → 컬럼비아호 주인, 없으면 은행)`,
    key: '무작위 카드를 뽑습니다',
    tax: `기금에 ${fmt(TAX_AMOUNT)} 납부`,
  };
  return `<b>${c.name}</b> · ${desc[c.type]}`;
}

// ───────── 주사위 ─────────
const MY_TURN_MSG = '<b>내 차례!</b> 버튼을 누르거나 보드를 쓸어서 던지세요';
// 이 폰 사람의 차례: 버튼을 누르거나 보드를 쓸어서(스와이프) 던짐
function waitForRoll() {
  const btn = $('roll-btn');
  btn.disabled = false;
  btn.classList.add('ready');
  return new Promise(res => {
    game.rollResolver = res;
    Board3D.armThrow(opt => onRollClick(opt));
  });
}
function onRollClick(opt = null) {
  if (!game.rollResolver) return;
  const res = game.rollResolver;
  game.rollResolver = null;
  Board3D.disarmThrow();
  const btn = $('roll-btn');
  btn.disabled = true;
  btn.classList.remove('ready');
  res(opt);
}
async function doRoll(p) {
  const waitMsg = `<b>${p.name}</b>의 차례 · 주사위를 던지려는 중…`;
  if (p.ctrl === 'local') {
    setMessage(MY_TURN_MSG, true);
    if (Net.isHost) Net.broadcast({ t: 'msg', html: waitMsg });
  } else if (p.ctrl === 'remote') {
    setMessage(waitMsg);
  } else {
    setMessage(`<b>${p.name}</b>${j(p.name, '이/가').slice(p.name.length)} 주사위를 던집니다`);
  }
  const opt = isPerson(p) ? await askRoll(p) : null;
  let a, b;
  if (game.speed === 0) {
    [a, b] = [rnd6(), rnd6()];
  } else {
    const rec = Board3D.simulateThrow(opt);
    if (Net.isHost) Net.broadcast({ t: 'dice', rec });
    [a, b] = await Board3D.playRecording(rec);
  }
  log(`🎲 ${p.name}: ${a} + ${b} = ${a + b}${a === b ? ' (더블!)' : ''}`, 'dice');
  setMessage(`${p.name}: <b>${a} + ${b} = ${a + b}</b>${a === b ? ' 더블!' : ''}`);
  if (a === b) voice('더블!', 'double');
  else voice(`${NUM_WORDS[a + b]}!`, `num${String(a + b).padStart(2, '0')}`);
  await sleep(isPerson(p) ? 300 : 450);
  return [a, b];
}

function chooseCell(msg) {
  setMessage(msg, true);
  Board3D.setChoosing(true);
  return new Promise(res => { game.choosing = res; });
}

// ───────── 이동 ─────────
async function moveForward(p, steps, stepMs = 230) {
  for (let i = 0; i < steps; i++) {
    p.pos = (p.pos + 1) % 40;
    await hopFx(p, p.pos, stepMs * game.speed);
    if (p.pos === 0) {
      p.cash += SALARY;
      p.laps++;
      moneyFx('bank', p.id, SALARY);
      log(`💵 ${j(p.name, '이/가')} 출발지를 지나 월급 ${fmt(SALARY)}을 받았습니다 (${p.laps + 1}바퀴째)`, 'good');
      render();
    }
  }
}
async function moveBackward(p, steps) {
  for (let i = 0; i < steps; i++) {
    p.pos = (p.pos + 39) % 40;
    await hopFx(p, p.pos, 230 * game.speed);
  }
}
// 카드·우주여행 이동: 빠르게 칸을 건너뜀
async function moveTo(p, target) {
  await moveForward(p, (target - p.pos + 40) % 40, 110);
}
function sendToIsland(p) {
  p.pos = 10;
  p.islandTurns = 3;
  sfx('bad');
  log(`🏝️ ${j(p.name, '이/가')} 무인도에 갇혔습니다`, 'bad');
  render();
}

// ───────── 돈 / 파산 ─────────
// creditor: 플레이어 객체, 'fund'(사회복지기금), null(은행)
async function pay(p, amount, creditor) {
  if (p.bankrupt) return false;
  if (p.cash < amount) {
    const ok = await raiseCash(p, amount);
    if (!ok) { bankrupt(p, creditor); return false; }
  }
  p.cash -= amount;
  if (creditor === 'fund') game.fund += amount;
  else if (creditor) creditor.cash += amount;
  render();
  await moneyFx(p.id, payee(creditor), amount);
  return true;
}

const propName = c => `${c.name}${bCount(c) ? ' ' + bIcons(c) + bNames(c) : ''}`;

function sellProperty(p, c) {
  const v = sellValue(c);
  const what = propName(c);
  p.cash += v;
  log(`🏷️ ${j(p.name, '이/가')} ${what} 매각 → +${fmt(v)}`, 'bad');
  toast(`🏷️ <b>${p.name}</b> ${what} 매각 → <b class="plus">+${fmt(v)}</b>`, 'sell');
  tileLabelFx(c.idx, `매각 +${v}만`, '#ffcc80');
  c.owner = null;
  c.bld = NO_BLD();
  render();
  moneyFx(`t${c.idx}`, p.id, v);
}

async function raiseCash(p, amount) {
  const total = p.cash + propsOf(p).reduce((s, c) => s + sellValue(c), 0);
  if (total < amount) return false;
  if (isPerson(p)) {
    while (p.cash < amount) {
      const props = propsOf(p);
      const choice = await thinking(p, askChoice(p, {
        title: '💸 자금 부족',
        body: `<b>${fmt(amount)}</b>을 내야 하는데 현금이 <b>${fmt(p.cash)}</b>뿐입니다.<br>팔 땅을 고르세요. (투자액의 50%로 매각)`,
        buttons: [
          ...props.map(c => ({ label: propName(c), sub: `팔면 +${fmt(sellValue(c))} 받음`, value: c.idx, cls: 'secondary' })),
          { label: '자동으로 팔기', value: 'auto' },
        ],
      }, 'auto'));
      const cell = game.cells[choice];
      if (choice === 'auto' || !cell || cell.owner !== p.id) {
        for (const c of AI.sellOrder(game, p)) { if (p.cash >= amount) break; sellProperty(p, c); }
      } else {
        sellProperty(p, cell);
      }
    }
  } else {
    for (const c of AI.sellOrder(game, p)) {
      if (p.cash >= amount) break;
      sellProperty(p, c);
      await sleep(300);
    }
  }
  return true;
}

function bankrupt(p, creditor) {
  let money = p.cash;
  const sold = [];
  for (const c of propsOf(p)) {
    const v = sellValue(c);
    sold.push(`${propName(c)} +${v}만`);
    tileLabelFx(c.idx, `매각 +${v}만`, '#ffcc80');
    money += v;
    c.owner = null;
    c.bld = NO_BLD();
  }
  const to = creditor === 'fund' ? '사회복지기금' : creditor ? creditor.name : '은행';
  toast(`💥 <b>${p.name}</b> 파산!<br>${sold.length ? '매각: ' + sold.join(', ') + '<br>' : ''}남은 돈 <b>${fmt(money)}</b> → ${to}`, 'bankrupt');
  p.cash = 0;
  p.bankrupt = true;
  p.islandTurns = 0;
  p.spaceTravel = false;
  if (creditor === 'fund') game.fund += money;
  else if (creditor) creditor.cash += money;
  moneyFx(p.id, payee(creditor), money);
  sfx('bad');
  log(`💥 ${j(p.name, '이/가')} 파산했습니다!`, 'bad');
  render();
  checkGameEnd();
}

// ───────── 칸 도착 처리 ─────────
async function resolveCell(p) {
  const c = game.cells[p.pos];
  switch (c.type) {
    case 'start':
      await startBonusBuild(p);
      break;
    case 'island':
      p.islandTurns = 3;
      sfx('bad');
      log(`🏝️ ${j(p.name, '이/가')} 무인도에 도착했습니다 (3턴 쉬기)`, 'bad');
      break;
    case 'fund':
      if (game.fund > 0) {
        const amount = game.fund;
        log(`💝 ${j(p.name, '이/가')} 사회복지기금 ${fmt(amount)}을 받았습니다!`, 'good');
        p.cash += amount;
        game.fund = 0;
        render();
        await moneyFx('fund', p.id, amount);
      } else {
        log(`💝 사회복지기금이 비어 있습니다`);
      }
      break;
    case 'space':
      p.spaceTravel = true;
      log(`🚀 ${j(p.name, '은/는')} 다음 턴에 원하는 곳으로 우주여행을 떠납니다`);
      break;
    case 'tax':
      log(`💸 ${j(p.name, '이/가')} 사회복지기금에 ${fmt(TAX_AMOUNT)}을 냅니다`);
      voice(TAX_SPEECH, 'tax');
      await pay(p, TAX_AMOUNT, 'fund');
      break;
    case 'key':
      await drawKey(p);
      break;
    case 'city':
    case 'tour':
      await landProperty(p, c);
      break;
  }
  render();
}

// 출발 칸에 딱 멈추면: 내 도시 한 곳에 건물 하나를 더 지을 수 있음 (건설비는 냄, 바퀴 수 제한은 그대로)
// 선택지 = (도시, 건물 종류) 짝 중 돈이 되는 것
function bonusCandidates(p) {
  const out = [];
  for (const c of propsOf(p)) {
    for (const i of buildable(p, c)) if (buildCostOf(c, i) <= p.cash) out.push({ c, i });
  }
  return out;
}
const tollGain = (c, i, ownerId) => {
  const b = bldOf(c).slice();
  b[i] = true;
  return tollWith(c, b, ownerId) - tollWith(c, bldOf(c), ownerId);
};
async function startBonusBuild(p) {
  const cands = bonusCandidates(p);
  if (cands.length === 0) {
    log(`🏁 ${j(p.name, '이/가')} 출발지에 도착했지만 더 지을 수 있는 건물이 없습니다`);
    return;
  }
  let pick = null;
  if (isPerson(p)) {
    sayTo(p, CHOOSE_SPEECH, 'choose');
    // 통행료가 많이 오르는 순으로 최대 10개
    const list = cands.slice().sort((a, b) => tollGain(b.c, b.i, p.id) - tollGain(a.c, a.i, p.id)).slice(0, 10);
    const key = await thinking(p, askChoice(p, {
      title: '🏁 출발지 보너스 건설!',
      body: `출발 칸에 딱 멈췄어요! 내 도시 한 곳에 건물을 하나 더 지을 수 있어요.<br>내 현금 ${fmt(p.cash)} · ${p.laps + 1}바퀴째라 <b>${allowedText(p)}</b>를 지을 수 있어요`,
      buttons: [
        ...list.map(({ c, i }) => ({
          label: `${c.name} + ${BUILD_ICONS[i]} ${BUILD_NAMES[i]}`,
          sub: `내는 돈 ${fmt(buildCostOf(c, i))} · 통행료 +${fmt(tollGain(c, i, p.id))} 올라감`,
          value: `${c.idx}:${i}`,
        })),
        { label: '패스', value: '', cls: 'secondary' },
      ],
    }, ''));
    pick = cands.find(o => `${o.c.idx}:${o.i}` === key) || null;
  } else {
    await sleep(AI_DELAY);
    // 짓고 나서 통행료가 가장 많이 오르는 곳
    pick = cands.filter(o => AI.wantBuild(game, p, o.c, buildCostOf(o.c, o.i)))
      .sort((a, b) => tollGain(b.c, b.i, p.id) - tollGain(a.c, a.i, p.id))[0] || null;
  }
  if (!pick) {
    log(`🏁 ${j(p.name, '은/는')} 출발지 보너스 건설을 하지 않았습니다`);
    return;
  }
  const { c, i } = pick;
  const cost = buildCostOf(c, i);
  p.cash -= cost;
  c.bld = bldOf(c).slice();
  c.bld[i] = true;
  render();
  await sparkFx(c.idx);
  await moneyFx(p.id, 'bank', cost);
  sfx('build');
  tileLabelFx(c.idx, `🎁 ${BUILD_NAMES[i]}`, '#ffe082');
  log(`🎁 ${j(p.name, '이/가')} 출발지 보너스로 ${c.name}에 ${j(BUILD_NAMES[i], '을/를')} 지었습니다 (${fmt(cost)})`, 'good');
  toast(`🎁 <b>${p.name}</b> 출발지 보너스: ${c.name}에 ${BUILD_ICONS[i]}${BUILD_NAMES[i]} 건설`, 'sell');
}

// 땅 사기 / 건물 짓기 창: 별장·빌딩·호텔을 원하는 것만 골라 담음 → 선택한 건물 종류 목록을 돌려줌 (null이면 패스)
async function askBuildChoice(p, c, withLand) {
  const types = buildable(p, c);
  const mono = monoFactor(c, p.id);
  const groupLine = c.type === 'city'
    ? `<span class="gtag" style="background:${GROUPS[c.group].color}"></span>${GROUPS[c.group].name} 그룹${mono > 1 ? ' · 🌟 독점이라 통행료 2배!' : ''}`
    : '관광지 (건물 건설 불가)';
  const lapLine = c.type === 'city'
    ? `<br>${p.laps + 1}바퀴째라 <b>${allowedText(p)}</b>를 지을 수 있어요. 원하는 것만 골라 담으세요.`
    : '';
  const now = withLand ? '' : `<br>지금: ${bCount(c) ? bIcons(c) + ' ' + bNames(c) : '땅만'} · 통행료 ${fmt(tollOf(c))}`;
  const res = await askChoice(p, {
    title: withLand ? `${c.name} 구매` : `${c.name} 건물 짓기`,
    body: `${groupLine}${now}${lapLine}`,
    checks: types.map(i => ({
      id: i,
      label: `${BUILD_ICONS[i]} ${BUILD_NAMES[i]}`,
      sub: `-${fmt(buildCostOf(c, i))} / 통행료 +${fmt(Math.round(c.price * TOLL_ADD[i]) * mono)}`,
      cost: buildCostOf(c, i),
      toll: Math.round(c.price * TOLL_ADD[i]) * mono,
    })),
    summary: {
      baseCost: withLand ? c.price : 0,
      baseToll: withLand ? tollWith(c, NO_BLD(), p.id) : tollOf(c),
      cash: p.cash,
    },
    buttons: [
      { label: withLand ? '구매하기' : '짓기', value: 'ok', needsCash: true },
      { label: '패스', value: 'pass', cls: 'secondary' },
    ],
  }, { v: 'pass', sel: [] });
  if (!res || res.v !== 'ok') return null;
  // 친구 폰에서 온 답도 검증: 지을 수 있는 종류만, 돈이 넘으면 비싼 것부터 뺌
  let sel = (Array.isArray(res.sel) ? res.sel : []).map(Number).filter(i => types.includes(i));
  const total = () => (withLand ? c.price : 0) + sel.reduce((s, i) => s + buildCostOf(c, i), 0);
  while (sel.length && total() > p.cash) sel = sel.filter(i => i !== Math.max(...sel));
  if (total() > p.cash) return null;
  return sel;
}
// AI: 돈 여유가 되는 만큼 별장 → 빌딩 → 호텔 순으로 담음
function aiBuildChoice(p, c, baseCost) {
  const sel = [];
  let cost = baseCost;
  for (const i of buildable(p, c)) {
    const next = cost + buildCostOf(c, i);
    if (next <= p.cash && AI.wantBuild(game, p, c, next)) { sel.push(i); cost = next; }
  }
  return sel;
}
function applyBuild(c, sel) {
  c.bld = bldOf(c).slice();
  for (const i of sel) c.bld[i] = true;
}
const selText = sel => sel.map(i => BUILD_NAMES[i]).join('·');

async function landProperty(p, c) {
  if (c.owner === null) {
    if (p.cash < c.price) {
      log(`${j(p.name, '은/는')} ${j(c.name, '을/를')} 살 돈이 부족합니다`);
      return;
    }
    let sel = null;
    if (isPerson(p)) {
      sel = await askBuildChoice(p, c, true);
    } else {
      await sleep(AI_DELAY);
      if (AI.wantBuy(game, p, c)) sel = aiBuildChoice(p, c, c.price);
    }
    if (!sel) {
      log(`${j(p.name, '은/는')} ${j(c.name, '을/를')} 사지 않았습니다`);
      return;
    }
    const cost = c.price + sel.reduce((s, i) => s + buildCostOf(c, i), 0);
    p.cash -= cost;
    c.owner = p.id;
    applyBuild(c, sel);
    render();
    await moneyFx(p.id, 'bank', cost);
    if (sel.length) {
      sfx('build');
      log(`🏠 ${j(p.name, '이/가')} ${j(c.name, '을/를')} 구매하고 ${j(selText(sel), '을/를')} 지었습니다 (${fmt(cost)})`, 'good');
    } else {
      sfx('coin');
      log(`🏠 ${j(p.name, '이/가')} ${j(c.name, '을/를')} 구매했습니다 (${fmt(cost)})`, 'good');
    }
    if (c.type === 'city' && hasMonopoly(p.id, c.group)) {
      log(`🌟 ${j(p.name, '이/가')} ${GROUPS[c.group].name} 그룹을 독점했습니다! (통행료 2배)`, 'good');
    }
  } else if (c.owner === p.id) {
    if (c.type !== 'city') return;
    const types = buildable(p, c);
    if (types.length === 0) {
      if (bCount(c) < 3) log(`${j(p.name, '은/는')} ${p.laps + 1}바퀴째라 ${c.name}에 더 지을 수 있는 건물이 없습니다 (${allowedText(p)}까지)`);
      return;
    }
    if (!types.some(i => buildCostOf(c, i) <= p.cash)) {
      log(`${j(p.name, '은/는')} ${c.name}에 건물을 지을 돈이 부족합니다`);
      return;
    }
    let sel = null;
    if (isPerson(p)) {
      sel = await askBuildChoice(p, c, false);
    } else {
      await sleep(AI_DELAY);
      sel = aiBuildChoice(p, c, 0);
    }
    if (sel && sel.length) {
      const cost = sel.reduce((s, i) => s + buildCostOf(c, i), 0);
      p.cash -= cost;
      applyBuild(c, sel);
      render();
      await moneyFx(p.id, 'bank', cost);
      sfx('build');
      log(`${sel.map(i => BUILD_ICONS[i]).join('')} ${j(p.name, '이/가')} ${c.name}에 ${j(selText(sel), '을/를')} 건설했습니다 (${fmt(cost)})`, 'good');
    }
  } else {
    const owner = game.players[c.owner];
    const toll = tollOf(c);
    // 통행료 면제권은 원할 때만 사용 (아껴 뒀다가 비싼 곳에서 쓸 수 있음)
    if (p.freePass > 0) {
      const use = isPerson(p)
        ? await askChoice(p, yesNo('🎟️ 통행료 면제권',
            `${owner.name}의 <b>${c.name}</b> 통행료 <b>${fmt(toll)}</b>을 내야 해요.<br>면제권을 쓸까요? (보유 ${p.freePass}장)`,
            '면제권 쓰기', '그냥 내기'), false)
        : AI.wantUseFreePass(game, p, toll);
      if (use === true) {
        p.freePass--;
        log(`🎟️ ${j(p.name, '이/가')} 통행료 면제권으로 ${c.name} 통행료 ${fmt(toll)}을 면제받았습니다`, 'good');
        toast(`🎟️ <b>${p.name}</b> 면제권 사용 · ${c.name} 통행료 ${fmt(toll)} 면제`, 'sell');
        render();
        return;
      }
    }
    log(`💰 ${j(p.name, '이/가')} ${owner.name}에게 ${c.name} 통행료 ${fmt(toll)}을 냅니다`, 'bad');
    if (!isPerson(p)) await sleep(AI_DELAY / 2);
    await pay(p, toll, owner);
  }
}

async function drawKey(p) {
  if (game.keyDeck.length === 0) game.keyDeck = shuffle(KEY_CARDS.slice());
  const card = game.keyDeck.pop();
  log(`🔑 ${p.name} 황금열쇠 [${card.title}] ${card.desc}`, 'key');
  setMessage(`🔑 ${p.name}: <b>${card.title}</b> — ${card.desc}`);
  const speech = SPEECH[card.title] || `황금열쇠예요! ${card.desc}`;
  if (game.speed !== 0) {
    // 모두의 화면에 카드를 크게 보여주고, 뒤집힌 뒤 끝까지 읽은 다음에 효과를 반영
    const k = { no: KEY_CARDS.indexOf(card) + 1, title: card.title, desc: card.desc, who: `${ANIMALS[p.animal].emoji} ${p.name}의 황금열쇠` };
    showKeyCard(k);
    if (Net.isHost) Net.broadcast({ t: 'keycard', k });
    sfx('sparkle');
    await sleep(1300);
    voice(speech, keyVid(card));
    const len = await Sound.speechLength(speech, keyVid(card));
    // 앞 대사 뒤에 줄 서서 나오면 그만큼 더 기다림
    await sleep(Math.max(len, Sound.queueLeft()) * 1000 + 500);
    hideKeyCard();
    if (Net.isHost) Net.broadcast({ t: 'keyhide' });
    await sleep(300);
  }
  await card.act(p);
  render();
}

// ───────── 턴 진행 ─────────
async function takeTurn(p) {
  game.current = p;
  render();
  setMessage(`<b>${p.name}</b>의 차례`);
  if (!isPerson(p)) await sleep(AI_DELAY);
  else sayTo(p, '마이턴!', 'myturn');

  // 우주여행: 원하는 칸으로 이동
  if (p.spaceTravel) {
    p.spaceTravel = false;
    // 이용료 20만: 컬럼비아호 주인에게, 주인이 없으면 은행에 (주인 본인은 무료)
    const col = game.cells.find(c => c.name === '컬럼비아호');
    if (!col || col.owner !== p.id) {
      const colOwner = col && col.owner !== null ? game.players[col.owner] : null;
      log(`🚀 ${j(p.name, '이/가')} 우주여행 이용료 ${fmt(SPACE_FEE)}을 ${colOwner ? colOwner.name + '에게' : '은행에'} 냅니다`, 'bad');
      if (!await pay(p, SPACE_FEE, colOwner)) return;
    }
    let target;
    if (isPerson(p)) {
      if (p.ctrl === 'remote') setMessage(`🚀 <b>${p.name}</b>이(가) 우주여행 갈 곳을 고르는 중…`);
      sayTo(p, CHOOSE_SPEECH, 'choose');
      target = await thinking(p, askCell(p, '🚀 <b>우주여행!</b> 보드에서 가고 싶은 칸을 누르세요'));
    } else {
      await sleep(AI_DELAY);
      target = AI.chooseSpaceTarget(game, p);
    }
    log(`🚀 ${j(p.name, '이/가')} 우주여행으로 ${game.cells[target].name}에 갑니다`);
    await sparkFx(target);
    await moveTo(p, target);
    await resolveCell(p);
    return;
  }

  // 무인도
  if (p.islandTurns > 0 && p.escapeCards > 0) {
    const use = isPerson(p)
      ? await askChoice(p, yesNo('🎫 무인도 탈출권', `탈출권을 사용해 바로 나갈까요? (보유 ${p.escapeCards}장)`, '사용하기', '아껴두기'), true)
      : AI.wantUseEscape(game, p);
    if (use === true) {
      p.escapeCards--;
      p.islandTurns = 0;
      p.leaveIsland = false;
      log(`🎫 ${j(p.name, '이/가')} 탈출권으로 무인도를 탈출했습니다`, 'good');
      voice(ESCAPE_SPEECH, 'escape');
      render();
    }
  }
  // 3턴을 다 쉬었으면 굴리기 전에 모두에게 알림
  if (p.leaveIsland) {
    p.leaveIsland = false;
    if (p.pos === 10) {
      log(`🛶 ${j(p.name, '은/는')} 이번 턴에 무인도를 탈출합니다`, 'good');
      voice(ESCAPE_NOW_SPEECH, 'escapenow');
      await sleep(1200);
    }
  }
  if (p.islandTurns > 0) {
    const [a, b] = await doRoll(p);
    if (a === b) {
      p.islandTurns = 0;
      log(`🛶 ${j(p.name, '이/가')} 더블로 무인도를 탈출했습니다!`, 'good');
      voice(ESCAPE_SPEECH, 'escape');
      await sparkFx((p.pos + a + b) % 40);
      await moveForward(p, a + b);
      await resolveCell(p);
      return;
    }
    p.islandTurns--;
    if (p.islandTurns === 0) p.leaveIsland = true;
    log(p.islandTurns > 0
      ? `🏝️ ${p.name}: 무인도에 갇혀 있습니다 (남은 ${p.islandTurns}턴)`
      : `🏝️ ${j(p.name, '은/는')} 다음 턴에 무인도를 떠납니다`);
    render();
    return;
  }

  // 일반 턴: 더블이면 한 번 더
  let doubles = 0;
  while (true) {
    const [a, b] = await doRoll(p);
    if (a === b && ++doubles === 3) {
      log(`😱 ${p.name}: 3번 연속 더블! 무인도로 갑니다`, 'bad');
      sendToIsland(p);
      return;
    }
    await sparkFx((p.pos + a + b) % 40);
    await moveForward(p, a + b);
    await resolveCell(p);
    if (game.over || p.bankrupt || p.islandTurns > 0 || p.spaceTravel || a !== b) return;
    log(`🎲 더블! ${j(p.name, '이/가')} 한 번 더 굴립니다`);
    if (!isPerson(p)) await sleep(AI_DELAY);
  }
}

// ───────── 자동 저장 (혼자 하기) ─────────
// 폰을 접거나 앱이 강제로 닫혀도 다시 켜면 마지막 턴 시작부터 이어할 수 있게 매 턴 저장
// v2: 실제 부루마블 판으로 바뀌어서 예전 판의 저장은 쓰지 않음
const SAVE_KEY = 'bm-save-v3'; // v3: 건물을 따로따로 짓는 방식으로 바뀜
function saveGame() {
  if (Net.mode !== 'solo' || game.speed === 0 || game.over) return;
  try {
    const logs = [...$('log').children].slice(0, 40).map(e => [e.textContent, e.className.replace('log-entry', '').trim()]);
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      players: game.players, cells: game.cells, turn: game.turn, round: game.round, maxRounds: game.maxRounds,
      fund: game.fund, keyDeck: game.keyDeck.map(c => c.title), logs, savedAt: Date.now(),
    }));
  } catch (e) { /* 저장 공간이 없으면 저장 안 함 */ }
}
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    return s && Array.isArray(s.players) && Array.isArray(s.cells) ? s : null;
  } catch (e) { return null; }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ }
}

async function resumeFlow(s) {
  game.players = s.players;
  game.cells = s.cells;
  game.turn = s.turn;
  game.round = s.round;
  game.maxRounds = s.maxRounds;
  game.fund = s.fund;
  game.keyDeck = s.keyDeck.map(t => KEY_CARDS.find(c => c.title === t)).filter(Boolean);
  game.started = true;
  for (const [text, cls] of s.logs.slice().reverse()) log(text, cls);
  log('▶ 저장된 게임을 이어서 합니다', 'round');
  Board3D.initTokens(game.players);
  render();
  await gameLoop();
}

async function gameLoop() {
  while (!game.over) {
    const p = game.players[game.turn];
    if (!p.bankrupt) {
      saveGame();
      // 온라인: 턴 시작 상태를 모두에게 보내 둠 → 방장이 나가면 다음 사람이 여기서부터 이어받음
      if (Net.isHost) {
        lastCheckpoint = fullSnapshot();
        Net.broadcast({ t: 'checkpoint', state: lastCheckpoint });
        saveSession();
      }
      await takeTurn(p);
    }
    if (game.over) break;
    const next = (game.turn + 1) % game.players.length;
    if (next === 0) {
      game.round++;
      if (game.round > game.maxRounds) {
        game.round = game.maxRounds;
        endGame('⏰ 정해진 라운드 종료');
        break;
      }
      log(`── ${game.round}라운드 ──`, 'round');
    }
    game.turn = next;
    render();
    await sleep(250);
  }
}

function checkGameEnd() {
  if (game.over) return;
  const alive = alivePlayers();
  if (Net.mode === 'solo' && game.players[0].bankrupt) endGame('💥 파산했습니다…');
  else if (alive.length === 1) endGame(`🏆 ${alive[0].name} 승리!`);
  else if (Net.mode !== 'solo' && !alive.some(isPerson)) endGame('남은 사람이 모두 파산했어요');
}

function endGame(reason) {
  game.over = true;
  clearSave();
  clearSession();
  game.current = null;
  $('roll-btn').disabled = true;
  render();
  const ranking = game.players.slice().sort((a, b) => (a.bankrupt - b.bankrupt) || (assetsOf(b) - assetsOf(a)));
  const rows = ranking.map((p, i) =>
    `<tr><td>${i + 1}위 ${ANIMALS[p.animal].emoji} ${p.label}</td><td>${p.bankrupt ? '파산' : fmt(assetsOf(p))}</td></tr>`).join('');
  log(`🏁 게임 종료 — ${j(ranking[0].name, '이/가')} 승리했습니다!`, 'round');
  setMessage(`🏁 게임 종료 · <b>${ranking[0].name}</b> 승리`);
  const end = { t: 'end', reason, rows, winnerId: ranking[0].id };
  if (Net.isHost) Net.broadcast(end);
  showEnd(end);
}

function showEnd({ reason, rows, winnerId }) {
  game.over = true;
  clearSession();
  const winner = game.players[winnerId];
  const me = myPlayer();
  const won = me && me.id === winnerId;
  if (won) Sound.build(); else Sound.bad();
  showModal({
    title: won ? '🏆 승리했습니다!' : `${winner.name} 승리`,
    body: `${reason}<table>${rows}</table><div style="font-size:12px;color:#777;margin-top:6px">총자산 = 현금 + 땅·건물 투자액</div>`,
    buttons: [{ label: '처음으로', value: true }],
  }).then(() => location.reload());
}

function initCells() {
  game.cells = BOARD_DEF.map((d, i) => {
    const c = { idx: i, type: d.type, name: d.name, short: d.short || d.name, icon: d.icon, ticon: d.ticon, owner: null, bld: NO_BLD() };
    if (d.type === 'city') c.group = d.g;
    if (d.type === 'city' || d.type === 'tour') c.price = d.price;
    if (d.type === 'tour') c.toll = d.toll;
    return c;
  });
}

const BASE_PLAYER = { cash: START_CASH, pos: 0, laps: 0, islandTurns: 0, escapeCards: 0, freePass: 0, spaceTravel: false, bankrupt: false };

async function runGame(maxRounds) {
  game.maxRounds = maxRounds;
  game.started = true;
  Board3D.initTokens(game.players);
  log(`🎮 게임 시작! 시작 자금 ${fmt(START_CASH)}, ${maxRounds}라운드`, 'round');
  log(`── 1라운드 ──`, 'round');
  render();
  await gameLoop();
}

// ───────── 혼자 하기 ─────────
async function soloFlow() {
  const animal = await pickAnimal('내 말을 고르세요');
  const aiCount = await showModal({
    title: '🤖 AI 몇 명과 할까요?',
    body: `${ANIMALS[animal].emoji} ${j(ANIMALS[animal].name, '으로/로')} 플레이합니다`,
    buttons: [
      { label: 'AI 1명 (2인)', value: 1, cls: 'secondary' },
      { label: 'AI 2명 (3인)', value: 2 },
      { label: 'AI 3명 (4인)', value: 3, cls: 'secondary' },
    ],
  });
  const rounds = await pickRounds(`${aiCount + 1}명이 플레이합니다`);
  const others = shuffle(Object.keys(ANIMALS).filter(a => a !== animal));
  const players = [{ ...BASE_PLAYER, name: '나', label: '나', ctrl: 'local', animal }];
  for (let i = 0; i < aiCount; i++) {
    const profile = i % 2 ? 'cautious' : 'aggressive';
    players.push({ ...BASE_PLAYER, name: `AI ${i + 1}`, label: `AI ${i + 1} (${AI.profiles[profile].label})`, ctrl: 'ai', profile, animal: others[i] });
  }
  game.players = await drawOrder(players);
  await runGame(rounds);
}

// ───────── 순서 정하기: 뒤집힌 카드를 한 장씩 뽑아 1등부터 차례대로 ─────────
// 사람은 직접 고르고(친구는 자기 폰에서), AI는 남은 카드 중 아무거나. 뽑은 순위대로 자리(id·색)를 다시 매김
async function drawOrder(players) {
  const n = players.length;
  const deck = shuffle(Array.from({ length: n }, (_, i) => i + 1)); // 카드 자리 → 순위
  const taken = new Array(n).fill(null);
  const rankOf = new Map();
  // 뒤집힌 카드를 눌러도 아래 'n번 카드' 버튼을 누른 것과 같음 (친구 폰에서도 그대로 동작하도록 HTML 안에 넣음)
  const table = () => '<div class="draw-cards">' + deck.map((r, i) => taken[i] === null
    ? `<span class="dcard back" onclick="[...document.querySelectorAll('#modal-buttons button')].find(b => b.textContent.endsWith(' ${i + 1}번 카드'))?.click()">?</span>`
    : `<span class="dcard open">${r}등<small>${ANIMALS[taken[i].animal].emoji} ${taken[i].name}</small></span>`).join('') + '</div>';
  log('🃏 카드를 뽑아 순서를 정합니다', 'round');
  for (const p of players) {
    const free = deck.map((_, i) => i).filter(i => taken[i] === null);
    let slot;
    if (isPerson(p) && free.length > 1) {
      const fallback = free[Math.floor(Math.random() * free.length)];
      const v = await askChoice(p, {
        title: '🃏 순서 정하기',
        body: `${ANIMALS[p.animal].emoji} <b>${p.name}</b>${p.name === '나' ? '' : '님'}, 카드를 한 장 골라요!<br>숫자가 작을수록 먼저 시작해요${table()}`,
        buttons: free.map(i => ({ label: `🂠 ${i + 1}번 카드`, value: i, cls: 'secondary' })),
      }, fallback);
      slot = free.includes(v) ? v : fallback;
    } else {
      slot = free[Math.floor(Math.random() * free.length)];
      await sleep(AI_DELAY / 2);
    }
    taken[slot] = p;
    rankOf.set(p, deck[slot]);
    sfx('sparkle');
    log(`🃏 ${ANIMALS[p.animal].emoji} ${p.name}: ${deck[slot]}등`, deck[slot] === 1 ? 'good' : '');
    toast(`🃏 ${ANIMALS[p.animal].emoji} <b>${p.name}</b> ${deck[slot]}등!`, deck[slot] === 1 ? 'sell' : '');
  }
  const ordered = players.slice().sort((a, b) => rankOf.get(a) - rankOf.get(b));
  ordered.forEach((p, i) => { p.id = i; p.color = SEAT_COLORS[i]; });
  const result = ordered.map((p, i) => `${i + 1}등 ${ANIMALS[p.animal].emoji} ${p.name}`).join(' → ');
  log(`🏁 순서: ${result}`, 'round');
  if (Net.isHost) Net.broadcast({ t: 'toast', html: `🏁 순서: ${result}`, cls: 'sell' });
  if (players.some(p => p.ctrl === 'local')) {
    await showModal({ title: '🃏 순서가 정해졌어요!', body: table(), buttons: [{ label: '▶ 시작!', value: true }] });
  }
  return ordered;
}

function pickAnimal(text, taken = []) {
  return showModal({
    title: '🐾 말 고르기',
    body: text,
    buttons: Object.entries(ANIMALS).filter(([k]) => !taken.includes(k))
      .map(([k, a]) => ({ label: `${a.emoji} ${a.name}`, value: k, cls: 'secondary' })),
  });
}
function pickRounds(text) {
  return showModal({
    title: '몇 라운드로 할까요?',
    body: text,
    buttons: [
      { label: '20라운드', value: 20, cls: 'secondary' },
      { label: '30라운드', value: 30 },
      { label: '50라운드', value: 50, cls: 'secondary' },
    ],
  });
}

// 닉네임(과 방 코드) 입력
async function askProfile(withCode) {
  let saved = '';
  try { saved = localStorage.getItem('bm-name') || ''; } catch (e) { /* 저장소 없음 */ }
  let error = '';
  while (true) {
    const ok = await showModal({
      title: withCode ? '🚪 방 참가하기' : '🏠 방 만들기',
      body: `${withCode ? '<label class="field">방 코드<input id="in-code" maxlength="5" autocomplete="off" placeholder="예: K7P2Q" style="text-transform:uppercase"></label>' : ''}
        <label class="field">닉네임<input id="in-name" maxlength="8" placeholder="최대 8자" value="${cleanName(saved)}"></label>
        ${error ? `<div class="field-error">${error}</div>` : ''}`,
      buttons: [{ label: '다음', value: true }, { label: '취소', value: false, cls: 'secondary' }],
    });
    if (!ok) location.reload();
    const name = cleanName($('in-name').value);
    const code = withCode ? $('in-code').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
    if (!name) { error = '닉네임을 입력해 주세요'; continue; }
    if (withCode && code.length !== 5) { error = '방 코드 5자리를 입력해 주세요'; continue; }
    try { localStorage.setItem('bm-name', name); } catch (e) { /* 저장소 없음 */ }
    return { name, code };
  }
}

// ───────── 방장 ─────────
let lobby = null;

function freeAnimal(want) {
  const used = lobby.seats.map(s => s.animal);
  if (want && ANIMALS[want] && !used.includes(want)) return want;
  return Object.keys(ANIMALS).find(a => !used.includes(a));
}
function renameAIs() {
  let n = 0;
  for (const s of lobby.seats) if (s.ctrl === 'ai') s.name = `AI ${++n}`;
}
function seatListHtml() {
  return '<table>' + lobby.seats.map((s, i) =>
    `<tr><td><span style="color:${SEAT_COLORS[i]}">●</span> ${ANIMALS[s.animal].emoji} ${s.name}${i === 0 ? ' (방장)' : ''}</td><td>${s.ctrl === 'ai' ? '🤖 AI' : '접속'}</td></tr>`).join('') +
    `</table><div class="hint">${lobby.seats.length}/${MAX_SEATS}명</div>`;
}
function lobbyHtml() {
  return `<div class="room-code">${Net.code}</div>
    <div class="hint">친구에게 이 방 코드를 알려주세요. 친구는 "방 참가하기"에서 코드를 입력하면 돼요.</div>
    ${seatListHtml()}
    ${lobby.warn ? `<div class="field-error">${lobby.warn}</div>` : ''}`;
}
function updateLobby() {
  if (!lobby || !lobby.open) return;
  if (!$('modal').classList.contains('hidden')) $('modal-body').innerHTML = lobbyHtml();
  Net.broadcast({ t: 'lobby', html: seatListHtml() });
}

async function hostFlow() {
  const me = await askProfile(false);
  const animal = await pickAnimal(`${me.name}님의 말을 고르세요`);
  setMessage('방을 만드는 중…', true);
  try {
    await Net.createRoom();
  } catch (e) {
    await showModal({ title: '방 만들기 실패', body: e.message, buttons: [{ label: '처음으로', value: true }] });
    location.reload();
    return;
  }
  lobby = { open: true, seats: [{ name: me.name, animal, ctrl: 'local' }], warn: '' };
  setHostHandlers();

  while (true) {
    const v = await showModal({
      title: '🏠 대기실',
      body: lobbyHtml(),
      buttons: [
        { label: '🤖 AI 추가', value: 'add', cls: 'secondary' },
        { label: '🤖 AI 빼기', value: 'remove', cls: 'secondary' },
        { label: '▶ 게임 시작', value: 'start' },
      ],
    });
    lobby.warn = '';
    if (v === 'add') {
      if (lobby.seats.length < MAX_SEATS) lobby.seats.push({ name: '', animal: freeAnimal(), ctrl: 'ai' });
      else lobby.warn = `최대 ${MAX_SEATS}명까지예요`;
    } else if (v === 'remove') {
      const i = lobby.seats.map(s => s.ctrl).lastIndexOf('ai');
      if (i >= 0) lobby.seats.splice(i, 1);
    } else if (v === 'start') {
      if (lobby.seats.length >= 2) break;
      lobby.warn = '친구가 들어오거나 AI를 추가해서 2명 이상이 되어야 시작할 수 있어요';
    }
    renameAIs();
    updateLobby();
  }
  const rounds = await pickRounds(`${lobby.seats.length}명이 플레이합니다`);
  lobby.open = false;

  let aiN = 0;
  const seated = lobby.seats.map(s => {
    const isAI = s.ctrl === 'ai';
    const profile = isAI ? (++aiN % 2 ? 'aggressive' : 'cautious') : 'cautious';
    return {
      ...BASE_PLAYER, name: s.name, animal: s.animal, ctrl: s.ctrl, conn: s.conn || null, profile,
      label: isAI ? `${s.name} (${AI.profiles[profile].label})` : s.name,
    };
  });
  game.players = await drawOrder(seated);
  game.maxRounds = rounds;
  for (const p of game.players) {
    if (p.ctrl === 'remote') Net.send(p.conn, { t: 'start', you: p.id, state: fullSnapshot() });
  }
  await runGame(rounds);
}

// 방장 쪽 연결 처리: 대기실 입장, 게임 중 다시 들어오기, 나가기
function setHostHandlers() {
  Net.handlers.onJoin = (conn, msg) => {
    if (msg.v !== GAME_VERSION) {
      Net.send(conn, { t: 'reject', reason: `게임 버전이 달라요 (방장 v${GAME_VERSION}, 내 앱 v${msg.v || '?'}).<br>앱을 완전히 껐다가 다시 켜면 최신 버전으로 업데이트돼요.` });
      return;
    }
    if (msg.rejoin) { hostRejoin(conn, msg); return; }
    if (!lobby || !lobby.open) { Net.send(conn, { t: 'reject', reason: '이미 게임이 시작됐어요.' }); return; }
    if (lobby.seats.length >= MAX_SEATS) {
      // 자리가 차 있으면 AI 한 명을 빼고 사람을 받음
      const aiIdx = lobby.seats.map(s => s.ctrl).lastIndexOf('ai');
      if (aiIdx < 0) { Net.send(conn, { t: 'reject', reason: `방이 꽉 찼어요 (최대 ${MAX_SEATS}명).` }); return; }
      lobby.seats.splice(aiIdx, 1);
    }
    const seat = { name: cleanName(msg.name) || '친구', animal: freeAnimal(msg.animal), ctrl: 'remote', conn };
    lobby.seats.push(seat);
    renameAIs();
    lobby.warn = '';
    Net.send(conn, { t: 'welcome', animal: seat.animal });
    updateLobby();
  };
  Net.handlers.onLeave = conn => {
    if (lobby && lobby.open) {
      lobby.seats = lobby.seats.filter(s => s.conn !== conn);
      updateLobby();
      return;
    }
    const p = game.players.find(x => x.conn === conn);
    if (p) toAI(p, `📴 ${j(p.name, '이/가')} 나가서 AI가 대신 플레이합니다`);
  };
}

// 나간 사람 자리는 AI가 이어서 플레이 (나중에 다시 들어오면 되찾음)
function toAI(p, message) {
  p.ctrl = 'ai';
  p.profile = p.profile || 'cautious';
  p.conn = null;
  p.wasPerson = true;
  if (p.bankrupt) return;
  p.label = `${p.name} 🤖`;
  log(message, 'bad');
  render();
}

// 앱이 꺼졌던 사람이 같은 자리로 돌아옴
function hostRejoin(conn, msg) {
  const p = game.started ? game.players[msg.seatId] : null;
  const ok = p && p.ctrl !== 'local' && (p.ctrl === 'remote' || p.wasPerson) && p.name === cleanName(msg.name);
  if (!ok) { Net.send(conn, { t: 'reject', reason: '이 방에서 내 자리를 찾을 수 없어요.' }); return; }
  const old = p.conn;
  p.conn = conn;
  p.ctrl = 'remote';
  p.label = p.name;
  if (old && old !== conn && old.drop) old.drop(); // 예전 연결에 걸려 있던 질문은 기본값으로 정리
  // 시작 데이터(최근 기록 포함)를 먼저 보낸 뒤에 입장 기록을 남김
  Net.send(conn, { t: 'start', you: p.id, state: fullSnapshot(), checkpoint: lastCheckpoint });
  log(`🔄 ${j(p.name, '이/가')} 다시 들어왔습니다`, 'good');
  render();
}

// ───────── 온라인 이어하기 ─────────
let lastCheckpoint = null; // 가장 최근 턴 시작 시점의 전체 상태
const SESSION_KEY = 'bm-online-v1';
function saveSession() {
  const me = myPlayer();
  if (!me || Net.mode === 'solo') return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ code: Net.code, epoch: Net.epoch, seatId: me.id, name: me.name, animal: me.animal, at: Date.now() }));
  } catch (e) { /* 저장소 없음 */ }
}
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    return s && Date.now() - s.at < 3 * 3600 * 1000 ? s : null;
  } catch (e) { return null; }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* 무시 */ }
}

function clientHandlers() {
  Net.handlers.onMessage = onNetMessage;
  Net.handlers.onHostLost = onHostLost;
}
function rejoinHello() {
  const me = myPlayer();
  return { name: me.name, animal: me.animal, rejoin: true, seatId: me.id };
}
// 방장 질문에 답하던 중이었다면 화면을 정리
function resetLocalPrompts() {
  game.rollResolver = null;
  Board3D.disarmThrow();
  $('roll-btn').disabled = true;
  $('roll-btn').classList.remove('ready');
  game.choosing = null;
  Board3D.setChoosing(false);
  $('modal').classList.add('hidden');
}

// 방장이 끊기면: 순서상 다음 사람이 새 방장, 나머지는 새 방장에게 다시 접속
async function onHostLost() {
  if (game.over) return;
  if (!game.started || !lastCheckpoint) {
    showModal({ title: '📴 연결 끊김', body: '방장과의 연결이 끊어졌어요.', buttons: [{ label: '처음으로', value: true }] })
      .then(() => location.reload());
    return;
  }
  resetLocalPrompts();
  const cp = lastCheckpoint;
  const order = cp.players.filter(p => p.ctrl === 'person' && p.id !== cp.hostId).map(p => p.id);
  const k = order.indexOf(Net.myId);
  const code = Net.code, base = Net.epoch;
  const hello = rejoinHello();
  Net.reset();
  setMessage('📡 방장 연결이 끊겼어요. 새 방장을 정하는 중…', true);
  showToast('📡 방장이 나갔어요. 다음 순서 사람이 방장을 이어받아요', 'bankrupt');
  // k번째 후보는 앞사람이 방장이 되기를 잠시 기다렸다가, 아무도 없으면 직접 방장이 됨
  if (k > 0) {
    try { await Net.joinRoom(code, hello, base + 1, k * 12000); return; } catch (e) { /* 앞사람도 없음 */ }
  }
  if (k >= 0) {
    try { await becomeHost(cp, code, base + 1 + k); return; } catch (e) { /* 다른 사람이 먼저 방장이 됨 */ }
  }
  try {
    await Net.joinRoom(code, hello, base + 1, 30000);
  } catch (e) {
    showModal({ title: '📴 연결 끊김', body: '새 방장을 찾지 못했어요.', buttons: [{ label: '처음으로', value: true }] })
      .then(() => location.reload());
  }
}

async function becomeHost(cp, code, epoch) {
  await Net.createRoom(code, epoch);
  lobby = null;
  setHostHandlers();
  const myId = Net.myId;
  game.players = cp.players.map(p => {
    const q = { ...p, conn: null };
    if (p.id === myId) { q.ctrl = 'local'; q.label = p.name; }
    else if (p.id === cp.hostId) { q.ctrl = 'ai'; q.wasPerson = true; q.profile = q.profile || 'cautious'; q.label = `${p.name} 🤖`; }
    else if (p.ctrl === 'person') q.ctrl = 'remote'; // 다시 접속하기를 기다림
    return q;
  });
  game.cells = cp.cells;
  game.fund = cp.fund;
  game.round = cp.round;
  game.maxRounds = cp.maxRounds;
  game.turn = cp.turn;
  game.keyDeck = (cp.keyDeck || []).map(t => KEY_CARDS.find(c => c.title === t)).filter(Boolean);
  game.current = null;
  game.started = true;
  const oldHost = game.players[cp.hostId];
  log(`👑 ${j(myPlayer().name, '이/가')} 새 방장이 되었습니다 (이번 턴은 처음부터 다시 진행)`, 'round');
  if (oldHost && !oldHost.bankrupt) log(`📴 ${j(oldHost.name, '이/가')} 나가서 AI가 대신 플레이합니다`, 'bad');
  render();
  showToast('👑 내가 새 방장이 되었어요. 앱을 켜 두세요!', 'sell');
  setMessage('친구들이 다시 연결되기를 기다리는 중…', true);
  // 15초 안에 다시 붙지 않은 사람은 AI로
  const until = Date.now() + 15000;
  while (Date.now() < until && game.players.some(p => p.ctrl === 'remote' && !p.conn)) await sleep(300);
  for (const p of game.players) {
    if (p.ctrl === 'remote' && !p.conn) toAI(p, `📴 ${j(p.name, '이/가')} 다시 연결되지 않아 AI가 대신 플레이합니다`);
  }
  saveSession();
  await gameLoop();
}

async function rejoinFlow(s) {
  setMessage('방에 다시 연결하는 중…', true);
  clientHandlers();
  try {
    await Net.joinRoom(s.code, { name: s.name, animal: s.animal, rejoin: true, seatId: s.seatId }, s.epoch, 25000);
  } catch (e) {
    clearSession();
    await showModal({ title: '다시 들어가기 실패', body: `${e.message}<br>게임이 이미 끝났을 수도 있어요.`, buttons: [{ label: '처음으로', value: true }] });
    location.reload();
  }
}

// ───────── 친구(참가자) ─────────
async function joinFlow() {
  const me = await askProfile(true);
  const animal = await pickAnimal(`${me.name}님의 말을 고르세요 (다른 사람과 겹치면 남은 동물로 바뀌어요)`);
  setMessage('방에 연결하는 중…', true);
  clientHandlers();
  try {
    await Net.joinRoom(me.code, { name: me.name, animal });
  } catch (e) {
    await showModal({ title: '참가 실패', body: e.message, buttons: [{ label: '처음으로', value: true }] });
    location.reload();
    return;
  }
  setMessage('방장이 게임을 시작하기를 기다리는 중…', true);
  showModal({
    title: `🚪 방 ${me.code}`,
    body: '<div id="lobby-list">방장이 게임을 시작하기를 기다리는 중…</div>',
    buttons: [{ label: '나가기', value: true, cls: 'secondary' }],
  }).then(() => { if (!game.started) location.reload(); });
}

// 방장이 보낸 메시지 처리
function onNetMessage(msg) {
  switch (msg.t) {
    case 'lobby': {
      const el = $('lobby-list');
      if (el) el.innerHTML = msg.html;
      break;
    }
    case 'reject':
      showModal({ title: '참가할 수 없어요', body: msg.reason, buttons: [{ label: '처음으로', value: true }] })
        .then(() => location.reload());
      break;
    case 'start':
      game.started = true;
      game.over = false;
      resetLocalPrompts();
      Net.myId = msg.you;
      // 다시 들어온 경우 기록 창이 비어 있으면 최근 기록을 채움
      if (!$('log').children.length && msg.state.logs) for (const [text, cls] of msg.state.logs.slice().reverse()) log(text, cls);
      applyState(msg.state);
      Board3D.initTokens(game.players);
      lastCheckpoint = msg.checkpoint || msg.state;
      render();
      saveSession();
      break;
    case 'checkpoint':
      lastCheckpoint = msg.state;
      saveSession();
      break;
    case 'state': applyState(msg.state); break;
    case 'log': log(msg.msg, msg.cls); break;
    case 'msg': setMessage(msg.html); break;
    case 'hop': Board3D.hop({ id: msg.pid }, msg.idx, msg.ms); break;
    case 'money': Board3D.moneyFlow(msg.from, msg.to, msg.amount); break;
    case 'dice': Board3D.playRecording(msg.rec); break;
    case 'sfx': if (Sound[msg.name]) Sound[msg.name](); break;
    case 'say': Sound.say(msg.text, msg.vid); break;
    case 'think': Board3D.setThinking(msg.pid, msg.on); break;
    case 'keycard': showKeyCard(msg.k); break;
    case 'keyhide': hideKeyCard(); break;
    case 'spark': Board3D.sparkTile(msg.idx, 900); break;
    case 'tlabel': Board3D.tileLabel(msg.idx, msg.text, msg.color); break;
    case 'toast': showToast(msg.html, msg.cls); break;
    case 'ask': answerAsk(msg); break;
    case 'end': showEnd(msg); break;
  }
}

async function answerAsk(msg) {
  let value = null;
  if (msg.kind === 'modal') {
    value = await showModal(msg.spec);
  } else if (msg.kind === 'roll') {
    setMessage(MY_TURN_MSG, true);
    const opt = await waitForRoll();
    value = opt ? { dir: { x: opt.dir.x, z: opt.dir.z }, power: opt.power } : null;
  } else if (msg.kind === 'cell') {
    value = await chooseCell(msg.spec.msg);
  }
  Net.reply(msg.id, value);
}

// ───────── 링크(크롬)로 할 때: 주소창 없이 전체화면 + 가로로 고정 ─────────
// 앱(AndroidTTS 있음)이나 홈 화면에 추가해서 연 경우(standalone)는 이미 전체화면이라 건너뜀
function setupWebFullscreen() {
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    if (window.AndroidTTS) {
      // 앱에서는 필요 없음. 예전에 등록된 것이 옛 파일을 내주지 않도록 해제
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    } else {
      navigator.serviceWorker.register('sw.js').catch(() => { /* 설치 기능만 빠짐 */ });
    }
  }
  if (window.AndroidTTS || standalone || !document.documentElement.requestFullscreen) return;
  document.body.classList.add('web');
  const btn = $('full-btn');
  const goFull = () => {
    if (document.fullscreenElement) return;
    document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
      .catch(() => { /* 브라우저가 막으면 그냥 지금 화면으로 */ });
  };
  const sync = () => btn.classList.toggle('hidden', !!document.fullscreenElement);
  btn.onclick = e => { e.stopPropagation(); goFull(); };
  document.addEventListener('fullscreenchange', sync);
  // 첫 터치 때 자동으로 전체화면 (브라우저는 터치가 있어야 전체화면을 허락함)
  document.addEventListener('pointerup', goFull, { once: true });
  sync();
}

// ───────── 시작 ─────────
window.addEventListener('DOMContentLoaded', async () => {
  initCells();
  Board3D.init($('scene'), game.cells, { onTileTap: onCellClick });
  $('roll-btn').onclick = () => onRollClick(null);
  $('sound-btn').onclick = () => {
    Sound.muted = !Sound.muted;
    $('sound-btn').textContent = Sound.muted ? '🔇' : '🔊';
  };
  document.addEventListener('pointerdown', () => Sound.ensure(), { once: true });
  Sound.loadClips();
  setupWebFullscreen();
  // 가로 화면: 📋 버튼으로 자세한 정보 서랍 열기, 바깥(보드)을 누르면 닫기
  $('panel-btn').onclick = e => { e.stopPropagation(); document.body.classList.toggle('panel-open'); };
  $('mini-players').onclick = e => { e.stopPropagation(); document.body.classList.toggle('panel-open'); };
  $('scene').addEventListener('pointerdown', () => document.body.classList.remove('panel-open'));
  renderCenter();

  const saved = loadSave();
  const session = loadSession();
  const mode = await showModal({
    title: '🎲 부루마블',
    body: `시작 자금 ${fmt(START_CASH)} · 월급 ${fmt(SALARY)}<br>
      건물은 1바퀴째 별장, 2바퀴째 빌딩, 3바퀴째부터 호텔까지!<br>
      같은 색 도시를 모두 가지면 통행료 2배<br><br>어떻게 플레이할까요?
      <div class="hint">v${GAME_VERSION} · ${IS_ONLINE_BUILD ? '✅ 최신 버전 자동 업데이트됨' : '📦 앱 내장 버전 (인터넷 연결 시 자동 업데이트)'}<br>🎙️ 음성: 타입캐스트(Typecast) 베리</div>`,
    buttons: [
      ...(session ? [{ label: `🔄 온라인 게임 다시 들어가기 (방 ${session.code})`, value: 'rejoin' }] : []),
      ...(saved ? [{ label: `▶ 이어하기 (${saved.round}/${saved.maxRounds} 라운드)`, value: 'resume' }] : []),
      { label: saved ? '🤖 AI와 새 게임' : '🤖 AI와 혼자 하기', value: 'solo', cls: saved ? 'secondary' : '' },
      { label: '🏠 방 만들기', value: 'host', cls: 'secondary' },
      { label: '🚪 방 참가하기', value: 'join', cls: 'secondary' },
    ],
  });
  if (mode === 'rejoin') rejoinFlow(session);
  else if (mode === 'resume') resumeFlow(saved);
  else if (mode === 'solo') { clearSave(); soloFlow(); }
  else if (mode === 'host') hostFlow();
  else joinFlow();
});
