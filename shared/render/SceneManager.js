// shared/render/SceneManager.js
// Wrapper Three.js — cena, câmera, renderer, loop e resize automático

const THREE_CDN = 'https://esm.sh/three@0.165';

export class SceneManager {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} [options]
   * @param {number}  [options.fov=60]
   * @param {number}  [options.near=0.1]
   * @param {number}  [options.far=1000]
   * @param {boolean} [options.shadows=false]
   * @param {string}  [options.background='#0a0a0f']
   */
  constructor(canvas, options = {}) {
    this._canvas = canvas;
    this._options = { fov: 60, near: 0.1, far: 1000, shadows: false, background: '#0a0a0f', ...options };
    this._callbacks = [];
    this._THREE = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this._running = false;
  }

  /** Inicializa Three.js (async por causa do import dinâmico) */
  async init() {
    this._THREE = await import(THREE_CDN);
    const THREE = this._THREE;

    this.renderer = new THREE.WebGLRenderer({ canvas: this._canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (this._options.shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this._options.background);

    this.camera = new THREE.PerspectiveCamera(
      this._options.fov,
      1,
      this._options.near,
      this._options.far
    );
    this.camera.position.set(0, 10, 14);
    this.camera.lookAt(0, 0, 0);

    this._updateSize();
    window.addEventListener('resize', () => this._updateSize());

    return this;
  }

  /** Adiciona luz pré-configurada */
  addLight(type = 'ambient', options = {}) {
    const THREE = this._THREE;
    let light;
    if (type === 'ambient') {
      light = new THREE.AmbientLight(options.color ?? 0xffffff, options.intensity ?? 0.6);
    } else if (type === 'directional') {
      light = new THREE.DirectionalLight(options.color ?? 0xffffff, options.intensity ?? 1);
      light.position.set(...(options.position ?? [5, 10, 5]));
      if (options.shadows) {
        light.castShadow = true;
        light.shadow.mapSize.set(1024, 1024);
      }
    } else if (type === 'point') {
      light = new THREE.PointLight(options.color ?? 0xffffff, options.intensity ?? 1, options.distance ?? 50);
      light.position.set(...(options.position ?? [0, 5, 0]));
    } else if (type === 'hemisphere') {
      light = new THREE.HemisphereLight(options.skyColor ?? 0xffffff, options.groundColor ?? 0x444444, options.intensity ?? 0.6);
    }
    if (light) this.scene.add(light);
    return light;
  }

  /** Registra callback chamado a cada frame com (deltaSeconds) */
  onUpdate(fn) {
    this._callbacks.push(fn);
    return () => { this._callbacks = this._callbacks.filter(cb => cb !== fn); };
  }

  /** Inicia o loop de renderização */
  start() {
    if (this._running) return;
    this._running = true;
    const clock = new this._THREE.Clock();
    const loop = () => {
      if (!this._running) return;
      requestAnimationFrame(loop);
      const delta = clock.getDelta();
      this._callbacks.forEach(fn => fn(delta));
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  stop() {
    this._running = false;
  }

  /** Helpers de criação de objetos comuns */
  createPlane(w, h, color = 0x2d6a4f, options = {}) {
    const { receiveShadow, ...matOptions } = options;
    const geo  = new this._THREE.PlaneGeometry(w, h);
    const mat  = new this._THREE.MeshStandardMaterial({ color, ...matOptions });
    const mesh = new this._THREE.Mesh(geo, mat);
    if (receiveShadow) mesh.receiveShadow = true;
    return mesh;
  }

  createBox(w, h, d, color = 0x4a4e69, options = {}) {
    const { castShadow, receiveShadow, ...matOptions } = options;
    const geo  = new this._THREE.BoxGeometry(w, h, d);
    const mat  = new this._THREE.MeshStandardMaterial({ color, ...matOptions });
    const mesh = new this._THREE.Mesh(geo, mat);
    if (castShadow) mesh.castShadow = true;
    if (receiveShadow) mesh.receiveShadow = true;
    return mesh;
  }

  /** Carrega OrbitControls dinamicamente */
  async addOrbitControls() {
    const { OrbitControls } = await import(`${THREE_CDN}/addons/controls/OrbitControls.js`);
    const controls = new OrbitControls(this.camera, this._canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    this.onUpdate(() => controls.update());
    return controls;
  }

  /** Carrega modelo GLTF */
  async loadGLTF(url) {
    const { GLTFLoader } = await import(`${THREE_CDN}/addons/loaders/GLTFLoader.js`);
    const loader = new GLTFLoader();
    return new Promise((res, rej) => loader.load(url, res, undefined, rej));
  }

  _updateSize() {
    const parent = this._canvas.parentElement ?? document.body;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
