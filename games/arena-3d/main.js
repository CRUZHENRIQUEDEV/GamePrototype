// games/arena-3d/main.js
// Arena 3D — Multiplayer P2P (até 4 jogadores), Lobby e Pausa

import { bus }              from '../../shared/core/EventBus.js';
import { network }          from '../../shared/network/NetworkManager.js';
import { SceneManager }     from '../../shared/render/SceneManager.js';
import { InputManager }     from '../../shared/input/InputManager.js';
import { UIManager }        from '../../shared/ui/UIManager.js';
import { ParticleSystem3D } from '../../shared/render/ParticleSystem.js';
import { Player }           from './entities/Player.js';
import { ArenaSynth }       from './audio/ArenaSynth.js';

// ── Constantes ──────────────────────────────────────────────────────────────
const SHOOT_COOLDOWN   = 0.40;
const PROJ_SPEED       = 13;
const PROJ_LIFETIME    = 3.0;
const POWERUP_RESPAWN  = 15;
const SPAWN_POINTS     = [
  { x: -6, z: -4, color: 0x4a7fcb }, // P1 (Azul)
  { x:  6, z:  4, color: 0xc1121f }, // P2 (Vermelho)
  { x: -6, z:  4, color: 0x2d6a4f }, // P3 (Verde)
  { x:  6, z: -4, color: 0xd4af37 }, // P4 (Dourado)
];
const OBSTACLES = [[-3, 0], [3, 0], [0, -2], [0, 2]];

// ── Estado global ────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const input  = new InputManager(window);
const ui     = new UIManager();
const sfx    = new ArenaSynth();

let scene, fx, orbitControls;
let myId         = null;
let hostId       = null;
let isHost       = false;
let isSolo       = false;
let gameState    = 'LOBBY'; // LOBBY, PLAYING, ENDED

// Mapa de jogadores: id -> Player
const players = new Map();

// Projéteis e PowerUps
let projectiles = [];
let powerUps    = [];

// Controle local
let shootCooldown = 0;
let isFPS         = false;
let fpsYaw        = 0;
let fpsPitch      = 0;

// Bot (apenas Host/Solo)
let botShootTimer = 1.6;

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
  const THREE = scene._THREE;

  // Iluminação
  scene.addLight('ambient',      { intensity: 0.3 });
  scene.addLight('directional',  { position: [8, 15, 8], intensity: 1.5, shadows: true });
  scene.addLight('hemisphere',   { skyColor: 0x334466, groundColor: 0x111122, intensity: 0.4 });

  buildArena();

  // Câmera
  scene.camera.position.set(0, 16, 20);
  scene.camera.lookAt(0, 0, 0);
  orbitControls = await scene.addOrbitControls();
  orbitControls.minDistance = 8;
  orbitControls.maxDistance = 32;
  orbitControls.minPolarAngle = 0.1;
  orbitControls.maxPolarAngle = Math.PI / 2.05;

  fx = new ParticleSystem3D(scene);

  // Power-ups
  [[-6.5, 0], [6.5, 0], [0, -4.5], [0, 4.5]].forEach(([x, z]) => {
    powerUps.push(new PowerUp(scene.scene, THREE, x, z));
  });

  // Loop principal
  scene.onUpdate(delta => {
    if (isFPS && players.has(myId)) updateFPSCamera();

    // Sempre anima powerups
    powerUps.forEach(p => p.update(delta));

    // Lógica de jogo só roda se PLAYING
    if (gameState !== 'PLAYING') return;

    handleInput(delta, THREE);
    if (isSolo) updateBot(delta, THREE);
    
    updateProjectiles(delta, THREE);
    updatePowerUps();
    
    // Atualiza todos os players
    players.forEach(p => p.update(delta));

    shootCooldown = Math.max(0, shootCooldown - delta);
    updateHUD();
  });

  scene.start();
  setupLobby();
  setupHelp();
  setupFPSMode();

  input.bind('KeyH', toggleHelp);
  input.bind('KeyF', () => { if (players.has(myId)) isFPS ? disableFPS() : enableFPS(); });
}

