// shared/tcg/TurnManager.js
// Gerenciamento de turnos e temporizador por turno

import { bus } from '../core/EventBus.js';

export class TurnManager {
  /**
   * @param {string[]} playerIds
   * @param {Object}   options
   * @param {number}   [options.timeLimit=0]   segundos por turno (0 = sem limite)
   * @param {string[]} [options.phases]        fases do turno
   */
  constructor(playerIds, options = {}) {
    this._playerIds = playerIds;
    this._currentIndex = 0;
    this._phases = options.phases ?? ['draw', 'main', 'battle', 'end'];
    this._phaseIndex = 0;
    this._timeLimit = options.timeLimit ?? 0;
    this._timer = null;
    this._elapsed = 0;
    this._turnNumber = 0;
  }

  get currentPlayer() { return this._playerIds[this._currentIndex]; }
  get currentPhase()  { return this._phases[this._phaseIndex]; }
  get turnNumber()    { return this._turnNumber; }

  start() {
    this._turnNumber = 1;
    this._phaseIndex = 0;
    this._currentIndex = 0;
    this._startTimer();
    bus.emit('turn:start', { playerId: this.currentPlayer, phase: this.currentPhase, turn: this._turnNumber });
  }

  nextPhase() {
    this._phaseIndex++;
    if (this._phaseIndex >= this._phases.length) {
      this._phaseIndex = 0;
      this._nextPlayer();
    }
    this._resetTimer();
    bus.emit('turn:phase-change', { phase: this.currentPhase, playerId: this.currentPlayer });
  }

  endTurn() {
    this._phaseIndex = 0;
    this._nextPlayer();
    this._resetTimer();
  }

  _nextPlayer() {
    this._currentIndex = (this._currentIndex + 1) % this._playerIds.length;
    if (this._currentIndex === 0) this._turnNumber++;
    bus.emit('turn:start', { playerId: this.currentPlayer, phase: this.currentPhase, turn: this._turnNumber });
  }

  _startTimer() {
    if (!this._timeLimit) return;
    this._elapsed = 0;
    this._timer = setInterval(() => {
      this._elapsed++;
      bus.emit('turn:timer', { elapsed: this._elapsed, limit: this._timeLimit, remaining: this._timeLimit - this._elapsed });
      if (this._elapsed >= this._timeLimit) {
        bus.emit('turn:timeout', { playerId: this.currentPlayer });
        this.endTurn();
      }
    }, 1000);
  }

  _resetTimer() {
    clearInterval(this._timer);
    this._startTimer();
  }

  stop() {
    clearInterval(this._timer);
  }
}
