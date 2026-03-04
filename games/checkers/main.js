// games/checkers/main.js
// Dama online — renderização canvas, multiplayer P2P, tutorial e Bot

import { bus } from "../../shared/core/EventBus.js";
import { network } from "../../shared/network/NetworkManager.js";
import { UIManager } from "../../shared/ui/UIManager.js";
import { ParticleSystem2D } from "../../shared/render/ParticleSystem.js";
import { SoundSynth } from "../../shared/audio/SoundSynth.js";
import { CheckersEngine } from "./CheckersEngine.js";
import { pieceCreator } from "../../shared/render/SvgPieceCreator.js";
import { loader } from "../../shared/core/AssetLoader.js";

// ── Constantes ──────────────────────────────────────────────────────────────
const CELL = 60;
const SIZE = 8 * CELL; // 480

const COLORS = {
  darkCell: "#3a7d44", // var(--cell-dark)
  lightCell: "#f0d9b5", // var(--cell-light)
  selectedCell: "#e6a817",
  validBg: "rgba(80, 220, 100, 0.28)",
  validDot: "rgba(30, 200, 60, 0.85)",
  forcedRing: "#ff4c4c",
  shadow: "rgba(0,0,0,0.35)",
  red: "#c0392b",
  redShine: "#e74c3c",
  white: "#ecf0f1",
  whiteShine: "#ffffff",
  kingGold: "#f1c40f",
  border: "#d4af37", // var(--board-border)
};

// ── Referências DOM ──────────────────────────────────────────────────────────
const canvas = document.getElementById("board-canvas");
const ctx = canvas.getContext("2d");
canvas.width = SIZE;
canvas.height = SIZE;

// ── Estado ────────────────────────────────────────────────────────────────
let engine = null;
let localId = null;
let opponentId = null;
let localColor = "red"; // host = red, client = white
let isBotMode = false;

const ui = new UIManager();
const fx = new ParticleSystem2D(document.body);
const synth = new SoundSynth();

// ── Mute ──────────────────────────────────────────────────────────────────
let _muted = false;

function setupMuteButtons() {
  const btn = document.getElementById("btn-mute");
  if (!btn) return;
  btn.addEventListener("click", () => {
    synth.init(); // garante inicialização no clique
    _muted = !_muted;
    synth.setVolume(_muted ? 0 : 0.85);
    btn.textContent = _muted ? "🔇" : "🔊";
    btn.title = _muted ? "Ativar Som" : "Mutar Som";
  });
}

// ── Init ──────────────────────────────────────────────────────────────────
function init() {
  loadPieceAssets();
  setupLobby();
  setupMuteButtons();
  drawIdleScreen();

  // Inicializa áudio no primeiro gesto (exigência dos browsers)
  document.addEventListener("pointerdown", () => synth.init(), { once: true });

  // Tutorial button
  const btnTutorial = document.getElementById("btn-tutorial");
  if (btnTutorial) btnTutorial.addEventListener("click", showTutorial);

  // Quit button
  const btnQuit = document.getElementById("btn-quit");
  if (btnQuit) btnQuit.addEventListener("click", () => location.reload());
}

function drawIdleScreen() {
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, SIZE, SIZE);
  // Desenha um tabuleiro fantasma como decoração
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      ctx.fillStyle =
        (r + c) % 2 === 1 ? "rgba(58,125,68,0.3)" : "rgba(240,217,181,0.1)";
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
  ctx.fillStyle = "rgba(212,175,55,0.7)";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Aguardando jogo...", SIZE / 2, SIZE / 2);
}

// ── Assets ────────────────────────────────────────────────────────────────
async function loadPieceAssets() {
  const manifest = [
    {
      key: "red-man",
      url: pieceCreator.createCheckersPieceDataUrl("red", false, CELL),
      type: "image",
    },
    {
      key: "red-king",
      url: pieceCreator.createCheckersPieceDataUrl("red", true, CELL),
      type: "image",
    },
    {
      key: "white-man",
      url: pieceCreator.createCheckersPieceDataUrl("white", false, CELL),
      type: "image",
    },
    {
      key: "white-king",
      url: pieceCreator.createCheckersPieceDataUrl("white", true, CELL),
      type: "image",
    },
  ];
  await loader.load(manifest);
}

