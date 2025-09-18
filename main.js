import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { RectAreaLightHelper } from "three/examples/jsm/helpers/RectAreaLightHelper.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x7a7a7a, 1);
document.body.appendChild(renderer.domElement);

// --- Enable Shadows ---
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
// ----------------------

const clock = new THREE.Clock();
renderer.setAnimationLoop(animate);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const selectableMeshes = [];
const placedClickable = [];
const powerClickable = [];
const dragState = { dragging: false, sourceMesh: null, ghost: null, plane: null };
const activeTweens = [];

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function addPositionTween(object3D, toVec3, duration = 0.4, onComplete) {
  const from = object3D.position.clone();
  const to = toVec3.clone();
  const start = performance.now();
  activeTweens.push({
    update(now) {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const k = easeInOutQuad(t);
      object3D.position.set(
        from.x + (to.x - from.x) * k,
        from.y + (to.y - from.y) * k,
        from.z + (to.z - from.z) * k
      );
      if (t >= 1) {
        if (onComplete) onComplete();
        return true;
      }
      return false;
    },
  });
}

const rgbeLoader = new RGBELoader();
rgbeLoader.load("/static/textures/bg.hdr", (bg) => {
  bg.mapping = THREE.EquirectangularReflectionMapping;
  // Keep HDR for reflections/lighting but not as visible skybox
  scene.environment = bg;
});
const gltfLoader = new GLTFLoader();

const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(0, 1.6, 7);
controls.target.set(0, 1.0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 1.2;
controls.maxDistance = 8;
controls.update();

const ROOM_W = 20;
const ROOM_H = 6;
const ROOM_D = 20;
const roomGeo = new THREE.BoxGeometry(ROOM_W, ROOM_H, ROOM_D);
const roomMat = new THREE.MeshStandardMaterial({
  color: 0x7a7a7a,
  roughness: 0.95,
  metalness: 0.0,
  side: THREE.BackSide,
});
const roomCube = new THREE.Mesh(roomGeo, roomMat);
roomCube.position.set(0, ROOM_H / 2, 0);
roomCube.receiveShadow = true; // Room receives shadows
scene.add(roomCube);

const BOUND_MARGIN = 0.6;
const bounds = {
  minX: -ROOM_W / 2 + BOUND_MARGIN,
  maxX: ROOM_W / 2 - BOUND_MARGIN,
  minY: 0.3,
  maxY: ROOM_H - 0.8,
  minZ: -ROOM_D / 2 + BOUND_MARGIN,
  maxZ: ROOM_D / 2 - BOUND_MARGIN,
};

// --- Improved Lighting ---
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const hemi = new THREE.HemisphereLight(0xffffff, 0xb0b5bd, 0.55);
scene.add(hemi);

// Directional light (simulating sun/window light)
const dirLight = new THREE.DirectionalLight(0xffffff, 0.35);
dirLight.position.set(5, 7, 3); // Positioned to cast shadows from a side
dirLight.castShadow = true; // This light casts shadows
dirLight.shadow.mapSize.width = 1024; // Shadow quality
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 15;
dirLight.shadow.camera.left = -10;
dirLight.shadow.camera.right = 10;
dirLight.shadow.camera.top = 10;
dirLight.shadow.camera.bottom = -10;
scene.add(dirLight);

// Big LED ceiling panels (area lights)
RectAreaLightUniformsLib.init();
const ceilingLights = [];
function addCeilingPanel(x, z, w = 6, h = 2, intensity = 5) {
  const area = new THREE.RectAreaLight(0xffffff, intensity, w, h);
  area.position.set(x, ROOM_H - 0.25, z);
  area.lookAt(x, 0, z);
  scene.add(area);
  ceilingLights.push(area);
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.25 })
  );
  panel.rotation.x = Math.PI / 2;
  panel.position.copy(area.position).y -= 0.02;
  scene.add(panel);
}
addCeilingPanel(-4, 0, 6, 1.8, 10);
addCeilingPanel(0, 0, 6, 1.8, 14);
addCeilingPanel(4, 0, 6, 1.8, 10);

// Spotlights for warmth and focus
const spotLight1 = new THREE.SpotLight(0xffaa66, 2.8); // Warm yellow light
spotLight1.position.set(-2, 4, 3);
spotLight1.angle = Math.PI / 8;
spotLight1.penumbra = 0.5; // Soft edge
spotLight1.decay = 1;
spotLight1.distance = 10;
spotLight1.castShadow = true;
scene.add(spotLight1);
spotLight1.target.position.set(0, 1.5, 0); // Point towards the center
scene.add(spotLight1.target);

const spotLight2 = new THREE.SpotLight(0xffaa66, 0.7);
spotLight2.position.set(3, 4, -4);
spotLight2.angle = Math.PI / 9;
spotLight2.penumbra = 0.6;
spotLight2.decay = 1;
spotLight2.distance = 12;
spotLight2.castShadow = true;
scene.add(spotLight2);
spotLight2.target.position.set(1, 1.0, -1); // Point towards the cozy corner
scene.add(spotLight2.target);

