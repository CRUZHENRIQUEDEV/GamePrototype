// shared/render/ParticleSystem.js
// Efeitos de partículas leves (CSS/SVG para 2D, Three.js para 3D)

/** Partículas 2D via elementos DOM/SVG — zero dependências */
export class ParticleSystem2D {
  constructor(container) {
    this.container = container;
  }

  /**
   * Burst de partículas em uma posição (px) do container.
   * @param {number} x
   * @param {number} y
   * @param {Object} options
   */
  burst(x, y, options = {}) {
    const {
      count = 12,
      colors = ['#ffd700', '#ff6b6b', '#74c0fc', '#69db7c'],
      size = 6,
      duration = 700,
      spread = 60,
    } = options;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const dist  = spread * (0.5 + Math.random() * 0.5);
      const dx    = Math.cos(angle) * dist;
      const dy    = Math.sin(angle) * dist;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const s     = size * (0.6 + Math.random() * 0.8);

      el.style.cssText = `
        position:absolute; pointer-events:none;
        width:${s}px; height:${s}px; border-radius:50%;
        background:${color}; left:${x}px; top:${y}px;
        transform:translate(-50%,-50%);
        transition: transform ${duration}ms ease-out, opacity ${duration}ms ease-out;
      `;
      this.container.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0)`;
        el.style.opacity = '0';
      });
      setTimeout(() => el.remove(), duration + 50);
    }
  }

  /** Efeito de "brilho" em um elemento */
  glow(element, color = '#ffd700', duration = 500) {
    element.style.transition = `box-shadow ${duration / 2}ms ease`;
    element.style.boxShadow = `0 0 20px 6px ${color}`;
    setTimeout(() => { element.style.boxShadow = ''; }, duration);
  }
}

/** Partículas 3D via Three.js Points */
export class ParticleSystem3D {
  /**
   * @param {import('./SceneManager.js').SceneManager} sceneManager
   */
  constructor(sceneManager) {
    this._sm = sceneManager;
  }

  async burst(position, options = {}) {
    const THREE = this._sm._THREE;
    if (!THREE) return;
    const { count = 20, color = 0xffd700, size = 0.1, duration = 1000 } = options;

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      velocities.push({
        x: (Math.random() - 0.5) * 4,
        y: Math.random() * 4 + 1,
        z: (Math.random() - 0.5) * 4,
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size, transparent: true });
    const points = new THREE.Points(geo, mat);
    this._sm.scene.add(points);

    const start = performance.now();
    const removeUpdate = this._sm.onUpdate(delta => {
      const pos = geo.attributes.position.array;
      const t = (performance.now() - start) / duration;
      for (let i = 0; i < count; i++) {
        pos[i * 3]     += velocities[i].x * delta;
        pos[i * 3 + 1] += velocities[i].y * delta;
        pos[i * 3 + 2] += velocities[i].z * delta;
        velocities[i].y -= 9.8 * delta;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 1 - t;
      if (t >= 1) { this._sm.scene.remove(points); removeUpdate(); }
    });
  }
}