// ── Lobby ─────────────────────────────────────────────────────────────────
function setupLobby() {
  const btnCreate = document.getElementById("btn-create");
  const btnJoin = document.getElementById("btn-join");
  const btnBot = document.getElementById("btn-bot");
  const roomInput = document.getElementById("room-input");

  // Bot Mode
  btnBot.addEventListener("click", () => {
    isBotMode = true;
    localColor = "red";
    opponentId = "BOT";
    startGame();
  });

  // Multiplayer Create
  btnCreate.addEventListener("click", async () => {
    isBotMode = false;
    btnCreate.disabled = true;
    btnCreate.textContent = "Criando...";
    const roomId = `dama-${Math.random().toString(36).slice(2, 7)}`;
    localId = await network.createRoom(roomId);
    const inviteUrl = `${location.origin}${location.pathname}?join=${roomId}`;

    // Esconde menu inicial (mas mantém lobby container para mostrar info)
    document.querySelector(".actions").classList.add("hidden");
    document.querySelector("p.subtitle").classList.add("hidden");

    const roomInfo = document.getElementById("room-info");
    roomInfo.classList.remove("hidden");
    document.getElementById("room-id-display").textContent = roomId;

    document
      .getElementById("btn-copy-id")
      .addEventListener("click", function () {
        copyToClipboard(roomId, this);
      });
    document
      .getElementById("btn-copy-url")
      .addEventListener("click", function () {
        copyToClipboard(inviteUrl, this);
      });

    ui.toast("Sala criada! Aguardando oponente...", "info", 4000);

    bus.on("net:peer-joined", ({ peerId }) => {
      opponentId = peerId;
      localColor = "red";
      startGame();
    });
  });

  // Multiplayer Join
  btnJoin.addEventListener("click", async () => {
    const roomId = roomInput.value.trim();
    if (!roomId) return;
    isBotMode = false;
    btnJoin.disabled = true;
    btnJoin.textContent = "Entrando...";
    localId = await network.joinRoom(roomId);
    opponentId = roomId;
    localColor = "white";
    startGame();
  });

  // Auto-join via URL
  const params = new URLSearchParams(location.search);
  if (params.get("join")) {
    roomInput.value = params.get("join");
    btnJoin.click();
  }
}

// ── Game start ────────────────────────────────────────────────────────────
function startGame() {
  document.getElementById("lobby").classList.add("hidden");
  document.getElementById("game-area").classList.remove("hidden");

  engine = new CheckersEngine();
  engine.initGame();

  if (!isBotMode) {
    setupNetworkSync();
  }

  setupCanvasClick();
  renderBoard();
  updateHUD();

  if (localColor === "red") showTurnOverlay();
}