// Add a point light for a softer, more ambient glow in a corner
const pointLight = new THREE.PointLight(0xffe0b3, 0.5, 5); // Warm, soft light
pointLight.position.set(5, 2, 5);
pointLight.castShadow = true;
scene.add(pointLight);
// --------------------------

const cabinetSize = new THREE.Vector3(1.6, 1.8, 0.8);
const cabinetGeo = new THREE.BoxGeometry(
  cabinetSize.x,
  cabinetSize.y,
  cabinetSize.z
);
const cabinetMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.5,
  metalness: 0.05,
  transparent: true,
  opacity: 0.25,
});
const cabinet = new THREE.Mesh(cabinetGeo, cabinetMat);
cabinet.position.set(-ROOM_W / 2 + 5, 0.9, -1.0);
cabinet.castShadow = true; // Cabinet casts shadows
cabinet.receiveShadow = true; // Cabinet receives shadows
scene.add(cabinet);

const powerBtnGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 32);
const powerBtnMat = new THREE.MeshBasicMaterial({ color: 0x00ff7f });
const powerButton = new THREE.Mesh(powerBtnGeo, powerBtnMat);
powerButton.rotation.x = Math.PI / 2;
powerButton.position.set(cabinetSize.x / 2 + 0.01, cabinetSize.y / 2, 0.3);
powerButton.userData.type = "power";
powerButton.castShadow = true;
cabinet.add(powerButton);
powerClickable.push(powerButton);

const moveState = {
  forward: false,
  back: false,
  left: false,
  right: false,
  sprint: false,
};
function onKeyDown(e) {
  switch (e.code) {
    case "KeyW":
    case "ArrowUp":
      moveState.forward = true;
      e.preventDefault();
      break;
    case "KeyS":
    case "ArrowDown":
      moveState.back = true;
      e.preventDefault();
      break;
    case "KeyA":
    case "ArrowLeft":
      moveState.left = true;
      e.preventDefault();
      break;
    case "KeyD":
    case "ArrowRight":
      moveState.right = true;
      e.preventDefault();
      break;
    case "ShiftLeft":
    case "ShiftRight":
      moveState.sprint = true;
      break;
    case "KeyG": {
      // Start grab if pointing at a selectable mesh and not already dragging
      if (dragState.dragging) break;
      // Use current pointer to try pick
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(selectableMeshes, false);
      if (hits.length) {
        const picked = hits[0];
        const sourceMesh = picked.object;
        dragState.dragging = true;
        dragState.sourceMesh = sourceMesh;
        // Horizontal plane at pick height
        dragState.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -picked.point.y);
        // Ghost
        const ghostSize = new THREE.Vector3(0.7, 0.32, 0.32);
        const ghostLabel = `${sourceMesh.userData.category.toUpperCase()}\n${sourceMesh.userData.item.name}`;
        dragState.ghost = createLabeledBox(
          ghostSize,
          ghostLabel,
          categoryColor[sourceMesh.userData.category]
        );
        dragState.ghost.material.transparent = true;
        dragState.ghost.material.opacity = 0.7;
        dragState.ghost.castShadow = false;
        dragState.ghost.receiveShadow = false;
        dragState.ghost.position.copy(picked.point);
        scene.add(dragState.ghost);
      }
      e.preventDefault();
      break;
    }
  }
}
function onKeyUp(e) {
  switch (e.code) {
    case "KeyW":
    case "ArrowUp":
      moveState.forward = false;
      break;
    case "KeyS":
    case "ArrowDown":
      moveState.back = false;
      break;
    case "KeyA":
    case "ArrowLeft":
      moveState.left = false;
      break;
    case "KeyD":
    case "ArrowRight":
      moveState.right = false;
      break;
    case "ShiftLeft":
    case "ShiftRight":
      moveState.sprint = false;
      break;
    case "KeyG": {
      // Release grab: place if over cabinet, else cancel
      if (dragState.dragging) {
        const dropPos = dragState.ghost ? dragState.ghost.position.clone() : null;
        const cabinetBox = new THREE.Box3().setFromObject(cabinet);
        if (dropPos && cabinetBox.containsPoint(dropPos)) {
          selectPartFromSceneWithAnimation(dragState.sourceMesh, dropPos);
        }
        if (dragState.ghost) {
          dragState.ghost.parent?.remove(dragState.ghost);
          if (dragState.ghost.geometry) dragState.ghost.geometry.dispose();
          if (dragState.ghost.material) dragState.ghost.material.dispose();
        }
        dragState.dragging = false;
        dragState.sourceMesh = null;
        dragState.ghost = null;
        dragState.plane = null;
      }
      e.preventDefault();
      break;
    }
  }
}
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

