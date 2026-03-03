// games/arena-3d/main.js
// Arena 3D simples — movimento, colisão, dano, P2P

import { bus }          from '../../shared/core/EventBus.js';
import { network }      from '../../shared/network/NetworkManager.js';
import { SceneManager } from '../../shared/render/SceneManager.js';
import { InputManager } from '../../shared/input/InputManager.js';
import { UIManager }    from '../../shared/ui/UIManager.js';
import { ParticleSystem3D } from '../../shared/render/ParticleSystem.js';
import { Player }       from './entities/Player.js';

const canvas = document.getElementById('canvas');
const input  = new InputManager(window);
const ui     = new UIManager();

let scene, fx;
let localPlayer = null, remotePlayer = null;
let localId = null, opponentId = null;
let projectiles = [];  // { mesh, velocity, ownerId }

async function init() {
  // Cena
  scene = new SceneManager(canvas, { background: '#090912', shadows: true });
  await scene.init();
  scene.addLight('ambient', { intensity: 0.3 });
  scene.addLight('directional', { position: [8, 15, 8], intensity: 1.5, shadows: true });
  scene.addLight('hemisphere', { skyColor: 0x334466, groundColor: 0x111122, intensity: 0.4 });

  buildArena();
  scene.camera.position.set(0, 18, 12);
  scene.camera.lookAt(0, 0, 0);

  const THREE = scene._THREE;
  fx = new ParticleSystem3D(scene);

  scene.onUpdate(delta => {
    if (!localPlayer) return;
    handleMovement(delta, THREE);
    updateProjectiles(delta, THREE);
    syncPosition();
    updateHUD();
  });

  scene.start();
  setupLobby();
}

function buildArena() {
  const THREE = scene._THREE;

  // Chão
  const floor = scene.createPlane(20, 12, 0x1a1a2e, { receiveShadow: true });
  floor.rotation.x = -Math.PI / 2;
  scene.scene.add(floor);

  // Paredes
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2a5a });
  const walls = [
    { pos: [0, 1, -6.5], size: [20, 2, 0.5] },
    { pos: [0, 1,  6.5], size: [20, 2, 0.5] },
    { pos: [-10.5, 1, 0], size: [0.5, 2, 13] },
    { pos: [ 10.5, 1, 0], size: [0.5, 2, 13] },
  ];
  walls.forEach(({ pos, size }) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), wallMat);
    mesh.position.set(...pos);
    mesh.receiveShadow = true;
    scene.scene.add(mesh);
  });

  // Obstáculos centrais
  const obsMat = new THREE.MeshStandardMaterial({ color: 0x3d3d6b });
  [[-3, 0, 0], [3, 0, 0], [0, 0, -2], [0, 0, 2]].forEach(([x, y, z]) => {
    const box = scene.createBox(1.5, 1.5, 1.5, 0x3d3d6b, { castShadow: true, receiveShadow: true });
    box.position.set(x, 0.75, z);
    scene.scene.add(box);
  });

  // Grade de chão (linhas)
  const gridHelper = new THREE.GridHelper(20, 20, 0x222244, 0x222244);
  gridHelper.position.y = 0.01;
  scene.scene.add(gridHelper);
}

