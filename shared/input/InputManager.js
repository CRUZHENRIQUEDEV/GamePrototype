// shared/input/InputManager.js
// Entrada unificada: teclado, mouse e touch

import { bus } from '../core/EventBus.js';

export class InputManager {
  constructor(element = window) {
    this._pressed = new Set();
    this._bindings = new Map();   // keyCode -> [fn]
    this._pointer = { x: 0, y: 0 };

    element.addEventListener('keydown', e => {
      if (this._pressed.has(e.code)) return; // ignora repetição
      this._pressed.add(e.code);
      bus.emit('input:keydown', { code: e.code, key: e.key, event: e });
      this._bindings.get(e.code)?.forEach(fn => fn(e));
    });

    element.addEventListener('keyup', e => {
      this._pressed.delete(e.code);
      bus.emit('input:keyup', { code: e.code, key: e.key });
    });

    element.addEventListener('pointerdown', e => {
      this._pointer = { x: e.clientX, y: e.clientY };
      bus.emit('input:pointerdown', { x: e.clientX, y: e.clientY, button: e.button, event: e });
    });

    element.addEventListener('pointermove', e => {
      this._pointer = { x: e.clientX, y: e.clientY };
      bus.emit('input:pointermove', { x: e.clientX, y: e.clientY });
    });

    element.addEventListener('pointerup', e => {
      bus.emit('input:pointerup', { x: e.clientX, y: e.clientY, button: e.button });
    });

    element.addEventListener('wheel', e => {
      bus.emit('input:wheel', { delta: e.deltaY, event: e });
    }, { passive: true });
  }

  /** Registra atalho de teclado */
  bind(keyCode, fn) {
    if (!this._bindings.has(keyCode)) this._bindings.set(keyCode, []);
    this._bindings.get(keyCode).push(fn);
    return () => {
      const list = this._bindings.get(keyCode) ?? [];
      this._bindings.set(keyCode, list.filter(cb => cb !== fn));
    };
  }

  isPressed(keyCode) { return this._pressed.has(keyCode); }

  get pointer() { return { ...this._pointer }; }

  /** Converte coordenadas de tela para NDC (Three.js raycasting) */
  toNDC(x, y, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x:  ((x - rect.left) / rect.width)  * 2 - 1,
      y: -((y - rect.top)  / rect.height) * 2 + 1,
    };
  }
}
