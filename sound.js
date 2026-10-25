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

  // 주사위가 부딪히는 소리: 짧은 잡음(딸깍) + 플라스틱 몸체 울림
  click(impact, pitch = 1) {
    if (this.muted || !this.ensure()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const vol = Math.min(1, impact / 9) * 0.9;
    if (vol < 0.03) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = (2600 + Math.random() * 1400) * pitch;
    bp.Q.value = 1.2;
    const g = this.out(0);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    src.connect(bp).connect(g);
    src.start(t, Math.random() * 0.5, 0.06);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime((900 + Math.random() * 300) * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(500 * pitch, t + 0.05);
    const g2 = this.out(0);
    g2.gain.setValueAtTime(vol * 0.35, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(g2);
    osc.start(t);
    osc.stop(t + 0.07);
  },

  // 손 안에서 주사위를 흔드는 소리
  rattle() {
    if (this.muted || !this.ensure()) return;
    for (let i = 0; i < 7; i++) {
      setTimeout(() => this.click(2.5 + Math.random() * 2.5, 1.3), i * 45 + Math.random() * 25);
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

  // 지폐 넘기는 소리: 짧은 '샥샥' 잡음 여러 번
  bills() {
    if (this.muted || !this.ensure()) return;
    const ctx = this.ctx;
    for (let i = 0; i < 4; i++) {
      const t = ctx.currentTime + i * 0.07;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3500;
      const g = this.out(0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      src.connect(hp).connect(g);
      src.start(t, Math.random() * 0.5, 0.1);
    }
  },

  // 도착 칸 반짝임: 높은 음이 빠르게 올라가는 '띠리링'
  sparkle() {
    if (this.muted || !this.ensure()) return;
    [1568, 1976, 2349, 3136].forEach((f, i) => this.tone(f, i * 0.06, 0.25, 0.06, 'sine'));
  },

  coin() {
    if (this.muted || !this.ensure()) return;
    this.tone(988, 0, 0.12, 0.15, 'square');
    this.tone(1319, 0.08, 0.3, 0.12, 'square');
  },

  pay() {
    if (this.muted || !this.ensure()) return;
    this.tone(523, 0, 0.15, 0.12, 'triangle');
    this.tone(392, 0.12, 0.25, 0.12, 'triangle');
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
