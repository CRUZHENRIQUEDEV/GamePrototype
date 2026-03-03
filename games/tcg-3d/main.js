// games/tcg-3d/main.js
// TCG com mesa de jogo renderizada em Three.js

import { bus } from "../../shared/core/EventBus.js";
import { loader } from "../../shared/core/AssetLoader.js";
import { storage } from "../../shared/storage/StorageManager.js";
import { network } from "../../shared/network/NetworkManager.js";
import { CardEngine } from "../../shared/tcg/CardEngine.js";
import { SceneManager } from "../../shared/render/SceneManager.js";
import { CardRenderer } from "../../shared/render/CardRenderer.js";
import { UIManager } from "../../shared/ui/UIManager.js";
import { InputManager } from "../../shared/input/InputManager.js";
import { ParticleSystem3D } from "../../shared/render/ParticleSystem.js";
import { rules } from "./rules.js";

const canvas = document.getElementById("canvas");
const ui = new UIManager();
const input = new InputManager(canvas);

let scene, engine, fx;
let localId = null,
  opponentId = null;
let cardObjects = []; // { mesh, card, ownerId }

async function init() {
  // Assets
  const assets = await loader.load([
    { key: "cards", url: "../tcg-basic/cards.json", type: "json" },
  ]);
  const cardDb = Object.fromEntries(assets.cards.map((c) => [c.id, c]));

  // Storage
  await storage.init([
    { name: "collection", keyPath: "id" },
    { name: "decks", keyPath: "deckId" },
  ]);

  // Cena 3D
  scene = new SceneManager(canvas, { background: "#0a0a12", shadows: true });
  await scene.init();
  scene.addLight("ambient", { intensity: 0.4 });
  scene.addLight("directional", {
    position: [5, 12, 8],
    intensity: 1.2,
    shadows: true,
  });
  scene.addLight("point", {
    position: [0, 6, 0],
    color: 0x4466ff,
    intensity: 0.3,
  });

  // Mesa
  const table = scene.createPlane(20, 12, 0x1a3a2a);
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  scene.scene.add(table);

  // Linha divisória
  const THREE = scene._THREE;
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-10, 0.01, 0),
    new THREE.Vector3(10, 0.01, 0),
  ]);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x4466cc,
    opacity: 0.5,
    transparent: true,
  });
  scene.scene.add(new THREE.Line(lineGeo, lineMat));

  // Camera
  scene.camera.position.set(0, 14, 10);
  scene.camera.lookAt(0, 0, 0);
  await scene.addOrbitControls();

  // Partículas
  fx = new ParticleSystem3D(scene);

  // Rede
  scene.start();
  setupLobby(cardDb);
}

function setupLobby(cardDb) {
  document.getElementById("btn-create").addEventListener("click", async () => {
    const roomId = `tcg3d-${Math.random().toString(36).slice(2, 7)}`;
    localId = await network.createRoom(roomId);

    const inviteUrl = `${location.origin}${location.pathname}?join=${roomId}`;

    // Hide menu
    document.getElementById("lobby-menu").style.display = "none";

    document.getElementById("room-display").textContent = roomId;
    document.getElementById("room-info").style.display = "flex";

    // Botão de entrar removido - aguardando oponente

    document
      .getElementById("btn-copy-id")
      .addEventListener("click", function () {
        copyToClipboard(roomId, this);
      });
    document
      .getElementById("btn-copy-url")
      .addEventListener("click", function () {
        copyToClipboard(inviteUrl, this);
      });

    bus.on("net:peer-joined", ({ peerId }) => {
      opponentId = peerId;
      startGame(cardDb);
    });
  });

  document.getElementById("btn-join").addEventListener("click", async () => {
    const roomId = document.getElementById("room-input").value.trim();
    if (!roomId) return;
    localId = await network.joinRoom(roomId);
    opponentId = roomId;
    startGame(cardDb);
  });

  const params = new URLSearchParams(location.search);
  if (params.get("join")) {
    document.getElementById("room-input").value = params.get("join");
    document.getElementById('btn-join').click();
  }

  // Help
  const helpOverlay = document.getElementById('help-overlay');
  document.getElementById('btn-help').addEventListener('click', () => {
    helpOverlay.classList.add('ui-modal-overlay--visible');
  });
  document.getElementById('help-close').addEventListener('click', () => {
    helpOverlay.classList.remove('ui-modal-overlay--visible');
  });
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "Copiado!";
    btn.classList.add("btn-copy--done");
    setTimeout(() => {
      btn.textContent = btn.dataset.label;
      btn.classList.remove("btn-copy--done");
    }, 2000);
  });
}

