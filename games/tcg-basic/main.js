// games/tcg-basic/main.js
// Inicialização do TCG Básico

import { bus }          from '../../shared/core/EventBus.js';
import { loader }       from '../../shared/core/AssetLoader.js';
import { storage }      from '../../shared/storage/StorageManager.js';
import { network }      from '../../shared/network/NetworkManager.js';
import { CardEngine }   from '../../shared/tcg/CardEngine.js';
import { DeckManager }  from '../../shared/tcg/DeckManager.js';
import { CardRenderer } from '../../shared/render/CardRenderer.js';
import { DragDrop }     from '../../shared/ui/DragDrop.js';
import { UIManager }    from '../../shared/ui/UIManager.js';
import { Tooltip }      from '../../shared/ui/Tooltip.js';
import { ParticleSystem2D } from '../../shared/render/ParticleSystem.js';
import { rules }        from './rules.js';

// ---------------------------------------------------------------------------
// Elementos DOM
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const DOM = {
  hand:          $('hand'),
  field:         $('player-field'),
  opponentField: $('opponent-field'),
  graveyard:     $('graveyard'),
  endPhaseBtn:   $('btn-end-phase'),
  manaDisplay:   $('mana-display'),
  hpDisplay:     $('hp-display'),
  opHpDisplay:   $('opponent-hp'),
  phaseDisplay:  $('phase-display'),
  turnDisplay:   $('turn-display'),
  lobbyScreen:   $('lobby-screen'),
  gameScreen:    $('game-screen'),
  createBtn:     $('btn-create'),
  joinBtn:       $('btn-join'),
  roomInput:     $('room-input'),
  roomIdDisplay: $('room-id-display'),
};

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------
const ui       = new UIManager();
const tooltip  = new Tooltip();
const fx       = new ParticleSystem2D(document.body);
const renderer = new CardRenderer();
const deckMgr  = new DeckManager({ minSize: 5, maxSize: 30, maxCopies: 3 });

let engine       = null;
let localId      = null;
let opponentId   = null;
let cardDatabase = {};

