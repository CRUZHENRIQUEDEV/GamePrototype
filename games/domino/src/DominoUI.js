import { Piece } from "./Piece.js";
import { bus } from "../../../shared/core/EventBus.js";
import { UIManager } from "../../../shared/ui/UIManager.js";
import { pieceCreator } from "../../../shared/render/SvgPieceCreator.js";
import { DragDrop } from "../../../shared/ui/DragDrop.js";
import { dominoNetwork } from "./DominoNetwork.js";

/**
 * @class DominoUI
 * @description Gerencia a interface do usuário para o jogo de dominó.
 * Suporta modo local (vs bots) e modo online (PeerJS P2P).
 */
export class DominoUI {
  constructor(game) {
    this.game = game;
    this.uiManager = new UIManager();
    this.dragDrop = new DragDrop();
    this.soundEnabled = true;
    this._audioCtx = null;
    this._ppr = 7;
    this._hStep = 58;
    this._selectedPlayers = 2;

    dominoNetwork.setGame(game);

    bus.on("state:updated", () => this.onStateUpdated());
    bus.on("game:start", (data) => this.onGameStart(data));
    bus.on("game:over", (data) => this.onGameOver(data));
    bus.on("game:log", (entry) => this.onGameLog(entry));
    bus.on("drag:drop", (e) => this.onPieceDrop(e));

    // Eventos de rede
    bus.on("net:room-ready", (d) => this.onNetRoomReady(d));
    bus.on("net:player-waiting", (d) => this.onNetPlayerWaiting(d));
    bus.on("net:player-named", (d) => this.onNetPlayerNamed(d));
    bus.on("net:player-disconnected", (d) => this.onNetPlayerDisconnected(d));
    bus.on("net:game-init", (d) => this.onNetGameInit(d));
    bus.on("net:state-update", (d) => this.onNetStateUpdate(d));
    bus.on("net:hand-update", (d) => this.onNetHandUpdate(d));

    this.bindEvents();
    this._checkAutoJoin();
  }

  // ─── Bind de Eventos DOM ──────────────────────────────────────────────────

