// games/checkers/main.js
// Dama online — renderização canvas, multiplayer P2P, tutorial

import { bus }              from '../../shared/core/EventBus.js';
import { network }          from '../../shared/network/NetworkManager.js';
import { UIManager }        from '../../shared/ui/UIManager.js';
import { ParticleSystem2D } from '../../shared/render/ParticleSystem.js';
import { SoundSynth }       from '../../shared/audio/SoundSynth.js';
import { CheckersEngine }   from './CheckersEngine.js';

// ── Constantes ──────────────────────────────────────────────────────────────
const CELL = 60;
const SIZE = 8 * CELL; // 480

const COLORS = {
  darkCell:      '#3a7d44',
  lightCell:     '#f0d9b5',
  selectedCell:  '#e6a817',
  validBg:       'rgba(80, 220, 100, 0.28)',
  validDot:      'rgba(30, 200, 60, 0.85)',
  forcedRing:    '#ff4c4c',
  shadow:        'rgba(0,0,0,0.35)',
  red:           '#c0392b',
  redShine:      '#e74c3c',
  white:         '#ecf0f1',
  whiteShine:    '#ffffff',
  kingGold:      '#f1c40f',
  border:        '#d4af37',
};

// ── Referências DOM ──────────────────────────────────────────────────────────
const canvas = document.getElementById('board-canvas');
const ctx    = canvas.getContext('2d');
canvas.width  = SIZE;
canvas.height = SIZE;

// ── Estado ────────────────────────────────────────────────────────────────
let engine     = null;
let localId    = null;
let opponentId = null;
let localColor = 'red'; // host = red, client = white

const ui    = new UIManager();
const fx    = new ParticleSystem2D(document.body);
const synth = new SoundSynth();

// ── Mute ──────────────────────────────────────────────────────────────────
let _muted = false;

function setupMuteButtons() {
  const btns = [document.getElementById('btn-mute'), document.getElementById('btn-mute-game')];
  btns.forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      synth.init(); // garante inicialização no clique
      _muted = !_muted;
      synth.setVolume(_muted ? 0 : 0.85);
      const icon  = _muted ? '🔇' : '🔊';
      const label = _muted ? '🔇 Mudo' : '🔊 Som';
      document.getElementById('btn-mute')?.textContent && (document.getElementById('btn-mute').textContent = icon);
      document.getElementById('btn-mute-game')?.textContent && (document.getElementById('btn-mute-game').textContent = label);
      btns.forEach(b => b?.classList.toggle('muted', _muted));
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────
function init() {
  setupLobby();
  setupMuteButtons();
  drawIdleScreen();

  // Inicializa áudio no primeiro gesto (exigência dos browsers)
  document.addEventListener('pointerdown', () => synth.init(), { once: true });

  // Tutorial button (lobby + in-game)
  document.querySelectorAll('.btn-tutorial').forEach(btn =>
    btn.addEventListener('click', showTutorial));
}

function drawIdleScreen() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, SIZE, SIZE);
  // Desenha um tabuleiro fantasma como decoração
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      ctx.fillStyle = (r + c) % 2 === 1
        ? 'rgba(58,125,68,0.3)' : 'rgba(240,217,181,0.1)';
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
  ctx.fillStyle = 'rgba(212,175,55,0.7)';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Aguardando jogo...', SIZE / 2, SIZE / 2);
}

// ── Lobby ─────────────────────────────────────────────────────────────────
function setupLobby() {
  const btnCreate = document.getElementById('btn-create');
  const btnJoin   = document.getElementById('btn-join');
  const roomInput = document.getElementById('room-input');

  btnCreate.addEventListener('click', async () => {
    btnCreate.disabled = true;
    btnCreate.textContent = 'Criando...';
    const roomId    = `dama-${Math.random().toString(36).slice(2, 7)}`;
    localId         = await network.createRoom(roomId);
    const inviteUrl = `${location.origin}${location.pathname}?join=${roomId}`;

    document.getElementById('room-id-display').textContent = roomId;
    document.getElementById('room-info').style.display = 'flex';

    document.getElementById('btn-copy-id').addEventListener('click', function () {
      copyToClipboard(roomId, this);
    });
    document.getElementById('btn-copy-url').addEventListener('click', function () {
      copyToClipboard(inviteUrl, this);
    });

    // Removido botão de auto-entrar, agora aguarda oponente
    ui.toast('Sala criada! Aguardando oponente...', 'info', 4000);

    bus.on('net:peer-joined', ({ peerId }) => {
      opponentId = peerId;
      localColor = 'red';
      startGame();
    });
  });

  btnJoin.addEventListener('click', async () => {
    const roomId = roomInput.value.trim();
    if (!roomId) return;
    btnJoin.disabled = true;
    btnJoin.textContent = 'Entrando...';
    localId    = await network.joinRoom(roomId);
    opponentId = roomId;
    localColor = 'white';
    startGame();
  });

  // Auto-join via URL
  const params = new URLSearchParams(location.search);
  if (params.get('join')) {
    roomInput.value = params.get('join');
    btnJoin.click();
  }
}

