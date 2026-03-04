import { Piece } from "./Piece.js";
import { Board } from "./Board.js";
import { Player } from "./Player.js";
import { StateManager } from "../../../shared/core/StateManager.js";
import { bus } from "../../../shared/core/EventBus.js";

/**
 * @class DominoGame
 * @description Classe principal que gerencia a lógica do jogo de dominó.
 */
export class DominoGame {
  constructor() {
    this.board = new Board();
    this.piecesPool = [];
    this.players = [];
    this.currentPlayerIndex = 0;
    this.isSimulation = false;
    this.isActive = false;
    this.simulationInterval = null;
    this.numPlayers = 2; // Default 2

    // Estado reativo usando Shared StateManager
    this.state = new StateManager({
      currentPlayerIndex: 0,
      piecesRemaining: 28,
      boardSize: 0,
      status: "Aguardando início",
      lastLog: null,
      gameMode: null, // 'player', 'simulation', 'bot'
      winner: null,
    });

    this.lastWinnerId = null;
  }

  /**
   * @method initializeGame
   * @param {number} numPlayers - Número de jogadores (2, 3 ou 4).
   * @param {boolean} isBotMode - Se os oponentes são bots.
   */
  initializeGame(numPlayers = 2, isBotMode = true, playerNames = []) {
    // Se mudou o número de jogadores ou modo, talvez devêssemos limpar o lastWinnerId?
    // Por enquanto, mantemos se o ID ainda for válido.

    this.numPlayers = Math.max(2, Math.min(4, numPlayers));
    this.players = [];

    const p1Name = (playerNames[0] && playerNames[0].trim()) || "Você";
    this.players.push(new Player(1, p1Name, false));

    for (let i = 2; i <= this.numPlayers; i++) {
      const botName =
        (playerNames[i - 1] && playerNames[i - 1].trim()) || `Bot ${i - 1}`;
      this.players.push(new Player(i, botName, isBotMode));
    }

    this.reset();
    this.isActive = true;
    this.state.patch([
      ["status", `Jogo iniciado com ${this.numPlayers} jogadores`],
      ["gameMode", isBotMode ? "bot" : "pvp"],
      ["winner", null],
    ]);

    // Distribuir peças
    this.dealPieces();

    // Decidir quem começa (maior peça ou aleatório)
    this.decideFirstPlayer();

    bus.emit("game:start", { players: this.players });

    // Se o primeiro jogador for bot, iniciar o turno dele
    const firstPlayer = this.getCurrentPlayer();
    if (firstPlayer.isBot) {
      setTimeout(() => this.playBotTurn(), 1500);
    }
  }

  dealPieces() {
    const piecesPerPlayer = 7;

    this.players.forEach((player) => {
      for (let i = 0; i < piecesPerPlayer; i++) {
        const piece = this.drawRandomPiece();
        if (piece) {
          player.addPiece(piece);
        }
      }
    });

    // Atualizar estado
    this.state.patch([["piecesRemaining", this.piecesPool.length]]);
  }

  decideFirstPlayer() {
    let startPlayerIndex = -1;
    let startPiece = null;

    // 0. Verifica se há um vencedor da partida anterior
    if (this.lastWinnerId !== null) {
      const winnerIndex = this.players.findIndex(
        (p) => p.id === this.lastWinnerId
      );
      if (winnerIndex !== -1) {
        this.currentPlayerIndex = winnerIndex;
        this.state.patch([["currentPlayerIndex", this.currentPlayerIndex]]);

        const winnerName = this.players[winnerIndex].name;
        this.logMove(
          null,
          `Vencedor anterior (${winnerName}) inicia jogando qualquer peça`,
          -1,
          true
        );
        return;
      }
    }

    // 1. Procura pela maior carroça (6-6 até 0-0)
    for (let i = 6; i >= 0; i--) {
      for (let pIndex = 0; pIndex < this.players.length; pIndex++) {
        const player = this.players[pIndex];
        const doublePiece = player
          .getHand()
          .find((p) => p.left === i && p.right === i);

        if (doublePiece) {
          startPlayerIndex = pIndex;
          startPiece = doublePiece;
          break;
        }
      }
      if (startPlayerIndex !== -1) break;
    }

    // 2. Se ninguém tiver carroça, procura a peça com maior soma
    if (startPlayerIndex === -1) {
      let maxPips = -1;

      this.players.forEach((player, index) => {
        player.getHand().forEach((piece) => {
          const sum = piece.left + piece.right;
          // Se for maior, ou igual mas com maior lado (critério desempate simples)
          if (sum > maxPips) {
            maxPips = sum;
            startPlayerIndex = index;
            startPiece = piece;
          }
        });
      });
    }

    // Fallback de segurança
    if (startPlayerIndex === -1) startPlayerIndex = 0;

    this.currentPlayerIndex = startPlayerIndex;
    this.state.patch([["currentPlayerIndex", this.currentPlayerIndex]]);

    // Se temos uma peça inicial definida (por regra de carroça/maior), JOGA ELA AUTOMATICAMENTE
    // "Quem tá com Sena SEMPRE SAI" - interpretação: a peça é jogada.
    if (startPiece) {
      const pStr = `[${startPiece.left}-${startPiece.right}]`;
      // Loga que vai sair
      this.logMove(null, `Inicia o jogo com ${pStr}`, -1, true);

      // Joga a peça
      this.tryInsertAtHead(startPiece, this.players[startPlayerIndex]);
    } else {
      // Caso genérico (vencedor anterior escolhe)
      // O log já foi feito acima no bloco do lastWinnerId?
      // Não, lá em cima tem return.
      // Se caiu aqui, é porque NÃO tinha winner anterior.
      // Então startPiece DEVE existir se tiver peças.
    }
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
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

    this.state.patch([["piecesRemaining", this.piecesPool.length]]);
    return piece;
  }

