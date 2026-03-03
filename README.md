# GamePrototype — Repositório de Protótipos de Jogos Online

> Código e variáveis em **inglês** · Documentação em **Português (BR)**

---

## Visão Geral

Monorepo de protótipos de jogos online com foco em **escalabilidade, reusabilidade e multiplayer P2P**.
Cada jogo vive em sua própria pasta dentro de `/games`, mas todos compartilham os módulos de `/shared`.

### Tecnologias Principais

| Tecnologia | Uso |
|---|---|
| **HTML5 + Vanilla JS (ESM)** | Base dos jogos, sem frameworks pesados |
| **PeerJS** | Multiplayer P2P (sem servidor de jogo, só signaling) |
| **IndexedDB** | Persistência local (coleções, saves, decks) |
| **Three.js** | Renderização 3D para jogos de arena/tabuleiro 3D |
| **SVG** | Renderização de cartas, HUD e interfaces vetoriais |
| **Web Audio API** | Sons e música com posicionamento espacial |

---

## Estrutura de Pastas

```
GamePrototype/
├── shared/                     # Módulos reutilizáveis entre todos os jogos
│   ├── core/
│   │   ├── EventBus.js         # Sistema pub/sub global
│   │   ├── StateManager.js     # Estado reativo + sincronização de rede
│   │   └── AssetLoader.js      # Carregamento lazy com cache
│   ├── network/
│   │   ├── NetworkManager.js   # Wrapper PeerJS (salas, broadcast, sync)
│   │   └── RoomManager.js      # Lobby, matchmaking simples
│   ├── storage/
│   │   └── StorageManager.js   # Wrapper IndexedDB (coleções, saves, config)
│   ├── render/
│   │   ├── SceneManager.js     # Wrapper Three.js (cena, câmera, luz, loop)
│   │   ├── CardRenderer.js     # Renderiza cartas via SVG
│   │   └── ParticleSystem.js   # Efeitos de partículas (Three.js + SVG)
│   ├── ui/
│   │   ├── UIManager.js        # Gerencia painéis HTML/SVG overlay
│   │   ├── DragDrop.js         # Arrastar e soltar (cartas, peças)
│   │   └── Tooltip.js          # Tooltips genéricos
│   ├── audio/
│   │   └── AudioManager.js     # BGM, SFX, áudio espacial 3D
│   ├── input/
│   │   └── InputManager.js     # Teclado, mouse, touch unificados
│   └── tcg/
│       ├── CardEngine.js       # Motor de regras TCG genérico
│       ├── DeckManager.js      # Construção e validação de decks
│       └── TurnManager.js      # Gerenciamento de turnos e fases
│
├── games/
│   ├── tcg-basic/              # TCG 2D simples (SVG + PeerJS)
│   │   ├── index.html
│   │   ├── main.js
│   │   ├── cards.json          # Data dos cards do jogo
│   │   └── rules.js            # Regras específicas deste TCG
│   ├── tcg-3d/                 # TCG com mesa 3D (Three.js)
│   │   ├── index.html
│   │   ├── main.js
│   │   └── rules.js
│   └── arena-3d/               # Jogo de arena 3D simples
│       ├── index.html
│       ├── main.js
│       └── entities/
│
├── assets/                     # Assets compartilhados
│   ├── fonts/
│   ├── textures/
│   └── sounds/
│
└── README.md
```

---

## Módulos Compartilhados — Detalhamento

### 1. `EventBus.js` — Barramento de Eventos Global

Sistema publish/subscribe que desacopla todos os módulos.
Qualquer módulo pode emitir ou ouvir eventos sem depender diretamente de outro.

```js
// shared/core/EventBus.js
class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, callback) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(callback);
    return () => this.off(event, callback); // retorna unsubscribe
  }

  off(event, callback) {
    const list = this._listeners.get(event) ?? [];
    this._listeners.set(event, list.filter(cb => cb !== callback));
  }

  emit(event, payload) {
    (this._listeners.get(event) ?? []).forEach(cb => cb(payload));
  }
}

export const bus = new EventBus();
```

