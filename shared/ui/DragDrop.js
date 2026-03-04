// shared/ui/DragDrop.js
// Arrastar e soltar genérico para cartas e peças — touch e mouse

import { bus } from "../core/EventBus.js";

export class DragDrop {
  constructor(container = document.body) {
    this.container = container;
    this.dragging = null;
    this._ghost = null;
    this._offset = { x: 0, y: 0 };
    this._dropHandlers = new Map();

    container.addEventListener("pointerdown", (e) => this._start(e));
    window.addEventListener("pointermove", (e) => this._move(e));
    window.addEventListener("pointerup", (e) => this._end(e));
  }

  /**
   * Habilita arrastar em um elemento.
   * @param {HTMLElement|SVGElement} element
   * @param {Object} data  dados repassados no evento drop
   */
  enable(element, data) {
    element.dataset.draggable = "true";
    element.dataset.dragData = JSON.stringify(data);
    element.style.cursor = "grab";
  }

  /**
   * Transforma um elemento em zona de drop.
   * @param {HTMLElement} element
   * @param {string} accept  tipo aceito (ex: 'card', 'piece')
   * @param {Function} onDrop  (data, dropzone) => void
   */
  makeDropzone(element, accept, onDrop) {
    element.dataset.dropzone = accept;
    this._dropHandlers.set(element, onDrop);
  }

  _start(e) {
    const el = e.target.closest("[data-draggable]");
    if (!el) return;
    e.preventDefault();
    this.dragging = el;
    const rect = el.getBoundingClientRect();
    this._offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    this._ghost = el.cloneNode(true);
    Object.assign(this._ghost.style, {
      position: "fixed",
      pointerEvents: "none",
      opacity: "0.85",
      zIndex: "9999",
      width: rect.width + "px",
      height: rect.height + "px",
      transform: "rotate(3deg) scale(1.05)",
      transition: "transform 0.1s",
    });
    document.body.appendChild(this._ghost);
    el.style.opacity = "0.4";
    this._move(e);

    const data = JSON.parse(el.dataset.dragData);
    bus.emit("drag:start", { element: el, data });
  }

  _move(e) {
    if (!this._ghost) return;
    this._ghost.style.left = e.clientX - this._offset.x + "px";
    this._ghost.style.top = e.clientY - this._offset.y + "px";

    // Highlight dropzones
    document.querySelectorAll("[data-dropzone]").forEach((dz) => {
      const r = dz.getBoundingClientRect();
      const over =
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom;
      dz.classList.toggle("dropzone--active", over);
    });
  }

  _end(e) {
    if (!this.dragging) return;
    const data = JSON.parse(this.dragging.dataset.dragData);

    // Encontra dropzone sob o cursor
    this._ghost?.remove();
    this._ghost = null;
    this.dragging.style.opacity = "";
    const origin = this.dragging;
    this.dragging = null;

    const target = this._findDropzone(e.clientX, e.clientY, data);
    if (target) {
      target.classList.remove("dropzone--active");
      this._dropHandlers.get(target)?.(data, target, origin);
      bus.emit("drag:drop", { data, target, origin });
    } else {
      bus.emit("drag:cancel", { data, origin });
    }

    document
      .querySelectorAll(".dropzone--active")
      .forEach((dz) => dz.classList.remove("dropzone--active"));
    bus.emit("drag:end", { data });
  }

  _findDropzone(x, y, data) {
    for (const [el] of this._dropHandlers) {
      if (!document.body.contains(el)) {
        this._dropHandlers.delete(el);
        continue;
      }
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return el;
      }
    }
    return null;
  }
}
