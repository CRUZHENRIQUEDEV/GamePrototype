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

    // Uma única peça - verifica conexão
    if (this.size === 1) {
      const headPiece = this.head.piece;

      // Tenta conectar na esquerda (HEAD)
      if (piece.getHeads().includes(headPiece.left)) {
        const newNode = new BoardNode(piece);
        newNode.next = this.head;
        this.head.prev = newNode;
        this.head = newNode;
        this.size++;
        return 2;
      }

      // Se não deu na esquerda, tenta conectar de qualquer jeito (vai pra direita/TAIL)
      if (piece.canConnectTo(headPiece)) {
        const newNode = new BoardNode(piece);
        newNode.prev = this.head;
        this.head.next = newNode;
        this.tail = newNode;
        this.size++;
        return 1;
      }
      return -1;
    }

    // Múltiplas peças
    // Verifica primeira casa (match na esquerda da head)
    const firstHeadLeft = this.head.piece.left;
    const pieceHeads = piece.getHeads();

    if (pieceHeads.includes(firstHeadLeft)) {
      const newNode = new BoardNode(piece);
      newNode.next = this.head;
      this.head.prev = newNode;
      this.head = newNode;
      this.size++;
      return 2;
    }

    // Verifica última casa (match na direita da tail)
    const lastHeadRight = this.tail.piece.right;
    if (pieceHeads.includes(lastHeadRight)) {
      const newNode = new BoardNode(piece);
      newNode.prev = this.tail;
      this.tail.next = newNode;
      this.tail = newNode;
      this.size++;
      return 1;
    }

    // Verifica casas intermediárias - busca do início
    let current = this.head;
    let steps = 0;

    while (current && current.next) {
      const currentRight = current.piece.right;
      const nextLeft = current.next.piece.left;

      if (pieceHeads.includes(currentRight) && pieceHeads.includes(nextLeft)) {
        // Insere entre current e current.next
        const newNode = new BoardNode(piece);
        newNode.prev = current;
        newNode.next = current.next;
        current.next.prev = newNode;
        current.next = newNode;
        this.size++;
        return this.size - steps - 1;
      }

      current = current.next;
      steps++;
    }

    return -1;
  }

  /**
   * @method insertAtTail
   * @description Tenta inserir uma peça no fim do tabuleiro.
   * @param {Piece} piece - A peça a ser inserida.
   * @returns {number} Código de resultado.
   */
  insertAtTail(piece) {
    if (this.size === 0) {
      const newNode = new BoardNode(piece);
      this.head = newNode;
      this.tail = newNode;
      this.size = 1;
      return 0;
    }

    if (this.size === 1) {
      if (piece.canConnectTo(this.head.piece)) {
        // Original logic for size 1 in insertAtTail: insert BEFORE head
        const newNode = new BoardNode(piece);
        newNode.next = this.head;
        this.head.prev = newNode;
        this.head = newNode;
        this.size++;
        return 1;
      }
      return -1;
    }

    // Múltiplas peças
    // Verifica primeira casa (match na esquerda da head)
    const firstHeadLeft = this.head.piece.left;
    const pieceHeads = piece.getHeads();

    if (pieceHeads.includes(firstHeadLeft)) {
      const newNode = new BoardNode(piece);
      newNode.next = this.head;
      this.head.prev = newNode;
      this.head = newNode;
      this.size++;
      return 2;
    }

    // Verifica última casa (match na direita da tail)
    const lastHeadRight = this.tail.piece.right;
    if (pieceHeads.includes(lastHeadRight)) {
      const newNode = new BoardNode(piece);
      newNode.prev = this.tail;
      this.tail.next = newNode;
      this.tail = newNode;
      this.size++;
      return 1;
    }

    // Verifica casas intermediárias - busca do FIM
    let current = this.tail;
    let steps = 0;

    while (current && current.prev) {
      const currentLeft = current.piece.left;
      const prevRight = current.prev.piece.right;

      if (pieceHeads.includes(currentLeft) && pieceHeads.includes(prevRight)) {
        // Insere entre current.prev e current
        const newNode = new BoardNode(piece);
        newNode.prev = current.prev;
        newNode.next = current;
        current.prev.next = newNode;
        current.prev = newNode;
        this.size++;
        return this.size - steps - 1;
      }

      current = current.prev;
      steps++;
    }

    return -1;
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
