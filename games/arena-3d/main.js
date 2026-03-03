// games/arena-3d/main.js
// Arena 3D — câmera orbital, sons, modo solo/P2P, power-ups, sistema de rodadas

import { bus }              from '../../shared/core/EventBus.js';
import { network }          from '../../shared/network/NetworkManager.js';
import { SceneManager }     from '../../shared/render/SceneManager.js';
import { InputManager }     from '../../shared/input/InputManager.js';
import { UIManager }        from '../../shared/ui/UIManager.js';
import { ParticleSystem3D } from '../../shared/render/ParticleSystem.js';
import { Player }           from './entities/Player.js';
import { ArenaSynth }       from './audio/ArenaSynth.js';

// ── Constantes ──────────────────────────────────────────────────────────────
const SHOOT_COOLDOWN   = 0.40;  // segundos entre tiros
const PROJ_SPEED       = 13;
const PROJ_DAMAGE      = 10;
const PROJ_LIFETIME    = 3.0;
const POWERUP_HEAL     = 30;
const POWERUP_RESPAWN  = 15;    // segundos para reaparecer
const BOT_HUNT_DIST    = 4.5;   // distância para bot alternar caça ↔ strafe
const BOT_SHOOT_BASE   = 1.6;   // intervalo base de tiro do bot (s)
// Posições X,Z dos obstáculos (tamanho 1.5x1.5x1.5)
const OBSTACLES = [[-3, 0], [3, 0], [0, -2], [0, 2]];

// ── Estado global ────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const input  = new InputManager(window);
const ui     = new UIManager();
const sfx    = new ArenaSynth();

let scene, fx, orbitControls;
let localPlayer  = null;
let remotePlayer = null;
let localId      = 'player1';
let opponentId   = 'opponent';
let isSolo       = false;
let roundActive  = false;
let roundNum     = 1;
let score        = { local: 0, remote: 0 };
let shootCooldown = 0;

let projectiles = [];   // { mesh, velocity, ownerId, lifetime }
let powerUps    = [];   // instâncias PowerUp

// Bot state
let botShootTimer  = BOT_SHOOT_BASE;
let botStrafeDir   = 1;
let botStrafeTimer = 1.0;

// ── PowerUp inline class ─────────────────────────────────────────────────────
class PowerUp {
  constructor(threeScene, THREE, x, z) {
    this.active        = true;
    this.respawnTimer  = 0;
    this._t            = Math.random() * Math.PI * 2;

    const geo = new THREE.SphereGeometry(0.28, 10, 10);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x69db7c, emissive: 0x2d6a4f, emissiveIntensity: 0.9,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, 0.8, z);
    this.mesh.castShadow = true;
    threeScene.add(this.mesh);

    this.light = new THREE.PointLight(0x69db7c, 0.6, 3.5);
    this.light.position.set(x, 0.5, z);
    threeScene.add(this.light);
  }

  update(delta) {
    if (!this.active) {
      this.respawnTimer -= delta;
      if (this.respawnTimer <= 0) {
        this.active = true;
        this.mesh.visible = true;
        this.light.visible = true;
      }
      return;
    }
    this._t += delta * 2.2;
    this.mesh.position.y = 0.8 + Math.sin(this._t) * 0.14;
    this.mesh.rotation.y += delta * 1.8;
  }

  collect() {
    this.active = false;
    this.respawnTimer = POWERUP_RESPAWN;
    this.mesh.visible  = false;
    this.light.visible = false;
  }

  /** Retorna true se playerPos está dentro do raio de coleta. */
  checkPickup(playerPos) {
    if (!this.active) return false;
    const dx = playerPos.x - this.mesh.position.x;
    const dz = playerPos.z - this.mesh.position.z;
    return Math.sqrt(dx * dx + dz * dz) < 0.9;
  }
}

