import { Piece } from './Piece.js';
import { Board } from './Board.js';
import { StateManager } from '../../../shared/core/StateManager.js';
import { bus } from '../../../shared/core/EventBus.js';

/**
 * @class DominoGame
 * @description Classe principal que gerencia a lógica do jogo de dominó.
 */
export class DominoGame {
  constructor() {
    this.board = new Board();
    this.piecesPool = [];
    this.currentPlayer = 1;
    this.isSimulation = false;
    this.isActive = false;
    this.simulationInterval = null;

    // Estado reativo usando Shared StateManager
    this.state = new StateManager({
      currentPlayer: 1,
      piecesRemaining: 28,
      boardSize: 0,
      status: 'Aguardando início',
      lastLog: null
    });
  }

  /**
   * @method generateSet
   * @description Gera o conjunto completo de peças de dominó.
   * @returns {Piece[]} Array com as 28 peças.
   */
  generateSet() {
    const pieces = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        pieces.push(new Piece(i, j));
      }
    }
    return pieces;
  }

  /**
   * @method drawRandomPiece
   * @description Retira uma peça aleatória do monte.
   * @returns {Piece|null} A peça retirada ou null se vazio.
   */
  drawRandomPiece() {
    if (this.piecesPool.length === 0) return null;
    const index = Math.floor(Math.random() * this.piecesPool.length);
    const piece = this.piecesPool.splice(index, 1)[0];
    
    this.state.patch([['piecesRemaining', this.piecesPool.length]]);
    return piece;
  }

  /**
   * @method returnPiece
   * @description Devolve uma peça ao monte.
   * @param {Piece} piece - A peça a ser devolvida.
   */
  returnPiece(piece) {
    this.piecesPool.push(piece);
    this.state.patch([['piecesRemaining', this.piecesPool.length]]);
  }

  /**
   * @method tryInsertAtHead
   * @description Tenta inserir uma peça no início do tabuleiro.
   * @param {Piece} piece - A peça a inserir.
   * @returns {Object} Resultado da operação { success, code }.
   */
  tryInsertAtHead(piece) {
    const result = this.board.insertAtHead(piece);
    const success = result >= 0;
    
    this.logMove(piece, 'início', result, success);
    
    if (success) {
      this.state.patch([['boardSize', this.board.size]]);
      this.switchPlayer();
    }
    
    return { success, code: result };
  }

  /**
   * @method tryInsertAtTail
   * @description Tenta inserir uma peça no fim do tabuleiro.
   * @param {Piece} piece - A peça a inserir.
   * @returns {Object} Resultado da operação { success, code }.
   */
  tryInsertAtTail(piece) {
    const result = this.board.insertAtTail(piece);
    const success = result >= 0;

    this.logMove(piece, 'fim', result, success);

    if (success) {
      this.state.patch([['boardSize', this.board.size]]);
      this.switchPlayer();
    }

    return { success, code: result };
  }

  /**
   * @method switchPlayer
   * @description Alterna o jogador atual.
   */
  switchPlayer() {
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    this.state.patch([['currentPlayer', this.currentPlayer]]);
  }

  /**
   * @method isGameOver
   * @description Verifica se o jogo acabou (sem peças).
   * @returns {boolean} True se acabou.
   */
  isGameOver() {
    return this.piecesPool.length === 0;
  }

  /**
   * @method reset
   * @description Reinicia o jogo.
   */
  reset() {
    this.board.clear();
    this.piecesPool = this.generateSet();
    this.currentPlayer = 1;
    this.isActive = false;
    
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    this.state.reset({
      currentPlayer: 1,
      piecesRemaining: 28,
      boardSize: 0,
      status: 'Jogo reiniciado',
      lastLog: null
    });
    
    bus.emit('game:reset');
  }

  /**
   * @method startPlayerMode
   * @description Inicia o modo Jogador vs Jogador.
   */
  startPlayerMode() {
    this.reset();
    this.isSimulation = false;
    this.isActive = true;
    this.state.patch([['status', 'Modo Jogador Iniciado']]);
    bus.emit('game:mode-changed', 'player');
  }

  /**
   * @method startSimulationMode
   * @description Inicia o modo Simulação.
   */
  startSimulationMode() {
    this.reset();
    this.isSimulation = true;
    this.isActive = true;
    this.state.patch([['status', 'Modo Simulação Iniciado']]);
    bus.emit('game:mode-changed', 'simulation');
  }

  /**
   * @method stepSimulation
   * @description Executa um passo da simulação.
   * @returns {boolean} True se o passo foi executado, False se falhou ou acabou.
   */
  stepSimulation() {
    if (!this.isActive || this.isGameOver()) return false;

    const piece = this.drawRandomPiece();
    if (!piece) return false;

    const tryStart = Math.random() < 0.5;
    let result;
    
    // Tenta inserir, mas não usamos os métodos wrapper tryInsertAt... para evitar double logging ou lógica extra se quisermos controlar aqui
    // Mas como queremos reuso, vamos usar os wrappers e ignorar o retorno aqui, confiando no estado
    if (tryStart) {
        result = this.tryInsertAtHead(piece);
    } else {
        result = this.tryInsertAtTail(piece);
    }

    if (!result.success) {
      this.returnPiece(piece);
    }

    return true;
  }

  /**
   * @method logMove
   * @description Registra um movimento no log.
   */
  logMove(piece, position, code, success) {
    const logEntry = {
      player: this.currentPlayer,
      piece: piece.toString(),
      position: position,
      code: code,
      success: success,
      boardSize: this.board.size,
      timestamp: new Date()
    };
    
    this.state.patch([['lastLog', logEntry]]);
    bus.emit('game:log', logEntry);
  }
}
