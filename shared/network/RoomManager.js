// shared/network/RoomManager.js
// Lobby e gerenciamento de salas — convite por URL ou QR Code

import { bus } from '../core/EventBus.js';
import { network } from './NetworkManager.js';

export class RoomManager {
  constructor() {
    this._players = new Map(); // peerId -> { name, ready }
    this._localName = 'Player';
    this._onStartCallback = null;

    bus.on('net:peer-joined', ({ peerId }) => {
      this._players.set(peerId, { peerId, name: peerId.slice(0, 8), ready: false });
      bus.emit('lobby:updated', { players: this.playerList });
    });

    bus.on('net:peer-left', ({ peerId }) => {
      this._players.delete(peerId);
      bus.emit('lobby:updated', { players: this.playerList });
    });

    bus.on('net:action', ({ type, payload, from }) => {
      if (type === 'lobby:info')  this._handleInfo(from, payload);
      if (type === 'lobby:ready') this._handleReady(from, payload);
      if (type === 'lobby:start') this._onStartCallback?.();
    });
  }

  /** Cria sala com ID aleatório legível */
  async createRoom(playerName = 'Host') {
    this._localName = playerName;
    const roomId = this._generateRoomId();
    await network.createRoom(roomId);
    this._addSelf(network.localId, playerName);
    return { roomId, inviteUrl: this._buildInviteUrl(roomId) };
  }

  /** Entra em sala pelo ID */
  async joinRoom(roomId, playerName = 'Player') {
    this._localName = playerName;
    await network.joinRoom(roomId);
    this._addSelf(network.localId, playerName);
    network.broadcast('lobby:info', { name: playerName });
    return { roomId };
  }

  /** Marca jogador local como pronto */
  setReady(ready = true) {
    const player = this._players.get(network.localId);
    if (player) player.ready = ready;
    network.broadcast('lobby:ready', { ready });
    bus.emit('lobby:updated', { players: this.playerList });
  }

  /** Host inicia o jogo (envia sinal para todos) */
  startGame() {
    if (!network.isHost) return;
    network.broadcast('lobby:start', {});
    this._onStartCallback?.();
  }

  /** Callback chamado quando o jogo inicia */
  onStart(fn) {
    this._onStartCallback = fn;
  }

  get playerList() {
    return [...this._players.values()];
  }

  get allReady() {
    return this.playerList.length > 1 && this.playerList.every(p => p.ready);
  }

  /** Gera QR Code como SVG inline (sem dependência externa) */
  getInviteUrl(roomId) {
    return this._buildInviteUrl(roomId ?? network.roomId);
  }

  _addSelf(id, name) {
    this._players.set(id, { peerId: id, name, ready: false, isLocal: true });
    bus.emit('lobby:updated', { players: this.playerList });
  }

  _handleInfo(peerId, { name }) {
    const p = this._players.get(peerId);
    if (p) p.name = name;
    bus.emit('lobby:updated', { players: this.playerList });
  }

  _handleReady(peerId, { ready }) {
    const p = this._players.get(peerId);
    if (p) p.ready = ready;
    bus.emit('lobby:updated', { players: this.playerList });
  }

  _buildInviteUrl(roomId) {
    const url = new URL(location.href);
    url.searchParams.set('join', roomId);
    return url.toString();
  }

  _generateRoomId() {
    const words = ['fire', 'ice', 'storm', 'void', 'shadow', 'gold', 'iron', 'moon'];
    const a = words[Math.floor(Math.random() * words.length)];
    const b = words[Math.floor(Math.random() * words.length)];
    const n = Math.floor(Math.random() * 900 + 100);
    return `${a}-${b}-${n}`;
  }
}
