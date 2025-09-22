import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { RectAreaLightHelper } from "three/examples/jsm/helpers/RectAreaLightHelper.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";

// Loading screen management
const loadingScreen = document.getElementById('loading-screen');
const progressFill = document.getElementById('progress-fill');
const loadingText = document.getElementById('loading-text');

let totalAssets = 0;
let loadedAssets = 0;

// Audio management using HTML5 audio
let backgroundMusic = null;
let movementSound = null;
let isAudioEnabled = true;

// VR management
let renderer = null;
let vrButton = null;
let controller1 = null;
let controller2 = null;
let controllerGrip1 = null;
let controllerGrip2 = null;
let isVRActive = false;
let teleportLine = null;
let teleportTarget = null;
let isTeleporting = false;
let floor = null; // Global floor reference for VR teleportation
let pcModel = null; // Reference to the PC model for interactions
let isPCPowered = false; // PC power state
let pcLights = []; // RGB lights for PC components
let fanMeshes = []; // Fan meshes for animation
let inspectionMode = false; // Component inspection mode
let inspectedComponent = null; // Currently inspected component
let roomLightsOn = true; // Room lighting state
let mainRoomLights = []; // Array of main room lights
let ambientLight = null; // Ambient light reference
let accentLights = []; // Accent lights for dim mode

// Load audio files
function loadAudio() {
  console.log('Loading audio files...');
  
  // Create HTML5 audio elements
  backgroundMusic = new Audio('/static/sounds/ambient.mp3');
  backgroundMusic.loop = true;
  backgroundMusic.volume = 0.1; // Much quieter - just a faint background sound
  backgroundMusic.preload = 'auto';
  
  movementSound = new Audio('/static/sounds/swoosh.mp3');
  movementSound.volume = 0.2;
  movementSound.preload = 'auto';
  
  console.log('Audio elements created');
  
  // Add event listeners for debugging
  backgroundMusic.addEventListener('loadstart', () => console.log('Background music loading started'));
  backgroundMusic.addEventListener('canplay', () => console.log('Background music can play'));
  backgroundMusic.addEventListener('canplaythrough', () => console.log('Background music can play through'));
  backgroundMusic.addEventListener('loadeddata', () => console.log('Background music data loaded'));
  backgroundMusic.addEventListener('error', (e) => console.error('Background music error:', e));
  backgroundMusic.addEventListener('abort', () => console.log('Background music aborted'));
  backgroundMusic.addEventListener('stalled', () => console.log('Background music stalled'));
  
  movementSound.addEventListener('loadstart', () => console.log('Movement sound loading started'));
  movementSound.addEventListener('canplay', () => console.log('Movement sound can play'));
  movementSound.addEventListener('error', (e) => console.error('Movement sound error:', e));
  
  // Try to play background music immediately after loading
  setTimeout(() => {
    if (backgroundMusic && backgroundMusic.readyState >= 2) {
      console.log('Attempting to play background music immediately...');
      backgroundMusic.play().then(() => {
        console.log('Background music started successfully on load');
      }).catch((error) => {
        console.log('Background music play failed on load:', error);
        console.log('User interaction required to start audio');
      });
    }
  }, 1000);
}

function updateLoadingProgress(assetName) {
  loadedAssets++;
  const progress = (loadedAssets / totalAssets) * 100;
  progressFill.style.width = `${progress}%`;
  loadingText.textContent = `Loading ${assetName}... (${loadedAssets}/${totalAssets})`;
  console.log(`Loading progress: ${progress.toFixed(1)}% - ${assetName}`);
}

function hideLoadingScreen() {
  setTimeout(() => {
    loadingScreen.classList.add('loaded');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
      // Start audio after loading screen is hidden
      loadAudio();
    }, 500);
  }, 1000);
}

// Play movement sound
function playMovementSound() {
  if (movementSound && isAudioEnabled) {
    movementSound.currentTime = 0; // Reset to beginning
    movementSound.play().catch((error) => {
      console.log('Movement sound play failed:', error);
    });
  }
}

// Toggle audio on/off
function toggleAudio() {
  isAudioEnabled = !isAudioEnabled;
  if (backgroundMusic) {
    if (isAudioEnabled) {
      backgroundMusic.play().catch((error) => {
        console.log('Background music play failed:', error);
      });
    } else {
      backgroundMusic.pause();
    }
  }
  console.log('Audio', isAudioEnabled ? 'enabled' : 'disabled');
}

// VR setup functions
function setupVR() {
  console.log('Setting up VR...');
  
  // Create VR button
  vrButton = VRButton.createButton(renderer);
  vrButton.style.position = 'absolute';
  vrButton.style.bottom = '20px';
  vrButton.style.left = '20px';
  vrButton.style.zIndex = '1000';
  document.body.appendChild(vrButton);
  
  // Setup VR session
  renderer.xr.addEventListener('sessionstart', onVRSessionStart);
  renderer.xr.addEventListener('sessionend', onVRSessionEnd);
  
  // Create VR controllers
  setupVRControllers();
  
  console.log('VR setup complete');
}

function setupVRControllers() {
  const controllerModelFactory = new XRControllerModelFactory();
  
  // Controller 1 (Left hand - Teleportation)
  controller1 = renderer.xr.getController(0);
  controller1.addEventListener('selectstart', onTeleportStart);
  controller1.addEventListener('selectend', onTeleportEnd);
  controller1.addEventListener('squeezestart', onSelectStart);
  controller1.addEventListener('squeezeend', onSelectEnd);
  scene.add(controller1);
  
  controllerGrip1 = renderer.xr.getControllerGrip(0);
  controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
  scene.add(controllerGrip1);
  
  // Controller 2 (Right hand - Component interaction)
  controller2 = renderer.xr.getController(1);
  controller2.addEventListener('selectstart', onSelectStart);
  controller2.addEventListener('selectend', onSelectEnd);
  scene.add(controller2);
  
  controllerGrip2 = renderer.xr.getControllerGrip(1);
  controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
  scene.add(controllerGrip2);
  
  // Setup teleportation line
  setupTeleportation();
}