function startGame(cardDb) {
  document.getElementById("lobby").classList.add("hidden");

  engine = new CardEngine(rules);
  const deck = buildDeck(cardDb);
  engine.initGame([localId, opponentId], {
    [localId]: deck,
    [opponentId]: deck,
  });

  bus.on("card:drawn", () => render3DHand());
  bus.on("card:played", (d) => {
    render3DField(d.target);
    render3DHand();
  });
  bus.on("player:damage", (d) => onDamage(d));
  bus.on("player:win", (d) => onWin(d));
  bus.on("net:action", ({ type, payload, from }) => {
    if (from === localId) return;
    if (type === "play-card")
      engine.applyAction({ type: "play-card", cardId: payload.cardId }, from);
    if (type === "end-phase") engine.nextPhase();
  });

  document.getElementById("btn-end-phase").addEventListener("click", () => {
    engine.nextPhase();
    network.broadcast("end-phase", {});
  });
}

function buildDeck(cardDb) {
  return Object.values(cardDb)
    .flatMap((c, i) => [
      { ...c, instanceId: `${c.id}_0` },
      { ...c, instanceId: `${c.id}_1` },
    ])
    .slice(0, 20);
}

function render3DField(playerId) {
  const THREE = scene._THREE;
  const player = engine.state.players[playerId];
  const isLocal = playerId === localId;
  const zOffset = isLocal ? 3 : -3;

  // Remove objetos antigos do campo deste jogador
  cardObjects = cardObjects.filter((o) => {
    if (o.ownerId === playerId && o.zone === "field") {
      scene.scene.remove(o.mesh);
      return false;
    }
    return true;
  });

  player.field.forEach((card, i) => {
    const mesh = createCardMesh(card, THREE);
    mesh.position.set((i - player.field.length / 2) * 1.6, 0.05, zOffset);
    mesh.rotation.x = isLocal ? 0 : Math.PI;
    if (card.tapped) mesh.rotation.z = Math.PI / 2;
    scene.scene.add(mesh);
    cardObjects.push({ mesh, card, ownerId: playerId, zone: "field" });
  });
}

function render3DHand() {
  const THREE = scene._THREE;
  const player = engine.state.players[localId];

  cardObjects = cardObjects.filter((o) => {
    if (o.ownerId === localId && o.zone === "hand") {
      scene.scene.remove(o.mesh);
      return false;
    }
    return true;
  });

  player.hand.forEach((card, i) => {
    const mesh = createCardMesh(card, THREE);
    const total = player.hand.length;
    const angle = (i / (total - 1 || 1) - 0.5) * 1.2;
    mesh.position.set(Math.sin(angle) * 5, 0.1 + i * 0.01, 7);
    mesh.rotation.x = -0.7;
    mesh.rotation.z = angle * 0.3;

    // Click para jogar
    mesh.userData = { card, ownerId: localId, zone: "hand" };
    scene.scene.add(mesh);
    cardObjects.push({ mesh, card, ownerId: localId, zone: "hand" });
  });

  setupRaycaster();
}

function createCardMesh(card, THREE) {
  const geo = new THREE.BoxGeometry(1.4, 0.02, 1.96);
  const colors = {
    creature: 0x1b4332,
    spell: 0x1d3557,
    artifact: 0x3d2b1f,
    trap: 0x4a0e4e,
  };
  const mat = new THREE.MeshStandardMaterial({
    color: colors[card.type] ?? 0x1d3557,
    roughness: 0.5,
    metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function setupRaycaster() {
  const THREE = scene._THREE;
  const raycaster = new THREE.Raycaster();

  input.bind("Space", () => {
    const ndc = input.toNDC(input.pointer.x, input.pointer.y, canvas);
    raycaster.setFromCamera(ndc, scene.camera);
    const hits = raycaster.intersectObjects(
      cardObjects.filter((o) => o.zone === "hand").map((o) => o.mesh)
    );
    if (hits.length) {
      const card = hits[0].object.userData.card;
      const ok = engine.applyAction(
        { type: "play-card", cardId: card.instanceId },
        localId
      );
      if (ok) {
        network.broadcast("play-card", { cardId: card.instanceId });
        fx.burst(hits[0].point, { count: 16, color: 0xffd700 });
      }
    }
  });
}

function onDamage({ target, value }) {
  const pos = target === localId ? { x: 0, y: 1, z: 5 } : { x: 0, y: 1, z: -5 };
  fx.burst(pos, { count: 12, color: 0xff4444 });
  ui.toast(`${value} de dano!`, "error", 1500);
}

function onWin({ winner }) {
  const msg = winner === localId ? "Você venceu!" : "Você perdeu...";
  ui.openModal("game-over", `<h2>${msg}</h2>`, {
    title: "Fim de Jogo",
    confirmLabel: "Reiniciar",
    onConfirm: () => location.reload(),
  });
}

init().catch(console.error);
