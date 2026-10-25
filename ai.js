// ai.js — AI 상대의 판단 로직
// game.js의 헬퍼(hasMonopoly, tollOf, buildCost, investment, propsOf)를 사용합니다.
'use strict';

const AI = {
  // 성격별 설정: 행동 후에 남겨둘 최소 현금(만)
  profiles: {
    aggressive: { label: '공격형', buyReserve: 10, buildReserve: 20, escapeDanger: Infinity },
    cautious:   { label: '신중형', buyReserve: 120, buildReserve: 140, escapeDanger: 6 },
  },

  // 같은 색 그룹에서 내가 / 남이 가진 칸 수
  groupInfo(game, p, group) {
    const cells = game.cells.filter(c => c.type === 'city' && c.group === group);
    const mine = cells.filter(c => c.owner === p.id).length;
    const others = cells.filter(c => c.owner !== null && c.owner !== p.id).length;
    return { total: cells.length, mine, others };
  },

  // 상대 중 누군가 이 그룹을 하나만 남기고 다 모았는지 (독점 저지용)
  opponentNearComplete(game, p, group) {
    const cells = game.cells.filter(c => c.type === 'city' && c.group === group);
    return game.players.some(o => o.id !== p.id && !o.bankrupt &&
      cells.filter(c => c.owner === o.id).length === cells.length - 1);
  },

  // 그룹 수집 관점에서 이 도시가 얼마나 매력적인지 (0~1, 클수록 매력적)
  groupDesire(game, p, cell) {
    if (cell.type !== 'city') return 0.2;
    const g = this.groupInfo(game, p, cell.group);
    if (g.mine + 1 === g.total) return 1;                       // 사면 그룹 완성
    if (this.opponentNearComplete(game, p, cell.group)) return 0.6; // 상대 독점 저지
    if (g.mine > 0 && g.others === 0) return 0.5;               // 모으는 중
    if (g.others === 0) return 0.3;                             // 아무도 손 안 댄 그룹
    return 0;                                                   // 이미 남이 섞인 그룹
  },

  wantBuy(game, p, cell) {
    if (p.cash < cell.price) return false;
    const prof = this.profiles[p.profile];
    const desire = this.groupDesire(game, p, cell);
    // 매력적인 땅일수록 현금 여유분을 덜 요구함
    const reserve = prof.buyReserve * (1.3 - desire);
    return p.cash - cell.price >= reserve;
  },

  wantBuild(game, p, cell, cost) {
    if (p.cash < cost) return false;
    const prof = this.profiles[p.profile];
    let reserve = prof.buildReserve;
    if (hasMonopoly(p.id, cell.group)) reserve *= 0.6; // 독점 도시는 통행료 2배라 투자 가치 높음
    return p.cash - cost >= reserve;
  },

  // 무인도 탈출권 사용 여부: 신중형은 보드가 위험하면 무인도에 머무름
  wantUseEscape(game, p) {
    const danger = game.cells
      .filter(c => c.owner !== null && c.owner !== p.id)
      .reduce((s, c) => s + c.level, 0);
    return danger < this.profiles[p.profile].escapeDanger;
  },

  // 돈이 모자랄 때 팔 순서: 그룹 전략상 덜 중요한 땅부터
  sellOrder(game, p) {
    const keepScore = c => {
      let s = investment(c);
      if (c.type === 'city') {
        if (hasMonopoly(p.id, c.group)) s += 1000;
        else if (this.groupInfo(game, p, c.group).mine > 1) s += 300;
      }
      return s;
    };
    return propsOf(p).sort((a, b) => keepScore(a) - keepScore(b));
  },

  // 우주여행 목적지 고르기
  chooseSpaceTarget(game, p) {
    let best = 0, bestScore = -Infinity;
    for (const c of game.cells) {
      if (c.type === 'space') continue;
      let s = 0;
      if (c.type === 'city' || c.type === 'tour') {
        if (c.owner === null) {
          s = this.wantBuy(game, p, c) ? 30 + this.groupDesire(game, p, c) * 50 : -5;
        } else if (c.owner === p.id) {
          if (c.type === 'city' && c.level < maxLevelFor(p) && this.wantBuild(game, p, c, buildCost(c))) {
            s = 25 + c.level * 10 + (hasMonopoly(p.id, c.group) ? 20 : 0);
          }
        } else {
          s = -tollOf(c);
        }
      } else if (c.type === 'fund') s = game.fund;
      else if (c.type === 'key') s = 8;
      else if (c.type === 'start') s = 5;
      else if (c.type === 'island') s = -40;
      else if (c.type === 'tax') s = -15;
      s += Math.random() * 3;
      if (s > bestScore) { bestScore = s; best = c.idx; }
    }
    return best;
  },
};