function onVRSessionStart() {
  console.log('VR session started');
  isVRActive = true;
  
  // Disable orbit controls in VR
  if (controls) {
    controls.enabled = false;
  }
  
  // Hide desktop UI elements
  const hud = document.getElementById('hud');
  if (hud) {
    hud.style.display = 'none';
  }
}

function onVRSessionEnd() {
  console.log('VR session ended');
  isVRActive = false;
  
  // Re-enable orbit controls
  if (controls) {
    controls.enabled = true;
  }
  
  // Show desktop UI elements
  const hud = document.getElementById('hud');
  if (hud) {
    hud.style.display = 'block';
  }
}

function onSelectStart(event) {
  console.log('VR controller select start');
  
  // Play movement sound
  playMovementSound();
  
  // Raycast from controller
  const controller = event.target;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromXRController(controller);
  
  const intersects = raycaster.intersectObjects(selectableMeshes, true);
  
  if (intersects.length > 0) {
    const selectedObject = intersects[0].object;
    console.log('VR selected object:', selectedObject);
    
    // Handle component selection in VR
    if (selectedObject.userData.isComponent) {
      selectPartFromSceneWithAnimation(selectedObject);
    }
  }
}

function onSelectEnd(event) {
  console.log('VR controller select end');
}

// Teleportation functions
function setupTeleportation() {
  // Create teleportation line
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -10)
  ]);
  
  teleportLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.8
  }));
  teleportLine.visible = false;
  scene.add(teleportLine);
  
  // Create teleportation target indicator
  const targetGeometry = new THREE.RingGeometry(0.1, 0.2, 16);
  const targetMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
  });
  teleportTarget = new THREE.Mesh(targetGeometry, targetMaterial);
  teleportTarget.rotation.x = -Math.PI / 2;
  teleportTarget.visible = false;
  scene.add(teleportTarget);
}

function onTeleportStart(event) {
  console.log('VR teleport start');
  isTeleporting = true;
  teleportLine.visible = true;
  teleportTarget.visible = true;
}

function onTeleportEnd(event) {
  console.log('VR teleport end');
  isTeleporting = false;
  teleportLine.visible = false;
  teleportTarget.visible = false;
  
  // Perform teleportation
  if (teleportTarget.position.y > 0) {
    const camera = renderer.xr.getCamera();
    const newPosition = teleportTarget.position.clone();
    newPosition.y = camera.position.y; // Keep current height
    
    // Smooth teleportation
    const startPosition = camera.position.clone();
    const duration = 500; // 500ms
    const startTime = performance.now();
    
    function teleportAnimation() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out animation
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      camera.position.lerpVectors(startPosition, newPosition, easeProgress);
      
      if (progress < 1) {
        requestAnimationFrame(teleportAnimation);
      } else {
        // Play teleport sound
        playMovementSound();
      }
    }
    
    requestAnimationFrame(teleportAnimation);
  }
}

// Update teleportation line in animation loop
function updateTeleportation() {
  if (!isVRActive || !isTeleporting || !controller1) return;
  
  const raycaster = new THREE.Raycaster();
  raycaster.setFromXRController(controller1);
  
  // Raycast to find teleportation target
  const intersects = raycaster.intersectObjects([floor], false);
  
  if (intersects.length > 0) {
    const point = intersects[0].point;
    const distance = controller1.position.distanceTo(point);
    
    if (distance <= 10) { // Max teleportation distance
      // Update teleportation line
      const geometry = new THREE.BufferGeometry().setFromPoints([
        controller1.position,
        point
      ]);
      teleportLine.geometry.dispose();
      teleportLine.geometry = geometry;
      
      // Update target position
      teleportTarget.position.copy(point);
      teleportTarget.visible = true;
    } else {
      teleportTarget.visible = false;
    }
  } else {
    teleportTarget.visible = false;
  }
}

// Interactive PC functions
function setupPCInteractions() {
  // Add power button functionality to PC model
  if (pcModel) {
    pcModel.userData.isInteractive = true;
    pcModel.userData.isPC = true;
    
    // Add click event for power button
    pcModel.addEventListener('click', togglePCPower);
  }
  
  // Create RGB lights for PC components
  createPCLights();
  
  // Create spinning fans
  createSpinningFans();
}

function togglePCPower() {
  isPCPowered = !isPCPowered;
  console.log('PC Power:', isPCPowered ? 'ON' : 'OFF');
  
  // Play power sound
  playMovementSound();
  
  // Update PC lights
  updatePCLights();
  
  // Update fan animation
  updateFanAnimation();
  
  // Show power status
  const hudResult = document.getElementById('hud-result');
  if (hudResult) {
    hudResult.innerHTML = `
      <div style="background: ${isPCPowered ? 'rgba(0,255,0,0.8)' : 'rgba(255,0,0,0.8)'}; color: white; padding: 10px; border-radius: 5px; margin: 10px;">
        <strong>PC Power: ${isPCPowered ? 'ON' : 'OFF'}</strong>
        ${isPCPowered ? '🟢 System Running' : '🔴 System Shutdown'}
      </div>
    `;
    
    setTimeout(() => {
      hudResult.innerHTML = '';
    }, 3000);
  }
}

function createPCLights() {
  // Create RGB lights around the PC
  const lightPositions = [
    { x: 0, y: 1, z: 0 }, // Top
    { x: -1, y: 0.5, z: 0 }, // Left
    { x: 1, y: 0.5, z: 0 }, // Right
    { x: 0, y: 0.5, z: -1 }, // Front
    { x: 0, y: 0.5, z: 1 } // Back
  ];
  
  lightPositions.forEach((pos, index) => {
    const light = new THREE.PointLight(0x00ff00, 0.5, 10);
    light.position.set(pos.x, pos.y, pos.z);
    light.visible = false; // Start off
    scene.add(light);
    pcLights.push(light);
  });
}

function updatePCLights() {
  pcLights.forEach((light, index) => {
    if (isPCPowered) {
      light.visible = true;
      // Create RGB cycling effect
      const hue = (performance.now() * 0.001 + index * 0.2) % 1;
      const color = new THREE.Color().setHSL(hue, 0.8, 0.6);
      light.color.copy(color);
    } else {
      light.visible = false;
    }
  });
}

