// shared/tcg/CardEngine.js
// Motor TCG genérico — regras plugáveis via objeto rules

import { bus } from '../core/EventBus.js';

export class CardEngine {
  /**
   * @param {Object} rules  Objeto de regras específico de cada jogo
   */
  constructor(rules) {
    this.rules = rules;
    this.state = null;
  }

  /**
   * Inicializa o estado de uma partida.
   * @param {string[]} playerIds
   * @param {Object}   deckMap    { [playerId]: Card[] }
   */
  initGame(playerIds, deckMap) {
    this.state = {
      players: {},
      turn: playerIds[0],
      phase: this.rules.phases[0],
      stack: [],
      turnNumber: 1,
    };

    playerIds.forEach(id => {
      this.state.players[id] = {
        id,
        hp:        this.rules.startingHp,
        mana:      0,
        maxMana:   0,
        hand:      [],
        field:     [],
        graveyard: [],
        deck:      this._shuffle([...(deckMap[id] ?? [])]),
      };
    });

    bus.emit('game:start', { state: this.state });
    this._startTurn(playerIds[0]);
  }

  /**
   * Aplica uma ação de um jogador.
   * @param {Object} action   { type, ...params }
   * @param {string} actorId
   * @returns {boolean} se a ação foi aceita
   */
  applyAction(action, actorId) {
    if (!this.state) return false;
    if (!this.rules.canAct(this.state, actorId, action)) return false;

    const result = this.rules.resolveAction(this.state, action, actorId);
    this._applyMutations(result.mutations ?? []);

    bus.emit('game:action', { action, actorId, result, state: this.state });
    return true;
  }

  /** Avança para a próxima fase / turno */
  nextPhase() {
    if (!this.state) return;
    const phases = this.rules.phases;
    const idx = phases.indexOf(this.state.phase);
    const nextIdx = (idx + 1) % phases.length;
    this.state.phase = phases[nextIdx];

    if (nextIdx === 0) {
      // Voltou à primeira fase → próximo turno
      const ids = Object.keys(this.state.players);
      const curIdx = ids.indexOf(this.state.turn);
      const nextPlayerId = ids[(curIdx + 1) % ids.length];
      this.state.turnNumber++;
      this._startTurn(nextPlayerId);
    }

    bus.emit('turn:phase-change', { phase: this.state.phase, turn: this.state.turn });
  }

  drawCard(playerId, count = 1) {
    const player = this.state.players[playerId];
    for (let i = 0; i < count; i++) {
      if (player.deck.length === 0) {
        bus.emit('player:deck-empty', { playerId });
        return;
      }
      const card = player.deck.shift();
      player.hand.push(card);
      bus.emit('card:drawn', { playerId, card });
    }
  }

  /** Retorna o oponente (assumindo 2 jogadores) */
  getOpponent(playerId) {
    return Object.keys(this.state.players).find(id => id !== playerId);
  }

  getState() {
    return this.state;
  }

  _startTurn(playerId) {
    this.state.turn = playerId;
    const player = this.state.players[playerId];
    player.maxMana = Math.min(player.maxMana + 1, this.rules.maxMana ?? 10);
    player.mana = player.maxMana;

    // Untap criaturas em campo
    player.field.forEach(card => { card.tapped = false; });

    this.drawCard(playerId, this.rules.drawPerTurn ?? 1);
    bus.emit('turn:start', { playerId, turnNumber: this.state.turnNumber });
  }

  _applyMutations(mutations) {
    mutations.forEach(({ type, target, value }) => {
      const player = this.state.players[target];
      if (!player) return;

      switch (type) {
        case 'damage':
          player.hp = Math.max(0, player.hp - value);
          bus.emit('player:damage', { target, value, hp: player.hp });
          break;
        case 'heal':
          player.hp += value;
          bus.emit('player:heal', { target, value, hp: player.hp });
          break;
        case 'mana':
          player.mana = Math.max(0, Math.min(player.maxMana, player.mana + value));
          break;
        case 'hand-remove':
          player.hand = player.hand.filter(c => c.id !== value);
          break;
        case 'field-add':
          player.field.push(value);
          bus.emit('card:played', { target, card: value });
          break;
        case 'field-remove':
          player.field = player.field.filter(c => c.id !== value);
          break;
        case 'graveyard':
          player.graveyard.push(value);
          bus.emit('card:destroyed', { target, card: value });
          break;
      }

      if (player.hp <= 0) {
        const winner = this.getOpponent(target);
        bus.emit('player:win', { winner, loser: target });
      }
    });
  }

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