**Eventos padronizados:**
```
game:start          game:end            game:pause
turn:start          turn:end            turn:phase-change
card:played         card:drawn          card:destroyed
player:damage       player:heal         player:win
net:peer-joined     net:peer-left       net:state-sync
net:action          ui:modal-open       ui:modal-close
store:loaded        store:saved
```

---

### 2. `NetworkManager.js` — Multiplayer P2P com PeerJS

Wrapper de alto nível sobre PeerJS. Abstrai salas, broadcast e sincronização de estado.

```js
// shared/network/NetworkManager.js
import Peer from 'https://esm.sh/peerjs@1.5';
import { bus } from '../core/EventBus.js';

class NetworkManager {
  constructor() {
    this.peer = null;
    this.connections = new Map(); // peerId -> DataConnection
    this.roomId = null;
    this.isHost = false;
  }

  async createRoom(roomId) {
    this.isHost = true;
    this.roomId = roomId;
    this.peer = new Peer(roomId);
    await this._waitReady();
    this.peer.on('connection', conn => this._onIncomingConnection(conn));
  }

  async joinRoom(roomId) {
    this.isHost = false;
    this.roomId = roomId;
    this.peer = new Peer(); // id aleatório
    await this._waitReady();
    const conn = this.peer.connect(roomId);
    await this._waitConnection(conn);
    this._registerConnection(conn);
  }

  broadcast(type, payload) {
    const msg = JSON.stringify({ type, payload, from: this.peer.id });
    this.connections.forEach(conn => conn.send(msg));
  }

  sendTo(peerId, type, payload) {
    this.connections.get(peerId)?.send(JSON.stringify({ type, payload, from: this.peer.id }));
  }

  _onIncomingConnection(conn) {
    conn.on('open', () => {
      this._registerConnection(conn);
      bus.emit('net:peer-joined', { peerId: conn.peer });
    });
  }

  _registerConnection(conn) {
    this.connections.set(conn.peer, conn);
    conn.on('data', raw => {
      const msg = JSON.parse(raw);
      bus.emit('net:action', msg);  // todos os módulos podem reagir
    });
    conn.on('close', () => {
      this.connections.delete(conn.peer);
      bus.emit('net:peer-left', { peerId: conn.peer });
    });
  }

  _waitReady() {
    return new Promise(res => this.peer.on('open', res));
  }

  _waitConnection(conn) {
    return new Promise(res => conn.on('open', res));
  }
}

export const network = new NetworkManager();
```

**Padrão de ação sincronizada:**
```js
// Qualquer jogo envia ações assim:
network.broadcast('card:play', { cardId: 'fireball', targetId: 'player2' });

// E qualquer jogo escuta assim:
bus.on('net:action', ({ type, payload, from }) => {
  if (type === 'card:play') gameEngine.applyAction(payload, from);
});
```

---

### 3. `StorageManager.js` — Persistência com IndexedDB

Wrapper simplificado para IndexedDB. Gerencia coleções, decks, saves e configurações.

```js
// shared/storage/StorageManager.js
class StorageManager {
  constructor(dbName = 'GamePrototype', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  async init(stores) {
    // stores: [{ name: 'cards', keyPath: 'id' }, ...]
    return new Promise((res, rej) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        stores.forEach(({ name, keyPath, indexes = [] }) => {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath });
            indexes.forEach(({ field, unique }) =>
              store.createIndex(field, field, { unique }));
          }
        });
      };
      req.onsuccess = e => { this.db = e.target.result; res(this); };
      req.onerror = e => rej(e.target.error);
    });
  }

  async put(storeName, record) {
    return this._tx(storeName, 'readwrite', s => s.put(record));
  }

  async get(storeName, key) {
    return this._tx(storeName, 'readonly', s => s.get(key));
  }

  async getAll(storeName) {
    return this._tx(storeName, 'readonly', s => s.getAll());
  }

  async delete(storeName, key) {
    return this._tx(storeName, 'readwrite', s => s.delete(key));
  }

  async query(storeName, indexName, value) {
    return this._tx(storeName, 'readonly', s =>
      s.index(indexName).getAll(value));
  }

  _tx(storeName, mode, fn) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(storeName, mode);
      const req = fn(tx.objectStore(storeName));
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
}

export const storage = new StorageManager();
```

