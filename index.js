import * as THREE from "three";
import { getBody, getMouseBall } from "./getBodies.js";
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat@0.11.2';
import { EffectComposer } from "jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "jsm/postprocessing/UnrealBloomPass.js";


let isAudioStarted = false;

function initAudio() {
  if (!isAudioStarted) {
    if (!windSound.isPlaying) windSound.play();
    if (!ballTouchSound.isPlaying) ballTouchSound.play();
    if (!ballCollisionSound.isPlaying) ballCollisionSound.play();
    if (!ballReturnSound.isPlaying) ballReturnSound.play();
    isAudioStarted = true;
    console.log('Audio started after user gesture.');
  }
}


function initAudioContext() {
  if (THREE.AudioContext.getContext().state !== 'running') {
    THREE.AudioContext.getContext().resume().then(() => {
      console.log('AudioContext resumed after user gesture');
      initAudio();
    });
  }
}

window.addEventListener('click', initAudioContext);
window.addEventListener('mousemove', initAudioContext);



// Inisialisasi audio listener pada kamera
const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.z = 5;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

// Menambahkan AudioListener pada kamera
const listener = new THREE.AudioListener();
camera.add(listener);

// Membuat AudioLoader
const audioLoader = new THREE.AudioLoader();

// Mendefinisikan audio objects
const windSound = new THREE.Audio(listener);
const ballTouchSound = new THREE.Audio(listener);
const ballCollisionSound = new THREE.Audio(listener);
const ballReturnSound = new THREE.Audio(listener);

// Memuat suara angin untuk pergerakan mouse
audioLoader.load('suara/wind-sound.mp3.mp3', (buffer) => {
  windSound.setBuffer(buffer);
  windSound.setLoop(true);
  windSound.setVolume(20);
});

// Memuat suara bola ketika bola menyentuh mouse
audioLoader.load('suara/ball-touch-sound.mp3.mp3', (buffer) => {
  ballTouchSound.setBuffer(buffer);
  ballTouchSound.setVolume(20);
});

// Memuat suara bola ketika bola bertabrakan satu sama lain
audioLoader.load('suara/ball-collision-sound.mp3.mp3', (buffer) => {
  ballCollisionSound.setBuffer(buffer);
  ballCollisionSound.setVolume(20);
});



let mousePos = new THREE.Vector2();
await RAPIER.init();
const gravity = { x: 0.0, y: 0, z: 0.0 };
const world = new RAPIER.World(gravity);

// Post-processing
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 2.0, 0.0, 0.005);
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

const numBodies = 100;
const bodies = [];
for (let i = 0; i < numBodies; i++) {
  const body = getBody(RAPIER, world);
  bodies.push(body);
  scene.add(body.mesh);
}

const mouseBall = getMouseBall(RAPIER, world);
scene.add(mouseBall.mesh);

const hemiLight = new THREE.HemisphereLight(0x00bbff, 0xaa00ff);
hemiLight.intensity = 0.2;
scene.add(hemiLight);

// Fungsi untuk memperbarui posisi mouse dan menambahkan suara saat bola dekat dengan mouse
function updateMouseBall(mousePos) {
  mouseBall.update(mousePos);

  if (isAudioStarted && !windSound.isPlaying) {
    windSound.play();
  }

  bodies.forEach(body => {
    const distance = body.mesh.position.distanceTo(mouseBall.mesh.position);
    if (distance < 0.5 && isAudioStarted) {
      ballTouchSound.stop();  // Stop sound jika sedang bermain
      ballTouchSound.play();  // Mainkan ulang
    }
  });
}

// Fungsi untuk memeriksa tabrakan antar bola
function checkBallCollisions() {
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const distance = bodies[i].mesh.position.distanceTo(bodies[j].mesh.position);
      if (distance < bodies[i].mesh.geometry.parameters.radius + bodies[j].mesh.geometry.parameters.radius) {
        // Memainkan suara saat bola bertabrakan
        ballCollisionSound.stop();  // Stop sound jika sedang bermain
        ballCollisionSound.play();  // Mainkan ulang
      }
    }
  }
}

// Fungsi untuk memutar suara bola kembali ke posisi asal
function updateBallReturn() {
  bodies.forEach(body => {
    let { x, y, z } = body.rigid.translation();
    const pos = new THREE.Vector3(x, y, z);
    
    const dist = pos.distanceTo(new THREE.Vector3(0, 0, 0));
    if (dist > 5 && !ballReturnSound.isPlaying) {
      ballReturnSound.play();
      body.rigid.setTranslation(0, 0, 0, true);
    }
  });
}

function animate() {
  requestAnimationFrame(animate);
  world.step();
  updateMouseBall(mousePos);
  bodies.forEach(b => b.update());
  
  // Memeriksa tabrakan antar bola dan suara bola kembali ke posisi asal
  checkBallCollisions();
  updateBallReturn();

  composer.render(scene, camera);
}

animate();

function handleWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', handleWindowResize, false);

function handleMouseMove (evt) {
  mousePos.x = (evt.clientX / window.innerWidth) * 2 - 1;
  mousePos.y = -(evt.clientY / window.innerHeight) * 2 + 1;
}
window.addEventListener('mousemove', handleMouseMove, false);