// ── Inicialização ────────────────────────────────────────────────────────────
async function init() {
  scene = new SceneManager(canvas, { background: '#090912', shadows: true });
  await scene.init();

  scene.addLight('ambient',      { intensity: 0.3 });
  scene.addLight('directional',  { position: [8, 15, 8], intensity: 1.5, shadows: true });
  scene.addLight('hemisphere',   { skyColor: 0x334466, groundColor: 0x111122, intensity: 0.4 });

  buildArena();

  // Câmera inicial
  scene.camera.position.set(0, 16, 20);
  scene.camera.lookAt(0, 0, 0);

  // Câmera orbital com limites para não atravessar o chão
  orbitControls = await scene.addOrbitControls();
  orbitControls.minDistance    = 8;
  orbitControls.maxDistance    = 32;
  orbitControls.minPolarAngle  = 0.18;
  orbitControls.maxPolarAngle  = Math.PI / 2.05;
  orbitControls.target.set(0, 0, 0);

  const THREE = scene._THREE;
  fx = new ParticleSystem3D(scene);

  // Power-ups nas laterais da arena
  [[-6.5, 0], [6.5, 0], [0, -4.5], [0, 4.5]].forEach(([x, z]) => {
    powerUps.push(new PowerUp(scene.scene, THREE, x, z));
  });

  // Loop principal
  scene.onUpdate(delta => {
    if (!localPlayer || !roundActive) return;
    handleMovement(delta, THREE);
    if (isSolo) updateBot(delta, THREE);
    updateProjectiles(delta, THREE);
    updatePowerUps();
    if (!isSolo) syncPosition();

    shootCooldown = Math.max(0, shootCooldown - delta);
    updateHUD();

    localPlayer.update(delta);
    if (remotePlayer) remotePlayer.update(delta);
  });

  // Power-up animation sempre ativa (fora do roundActive)
  scene.onUpdate(delta => {
    powerUps.forEach(p => p.update(delta));
  });

  scene.start();
  setupLobby();
  setupHelp();

  // Tecla H abre ajuda
  input.bind('KeyH', toggleHelp);
}

// ── Arena ────────────────────────────────────────────────────────────────────
function buildArena() {
  const THREE = scene._THREE;

  // Chão com textura de grade
  const floor = scene.createPlane(22, 14, 0x0e0e1e, { receiveShadow: true });
  floor.rotation.x = -Math.PI / 2;
  scene.scene.add(floor);

  // Grade de linhas sobre o chão
  const grid = new THREE.GridHelper(22, 22, 0x1a1a3a, 0x1a1a3a);
  grid.position.y = 0.005;
  scene.scene.add(grid);

  // Paredes perimetrais
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a5a, metalness: 0.2, roughness: 0.8,
  });
  [
    { pos: [0, 1, -6.5],  size: [22, 2, 0.5] },
    { pos: [0, 1,  6.5],  size: [22, 2, 0.5] },
    { pos: [-11, 1, 0],   size: [0.5, 2, 14] },
    { pos: [ 11, 1, 0],   size: [0.5, 2, 14] },
  ].forEach(({ pos, size }) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), wallMat);
    m.position.set(...pos);
    m.receiveShadow = true;
    scene.scene.add(m);
  });

  // Obstáculos centrais (4 pilares)
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a6b, metalness: 0.3, roughness: 0.7,
  });
  OBSTACLES.forEach(([x, z]) => {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 2.0, 1.5), pillarMat
    );
    pillar.position.set(x, 1.0, z);
    pillar.castShadow   = true;
    pillar.receiveShadow = true;
    scene.scene.add(pillar);

    // Luz de acento nos pilares
    const accent = new THREE.PointLight(0x3344aa, 0.4, 4);
    accent.position.set(x, 2.2, z);
    scene.scene.add(accent);
  });

  // Fog de ambiente
  scene.scene.fog = new THREE.Fog(0x090912, 20, 40);
}

// ── Lobby ────────────────────────────────────────────────────────────────────
function setupLobby() {
  // Modo Solo
  document.getElementById('btn-solo').addEventListener('click', () => {
    sfx.init();
    isSolo     = true;
    localId    = 'player1';
    opponentId = 'bot';
    document.getElementById('label-remote').textContent = 'Bot';
    startGame();
  });

  // Criar sala P2P
  document.getElementById('btn-create').addEventListener('click', async () => {
    sfx.init();
    const roomId  = `arena-${Math.random().toString(36).slice(2, 7)}`;
    localId = await network.createRoom(roomId);

    const inviteUrl = `${location.origin}${location.pathname}?join=${roomId}`;
    document.getElementById('room-display').textContent = roomId;
    document.getElementById('room-info').style.display = 'flex';

    const btnEnter = document.getElementById('btn-enter-room');
    btnEnter.style.display = 'block';
    btnEnter.onclick = () => window.open(inviteUrl, '_blank');

    document.getElementById('btn-copy-id').addEventListener('click', function () {
      copyToClipboard(roomId, this);
    });
    document.getElementById('btn-copy-url').addEventListener('click', function () {
      copyToClipboard(inviteUrl, this);
    });

    ui.toast('Sala criada! Aguardando oponente…', 'info', 4000);
    bus.on('net:peer-joined', ({ peerId }) => {
      opponentId = peerId;
      startGame();
    });
  });

  // Entrar em sala P2P
  document.getElementById('btn-join').addEventListener('click', async () => {
    sfx.init();
    const roomId = document.getElementById('room-input').value.trim();
    if (!roomId) return;
    localId    = await network.joinRoom(roomId);
    opponentId = roomId;
    startGame();
  });

  // Auto-join via query string
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

// ── Ajuda ────────────────────────────────────────────────────────────────────
function setupHelp() {
  const overlay = document.getElementById('help-overlay');
  document.getElementById('btn-help').addEventListener('click', toggleHelp);
  document.getElementById('help-close').addEventListener('click', closeHelp);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeHelp(); });
}

