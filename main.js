import * as THREE from "three";
import * as dat from "lil-gui";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

const gui = new dat.GUI();
const rgbeLoader = new RGBELoader();

rgbeLoader.load("/static/textures/bg.hdr", (bg) => {
  bg.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = bg;
  scene.environment = bg;
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
scene.add(mesh);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);
const controls = new OrbitControls(camera, renderer.domElement);
camera.position.z = 4;
function animate() {
  mesh.rotation.x += 0.01;
  mesh.rotation.y += 0.01;
  controls.update();
  renderer.render(scene, camera);
}
gui.add(mesh.position, "y").min(-3).max(3).step(0.01);

gui.addColor(material, "color");
gui.add(mesh, "visible");
gui.add(material, "wireframe");
gui.add(material, "transparent");

material.metalness = 1;
material.roughness = 5;
gui.add;
