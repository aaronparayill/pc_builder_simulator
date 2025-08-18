import * as THREE from "three";
import * as dat from "lil-gui";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";


const rgbeLoader = new RGBELoader();

rgbeLoader.load("/static/textures/bg.hdr", (bg) => {
  bg.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = bg;
  scene.environment = bg;
});
const gltfLoader = new GLTFLoader();
let model;
gltfLoader.load("/static/models/henry.gltf", (gltf) => {
  model = gltf.scene;

  model.scale.set(0.5, 0.5, 0.5);
  model.position.set(0, 0, 0);

  scene.add(model);

  function animateModel() {
    model.rotation.y += 0.01;
  }

  const oldAnimate = animate;
  animate = function () {
    oldAnimate();
    animateModel();
  };
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader();

const sampleTexture = textureLoader.load("/static/textures/image.jpg");

sampleTexture.colorSpace = THREE.SRGBColorSpace;

sampleTexture.magFilter = THREE.NearestFilter;

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ map: sampleTexture });
const mesh = new THREE.Mesh(geometry, material);
//scene.add(mesh);
const controls = new OrbitControls(camera, renderer.domElement);
camera.position.z = 4;

const hotspotData = [
  {
    title: "Panzer IV",
    desc: "The Panzer IV was a versatile medium tank, widely deployed on the Eastern Front. It balanced mobility, armor, and firepower.",
    img: "https://upload.wikimedia.org/wikipedia/commons/e/e1/Panzermuseum_Munster_2010_0128_b.jpg",
  },
  {
    title: "Panther Tank",
    desc: "The Panther was designed to counter Soviet T-34s, featuring sloped armor and a powerful 75mm gun, making it deadly at range.",
    img: "https://upload.wikimedia.org/wikipedia/commons/6/61/Bundesarchiv_Bild_183-H26258%2C_Panzer_V_%22Panther%22.jpg  ",
  },
  {
    title: "Tiger I",
    desc: "The Tiger I was a heavy tank with thick armor and an 88mm gun, feared by Soviet forces but expensive and slow to produce.",
    img: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Bundesarchiv_Bild_101I-299-1805-16%2C_Nordfrankreich%2C_Panzer_VI_%28Tiger_I%29.2.jpg",
  },
  {
    title: "Stug III Assault Gun",
    desc: "The StuG III was a cost-effective tank destroyer and infantry support vehicle, highly effective in defensive operations.",
    img: "https://upload.wikimedia.org/wikipedia/commons/1/18/SNC15697_%285853637442%29_b.jpg",
  },
];

function createHotspot(position, name, number) {
  const geometry = new THREE.SphereGeometry(0.2, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const hotspot = new THREE.Mesh(geometry, material);
  hotspot.position.copy(position);
  hotspot.name = name;
  hotspot.index = hotspotObjects.length;
  scene.add(hotspot);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 128;
  canvas.height = 128;

  ctx.fillStyle = "white";
  ctx.font = "bold 64px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(number, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });
  const sprite = new THREE.Sprite(spriteMaterial);

  sprite.scale.set(1, 1, 1);
  sprite.position.set(0, 0.5, 0);
  hotspot.add(sprite);

  return hotspot;
}

function getRandomPosition(range = 50) {
  const x = (Math.random() - 0.5) * 2 * range;
  const y = Math.random() * range * 0.5 + 1;
  const z = (Math.random() - 0.5) * 2 * range;
  return new THREE.Vector3(x, y, z);
}

const hotspotObjects = [];
for (let i = 0; i < hotspotData.length; i++) {
  const pos = getRandomPosition(20);
  hotspotObjects.push(createHotspot(pos, `spot${i + 1}`, `${i + 1}`, i));
}

let targetPosition = camera.position.clone();
let currentIndex = 0;

function getOffsetPosition(hotspot, offset = 2) {
  const pos = hotspot.position.clone();
  pos.x -= offset;

  return pos;
}

const listener = new THREE.AudioListener();
camera.add(listener);

const audioLoader = new THREE.AudioLoader();
const moveSound = new THREE.Audio(listener);

audioLoader.load("/static/sounds/swoosh.mp3", (buffer) => {
  moveSound.setBuffer(buffer);
  moveSound.setLoop(false); 
  moveSound.setVolume(0.5); 
});

const ambientSound = new THREE.Audio(listener);
audioLoader.load("/static/sounds/ambient.mp3", (buffer) => {
  ambientSound.setBuffer(buffer);
  ambientSound.setLoop(true);
  ambientSound.setVolume(0.3);
  ambientSound.play();
});

document.getElementById("left").addEventListener("click", () => {
  controls.enabled = false;
  currentIndex =
    (currentIndex - 1 + hotspotObjects.length) % hotspotObjects.length;
  console.log("Current Index (Left):", currentIndex);
  targetPosition.copy(getOffsetPosition(hotspotObjects[currentIndex]));

  if (moveSound.isPlaying) moveSound.stop();
  moveSound.play();
});

document.getElementById("right").addEventListener("click", () => {
  controls.enabled = false;
  currentIndex = (currentIndex + 1) % hotspotObjects.length;
  console.log("Current Index (Right):", currentIndex);
  targetPosition.copy(getOffsetPosition(hotspotObjects[currentIndex]));
  if (moveSound.isPlaying) moveSound.stop();
  moveSound.play();
});

function animate() {
  mesh.rotation.x += 0.01;
  mesh.rotation.y += 0.01;

  if (!controls.enabled) {
    camera.position.lerp(targetPosition, 0.05);

    model.position.lerp(targetPosition, 0.5);

    if (camera.position.distanceTo(targetPosition) < 0.01) {
      controls.enabled = true;
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const tooltip = document.getElementById("tooltip");

window.addEventListener("mousemove", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(hotspotObjects);

  if (intersects.length > 0) {
    const hotspot = intersects[0].object;
    const data = hotspotData[hotspot.index];

    tooltip.style.display = "block";
    tooltip.style.left = event.clientX + 15 + "px";
    tooltip.style.top = event.clientY + 15 + "px";

    tooltip.innerHTML = `
  <div style="font-weight: bold; font-size: 16px; margin-bottom: 6px; color: #ffd700;">
    ${data.title}
  </div>
  <div style="margin-bottom: 8px; font-size: 13px; color: #ddd;">
    ${data.desc}
  </div>
  <img src="${data.img}" 
       alt="${data.title}" 
       style="width: 100%; border-radius: 8px; margin-top: 6px;" />
`;
  } else {
    tooltip.style.display = "none";
  }
});
