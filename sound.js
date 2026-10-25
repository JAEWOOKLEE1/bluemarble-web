// sound.js — 효과음 (파일 없이 Web Audio로 직접 합성)
'use strict';

const Sound = {
  ctx: null,
  noise: null,
  muted: false,

  // 브라우저 정책상 첫 터치 이후에 오디오를 켤 수 있음
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  out(gain) {
    const g = this.ctx.createGain();
    g.gain.value = gain;
    g.connect(this.ctx.destination);
    return g;
  },

  // 나무 주사위가 부딪히는 소리: 낮고 둥근 '똑' (나무 몸체 울림 두 개 + 아주 약한 마찰음)
  click(impact, pitch = 1) {
    if (this.muted || !this.ensure()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const vol = Math.min(1, impact / 10) * 0.5;
    if (vol < 0.02) return;

    const base = (380 + Math.random() * 120) * pitch;
    for (const [mul, amp, dur] of [[1, 1, 0.09], [2.7, 0.35, 0.05]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base * mul, t);
      osc.frequency.exponentialRampToValueAtTime(base * mul * 0.92, t + dur);
      const g = this.out(0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    }
    // 나무 표면이 닿는 느낌: 낮은 대역만 남긴 아주 짧은 잡음
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400 * pitch;
    const g = this.out(0);
    g.gain.setValueAtTime(vol * 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    src.connect(lp).connect(g);
    src.start(t, Math.random() * 0.5, 0.03);
  },

  // 손 안에서 나무 주사위를 흔드는 '달그락'
  rattle() {
    if (this.muted || !this.ensure()) return;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => this.click(2 + Math.random() * 2, 1.25), i * 55 + Math.random() * 25);
    }
  },

  tone(freq, start, dur, vol, type = 'sine') {
    const ctx = this.ctx, t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const g = this.out(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  // 말이 한 칸 뛸 때
  step() {
    if (this.muted || !this.ensure()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.08);
    const g = this.out(0);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.12);
  },

  // 지폐 세는 소리: 종이 끝을 엄지로 '촤르륵' 넘기는 부드러운 스침을 여러 번
  // (갑자기 커지는 소리가 아니라 살짝 커졌다 사라지게 → 총소리처럼 들리지 않음)
  bills() {
    if (this.muted || !this.ensure()) return;
    const ctx = this.ctx;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + i * 0.065 + Math.random() * 0.015;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(3200 + Math.random() * 800, t);
      bp.frequency.linearRampToValueAtTime(5200 + Math.random() * 800, t + 0.05);
      const g = this.out(0);
      const peak = 0.035 + Math.random() * 0.015;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
      src.connect(bp).connect(g);
      src.start(t, Math.random() * 0.5, 0.09);
    }
  },

  // 도착 칸 반짝임: 높은 음이 빠르게 올라가는 '띠리링'
  sparkle() {
    if (this.muted || !this.ensure()) return;
    [1568, 1976, 2349, 3136].forEach((f, i) => this.tone(f, i * 0.06, 0.25, 0.06, 'sine'));
  },

  // 음성 안내: 앱에서는 안드로이드 음성(높고 밝은 톤), 브라우저에서는 웹 음성으로 읽어줌
  say(text) {
    if (this.muted || !text) return;
    const t = String(text).replace(/<[^>]*>/g, '').replace(/(\d+)만/g, '$1만 원');
    try {
      if (window.AndroidTTS) { window.AndroidTTS.speak(t); return; }
    } catch (e) { /* 앱 음성 없음 */ }
    if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'ko-KR';
      u.pitch = 1.6;
      u.rate = 1.05;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
  },

  // 땅 구매 완료: 부드러운 '띵동'
  coin() {
    if (this.muted || !this.ensure()) return;
    this.tone(988, 0, 0.25, 0.08, 'sine');
    this.tone(1319, 0.1, 0.35, 0.07, 'sine');
  },

  build() {
    if (this.muted || !this.ensure()) return;
    [523, 659, 784].forEach((f, i) => this.tone(f, i * 0.08, 0.2, 0.12, 'triangle'));
  },

  bad() {
    if (this.muted || !this.ensure()) return;
    this.tone(220, 0, 0.5, 0.15, 'sawtooth');
    this.tone(165, 0.2, 0.6, 0.12, 'sawtooth');
  },
};