function createSpinningFans() {
  // Create fan meshes (simple representation)
  for (let i = 0; i < 3; i++) {
    const fanGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.02, 8);
    const fanMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x333333,
      metalness: 0.8,
      roughness: 0.2
    });
    const fan = new THREE.Mesh(fanGeometry, fanMaterial);
    
    // Position fans around the PC
    fan.position.set(
      (i - 1) * 0.5,
      0.3,
      -0.5
    );
    fan.rotation.x = Math.PI / 2;
    scene.add(fan);
    fanMeshes.push(fan);
  }
}

function updateFanAnimation() {
  if (isPCPowered) {
    fanMeshes.forEach((fan, index) => {
      fan.rotation.z += 0.1 * (index + 1); // Different speeds for each fan
    });
  }
}

// Component inspection functions
function enterInspectionMode(component) {
  if (inspectionMode) return;
  
  inspectionMode = true;
  inspectedComponent = component;
  
  console.log('Entering inspection mode for:', component.userData.name || 'Unknown component');
  
  // Disable camera controls
  if (controls) {
    controls.enabled = false;
  }
  
  // Show inspection UI
  const hudResult = document.getElementById('hud-result');
  if (hudResult) {
    hudResult.innerHTML = `
      <div style="background: rgba(0,0,0,0.9); color: white; padding: 20px; border-radius: 10px; margin: 10px; max-width: 400px;">
        <h3>🔍 Component Inspection</h3>
        <p><strong>Name:</strong> ${component.userData.name || 'Unknown'}</p>
        <p><strong>Type:</strong> ${component.userData.type || 'Unknown'}</p>
        <p><strong>Brand:</strong> ${component.userData.brand || 'Unknown'}</p>
        <p><strong>Status:</strong> ${component.userData.installed ? 'Installed' : 'Available'}</p>
        <div style="margin-top: 15px;">
          <button onclick="exitInspectionMode()" style="padding: 8px 16px; margin-right: 10px; background: #ff4444; color: white; border: none; border-radius: 5px; cursor: pointer;">Exit Inspection</button>
          <button onclick="rotateComponent()" style="padding: 8px 16px; background: #4444ff; color: white; border: none; border-radius: 5px; cursor: pointer;">Rotate</button>
        </div>
      </div>
    `;
  }
  
  // Play inspection sound
  playMovementSound();
}

function exitInspectionMode() {
  if (!inspectionMode) return;
  
  inspectionMode = false;
  inspectedComponent = null;
  
  console.log('Exiting inspection mode');
  
  // Re-enable camera controls
  if (controls) {
    controls.enabled = true;
  }
  
  // Hide inspection UI
  const hudResult = document.getElementById('hud-result');
  if (hudResult) {
    hudResult.innerHTML = '';
  }
}

function rotateComponent() {
  if (!inspectedComponent) return;
  
  // Add rotation animation
  inspectedComponent.rotation.y += Math.PI / 4; // 45 degrees
  playMovementSound();
  
  console.log('Rotating component');
}

// Make functions globally accessible
window.exitInspectionMode = exitInspectionMode;
window.rotateComponent = rotateComponent;

// Room lighting control functions
function setupRoomLighting() {
  // Find and store references to main room lights
  scene.traverse((child) => {
    if (child.isLight) {
      // Store directional lights and spot lights as main room lights
      if (child.type === 'DirectionalLight' || child.type === 'SpotLight') {
        mainRoomLights.push(child);
      }
      // Store ambient light reference
      if (child.type === 'AmbientLight') {
        ambientLight = child;
      }
    }
  });
  
  // Create accent lights for dim mode
  createAccentLights();
  
  console.log('Room lighting setup complete. Found lights:', mainRoomLights.length);
}

function createAccentLights() {
  // Create subtle accent lights for dim mode
  const accentPositions = [
    { x: -3, y: 2, z: 0, color: 0xff4444 }, // Red accent
    { x: 3, y: 2, z: 0, color: 0x4444ff }, // Blue accent
    { x: 0, y: 2, z: -3, color: 0x44ff44 }, // Green accent
    { x: 0, y: 2, z: 3, color: 0xffff44 }  // Yellow accent
  ];
  
  accentPositions.forEach((pos, index) => {
    const light = new THREE.PointLight(pos.color, 0.3, 8);
    light.position.set(pos.x, pos.y, pos.z);
    light.visible = false; // Start off
    light.castShadow = true;
    scene.add(light);
    accentLights.push(light);
  });
}

function toggleRoomLights() {
  roomLightsOn = !roomLightsOn;
  console.log('Room lights:', roomLightsOn ? 'ON' : 'OFF');
  
  // Play sound feedback
  playMovementSound();
  
  // Update main room lights
  mainRoomLights.forEach(light => {
    light.visible = roomLightsOn;
  });
  
  // Update accent lights (opposite of main lights)
  accentLights.forEach(light => {
    light.visible = !roomLightsOn;
  });
  
  // Update ambient light intensity
  if (ambientLight) {
    ambientLight.intensity = roomLightsOn ? 0.4 : 0.1; // Dim ambient when lights off
  }
  
  // Show lighting status
  const hudResult = document.getElementById('hud-result');
  if (hudResult) {
    hudResult.innerHTML = `
      <div style="background: ${roomLightsOn ? 'rgba(255,255,0,0.8)' : 'rgba(100,100,100,0.8)'}; color: white; padding: 10px; border-radius: 5px; margin: 10px;">
        <strong>Room Lights: ${roomLightsOn ? 'ON' : 'OFF'}</strong>
        ${roomLightsOn ? '💡 Room Illuminated' : '🌙 Dim Mode with Accent Lighting'}
      </div>
    `;
    
    setTimeout(() => {
      hudResult.innerHTML = '';
    }, 3000);
  }
  
  // Update button text
  const btnRoomLights = document.getElementById('btn-room-lights');
  if (btnRoomLights) {
    btnRoomLights.textContent = roomLightsOn ? '💡 Room Lights' : '🌙 Room Lights';
  }
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x7a7a7a, 1);
renderer.xr.enabled = true;
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

// Count total assets for loading progress
totalAssets = 1 + // HDR environment
  6 + // PC component models (cpu, gpu, ram, motherboard, storage, psu)
  3 + // Room decoration models (kirby, pacman, shelf)
  1 + // Gaming chair
  1 + // Aorus PC
  3 + // Textures (wall, floor, ceiling)
  3; // Posters

