
/**
 * @class Player
 * @description Representa um jogador no jogo de dominó.
 */
export class Player {
  /**
   * @constructor
   * @param {number} id - ID do jogador.
   * @param {string} name - Nome do jogador.
   * @param {boolean} isBot - Se é um bot.
   */
  constructor(id, name, isBot = false) {
    this.id = id;
    this.name = name;
    this.isBot = isBot;
    this.hand = []; // Array de Piece
  }

  /**
   * @method addPiece
   * @param {Piece} piece - Peça a adicionar à mão.
   */
  addPiece(piece) {
    this.hand.push(piece);
  }

  /**
   * @method removePiece
   * @param {Piece} piece - Peça a remover da mão.
   * @returns {boolean} True se removeu com sucesso.
   */
  removePiece(piece) {
    const index = this.hand.findIndex(
      (p) => p.left === piece.left && p.right === piece.right
    );
    if (index !== -1) {
      this.hand.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * @method hasPiece
   * @param {Piece} piece
   * @returns {boolean}
   */
  hasPiece(piece) {
    return this.hand.some(
      (p) => p.left === piece.left && p.right === piece.right
    );
  }

  /**
   * @method getHand
   * @returns {Piece[]}
   */
  getHand() {
    return this.hand;
  }

  /**
   * @method countPieces
   * @returns {number}
   */
  countPieces() {
    return this.hand.length;
  }
}