  /**
   * @method returnPiece
   * @description Devolve uma peça ao monte.
   * @param {Piece} piece - A peça a ser devolvida.
   */
  returnPiece(piece) {
    this.piecesPool.push(piece);
    this.state.patch([["piecesRemaining", this.piecesPool.length]]);
  }

  /**
   * @method tryInsertAtHead
   * @description Tenta inserir uma peça no início do tabuleiro.
   * @param {Piece} piece - A peça a inserir.
   * @param {Player} player - O jogador que está tentando jogar (opcional).
   * @returns {Object} Resultado da operação { success, code }.
   */
  tryInsertAtHead(piece, player = null) {
    if (player && !player.hasPiece(piece)) {
      return { success: false, code: -2 }; // Jogador não tem a peça
    }

    const result = this.board.insertAtHead(piece);
    const success = result >= 0;

    if (success) {
      if (player) {
        player.removePiece(piece);
      }
      this.logMove(piece, "início", result, success);
      this.state.patch([["boardSize", this.board.size]]);

      if (player && player.countPieces() === 0) {
        this.endGame(player);
      } else {
        this.switchPlayer();
      }
    }

    return { success, code: result };
  }

  /**
   * @method tryInsertAtTail
   * @description Tenta inserir uma peça no fim do tabuleiro.
   * @param {Piece} piece - A peça a inserir.
   * @param {Player} player - O jogador que está tentando jogar (opcional).
   * @returns {Object} Resultado da operação { success, code }.
   */
  tryInsertAtTail(piece, player = null) {
    if (player && !player.hasPiece(piece)) {
      return { success: false, code: -2 }; // Jogador não tem a peça
    }

    const result = this.board.insertAtTail(piece);
    const success = result >= 0;

    if (success) {
      if (player) {
        player.removePiece(piece);
      }
      this.logMove(piece, "fim", result, success);
      this.state.patch([["boardSize", this.board.size]]);

      if (player && player.countPieces() === 0) {
        this.endGame(player);
      } else {
        this.switchPlayer();
      }
    }

    return { success, code: result };
  }

  endGame(winner) {
    this.isActive = false;
    this.lastWinnerId = winner ? winner.id : null;
    this.state.patch([
      ["status", `Fim de Jogo! Vencedor: ${winner.name}`],
      ["winner", winner],
    ]);
    bus.emit("game:over", { winner });
  }

  /**
   * @method playBotTurn
   * @description Executa o turno do Bot.
   */
  playBotTurn() {
    if (!this.isActive) return;

    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer.isBot) return; // Segurança

    const hand = currentPlayer.getHand();
    // Cria uma cópia para ordenar sem afetar a mão original
    let piecesToTry = [...hand];

    // Se o tabuleiro estiver vazio, prioriza jogar a maior carroça (ou maior peça)
    if (this.board.size === 0) {
      piecesToTry.sort((a, b) => {
        const isDoubleA = a.left === a.right;
        const isDoubleB = b.left === b.right;
        // Prioriza carroças
        if (isDoubleA && !isDoubleB) return -1;
        if (!isDoubleA && isDoubleB) return 1;
        // Desempate por soma (maior soma primeiro)
        return b.left + b.right - (a.left + a.right);
      });
    }