**Uso nos jogos:**
```js
await storage.init([
  { name: 'collection', keyPath: 'id', indexes: [{ field: 'type' }] },
  { name: 'decks',      keyPath: 'deckId' },
  { name: 'saves',      keyPath: 'saveId' },
  { name: 'settings',   keyPath: 'key' },
]);

await storage.put('collection', { id: 'card_001', name: 'Fireball', type: 'spell' });
const myCards = await storage.query('collection', 'type', 'spell');
```

---

### 4. `CardEngine.js` — Motor TCG Genérico

Núcleo de regras para TCG. Define estrutura de carta, estado de jogo e pipeline de ações.

```js
// shared/tcg/CardEngine.js
import { bus } from '../core/EventBus.js';

export class CardEngine {
  constructor(rules) {
    this.rules = rules; // objeto de regras específico do jogo
    this.state = {
      players: {},    // { [playerId]: { hand, field, graveyard, hp, mana } }
      turn: null,     // playerId do jogador atual
      phase: 'draw',  // draw | main | battle | end
      stack: [],      // pilha de efeitos pendentes
    };
  }

  initGame(playerIds, deckMap) {
    playerIds.forEach(id => {
      this.state.players[id] = {
        id,
        hp: this.rules.startingHp,
        mana: 0,
        maxMana: 0,
        hand: [],
        field: [],
        graveyard: [],
        deck: [...deckMap[id]],
      };
    });
    this.state.turn = playerIds[0];
    this.state.phase = 'draw';
    bus.emit('game:start', this.state);
  }

  applyAction(action, sourcePlayerId) {
    // valida se é a vez do jogador
    if (!this.rules.canAct(this.state, sourcePlayerId, action)) return false;

    const result = this.rules.resolveAction(this.state, action, sourcePlayerId);
    this._applyMutations(result.mutations);
    bus.emit(`game:action`, { action, result, state: this.state });
    return true;
  }

  drawCard(playerId, count = 1) {
    const player = this.state.players[playerId];
    for (let i = 0; i < count; i++) {
      if (player.deck.length === 0) {
        bus.emit('player:deck-empty', { playerId });
        return;
      }
      const card = player.deck.shift();
      player.hand.push(card);
      bus.emit('card:drawn', { playerId, card });
    }
  }

  nextPhase() {
    const phases = this.rules.phases; // ex: ['draw','main','battle','end']
    const idx = phases.indexOf(this.state.phase);
    this.state.phase = phases[(idx + 1) % phases.length];
    if (this.state.phase === phases[0]) this._nextTurn();
    bus.emit('turn:phase-change', { phase: this.state.phase, turn: this.state.turn });
  }

  _nextTurn() {
    const ids = Object.keys(this.state.players);
    const idx = ids.indexOf(this.state.turn);
    this.state.turn = ids[(idx + 1) % ids.length];
    const player = this.state.players[this.state.turn];
    player.maxMana = Math.min(player.maxMana + 1, this.rules.maxMana ?? 10);
    player.mana = player.maxMana;
    this.drawCard(this.state.turn);
    bus.emit('turn:start', { playerId: this.state.turn });
  }

  _applyMutations(mutations) {
    mutations.forEach(({ type, target, value }) => {
      const player = this.state.players[target];
      if (type === 'damage') { player.hp -= value; bus.emit('player:damage', { target, value }); }
      if (type === 'heal')   { player.hp += value; bus.emit('player:heal',   { target, value }); }
      if (type === 'field-add')    player.field.push(value);
      if (type === 'field-remove') player.field = player.field.filter(c => c.id !== value);
      if (type === 'graveyard')    player.graveyard.push(value);
      if (player.hp <= 0) bus.emit('player:win', { winner: this._getOpponent(target) });
    });
  }
}
```