const upVector = new THREE.Vector3(0, 1, 0);
const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();

function animate() {
  const nowDelta = clock.getDelta ? clock.getDelta() : 0.016;
  const delta = nowDelta;
  let speed = moveState.sprint ? 6 : 3;
  let moved = false;
  if (
    moveState.forward ||
    moveState.back ||
    moveState.left ||
    moveState.right
  ) {
    // Disable camera WASD move while grabbing
    if (dragState.dragging) {
      controls.update();
      renderer.render(scene, camera);
      return;
    }
    tmpForward.copy(camera.getWorldDirection(tmpForward));
    tmpForward.y = 0;
    tmpForward.normalize();
    tmpRight.copy(tmpForward).cross(upVector).normalize();

    const dir = new THREE.Vector3();
    if (moveState.forward) dir.add(tmpForward);
    if (moveState.back) dir.sub(tmpForward);
    if (moveState.right) dir.add(tmpRight);
    if (moveState.left) dir.sub(tmpRight);
    if (dir.lengthSq() > 0) {
      dir.normalize().multiplyScalar(speed * delta);
      camera.position.add(dir);
      controls.target.add(dir);

      camera.position.x = Math.max(
        bounds.minX,
        Math.min(bounds.maxX, camera.position.x)
      );
      camera.position.y = Math.max(
        bounds.minY,
        Math.min(bounds.maxY, camera.position.y)
      );
      camera.position.z = Math.max(
        bounds.minZ,
        Math.min(bounds.maxZ, camera.position.z)
      );
      controls.target.x = Math.max(
        bounds.minX,
        Math.min(bounds.maxX, controls.target.x)
      );
      controls.target.y = Math.max(
        bounds.minY,
        Math.min(bounds.maxY, controls.target.y)
      );
      controls.target.z = Math.max(
        bounds.minZ,
        Math.min(bounds.maxZ, controls.target.z)
      );
      moved = true;
    }
  }

  // Smooth orbit controls and run tweens; disable orbit rotate while dragging
  controls.enableRotate = !dragState.dragging;
  controls.enablePan = !dragState.dragging;
  controls.enableZoom = !dragState.dragging;
  controls.update();
  if (activeTweens.length) {
    const now = performance.now();
    for (let i = activeTweens.length - 1; i >= 0; i--) {
      const done = activeTweens[i].update(now);
      if (done) activeTweens.splice(i, 1);
    }
  }
  // Cycle RGB lights subtly
  if (rgbLights && rgbLights.length) {
    const t = performance.now() * 0.001;
    rgbLights.forEach((l, i) => {
      const hue = (t * 0.1 + i * 0.2) % 1;
      const color = new THREE.Color().setHSL(hue, 0.8, 0.6);
      l.color.copy(color);
    });
  }
  renderer.render(scene, camera);
}

const PARTS = {
  cpu: [
    { id: "cpu1", name: "Ryzen 5 5600", socket: "AM4", tdp: 65, brand: "AMD" },
    {
      id: "cpu2",
      name: "Core i5-12400F",
      socket: "LGA1700",
      tdp: 65,
      brand: "Intel",
    },
    {
      id: "cpu3",
      name: "Ryzen 7 5800X",
      socket: "AM4",
      tdp: 105,
      brand: "AMD",
    },
  ],
  gpu: [
    { id: "gpu1", name: "RTX 3060", tdp: 170, pcieGen: 4 },
    { id: "gpu2", name: "RX 6600", tdp: 132, pcieGen: 4 },
    { id: "gpu3", name: "GTX 1660 Super", tdp: 125, pcieGen: 3 },
  ],
  ram: [
    { id: "ram1", name: "16GB DDR4 3200", type: "DDR4", speed: 3200 },
    { id: "ram2", name: "16GB DDR5 5600", type: "DDR5", speed: 5600 },
    { id: "ram3", name: "32GB DDR4 3600", type: "DDR4", speed: 3600 },
  ],
  motherboard: [
    {
      id: "mb1",
      name: "B550 (AM4)",
      socket: "AM4",
      pcieGen: 4,
      supportedRamTypes: ["DDR4"],
      maxRamSpeed: 4400,
      sataPorts: 4,
      nvmeSlots: 2,
    },
    {
      id: "mb2",
      name: "B660 (LGA1700)",
      socket: "LGA1700",
      pcieGen: 4,
      supportedRamTypes: ["DDR4"],
      maxRamSpeed: 5000,
      sataPorts: 4,
      nvmeSlots: 2,
    },
    {
      id: "mb3",
      name: "Z690 (LGA1700, DDR5)",
      socket: "LGA1700",
      pcieGen: 5,
      supportedRamTypes: ["DDR5"],
      maxRamSpeed: 6400,
      sataPorts: 6,
      nvmeSlots: 3,
    },
  ],
  storage: [
    { id: "sto1", name: "1TB NVMe", interface: "NVMe" },
    { id: "sto2", name: "1TB SATA SSD", interface: "SATA" },
    { id: "sto3", name: "2TB HDD", interface: "SATA" },
  ],
  psu: [
    { id: "psu1", name: "450W", wattage: 450 },
    { id: "psu2", name: "550W", wattage: 550 },
    { id: "psu3", name: "750W", wattage: 750 },
  ],
};