// ── Arena ────────────────────────────────────────────────────────────────────
function buildArena() {
  const THREE = scene._THREE;
  const floor = scene.createPlane(22, 14, 0x0e0e1e, { receiveShadow: true });
  floor.rotation.x = -Math.PI / 2;
  scene.scene.add(floor);
  const grid = new THREE.GridHelper(22, 22, 0x1a1a3a, 0x1a1a3a);
  grid.position.y = 0.005;
  scene.scene.add(grid);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2a5a, metalness: 0.2, roughness: 0.8 });
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

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x3a3a6b, metalness: 0.3, roughness: 0.7 });
  OBSTACLES.forEach(([x, z]) => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 1.5), pillarMat);
    pillar.position.set(x, 1.0, z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    scene.scene.add(pillar);
  });
}

// ── Lobby & Networking ───────────────────────────────────────────────────────
function setupLobby() {
  const btnCreate = document.getElementById('btn-create');
  const btnJoin   = document.getElementById('btn-join');
  const btnSolo   = document.getElementById('btn-solo');
  const btnStart  = document.getElementById('btn-start-game');
  
  // Solo
  btnSolo.addEventListener('click', () => {
    sfx.init();
    isSolo = true;
    isHost = true;
    myId   = 'player1';
    hostId = myId;
    
    // Cria jogador local
    addPlayer(myId, 0, true);
    // Cria Bot
    addPlayer('bot', 1, false);
    
    startGame();
  });

  // Criar Sala
  btnCreate.addEventListener('click', async () => {
    sfx.init();
    const roomId = `arena-${Math.random().toString(36).slice(2, 7)}`;
    myId = await network.createRoom(roomId);
    hostId = myId;
    isHost = true;
    
    setupLobbyUI(roomId, true);
    addPlayer(myId, 0, true);
    updateLobbyList();
  });

  // Entrar Sala
  btnJoin.addEventListener('click', async () => {
    sfx.init();
    const roomId = document.getElementById('room-input').value.trim();
    if (!roomId) return;
    
    try {
      myId = await network.joinRoom(roomId);
      isHost = false;
      hostId = roomId; // Em PeerJS simples, ID da sala = ID do Host
      
      setupLobbyUI(roomId, false);
      // Solicita entrada
      network.sendTo(hostId, 'sys:join-req', { id: myId });
    } catch (e) {
      ui.toast('Erro ao entrar na sala', 'error');
      console.error(e);
    }
  });

  // Host inicia o jogo
  btnStart.addEventListener('click', () => {
    if (!isHost) return;
    network.broadcast('sys:start-game', {});
    startGame();
  });

  // Auto-join via URL
  const params = new URLSearchParams(location.search);
  if (params.get('join')) {
    document.getElementById('room-input').value = params.get('join');
    btnJoin.click();
  }

  setupNetworkEvents();
}

function setupNetworkEvents() {
  // Host recebe conexão
  bus.on('net:peer-joined', ({ peerId }) => {
    if (isHost) {
      console.log(`Peer conectado: ${peerId}`);
      // Host adiciona o peer quando receber 'sys:join-req' para garantir
    }
  });

  bus.on('net:action', (msg) => {
    const { type, payload, from } = msg;

    // Relay (Host retransmite para outros clientes)
    if (isHost && type.startsWith('game:')) {
      network.connections.forEach((conn, peerId) => {
        if (peerId !== from) conn.send(JSON.stringify(msg));
      });
    }

    switch (type) {
      case 'sys:join-req': // Host recebe pedido de entrada
        if (isHost) {
          if (players.size >= 4) return; // Sala cheia
          const idx = players.size;
          addPlayer(from, idx, false);
          
          // Envia estado atual para o novo jogador
          const currentPlayers = [];
          players.forEach(p => currentPlayers.push({ id: p.id, idx: getPlayerIndex(p.id) }));
          
          network.sendTo(from, 'sys:lobby-state', { players: currentPlayers });
          // Avisa outros
          network.broadcast('sys:player-joined', { id: from, idx });
          updateLobbyList();
        }
        break;

      case 'sys:lobby-state': // Cliente recebe estado inicial
        payload.players.forEach(p => {
          if (!players.has(p.id)) addPlayer(p.id, p.idx, p.id === myId);
        });
        updateLobbyList();
        document.getElementById('lobby-status').textContent = 'Aguardando o host iniciar...';
        break;

      case 'sys:player-joined': // Cliente recebe aviso de novo jogador
        if (!players.has(payload.id)) {
          addPlayer(payload.id, payload.idx, payload.id === myId);
          updateLobbyList();
        }
        break;

      case 'sys:start-game':
        startGame();
        break;

      case 'game:move':
        if (players.has(from)) {
          const p = players.get(from);
          p.group.position.set(payload.x, 1, payload.z);
          p.mesh.rotation.y = payload.rot;
        }
        break;

      case 'game:shoot':
        if (players.has(from)) {
          spawnProjectile(players.get(from), payload.dir);
        }
        break;
        
      case 'game:hit': // Host confirma hit
         if (players.has(payload.targetId)) {
           const p = players.get(payload.targetId);
           p.takeDamage(10);
           updateHUD();
           if (p.hp <= 0 && isHost) {
             // Broadcast morte se quiser logica centralizada, mas por enquanto local resolve
           }
         }
         break;
    }
  });
  
  bus.on('player:damage', ({ id, hp }) => {
    // Se fui eu que tomei dano, aviso o host (se não for eu)
    // Mas simplificando: quem atirou mandou 'game:hit', todos processam
  });
}