**Exemplo de `rules.js` por jogo:**
```js
// games/tcg-basic/rules.js
export const rules = {
  startingHp: 20,
  maxMana: 10,
  phases: ['draw', 'main', 'battle', 'end'],

  canAct(state, playerId, action) {
    if (state.turn !== playerId) return false;
    if (action.type === 'play-card') {
      const card = state.players[playerId].hand.find(c => c.id === action.cardId);
      return card && state.players[playerId].mana >= card.cost;
    }
    return true;
  },

  resolveAction(state, action, playerId) {
    if (action.type === 'play-card') {
      const player = state.players[playerId];
      const card = player.hand.find(c => c.id === action.cardId);
      player.hand = player.hand.filter(c => c.id !== action.cardId);
      player.mana -= card.cost;

      const mutations = [{ type: 'field-add', target: playerId, value: card }];
      if (card.effect === 'direct-damage')
        mutations.push({ type: 'damage', target: action.targetId, value: card.power });
      return { mutations };
    }
    return { mutations: [] };
  },
};
```

---

### 5. `CardRenderer.js` — Cartas em SVG

Renderiza cartas como SVG reutilizável. Suporta templates customizáveis por jogo.

```js
// shared/render/CardRenderer.js
export class CardRenderer {
  constructor(templateFn) {
    // templateFn: (card) => string SVG — cada jogo define seu visual
    this.templateFn = templateFn ?? CardRenderer.defaultTemplate;
  }

  renderCard(card) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 200 280');
    svg.setAttribute('width', '140');
    svg.setAttribute('height', '196');
    svg.innerHTML = this.templateFn(card);
    svg.dataset.cardId = card.id;
    return svg;
  }

  static defaultTemplate(card) {
    const color = card.type === 'creature' ? '#2d6a4f' :
                  card.type === 'spell'    ? '#1d3557' : '#6b2d8b';
    return `
      <rect width="200" height="280" rx="12" fill="${color}" stroke="#d4af37" stroke-width="3"/>
      <rect x="10" y="10" width="180" height="130" rx="8" fill="#000" fill-opacity="0.3"/>
      <text x="100" y="160" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">${card.name}</text>
      <text x="100" y="178" text-anchor="middle" fill="#d4af37" font-size="10">${card.type?.toUpperCase()}</text>
      <text x="15" y="220" fill="#fff" font-size="9" width="170">${card.description ?? ''}</text>
      ${card.cost !== undefined ? `
        <circle cx="24" cy="24" r="16" fill="#1a6fc4" stroke="#fff" stroke-width="2"/>
        <text x="24" y="29" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">${card.cost}</text>` : ''}
      ${card.power !== undefined ? `
        <circle cx="170" cy="256" r="16" fill="#c1121f" stroke="#fff" stroke-width="2"/>
        <text x="170" y="261" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">${card.power}</text>` : ''}
      ${card.toughness !== undefined ? `
        <circle cx="176" cy="256" r="16" fill="#4a4e69" stroke="#fff" stroke-width="2"/>
        <text x="176" y="261" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">${card.toughness}</text>` : ''}
    `;
  }
}
```

---

### 6. `SceneManager.js` — Three.js Wrapper

Abstrai boilerplate do Three.js: renderer, cena, câmera, loop de jogo, redimensionamento.

```js
// shared/render/SceneManager.js
import * as THREE from 'https://esm.sh/three@0.165';

export class SceneManager {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this._updateSize();
    window.addEventListener('resize', () => this._updateSize());
    this._callbacks = [];
  }

  addLight(type = 'ambient', options = {}) {
    const lights = {
      ambient:     () => new THREE.AmbientLight(options.color ?? 0xffffff, options.intensity ?? 0.6),
      directional: () => { const l = new THREE.DirectionalLight(options.color ?? 0xffffff, options.intensity ?? 1);
                           l.position.set(...(options.position ?? [5, 10, 5])); return l; },
      point:       () => { const l = new THREE.PointLight(options.color ?? 0xffffff, options.intensity ?? 1);
                           l.position.set(...(options.position ?? [0, 5, 0])); return l; },
    };
    const light = lights[type]?.();
    if (light) this.scene.add(light);
    return light;
  }

  onUpdate(fn) { this._callbacks.push(fn); }

  start() {
    const clock = new THREE.Clock();
    const loop = () => {
      requestAnimationFrame(loop);
      const delta = clock.getDelta();
      this._callbacks.forEach(fn => fn(delta));
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  _updateSize() {
    const { clientWidth: w, clientHeight: h } = this.renderer.domElement.parentElement ?? document.body;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
```