console.log(`Total assets to load: ${totalAssets}`);

const rgbeLoader = new RGBELoader();
rgbeLoader.load("/static/textures/bg.hdr", (bg) => {
  bg.mapping = THREE.EquirectangularReflectionMapping;
  // Keep HDR for reflections/lighting but not as visible skybox
  scene.environment = bg;
  updateLoadingProgress("Environment");
}, undefined, (error) => {
  console.error('Error loading HDR:', error);
  updateLoadingProgress("Environment (failed)");
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

// Create wall texture
const wallTexture = new THREE.TextureLoader().load('/static/textures/wall_texture.jpg');
wallTexture.wrapS = THREE.RepeatWrapping;
wallTexture.wrapT = THREE.RepeatWrapping;
wallTexture.repeat.set(4, 2); // Repeat texture 4 times horizontally, 2 times vertically

const roomMat = new THREE.MeshStandardMaterial({
  map: wallTexture,
  color: 0xf5f5f5, // Slightly lighter base color
  roughness: 0.8,
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

// Professional Cabinet Design
const cabinetSize = new THREE.Vector3(1.6, 1.8, 0.8);
const cabinetGroup = new THREE.Group();
cabinetGroup.position.set(-ROOM_W / 2 + 5, 0.9, -1.0);

// Cabinet frame (dark metal) - only the outer frame
const frameThickness = 0.1;
const frameGeo = new THREE.BoxGeometry(cabinetSize.x, cabinetSize.y, cabinetSize.z);
const frameMat = new THREE.MeshStandardMaterial({
  color: 0x2a2a2a,
  roughness: 0.3,
  metalness: 0.8,
  transparent: true,
  opacity: 0.3, // Make the entire cabinet transparent
});
const frame = new THREE.Mesh(frameGeo, frameMat);
frame.castShadow = true;
frame.receiveShadow = true;
cabinetGroup.add(frame);

// Glass front panel
const glassGeo = new THREE.BoxGeometry(cabinetSize.x - 0.05, cabinetSize.y - 0.1, 0.02);
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x88ccff,
  roughness: 0.0,
  metalness: 0.1,
  transparent: true,
  opacity: 0.3,
});
const glass = new THREE.Mesh(glassGeo, glassMat);
glass.position.set(0, 0, cabinetSize.z / 2 + 0.01);
glass.castShadow = false;
glass.receiveShadow = false;
cabinetGroup.add(glass);

// Metal trim around glass
const trimGeo = new THREE.BoxGeometry(cabinetSize.x - 0.02, cabinetSize.y - 0.05, 0.04);
const trimMat = new THREE.MeshStandardMaterial({
  color: 0x444444,
  roughness: 0.2,
  metalness: 0.9,
});
const trim = new THREE.Mesh(trimGeo, trimMat);
trim.position.set(0, 0, cabinetSize.z / 2 + 0.02);
trim.castShadow = true;
trim.receiveShadow = true;
cabinetGroup.add(trim);

// Interior lighting strips
const lightStripGeo = new THREE.BoxGeometry(0.02, cabinetSize.y - 0.2, 0.01);
const lightStripMat = new THREE.MeshBasicMaterial({
  color: 0x00ffff,
  transparent: true,
  opacity: 0.8,
});
const leftLight = new THREE.Mesh(lightStripGeo, lightStripMat);
leftLight.position.set(-cabinetSize.x / 2 + 0.1, 0, cabinetSize.z / 2 - 0.05);
cabinetGroup.add(leftLight);

const rightLight = new THREE.Mesh(lightStripGeo, lightStripMat);
rightLight.position.set(cabinetSize.x / 2 - 0.1, 0, cabinetSize.z / 2 - 0.05);
cabinetGroup.add(rightLight);

// Cabinet feet
const footGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8);
const footMat = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a,
  roughness: 0.4,
  metalness: 0.7,
});
const footPositions = [
  { x: -cabinetSize.x / 2 + 0.1, z: -cabinetSize.z / 2 + 0.1 },
  { x: cabinetSize.x / 2 - 0.1, z: -cabinetSize.z / 2 + 0.1 },
  { x: -cabinetSize.x / 2 + 0.1, z: cabinetSize.z / 2 - 0.1 },
  { x: cabinetSize.x / 2 - 0.1, z: cabinetSize.z / 2 - 0.1 }
];
footPositions.forEach(pos => {
  const foot = new THREE.Mesh(footGeo, footMat);
  foot.position.set(pos.x, -cabinetSize.y / 2 - 0.05, pos.z);
  foot.castShadow = true;
  foot.receiveShadow = true;
  cabinetGroup.add(foot);
});

// Add cabinet group to scene
scene.add(cabinetGroup);
const cabinet = cabinetGroup; // Keep reference for compatibility

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
      console.log('G key pressed, hits found:', hits.length, 'selectableMeshes:', selectableMeshes.length);
      if (hits.length) {
        const picked = hits[0];
        const sourceMesh = picked.object;
        console.log('Picked object:', sourceMesh.userData);
        dragState.dragging = true;
        dragState.sourceMesh = sourceMesh;
        // Horizontal plane at pick height
        dragState.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -picked.point.y);
        // Ghost - more visible when dragging
        const ghostSize = new THREE.Vector3(0.8, 0.4, 0.4);
        const ghostLabel = `${sourceMesh.userData.category.toUpperCase()}\n${sourceMesh.userData.item.name}`;
        dragState.ghost = createLabeledBox(
          ghostSize,
          ghostLabel,
          categoryColor[sourceMesh.userData.category]
        );
        dragState.ghost.material.transparent = true;
        dragState.ghost.material.opacity = 0.8; // More visible when dragging
        dragState.ghost.material.wireframe = true; // Wireframe outline
        dragState.ghost.castShadow = false;
        dragState.ghost.receiveShadow = false;
        dragState.ghost.position.copy(picked.point);
        scene.add(dragState.ghost);
        // Play grab sound
        playMovementSound();
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
          // Play placement sound
          playMovementSound();
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
      // Play movement sound when moving
      playMovementSound();
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
  
  // Update VR teleportation
  updateTeleportation();
  
  // Update interactive PC elements
  updatePCLights();
  updateFanAnimation();
  
  // VR rendering - Three.js handles VR automatically when xr.enabled = true
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