  bindEvents() {
    // Player count buttons
    document.querySelectorAll(".count-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".count-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this._selectedPlayers = parseInt(btn.dataset.n, 10);
      });
    });

    // Bot mode: start local game
    document.getElementById("btn-bot")?.addEventListener("click", () => {
      const n = this._selectedPlayers;
      const myName =
        document.getElementById("player-name")?.value.trim() || "Você";
      const names = [myName];
      for (let i = 2; i <= n; i++) names.push(`Bot ${i - 1}`);
      this.game.initializeGame(n, true, names);
    });

    // Multiplayer: create room
    document
      .getElementById("btn-create")
      ?.addEventListener("click", async () => {
        const btn = document.getElementById("btn-create");
        btn.disabled = true;
        btn.textContent = "Criando...";

        const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
        const name =
          document.getElementById("player-name")?.value.trim() || "Você";
        try {
          await dominoNetwork.createRoom(roomId, name);
        } catch (e) {
          btn.disabled = false;
          btn.innerHTML = "<span>➕</span> Criar Sala Multiplayer";
          this.showCenterMessage("Erro ao criar sala: " + e.message, "error");
        }
      });

    // Multiplayer: join room
    document.getElementById("btn-join")?.addEventListener("click", async () => {
      const roomId = document
        .getElementById("room-input")
        ?.value.trim()
        .toUpperCase();
      if (!roomId) return;
      const btn = document.getElementById("btn-join");
      btn.disabled = true;
      btn.textContent = "Entrando...";
      const name =
        document.getElementById("player-name")?.value.trim() || "Convidado";
      try {
        await dominoNetwork.joinRoom(roomId, name);
        this._hideLobbyActions();
        this._showWaiting("Conectado! Aguardando o host iniciar…");
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Entrar";
        this.showCenterMessage("Erro ao entrar: " + e.message, "error");
      }
    });

    // Room info: copy code
    document
      .getElementById("btn-copy-id")
      ?.addEventListener("click", function () {
        const code = document.getElementById("room-id-display")?.textContent;
        if (code) _copyToClipboard(code, this);
      });

    // Room info: copy URL
    document
      .getElementById("btn-copy-url")
      ?.addEventListener("click", function () {
        const code = document.getElementById("room-id-display")?.textContent;
        if (code) {
          const url = `${location.origin}${location.pathname}?join=${code}`;
          _copyToClipboard(url, this);
        }
      });

    // Room info: host starts game
    document.getElementById("btn-start-net")?.addEventListener("click", () => {
      if (!dominoNetwork.isHost) return;
      const myName =
        document.getElementById("player-name")?.value.trim() || "Você";
      const names = [myName];
      // Collect client names from tags (added by onNetPlayerNamed)
      document
        .querySelectorAll("#waiting-list .net-player-tag:not(:first-child)")
        .forEach((tag, i) => {
          names.push(tag.textContent || `Jogador ${i + 2}`);
        });
      dominoNetwork.startNetworkGame(names);
    });

    // In-game: reset / quit
    document.getElementById("resetGameBtn")?.addEventListener("click", () => {
      dominoNetwork.disconnect();
      document.getElementById("game-area")?.classList.add("hidden");
      this._showLobby();
      this.game.isActive = false;
    });

    // In-game: pass turn
    document.getElementById("passTurnBtn")?.addEventListener("click", () => {
      const currentPlayer = this.game.getCurrentPlayer();

      // Validação local antes de qualquer ação
      if (!this.game.canPlayerPass(currentPlayer)) {
        this.showCenterMessage(
          "Você não pode passar! Jogue ou compre.",
          "warning"
        );
        this.playSound("invalid");
        return;
      }

      if (dominoNetwork.isNetworkMode && !dominoNetwork.isHost) {
        dominoNetwork.sendPass();
      } else {
        this.game.switchPlayer();
      }
    });

    // In-game: buy piece
    document.getElementById("buyPieceBtn")?.addEventListener("click", () => {
      this.handleBuyPiece();
    });

    // Sound toggle (now in fixed-controls, icon-btn)
    document.getElementById("soundToggleBtn")?.addEventListener("click", () => {
      this.soundEnabled = !this.soundEnabled;
      const btn = document.getElementById("soundToggleBtn");
      if (btn) {
        btn.textContent = this.soundEnabled ? "🔊" : "🔇";
        btn.title = this.soundEnabled ? "Som ativado" : "Som desativado";
      }
    });
  }

  // ─── Lobby helpers ────────────────────────────────────────────────────────

  _hideLobbyActions() {
    document.querySelector(".lobby-actions")?.classList.add("hidden");
    document.querySelector(".lobby-subtitle")?.classList.add("hidden");
  }

  _showRoomInfo(roomId) {
    this._hideLobbyActions();
    const roomInfo = document.getElementById("room-info");
    roomInfo?.classList.remove("hidden");
    const display = document.getElementById("room-id-display");
    if (display) display.textContent = roomId;
  }

  _showWaiting(msg) {
    const roomInfo = document.getElementById("room-info");
    roomInfo?.classList.remove("hidden");
    const waitingText = roomInfo?.querySelector(".waiting-text");
    if (waitingText) waitingText.textContent = msg;
  }

  _showLobby() {
    document.getElementById("lobby")?.classList.remove("hidden");
    document.querySelector(".lobby-actions")?.classList.remove("hidden");
    document.querySelector(".lobby-subtitle")?.classList.remove("hidden");
    document.getElementById("room-info")?.classList.add("hidden");
    document.getElementById("btn-start-net")?.classList.add("hidden");
    // Re-enable create button
    const btnCreate = document.getElementById("btn-create");
    if (btnCreate) {
      btnCreate.disabled = false;
      btnCreate.innerHTML = "<span>➕</span> Criar Sala Multiplayer";
    }
    // Re-enable join button
    const btnJoin = document.getElementById("btn-join");
    if (btnJoin) {
      btnJoin.disabled = false;
      btnJoin.textContent = "Entrar";
    }
    // Reset waiting list
    const list = document.getElementById("waiting-list");
    if (list)
      list.innerHTML = '<span class="net-player-tag">Você (host)</span>';
  }

  // ─── URL auto-join (like checkers) ────────────────────────────────────────

  _checkAutoJoin() {
    const params = new URLSearchParams(location.search);
    const joinCode = params.get("join");
    if (joinCode) {
      const input = document.getElementById("room-input");
      if (input) input.value = joinCode;
      document.getElementById("btn-join")?.click();
    }
  }

  // ─── Eventos de Rede ──────────────────────────────────────────────────────

  onNetRoomReady({ roomId, role }) {
    if (role === "host") {
      this._showRoomInfo(roomId);
      document.getElementById("btn-start-net")?.classList.remove("hidden");
    }
  }

  onNetPlayerWaiting({ slotIndex, count }) {
    const list = document.getElementById("waiting-list");
    if (list) {
      const tag = document.createElement("span");
      tag.className = "net-player-tag";
      tag.textContent = `Jogador ${slotIndex + 1}`;
      list.appendChild(tag);
    }
    const waitingText = document.querySelector("#room-info .waiting-text");
    if (waitingText)
      waitingText.textContent = `${count} jogador(es) conectado(s). Aguardando…`;
  }

  onNetPlayerNamed({ name }) {
    // Update the last added tag in waiting-list (skipping "Você (host)")
    const tags = document.querySelectorAll("#waiting-list .net-player-tag");
    if (tags.length > 1) tags[tags.length - 1].textContent = name;
  }

  onNetPlayerDisconnected() {
    this.showCenterMessage("Um jogador desconectou!", "warning");
  }

  onNetGameInit({ localPlayerId }) {
    dominoNetwork.localPlayerId = localPlayerId;
    document.getElementById("lobby")?.classList.add("hidden");
    document.getElementById("game-area")?.classList.remove("hidden");
    this.renderBoard();
    this.renderPlayers();
    this.updateStatus();
  }

  onNetStateUpdate(state) {
    dominoNetwork.remoteState = state;
    if (dominoNetwork.isNetworkMode && !dominoNetwork.isHost) {
      this._renderClientBoard(state);
      this._renderClientPlayers(state);
      this._updateClientStatus(state);
    }
  }

  onNetHandUpdate({ hand }) {
    if (dominoNetwork.isNetworkMode && !dominoNetwork.isHost) {
      this._renderClientHand(hand);
    }
  }

  // ─── Compra de Peça ────────────────────────────────────────────────────────

  handleBuyPiece() {
    if (dominoNetwork.isNetworkMode && !dominoNetwork.isHost) {
      dominoNetwork.sendDraw();
      return;
    }
    if (this.game.getCurrentPlayer().id !== 1) return;
    if (this.game.piecesPool.length > 0) {
      const piece = this.game.drawRandomPiece();
      if (piece) {
        this.game.players[0].addPiece(piece);
        this.game.logMove(piece, "comprou", -1, true);
        this.playSound("buy");
        this.renderPlayers();
        this.updateStatus();
      }
    } else {
      this.showCenterMessage("Monte esgotado!", "warning");
    }
  }

  // ─── Drop de Peça ──────────────────────────────────────────────────────────

  onPieceDrop(e) {
    const { data, target } = e;
    const pieceData = data.piece;

    if (dominoNetwork.isNetworkMode && !dominoNetwork.isHost) {
      const remSt = dominoNetwork.remoteState;
      if (!remSt) return;
      if (remSt.currentPlayerIndex !== dominoNetwork.localPlayerId - 1) {
        this.showCenterMessage("Não é sua vez!", "warning");
        return;
      }
      const zone = target.dataset.zone;
      if (zone === "head" || zone === "tail") {
        const piece = dominoNetwork.remoteHand.find(
          (p) => p.left === pieceData.left && p.right === pieceData.right
        );
        if (piece) dominoNetwork.sendAction(piece, zone);
      }
      return;
    }

    // Modo local
    const player = this.game.players[0];
    const piece = player
      .getHand()
      .find((p) => p.left === pieceData.left && p.right === pieceData.right);
    if (!piece) {
      this.showCenterMessage("Peça não encontrada!", "error");
      return;
    }
    if (this.game.getCurrentPlayer().id !== 1) {
      this.showCenterMessage("Não é sua vez!", "warning");
      return;
    }

    const isHead = target.dataset.zone === "head";
    const isTail = target.dataset.zone === "tail";
    let played = false;

    if (isHead && this.game.board.canInsertAtHead(piece)) {
      this.game.tryInsertAtHead(piece, player);
      played = true;
    } else if (isTail && this.game.board.canInsertAtTail(piece)) {
      this.game.tryInsertAtTail(piece, player);
      played = true;
    }

    if (!played && this.game.board.size === 0) {
      if (this.game.board.canInsertAtHead(piece)) {
        this.game.tryInsertAtHead(piece, player);
        played = true;
      }
    }

    if (!played) {
      this.playSound("invalid");
      this.showCenterMessage("Jogada inválida!", "error");
    }
  }

  // ─── Eventos do Jogo ───────────────────────────────────────────────────────

  onGameStart() {
    document.getElementById("lobby")?.classList.add("hidden");
    document.getElementById("game-area")?.classList.remove("hidden");
    this.renderBoard();
    this.renderPlayers();
    this.updateStatus();
    if (dominoNetwork.isNetworkMode && dominoNetwork.isHost) {
      dominoNetwork.broadcastState();
    }
  }

  onGameOver(data) {
    this.updateStatus();
    this.playSound("win");
    this.showCenterMessage(`🏆 ${data.winner.name} venceu!`, "success", 4000);
  }

  onGameLog() {}

  onStateUpdated() {
    if (dominoNetwork.isNetworkMode && dominoNetwork.isHost) {
      dominoNetwork.broadcastState();
    }
    this.renderBoard();
    this.renderPlayers();
    this.updateStatus();
  }

  // ─── Status / Controles ────────────────────────────────────────────────────

  updateStatus() {
    const currentPlayer = this.game.getCurrentPlayer();
    const statusEl = document.getElementById("gameStatus");
    const actionsEl = document.getElementById("playerActions");
    if (!statusEl) return;

    if (!this.game.isActive) {
      const winner = this.game.state.get("winner");
      statusEl.textContent = winner
        ? `Vencedor: ${winner.name}`
        : "Jogo Parado";
      actionsEl?.classList.add("hidden");
      return;
    }

    statusEl.textContent = `Vez de: ${currentPlayer.name}`;

    const isMyTurn = dominoNetwork.isNetworkMode
      ? dominoNetwork.isHost
        ? currentPlayer.id === 1
        : this.game.currentPlayerIndex === dominoNetwork.localPlayerId - 1
      : currentPlayer.id === 1;

    if (isMyTurn) {
      actionsEl?.classList.remove("hidden");
      statusEl.style.color = "var(--ui-accent)";

      // Update Pass Button visual state
      const passBtn = document.getElementById("passTurnBtn");
      if (passBtn) {
        const canPass = this.game.canPlayerPass(currentPlayer);
        passBtn.style.opacity = canPass ? "1" : "0.5";
        passBtn.style.cursor = canPass ? "pointer" : "not-allowed";
      }
    } else {
      actionsEl?.classList.add("hidden");
      statusEl.style.color = "var(--ui-text-light)";
    }
  }

  // ─── Renderização de Jogadores (local) ────────────────────────────────────

  renderPlayers() {
    const players = this.game.players;
    const p1 = players.find((p) => p.id === 1);
    if (p1) this.renderHand(p1);

    players.forEach((p) => {
      if (p.id === 1) return;
      let targetId = "";
      if (this.game.numPlayers === 2) {
        if (p.id === 2) targetId = "player-3-slot";
      } else if (this.game.numPlayers === 3) {
        if (p.id === 2) targetId = "player-2-slot";
        if (p.id === 3) targetId = "player-4-slot";
      } else {
        targetId = `player-${p.id}-slot`;
      }
      const slotEl = document.getElementById(targetId);
      if (slotEl) {
        const active = this.game.currentPlayerIndex === p.id - 1;
        slotEl.innerHTML = `<div class="player-info">${p.name}${
          active ? " ⏳" : ""
        }</div>
          <div class="player-hand">${this.renderBackOfPieces(
            p.countPieces()
          )}</div>`;
      }
    });

    if (this.game.numPlayers === 2) {
      document.getElementById("player-2-slot").innerHTML = "";
      document.getElementById("player-4-slot").innerHTML = "";
    } else if (this.game.numPlayers === 3) {
      document.getElementById("player-3-slot").innerHTML = "";
    }
  }

  // ─── Renderização para Cliente (modo rede) ────────────────────────────────

  _renderClientBoard(state) {
    const pieces = (state.board || []).map((p) => new Piece(p.left, p.right));
    this._renderBoardFromPieces(pieces);
  }

  _renderClientPlayers(state) {
    const myIdx = dominoNetwork.localPlayerId - 1;
    state.players.forEach((p, i) => {
      if (i === myIdx) return;
      let targetId = "";
      const n = state.players.length;
      if (n === 2) {
        if (i !== myIdx) targetId = "player-3-slot";
      } else if (n === 3) {
        const otherIdxs = [0, 1, 2].filter((x) => x !== myIdx);
        targetId = i === otherIdxs[0] ? "player-2-slot" : "player-4-slot";
      } else {
        const ids = ["player-2-slot", "player-3-slot", "player-4-slot"];
        const otherIdxs = [1, 2, 3].filter((x) => x !== myIdx);
        const pos = otherIdxs.indexOf(i);
        if (pos >= 0) targetId = ids[pos];
      }
      const slotEl = document.getElementById(targetId);
      if (slotEl) {
        const active = state.currentPlayerIndex === i;
        slotEl.innerHTML = `<div class="player-info">${p.name}${
          active ? " ⏳" : ""
        }</div>
          <div class="player-hand">${this.renderBackOfPieces(
            p.handSize
          )}</div>`;
      }
    });

    const statusEl = document.getElementById("gameStatus");
    if (statusEl && state.isActive) {
      const cur = state.players[state.currentPlayerIndex];
      statusEl.textContent = `Vez de: ${cur?.name || "?"}`;
    }
  }

  _renderClientHand(hand) {
    const handEl = document.getElementById("playerHand");
    if (!handEl) return;
    handEl.innerHTML = "";
    hand.forEach((piece) => {
      const div = document.createElement("div");
      div.innerHTML = this.createPieceHTML(piece);
      const el = div.firstElementChild;
      this.dragDrop.enable(el, { piece });
      el.addEventListener("click", () => this._handleClientPieceClick(piece));
      handEl.appendChild(el);
    });
  }

  _handleClientPieceClick() {
    const remSt = dominoNetwork.remoteState;
    if (!remSt) return;
    if (remSt.currentPlayerIndex !== dominoNetwork.localPlayerId - 1) {
      this.showCenterMessage("Não é sua vez!", "warning");
      return;
    }
    this.showCenterMessage("Arraste para esquerda ou direita!", "info");
  }

  _updateClientStatus(state) {
    const actionsEl = document.getElementById("playerActions");
    const isMyTurn =
      state.currentPlayerIndex === dominoNetwork.localPlayerId - 1;
    if (isMyTurn) {
      actionsEl?.classList.remove("hidden");
    } else {
      actionsEl?.classList.add("hidden");
    }
    if (!state.isActive && state.winner) {
      this.showCenterMessage(
        `🏆 ${state.winner.name} venceu!`,
        "success",
        4000
      );
      this.playSound("win");
    }
  }

  // ─── Renderização Compartilhada do Tabuleiro ──────────────────────────────

  renderBoard() {
    const pieces = this.game.board.getPieces();
    this._renderBoardFromPieces(pieces);
  }

  _renderBoardFromPieces(pieces) {
    const boardEl = document.getElementById("board");
    if (!boardEl) return;

    if (pieces.length === 0) {
      boardEl.innerHTML = `<div class="board-canvas">
        <div id="empty-board-zone" class="drop-zone empty-zone" data-zone="head"
             style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);">
          Arraste uma peça aqui
        </div>
      </div>`;
      this.dragDrop.makeDropzone(
        boardEl.querySelector("#empty-board-zone"),
        "piece"
      );
      return;
    }

    const { layout, corners, lastRow } = this.calculateSnakeLayout(pieces);
    const n = layout.length;
    const first = layout[0];
    const last = layout[n - 1];
    const tailGoingRight = lastRow % 2 === 0;
    const hStep = this._hStep;
    const ZONE_W = 32,
      ZONE_H = 40;

    const headCx = first.cx - hStep;
    const headCy = first.cy;
    const tailCx = tailGoingRight ? last.cx + hStep : last.cx - hStep;
    const tailCy = last.cy;

    let html = '<div class="board-canvas">';
    for (const c of corners) html += this.renderCornerConnector(c.cx, c.cy);
    for (const item of layout)
      html += this.createBoardPieceHTML(
        item.piece,
        item.cx,
        item.cy,
        item.rotation
      );
    html += `<div class="drop-zone head-zone" data-zone="head"
      style="position:absolute;left:${Math.round(
        headCx - ZONE_W / 2
      )}px;top:${Math.round(
      headCy - ZONE_H / 2
    )}px;width:${ZONE_W}px;height:${ZONE_H}px;"></div>`;
    html += `<div class="drop-zone tail-zone" data-zone="tail"
      style="position:absolute;left:${Math.round(
        tailCx - ZONE_W / 2
      )}px;top:${Math.round(
      tailCy - ZONE_H / 2
    )}px;width:${ZONE_W}px;height:${ZONE_H}px;"></div>`;
    html += "</div>";
    boardEl.innerHTML = html;

    this.dragDrop.makeDropzone(boardEl.querySelector(".head-zone"), "piece");
    this.dragDrop.makeDropzone(boardEl.querySelector(".tail-zone"), "piece");
  }

  /**
   * Calcula layout em cobra com espaçamento dinâmico e curvas de 2 peças.
   */
  calculateSnakeLayout(pieces) {
    const BOARD = 570;
    const PW = 28;
    const PH = 56;
    const GAP = 1;
    const MARGIN = 70;

    const minX = MARGIN;
    const maxX = BOARD - MARGIN;

    // Start slightly left of center to allow room?
    // Or just start at minX for simplicity and consistency.
    // Original code centered the row. Let's start at minX + margin to be safe.
    let x = minX + PH;
    let y = 150;
    let direction = 1; // 1 = Right, -1 = Left

    const layout = [];

    let i = 0;
    while (i < pieces.length) {
      const p = pieces[i];
      const isDouble = p.left === p.right;

      // Dimensions in horizontal flow
      const pW = isDouble ? PW : PH;
      const halfW = pW / 2;

      // Calculate candidate position
      // If first piece, x is already set.
      // If not, x was advanced by previous iteration.

      // Check bounds
      const leftEdge = x - halfW;
      const rightEdge = x + halfW;

      const fits = direction === 1 ? rightEdge <= maxX : leftEdge >= minX;

      if (fits) {
        // Place horizontally
        layout.push({
          piece: p,
          cx: x,
          cy: y,
          rotation: isDouble ? 0 : direction === 1 ? -90 : 90,
        });

        // Advance X for next piece
        if (i < pieces.length - 1) {
          const nextP = pieces[i + 1];
          const nextIsDouble = nextP.left === nextP.right;
          const nextW = nextIsDouble ? PW : PH;
          const dist = halfW + GAP + nextW / 2;
          x += direction * dist;
        }
        i++;
      } else {
        // Turn Sequence (Vertical)
        if (layout.length === 0) {
          i++;
          continue;
        } // Should not happen

        const prev = layout[layout.length - 1];

        // Determine previous piece visual height in horizontal row
        // Prev Normal (-90): Height is PW (28)
        // Prev Double (0): Height is PH (56)
        const prevIsDouble = prev.piece.left === prev.piece.right;
        const prevH = prevIsDouble ? PH : PW;

        // Piece 1 of turn (p)
        // Orientation: Vertical flow.
        // Normal: 0 deg (Height PH)
        // Double: 90 deg (Height PW) - Crossed
        const curH = isDouble ? PW : PH;
        const curRot = isDouble ? 90 : 0;

        let turnY = prev.cy + prevH / 2 + GAP + curH / 2;

        layout.push({
          piece: p,
          cx: prev.cx,
          cy: turnY,
          rotation: curRot,
        });
        i++;

        // Piece 2 of turn (if available)
        if (i < pieces.length) {
          const p2 = pieces[i];
          const isDouble2 = p2.left === p2.right;
          const p2H = isDouble2 ? PW : PH;
          const p2Rot = isDouble2 ? 90 : 0;

          turnY += curH / 2 + GAP + p2H / 2;

          layout.push({
            piece: p2,
            cx: prev.cx, // Keep same X column
            cy: turnY,
            rotation: p2Rot,
          });
          i++;

          // Prepare for next horizontal row
          y = turnY; // New row Y level
          direction *= -1; // Flip direction

          // Calculate X for next piece
          if (i < pieces.length) {
            const nextP = pieces[i];
            const nextIsDouble = nextP.left === nextP.right;
            const nextW = nextIsDouble ? PW : PH;

            // Width of the last vertical piece (p2)
            // If p2 was Normal (0 deg), Width is PW.
            // If p2 was Double (90 deg), Width is PH.
            const p2W = isDouble2 ? PH : PW;

            x = prev.cx + direction * (p2W / 2 + GAP + nextW / 2);
          }
        } else {
          // Only 1 piece turned
          y = turnY;
          direction *= -1;
        }
      }
    }

    return { layout, corners: [], lastRow: direction === 1 ? 0 : 1 };
  }

  renderCornerConnector(cx, cy) {
    const l = Math.round(cx - 14),
      t = Math.round(cy - 28);
    return `<div class="corner-connector" style="position:absolute;left:${l}px;top:${t}px;"></div>`;
  }

  createBoardPieceHTML(piece, cx, cy, rotation) {
    const pw = 28,
      ph = 56;
    const src = pieceCreator.createDominoPieceDataUrl(
      piece.left,
      piece.right,
      pw
    );
    return `<div class="board-piece-abs" style="position:absolute;left:${Math.round(
      cx - pw / 2
    )}px;top:${Math.round(
      cy - ph / 2
    )}px;transform:rotate(${rotation}deg);transform-origin:center center;"><img src="${src}" alt="${
      piece.left
    }-${piece.right}" width="${pw}" height="${ph}"/></div>`;
  }

  renderBackOfPieces(count) {
    let html = "";
    for (let i = 0; i < count; i++)
      html += `<div style="width:18px;height:36px;background:#ddd;border:1px solid #bbb;border-radius:3px;margin:1px;"></div>`;
    return html;
  }

  renderHand(player) {
    const handEl = document.getElementById("playerHand");
    if (!handEl) return;
    handEl.innerHTML = "";
    player.getHand().forEach((piece) => {
      const div = document.createElement("div");
      div.innerHTML = this.createPieceHTML(piece);
      const el = div.firstElementChild;
      this.dragDrop.enable(el, { piece });
      el.addEventListener("click", () => this.handlePieceClick(piece));
      handEl.appendChild(el);
    });
  }

  handlePieceClick(piece) {
    if (this.game.getCurrentPlayer().id !== 1) {
      this.showCenterMessage("Não é sua vez!", "warning");
      return;
    }
    const canHead = this.game.board.canInsertAtHead(piece);
    const canTail = this.game.board.canInsertAtTail(piece);
    if (!canHead && !canTail) {
      this.playSound("invalid");
      this.showCenterMessage("Essa peça não encaixa!", "error");
      return;
    }
    if (canHead && canTail && this.game.board.size > 0) {
      this.showCenterMessage("Arraste para esquerda ou direita!", "info");
      return;
    }
    if (canHead) this.game.tryInsertAtHead(piece, this.game.players[0]);
    else this.game.tryInsertAtTail(piece, this.game.players[0]);
    this.playSound("place");
  }

  createPieceHTML(piece, width = 36) {
    const src = pieceCreator.createDominoPieceDataUrl(
      piece.left,
      piece.right,
      width
    );
    const h = width * 2;
    return `<div class="piece-wrapper" style="margin:2px;"><img src="${src}" alt="${piece.left}-${piece.right}" width="${width}" height="${h}"/></div>`;
  }

  // ─── Mensagem Centralizada ─────────────────────────────────────────────────

  showCenterMessage(text, type = "info", duration = 2000) {
    const existing = document.getElementById("game-center-msg");
    if (existing) existing.remove();
    const msg = document.createElement("div");
    msg.id = "game-center-msg";
    msg.className = `game-center-msg game-center-msg--${type}`;
    msg.textContent = text;
    document.body.appendChild(msg);
    setTimeout(() => {
      if (msg.parentNode) msg.remove();
    }, duration);
  }

  // ─── Áudio ─────────────────────────────────────────────────────────────────

  _getAudioCtx() {
    if (!this._audioCtx) {
      try {
        this._audioCtx = new AudioContext();
      } catch (_) {}
    }
    return this._audioCtx;
  }

  playSound(type) {
    if (!this.soundEnabled) return;
    const ctx = this._getAudioCtx();
    if (!ctx) return;
    const configs = {
      place: { freqs: [440, 660], dur: 0.18, wave: "sine", vol: 0.25 },
      invalid: { freqs: [220, 180], dur: 0.22, wave: "sawtooth", vol: 0.2 },
      win: { freqs: [523, 659, 784], dur: 0.6, wave: "sine", vol: 0.3 },
      buy: { freqs: [330, 280], dur: 0.14, wave: "triangle", vol: 0.2 },
      turn: { freqs: [370], dur: 0.1, wave: "sine", vol: 0.15 },
    };
    const cfg = configs[type] || configs.place;
    cfg.freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = cfg.wave;
      const t0 = ctx.currentTime + i * 0.08;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(cfg.vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + cfg.dur);
      osc.start(t0);
      osc.stop(t0 + cfg.dur);
    });
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function _copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = "Copiado!";
    setTimeout(() => {
      btn.textContent = original;
    }, 2000);
  });
}