const selection = {
  cpu: null,
  gpu: null,
  ram: null,
  motherboard: null,
  storage: null,
  psu: null,
};

function makeLabelTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.font = "28px Montserrat, Arial";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createLabeledBox(sizeVec3, labelText, color) {
  const geo = new THREE.BoxGeometry(sizeVec3.x, sizeVec3.y, sizeVec3.z);
  const tex = makeLabelTexture(labelText);
  const mat = new THREE.MeshBasicMaterial({ color, map: tex });
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}

const partCategoryList = ["cpu", "gpu", "ram", "motherboard", "storage", "psu"];
const categoryColor = {
  cpu: 0xff8c66,
  gpu: 0x66d9ff,
  ram: 0xa6ff66,
  motherboard: 0xd266ff,
  storage: 0xffd166,
  psu: 0x66ffd1,
};

const shelfRoot = new THREE.Group();
scene.add(shelfRoot);

const shelfWidth = 6.0;
const shelfDepth = 0.6;
const shelves = 3;
const shelfStartY = 0.7;
const shelfGapY = 0.65;
const shelfClearance = 0.6; // more space from side wall
const shelfHalf = shelfWidth / 2;
const shelfCenterX = -ROOM_W / 2 + shelfHalf + shelfClearance;
const shelfZ = -ROOM_D / 2 + shelfDepth / 2 + 1.0; // pull furniture away from back wall

const postMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.6 });
const postGeo = new THREE.BoxGeometry(0.1, shelves * shelfGapY + 0.6, 0.12);
const postY = shelfStartY + (shelves - 1) * shelfGapY * 0.5;
const postOffsets = [-shelfHalf + 0.15, shelfHalf - 0.15];
postOffsets.forEach((ox) => {
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.set(shelfCenterX + ox, postY, shelfZ);
  post.castShadow = true;
  post.receiveShadow = true;
  shelfRoot.add(post);
});

const boardMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.7 });
for (let i = 0; i < shelves; i++) {
  const y = shelfStartY + i * shelfGapY;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(shelfWidth, 0.08, shelfDepth),
    boardMat
  );
  board.position.set(shelfCenterX, y, shelfZ);
  board.castShadow = true;
  board.receiveShadow = true;
  shelfRoot.add(board);
}

const backPanel = new THREE.Mesh(
  new THREE.PlaneGeometry(shelfWidth + 0.4, shelves * shelfGapY + 0.6),
  new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.9 })
);
// Nudge slightly INSIDE the room so we never peek outside the wall
backPanel.position.set(shelfCenterX, postY, shelfZ - shelfDepth / 2 + 0.02);
backPanel.receiveShadow = true;
shelfRoot.add(backPanel);

const spawnRoot = new THREE.Group();
scene.add(spawnRoot);

// RGB accent lights around shelf and cabinet
const rgbLights = [];
function addRgbStrip(position, color = 0x00ffff, intensity = 1.6, distance = 3) {
  const light = new THREE.PointLight(color, intensity, distance, 2.0);
  light.position.copy(position);
  light.castShadow = false;
  scene.add(light);
  rgbLights.push(light);
}
// around shelf edges
addRgbStrip(new THREE.Vector3(shelfCenterX - shelfHalf, 1.6, shelfZ + 0.1), 0x00ffff);
addRgbStrip(new THREE.Vector3(shelfCenterX + shelfHalf, 1.0, shelfZ + 0.1), 0xff00ff);
// near cabinet front and top
addRgbStrip(new THREE.Vector3(cabinet.position.x, cabinet.position.y + 0.6, cabinet.position.z + cabinetSize.z / 2 + 0.2), 0xff3366);
addRgbStrip(new THREE.Vector3(cabinet.position.x + cabinetSize.x / 2 + 0.2, cabinet.position.y, cabinet.position.z), 0x66aaff);

cabinet.position.set(
  shelfCenterX + shelfHalf + 0.4 + cabinetSize.x / 2,
  0.9,
  shelfZ
);