// Professional Shelf System
const shelfRoot = new THREE.Group();
scene.add(shelfRoot);

// Component labels for identification
const componentLabels = {
  cpu: "CPU",
  gpu: "GPU", 
  ram: "RAM",
  motherboard: "Motherboard",
  storage: "Storage",
  psu: "Power Supply"
};

// Function to create component labels
function createComponentLabel(text, position, category) {
  // Calculate label width based on text length
  const textLength = text.length;
  const labelWidth = Math.max(1.5, textLength * 0.1); // Larger labels
  
  // Create label background - make it more visible
  const labelGeo = new THREE.PlaneGeometry(labelWidth, 0.4);
  const labelMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.9
  });
  const labelBg = new THREE.Mesh(labelGeo, labelMat);
  labelBg.position.copy(position);
  labelBg.position.y += 0.6; // Higher above the component
  labelBg.position.z += 0.2; // More in front
  
  // Create text background for better readability
  const textBgGeo = new THREE.PlaneGeometry(labelWidth - 0.1, 0.35);
  const textBgMat = new THREE.MeshBasicMaterial({
    color: 0x333333,
    transparent: true,
    opacity: 0.95
  });
  const textBg = new THREE.Mesh(textBgGeo, textBgMat);
  textBg.position.copy(labelBg.position);
  textBg.position.z += 0.001;
  
  // Create text representation - make it more visible
  const textGeo = new THREE.PlaneGeometry(labelWidth - 0.2, 0.3);
  const textMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1.0
  });
  const textMesh = new THREE.Mesh(textGeo, textMat);
  textMesh.position.copy(textBg.position);
  textMesh.position.z += 0.001;
  
  // Add category color accent
  const accentGeo = new THREE.PlaneGeometry(0.08, 0.35);
  const accentMat = new THREE.MeshBasicMaterial({
    color: categoryColor[category] || 0x888888,
    transparent: true,
    opacity: 0.9
  });
  const accent = new THREE.Mesh(accentGeo, accentMat);
  accent.position.set(labelBg.position.x - labelWidth/2 + 0.08, labelBg.position.y, labelBg.position.z + 0.002);
  
  // Create label group
  const labelGroup = new THREE.Group();
  labelGroup.add(labelBg);
  labelGroup.add(textBg);
  labelGroup.add(textMesh);
  labelGroup.add(accent);
  labelGroup.userData.isLabel = true;
  labelGroup.userData.category = category;
  labelGroup.userData.text = text;
  
  // Make sure labels are always visible
  labelGroup.visible = true;
  
  // Store reference for camera-facing updates
  labelGroup.updateLabel = function() {
    const cameraPosition = camera.position.clone();
    labelBg.lookAt(cameraPosition);
    textBg.lookAt(cameraPosition);
    textMesh.lookAt(cameraPosition);
    accent.lookAt(cameraPosition);
  };
  
  console.log('Created label for:', text, 'at position:', position); // Debug log
  
  return labelGroup;
}

// Function to update all component labels to face camera
function updateComponentLabels() {
  scene.traverse((child) => {
    if (child.userData && child.userData.isLabel && child.updateLabel) {
      child.updateLabel();
    }
  });
}

const shelfWidth = 8.0; // Increased from 6.0
const shelfDepth = 0.8; // Increased from 0.6
const shelves = 3;
const shelfStartY = 0.7;
const shelfGapY = 0.65;
const shelfClearance = 0.6;
const shelfHalf = shelfWidth / 2;
const shelfCenterX = -ROOM_W / 2 + shelfHalf + shelfClearance;
const shelfZ = -ROOM_D / 2 + shelfDepth / 2 + 1.0;

// Modern metal posts with brushed finish
const postMat = new THREE.MeshStandardMaterial({ 
  color: 0x333333, 
  roughness: 0.2, 
  metalness: 0.8 
});
const postGeo = new THREE.CylinderGeometry(0.08, 0.08, shelves * shelfGapY + 0.6, 16);
const postY = shelfStartY + (shelves - 1) * shelfGapY * 0.5;
const postOffsets = [-shelfHalf + 0.15, shelfHalf - 0.15];

postOffsets.forEach((ox) => {
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.set(shelfCenterX + ox, postY, shelfZ);
  post.castShadow = true;
  post.receiveShadow = true;
  shelfRoot.add(post);
});

// High-quality wooden shelves with metal trim
const boardMat = new THREE.MeshStandardMaterial({ 
  color: 0x8B4513, 
  roughness: 0.6, 
  metalness: 0.1 
});
for (let i = 0; i < shelves; i++) {
  const y = shelfStartY + i * shelfGapY;
  
  // Main wooden shelf
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(shelfWidth, 0.08, shelfDepth),
    boardMat
  );
  board.position.set(shelfCenterX, y, shelfZ);
  board.castShadow = true;
  board.receiveShadow = true;
  shelfRoot.add(board);
  
  // Metal trim on front edge
  const trimGeo = new THREE.BoxGeometry(shelfWidth, 0.02, 0.02);
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.1,
    metalness: 0.9
  });
  const frontTrim = new THREE.Mesh(trimGeo, trimMat);
  frontTrim.position.set(shelfCenterX, y, shelfZ + shelfDepth / 2 + 0.01);
  frontTrim.castShadow = true;
  frontTrim.receiveShadow = true;
  shelfRoot.add(frontTrim);
  
  // LED strip lighting under each shelf
  const ledGeo = new THREE.BoxGeometry(shelfWidth - 0.2, 0.01, 0.01);
  const ledMat = new THREE.MeshBasicMaterial({
    color: 0x00aaff,
    transparent: true,
    opacity: 0.8
  });
  const ledStrip = new THREE.Mesh(ledGeo, ledMat);
  ledStrip.position.set(shelfCenterX, y - 0.05, shelfZ + shelfDepth / 2 - 0.01);
  shelfRoot.add(ledStrip);
}

