// games/arena-3d/entities/Player.js
// Entidade jogador — movimentação, rotação, hit-flash e arma visual

import { bus } from '../../../shared/core/EventBus.js';

export class Player {
  /**
   * @param {string} id
   * @param {THREE.Scene} scene
   * @param {typeof THREE} THREE
   * @param {Object} options
   */
  constructor(id, scene, THREE, options = {}) {
    this.id       = id;
    this.hp       = options.hp    ?? 100;
    this.maxHp    = options.hp    ?? 100;
    this.speed    = options.speed ?? 6;
    this.isLocal  = options.isLocal ?? false;
    this._THREE   = THREE;
    this._hitFlashTimer = 0;
    this._baseColor = options.color ?? (options.isLocal ? 0x4a7fcb : 0xc1121f);

    // Group permite rotacionar o corpo sem mexer na posição do grupo
    this.group = new THREE.Group();

    // Corpo (cápsula)
    const geo = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
    this._mat = new THREE.MeshStandardMaterial({ color: this._baseColor });
    this.mesh = new THREE.Mesh(geo, this._mat);
    this.mesh.castShadow = true;

    // Cano da arma (visual apenas)
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.10, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.3 })
    );
    barrel.position.set(0.28, 0.12, -0.62);
    this.mesh.add(barrel);

    // Olho — indica direção de frente
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.08),
      new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1
      })
    );
    eye.position.set(0.18, 0.55, -0.38);
    this.mesh.add(eye);

    this.group.add(this.mesh);
    this.group.position.set(options.x ?? 0, 1, options.z ?? 0);
    scene.add(this.group);
  }

  /**
   * Move na direção dada, rotaciona o corpo e aplica limites da arena.
   * @param {THREE.Vector3} direction  vetor normalizado
   * @param {number}        delta      segundos desde o último frame
   * @param {Array}         obstacles  lista de obstáculos [[x, z], ...]
   */
  move(direction, delta, obstacles = []) {
    const speed = this.speed * delta;
    const oldX = this.group.position.x;
    const oldZ = this.group.position.z;

    // Tentativa de movimento no eixo X
    this.group.position.x += direction.x * speed;
    if (this._checkCollision(obstacles)) {
      this.group.position.x = oldX; // Reverte se colidir
    }

    // Tentativa de movimento no eixo Z
    this.group.position.z += direction.z * speed;
    if (this._checkCollision(obstacles)) {
      this.group.position.z = oldZ; // Reverte se colidir
    }

    if (direction.length() > 0.01) {
      // atan2(-x, -z) faz o corpo encarar a direção do movimento
      this.mesh.rotation.y = Math.atan2(-direction.x, -direction.z);
    }

    this.group.position.x = Math.max(-9.2, Math.min(9.2, this.group.position.x));
    this.group.position.z = Math.max(-5.2, Math.min(5.2, this.group.position.z));
  }

  _checkCollision(obstacles) {
    const radius = 0.4; // Raio do player
    const obstSize = 0.75; // Metade da largura do obstáculo (1.5 / 2)
    const threshold = radius + obstSize;

    for (const [ox, oz] of obstacles) {
      const dx = Math.abs(this.group.position.x - ox);
      const dz = Math.abs(this.group.position.z - oz);
      if (dx < threshold && dz < threshold) {
        return true;
      }
    }
    return false;
  }

  /** Rotaciona o corpo para encarar uma posição (bot AI). */
  faceTarget(targetPos) {
    const dx = targetPos.x - this.group.position.x;
    const dz = targetPos.z - this.group.position.z;
    this.mesh.rotation.y = Math.atan2(-dx, -dz);
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this._mat.color.setHex(0xff2222);
    this._hitFlashTimer = 0.18;
    bus.emit('player:damage', { id: this.id, hp: this.hp, amount });
    if (this.hp <= 0) bus.emit('player:dead', { id: this.id });
  }

  /** Chamado a cada frame para animar o hit-flash. */
  update(delta) {
    if (this._hitFlashTimer > 0) {
      this._hitFlashTimer -= delta;
      if (this._hitFlashTimer <= 0) {
        this._mat.color.setHex(this._baseColor);
      }
    }
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    bus.emit('player:heal', { id: this.id, hp: this.hp });
  }

  /** Reseta posição e HP para nova rodada. */
  reset(x, z) {
    this.hp = this.maxHp;
    this.group.position.set(x, 1, z);
    this.mesh.rotation.y = 0;
    this._mat.color.setHex(this._baseColor);
    this._hitFlashTimer = 0;
  }

  get position() { return this.group.position; }
}
