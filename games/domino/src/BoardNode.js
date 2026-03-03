import { Piece } from './Piece.js';

/**
 * @class BoardNode
 * @description Nó de uma lista duplamente encadeada representando uma posição no tabuleiro.
 */
export class BoardNode {
  /**
   * @constructor
   * @param {Piece} piece - A peça contida neste nó.
   */
  constructor(piece) {
    this.piece = piece;
    this.next = null;
    this.prev = null;
  }
}