// Professional back panel with texture
const backPanel = new THREE.Mesh(
  new THREE.PlaneGeometry(shelfWidth + 0.4, shelves * shelfGapY + 0.6),
  new THREE.MeshStandardMaterial({ 
    color: 0x2a2a2a, 
    roughness: 0.3, 
    metalness: 0.6 
  })
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
  const colGap = 2.5; // Increased from 2.0 for more space
  const rowGap = 0.45; // Increased from 0.38 for more space
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
        startX + (col - 1) * 1.2, // Increased from 1.05 for more spacing
        y + (row ? -rowGap : 0) + verticalOffset,
        shelfZ
      );

      // Load 3D models for all components
      const modelPaths = {
        cpu: '/models/cpu.glb',
        gpu: '/models/gpu.glb', 
        ram: '/models/ram.glb',
        motherboard: '/models/motherboard.glb',
        storage: '/models/storage.glb',
        psu: '/models/Psu.glb' // Note: using Psu.glb (capital P)
      };

      const modelPath = modelPaths[category];
      if (modelPath) {
        gltfLoader.load(modelPath, (gltf) => {
          const componentModel = gltf.scene;
          componentModel.position.copy(position);
          
          // Scale models appropriately for each category
          const scales = {
            cpu: new THREE.Vector3(0.001, 0.001, 0.001),        // CPUs are small
            gpu: new THREE.Vector3(0.02, 0.02, 0.02),        // GPUs are medium-large
            ram: new THREE.Vector3(0.3, 0.3, 0.3),        // RAM sticks are medium
            motherboard: new THREE.Vector3(0.5, 0.5, 0.5),  // Motherboards are large
            storage: new THREE.Vector3(0.01, 0.01, 0.01),    // Storage drives are small-medium
            psu: new THREE.Vector3(0.015, 0.015, 0.015)         // PSUs are large
          };
          
          componentModel.scale.copy(scales[category] || new THREE.Vector3(0.4, 0.4, 0.4));
          componentModel.userData = { category, id: item.id, item };
          
          componentModel.traverse((node) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });
          
          spawnRoot.add(componentModel);
          
          // Component labels removed for cleaner interface
          
          // Create grab box for easier interaction
          const grabBoxSize = new THREE.Vector3(0.8, 0.4, 0.4); // Larger, easier to click
          const grabBox = createLabeledBox(grabBoxSize, '', categoryColor[category]); // Colored box
          grabBox.material.transparent = true;
          grabBox.material.opacity = 0.1; // Very subtle visibility
          grabBox.material.wireframe = true; // Wireframe outline
          grabBox.position.copy(position);
          grabBox.userData = { category, id: item.id, item };
          grabBox.castShadow = false;
          grabBox.receiveShadow = false;
          spawnRoot.add(grabBox);
          
          // Add the invisible grab box to selectable meshes instead of the model
          selectableMeshes.push(grabBox);
          console.log(`Added ${category} grab box to selectableMeshes. Total:`, selectableMeshes.length);
          
          if (category === 'ram') ramDisplayInstances++;
          
          // Update loading progress
          updateLoadingProgress(`${category.toUpperCase()} Component`);
        }, undefined, (error) => {
          console.error(`Error loading ${category} model:`, error);
          // Fallback to labeled box if GLTF fails
          const label = `${category.toUpperCase()}\n${item.name}`;
          const box = createLabeledBox(itemSize, label, categoryColor[category]);
          box.position.copy(position);
          box.userData = { category, id: item.id, item };
          box.castShadow = true;
          box.receiveShadow = true;
          spawnRoot.add(box);
          selectableMeshes.push(box);
          console.log(`Added ${category} fallback box to selectableMeshes. Total:`, selectableMeshes.length);
        });
      } else {
        // Fallback to box if no model path defined
        const label = `${category.toUpperCase()}\n${item.name}`;
        const box = createLabeledBox(itemSize, label, categoryColor[category]);
        box.position.copy(position);
        box.userData = { category, id: item.id, item };
        box.castShadow = true;
        box.receiveShadow = true;
        spawnRoot.add(box);
        selectableMeshes.push(box);
        console.log(`Added ${category} no-model box to selectableMeshes. Total:`, selectableMeshes.length);
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
  if (sourceMesh.geometry && sourceMesh.material) {
    // Clone the GLTF model for placement
    placed = sourceMesh.clone();
    
    // Scale models appropriately for cabinet placement
    const cabinetScales = {
      cpu: new THREE.Vector3(0.2, 0.2, 0.2),        // Visible in cabinet
      gpu: new THREE.Vector3(0.3, 0.3, 0.3),        // Visible in cabinet
      ram: new THREE.Vector3(0.4, 0.4, 0.4),        // Visible in cabinet
      motherboard: new THREE.Vector3(0.5, 0.5, 0.5),  // Visible in cabinet
      storage: new THREE.Vector3(0.3, 0.3, 0.3),    // Visible in cabinet
      psu: new THREE.Vector3(0.4, 0.4, 0.4)         // Visible in cabinet
    };
    
    placed.scale.copy(cabinetScales[category] || new THREE.Vector3(0.3, 0.3, 0.3));
  } else {
    // Fallback to boxes if no 3D model
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
    
    // Check for double-click on components
    if (event.detail === 2) { // Double-click
      let hits = raycaster.intersectObjects(selectableMeshes, true);
      if (hits.length) {
        const selectedObject = hits[0].object;
        if (selectedObject.userData.isComponent) {
          enterInspectionMode(selectedObject);
          return;
        }
      }
    }
    
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

// Setup room lighting controls
setupRoomLighting();

// Check if all assets are loaded and hide loading screen
setTimeout(() => {
  if (loadedAssets >= totalAssets) {
    hideLoadingScreen();
  } else {
    // Force hide after 10 seconds regardless
    console.log('Forcing loading screen to hide after timeout');
    hideLoadingScreen();
  }
}, 10000);

// Handle resize for smoother visuals
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const btnReset = document.getElementById("btn-reset");
const btnAudio = document.getElementById("btn-audio");
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
    // Play reset sound
    playMovementSound();
  });
}