function setupLobbyUI(roomId, amHost) {
  document.getElementById('room-display').textContent = roomId;
  document.getElementById('room-info').style.display = 'flex';
  
  const inviteUrl = `${location.origin}${location.pathname}?join=${roomId}`;
  document.getElementById('btn-copy-id').onclick = function() { copyToClipboard(roomId, this); };
  document.getElementById('btn-copy-url').onclick = function() { copyToClipboard(inviteUrl, this); };

  if (amHost) {
    document.getElementById('btn-start-game').style.display = 'block';
    document.getElementById('lobby-status').textContent = 'Você é o Host. Aguarde jogadores.';
  } else {
    document.getElementById('btn-start-game').style.display = 'none';
  }
}

function updateLobbyList() {
  const list = document.getElementById('lobby-players');
  list.innerHTML = '';
  players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'player-item';
    div.innerHTML = `<span>${p.id} ${p.id === myId ? '(Você)' : ''}</span> <span>Pronto</span>`;
    list.appendChild(div);
  });
  
  if (isHost) {
    const btn = document.getElementById('btn-start-game');
    // Pode iniciar sozinho se quiser testar, ou exigir min 2
    btn.disabled = false; 
    btn.textContent = players.size > 1 ? `INICIAR JOGO (${players.size})` : 'INICIAR (Aguardando...)';
  }
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.dataset.label || btn.textContent;
    btn.textContent = 'Copiado!';
    btn.classList.add('btn-copy--done');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('btn-copy--done');
    }, 2000);
  });
}

function startGame() {
  gameState = 'PLAYING';
  document.getElementById('lobby').classList.add('hidden');
  document.getElementById('hud').classList.add('visible');
  
  // Cria barras de vida no HUD
  const hudContainer = document.getElementById('hud-players');
  hudContainer.innerHTML = '';
  
  players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'hp-group';
    div.innerHTML = `
      <span class="hp-label">${p.id === myId ? 'Você' : p.id}</span>
      <div class="hp-bar-bg"><div id="hp-bar-${p.id}" class="hp-bar ${p.id === myId ? 'local' : 'remote'}" style="width:100%; background:${'#'+p._baseColor.toString(16)}"></div></div>
      <span id="hp-text-${p.id}" class="hp-text">${p.hp}</span>
    `;
    hudContainer.appendChild(div);
  });
  
  ui.toast('JOGO INICIADO!', 'success');
}

// ── Lógica de Jogo ───────────────────────────────────────────────────────────

function addPlayer(id, spawnIndex, isLocal) {
  if (players.has(id)) return;
  const spawn = SPAWN_POINTS[spawnIndex % SPAWN_POINTS.length];
  
  const p = new Player(id, scene, scene._THREE, {
    x: spawn.x, z: spawn.z,
    color: spawn.color,
    isLocal: isLocal,
    hp: 100
  });
  
  // Rotação inicial para o centro
  p.faceTarget({ x: 0, z: 0 });
  players.set(id, p);
}