// ── Canvas click ──────────────────────────────────────────────────────────
function setupCanvasClick() {
  canvas.addEventListener("click", (e) => {
    if (!engine || engine.state.phase !== "playing") return;

    // Check turn
    if (engine.state.turn !== localColor) {
      if (!isBotMode) ui.toast("Aguarde seu turno.", "error", 1200);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const col = Math.floor(((e.clientX - rect.left) * scaleX) / CELL);
    const row = Math.floor(((e.clientY - rect.top) * scaleY) / CELL);

    if (row < 0 || row > 7 || col < 0 || col > 7) return;
    handleCellClick(row, col);
  });
}

function handleCellClick(row, col) {
  const { selected, validMoves } = engine.state;

  // Tentando mover para destino válido
  if (selected) {
    const isTarget = validMoves.some((m) => m.row === row && m.col === col);
    if (isTarget) {
      const savedSelected = { ...selected };
      const result = engine.move(row, col);
      if (result) {
        // Som
        if (!result.captured?.length) synth.move();

        // Network broadcast if P2P
        if (!isBotMode) {
          network.broadcast("move", { from: savedSelected, to: { row, col } });
        }

        handleMoveResult(result, row, col);
        renderBoard();
        updateHUD();
      }
      return;
    }
    engine.deselect();
  }

  // Tentando selecionar peça
  const ok = engine.selectPiece(row, col);
  if (ok) {
    synth.select();
  }
  renderBoard();
}

function handleMoveResult(result, toRow, toCol) {
  if (!result?.success) return;

  // Som e partículas nas capturas
  if (result.captured?.length) {
    result.chainCapture ? synth.chainCapture() : synth.capture();
    const rect = canvas.getBoundingClientRect();
    const cellW = rect.width / 8;
    const cellH = rect.height / 8;

    result.captured.forEach(({ row, col, color }) => {
      fx.burst(
        rect.left + (col + 0.5) * cellW,
        rect.top + (row + 0.5) * cellH,
        {
          count: 12,
          colors:
            color === "red"
              ? ["#c0392b", "#ff6b6b", "#ffd700"]
              : ["#ecf0f1", "#74c0fc", "#ffd700"],
          spread: 45,
        }
      );
    });
  }

  if (result.promoted) {
    synth.promotion();
    ui.toast("Peça promovida a DAMA ♛", "info", 2000);
  }

  if (result.winner) {
    const won = result.winner === localColor;
    won ? synth.win() : synth.lose();
    setTimeout(() => {
      ui.openModal(
        "game-over",
        `<div style="text-align:center">
           <div style="font-size:3rem">${won ? "🏆" : "😞"}</div>
           <div style="font-size:1.4rem;margin-top:8px">${
             won ? "Você venceu!" : "Você perdeu..."
           }</div>
         </div>`,
        {
          title: "Fim de Jogo",
          confirmLabel: "Jogar Novamente",
          onConfirm: () => location.reload(),
        }
      );
    }, 400);
    return;
  }

  if (result.chainCapture) {
    ui.toast("Capture novamente!", "info", 1500);
    // If it's a bot chain capture, we need to handle it in the bot logic
    // For local player:
    if (engine.state.turn === localColor) {
      engine.selectPiece(toRow, toCol);
      renderBoard();
    }
  }

  // Bot Trigger
  if (isBotMode && !result.winner && engine.state.turn !== localColor) {
    // If it was a chain capture for the player, turn didn't change, so this block won't run.
    // If turn changed to opponent (Bot), run bot.
    setTimeout(playBotTurn, 1000);
  }
}

// ── Bot Logic ─────────────────────────────────────────────────────────────
function playBotTurn() {
  if (!engine || engine.state.phase !== "playing") return;

  // Bot plays the color opposite to localColor
  const botColor = localColor === "red" ? "white" : "red";

  if (engine.state.turn !== botColor) return;

  const move = engine.getBotMove(botColor);

  if (!move) {
    // Should have lost already if no moves, but safety check
    console.warn("Bot cannot move");
    return;
  }

  const { from, to } = move;

  // Select piece
  engine.selectPiece(from.row, from.col);

  // Apply move
  const result = engine.move(to.row, to.col);

  if (result) {
    if (!result.captured?.length) synth.opponentMove();
    else synth.capture();

    handleMoveResult(result, to.row, to.col);
    renderBoard();
    updateHUD();

    // Handle chain capture
    if (result.chainCapture) {
      setTimeout(playBotTurn, 800);
    } else {
      // Turn passed to player
      if (!result.winner) {
        synth.turnNotify();
        showTurnOverlay();
      }
    }
  }
}

// ── Network ───────────────────────────────────────────────────────────────
function setupNetworkSync() {
  bus.on("net:action", ({ type, payload, from }) => {
    if (from === localId) return;

    if (type === "move") {
      const { from: f, to } = payload;
      const result = engine.applyRemoteMove(f.row, f.col, to.row, to.col);
      if (result?.captured?.length) synth.capture();
      else synth.opponentMove();
      if (result?.chainCapture) engine.selectPiece(to.row, to.col);
      renderBoard();
      updateHUD();
      // Notifica que agora é o turno do jogador local
      if (!result?.winner && engine.state.turn === localColor) {
        synth.turnNotify();
        showTurnOverlay();
      }
      if (result?.winner) handleMoveResult(result, to.row, to.col);
    }
  });

  bus.on("net:peer-left", () => ui.toast("Oponente desconectou.", "error", 0));
}

// ── Render ────────────────────────────────────────────────────────────────
function renderBoard() {
  if (!engine) return;
  ctx.clearRect(0, 0, SIZE, SIZE);

  const { board, selected, validMoves } = engine.state;
  const forcedSet = new Set(
    engine.getForcedPieces().map((p) => `${p.row},${p.col}`)
  );

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const x = c * CELL,
        y = r * CELL;
      const isDark = (r + c) % 2 === 1;

      // Fundo da casa
      ctx.fillStyle = isDark ? COLORS.darkCell : COLORS.lightCell;
      if (selected?.row === r && selected?.col === c)
        ctx.fillStyle = COLORS.selectedCell;
      ctx.fillRect(x, y, CELL, CELL);

      // Destinos válidos
      if (validMoves.some((m) => m.row === r && m.col === c)) {
        ctx.fillStyle = COLORS.validBg;
        ctx.fillRect(x, y, CELL, CELL);
        ctx.fillStyle = COLORS.validDot;
        ctx.beginPath();
        ctx.arc(x + CELL / 2, y + CELL / 2, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      // Peça
      const piece = board[r][c];
      if (piece) drawPiece(x, y, piece, forcedSet.has(`${r},${c}`));
    }
  }

  // Borda
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, SIZE - 3, SIZE - 3);
}

