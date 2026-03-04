/**
 * DominoNetwork.js
 * Camada de rede específica para o jogo de dominó, usando o NetworkManager P2P (PeerJS).
 *
 * Arquitetura:
 *  - HOST: roda a lógica completa do jogo; recebe ações dos clientes,
 *          valida, aplica e faz broadcast do estado público.
 *  - CLIENT: só exibe o estado recebido do host e envia suas ações.
 */

import { network } from '../../../shared/network/NetworkManager.js';
import { bus } from '../../../shared/core/EventBus.js';
import { Piece } from './Piece.js';

export class DominoNetwork {
  constructor() {
    this.game = null;
    this._peerPlayerMap = new Map(); // peerId → playerIndex (0-based)
    this._joinedPeers = [];          // ordem de entrada dos clients

    this.localPlayerId = 1;   // índice do jogador local (host=1, clients=2,3,4)
    this.isNetworkMode = false;
    this.role = null;         // 'host' | 'client'

    // Estado remoto (usado pelo client para renderizar)
    this.remoteState = null;
    this.remoteHand  = [];

    bus.on('net:action',    msg => this._handleMsg(msg));
    bus.on('net:peer-joined', ({ peerId }) => this._onPeerJoined(peerId));
    bus.on('net:peer-left',   ({ peerId }) => this._onPeerLeft(peerId));
  }

  setGame(game) { this.game = game; }

  get isHost() { return this.role === 'host'; }

  /** Gera um código de sala aleatório de 6 letras */
  static generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // ─── Criar / Entrar ──────────────────────────────────────────────────────

  async createRoom(roomId, playerName) {
    this.role = 'host';
    this.isNetworkMode = true;
    this.localPlayerId = 1;
    this._playerName = playerName;
    await network.createRoom(`dom-${roomId}`);
    bus.emit('net:room-ready', { roomId, role: 'host', localId: network.localId });
  }

  async joinRoom(roomId, playerName) {
    this.role = 'client';
    this.isNetworkMode = true;
    this._playerName = playerName;
    await network.joinRoom(`dom-${roomId}`);
    // Apresenta-se ao host
    network.broadcast('player:hello', { name: playerName });
    bus.emit('net:room-ready', { roomId, role: 'client' });
  }

  // ─── Eventos de conexão ──────────────────────────────────────────────────

  _onPeerJoined(peerId) {
    if (!this.isHost) return;
    // Atribui slot: players[1], players[2], players[3]...
    const idx = this._joinedPeers.length + 1;
    this._joinedPeers.push(peerId);
    this._peerPlayerMap.set(peerId, idx);
    bus.emit('net:player-waiting', { peerId, slotIndex: idx + 1, count: this._joinedPeers.length });
  }

  _onPeerLeft(peerId) {
    bus.emit('net:player-disconnected', { peerId });
  }

  // ─── Despacho de mensagens ───────────────────────────────────────────────

  _handleMsg({ type, payload, from }) {
    if (this.isHost) {
      this._handleHostMsg(type, payload, from);
    } else {
      this._handleClientMsg(type, payload);
    }
  }

  _handleHostMsg(type, payload, from) {
    switch (type) {
      case 'player:hello': {
        const idx = this._peerPlayerMap.get(from);
        if (idx !== undefined && this.game?.players[idx]) {
          this.game.players[idx].name = payload.name?.trim() || `Jogador ${idx + 1}`;
        }
        bus.emit('net:player-named', { from, name: payload.name });
        break;
      }
      case 'game:action': {
        const idx = this._peerPlayerMap.get(from);
        if (idx === undefined || !this.game) return;
        if (this.game.currentPlayerIndex !== idx) return;
        const player = this.game.players[idx];
        const piece = player.getHand().find(
          p => p.left === payload.pieceLeft && p.right === payload.pieceRight
        );
        if (!piece) return;
        if (payload.zone === 'head') this.game.tryInsertAtHead(piece, player);
        else                         this.game.tryInsertAtTail(piece, player);
        this.broadcastState();
        break;
      }
      case 'game:draw': {
        const idx = this._peerPlayerMap.get(from);
        if (idx === undefined || !this.game) return;
        if (this.game.currentPlayerIndex !== idx) return;
        const piece = this.game.drawRandomPiece();
        if (piece) {
          this.game.players[idx].addPiece(piece);
          this.game.logMove(piece, 'comprou', -1, true);
          this.broadcastState();
        }
        break;
      }
      case 'game:pass': {
        const idx = this._peerPlayerMap.get(from);
        if (idx === undefined || !this.game) return;
        if (this.game.currentPlayerIndex !== idx) return;
        this.game.switchPlayer();
        this.broadcastState();
        break;
      }
    }
  }

  _handleClientMsg(type, payload) {
    switch (type) {
      case 'game:state':
        this.remoteState = payload;
        bus.emit('net:state-update', payload);
        break;
      case 'game:hand':
        this.remoteHand = (payload.hand || []).map(p => new Piece(p.left, p.right));
        bus.emit('net:hand-update', { hand: this.remoteHand });
        break;
      case 'game:init':
        this.localPlayerId = payload.localPlayerId;
        bus.emit('net:game-init', payload);
        break;
      case 'game:over':
        bus.emit('game:over', payload);
        break;
    }
  }

  // ─── Iniciar jogo (host) ──────────────────────────────────────────────────

  startNetworkGame(names) {
    if (!this.isHost || !this.game) return;
    const numPlayers = 1 + this._joinedPeers.length;

    this.game.initializeGame(numPlayers, false, names);

    // Notifica cada cliente qual é o seu slot
    this._peerPlayerMap.forEach((playerIdx, peerId) => {
      network.sendTo(peerId, 'game:init', {
        localPlayerId: playerIdx + 1,
      });
    });

    this.broadcastState();
  }

  // ─── Broadcast de estado (host) ───────────────────────────────────────────

  broadcastState() {
    if (!this.isHost || !this.game) return;

    const pub = {
      board: this.game.board.getPieces().map(p => ({ left: p.left, right: p.right })),
      players: this.game.players.map(p => ({
        id: p.id, name: p.name, handSize: p.countPieces(),
      })),
      currentPlayerIndex: this.game.currentPlayerIndex,
      poolSize: this.game.piecesPool.length,
      isActive: this.game.isActive,
      winner: this.game.state.get().winner,
    };

    network.broadcast('game:state', pub);

    // Envia mão privada para cada cliente
    this._peerPlayerMap.forEach((playerIdx, peerId) => {
      const player = this.game.players[playerIdx];
      if (player) {
        network.sendTo(peerId, 'game:hand', {
          hand: player.getHand().map(p => ({ left: p.left, right: p.right })),
        });
      }
    });

    // Broadcast game:over se houver vencedor
    const winner = this.game.state.get().winner;
    if (winner) {
      network.broadcast('game:over', { winner: { name: winner.name } });
    }
  }

  // ─── Envio de ações (client) ──────────────────────────────────────────────

  sendAction(piece, zone) {
    if (this.isHost) return;
    network.broadcast('game:action', {
      pieceLeft: piece.left, pieceRight: piece.right, zone,
    });
  }

  sendDraw() {
    if (this.isHost) return;
    network.broadcast('game:draw', {});
  }

  sendPass() {
    if (this.isHost) return;
    network.broadcast('game:pass', {});
  }

  disconnect() {
    network.disconnect();
    this._peerPlayerMap.clear();
    this._joinedPeers = [];
    this.remoteState = null;
    this.remoteHand  = [];
    this.isNetworkMode = false;
    this.role = null;
  }
}

export const dominoNetwork = new DominoNetwork();