    // Lógica simples: tenta jogar qualquer peça que encaixe
    let played = false;

    // Tenta encontrar uma peça que encaixe
    for (const piece of piecesToTry) {
      // Tenta no inicio
      let result = this.board.canInsertAtHead(piece);
      if (result) {
        this.tryInsertAtHead(piece, currentPlayer);
        played = true;
        break;
      }

      // Tenta no fim
      result = this.board.canInsertAtTail(piece);
      if (result) {
        this.tryInsertAtTail(piece, currentPlayer);
        played = true;
        break;
      }
    }

    if (!played) {
      // Se não conseguiu jogar, compra ou passa
      // Regra: Se tem peças no monte, TEM QUE comprar até conseguir jogar ou o monte acabar.
      // Se não tem peças, passa a vez.

      if (this.piecesPool.length > 0) {
        // Tenta comprar e jogar em loop
        // Limite para evitar loops infinitos (embora não deva acontecer)
        let attempts = 0;
        const maxAttempts = 20;
        let boughtAndPlayed = false;

        while (this.piecesPool.length > 0 && attempts < maxAttempts) {
          const newPiece = this.drawRandomPiece();
          if (newPiece) {
            currentPlayer.addPiece(newPiece);
            this.logMove(newPiece, "comprou", -1, true); // Loga compra

            // Tenta jogar a peça comprada imediatamente
            let resultHead = this.board.canInsertAtHead(newPiece);
            if (resultHead) {
              this.tryInsertAtHead(newPiece, currentPlayer);
              boughtAndPlayed = true;
              break;
            }
            let resultTail = this.board.canInsertAtTail(newPiece);
            if (resultTail) {
              this.tryInsertAtTail(newPiece, currentPlayer);
              boughtAndPlayed = true;
              break;
            }
          }
          attempts++;
        }

        if (!boughtAndPlayed) {
          // Comprou tudo e não conseguiu jogar
          this.logMove(null, "passou a vez (após comprar)", -1, false);
          this.switchPlayer();
        }
      } else {
        // Monte vazio, passa a vez
        this.logMove(null, "passou a vez", -1, false);
        this.switchPlayer();
      }
    }
  }

  /**
   * @method canPlayerPass
   * @description Verifica se o jogador pode passar a vez.
   * Regra: Só pode passar se não tiver peças para jogar E o monte estiver vazio.
   */
  canPlayerPass(player) {
    // 1. Se tiver peças para comprar, não pode passar (deve comprar)
    if (this.piecesPool.length > 0) return false;

    // 2. Se tiver peça jogável, não pode passar
    const hand = player.getHand();
    for (const piece of hand) {
      if (this.board.canInsertAtHead(piece) || this.board.canInsertAtTail(piece)) {
        return false;
      }
    }

    // 3. Se não tem peça jogável e não tem o que comprar -> Pode passar
    return true;
  }

  /**
   * @method switchPlayer
   * @description Alterna o jogador atual.
   */
  switchPlayer() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.numPlayers;
    this.state.patch([["currentPlayerIndex", this.currentPlayerIndex]]);

    const nextPlayer = this.getCurrentPlayer();
    if (nextPlayer.isBot) {
      setTimeout(() => this.playBotTurn(), 1500); // Delay para UX
    }
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
    this.isSimulation = false;
    this.isBotMode = false;
    this.isActive = false;

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    this.state.reset({
      currentPlayer: 1,
      piecesRemaining: 28,
      boardSize: 0,
      status: "Jogo reiniciado",
      lastLog: null,
      gameMode: null,
    });

    bus.emit("game:reset");
  }

  /**
   * @method startPlayerMode
   * @description Inicia o modo Jogador vs Jogador.
   */
  startPlayerMode() {
    this.reset();
    this.isSimulation = false;
    this.isActive = true;
    this.state.patch([["status", "Modo Jogador Iniciado"]]);
    bus.emit("game:mode-changed", "player");
  }

  /**
   * @method startSimulationMode
   * @description Inicia o modo Simulação.
   */
  startSimulationMode() {
    this.reset();
    this.isSimulation = true;
    this.isActive = true;
    this.state.patch([["status", "Modo Simulação Iniciado"]]);
    bus.emit("game:mode-changed", "simulation");
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
      piece: piece ? piece.toString() : "-",
      position: position,
      code: code,
      success: success,
      boardSize: this.board.size,
      timestamp: new Date(),
    };

    this.state.patch([["lastLog", logEntry]]);
    bus.emit("game:log", logEntry);
  }
}