let ramDisplayInstances = 0;
function spawnParts() {
  const columns = 3;
  const colGap = 2.0;
  const rowGap = 0.38;
  const verticalOffset = 0.25;
  const categoriesPerShelf = 2;
  const itemSize = new THREE.Vector3(0.8, 0.35, 0.35);

  partCategoryList.forEach((category, idx) => {
    const shelfIndex = Math.floor(idx / categoriesPerShelf);
    const sideIndex = idx % categoriesPerShelf;
    const y = shelfStartY + shelfIndex * shelfGapY;
    const startX =
      shelfCenterX + (sideIndex === 0 ? -colGap * 0.9 : colGap * 0.9);
    PARTS[category].forEach((item, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const position = new THREE.Vector3(
        startX + (col - 1) * 1.05,
        y + (row ? -rowGap : 0) + verticalOffset,
        shelfZ
      );

      if (category === 'ram' && ramDisplayInstances < 1) {
        // Load DDR5 RAM GLTF model
        gltfLoader.load('/models/ram.glb', (gltf) => {
          const ramModel = gltf.scene;
          ramModel.position.copy(position);
          ramModel.scale.set(0.5, 0.5, 0.5); // Larger on shelf for visibility
          ramModel.userData = { category, id: item.id, item };
          ramModel.traverse((node) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });
          spawnRoot.add(ramModel);
          selectableMeshes.push(ramModel);
          ramDisplayInstances++;
        }, undefined, (error) => {
          console.error('Error loading DDR5 RAM model:', error);
          // Fallback to box if GLTF fails
          const label = `${category.toUpperCase()}\n${item.name}`;
          const box = createLabeledBox(itemSize, label, categoryColor[category]);
          box.position.copy(position);
          box.userData = { category, id: item.id, item };
          box.castShadow = true;
          box.receiveShadow = true;
          spawnRoot.add(box);
          selectableMeshes.push(box);
        });
      } else {
        // Use boxes for other categories
        const label = `${category.toUpperCase()}\n${item.name}`;
        const box = createLabeledBox(itemSize, label, categoryColor[category]);
        box.position.copy(position);
        box.userData = { category, id: item.id, item };
        box.castShadow = true;
        box.receiveShadow = true;
        spawnRoot.add(box);
        selectableMeshes.push(box);
      }
    });
  });
}

const cabinetSlots = {
  cpu: new THREE.Vector3(-0.3, 0.4, 0),
  gpu: new THREE.Vector3(0.4, 0.1, 0),
  ram: new THREE.Vector3(-0.6, 0.2, 0),
  motherboard: new THREE.Vector3(-0.1, 0.2, 0),
  storage: new THREE.Vector3(0.6, -0.2, 0.2),
  psu: new THREE.Vector3(-0.6, -0.6, 0),
};

const placedMeshes = {
  cpu: null,
  gpu: null,
  ram: null,
  motherboard: null,
  storage: null,
  psu: null,
};

// More realistic target transforms for each category
const cabinetSlotTransforms = {
  cpu: { pos: new THREE.Vector3(-0.25, 0.6, -0.05), rot: new THREE.Euler(0, 0, 0) },
  gpu: { pos: new THREE.Vector3(0.45, 0.25, 0.0), rot: new THREE.Euler(0, -Math.PI / 2, 0) },
  ram: { pos: new THREE.Vector3(-0.45, 0.45, 0.05), rot: new THREE.Euler(0, 0, 0) },
  motherboard: { pos: new THREE.Vector3(-0.15, 0.45, -0.35), rot: new THREE.Euler(0, Math.PI, 0) },
  storage: { pos: new THREE.Vector3(0.6, -0.15, 0.25), rot: new THREE.Euler(0, 0, 0) },
  psu: { pos: new THREE.Vector3(-0.55, -0.65, 0.0), rot: new THREE.Euler(0, 0, 0) },
};

function selectPartFromScene(mesh) {
  const { category, id } = mesh.userData || {};
  if (!category || !id) return;
  const item = PARTS[category].find((x) => x.id === id);
  if (!item) return;
  selection[category] = item;

  if (placedMeshes[category]) {
    const old = placedMeshes[category];
    old.parent?.remove(old);
    const idx = placedClickable.indexOf(old);
    if (idx >= 0) placedClickable.splice(idx, 1);
    old.geometry.dispose();
    if (Array.isArray(old.material)) old.material.forEach((m) => m.dispose());
    else if (old.material) old.material.dispose();
  }

  const label = `${category.toUpperCase()}\n${item.name}`;
  const size = new THREE.Vector3(0.6, 0.3, 0.3);
  const placed = createLabeledBox(size, label, categoryColor[category]);
  placed.position.copy(cabinetSlots[category]);
  placed.userData = { category, id };
  placed.castShadow = true;
  placed.receiveShadow = true;
  cabinet.add(placed);
  placedMeshes[category] = placed;
  placedClickable.push(placed);
}

