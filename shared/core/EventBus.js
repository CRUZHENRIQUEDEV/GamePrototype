// shared/core/EventBus.js
// Barramento de eventos global — comunicação desacoplada entre módulos

class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  /**
   * Registra um listener para um evento.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} função de unsubscribe
   */
  on(event, callback) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  /**
   * Registra um listener que dispara apenas uma vez.
   */
  once(event, callback) {
    const unsub = this.on(event, payload => {
      unsub();
      callback(payload);
    });
    return unsub;
  }

  off(event, callback) {
    const list = this._listeners.get(event) ?? [];
    this._listeners.set(event, list.filter(cb => cb !== callback));
  }

  emit(event, payload) {
    (this._listeners.get(event) ?? []).slice().forEach(cb => cb(payload));
  }

  clear(event) {
    if (event) this._listeners.delete(event);
    else this._listeners.clear();
  }
}

export const bus = new EventBus();
