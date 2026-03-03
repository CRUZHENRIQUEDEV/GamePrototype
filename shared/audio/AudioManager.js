// shared/audio/AudioManager.js
// BGM, SFX e áudio espacial 3D via Web Audio API

export class AudioManager {
  constructor() {
    this.ctx = null;
    this._master = null;
    this._musicGain = null;
    this._sfxGain = null;
    this._buffers = new Map();
    this._musicSource = null;
    this._initialized = false;
  }

  /** Deve ser chamado após um gesto do usuário (click) */
  async init() {
    if (this._initialized) return;
    this.ctx = new AudioContext();
    this._master = this.ctx.createGain();
    this._musicGain = this.ctx.createGain();
    this._sfxGain = this.ctx.createGain();
    this._musicGain.connect(this._master);
    this._sfxGain.connect(this._master);
    this._master.connect(this.ctx.destination);
    this._musicGain.gain.value = 0.5;
    this._sfxGain.gain.value = 1.0;
    this._initialized = true;
  }

  /**
   * Pré-carrega um som.
   * @param {string} key
   * @param {ArrayBuffer} arrayBuffer  vindo do AssetLoader
   */
  async decode(key, arrayBuffer) {
    const buffer = await this.ctx.decodeAudioData(arrayBuffer);
    this._buffers.set(key, buffer);
  }

  /** Toca um efeito sonoro */
  playSound(key, options = {}) {
    if (!this._initialized) return;
    const buffer = this._buffers.get(key);
    if (!buffer) { console.warn(`[Audio] Som não carregado: ${key}`); return; }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop ?? false;
    const gain = this.ctx.createGain();
    gain.gain.value = options.volume ?? 1;
    source.connect(gain).connect(this._sfxGain);
    source.start(options.delay ? this.ctx.currentTime + options.delay : 0);
    return source;
  }

  /** Toca som com posicionamento 3D */
  playSpatial(key, position, options = {}) {
    if (!this._initialized) return;
    const buffer = this._buffers.get(key);
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const panner = new PannerNode(this.ctx, {
      panningModel: 'HRTF',
      positionX: position.x ?? 0,
      positionY: position.y ?? 0,
      positionZ: position.z ?? 0,
      refDistance: options.refDistance ?? 1,
      rolloffFactor: options.rolloffFactor ?? 1,
    });
    source.connect(panner).connect(this._sfxGain);
    source.start();
    return source;
  }

  /** Inicia música de fundo em loop */
  playMusic(key, fadeIn = 0.5) {
    if (!this._initialized) return;
    this.stopMusic();
    const buffer = this._buffers.get(key);
    if (!buffer) return;
    this._musicSource = this.ctx.createBufferSource();
    this._musicSource.buffer = buffer;
    this._musicSource.loop = true;
    this._musicSource.connect(this._musicGain);
    this._musicGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this._musicGain.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + fadeIn);
    this._musicSource.start();
  }

  stopMusic(fadeOut = 0.5) {
    if (!this._musicSource) return;
    const src = this._musicSource;
    this._musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fadeOut);
    setTimeout(() => { try { src.stop(); } catch {} }, fadeOut * 1000 + 50);
    this._musicSource = null;
  }

  setMasterVolume(v) { this._master.gain.value = Math.max(0, Math.min(1, v)); }
  setMusicVolume(v)  { this._musicGain.gain.value = Math.max(0, Math.min(1, v)); }
  setSfxVolume(v)    { this._sfxGain.gain.value = Math.max(0, Math.min(1, v)); }

  /** Resume o contexto caso suspenso pelo browser */
  resume() { return this.ctx?.resume(); }
}
