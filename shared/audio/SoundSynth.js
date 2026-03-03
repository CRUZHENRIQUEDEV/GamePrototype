// shared/audio/SoundSynth.js
// Síntese de sons via Web Audio API — sem arquivos de áudio, tudo gerado em código

export class SoundSynth {
  constructor() {
    this._ctx    = null;
    this._master = null;
    this._ready  = false;
  }

  /**
   * Deve ser chamado dentro de um handler de gesto do usuário (click, touch).
   * Browsers bloqueiam AudioContext antes de interação.
   */
  init() {
    if (this._ready) return;
    this._ctx    = new AudioContext();
    this._master = this._ctx.createGain();
    this._master.connect(this._ctx.destination);
    this._master.gain.value = 0.85;
    this._ready = true;
  }

  resume() { this._ctx?.resume(); }

  setVolume(v) {
    if (this._master) this._master.gain.value = Math.max(0, Math.min(1, v));
  }

  // ── Primitivos internos ─────────────────────────────────────────────────

  /** Oscilador com envelope ADSR simplificado */
  _osc(freq, dur, opts = {}) {
    if (!this._ready) return;
    const { type = 'sine', vol = 0.3, attack = 0.005, pitch = [] } = opts;
    const ctx  = this._ctx;
    const t    = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(this._master);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    pitch.forEach(([dt, f]) => osc.frequency.setValueAtTime(f, t + dt));

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Ruído branco com decay — ótimo para percussão */
  _noise(dur, opts = {}) {
    if (!this._ready) return;
    const { vol = 0.2 } = opts;
    const ctx  = this._ctx;
    const t    = ctx.currentTime;
    const size = Math.ceil(ctx.sampleRate * dur);
    const buf  = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

    const src  = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    src.connect(gain);
    gain.connect(this._master);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start();
  }

  /** Agenda uma função para daqui a `sec` segundos */
  _at(sec, fn) { setTimeout(fn.bind(this), sec * 1000); }

  // ── Sons pré-definidos (reutilizáveis em qualquer jogo) ─────────────────

  /** Movimento de peça — click suave */
  move() {
    this._osc(560, 0.07, { type: 'sine', vol: 0.2, attack: 0.003 });
    this._noise(0.035, { vol: 0.07 });
  }

  /** Captura de peça — pop satisfatório */
  capture() {
    this._osc(260, 0.13, { type: 'sine', vol: 0.38, attack: 0.003,
      pitch: [[0.03, 130]] }); // frequência cai → sensação de impacto
    this._noise(0.065, { vol: 0.2 });
  }

  /** Captura encadeada — dois pops rápidos */
  chainCapture() {
    this.capture();
    this._at(0.2, this.capture);
  }

  /** Promoção a dama — arpejo ascendente */
  promotion() {
    this._osc(523, 0.14, { type: 'sine', vol: 0.28 });
    this._at(0.13, () => this._osc(659, 0.14, { type: 'sine', vol: 0.28 }));
    this._at(0.26, () => this._osc(784, 0.26, { type: 'sine', vol: 0.33 }));
  }

  /** Vitória — fanfarra curta */
  win() {
    this._osc(523,  0.1,  { type: 'sine', vol: 0.3 });
    this._at(0.13, () => this._osc(659,  0.1,  { type: 'sine', vol: 0.3 }));
    this._at(0.26, () => this._osc(784,  0.1,  { type: 'sine', vol: 0.3 }));
    this._at(0.39, () => this._osc(1047, 0.45, { type: 'sine', vol: 0.35 }));
  }

  /** Derrota — descida melancólica */
  lose() {
    this._osc(370, 0.2,  { type: 'sine', vol: 0.25 });
    this._at(0.22, () => this._osc(277, 0.2,  { type: 'sine', vol: 0.22 }));
    this._at(0.44, () => this._osc(185, 0.38, { type: 'sine', vol: 0.2 }));
  }

  /** Ação inválida — buzzer curto */
  error() {
    this._osc(140, 0.12, { type: 'square', vol: 0.18 });
  }

  /** Notificação de turno — ping suave */
  turnNotify() {
    this._osc(880,  0.15, { type: 'sine', vol: 0.14, attack: 0.02 });
    this._at(0.14, () => this._osc(1100, 0.22, { type: 'sine', vol: 0.11, attack: 0.02 }));
  }

  /** Movimento do oponente — click mais grave e suave */
  opponentMove() {
    this._osc(320, 0.07, { type: 'triangle', vol: 0.15, attack: 0.005 });
    this._noise(0.03, { vol: 0.05 });
  }

  /** Selecionar peça — toque leve */
  select() {
    this._osc(700, 0.05, { type: 'sine', vol: 0.1, attack: 0.003 });
  }
}