---

### 7. `StateManager.js` — Estado Reativo com Sincronização de Rede

```js
// shared/core/StateManager.js
import { bus } from './EventBus.js';
import { network } from '../network/NetworkManager.js';

export class StateManager {
  constructor(initialState = {}) {
    this._state = structuredClone(initialState);
    this._version = 0;

    // Host aplica e transmite mudanças de estado
    bus.on('net:action', ({ type, payload, from }) => {
      if (network.isHost) {
        // host valida + aplica + sincroniza todos
        network.broadcast('state:sync', { state: this._state, version: this._version });
      }
    });

    // Clientes recebem estado autoritativo do host
    bus.on('net:action', ({ type, payload }) => {
      if (type === 'state:sync' && !network.isHost) {
        this._state = payload.state;
        this._version = payload.version;
        bus.emit('state:updated', this._state);
      }
    });
  }

  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this._state);
  }

  patch(mutations) {
    mutations.forEach(([path, value]) => {
      const keys = path.split('.');
      const last = keys.pop();
      const target = keys.reduce((obj, key) => obj[key], this._state);
      target[last] = value;
    });
    this._version++;
    bus.emit('state:updated', this._state);
  }
}
```

---

### 8. `InputManager.js` — Entrada Unificada

```js
// shared/input/InputManager.js
import { bus } from '../core/EventBus.js';

export class InputManager {
  constructor(element = document) {
    this._pressed = new Set();
    this._bindings = new Map();

    element.addEventListener('keydown', e => {
      this._pressed.add(e.code);
      bus.emit('input:keydown', { code: e.code, key: e.key });
      this._bindings.get(e.code)?.forEach(fn => fn(e));
    });
    element.addEventListener('keyup', e => {
      this._pressed.delete(e.code);
      bus.emit('input:keyup', { code: e.code });
    });
    element.addEventListener('pointerdown', e =>
      bus.emit('input:pointerdown', { x: e.clientX, y: e.clientY, button: e.button }));
    element.addEventListener('pointermove', e =>
      bus.emit('input:pointermove', { x: e.clientX, y: e.clientY }));
    element.addEventListener('pointerup', e =>
      bus.emit('input:pointerup', { x: e.clientX, y: e.clientY }));
  }

  bind(keyCode, fn) {
    if (!this._bindings.has(keyCode)) this._bindings.set(keyCode, []);
    this._bindings.get(keyCode).push(fn);
  }

  isPressed(keyCode) { return this._pressed.has(keyCode); }
}
```

---

### 9. `DragDrop.js` — Arrastar e Soltar Cartas

```js
// shared/ui/DragDrop.js
import { bus } from '../core/EventBus.js';

export class DragDrop {
  constructor(container) {
    this.container = container;
    this.dragging = null;
    this._ghost = null;
    this._offset = { x: 0, y: 0 };
    container.addEventListener('pointerdown', e => this._start(e));
    container.addEventListener('pointermove', e => this._move(e));
    container.addEventListener('pointerup',   e => this._end(e));
  }

  enable(element, data) {
    element.dataset.draggable = 'true';
    element.dataset.dragData = JSON.stringify(data);
  }

  makeDropzone(element, accept, onDrop) {
    element.dataset.dropzone = accept;
    element.addEventListener('dragenter', () => element.classList.add('dropzone--active'));
    element.addEventListener('dragleave', () => element.classList.remove('dropzone--active'));
    this._dropHandlers = this._dropHandlers ?? new Map();
    this._dropHandlers.set(element, onDrop);
  }

  _start(e) {
    const el = e.target.closest('[data-draggable]');
    if (!el) return;
    this.dragging = el;
    const rect = el.getBoundingClientRect();
    this._offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    this._ghost = el.cloneNode(true);
    this._ghost.style.cssText = `position:fixed;pointer-events:none;opacity:.85;z-index:9999;`;
    document.body.appendChild(this._ghost);
    this._move(e);
    bus.emit('drag:start', { element: el, data: JSON.parse(el.dataset.dragData) });
  }

  _move(e) {
    if (!this._ghost) return;
    this._ghost.style.left = (e.clientX - this._offset.x) + 'px';
    this._ghost.style.top  = (e.clientY - this._offset.y) + 'px';
  }

  _end(e) {
    if (!this.dragging) return;
    const data = JSON.parse(this.dragging.dataset.dragData);
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-dropzone]');
    if (target) {
      target.classList.remove('dropzone--active');
      this._dropHandlers?.get(target)?.(data, target);
      bus.emit('drag:drop', { data, target });
    }
    this._ghost?.remove();
    this._ghost = null;
    this.dragging = null;
    bus.emit('drag:end', { data });
  }
}
```