function toggleHelp() {
  const overlay = document.getElementById('help-overlay');
  overlay.classList.contains('hidden') ? openHelp() : closeHelp();
}

function openHelp() {
  const overlay = document.getElementById('help-overlay');
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => overlay.classList.add('visible'));
}

function closeHelp() {
  const overlay = document.getElementById('help-overlay');
  overlay.classList.remove('visible');
  setTimeout(() => overlay.classList.add('hidden'), 250);
}

// ── Início de partida / rodada ───────────────────────────────────────────────
function startGame() {
  document.getElementById('lobby').classList.add('hidden');
  document.getElementById('hud').classList.add('visible');
  document.getElementById('shoot-cooldown-bar').classList.add('visible');

  const THREE = scene._THREE;
  localPlayer  = new Player(localId,    scene.scene, THREE, { isLocal: true,  x:  5, z: 0, color: 0x4a7fcb });
  remotePlayer = new Player(opponentId, scene.scene, THREE, { isLocal: false, x: -5, z: 0, color: 0xc1121f });

  // Rede P2P
  if (!isSolo) {
    bus.on('net:action', ({ type, payload, from }) => {
      if (from === localId) return;
      if (type === 'position') {
        remotePlayer.position.set(payload.x, payload.y, payload.z);
      }
      if (type === 'shoot') {
        const THREE = scene._THREE;
        spawnProjectile(payload.position, payload.direction, from, THREE);
        sfx.shoot();
      }
      if (type === 'hp') {
        // Exibe HP atual do oponente no HUD do jogador local
        remotePlayer.hp = payload.hp;
      }
      if (type === 'dead') {
        onRoundEnd(from);
      }
    });

    // Quando nosso HP muda, envia para o oponente ver no HUD dele
    bus.on('player:damage', ({ id, hp }) => {
      if (id === localId) network.broadcast('hp', { hp });
    });
    bus.on('player:dead', ({ id }) => {
      if (id === localId) network.broadcast('dead', {});
    });
  }

  // Morte de jogador → fim de rodada
  bus.on('player:dead', ({ id }) => {
    if (!roundActive) return;
    onRoundEnd(id);
  });

  // Tiro com Space
  input.bind('Space', () => {
    if (!roundActive) return;
    shootLocal();
  });

  startRound();
}

function startRound() {
  roundActive  = false;
  shootCooldown = 0;

  // Limpa projéteis
  projectiles.forEach(p => scene.scene.remove(p.mesh));
  projectiles = [];

  // Reseta jogadores
  localPlayer.reset(5, 0);
  remotePlayer.reset(-5, 0);

  // Reseta bot
  botShootTimer  = BOT_SHOOT_BASE;
  botStrafeTimer = 1.0;

  updateHUD();

  // Contagem regressiva: 3, 2, 1, FIGHT!
  let count = 3;
  const tick = () => {
    if (count > 0) {
      ui.toast(`${count}…`, 'info', 850);
      sfx.beep(count === 1 ? 660 : 440);
      count--;
      setTimeout(tick, 950);
    } else {
      ui.toast('⚔ FIGHT!', 'success', 900);
      sfx.beep(880);
      roundActive = true;
    }
  };
  setTimeout(tick, 400);
}

function onRoundEnd(deadId) {
  roundActive = false;
  const localWon = deadId !== localId;

  if (localWon) score.local++;
  else          score.remote++;

  // Efeito sonoro e partículas
  sfx.explosion();
  fx.burst(
    localWon ? remotePlayer.position.clone() : localPlayer.position.clone(),
    { count: 30, color: localWon ? 0x74c0fc : 0xff4444, duration: 1500 }
  );

  const matchOver = score.local >= 2 || score.remote >= 2;

  if (matchOver) {
    const playerWon = score.local >= 2;
    setTimeout(() => {
      playerWon ? sfx.win() : sfx.lose();
      ui.openModal('match-over',
        `<h2>${playerWon ? 'Vitória!' : 'Derrota…'}</h2>
         <p>Placar: ${score.local} × ${score.remote}</p>`,
        {
          title: 'Fim da Partida',
          confirmLabel: 'Jogar Novamente',
          onConfirm: () => location.reload(),
        }
      );
    }, 600);
  } else {
    ui.toast(localWon ? '🏆 Rodada vencida!' : '💀 Rodada perdida…', localWon ? 'success' : 'error', 2000);
    roundNum++;
    setTimeout(startRound, 2600);
  }

  updateHUD();
}

