// shared/core/StateManager.js
// Estado reativo com sincronização de rede (modelo host-autoritativo)

import { bus } from './EventBus.js';

export class StateManager {
  /**
   * @param {Object} initialState
   * @param {import('../network/NetworkManager.js').NetworkManager} network
   */
  constructor(initialState = {}, network = null) {
    this._state = structuredClone(initialState);
    this._version = 0;
    this._network = network;

    if (network) {
      bus.on('net:action', ({ type, payload }) => {
        if (type === 'state:sync' && !network.isHost) {
          this._state = payload.state;
          this._version = payload.version;
          bus.emit('state:updated', this._state);
        }
      });
    }
  }

  /** Lê um valor pelo caminho pontilhado. Ex: get('players.p1.hp') */
  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this._state);
  }

  /** Retorna o estado completo (leitura) */
  getAll() {
    return this._state;
  }

  /**
   * Aplica mutações e emite eventos.
   * @param {Array<[string, any]>} mutations  Ex: [['players.p1.hp', 15]]
   * @param {boolean} broadcast  Se true, envia sync para peers via rede
   */
  patch(mutations, broadcast = false) {
    mutations.forEach(([path, value]) => {
      const keys = path.split('.');
      const last = keys.pop();
      const target = keys.reduce((obj, key) => obj[key], this._state);
      if (target) target[last] = value;
    });
    this._version++;
    bus.emit('state:updated', structuredClone(this._state));

    if (broadcast && this._network?.isHost) {
      this._network.broadcast('state:sync', {
        state: this._state,
        version: this._version,
      });
    }
  }

  /** Substitui o estado inteiro */
  reset(newState = {}) {
    this._state = structuredClone(newState);
    this._version = 0;
    bus.emit('state:reset', this._state);
  }
}