---

### 10. `AudioManager.js` — Áudio com Web Audio API

```js
// shared/audio/AudioManager.js
export class AudioManager {
  constructor() {
    this.ctx = null;
    this._buffers = new Map();
    this._music = null;
    this.masterVolume = 1;
  }

  async init() {
    this.ctx = new AudioContext();
    this._master = this.ctx.createGain();
    this._master.connect(this.ctx.destination);
  }

  async loadSound(key, url) {
    const res = await fetch(url);
    const raw = await res.arrayBuffer();
    this._buffers.set(key, await this.ctx.decodeAudioData(raw));
  }

  playSound(key, options = {}) {
    const buffer = this._buffers.get(key);
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = options.volume ?? 1;
    source.connect(gain).connect(this._master);
    source.start(options.delay ?? 0);
    return source;
  }

  playSpatial(key, position, options = {}) {
    // Posicionamento 3D — útil para jogos de arena
    const panner = this.ctx.createPanner();
    panner.setPosition(position.x, position.y, position.z);
    const source = this.playSound(key, options);
    source?.disconnect();
    source?.connect(panner).connect(this._master);
  }

  setMusicVolume(v) { this._master.gain.value = v; }
}
```

---

### 11. `AssetLoader.js` — Carregamento com Cache e Progresso

```js
// shared/core/AssetLoader.js
import { bus } from './EventBus.js';

export class AssetLoader {
  constructor() {
    this._cache = new Map();
    this._total = 0;
    this._loaded = 0;
  }

  async load(manifest) {
    // manifest: [{ key, url, type }]
    this._total = manifest.length;
    this._loaded = 0;
    const results = await Promise.all(manifest.map(item => this._loadItem(item)));
    return Object.fromEntries(results);
  }

  async _loadItem({ key, url, type }) {
    if (this._cache.has(key)) return [key, this._cache.get(key)];
    let asset;
    if (type === 'image')   asset = await this._loadImage(url);
    if (type === 'json')    asset = await fetch(url).then(r => r.json());
    if (type === 'text')    asset = await fetch(url).then(r => r.text());
    if (type === 'texture') asset = await this._loadTexture(url); // Three.js
    this._cache.set(key, asset);
    this._loaded++;
    bus.emit('asset:progress', { loaded: this._loaded, total: this._total, key });
    return [key, asset];
  }

  get(key) { return this._cache.get(key); }

  _loadImage(url) {
    return new Promise((res, rej) => {
      const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = url;
    });
  }
}

export const loader = new AssetLoader();
```

---

## Fluxo de Inicialização de um Jogo

