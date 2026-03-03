/**
 * @enum {number}
 * @description Enumeração para os valores das pontas das peças de dominó.
 */
export const PieceValue = {
  BLANK: 0,
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  SIX: 6,
};

/**
 * @description Mapeamento de valores para nomes em string.
 */
export const PieceNames = {
  0: "BRANCO",
  1: "PIO",
  2: "DUQUE",
  3: "TERNO",
  4: "QUADRA",
  5: "QUINA",
  6: "SENA",
};

/**
 * @class Piece
 * @description Representa uma peça de dominó com dois lados (esquerda e direita).
 */
export class Piece {
  /**
   * @constructor
   * @param {number} left - Valor do lado esquerdo.
   * @param {number} right - Valor do lado direito.
   */
  constructor(left, right) {
    this.left = left;
    this.right = right;
  }

  /**
   * @method toString
   * @returns {string} Representação em string da peça.
   */
  toString() {
    return `[${PieceNames[this.left]}|${PieceNames[this.right]}]`;
  }

  /**
   * @method canConnectTo
   * @description Verifica se esta peça pode se conectar a outra peça.
   * @param {Piece} otherPiece - A outra peça para verificar conexão.
   * @returns {boolean} True se puder conectar, False caso contrário.
   */
  canConnectTo(otherPiece) {
    return (
      this.left === otherPiece.left ||
      this.left === otherPiece.right ||
      this.right === otherPiece.left ||
      this.right === otherPiece.right
    );
  }

  /**
   * @method getHeads
   * @description Retorna os valores das pontas desta peça.
   * @returns {number[]} Array contendo [esquerda, direita].
   */
  getHeads() {
    return [this.left, this.right];
  }
}
