// shared/render/CardRenderer.js
// Renderiza cartas como elementos SVG reutilizáveis

export class CardRenderer {
  /**
   * @param {Function} [templateFn] - (card) => string SVG innerHTML
   */
  constructor(templateFn = null) {
    this.templateFn = templateFn ?? CardRenderer.defaultTemplate;
  }

  /**
   * Cria um elemento SVG para a carta.
   * @param {Object} card
   * @returns {SVGElement}
   */
  renderCard(card) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 200 280');
    svg.setAttribute('width', '140');
    svg.setAttribute('height', '196');
    svg.classList.add('card');
    svg.dataset.cardId = card.id;
    svg.innerHTML = this.templateFn(card);
    return svg;
  }

  /**
   * Renderiza cartas em um container, retorna mapa id -> elemento.
   */
  renderAll(cards, container) {
    const map = new Map();
    cards.forEach(card => {
      const el = this.renderCard(card);
      container.appendChild(el);
      map.set(card.id, el);
    });
    return map;
  }

  /**
   * Template padrão — customizável por jogo.
   */
  static defaultTemplate(card) {
    const colors = {
      creature: { bg: '#1b4332', border: '#d4af37', text: '#a8e6cf' },
      spell:    { bg: '#1d3557', border: '#90e0ef', text: '#caf0f8' },
      artifact: { bg: '#3d2b1f', border: '#c9a96e', text: '#f0d9b5' },
      trap:     { bg: '#4a0e4e', border: '#da77ff', text: '#e9bcf5' },
    };
    const c = colors[card.type] ?? colors.spell;
    const desc = card.description ?? '';
    const descLines = desc.match(/.{1,28}/g) ?? [];

    return `
      <!-- Fundo -->
      <rect width="200" height="280" rx="14" fill="${c.bg}" stroke="${c.border}" stroke-width="3"/>

      <!-- Área da imagem -->
      <rect x="12" y="28" width="176" height="120" rx="8"
            fill="#000" fill-opacity="0.35" stroke="${c.border}" stroke-width="1.5"/>
      ${card.imageUrl
        ? `<image href="${card.imageUrl}" x="12" y="28" width="176" height="120" clip-path="url(#imgClip-${card.id})"/>`
        : `<text x="100" y="96" text-anchor="middle" fill="${c.border}" font-size="40" font-family="serif">${card.symbol ?? '✦'}</text>`}

      <!-- Nome -->
      <rect x="10" y="155" width="180" height="22" rx="4" fill="#000" fill-opacity="0.4"/>
      <text x="100" y="170" text-anchor="middle" fill="#fff"
            font-size="12" font-weight="bold" font-family="sans-serif">${card.name}</text>

      <!-- Tipo -->
      <text x="100" y="190" text-anchor="middle" fill="${c.border}"
            font-size="9" font-family="sans-serif" letter-spacing="1">${(card.type ?? '').toUpperCase()}${card.subtype ? ' — ' + card.subtype : ''}</text>

      <!-- Linha separadora -->
      <line x1="14" y1="195" x2="186" y2="195" stroke="${c.border}" stroke-width="0.8" stroke-opacity="0.5"/>

      <!-- Descrição -->
      ${descLines.slice(0, 3).map((line, i) =>
        `<text x="14" y="${207 + i * 12}" fill="${c.text}" font-size="9" font-family="sans-serif">${line}</text>`
      ).join('')}

      <!-- Custo (canto superior esquerdo) -->
      ${card.cost !== undefined ? `
        <circle cx="22" cy="22" r="16" fill="#1a6fc4" stroke="#fff" stroke-width="2"/>
        <text x="22" y="27" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold">${card.cost}</text>
      ` : ''}

      <!-- Poder / Resistência (canto inferior direito) -->
      ${card.power !== undefined ? `
        <rect x="136" y="256" width="50" height="18" rx="4" fill="#000" fill-opacity="0.6" stroke="${c.border}" stroke-width="1"/>
        <text x="161" y="269" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">${card.power}/${card.toughness ?? card.power}</text>
      ` : ''}

      <!-- Raridade (estrela no centro inferior) -->
      ${card.rarity ? `
        <text x="100" y="273" text-anchor="middle" fill="${
          { common: '#aaa', uncommon: '#7fc8f8', rare: '#ffd700', mythic: '#ff8c42' }[card.rarity] ?? '#aaa'
        }" font-size="10">
          ${{ common: '●', uncommon: '◆', rare: '★', mythic: '✦' }[card.rarity] ?? '●'}
        </text>
      ` : ''}
    `;
  }
}