// ── Movimento ────────────────────────────────────────────────────────────────
function handleMovement(delta, THREE) {
  const dir = new THREE.Vector3();
  if (input.isPressed('KeyW') || input.isPressed('ArrowUp'))    dir.z -= 1;
  if (input.isPressed('KeyS') || input.isPressed('ArrowDown'))  dir.z += 1;
  if (input.isPressed('KeyA') || input.isPressed('ArrowLeft'))  dir.x -= 1;
  if (input.isPressed('KeyD') || input.isPressed('ArrowRight')) dir.x += 1;

  if (dir.length() > 0) {
    dir.normalize();
    localPlayer.move(dir, delta);
    resolveObstacles(localPlayer.position);
  }
}

/** AABB simplificado contra os pilares (raio do player = 0.5). */
function resolveObstacles(pos) {
  const PR = 0.55;   // player effective radius
  const HS = 0.75 + PR; // obstacle half-size + player radius
  for (const [ox, oz] of OBSTACLES) {
    const dx       = pos.x - ox;
    const dz       = pos.z - oz;
    const overlapX = HS - Math.abs(dx);
    const overlapZ = HS - Math.abs(dz);
    if (overlapX > 0 && overlapZ > 0) {
      if (overlapX < overlapZ) pos.x += Math.sign(dx) * overlapX;
      else                     pos.z += Math.sign(dz) * overlapZ;
    }
  }
}

// ── Bot AI ────────────────────────────────────────────────────────────────────
function updateBot(delta, THREE) {
  if (!remotePlayer || !localPlayer) return;

  const toPlayer = new THREE.Vector3(
    localPlayer.position.x - remotePlayer.position.x,
    0,
    localPlayer.position.z - remotePlayer.position.z
  );
  const dist = toPlayer.length();

  const dir = new THREE.Vector3();
  if (dist > BOT_HUNT_DIST) {
    // Caça: move em direção ao jogador
    dir.copy(toPlayer).normalize();
  } else {
    // Strafe lateral para ser mais difícil de acertar
    botStrafeTimer -= delta;
    if (botStrafeTimer <= 0) {
      botStrafeDir   = -botStrafeDir;
      botStrafeTimer = 0.7 + Math.random() * 0.9;
    }
    dir.set(toPlayer.z * botStrafeDir, 0, -toPlayer.x * botStrafeDir).normalize();
  }

  remotePlayer.move(dir, delta);
  resolveObstacles(remotePlayer.position);
  remotePlayer.faceTarget(localPlayer.position);

  // Tiro do bot
  botShootTimer -= delta;
  if (botShootTimer <= 0 && dist < 16) {
    botShootTimer = BOT_SHOOT_BASE + Math.random() * 0.7;
    const origin    = remotePlayer.position.clone();
    const direction = new THREE.Vector3()
      .subVectors(localPlayer.position, origin)
      .normalize();
    spawnProjectile(origin, direction, opponentId, THREE);
    sfx.shoot();
  }
}