function selectPartFromSceneWithAnimation(sourceMesh, worldDropPos) {
  const { category, id } = sourceMesh.userData || {};
  if (!category || !id) return;
  const item = PARTS[category].find((x) => x.id === id);
  if (!item) return;
  selection[category] = item;

  if (placedMeshes[category]) {
    const old = placedMeshes[category];
    old.parent?.remove(old);
    const idx = placedClickable.indexOf(old);
    if (idx >= 0) placedClickable.splice(idx, 1);
    // Properly dispose of GLTF models
    if (old.geometry) old.geometry.dispose();
    if (Array.isArray(old.material)) old.material.forEach((m) => m.dispose());
    else if (old.material) old.material.dispose();
    // Dispose of child meshes if it's a GLTF model
    old.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
      else if (node.material) node.material.dispose();
    });
  }

  let placed;
  if (category === 'ram') {
    // Clone the GLTF model for placement
    placed = sourceMesh.clone();
    placed.scale.set(0.35, 0.35, 0.35); // Slightly larger in cabinet
  } else {
    // Use boxes for other categories
    const label = `${category.toUpperCase()}\n${item.name}`;
    const size = new THREE.Vector3(0.6, 0.3, 0.3);
    placed = createLabeledBox(size, label, categoryColor[category]);
  }

  // Convert world drop position to cabinet local space for a smooth slide in
  const localStart = cabinet.worldToLocal(worldDropPos.clone());
  placed.position.copy(localStart);
  placed.userData = { category, id };
  placed.castShadow = true;
  placed.receiveShadow = true;
  cabinet.add(placed);

  const target = cabinetSlotTransforms[category] || { pos: cabinetSlots[category], rot: new THREE.Euler(0, 0, 0) };
  addPositionTween(placed, target.pos.clone(), 0.45);
  // Also orient realistically
  placed.rotation.copy(target.rot);

  placedMeshes[category] = placed;
  placedClickable.push(placed);
}

function allSelected() {
  return Object.keys(selection).every((k) => selection[k]);
}
function validateBuild() {
  const errors = [];
  const { cpu, gpu, ram, motherboard, storage, psu } = selection;

  if (!Object.values(selection).every(Boolean)) {
    errors.push("Please select one part for each category.");
    return { ok: false, errors };
  }

  if (cpu.socket !== motherboard.socket) {
    errors.push(
      `CPU socket ${cpu.socket} is not compatible with motherboard socket ${motherboard.socket}.`
    );
  }
  if (!motherboard.supportedRamTypes.includes(ram.type)) {
    errors.push(
      `RAM type ${
        ram.type
      } is not supported by the motherboard (supports ${motherboard.supportedRamTypes.join(
        ", "
      )}).`
    );
  }
  if (ram.speed > motherboard.maxRamSpeed) {
    errors.push(
      `RAM speed ${ram.speed} exceeds motherboard max supported speed ${motherboard.maxRamSpeed}.`
    );
  }
  if (gpu.pcieGen > motherboard.pcieGen) {
    errors.push(
      `GPU requires PCIe Gen ${gpu.pcieGen}, but motherboard supports up to Gen ${motherboard.pcieGen}.`
    );
  }
  if (storage.interface === "NVMe" && motherboard.nvmeSlots < 1) {
    errors.push(
      "Selected storage is NVMe but the motherboard has no NVMe slots."
    );
  }
  if (storage.interface === "SATA" && motherboard.sataPorts < 1) {
    errors.push(
      "Selected storage is SATA but the motherboard has no SATA ports."
    );
  }
  const requiredPower = cpu.tdp + gpu.tdp + 100;
  if (psu.wattage < requiredPower) {
    errors.push(
      `PSU wattage ${psu.wattage}W is insufficient. Need at least ${requiredPower}W.`
    );
  }

  return { ok: errors.length === 0, errors };
}

function setupPicking() {
  function updatePointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  renderer.domElement.addEventListener("pointermove", (event) => {
    updatePointer(event);
    if (dragState.dragging && dragState.plane) {
      raycaster.setFromCamera(pointer, camera);
      const hitPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragState.plane, hitPoint)) {
        dragState.ghost.position.copy(hitPoint);
        // Auto-snap when ghost enters expanded cabinet bounds while grabbing with G
        const expanded = new THREE.Box3().setFromObject(cabinet);
        const expandPad = new THREE.Vector3(0.3, 0.3, 0.3);
        expanded.min.sub(expandPad);
        expanded.max.add(expandPad);
        if (expanded.containsPoint(dragState.ghost.position)) {
          selectPartFromSceneWithAnimation(dragState.sourceMesh, dragState.ghost.position);
          // remove ghost and end drag
          dragState.ghost.parent?.remove(dragState.ghost);
          if (dragState.ghost.geometry) dragState.ghost.geometry.dispose();
          if (dragState.ghost.material) dragState.ghost.material.dispose();
          dragState.dragging = false;
          dragState.sourceMesh = null;
          dragState.ghost = null;
          dragState.plane = null;
        }
      }
    }
  });
  renderer.domElement.addEventListener("pointerdown", (event) => {
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    let hits = raycaster.intersectObjects(powerClickable, true);
    if (hits.length) {
      const { ok, errors } = validateBuild();
      const hudResult = document.getElementById("hud-result");
      if (hudResult) {
        hudResult.className = "";
        if (ok) {
          hudResult.classList.add("ok");
          hudResult.textContent = "✅ PC build is compatible and should run.";
        } else {
          hudResult.classList.add("error");
          hudResult.textContent = `❌ Issues: ${errors.join(" | ")}`;
        }
      }
      return;
    }
    // Ignore clicks while using grab mechanic; keep existing remove-on-click
    hits = raycaster.intersectObjects(placedClickable, true);
    if (hits.length) {
      const hit = hits[0].object;
      const { category } = hit.userData || {};
      if (category && placedMeshes[category] === hit) {
        hit.parent?.remove(hit);
        const idx = placedClickable.indexOf(hit);
        if (idx >= 0) placedClickable.splice(idx, 1);
        hit.geometry.dispose();
        if (Array.isArray(hit.material))
          hit.material.forEach((m) => m.dispose());
        else if (hit.material) hit.material.dispose();
        placedMeshes[category] = null;
        selection[category] = null;
        return;
      }
    }
    // Clicking shelf no longer starts drag; use G to grab
  });

  // Mouse up no longer ends drag; releasing G does
}

