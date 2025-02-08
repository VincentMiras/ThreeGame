"use strict";

// Import only what you need, to help your bundler optimize final code size using tree shaking
// see https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking)

import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  BoxGeometry,
  Mesh,
  MeshNormalMaterial,
  AmbientLight,
  Clock,
  Vector3,
  SphereGeometry,
  MeshToonMaterial,
  Light,
  Color,
  DirectionalLight,
  HemisphereLight,
  CylinderGeometry
} from 'three';

// If you prefer to import the whole library, with the THREE prefix, use the following line instead:
// import * as THREE from 'three'

// NOTE: three/addons alias is supported by Rollup: you can use it interchangeably with three/examples/jsm/  

// Importing Ammo can be tricky.
// Vite supports webassembly: https://vitejs.dev/guide/features.html#webassembly
// so in theory this should work:
//
// import ammoinit from 'three/addons/libs/ammo.wasm.js?init';
// ammoinit().then((AmmoLib) => {
//  Ammo = AmmoLib.exports.Ammo()
// })
//
// But the Ammo lib bundled with the THREE js examples does not seem to export modules properly.
// A solution is to treat this library as a standalone file and copy it using 'vite-plugin-static-copy'.
// See vite.config.js
// 
// Consider using alternatives like Oimo or cannon-es
import {
  OrbitControls
} from 'three/addons/controls/OrbitControls.js';

import {
  GLTFLoader
} from 'three/addons/loaders/GLTFLoader.js';

import * as CANNON from 'cannon-es';

import CannonDebugger from 'cannon-es-debugger';

// Example of hard link to official repo for data, if needed
// const MODEL_PATH = 'https://raw.githubusercontent.com/mrdoob/three.js/r173/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb';


// INSERT CODE HERE

const scene = new Scene();
const aspect = window.innerWidth / window.innerHeight;
const camera = new PerspectiveCamera(70, aspect, 0.1, 1000);
camera.position.z = 0;
camera.position.y = 1.70;




const renderer = new WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);



//WORLD 
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.81, 0)
})

const groundBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Plane(),
})

groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
world.addBody(groundBody)

const groundGeometry = new BoxGeometry(1000, 1, 1000);
const groundMaterial = new MeshToonMaterial();
const ground = new Mesh(groundGeometry, groundMaterial);

ground.position.set(0, -0.5, 0);
scene.add(ground);

const cannonDebugger = new CannonDebugger(scene, world, {
})

//LIGHT

scene.background = new Color(0x87CEEB);
const light = new AmbientLight(0xffffff, 0.3); // soft white light
scene.add(light);

//Soleil
const directionalLight = new DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// lumière jolie
const hemisphereLight = new HemisphereLight(0xaaaaaa, 0x0000ff, 0.9); // Lumière douce venant du ciel
scene.add(hemisphereLight);

// test
const directionalLight2 = new DirectionalLight(0xffdd99, 1);
directionalLight2.position.set(5, 10, 5).normalize();
scene.add(directionalLight2);


//PLAYER

const playerDirection = new Vector3();

//LISTNER CONTROLS
const STEPS_PER_FRAME = 5;

const keyStates = {};
document.addEventListener('keydown', (event) => {
  keyStates[event.code] = true;
});

document.addEventListener('keyup', (event) => {
  keyStates[event.code] = false;
});

window.addEventListener('mousedown', (event) => {
  if (event.button === 0) {
    pressStartTime = Date.now();
    isPressing = true;
  }
});

window.addEventListener('mouseup', (event) => {
  if (event.button === 0) {
    const pressDuration = (Date.now() - pressStartTime) / 1000; 
    shootArrow(pressDuration); 
    isPressing = false;
  }
});


//BULLET GESTION

const arrows = [];
const arrowSpeed = 5;
let pressStartTime = 0; 
let isPressing = false;

//LOADING BULLETS
let arrow = null
const b_loader = new GLTFLoader().setPath('assets/models/');
b_loader.load('Arrow.glb', (gltf) => {
  arrow = gltf.scene
  arrow.rotation.x -= Math.PI / 2;
});

//LOADING CASTLE
const c_loader = new GLTFLoader().setPath('assets/models/');
c_loader.load('Castle.glb', (gltf) => {
  const castle = gltf.scene;
  castle.scale.set(100, 100, 100);
  scene.add(castle);
}, undefined, (error) => {
  console.error("Erreur de chargement du modèle:", error);
});

//VECTEUR AVANT
function getForwardVector() {

  camera.getWorldDirection(playerDirection);
  playerDirection.y = 0;
  playerDirection.normalize();

  return playerDirection;

}

//BULLET SEND
function shootArrow(pressDuration) {
  if (!arrow) return;

  //position fleche camera 
  const arrowClone = arrow.clone();
  const direction = getForwardVector();
  arrowClone.position.copy(camera.position).add(direction.clone());

  //rotation fleche direction caméra
  const quaternion = new CANNON.Quaternion();
  const angleY = Math.atan2(direction.x, direction.z);
  quaternion.setFromEuler(0, angleY, 0);

  // Créer un corps physique pour la flèche
  const arrowBody = new CANNON.Body({
    mass: 0.5 ,
    position: new CANNON.Vec3(arrowClone.position.x, arrowClone.position.y, arrowClone.position.z),
    shape: new CANNON.Box(new CANNON.Vec3(0.05, 0.05, 0.7)),
    quaternion :quaternion.clone()
  });

  let charge = pressDuration * 50
  if (charge>100){
    charge=100;
  }

  const arrowSpeedVector = direction.clone().multiplyScalar(arrowSpeed+charge);
  arrowBody.velocity.set(arrowSpeedVector.x, arrowSpeedVector.y, arrowSpeedVector.z);
  
  
  world.addBody(arrowBody);

  arrowClone.userData.body = arrowBody;


  scene.add(arrowClone);
  arrows.push(arrowClone);
}


//Bullet Update
function bullet_update() {
  arrows.forEach(arrowClone => {
    const arrowBody = arrowClone.userData.body;

    arrowClone.position.copy(arrowBody.position);
    arrowClone.quaternion.copy(arrowBody.quaternion);

  });
}

//ACTIONS CONTROLS
function controls() {

  let rotationSpeed = 0.005;

  if (keyStates['KeyW']) {
    camera.position.addScaledVector(getForwardVector(), 0.05);
  }

  if (keyStates['KeyS']) {
    camera.position.addScaledVector(getForwardVector(), -0.05);
  }

  if (keyStates['KeyA']) {
    camera.rotation.y += rotationSpeed;
  }

  if (keyStates['KeyD']) {
    camera.rotation.y -= rotationSpeed;
  }
}

const clock = new Clock();

// Main loop
const animation = () => {

  renderer.setAnimationLoop(animation); // requestAnimationFrame() replacement, compatible with XR 
  world.fixedStep()
  cannonDebugger.update()


  for (let i = 0; i < STEPS_PER_FRAME; i++) {

    controls();
    bullet_update();

  }

  renderer.render(scene, camera);
};

animation();

window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

}