function drawPiece(x, y, piece, isForced) {
  // Tenta desenhar usando o asset SVG gerado
  const key = `${piece.color}-${piece.isKing ? "king" : "man"}`;
  const img = loader.get(key);

  if (img) {
    ctx.drawImage(img, x, y, CELL, CELL);
    return;
  }

  // Fallback: renderização procedural antiga se a imagem não carregou
  const cx = x + CELL / 2,
    cy = y + CELL / 2;
  const r = CELL / 2 - 8; // Slightly smaller for better look
  const isRed = piece.color === "red";

  // Sombra
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.arc(cx + 2, cy + 3, r, 0, Math.PI * 2);
  ctx.fill();

  // Corpo
  ctx.fillStyle = isRed ? COLORS.red : COLORS.white;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Borda
  ctx.strokeStyle = isRed ? "#7b241c" : "#95a5a6";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Brilho interno
  ctx.fillStyle = isRed ? COLORS.redShine : COLORS.whiteShine;
  ctx.beginPath();
  ctx.arc(cx - r * 0.25, cy - r * 0.28, r * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Coroa da dama
  if (piece.isKing) {
    ctx.fillStyle = COLORS.kingGold;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 0.8;
    ctx.font = `bold ${Math.floor(CELL * 0.5)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♛", cx, cy + 2);
    ctx.strokeText("♛", cx, cy + 2);
  }
}

// ── HUD ───────────────────────────────────────────────────────────────────
function updateHUD() {
  if (!engine) return;
  const { turn, pieceCount } = engine.state;
  const myTurn = turn === localColor;

  const turnEl = document.getElementById("turn-display");
  turnEl.textContent = myTurn ? "Sua vez" : "Vez do oponente";
  turnEl.style.color = myTurn ? "#69db7c" : "#ff6b6b";

  // Glow no tabuleiro
  const canvas = document.getElementById("board-canvas");
  if (myTurn) canvas.classList.add("my-turn-glow");
  else canvas.classList.remove("my-turn-glow");

  document.getElementById("red-count").textContent = `${pieceCount.red}`;
  document.getElementById("white-count").textContent = `${pieceCount.white}`;

  const colorDisplay = document.getElementById("color-display");
  colorDisplay.textContent = `Você: ${
    localColor === "red" ? "🔴 Vermelho" : "⚪ Branco"
  }`;
  colorDisplay.style.borderColor =
    localColor === "red" ? COLORS.red : COLORS.white;
}

function showTurnOverlay() {
  ui.toast("Sua vez de jogar!", "info", 1500);
}

// ── Tutorial ──────────────────────────────────────────────────────────────
function showTutorial() {
  ui.openModal(
    "tutorial",
    `<div style="line-height:1.6;font-size:14px;">
      <p><strong style="color:var(--ui-accent)">Objetivo</strong><br>
         Capturar todas as peças do oponente ou bloqueá-lo.</p>
      
      <p style="margin-top:10px"><strong style="color:var(--ui-accent)">Movimentos</strong></p>
      <ul style="padding-left:1.2rem;margin:4px 0">
        <li>Peças movem na diagonal à frente.</li>
        <li>Damas (após chegar ao fim) movem em qualquer distância.</li>
      </ul>

      <p style="margin-top:10px"><strong style="color:var(--ui-accent)">Capturas</strong></p>
      <ul style="padding-left:1.2rem;margin:4px 0">
        <li>Salte sobre peças inimigas (frente ou trás).</li>
        <li>Captura é <strong>obrigatória</strong>!</li>
      </ul>
    </div>`,
    { title: "Como Jogar", confirmLabel: "Entendi" }
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = "Copiado!";
    setTimeout(() => {
      btn.textContent = original;
    }, 2000);
  });
}

init();