// ── Game start ────────────────────────────────────────────────────────────
function startGame() {
  document.getElementById('lobby').classList.add('hidden');
  document.getElementById('game-area').classList.remove('hidden');

  engine = new CheckersEngine();
  engine.initGame();

  setupNetworkSync();
  setupCanvasClick();
  renderBoard();
  updateHUD();
}

// ── Canvas click ──────────────────────────────────────────────────────────
function setupCanvasClick() {
  canvas.addEventListener('click', e => {
    if (!engine || engine.state.phase !== 'playing') return;
    if (engine.state.turn !== localColor) {
      ui.toast('Aguarde seu turno.', 'error', 1200);
      return;
    }
    const rect  = canvas.getBoundingClientRect();
    const col   = Math.floor((e.clientX - rect.left) / rect.width  * 8);
    const row   = Math.floor((e.clientY - rect.top)  / rect.height * 8);
    if (row < 0 || row > 7 || col < 0 || col > 7) return;
    handleCellClick(row, col);
  });
}

function handleCellClick(row, col) {
  const { selected, validMoves, board } = engine.state;

  // Tentando mover para destino válido
  if (selected) {
    const isTarget = validMoves.some(m => m.row === row && m.col === col);
    if (isTarget) {
      const savedSelected = { ...selected };
      const result = engine.move(row, col);
      if (result) {
        // Som de movimento (será sobrescrito pelo de captura em handleMoveResult se houver)
        if (!result.captured?.length) synth.move();
        network.broadcast('move', { from: savedSelected, to: { row, col } });
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
  } else {
    const piece = board[row][col];
    if (piece?.color === localColor && engine.hasForcedCapture()) {
      synth.error();
      ui.toast('Captura obrigatória! Selecione a peça marcada.', 'error', 2200);
    }
  }
  renderBoard();
}

function handleMoveResult(result, toRow, toCol) {
  if (!result?.success) return;

  // Som e partículas nas capturas
  if (result.captured?.length) {
    result.chainCapture ? synth.chainCapture() : synth.capture();
    const rect  = canvas.getBoundingClientRect();
    const cellW = rect.width  / 8;
    const cellH = rect.height / 8;
    result.captured.forEach(({ row, col, color }) => {
      fx.burst(
        rect.left + (col + 0.5) * cellW,
        rect.top  + (row + 0.5) * cellH,
        { count: 12, colors: color === 'red'
            ? ['#c0392b','#ff6b6b','#ffd700']
            : ['#ecf0f1','#74c0fc','#ffd700'],
          spread: 45 }
      );
    });
  }

  if (result.promoted) {
    synth.promotion();
    ui.toast('Peça promovida a DAMA ♛', 'info', 2000);
  }

  if (result.winner) {
    const won = result.winner === localColor;
    won ? synth.win() : synth.lose();
    setTimeout(() => {
      ui.openModal('game-over',
        `<div style="text-align:center">
           <div style="font-size:3rem">${won ? '🏆' : '😞'}</div>
           <div style="font-size:1.4rem;margin-top:8px">${won ? 'Você venceu!' : 'Você perdeu...'}</div>
         </div>`,
        { title: 'Fim de Jogo', confirmLabel: 'Jogar Novamente', onConfirm: () => location.reload() }
      );
    }, 400);
    return;
  }

  if (result.chainCapture) {
    ui.toast('Capture novamente!', 'info', 1500);
    engine.selectPiece(toRow, toCol);
    renderBoard();
  }
}

// ── Network ───────────────────────────────────────────────────────────────
function setupNetworkSync() {
  bus.on('net:action', ({ type, payload, from }) => {
    if (from === localId) return;

    if (type === 'move') {
      const { from: f, to } = payload;
      const result = engine.applyRemoteMove(f.row, f.col, to.row, to.col);
      if (result?.captured?.length) synth.capture();
      else synth.opponentMove();
      if (result?.chainCapture) engine.selectPiece(to.row, to.col);
      renderBoard();
      updateHUD();
      // Notifica que agora é o turno do jogador local
      if (!result?.winner && engine.state.turn === localColor) synth.turnNotify();
      if (result?.winner) handleMoveResult(result, to.row, to.col);
    }
  });

  bus.on('net:peer-left', () =>
    ui.toast('Oponente desconectou.', 'error', 0));
}

// ── Render ────────────────────────────────────────────────────────────────
function renderBoard() {
  if (!engine) return;
  ctx.clearRect(0, 0, SIZE, SIZE);

  const { board, selected, validMoves } = engine.state;
  const forcedSet = new Set(
    engine.getForcedPieces().map(p => `${p.row},${p.col}`)
  );

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const x = c * CELL, y = r * CELL;
      const isDark = (r + c) % 2 === 1;

      // Fundo da casa
      ctx.fillStyle = isDark ? COLORS.darkCell : COLORS.lightCell;
      if (selected?.row === r && selected?.col === c) ctx.fillStyle = COLORS.selectedCell;
      ctx.fillRect(x, y, CELL, CELL);

      // Destinos válidos
      if (validMoves.some(m => m.row === r && m.col === c)) {
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

  // Borda dourada do tabuleiro
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, SIZE - 3, SIZE - 3);
}

function drawPiece(x, y, piece, isForced) {
  const cx = x + CELL / 2, cy = y + CELL / 2;
  const r  = CELL / 2 - 5;
  const isRed = piece.color === 'red';

  // Sombra
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath(); ctx.arc(cx + 2, cy + 3, r, 0, Math.PI * 2); ctx.fill();

  // Corpo
  ctx.fillStyle = isRed ? COLORS.red : COLORS.white;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

  // Borda
  ctx.strokeStyle = isRed ? '#7b241c' : '#95a5a6';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Brilho interno
  ctx.fillStyle = isRed ? COLORS.redShine : COLORS.whiteShine;
  ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.28, r * 0.35, 0, Math.PI * 2); ctx.fill();

  // Anel de captura obrigatória
  if (isForced) {
    ctx.strokeStyle = COLORS.forcedRing;
    ctx.lineWidth   = 3;
    ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Coroa da dama
  if (piece.isKing) {
    ctx.fillStyle   = COLORS.kingGold;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth   = 0.8;
    ctx.font        = `bold ${Math.floor(CELL * 0.44)}px serif`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♛', cx, cy + 1);
    ctx.strokeText('♛', cx, cy + 1);
  }
}

// ── HUD ───────────────────────────────────────────────────────────────────
function updateHUD() {
  if (!engine) return;
  const { turn, pieceCount } = engine.state;
  const myTurn = turn === localColor;

  const turnEl = document.getElementById('turn-display');
  turnEl.textContent = myTurn ? 'Seu turno' : 'Turno do oponente';
  turnEl.style.color = myTurn ? '#69db7c' : '#ff6b6b';

  document.getElementById('red-count').textContent   = `🔴 ${pieceCount.red}`;
  document.getElementById('white-count').textContent = `⚪ ${pieceCount.white}`;
  document.getElementById('color-display').textContent =
    `Você: ${localColor === 'red' ? '🔴 Vermelho' : '⚪ Branco'}`;
}

// ── Tutorial ──────────────────────────────────────────────────────────────
function showTutorial() {
  ui.openModal('tutorial',
    `<div style="line-height:1.8;font-size:13px;max-width:380px">
      <p><strong style="color:#d4af37">Objetivo</strong><br>
         Capturar todas as peças do oponente,<br>
         ou bloquear todos os seus movimentos.</p>
      <hr style="border-color:#2a2a5a;margin:10px 0">

      <p><strong style="color:#d4af37">Movimentos</strong></p>
      <ul style="padding-left:1.2rem;margin:4px 0">
        <li>Peças movem na diagonal, <em>uma casa por vez</em></li>
        <li>Peças regulares só avançam (rumo ao lado oposto)</li>
        <li>Damas <strong>♛</strong> movem em qualquer diagonal</li>
      </ul>

      <p style="margin-top:10px"><strong style="color:#d4af37">Capturas</strong></p>
      <ul style="padding-left:1.2rem;margin:4px 0">
        <li>Salte sobre uma peça inimiga para capturá-la</li>
        <li>Capturas são <strong>OBRIGATÓRIAS</strong></li>
        <li>Após capturar, se houver outra captura disponível,<br>você deve continuar</li>
        <li>Capturas podem ser para frente <em>e para trás</em></li>
      </ul>

      <p style="margin-top:10px"><strong style="color:#d4af37">Promoção</strong></p>
      <ul style="padding-left:1.2rem;margin:4px 0">
        <li>Ao chegar no lado oposto → vira <strong>DAMA ♛</strong></li>
        <li>Damas se movem em qualquer direção diagonal</li>
      </ul>

      <p style="margin-top:10px"><strong style="color:#d4af37">Indicadores visuais</strong></p>
      <ul style="padding-left:1.2rem;margin:4px 0">
        <li>🟨 Casa dourada = peça selecionada</li>
        <li>🟢 Pontos verdes = destinos disponíveis</li>
        <li>🔴 Anel vermelho pontilhado = captura obrigatória</li>
      </ul>

      <p style="margin-top:10px;color:#888;font-size:11px">
        🔴 Vermelho começa sempre (é o host da sala).
      </p>
    </div>`,
    { title: 'Como Jogar — Dama', confirmLabel: 'Entendi!' }
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copiado!';
    btn.classList.add('btn-copy--done');
    setTimeout(() => {
      btn.textContent = btn.dataset.label;
      btn.classList.remove('btn-copy--done');
    }, 2000);
  });
}

init();