// ── Tiro (jogador local) ──────────────────────────────────────────────────────
function shootLocal() {
  if (!localPlayer || !remotePlayer) return;
  if (shootCooldown > 0) return;

  sfx.init();
  sfx.shoot();
  shootCooldown = SHOOT_COOLDOWN;

  const THREE     = scene._THREE;
  const origin    = localPlayer.position.clone();
  const direction = new THREE.Vector3()
    .subVectors(remotePlayer.position, origin)
    .normalize();

  spawnProjectile(origin, direction, localId, THREE);

  // Flash de disparo
  muzzleFlash(origin, 0x74c0fc, THREE);

  if (!isSolo) {
    network.broadcast('shoot', {
      position:  { x: origin.x,    y: origin.y,    z: origin.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
    });
  }
}

function muzzleFlash(position, color, THREE) {
  const flash = new THREE.PointLight(color, 4, 4);
  flash.position.copy(position);
  scene.scene.add(flash);
  setTimeout(() => scene.scene.remove(flash), 90);
}

function spawnProjectile(position, direction, ownerId, THREE) {
  const isLocal = ownerId === localId;
  const geo  = new THREE.SphereGeometry(0.15, 6, 6);
  const mat  = new THREE.MeshBasicMaterial({ color: isLocal ? 0x74c0fc : 0xff6b6b });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(position.x, position.y, position.z);

  // Brilho do projétil
  const glow = new THREE.PointLight(isLocal ? 0x74c0fc : 0xff4444, 1.5, 2.5);
  mesh.add(glow);

  const vel = new THREE.Vector3(direction.x, direction.y, direction.z)
    .multiplyScalar(PROJ_SPEED);

  scene.scene.add(mesh);
  projectiles.push({ mesh, velocity: vel, ownerId, lifetime: PROJ_LIFETIME });
}

// ── Atualização de projéteis ──────────────────────────────────────────────────
function updateProjectiles(delta, THREE) {
  projectiles = projectiles.filter(p => {
    p.mesh.position.addScaledVector(p.velocity, delta);
    p.lifetime -= delta;

    // Colisão com player local (projéteis do oponente)
    if (p.ownerId !== localId) {
      if (p.mesh.position.distanceTo(localPlayer.position) < 0.75) {
        localPlayer.takeDamage(PROJ_DAMAGE);
        sfx.init();
        sfx.hit();
        sfx.playerHurt();
        fx.burst(p.mesh.position.clone(), { count: 14, color: 0xff4444, duration: 900 });
        scene.scene.remove(p.mesh);
        return false;
      }
    }

    // Colisão com player remoto (projéteis do local, só no solo)
    if (isSolo && p.ownerId === localId) {
      if (p.mesh.position.distanceTo(remotePlayer.position) < 0.75) {
        remotePlayer.takeDamage(PROJ_DAMAGE);
        sfx.init();
        sfx.hit();
        fx.burst(p.mesh.position.clone(), { count: 14, color: 0xc1121f, duration: 900 });
        scene.scene.remove(p.mesh);
        return false;
      }
    }

    // Colisão com paredes e obstáculos → destrói projétil
    if (hitObstacleOrWall(p.mesh.position)) {
      fx.burst(p.mesh.position.clone(), { count: 5, color: 0xaaaaff, duration: 400 });
      scene.scene.remove(p.mesh);
      return false;
    }

    if (p.lifetime <= 0) {
      scene.scene.remove(p.mesh);
      return false;
    }
    return true;
  });
}

function hitObstacleOrWall(pos) {
  // Paredes
  if (Math.abs(pos.x) > 10.6 || Math.abs(pos.z) > 6.3) return true;
  // Pilares
  for (const [ox, oz] of OBSTACLES) {
    if (Math.abs(pos.x - ox) < 0.85 && Math.abs(pos.z - oz) < 0.85) return true;
  }
  return false;
}

// ── Power-ups ────────────────────────────────────────────────────────────────
function updatePowerUps() {
  powerUps.forEach(pu => {
    if (pu.checkPickup(localPlayer.position)) {
      pu.collect();
      localPlayer.heal(POWERUP_HEAL);
      sfx.init();
      sfx.powerUp();
      ui.toast(`+${POWERUP_HEAL} HP recuperado!`, 'success', 1800);
    }
    if (isSolo && remotePlayer && pu.checkPickup(remotePlayer.position)) {
      pu.collect();
      remotePlayer.heal(POWERUP_HEAL);
    }
  });
}

// ── Sync de posição P2P ──────────────────────────────────────────────────────
function syncPosition() {
  network.broadcast('position', {
    x: localPlayer.position.x,
    y: localPlayer.position.y,
    z: localPlayer.position.z,
  });
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function updateHUD() {
  if (!localPlayer || !remotePlayer) return;

  const localHp  = Math.max(0, localPlayer.hp);
  const remoteHp = Math.max(0, remotePlayer.hp);

  document.getElementById('hp-bar-local').style.width   = `${(localHp  / 100) * 100}%`;
  document.getElementById('hp-bar-remote').style.width  = `${(remoteHp / 100) * 100}%`;
  document.getElementById('hp-text-local').textContent  = localHp;
  document.getElementById('hp-text-remote').textContent = remoteHp;
  document.getElementById('round-info').textContent =
    `R${roundNum} · ${score.local} – ${score.remote}`;

  // Barra de cooldown de tiro
  const fill = document.getElementById('shoot-cooldown-fill');
  const pct  = shootCooldown > 0 ? (1 - shootCooldown / SHOOT_COOLDOWN) * 100 : 100;
  fill.style.width = `${pct}%`;
  fill.style.background = pct < 100 ? '#888' : 'linear-gradient(90deg,#d4af37,#ffe066)';
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
init().catch(console.error);
