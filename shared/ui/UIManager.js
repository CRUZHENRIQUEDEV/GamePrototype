// shared/ui/UIManager.js
// Gerenciamento de painéis, modais e overlays HTML/SVG

import { bus } from '../core/EventBus.js';

export class UIManager {
  constructor(root = document.body) {
    this.root = root;
    this._panels = new Map();   // id -> HTMLElement
    this._modals = [];

    bus.on('ui:modal-open',  ({ id, content, options }) => this.openModal(id, content, options));
    bus.on('ui:modal-close', ({ id }) => this.closeModal(id));
  }

  /** Registra um painel existente no DOM pelo id */
  register(id, element) {
    this._panels.set(id, element);
    return element;
  }

  show(id) { this._panels.get(id)?.classList.remove('hidden'); }
  hide(id) { this._panels.get(id)?.classList.add('hidden'); }
  toggle(id) { this._panels.get(id)?.classList.toggle('hidden'); }

  /**
   * Abre um modal genérico.
   * @param {string} id
   * @param {string|HTMLElement} content
   * @param {Object} options
   */
  openModal(id, content, options = {}) {
    const { title = '', confirmLabel = 'OK', cancelLabel = 'Cancelar', onConfirm, onCancel } = options;

    const overlay = document.createElement('div');
    overlay.className = 'ui-modal-overlay';
    overlay.dataset.modalId = id;
    overlay.innerHTML = `
      <div class="ui-modal">
        ${title ? `<div class="ui-modal__title">${title}</div>` : ''}
        <div class="ui-modal__body"></div>
        <div class="ui-modal__actions">
          ${onCancel ? `<button class="ui-btn ui-btn--secondary" data-action="cancel">${cancelLabel}</button>` : ''}
          <button class="ui-btn ui-btn--primary" data-action="confirm">${confirmLabel}</button>
        </div>
      </div>
    `;

    const body = overlay.querySelector('.ui-modal__body');
    if (typeof content === 'string') body.innerHTML = content;
    else body.appendChild(content);

    overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      onConfirm?.();
      this.closeModal(id);
    });
    overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      onCancel?.();
      this.closeModal(id);
    });

    this.root.appendChild(overlay);
    this._modals.push({ id, overlay });
    requestAnimationFrame(() => overlay.classList.add('ui-modal-overlay--visible'));
    return overlay;
  }

  closeModal(id) {
    const idx = this._modals.findIndex(m => m.id === id);
    if (idx === -1) return;
    const { overlay } = this._modals[idx];
    overlay.classList.remove('ui-modal-overlay--visible');
    setTimeout(() => overlay.remove(), 300);
    this._modals.splice(idx, 1);
  }

  closeAllModals() {
    [...this._modals].forEach(m => this.closeModal(m.id));
  }

  /** Exibe uma notificação/toast temporária */
  toast(message, type = 'info', duration = 2500) {
    const el = document.createElement('div');
    el.className = `ui-toast ui-toast--${type}`;
    el.textContent = message;
    this.root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('ui-toast--visible'));
    setTimeout(() => {
      el.classList.remove('ui-toast--visible');
      setTimeout(() => el.remove(), 400);
    }, duration);
  }

  /** Atualiza um contador/stat na HUD */
  setStat(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
}
