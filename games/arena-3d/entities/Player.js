// games/arena-3d/entities/Player.js
// Entidade jogador — movimentação, colisão e stats

import { bus } from '../../../shared/core/EventBus.js';

export class Player {
  constructor(id, scene, THREE, options = {}) {
    this.id     = id;
    this.hp     = options.hp    ?? 100;
    this.maxHp  = options.hp    ?? 100;
    this.speed  = options.speed ?? 6;
    this.isLocal = options.isLocal ?? false;

    // Mesh
    const geo = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: options.color ?? (options.isLocal ? 0x4a7fcb : 0xc1121f),
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.position.set(options.x ?? 0, 1, options.z ?? 0);
    scene.add(this.mesh);

    this._velocity = new THREE.Vector3();
    this._THREE = THREE;
  }

  move(direction, delta) {
    const speed = this.speed * delta;
    this.mesh.position.x += direction.x * speed;
    this.mesh.position.z += direction.z * speed;

    // Limita à arena
    this.mesh.position.x = Math.max(-9, Math.min(9, this.mesh.position.x));
    this.mesh.position.z = Math.max(-5, Math.min(5, this.mesh.position.z));
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    bus.emit('player:damage', { id: this.id, hp: this.hp, amount });
    if (this.hp <= 0) bus.emit('player:dead', { id: this.id });
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    bus.emit('player:heal', { id: this.id, hp: this.hp });
  }

  get position() { return this.mesh.position; }
}
