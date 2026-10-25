// net.js — 친구와 온라인 대전 (PeerJS)
// 방장 폰이 게임 규칙을 진행하고, 친구 폰은 방장이 보낸 상태·연출을 받아 그리기만 함.
// 친구 차례의 선택(주사위 던지기, 구매 등)은 방장이 'ask'로 물어보고 친구가 'answer'로 답함.
// 방장이 바뀔 때마다 방 '세대(epoch)'가 1씩 올라감: 방 주소 = 코드-세대. 참가할 때는 여러 세대를 차례로 찾아봄.
'use strict';

const Net = {
  mode: 'solo',          // 'solo' | 'host' | 'client'
  PREFIX: 'bluemarble-ai-room-',
  TIMEOUT: 20000,        // 이 시간 동안 아무 신호가 없으면 끊긴 것으로 봄
  peer: null,
  code: '',
  epoch: 0,
  myId: null,
  conns: new Set(),      // 방장: 연결된 친구들
  hostConn: null,        // 친구: 방장과의 연결
  pending: new Map(),    // 방장: 답을 기다리는 질문
  seq: 0,
  handlers: {},          // onJoin, onLeave, onMessage, onHostLost

  get isHost() { return this.mode === 'host'; },
  get isClient() { return this.mode === 'client'; },

  newCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  },
  roomId(code, epoch) { return `${this.PREFIX}${code}-${epoch}`; },

  // 지금 연결을 모두 정리 (방장이 바뀔 때)
  reset() {
    clearInterval(this._watch);
    clearInterval(this._hb);
    this._hb = null;
    for (const [, p] of this.pending) p.resolve(p.fallback);
    this.pending.clear();
    this.conns.clear();
    this.hostConn = null;
    if (this.peer) { try { this.peer.destroy(); } catch (e) { /* 이미 닫힘 */ } }
    this.peer = null;
  },

  // ───────── 방장 ─────────
  // code를 주면 그 방의 다음 세대 방장이 됨 (방장 이어받기)
  createRoom(code = null, epoch = 0) {
    return new Promise((resolve, reject) => {
      const attempt = left => {
        const c = code || this.newCode();
        const peer = new Peer(this.roomId(c, epoch));
        let opened = false;
        peer.on('open', () => {
          opened = true;
          this.peer = peer;
          this.code = c;
          this.epoch = epoch;
          this.mode = 'host';
          resolve(c);
        });
        peer.on('connection', conn => this._accept(conn));
        peer.on('error', err => {
          if (opened) return;
          peer.destroy();
          if (err.type === 'unavailable-id' && !code && left > 0) attempt(left - 1);
          else reject(Object.assign(new Error(this._errText(err)), { type: err.type }));
        });
        peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
      };
      attempt(3);
    });
  },

  _accept(conn) {
    conn.on('open', () => {
      conn.lastSeen = Date.now();
      this.conns.add(conn);
      this._startHeartbeat();
    });
    conn.on('data', msg => {
      conn.lastSeen = Date.now();
      if (msg.t === 'answer') {
        const p = this.pending.get(msg.id);
        if (p) { this.pending.delete(msg.id); p.resolve(msg.value); }
      } else if (msg.t === 'hello' && this.handlers.onJoin) {
        this.handlers.onJoin(conn, msg);
      }
    });
    const drop = () => {
      if (!this.conns.has(conn)) return;
      this.conns.delete(conn);
      // 이 친구에게 묻고 있던 질문은 기본값으로 처리
      for (const [id, p] of this.pending) {
        if (p.conn === conn) { this.pending.delete(id); p.resolve(p.fallback); }
      }
      if (this.handlers.onLeave) this.handlers.onLeave(conn);
      try { conn.close(); } catch (e) { /* 이미 닫힘 */ }
    };
    conn.drop = drop;
    conn.on('close', drop);
    conn.on('error', drop);
  },

  // 앱을 갑자기 닫으면 연결 종료가 늦게 감지되므로, 3초마다 신호를 보내고 답이 없으면 끊긴 것으로 봄
  _startHeartbeat() {
    if (this._hb) return;
    this._hb = setInterval(() => {
      const now = Date.now();
      for (const c of [...this.conns]) {
        if (now - c.lastSeen > this.TIMEOUT) c.drop();
        else this.send(c, { t: 'ping' });
      }
    }, 3000);
  },

  send(conn, msg) {
    try { if (conn && conn.open) conn.send(msg); } catch (e) { /* 끊긴 연결은 무시 */ }
  },
  broadcast(msg) {
    for (const c of this.conns) this.send(c, msg);
  },
  // 친구에게 선택을 물어보고 답을 기다림. 연결이 끊기면 fallback으로 진행
  ask(conn, kind, spec, fallback) {
    if (!conn || !conn.open) return Promise.resolve(fallback);
    const id = ++this.seq;
    return new Promise(resolve => {
      this.pending.set(id, { resolve, fallback, conn });
      this.send(conn, { t: 'ask', id, kind, spec });
    });
  },

  // ───────── 친구 ─────────
  // fromEpoch부터 몇 세대를 돌아가며 찾다가 살아 있는 방장에게 붙음
  joinRoom(code, hello, fromEpoch = 0, totalMs = 15000) {
    code = code.trim().toUpperCase();
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      const deadline = Date.now() + totalMs;
      let done = false, epoch = fromEpoch, attemptNo = 0;
      const fail = text => {
        if (done) return;
        done = true;
        peer.destroy();
        reject(new Error(text));
      };
      const advance = no => {
        if (done || no !== attemptNo) return;
        epoch = epoch >= fromEpoch + 4 ? fromEpoch : epoch + 1;
        setTimeout(tryNext, 400);
      };
      const tryNext = () => {
        if (done) return;
        if (Date.now() > deadline) { fail('방을 찾을 수 없어요. 코드를 확인하거나 잠시 후 다시 해 주세요.'); return; }
        const no = ++attemptNo;
        const thisEpoch = epoch;
        const conn = peer.connect(this.roomId(code, thisEpoch), { reliable: true });
        const timer = setTimeout(() => { if (!conn.open) { try { conn.close(); } catch (e) { /* 무시 */ } advance(no); } }, 5000);
        conn.on('open', () => {
          clearTimeout(timer);
          if (done) { conn.close(); return; }
          done = true;
          this.peer = peer;
          this.hostConn = conn;
          this.code = code;
          this.epoch = thisEpoch;
          this.mode = 'client';
          conn.send({ t: 'hello', v: GAME_VERSION, ...hello });
          this._watchHost(conn);
          resolve();
        });
        conn.on('data', msg => {
          if (conn !== this.hostConn) return;
          this.hostLastSeen = Date.now();
          if (msg.t === 'ping') { this.send(conn, { t: 'pong' }); return; }
          if (this.handlers.onMessage) this.handlers.onMessage(msg);
        });
        skipCurrent = () => advance(no);
      };
      let skipCurrent = null;
      peer.on('open', tryNext);
      peer.on('error', err => {
        if (done) return;
        // 이 세대 방이 없으면 다음 세대를 찾아봄
        if (err.type === 'peer-unavailable') { if (skipCurrent) skipCurrent(); }
        else if (['network', 'server-error', 'browser-incompatible', 'ssl-unavailable', 'socket-error'].includes(err.type)) fail(this._errText(err));
      });
    });
  },

  // 방장에게서 일정 시간 소식이 없으면 끊긴 것으로 봄
  _watchHost(conn) {
    let lost = false;
    const hostLost = () => {
      if (lost || conn !== this.hostConn) return;
      lost = true;
      clearInterval(this._watch);
      if (this.handlers.onHostLost) this.handlers.onHostLost();
    };
    this.hostLastSeen = Date.now();
    clearInterval(this._watch);
    this._watch = setInterval(() => { if (Date.now() - this.hostLastSeen > this.TIMEOUT) hostLost(); }, 2000);
    conn.on('close', hostLost);
  },
  reply(id, value) { this.send(this.hostConn, { t: 'answer', id, value }); },

  _errText(err) {
    const map = {
      'peer-unavailable': '방을 찾을 수 없어요. 코드를 확인해 주세요.',
      'network': '인터넷 연결을 확인해 주세요.',
      'server-error': '연결 서버에 문제가 있어요. 잠시 후 다시 해 주세요.',
      'browser-incompatible': '이 기기에서는 온라인 대전을 지원하지 않아요.',
      'unavailable-id': '이미 다른 사람이 방장을 이어받았어요.',
    };
    return map[err.type] || `연결 오류 (${err.type || err.message})`;
  },
};