function setupLobby() {
  document.getElementById('btn-create').addEventListener('click', async () => {
    const roomId = `arena-${Math.random().toString(36).slice(2, 7)}`;
    localId = await network.createRoom(roomId);

    const inviteUrl = `${location.origin}${location.pathname}?join=${roomId}`;
    document.getElementById('room-display').textContent = roomId;
    document.getElementById('room-info').style.display = 'flex';

    const btnEnterArena = document.getElementById('btn-enter-room');
    btnEnterArena.style.display = 'block';
    btnEnterArena.onclick = () => window.open(inviteUrl, '_blank');

    document.getElementById('btn-copy-id').addEventListener('click', function () {
      copyToClipboard(roomId, this);
    });
    document.getElementById('btn-copy-url').addEventListener('click', function () {
      copyToClipboard(inviteUrl, this);
    });

    bus.on('net:peer-joined', ({ peerId }) => {
      opponentId = peerId;
      startGame();
    });
  });

  document.getElementById('btn-join').addEventListener('click', async () => {
    const roomId = document.getElementById('room-input').value.trim();
    if (!roomId) return;
    localId    = await network.joinRoom(roomId);
    opponentId = roomId;
    startGame();
  });

  const params = new URLSearchParams(location.search);
  if (params.get('join')) {
    document.getElementById('room-input').value = params.get('join');
    document.getElementById('btn-join').click();
  }
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

function startGame() {
  document.getElementById('lobby').classList.add('hidden');
  document.getElementById('hud').classList.add('visible');

  const THREE = scene._THREE;
  localPlayer  = new Player(localId, scene.scene, THREE, { isLocal: true, x: 4, z: 0, color: 0x4a7fcb });
  remotePlayer = new Player(opponentId, scene.scene, THREE, { isLocal: false, x: -4, z: 0, color: 0xc1121f });

  bus.on('net:action', ({ type, payload, from }) => {
    if (from === localId) return;
    if (type === 'position') {
      remotePlayer.mesh.position.set(payload.x, payload.y, payload.z);
    }
    if (type === 'shoot') {
      spawnProjectile(payload.position, payload.direction, from, THREE);
    }
  });

  bus.on('player:dead', ({ id }) => {
    const winner = id === localId ? opponentId : localId;
    ui.openModal('game-over', `<h2>${winner === localId ? 'Você venceu!' : 'Você perdeu...'}</h2>`, {
      title: 'Fim de Arena',
      confirmLabel: 'Reiniciar',
      onConfirm: () => location.reload(),
    });
  });

  // Atirar com Space
  input.bind('Space', () => shoot(THREE));
}

function handleMovement(delta, THREE) {
  const dir = new THREE.Vector3();
  if (input.isPressed('KeyW') || input.isPressed('ArrowUp'))    dir.z -= 1;
  if (input.isPressed('KeyS') || input.isPressed('ArrowDown'))  dir.z += 1;
  if (input.isPressed('KeyA') || input.isPressed('ArrowLeft'))  dir.x -= 1;
  if (input.isPressed('KeyD') || input.isPressed('ArrowRight')) dir.x += 1;
  if (dir.length() > 0) {
    dir.normalize();
    localPlayer.move(dir, delta);
  }
}

function syncPosition() {
  network.broadcast('position', {
    x: localPlayer.position.x,
    y: localPlayer.position.y,
    z: localPlayer.position.z,
  });
}

function shoot(THREE) {
  if (!localPlayer || !remotePlayer) return;
  const origin    = localPlayer.position.clone();
  const target    = remotePlayer.position.clone();
  const direction = target.sub(origin).normalize();
  spawnProjectile(origin, direction, localId, THREE);
  network.broadcast('shoot', { position: { x: origin.x, y: origin.y, z: origin.z }, direction: { x: direction.x, y: direction.y, z: direction.z } });
}

function spawnProjectile(position, direction, ownerId, THREE) {
  const geo  = new THREE.SphereGeometry(0.15);
  const mat  = new THREE.MeshBasicMaterial({ color: ownerId === localId ? 0x74c0fc : 0xff6b6b });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(position.x, position.y, position.z);
  const vel = new THREE.Vector3(direction.x, direction.y, direction.z).multiplyScalar(12);
  scene.scene.add(mesh);
  projectiles.push({ mesh, velocity: vel, ownerId, lifetime: 3 });
}

function updateProjectiles(delta, THREE) {
  projectiles = projectiles.filter(p => {
    p.mesh.position.addScaledVector(p.velocity, delta);
    p.lifetime -= delta;

    // Colisão com oponente local
    if (p.ownerId !== localId) {
      const dist = p.mesh.position.distanceTo(localPlayer.position);
      if (dist < 0.8) {
        localPlayer.takeDamage(10);
        fx.burst(p.mesh.position.clone(), { count: 10, color: 0xff4444 });
        scene.scene.remove(p.mesh);
        return false;
      }
    }

    if (p.lifetime <= 0) { scene.scene.remove(p.mesh); return false; }
    return true;
  });
}

function updateHUD() {
  if (!localPlayer || !remotePlayer) return;
  const localHp  = Math.max(0, localPlayer.hp);
  const remoteHp = Math.max(0, remotePlayer.hp);
  document.getElementById('hp-bar-local').style.width   = `${(localHp  / 100) * 100}%`;
  document.getElementById('hp-bar-remote').style.width  = `${(remoteHp / 100) * 100}%`;
  document.getElementById('hp-text-local').textContent  = localHp;
  document.getElementById('hp-text-remote').textContent = remoteHp;
}

init().catch(console.error);