function getPlayerIndex(id) {
  // Helper simples para recuperar cor/spawn baseado na ordem de entrada
  // Em prod seria melhor salvar no objeto player
  let i = 0;
  for (const key of players.keys()) {
    if (key === id) return i;
    i++;
  }
  return 0;
}

function handleInput(delta, THREE) {
  const p = players.get(myId);
  if (!p || p.hp <= 0) return;

  const moveDir = new THREE.Vector3(0, 0, 0);
  if (isFPS) {
    // FPS Input
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), fpsYaw);
    const right   = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), fpsYaw);
    
    if (input.isDown('KeyW')) moveDir.add(forward);
    if (input.isDown('KeyS')) moveDir.sub(forward);
    if (input.isDown('KeyA')) moveDir.sub(right);
    if (input.isDown('KeyD')) moveDir.add(right);
  } else {
    // Top-down Input
    if (input.isDown('KeyW') || input.isDown('ArrowUp'))    moveDir.z -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown'))  moveDir.z += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft'))  moveDir.x -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) moveDir.x += 1;
  }

  if (moveDir.lengthSq() > 0) moveDir.normalize();
  p.move(moveDir, delta);

  // Sync Network
  if (!isSolo && moveDir.lengthSq() > 0) {
    const payload = { x: p.group.position.x, z: p.group.position.z, rot: p.mesh.rotation.y };
    if (isHost) network.broadcast('game:move', payload); // Host manda pra todos
    else network.sendTo(hostId, 'game:move', payload);   // Cliente manda pro Host (que relaya)
  }

  // Shooting
  if (input.isDown('Space') && shootCooldown <= 0) {
    shootCooldown = SHOOT_COOLDOWN;
    
    // Calcula direção do tiro
    let dir = new THREE.Vector3(0, 0, 1);
    if (isFPS) {
      dir.set(0, 0, -1).applyEuler(new THREE.Euler(fpsPitch, fpsYaw, 0, 'YXZ'));
    } else {
      dir.set(Math.sin(p.mesh.rotation.y), 0, Math.cos(p.mesh.rotation.y)); // Frente do modelo
    }
    
    spawnProjectile(p, dir);
    
    // Network Shoot
    if (!isSolo) {
      const payload = { dir };
      if (isHost) network.broadcast('game:shoot', payload);
      else network.sendTo(hostId, 'game:shoot', payload);
    }
    
    // UI Cooldown
    const bar = document.getElementById('shoot-cooldown-fill');
    bar.style.width = '0%';
    setTimeout(() => bar.style.width = '100%', 50);
    bar.style.transition = `width ${SHOOT_COOLDOWN}s linear`;
  }
}

function spawnProjectile(owner, direction) {
  const THREE = scene._THREE;
  // Posição de saída (arma)
  const offset = new THREE.Vector3(0.3, 0.6, 0.5); // Ajuste fino
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), owner.mesh.rotation.y);
  
  const pos = owner.group.position.clone().add(offset);
  
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.15),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
  );
  mesh.position.copy(pos);
  scene.scene.add(mesh);
  
  // Som
  sfx.playShoot();

  projectiles.push({
    mesh, 
    velocity: direction.clone().normalize().multiplyScalar(PROJ_SPEED),
    ownerId: owner.id,
    lifetime: PROJ_LIFETIME
  });
}

function updateProjectiles(delta, THREE) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.lifetime -= delta;
    p.mesh.position.addScaledVector(p.velocity, delta);

    // Colisão com cenário
    if (p.mesh.position.y < 0 || Math.abs(p.mesh.position.x) > 10 || Math.abs(p.mesh.position.z) > 6 || p.lifetime <= 0) {
      scene.scene.remove(p.mesh);
      projectiles.splice(i, 1);
      continue;
    }

    // Colisão com jogadores
    let hit = false;
    for (const [id, player] of players) {
      if (id === p.ownerId || player.hp <= 0) continue;
      
      const dist = p.mesh.position.distanceTo(player.group.position);
      if (dist < 0.8) {
        // Hit!
        hit = true;
        createImpactEffect(p.mesh.position);
        
        // Dano
        if (p.ownerId === myId || (isSolo && p.ownerId === 'bot')) {
           // Eu sou o dono do projétil, eu decido que acertou
           player.takeDamage(10);
           updateHUD();
           if (!isSolo) {
             const payload = { targetId: id };
             if (isHost) network.broadcast('game:hit', payload);
             else network.sendTo(hostId, 'game:hit', payload);
           }
        }
        break;
      }
    }
    
    if (hit) {
      scene.scene.remove(p.mesh);
      projectiles.splice(i, 1);
    }
  }
}