```js
// games/tcg-basic/main.js
import { bus }            from '../../shared/core/EventBus.js';
import { loader }         from '../../shared/core/AssetLoader.js';
import { storage }        from '../../shared/storage/StorageManager.js';
import { network }        from '../../shared/network/NetworkManager.js';
import { CardEngine }     from '../../shared/tcg/CardEngine.js';
import { CardRenderer }   from '../../shared/render/CardRenderer.js';
import { DragDrop }       from '../../shared/ui/DragDrop.js';
import { AudioManager }   from '../../shared/audio/AudioManager.js';
import { rules }          from './rules.js';

async function init() {
  // 1. Carrega assets
  const assets = await loader.load([
    { key: 'cards',    url: './cards.json', type: 'json' },
    { key: 'bgm',      url: '/assets/sounds/tcg-bgm.mp3', type: 'text' },
  ]);

  // 2. Inicia banco local
  await storage.init([
    { name: 'collection', keyPath: 'id' },
    { name: 'decks',      keyPath: 'deckId' },
  ]);

  // 3. Renderiza cartas
  const renderer = new CardRenderer();
  const hand = document.getElementById('hand');
  const deck = await storage.getAll('decks');
  deck[0]?.cards.forEach(card => hand.appendChild(renderer.renderCard(card)));

  // 4. Drag & drop
  const drag = new DragDrop(document.getElementById('board'));
  hand.querySelectorAll('[data-card-id]').forEach(el =>
    drag.enable(el, { cardId: el.dataset.cardId }));

  drag.makeDropzone(document.getElementById('field'), 'card', ({ cardId }) => {
    engine.applyAction({ type: 'play-card', cardId }, localPlayerId);
    network.broadcast('play-card', { cardId });
  });

  // 5. Inicia motor de jogo
  const engine = new CardEngine(rules);

  // 6. Multiplayer
  const params = new URLSearchParams(location.search);
  if (params.get('host')) await network.createRoom(params.get('host'));
  else if (params.get('join')) await network.joinRoom(params.get('join'));

  bus.on('net:action', ({ type, payload, from }) => {
    if (type === 'play-card') engine.applyAction(payload, from);
  });

  // 7. Inicia jogo
  engine.initGame([localPlayerId, remotePlayerId], deckMap);
}

init();
```

---

## Ideias de Jogos para Implementar

### TCG
| Jogo | Descrição |
|---|---|
| `tcg-basic` | TCG 2D clássico, cartas SVG, duelo 1v1 P2P |
| `tcg-draft` | Draft de cartas em grupo, 4 jogadores, PeerJS mesh |
| `tcg-3d` | Mesa de jogo em Three.js, cartas físicas com shadow casting |
| `tcg-roguelike` | Single player, baralho vs IA scriptada, progressão persistida no IndexedDB |

### 3D
| Jogo | Descrição |
|---|---|
| `arena-3d` | Arena de combate simples, câmera orbital, 2 jogadores |
| `tower-defense-3d` | Torres e inimigos em grade 3D, wave-based |
| `dungeon-crawler` | Exploração de dungeon em perspectiva isométrica Three.js |
| `board-game-3d` | Tabuleiro genérico 3D, peças arrastáveis, qualquer jogo de tabuleiro |

### Utilitários extras para explorar
- **`RoomManager`** — lobby com QR Code para convite rápido
- **`ReplaySystem`** — grava sequência de ações para replay/análise
- **`AIPlayer`** — IA simples baseada em heurística para testes solo
- **`TournamentManager`** — bracket de torneio P2P
- **`ParticleSystem`** — efeitos visuais reutilizáveis (explosões, cura, buff)
- **`AnimationTimeline`** — sequência de tweens CSS/Three.js para efeitos de cartas

---

## Padrões de Projeto Adotados

| Padrão | Onde é usado |
|---|---|
| **Observer (EventBus)** | Comunicação entre todos os módulos |
| **Facade** | `NetworkManager`, `StorageManager`, `SceneManager` |
| **Template Method** | `CardEngine` + `rules.js` por jogo |
| **Strategy** | `CardRenderer` com template customizável |
| **Singleton** | `bus`, `network`, `storage`, `loader` (export único) |

---

## Como Adicionar um Novo Jogo

```
1. Crie a pasta:   games/meu-novo-jogo/
2. Crie:           index.html, main.js
3. Importe os shared/ que precisar via ESM relativo
4. Defina:         rules.js (para TCG) ou lógica própria
5. Carregue assets pelo AssetLoader
6. Conecte ao PeerJS se for multiplayer
```

Nenhuma ferramenta de build é necessária — todos os módulos usam **ES Modules nativos** e importações via `esm.sh` ou arquivos locais.

---

## Dependências (CDN / esm.sh — sem build step)

```js
import Peer     from 'https://esm.sh/peerjs@1.5';
import * as THREE from 'https://esm.sh/three@0.165';
import { OrbitControls } from 'https://esm.sh/three@0.165/addons/controls/OrbitControls.js';
import { GLTFLoader }    from 'https://esm.sh/three@0.165/addons/loaders/GLTFLoader.js';
```

---

*Gerado com Claude Code — atualizar conforme o projeto evoluir.*
