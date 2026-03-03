// shared/ui/Tooltip.js
// Tooltips ao passar o mouse — suporta HTML e SVG

export class Tooltip {
  constructor() {
    this._el = document.createElement('div');
    this._el.className = 'ui-tooltip';
    this._el.style.cssText = `
      position:fixed; z-index:10000; pointer-events:none;
      background:#1a1a2e; color:#e0e0e0; border:1px solid #4a4a8a;
      border-radius:8px; padding:8px 12px; font-size:12px;
      max-width:220px; line-height:1.5;
      opacity:0; transition:opacity 0.15s;
      box-shadow:0 4px 16px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(this._el);
    this._target = null;

    document.addEventListener('mousemove', e => this._onMove(e));
    document.addEventListener('mouseover', e => this._onOver(e));
    document.addEventListener('mouseout',  e => this._onOut(e));
  }

  /**
   * Adiciona tooltip a um elemento.
   * @param {HTMLElement|SVGElement} element
   * @param {string|Function} content  string HTML ou função (element) => string
   */
  attach(element, content) {
    element.dataset.tooltip = typeof content === 'string' ? content : '__fn__';
    if (typeof content === 'function') element._tooltipFn = content;
  }

  _onOver(e) {
    const el = e.target.closest('[data-tooltip]');
    if (!el) return;
    this._target = el;
    const content = el._tooltipFn ? el._tooltipFn(el) : el.dataset.tooltip;
    this._el.innerHTML = content;
    this._el.style.opacity = '1';
  }

  _onOut(e) {
    if (!e.relatedTarget?.closest('[data-tooltip]')) {
      this._el.style.opacity = '0';
      this._target = null;
    }
  }

  _onMove(e) {
    if (!this._target) return;
    const margin = 12;
    let x = e.clientX + margin;
    let y = e.clientY + margin;
    const rect = this._el.getBoundingClientRect();
    if (x + rect.width  > window.innerWidth)  x = e.clientX - rect.width  - margin;
    if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - margin;
    this._el.style.left = x + 'px';
    this._el.style.top  = y + 'px';
  }
}
