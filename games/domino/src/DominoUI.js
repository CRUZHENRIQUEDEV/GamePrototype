import { PieceNames } from './Piece.js';
import { bus } from '../../../shared/core/EventBus.js';
import { UIManager } from '../../../shared/ui/UIManager.js';

/**
 * @class DominoUI
 * @description Gerencia a interface do usuário para o jogo de dominó.
 */
export class DominoUI {
  constructor(game) {
    this.game = game;
    this.uiManager = new UIManager();
    this.currentPiece = null;

    this.bindEvents();
    this.bindButtons();
    
    // Inicialização
    this.uiManager.register('playerControls', document.getElementById('playerControls'));
    this.uiManager.register('simulationControls', document.getElementById('simulationControls'));
    
    // Configura listeners do StateManager
    bus.on('state:updated', (state) => this.onStateUpdated(state));
    bus.on('game:log', (entry) => this.addLogEntry(entry));
    bus.on('game:mode-changed', (mode) => this.onModeChanged(mode));
    bus.on('game:reset', () => this.onGameReset());
  }

  bindEvents() {
    // Speed control
    const speedControl = document.getElementById("speedControl");
    if (speedControl) {
        speedControl.addEventListener("input", (e) => {
            const speed = parseInt(e.target.value);
            document.getElementById("speedDisplay").textContent = `${speed / 1000}s`;
        });
    }

    // Dark mode
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark");
    }
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
        if (event.matches) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    });
  }

  bindButtons() {
    document.getElementById('playerModeBtn').addEventListener('click', () => this.game.startPlayerMode());
    document.getElementById('simulationModeBtn').addEventListener('click', () => this.game.startSimulationMode());
    document.getElementById('resetBtn').addEventListener('click', () => this.game.reset());
    
    document.getElementById('insertStartBtn').addEventListener('click', () => this.handleInsertStart());
    document.getElementById('insertEndBtn').addEventListener('click', () => this.handleInsertEnd());
    
    document.getElementById('stepBtn').addEventListener('click', () => this.handleStepSimulation());
    document.getElementById('playPauseBtn').addEventListener('click', () => this.toggleSimulation());
    document.getElementById('fullSimBtn').addEventListener('click', () => this.runFullSimulation());
  }

  onStateUpdated(state) {
    document.getElementById('piecesRemaining').textContent = state.piecesRemaining;
    document.getElementById('boardSize').textContent = state.boardSize;
    document.getElementById('gameStatus').innerHTML = `<strong>Status:</strong> ${state.status}`;
    
    if (state.currentPlayer) {
        // Update turn info if needed
    }
  }

  onModeChanged(mode) {
    if (mode === 'player') {
        this.uiManager.show('playerControls');
        this.uiManager.hide('simulationControls');
        this.drawNewPiece();
    } else {
        this.uiManager.hide('playerControls');
        this.uiManager.show('simulationControls');
    }
    this.renderBoard();
  }

  onGameReset() {
    this.uiManager.hide('playerControls');
    this.uiManager.hide('simulationControls');
    this.currentPiece = null;
    this.renderBoard();
    this.clearLog();
    this.uiManager.toast('Jogo reiniciado', 'info');
  }

  drawNewPiece() {
    if (this.game.isGameOver()) {
        this.uiManager.toast('Jogo terminado! Sem mais peças.', 'warning');
        return;
    }
    
    this.currentPiece = this.game.drawRandomPiece();
    if (this.currentPiece) {
        this.renderCurrentPiece();
    }
  }

  renderCurrentPiece() {
    const display = document.getElementById("currentPieceDisplay");
    if (display && this.currentPiece) {
        display.innerHTML = this.createPieceHTML(this.currentPiece);
    } else if (display) {
        display.innerHTML = '';
    }
  }

  handleInsertStart() {
    if (!this.currentPiece) return;
    
    const result = this.game.tryInsertAtHead(this.currentPiece);
    
    if (!result.success) {
        this.game.returnPiece(this.currentPiece);
        this.uiManager.toast('Não encaixa no início!', 'error');
    } else {
        this.renderBoard();
        this.drawNewPiece();
    }
  }

  handleInsertEnd() {
    if (!this.currentPiece) return;
    
    const result = this.game.tryInsertAtTail(this.currentPiece);
    
    if (!result.success) {
        this.game.returnPiece(this.currentPiece);
        this.uiManager.toast('Não encaixa no fim!', 'error');
    } else {
        this.renderBoard();
        this.drawNewPiece();
    }
  }

  handleStepSimulation() {
    const result = this.game.stepSimulation();
    this.renderBoard();
    if (!result && this.game.isGameOver()) {
        this.uiManager.toast('Simulação finalizada', 'success');
    }
  }

  toggleSimulation() {
    const btn = document.getElementById("playPauseBtn");
    
    if (this.game.simulationInterval) {
        clearInterval(this.game.simulationInterval);
        this.game.simulationInterval = null;
        btn.textContent = "▶️ Play";
        btn.classList.remove("secondary");
    } else {
        const speed = parseInt(document.getElementById("speedControl").value);
        this.game.simulationInterval = setInterval(() => {
            const stepResult = this.game.stepSimulation();
            this.renderBoard();
            if (!stepResult || this.game.isGameOver()) {
                clearInterval(this.game.simulationInterval);
                this.game.simulationInterval = null;
                btn.textContent = "▶️ Play";
                btn.classList.remove("secondary");
                this.uiManager.toast('Simulação finalizada', 'success');
            }
        }, speed);
        btn.textContent = "⏸️ Pause";
        btn.classList.add("secondary");
    }
  }

  runFullSimulation() {
    if (this.game.simulationInterval) {
        clearInterval(this.game.simulationInterval);
        this.game.simulationInterval = null;
        document.getElementById("playPauseBtn").textContent = "▶️ Play";
    }

    let steps = 0;
    while (this.game.isActive && !this.game.isGameOver() && steps < 1000) {
        this.game.stepSimulation();
        steps++;
    }
    
    this.renderBoard();
    this.uiManager.toast(`Simulação completa: ${steps} passos`, 'info');
  }

  renderBoard() {
    const boardEl = document.getElementById("board");
    const pieces = this.game.board.getPieces();

    if (pieces.length === 0) {
      boardEl.innerHTML = '<p class="board-placeholder">Tabuleiro vazio</p>';
    } else {
      boardEl.innerHTML = pieces.map((piece) => this.createPieceHTML(piece)).join("");
    }
  }

  createPieceHTML(piece) {
    return `
        <div class="piece">
            <div class="piece-head">${PieceNames[piece.left]}</div>
            <div class="piece-head">${PieceNames[piece.right]}</div>
        </div>
    `;
  }

  addLogEntry(entry) {
    const log = document.getElementById("gameLog");
    const el = document.createElement("div");
    el.className = `log-entry ${entry.success ? "success" : "error"}`;
    
    const time = entry.timestamp.toLocaleTimeString();
    const message = `[${time}] Jogador ${entry.player}: ${entry.piece} (${entry.position}) → Código: ${entry.code}`;
    
    el.textContent = message;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  clearLog() {
    document.getElementById("gameLog").innerHTML = '<div class="log-entry info">Logs do jogo...</div>';
  }
}