async function init() {
  // 1. Assets
  const assets = await loader.load([
    { key: 'cards', url: './cards.json', type: 'json' },
  ]);
  cardDatabase = Object.fromEntries(assets.cards.map(c => [c.id, c]));

  // 2. Storage
  await storage.init([
    { name: 'collection', keyPath: 'id' },
    { name: 'decks',      keyPath: 'deckId' },
    { name: 'saves',      keyPath: 'saveId' },
  ]);

  // 3. Popula coleção de exemplo se vazia
  const count = await storage.count('collection');
  if (count === 0) await storage.putMany('collection', assets.cards);

  // 4. URL params — entra em sala automaticamente
  const params = new URLSearchParams(location.search);
  if (params.get('join')) {
    await joinRoom(params.get('join'));
  }

  setupLobbyUI();
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------
function setupLobbyUI() {
  DOM.createBtn.addEventListener('click', async () => {
    const roomId = `room-${Math.random().toString(36).slice(2, 8)}`;
    await createRoom(roomId);
  });

  DOM.joinBtn.addEventListener('click', async () => {
    const roomId = DOM.roomInput.value.trim();
    if (!roomId) return;
    await joinRoom(roomId);
  });
}

async function createRoom(roomId) {
  localId = await network.createRoom(roomId);

  const inviteUrl = `${location.origin}${location.pathname}?join=${roomId}`;

  DOM.roomIdDisplay.textContent = roomId;
  const roomInfo = document.getElementById('room-info');
  roomInfo.style.display = 'flex';

  document.getElementById('btn-copy-id').addEventListener('click', function () {
    copyToClipboard(roomId, this);
  });
  document.getElementById('btn-copy-url').addEventListener('click', function () {
    copyToClipboard(inviteUrl, this);
  });

  // Removido botão de auto-entrar

  ui.toast('Sala criada! Compartilhe o código.', 'info', 3000);

  bus.on('net:peer-joined', ({ peerId }) => {
    opponentId = peerId;
    startGame();
  });
}

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

async function joinRoom(roomId) {
  localId = await network.joinRoom(roomId);
  opponentId = roomId; // host tem o ID da sala
  startGame();
}

// ---------------------------------------------------------------------------
// Jogo
// ---------------------------------------------------------------------------
function startGame() {
  DOM.lobbyScreen.classList.add('hidden');
  DOM.gameScreen.classList.remove('hidden');

  engine = new CardEngine(rules);
  const deck = buildStarterDeck();
  const deckMap = { [localId]: deck, [opponentId]: deck };
  engine.initGame([localId, opponentId], deckMap);

  setupDragDrop();
  setupNetworkSync();
  updateHUD();
}

function buildStarterDeck() {
  const ids = Object.keys(cardDatabase);
  const deck = [];
  // 5 cartas de cada tipo (demo)
  ids.forEach(id => {
    const card = { ...cardDatabase[id] };
    for (let i = 0; i < 2; i++) {
      deck.push({ ...card, instanceId: `${id}_${i}` });
    }
  });
  return deck.slice(0, 20);
}

function setupDragDrop() {
  const drag = new DragDrop(DOM.gameScreen);

  // Dropzone: campo próprio para jogar cartas
  drag.makeDropzone(DOM.field, 'card', ({ cardId, instanceId }) => {
    const id = instanceId ?? cardId;
    const success = engine.applyAction({ type: 'play-card', cardId: id }, localId);
    if (!success) { ui.toast('Não é possível jogar agora', 'error'); return; }
    network.broadcast('play-card', { cardId: id });
  });

  // Dropzone: campo oponente para atacar
  drag.makeDropzone(DOM.opponentField, 'card', ({ instanceId }) => {
    const success = engine.applyAction({ type: 'attack', attackerId: instanceId, targetId: opponentId }, localId);
    if (success) network.broadcast('attack', { attackerId: instanceId, targetId: opponentId });
  });
}

function setupNetworkSync() {
  bus.on('net:action', ({ type, payload, from }) => {
    if (from === localId) return;
    if (type === 'play-card') engine.applyAction({ type: 'play-card', cardId: payload.cardId }, from);
    if (type === 'attack')    engine.applyAction({ type: 'attack', ...payload }, from);
    if (type === 'end-phase') engine.nextPhase();
  });
}

// ---------------------------------------------------------------------------
// HUD e eventos de jogo
// ---------------------------------------------------------------------------
bus.on('game:start',        ()  => renderHand());
bus.on('card:drawn',        ()  => renderHand());
bus.on('card:played',       (d) => { renderField(d.target); renderHand(); });
bus.on('card:destroyed',    (d) => { renderField(d.target); });
bus.on('player:damage',     (d) => { updateHUD(); shakeHp(d.target); });
bus.on('player:heal',       ()  => updateHUD());
bus.on('turn:start',        ()  => updateHUD());
bus.on('turn:phase-change', ()  => updateHUD());
bus.on('player:win',        (d) => {
  const msg = d.winner === localId ? 'Você venceu! 🏆' : 'Você perdeu...';
  ui.openModal('game-over', `<h2>${msg}</h2>`, {
    title: 'Fim de Jogo',
    confirmLabel: 'Jogar Novamente',
    onConfirm: () => location.reload(),
  });
});

DOM.endPhaseBtn?.addEventListener('click', () => {
  engine.nextPhase();
  network.broadcast('end-phase', {});
});

function renderHand() {
  if (!engine?.state) return;
  const player = engine.state.players[localId];
  if (!player) return;
  DOM.hand.innerHTML = '';
  const drag = new DragDrop(DOM.gameScreen);
  player.hand.forEach(card => {
    const el = renderer.renderCard(card);
    drag.enable(el, { cardId: card.id, instanceId: card.instanceId });
    tooltip.attach(el, `<b>${card.name}</b><br>${card.description ?? ''}<br><small>Custo: ${card.cost ?? '—'}</small>`);
    DOM.hand.appendChild(el);
  });
}

function renderField(playerId) {
  if (!engine?.state) return;
  const player = engine.state.players[playerId];
  if (!player) return;
  const container = playerId === localId ? DOM.field : DOM.opponentField;
  container.innerHTML = '';
  const drag = new DragDrop(DOM.gameScreen);
  player.field.forEach(card => {
    const el = renderer.renderCard(card);
    if (card.tapped) el.style.transform = 'rotate(90deg)';
    if (playerId === localId && !card.tapped && !card.summoningSick) {
      drag.enable(el, { cardId: card.id, instanceId: card.instanceId });
    }
    tooltip.attach(el, `<b>${card.name}</b><br>${card.description ?? ''}`);
    container.appendChild(el);
  });
}

function updateHUD() {
  if (!engine?.state) return;
  const local    = engine.state.players[localId];
  const opponent = engine.state.players[opponentId];
  if (!local || !opponent) return;
  DOM.manaDisplay.textContent    = `Mana: ${local.mana}/${local.maxMana}`;
  DOM.hpDisplay.textContent      = `HP: ${local.hp}`;
  DOM.opHpDisplay.textContent    = `HP: ${opponent.hp}`;
  DOM.phaseDisplay.textContent   = `Fase: ${engine.state.phase}`;
  DOM.turnDisplay.textContent    = engine.state.turn === localId ? 'Seu turno' : 'Turno do oponente';
  DOM.endPhaseBtn.disabled       = engine.state.turn !== localId;
}

function shakeHp(targetId) {
  const el = targetId === localId ? DOM.hpDisplay : DOM.opHpDisplay;
  el?.classList.remove('shake');
  requestAnimationFrame(() => el?.classList.add('shake'));
  const rect = el?.getBoundingClientRect();
  if (rect) fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2,
    { count: 8, colors: ['#ff4444', '#ff8800'], spread: 30 });
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
init().catch(console.error);
