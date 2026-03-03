// shared/network/NetworkManager.js
// Wrapper PeerJS — multiplayer P2P sem servidor de jogo

import { bus } from '../core/EventBus.js';

const PEERJS_CDN = 'https://esm.sh/peerjs@1.5';

class NetworkManager {
  constructor() {
    this.peer = null;
    this.connections = new Map(); // peerId -> DataConnection
    this.roomId = null;
    this.isHost = false;
    this.localId = null;
    this._PeerClass = null;
  }

  async _ensurePeer() {
    if (!this._PeerClass) {
      const mod = await import(PEERJS_CDN);
      this._PeerClass = mod.default ?? mod.Peer;
    }
  }

  /** Cria uma sala como host */
  async createRoom(roomId) {
    await this._ensurePeer();
    this.isHost = true;
    this.roomId = roomId;
    this.peer = new this._PeerClass(roomId);
    this.localId = await this._waitReady();
    this.peer.on('connection', conn => this._onIncomingConnection(conn));
    bus.emit('net:room-created', { roomId, localId: this.localId });
    console.log(`[Network] Sala criada: ${roomId}`);
    return this.localId;
  }

  /** Entra em uma sala como cliente */
  async joinRoom(roomId) {
    await this._ensurePeer();
    this.isHost = false;
    this.roomId = roomId;
    this.peer = new this._PeerClass();
    this.localId = await this._waitReady();
    const conn = this.peer.connect(roomId, { reliable: true });
    await this._waitConnection(conn);
    this._registerConnection(conn);
    bus.emit('net:room-joined', { roomId, localId: this.localId });
    console.log(`[Network] Entrou na sala: ${roomId}`);
    return this.localId;
  }

  /** Envia para todos os peers conectados */
  broadcast(type, payload) {
    const msg = JSON.stringify({ type, payload, from: this.localId });
    this.connections.forEach(conn => {
      if (conn.open) conn.send(msg);
    });
  }

  /** Envia para um peer específico */
  sendTo(peerId, type, payload) {
    const conn = this.connections.get(peerId);
    if (conn?.open) conn.send(JSON.stringify({ type, payload, from: this.localId }));
  }

  /** Retorna lista de peers conectados */
  get peers() {
    return [...this.connections.keys()];
  }

  disconnect() {
    this.connections.forEach(conn => conn.close());
    this.peer?.destroy();
    this.peer = null;
    this.connections.clear();
    this.roomId = null;
    this.isHost = false;
    bus.emit('net:disconnected', {});
  }

  _onIncomingConnection(conn) {
    conn.on('open', () => {
      this._registerConnection(conn);
      bus.emit('net:peer-joined', { peerId: conn.peer });
      console.log(`[Network] Peer conectado: ${conn.peer}`);
    });
  }

  _registerConnection(conn) {
    this.connections.set(conn.peer, conn);
    conn.on('data', raw => {
      try {
        const msg = JSON.parse(raw);
        bus.emit('net:action', msg);
      } catch (e) {
        console.warn('[Network] Mensagem inválida:', raw);
      }
    });
    conn.on('close', () => {
      this.connections.delete(conn.peer);
      bus.emit('net:peer-left', { peerId: conn.peer });
      console.log(`[Network] Peer desconectado: ${conn.peer}`);
    });
    conn.on('error', err => {
      bus.emit('net:error', { peerId: conn.peer, error: err });
    });
  }

  _waitReady() {
    return new Promise((res, rej) => {
      this.peer.on('open', id => res(id));
      this.peer.on('error', err => rej(err));
    });
  }

  _waitConnection(conn) {
    return new Promise((res, rej) => {
      conn.on('open', res);
      conn.on('error', rej);
    });
  }
}

export const network = new NetworkManager();