spawnParts();
setupPicking();

// Handle resize for smoother visuals
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const btnReset = document.getElementById("btn-reset");
const hudResult = document.getElementById("hud-result");

if (btnReset && hudResult) {
  btnReset.addEventListener("click", () => {
    Object.keys(selection).forEach((k) => (selection[k] = null));
    Object.keys(placedMeshes).forEach((k) => {
      const m = placedMeshes[k];
      if (!m) return;
      m.parent?.remove(m);
      // Properly dispose of GLTF models
      if (m.geometry) m.geometry.dispose();
      if (Array.isArray(m.material)) m.material.forEach((mm) => mm.dispose());
      else if (m.material) m.material.dispose();
      // Dispose of child meshes if it's a GLTF model
      m.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
        if (Array.isArray(node.material)) node.material.forEach((mm) => mm.dispose());
        else if (node.material) node.material.dispose();
      });
      placedMeshes[k] = null;
    });
    placedClickable.splice(0, placedClickable.length);
    hudResult.className = "";
    hudResult.textContent = "";
  });
}

// --- NEW OBJECTS AND PLACEMENT ---

// Helper to load GLTF models
function loadGLTF(path, position, scale, rotation, castShadow = true, receiveShadow = true) {
    gltfLoader.load(path, (gltf) => {
        gltf.scene.position.copy(position);
        gltf.scene.scale.set(scale.x, scale.y, scale.z);
        gltf.scene.rotation.set(rotation.x, rotation.y, rotation.z);
        gltf.scene.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = castShadow;
                node.receiveShadow = receiveShadow;
                // Optional: Adjust materials for consistency if needed
                if (node.material.map) node.material.map.colorSpace = THREE.SRGBColorSpace;
                node.material.roughness = Math.max(0.5, node.material.roughness || 0.5); // Ensure some roughness
            }
        });
        scene.add(gltf.scene);
    }, undefined, (error) => {
        console.error('An error occurred loading GLTF model:', path, error);
    });
}

// 1. Mat for entrance (simple plane)
const matGeo = new THREE.PlaneGeometry(3, 2);
const matTex = new THREE.TextureLoader().load('/static/textures/mat_texture.jpg'); // Replace with actual path
matTex.colorSpace = THREE.SRGBColorSpace;
const matMat = new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.8, metalness: 0 });
const entranceMat = new THREE.Mesh(matGeo, matMat);
entranceMat.rotation.x = -Math.PI / 2; // Lie flat on the floor
entranceMat.position.set(0, 0.01, ROOM_D / 2 - 2); // Near the "entrance"
entranceMat.receiveShadow = true;
scene.add(entranceMat);

// 2. Posters (simple planes with textures)
function createPoster(x, y, z, rotationY, texturePath, width = 2, height = 1.5) {
    const posterGeo = new THREE.PlaneGeometry(width, height);
    const posterTex = new THREE.TextureLoader().load(texturePath); // Replace with actual path
    posterTex.colorSpace = THREE.SRGBColorSpace;
    const posterMat = new THREE.MeshStandardMaterial({ map: posterTex, side: THREE.DoubleSide });
    const poster = new THREE.Mesh(posterGeo, posterMat);
    poster.position.set(x, y, z);
    poster.rotation.y = rotationY;
    poster.receiveShadow = true;
    scene.add(poster);
}