if (btnAudio) {
  btnAudio.addEventListener("click", () => {
    console.log('Audio button clicked');
    console.log('Background music state:', backgroundMusic ? {
      paused: backgroundMusic.paused,
      readyState: backgroundMusic.readyState,
      currentTime: backgroundMusic.currentTime,
      volume: backgroundMusic.volume
    } : 'null');
    
    if (!backgroundMusic) {
      console.log('Background music not loaded yet');
      return;
    }
    
    // Try to play background music on first click
    if (backgroundMusic.paused) {
      console.log('Attempting to play background music...');
      backgroundMusic.play().then(() => {
        console.log('Background music started successfully');
        isAudioEnabled = true;
        btnAudio.textContent = "🔊 Audio";
      }).catch((error) => {
        console.error('Failed to start background music:', error);
        isAudioEnabled = false;
        btnAudio.textContent = "🔇 Audio";
      });
    } else {
      console.log('Pausing background music...');
      backgroundMusic.pause();
      isAudioEnabled = false;
      btnAudio.textContent = "🔇 Audio";
    }
  });
}

// VR Button event listener
const btnVR = document.getElementById('btn-vr');
if (btnVR) {
  btnVR.addEventListener("click", () => {
    console.log('VR button clicked');
    if (!isVRActive) {
      setupVR();
      btnVR.textContent = "🥽 VR Ready";
      
      // Show VR instructions
      const hudResult = document.getElementById('hud-result');
      if (hudResult) {
        hudResult.innerHTML = `
          <div style="background: rgba(0,0,0,0.8); color: white; padding: 15px; border-radius: 10px; margin: 10px;">
            <h3>🥽 VR Controls:</h3>
            <p><strong>Left Controller:</strong> Point & press trigger to teleport</p>
            <p><strong>Right Controller:</strong> Point & press trigger to grab components</p>
            <p><strong>Squeeze grip:</strong> Alternative grab method</p>
            <p>Click the VR button (bottom-left) to enter VR mode</p>
          </div>
        `;
        
        // Hide instructions after 10 seconds
        setTimeout(() => {
          hudResult.innerHTML = '';
        }, 10000);
      }
    } else {
      console.log('VR already active');
    }
  });
}

// PC Power Button event listener
const btnPCPower = document.getElementById('btn-pc-power');
if (btnPCPower) {
  btnPCPower.addEventListener("click", () => {
    console.log('PC Power button clicked');
    togglePCPower();
    btnPCPower.textContent = isPCPowered ? "🖥️ Shutdown PC" : "🖥️ Power PC";
  });
}

// Room Lights Button event listener
const btnRoomLights = document.getElementById('btn-room-lights');
if (btnRoomLights) {
  btnRoomLights.addEventListener("click", () => {
    console.log('Room Lights button clicked');
    toggleRoomLights();
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

// 1. Floor texture for the entire room
const floorGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
const floorTexture = new THREE.TextureLoader().load('/static/textures/floor_texture.jpg');
floorTexture.wrapS = THREE.RepeatWrapping;
floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set(8, 8); // Repeat texture across the floor
floorTexture.colorSpace = THREE.SRGBColorSpace;

const floorMat = new THREE.MeshStandardMaterial({ 
  map: floorTexture, 
  roughness: 0.7, 
  metalness: 0.0 
});
floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2; // Lie flat on the floor
floor.position.set(0, 0.01, 0); // Cover the entire floor
floor.receiveShadow = true;
scene.add(floor);

// 3. Ceiling texture
const ceilingGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
const ceilingTexture = new THREE.TextureLoader().load('/static/textures/ceiling_texture.jpg');
ceilingTexture.wrapS = THREE.RepeatWrapping;
ceilingTexture.wrapT = THREE.RepeatWrapping;
ceilingTexture.repeat.set(6, 6); // Repeat texture across the ceiling
ceilingTexture.colorSpace = THREE.SRGBColorSpace;

const ceilingMat = new THREE.MeshStandardMaterial({ 
  map: ceilingTexture, 
  roughness: 0.9, 
  metalness: 0.0 
});
const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
ceiling.rotation.x = Math.PI / 2; // Face downward
ceiling.position.set(0, ROOM_H - 0.01, 0); // At the top of the room
ceiling.receiveShadow = true;
scene.add(ceiling);

// Entrance mat removed

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

// Add posters to the walls
// Poster 1 - On the back wall, above the cabinet/shelf area
createPoster(shelfCenterX + 3, ROOM_H - 1.5, shelfZ - shelfDepth / 2 - 0.03, 0, '/static/textures/poster1.jpg', 2.5, 1.8);
// Poster 2 - On the right wall
createPoster(ROOM_W / 2 - 0.05, ROOM_H - 2, 0, -Math.PI / 2, '/static/textures/poster2.jpg', 3, 2);
// Poster 3 - On the left wall
createPoster(-ROOM_W / 2 + 0.05, ROOM_H - 2.5, 5, Math.PI / 2, '/static/textures/poster3.jpg', 2.8, 2);


// 3. Display Table - Modern black bar design
const displayTableGroup = new THREE.Group();
displayTableGroup.position.set(0, 0.5, 2);

// Create 4 black bars for the table
const barPositions = [
  { x: -1.2, y: 0, z: -0.6 }, // Front left
  { x: 1.2, y: 0, z: -0.6 },  // Front right
  { x: -1.2, y: 0, z: 0.6 },  // Back left
  { x: 1.2, y: 0, z: 0.6 }    // Back right
];

barPositions.forEach((pos, index) => {
  const barGeo = new THREE.BoxGeometry(0.1, 1.0, 0.1);
  const barMat = new THREE.MeshStandardMaterial({ 
    color: 0x222222, 
    roughness: 0.3, 
    metalness: 0.8 
  });
  const bar = new THREE.Mesh(barGeo, barMat);
  bar.position.set(pos.x, pos.y, pos.z);
  bar.castShadow = true;
  bar.receiveShadow = true;
  displayTableGroup.add(bar);
});

// Add a thin black top surface
const topGeo = new THREE.BoxGeometry(2.4, 0.05, 1.2);
const topMat = new THREE.MeshStandardMaterial({ 
  color: 0x333333, 
  roughness: 0.2, 
  metalness: 0.9 
});
const tableTop = new THREE.Mesh(topGeo, topMat);
tableTop.position.set(0, 0.525, 0); // Slightly above the bars
tableTop.castShadow = true;
tableTop.receiveShadow = true;
displayTableGroup.add(tableTop);

// Add the table group to scene
scene.add(displayTableGroup);

// Load PC model on the table
console.log('Loading PC model...');
gltfLoader.load('/models/aoruspcmaterials applied.glb', (gltf) => {
  console.log('PC model loaded successfully!', gltf);
  pcModel = gltf.scene; // Set global reference
  pcModel.position.set(0.3, 1.1, 2.2); // On the table
  pcModel.scale.set(0.2, 0.2, 0.2); // Adjust scale as needed
  pcModel.rotation.y = 4.7; // Rotate to face forward
  
  // Enable shadows for all meshes in the model
  pcModel.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  
  scene.add(pcModel);
  console.log('PC model added to scene at position:', pcModel.position);
  
  // Setup PC interactions after model is loaded
  setupPCInteractions();
  
  updateLoadingProgress("Aorus PC");
}, undefined, (error) => {
  console.error('Error loading PC model:', error);
  // Fallback to simple box if GLTF fails
  console.log('Using fallback box instead');
  const fallbackGeo = new THREE.BoxGeometry(0.6, 0.4, 0.3);
  const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.2 });
  const fallbackPC = new THREE.Mesh(fallbackGeo, fallbackMat);
  fallbackPC.position.set(0, 1.0, 2.7);
  fallbackPC.castShadow = true;
  fallbackPC.receiveShadow = true;
  scene.add(fallbackPC);
  updateLoadingProgress("Aorus PC (fallback)");
});

// 4. Gaming Chair on top of the PC
console.log('Loading gaming chair...');
gltfLoader.load('/models/gaming-chair.glb', (gltf) => {
  console.log('Gaming chair loaded successfully!', gltf);
  const chair = gltf.scene;
  chair.position.set(0.5, 0.1, 3.5); // On top of the PC
  chair.scale.set(0.35, 0.35, 0.35); // Normal scale
  chair.rotation.y = 4.7; // Face forward initially
  
  // Enable shadows for all meshes in the chair
  chair.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  
  scene.add(chair);
  console.log('Gaming chair added to scene at position:', chair.position);
  console.log('Chair scale:', chair.scale);
}, (progress) => {
  console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
}, (error) => {
  console.error('Error loading gaming chair:', error);
  // Fallback to simple box if GLTF fails
  console.log('Using fallback chair box instead');
  const chairGeo = new THREE.BoxGeometry(2.0, 2.0, 2.0); // Much larger box
  const chairMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.9 }); // Bright red color
const chair = new THREE.Mesh(chairGeo, chairMat);
  chair.position.set(0.3, 1.1, 2.2); // Same position as your chair
  chair.rotation.y = 4.7; // Same rotation as your chair
chair.castShadow = true;
chair.receiveShadow = true;
scene.add(chair);
  console.log('Fallback chair added at position:', chair.position);
});