function createImpactEffect(pos) {
  fx.emit({
    position: pos,
    count: 5,
    color: 0xffff00,
    speed: 3,
    lifetime: 0.4
  });
}

function updatePowerUps() {
  const p = players.get(myId);
  if (!p || p.hp <= 0) return;

  powerUps.forEach(pu => {
    if (pu.checkPickup(p.group.position)) {
      p.heal(30);
      pu.collect();
      sfx.playPowerUp(); // Assumindo que existe
      updateHUD();
      // Em P2P real, precisaria sincronizar coleta de powerup
    }
  });
}

function updateBot(delta, THREE) {
  if (!isSolo) return;
  const bot = players.get('bot');
  const player = players.get(myId);
  if (!bot || !player || bot.hp <= 0 || player.hp <= 0) return;

  const dist = bot.group.position.distanceTo(player.group.position);
  
  // IA Simples
  bot.faceTarget(player.group.position);
  
  if (dist > 4) {
    // Aproximar
    const dir = new THREE.Vector3().subVectors(player.group.position, bot.group.position).normalize();
    bot.move(dir, delta);
  } else {
    // Strafe
    // ... lógica simplificada
  }

  // Tiro
  botShootTimer -= delta;
  if (botShootTimer <= 0) {
    botShootTimer = 1.6;
    const dir = new THREE.Vector3().subVectors(player.group.position, bot.group.position).normalize();
    spawnProjectile(bot, dir);
  }
}

function updateHUD() {
  players.forEach(p => {
    const bar = document.getElementById(`hp-bar-${p.id}`);
    const txt = document.getElementById(`hp-text-${p.id}`);
    if (bar && txt) {
      bar.style.width = `${(p.hp / p.maxHp) * 100}%`;
      txt.textContent = Math.ceil(p.hp);
    }
  });
}

// ── FPS Mode ─────────────────────────────────────────────────────────────────
function setupFPSMode() {
  document.addEventListener('mousemove', e => {
    if (!isFPS) return;
    fpsYaw   -= e.movementX * 0.0022;
    fpsPitch -= e.movementY * 0.0022;
    fpsPitch = Math.max(-1.5, Math.min(1.5, fpsPitch));
  });
}

function enableFPS() {
  if (!players.has(myId)) return;
  isFPS = true;
  canvas.requestPointerLock();
  document.getElementById('btn-fps').classList.add('fps-active');
  document.getElementById('fps-crosshair').classList.add('visible');
  document.getElementById('fps-lock-hint').classList.add('visible');
  orbitControls.enabled = false;
  setTimeout(() => document.getElementById('fps-lock-hint').classList.remove('visible'), 2500);
}

function disableFPS() {
  isFPS = false;
  document.exitPointerLock();
  document.getElementById('btn-fps').classList.remove('fps-active');
  document.getElementById('fps-crosshair').classList.remove('visible');
  orbitControls.enabled = true;
}

function updateFPSCamera() {
  const p = players.get(myId);
  const THREE = scene._THREE;
  
  // Posiciona câmera na cabeça do player
  const camPos = p.group.position.clone().add(new THREE.Vector3(0, 0.8, 0));
  scene.camera.position.copy(camPos);
  
  // Rotação da câmera
  scene.camera.rotation.set(fpsPitch, fpsYaw, 0, 'YXZ');
  
  // Rotação do corpo do player segue o Yaw (horizontal)
  p.mesh.rotation.y = fpsYaw + Math.PI; // +PI pois o modelo olha pra Z-negativo
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
  if (overlay.classList.contains('hidden')) overlay.classList.remove('hidden');
  else overlay.classList.add('hidden');
}

function closeHelp() {
  document.getElementById('help-overlay').classList.add('hidden');
}

// Start
init();
