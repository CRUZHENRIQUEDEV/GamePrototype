/**
 * SvgPieceCreator.js
 * Serviço para geração dinâmica de peças de jogos em SVG.
 * Evita o uso de assets hardcoded e permite customização programática.
 */

export class SvgPieceCreator {
  constructor() {
    this.defaultColors = {
      red: "#c0392b",
      redBorder: "#7b241c",
      redShine: "#e74c3c",
      white: "#ecf0f1",
      whiteBorder: "#95a5a6",
      whiteShine: "#ffffff",
      kingGold: "#f1c40f",
      shadow: "rgba(0,0,0,0.35)",
      dominoBg: "#fdfdfd",
      dominoBorder: "#cccccc",
      dominoDot: "#333333",
    };
  }

  /**
   * Cria uma string SVG para uma peça de Dama.
   * @param {string} color - 'red' ou 'white'
   * @param {boolean} isKing - Se é uma dama (rainha)
   * @param {number} size - Tamanho total do SVG (width/height)
   * @returns {string} String contendo o código SVG
   */
  createCheckersPiece(color, isKing, size = 60) {
    const colors = this.defaultColors;
    const isRed = color === "red";

    const mainColor = isRed ? colors.red : colors.white;
    const borderColor = isRed ? colors.redBorder : colors.whiteBorder;
    const shineColor = isRed ? colors.redShine : colors.whiteShine;

    // Cálculos de geometria baseados no tamanho
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 8; // Margem similar ao canvas original

    // Elementos do SVG
    const shadow = `<circle cx="${cx + 2}" cy="${cy + 3}" r="${r}" fill="${
      colors.shadow
    }" />`;

    const body = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${mainColor}" stroke="${borderColor}" stroke-width="2" />`;

    const shine = `<circle cx="${cx - r * 0.25}" cy="${cy - r * 0.28}" r="${
      r * 0.35
    }" fill="${shineColor}" opacity="0.6" />`;

    let crown = "";
    if (isKing) {
      const fontSize = Math.floor(size * 0.5);
      crown = `
        <text x="${cx}" y="${cy + 2}" 
              font-family="serif" font-weight="bold" font-size="${fontSize}" 
              fill="${
                colors.kingGold
              }" stroke="rgba(0,0,0,0.6)" stroke-width="0.8" 
              text-anchor="middle" dominant-baseline="middle">
          ♛
        </text>`;
    }

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        ${shadow}
        ${body}
        ${shine}
        ${crown}
      </svg>
    `.trim();
  }

  /**
   * Retorna a peça como um Data URL para uso em tags <img> ou CSS background.
   */
  createCheckersPieceDataUrl(color, isKing, size = 60) {
    const svgString = this.createCheckersPiece(color, isKing, size);
    const encodedSvg = encodeURIComponent(svgString);
    return `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
  }

  /**
   * Cria um elemento DOM Image com a peça renderizada.
   */
  createCheckersPieceImage(color, isKing, size = 60) {
    const img = new Image();
    img.src = this.createCheckersPieceDataUrl(color, isKing, size);
    img.width = size;
    img.height = size;
    return img;
  }

  /**
   * Cria uma string SVG para uma peça de Dominó.
   * @param {number} top - Valor da parte superior (0-6)
   * @param {number} bottom - Valor da parte inferior (0-6)
   * @param {number} width - Largura da peça (altura será width * 2)
   * @returns {string} String contendo o código SVG
   */
  createDominoPiece(top, bottom, width = 60) {
    const height = width * 2;
    const colors = this.defaultColors;
    const r = width * 0.1; // radius

    // Background e Borda
    const rect = `<rect x="1" y="1" width="${width - 2}" height="${
      height - 2
    }" rx="${r}" ry="${r}" fill="${colors.dominoBg}" stroke="${
      colors.dominoBorder
    }" stroke-width="2" />`;

    // Linha divisória
    const lineY = height / 2;
    const line = `<line x1="${width * 0.1}" y1="${lineY}" x2="${
      width * 0.9
    }" y2="${lineY}" stroke="${colors.dominoBorder}" stroke-width="1" />`;

    // Função auxiliar para desenhar pontos
    const drawPips = (val, offsetY) => {
      if (val === 0) return "";

      const size = width; // tamanho do quadrado da metade
      const pipR = width * 0.08; // raio do ponto
      const pips = [];

      // Coordenadas relativas (0 a 100%)
      const c1 = size * 0.25;
      const c2 = size * 0.5;
      const c3 = size * 0.75;

      const coords = {
        1: [[c2, c2]],
        2: [
          [c1, c1],
          [c3, c3],
        ],
        3: [
          [c1, c1],
          [c2, c2],
          [c3, c3],
        ],
        4: [
          [c1, c1],
          [c3, c1],
          [c1, c3],
          [c3, c3],
        ],
        5: [
          [c1, c1],
          [c3, c1],
          [c2, c2],
          [c1, c3],
          [c3, c3],
        ],
        6: [
          [c1, c1],
          [c3, c1],
          [c1, c2],
          [c3, c2],
          [c1, c3],
          [c3, c3],
        ],
      };

      (coords[val] || []).forEach(([x, y]) => {
        pips.push(
          `<circle cx="${x}" cy="${y + offsetY}" r="${pipR}" fill="${
            colors.dominoDot
          }" />`
        );
      });

      return pips.join("");
    };

    const topPips = drawPips(top, 0);
    const bottomPips = drawPips(bottom, height / 2);

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
            <feOffset dx="2" dy="2" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3"/>
            </feComponentTransfer>
            <feMerge> 
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/> 
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#dropShadow)">
            ${rect}
            ${line}
            ${topPips}
            ${bottomPips}
        </g>
      </svg>
    `.trim();
  }

  /**
   * Retorna a peça de dominó como Data URL.
   */
  createDominoPieceDataUrl(top, bottom, width = 60) {
    const svgString = this.createDominoPiece(top, bottom, width);
    const encodedSvg = encodeURIComponent(svgString);
    return `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
  }
}

export const pieceCreator = new SvgPieceCreator();