const sideTableGeo = new THREE.BoxGeometry(0.7, 0.6, 0.7);
const sideTableMat = new THREE.MeshStandardMaterial({ color: 0xededed, roughness: 0.6 });
const sideTable = new THREE.Mesh(sideTableGeo, sideTableMat);
sideTable.position.set(ROOM_W / 2 - 3, 0.3, -ROOM_D / 2 + 2); // Beside the chair
sideTable.castShadow = true;
sideTable.receiveShadow = true;
scene.add(sideTable);

// Small decorative elements removed

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

// Add arcade machines and decorative elements
console.log('Loading room decorations...');
console.log('Scene children count:', scene.children.length);

// 1. Kirby Arcade Machine
gltfLoader.load('/models/kirby_arcade.glb', (gltf) => {
  console.log('Kirby arcade loaded successfully!');
  const kirbyArcade = gltf.scene;
  kirbyArcade.position.set(ROOM_W / 2 - 2, 0, -ROOM_D / 2 + 2); // Corner placement
  kirbyArcade.scale.set(0.15, 0.15, 0.15);
  kirbyArcade.rotation.y = 0; // Angled for better view
  
  kirbyArcade.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  
  scene.add(kirbyArcade);
}, undefined, (error) => {
  console.error('Error loading Kirby arcade:', error);
});

// 2. Pac-Man Arcade Machine
gltfLoader.load('/models/pacman_arcade.glb', (gltf) => {
  console.log('Pac-Man arcade loaded successfully!');
  const pacmanArcade = gltf.scene;
  pacmanArcade.position.set(-ROOM_W / 2 + 2, 0, ROOM_D / 2 - 2); // Opposite corner
  pacmanArcade.scale.set(0.05, 0.05, 0.05);
  pacmanArcade.rotation.y = -4; // Angled for better view
  
  pacmanArcade.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  
  scene.add(pacmanArcade);
}, undefined, (error) => {
  console.error('Error loading Pac-Man arcade:', error);
});

// 3. Additional Shelf
gltfLoader.load('/models/shelf.glb', (gltf) => {
  console.log('Shelf loaded successfully!');
  const additionalShelf = gltf.scene;
  additionalShelf.position.set(ROOM_W / 2 - 1, 0, 2); // Near the display table
  additionalShelf.scale.set(1, 1, 1);
  additionalShelf.rotation.y = 4; // Face towards the center
  
  additionalShelf.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  
  scene.add(additionalShelf);
}, undefined, (error) => {
  console.error('Error loading shelf:', error);
});

// 4. Add some decorative lighting near the arcade machines
const arcadeLight1 = new THREE.PointLight(0xff6b6b, 1.5, 4); // Red light for Kirby
arcadeLight1.position.set(ROOM_W / 2 - 2, 2, -ROOM_D / 2 + 2);
arcadeLight1.castShadow = false;
scene.add(arcadeLight1);

const arcadeLight2 = new THREE.PointLight(0x4ecdc4, 1.5, 4); // Cyan light for Pac-Man
arcadeLight2.position.set(-ROOM_W / 2 + 2, 2, ROOM_D / 2 - 2);
arcadeLight2.castShadow = false;
scene.add(arcadeLight2);

// 5. Add some simple decorative elements (removed particles for now)

// --- End NEW OBJECTS AND PLACEMENT ---