// Example posters:
// On the back wall, above the cabinet/shelf area
createPoster(shelfCenterX + 3, ROOM_H - 1.5, shelfZ - shelfDepth / 2 - 0.03, 0, '/static/textures/poster_gaming.jpg', 2.5, 1.8);
// On the opposite wall
createPoster(ROOM_W / 2 - 0.05, ROOM_H - 2, 0, -Math.PI / 2, '/static/textures/poster_tech.jpg', 3, 2);
createPoster(-ROOM_W / 2 + 0.05, ROOM_H - 2.5, 5, Math.PI / 2, '/static/textures/poster_pcbuild.jpg', 2.8, 2);


// 3. Display Table (simple box for now, ideally GLTF)
const displayTableGeo = new THREE.BoxGeometry(3, 1.0, 1.5);
const displayTableMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.6 });
const displayTable = new THREE.Mesh(displayTableGeo, displayTableMat);
displayTable.position.set(0, 0.5, 2); // More central
displayTable.castShadow = true;
displayTable.receiveShadow = true;
scene.add(displayTable);

// Add "dummy" PC components on the table (can be simple boxes or loaded GLTFs)
const monitorGeo = new THREE.BoxGeometry(0.8, 0.5, 0.05);
const monitorMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.2 });
const monitor = new THREE.Mesh(monitorGeo, monitorMat);
monitor.position.set(0, 1.25, 2.7); // On the table
monitor.castShadow = true;
scene.add(monitor);

const keyboardGeo = new THREE.BoxGeometry(0.6, 0.05, 0.2);
const keyboardMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5 });
const keyboard = new THREE.Mesh(keyboardGeo, keyboardMat);
keyboard.position.set(0, 1.03, 3.2);
keyboard.castShadow = true;
scene.add(keyboard);

// 4. Cozy Corner with Chair and Side Table (simple boxes, ideally GLTF)
const chairGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0); // Simple block chair
const chairMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 }); // Dark brown fabric
const chair = new THREE.Mesh(chairGeo, chairMat);
chair.position.set(ROOM_W / 2 - 2, 0.5, -ROOM_D / 2 + 3); // In a corner
chair.rotation.y = Math.PI / 4; // Angled
chair.castShadow = true;
chair.receiveShadow = true;
scene.add(chair);

const sideTableGeo = new THREE.BoxGeometry(0.7, 0.6, 0.7);
const sideTableMat = new THREE.MeshStandardMaterial({ color: 0xededed, roughness: 0.6 });
const sideTable = new THREE.Mesh(sideTableGeo, sideTableMat);
sideTable.position.set(ROOM_W / 2 - 3, 0.3, -ROOM_D / 2 + 2); // Beside the chair
sideTable.castShadow = true;
sideTable.receiveShadow = true;
scene.add(sideTable);

// Small decorative elements on side table
const coffeeCupGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 16);
const coffeeCupMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
const coffeeCup = new THREE.Mesh(coffeeCupGeo, coffeeCupMat);
coffeeCup.position.set(ROOM_W / 2 - 3, 0.7, -ROOM_D / 2 + 2);
coffeeCup.castShadow = true;
scene.add(coffeeCup);

// 5. Desk/Counter for the cabinet (replace cabinet's wireframe)
// Create a more solid-looking counter where the cabinet is.
const counterGeo = new THREE.BoxGeometry(cabinetSize.x + 1, 0.9, cabinetSize.z + 0.2);
const counterMat = new THREE.MeshStandardMaterial({ color: 0x4a423a, roughness: 0.6 }); // Dark wood/laminate
const counter = new THREE.Mesh(counterGeo, counterMat);
counter.position.set(cabinet.position.x, 0.45, cabinet.position.z);
counter.castShadow = true;
counter.receiveShadow = true;
scene.add(counter);

// To make the wireframe cabinet 'sit' on the counter, adjust its Y position relative to the counter.
cabinet.position.y = counter.position.y + counterGeo.parameters.height / 2 + cabinetSize.y / 2;


// Example GLTF Loader usage (you'd need to create/find these models)
// This is illustrative, assuming you have files like 'gaming_chair.glb', 'desktop_monitor.glb' etc.
/*
loadGLTF(
    '/static/models/gaming_chair.glb',
    new THREE.Vector3(ROOM_W / 2 - 2, 0, -ROOM_D / 2 + 3),
    new THREE.Vector3(0.8, 0.8, 0.8),
    new THREE.Vector3(0, Math.PI / 4, 0)
);

loadGLTF(
    '/static/models/desktop_monitor.glb',
    new THREE.Vector3(0, 1.0, 2.7),
    new THREE.Vector3(0.5, 0.5, 0.5),
    new THREE.Vector3(0, 0, 0)
);

loadGLTF(
    '/static/models/plant.glb',
    new THREE.Vector3(-ROOM_W / 2 + 1, 0, -ROOM_D / 2 + 1),
    new THREE.Vector3(0.3, 0.3, 0.3),
    new THREE.Vector3(0, 0, 0)
);
*/

// --- End NEW OBJECTS AND PLACEMENT ---