// games/arena-3d/audio/ArenaSynth.js
// Sons procedurais para a Arena 3D — tiro, impacto, explosão, power-up

import { SoundSynth } from '../../../shared/audio/SoundSynth.js';

export class ArenaSynth extends SoundSynth {

  /** Tiro laser — pew descendente */
  playShoot() {
    this._osc(900, 0.14, { type: 'sawtooth', vol: 0.20, attack: 0.002,
      pitch: [[0.02, 500], [0.07, 220]] });
    this._noise(0.06, { vol: 0.06 });
  }

  shoot() { this.playShoot(); }

  /** Impacto no jogador — pancada seca */
  hit() {
    this._noise(0.15, { vol: 0.40 });
    this._osc(130, 0.20, { type: 'sine', vol: 0.30, attack: 0.002,
      pitch: [[0.05, 60]] });
  }

  /** Explosão — morte de jogador */
  explosion() {
    this._noise(0.50, { vol: 0.55 });
    this._osc(75,  0.45, { type: 'sawtooth', vol: 0.28, attack: 0.002,
      pitch: [[0.08, 38]] });
    this._at(0.05, () => this._noise(0.30, { vol: 0.30 }));
  }

  /** Power-up coletado — arpejo ascendente brilhante */
  powerUp() {
    this._osc(440, 0.09, { type: 'sine', vol: 0.22 });
    this._at(0.09, () => this._osc(660, 0.09, { type: 'sine', vol: 0.22 }));
    this._at(0.18, () => this._osc(880, 0.18, { type: 'sine', vol: 0.28 }));
  }

  /** Beep de contagem regressiva */
  beep(freq = 440) {
    this._osc(freq, 0.12, { type: 'sine', vol: 0.28, attack: 0.005 });
  }

  /** Colisão com obstáculo — baque surdo */
  bump() {
    this._noise(0.06, { vol: 0.15 });
    this._osc(85, 0.08, { type: 'square', vol: 0.14 });
  }

  /** Flash de dano no player local — baixo ameaçador */
  playerHurt() {
    this._osc(180, 0.12, { type: 'triangle', vol: 0.18, attack: 0.002,
      pitch: [[0.05, 90]] });
    this._noise(0.08, { vol: 0.20 });
  }
}
