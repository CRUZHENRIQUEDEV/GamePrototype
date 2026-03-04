import { BoardNode } from "./BoardNode.js";

/**
 * @class Board
 * @description Gerencia o tabuleiro do jogo de dominó usando uma lista duplamente encadeada.
 */
export class Board {
  constructor() {
    this.head = null;
    this.tail = null;
    this.size = 0;
  }

  /**
   * @method canInsertAtHead
   * @description Verifica se é possível inserir uma peça no início.
   * @param {Piece} piece
   * @returns {boolean}
   */
  canInsertAtHead(piece) {
    if (this.size === 0) return true;

    // Check if connects to head.piece.left
    const headLeft = this.head.piece.left;
    return piece.left === headLeft || piece.right === headLeft;
  }

  /**
   * @method canInsertAtTail
   * @description Verifica se é possível inserir uma peça no fim.
   * @param {Piece} piece
   * @returns {boolean}
   */
  canInsertAtTail(piece) {
    if (this.size === 0) return true;

    // Check if connects to tail.piece.right
    const tailRight = this.tail.piece.right;
    return piece.left === tailRight || piece.right === tailRight;
  }

  /**
   * @method insertAtHead
   * @description Tenta inserir uma peça no início do tabuleiro.
   * @param {Piece} piece - A peça a ser inserida.
   * @returns {number} Código de resultado: 0 (primeira peça), 1 (anexado), 2 (inserido antes), -1 (falha), ou valor calculado para inserção no meio.
   */
  insertAtHead(piece) {
    // Tabuleiro vazio - inclui automaticamente a primeira peça
    if (this.size === 0) {
      const newNode = new BoardNode(piece);
      this.head = newNode;
      this.tail = newNode;
      this.size = 1;
      return 0;
    }

    const headLeft = this.head.piece.left;

    // Verifica compatibilidade e orienta a peça
    if (piece.right === headLeft) {
      // Já está orientado corretamente [A|B] -> [B|C]
    } else if (piece.left === headLeft) {
      // Precisa girar [B|A] -> [B|C]
      // No dominó lógico, apenas trocamos a visualização ou a lógica?
      // Vamos trocar os valores lógicos para facilitar a cadeia
      const temp = piece.left;
      piece.left = piece.right;
      piece.right = temp;
    } else {
      return -1; // Não conecta
    }

    const newNode = new BoardNode(piece);
    newNode.next = this.head;
    this.head.prev = newNode;
    this.head = newNode;
    this.size++;
    return 2;
  }

  /**
   * @method insertAtTail
   * @description Tenta inserir uma peça no fim do tabuleiro.
   * @param {Piece} piece - A peça a ser inserida.
   * @returns {number} Código de resultado.
   */
  insertAtTail(piece) {
    if (this.size === 0) {
      return this.insertAtHead(piece);
    }

    const tailRight = this.tail.piece.right;

    // Verifica compatibilidade e orienta a peça
    if (piece.left === tailRight) {
      // Já está orientado corretamente [A|B] -> [B|C]
    } else if (piece.right === tailRight) {
      // Precisa girar
      const temp = piece.left;
      piece.left = piece.right;
      piece.right = temp;
    } else {
      return -1; // Não conecta
    }

    const newNode = new BoardNode(piece);
    newNode.prev = this.tail;
    this.tail.next = newNode;
    this.tail = newNode;
    this.size++;
    return 1;
  }

  /**
   * @method getPieces
   * @description Retorna todas as peças no tabuleiro em ordem.
   * @returns {Piece[]} Array de peças.
   */
  getPieces() {
    const pieces = [];
    let current = this.head;
    while (current) {
      pieces.push(current.piece);
      current = current.next;
    }
    return pieces;
  }

  /**
   * @method clear
   * @description Limpa o tabuleiro.
   */
  clear() {
    this.head = null;
    this.tail = null;
    this.size = 0;
  }
}
