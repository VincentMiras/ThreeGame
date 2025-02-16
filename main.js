"use strict";

// Import only what you need, to help your bundler optimize final code size using tree shaking
// see https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking)

import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  BoxGeometry,
  Mesh,
  Sprite,
  AmbientLight,
  Clock,
  Vector3,
  CanvasTexture,
  MeshToonMaterial,
  Light,
  Color,
  DirectionalLight,
  HemisphereLight,
  SpriteMaterial,
  AnimationMixer,
  LoopOnce
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

import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

import {
  GLTFLoader
} from 'three/addons/loaders/GLTFLoader.js';

import * as CANNON from 'cannon-es';

import CannonDebugger from 'cannon-es-debugger';

// Example of hard link to official repo for data, if needed
// const MODEL_PATH = 'https://raw.githubusercontent.com/mrdoob/three.js/r173/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb';

//Global
const scene = new Scene();
const aspect = window.innerWidth / window.innerHeight;
const camera = new PerspectiveCamera(70, aspect, 0.1, 1000);
const STEPS_PER_FRAME = 5;
const renderer = new WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// CAnvas Score
const scoreCanvas = document.createElement("canvas");
const scoreCtx = scoreCanvas.getContext("2d");
scoreCanvas.width = 256;
scoreCanvas.height = 128;
const scoreTexture = new CanvasTexture(scoreCanvas);

const scoreMaterial = new SpriteMaterial({ map: scoreTexture });
const scoreSprite = new Sprite(scoreMaterial);
scoreSprite.scale.set(2, 1, 1);
scoreSprite.position.set(7, 3, -5);
camera.add(scoreSprite);
scene.add(camera);



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

//PLAYER 

let playerDirection = new Vector3()

camera.position.z = 0;
camera.position.y = 1.70;

// const hitboxPlayer = new CANNON.Body({
//   mass: 0,
//   position: new Vector3(0,0.01,0),
//   shape: new CANNON.Box(new Vector3(0.1,1.80,0.1))
// });

// world.addBody(hitboxPlayer);


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


//LISTNER CONTROLS


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
  }
});

window.addEventListener('mouseup', (event) => {
  if (event.button === 0) {
    const pressDuration = (Date.now() - pressStartTime) / 1000;
    shootArrow(pressDuration);
  }
});


//BULLET GESTION

const arrows = [];
const arrowSpeed = 5;
let pressStartTime = 0;

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
  castle.traverse((child) => {
    if (child.isMesh) {
      child.geometry.scale(100, 100, 100);
      child.geometry.computeBoundingBox();
    }
  });
  scene.add(castle);
  // MURS
  const walls = [
    // gauche
    { xbg: -102.5, zbg: 92, xhd: -78, zhd: -96 },
    //haut
    { xbg: -102.5, zbg: -71, xhd: 102.5, zhd: -96.5 },
    //droite
    { xbg: 78, zbg: 92, xhd: 102.5, zhd: -96 },
    //bas gauche
    { xbg: -102.5, zbg: 92, xhd: -13.5, zhd: 66.5 },
    //bas droite
    { xbg: 13.5, zbg: 92, xhd: 102.5, zhd: 66.5 },
  ];

  walls.forEach(wall => {
    const shape = new CANNON.Box(new CANNON.Vec3(
      Math.abs(wall.xbg - wall.xhd) / 2,
      50,
      Math.abs(wall.zbg - wall.zhd) / 2,
    ));
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: shape,
      position: new CANNON.Vec3(
        (wall.xbg + wall.xhd) / 2,
        50,
        (wall.zbg + wall.zhd) / 2
      )
    });
    world.addBody(body);
  });
});

//LOAding pirates

const captLoader = new GLTFLoader().setPath('assets/models/');
let targets = [];
let capi = null;

captLoader.load('Pirate_Captain.glb', (gltf) => {
  captLoader.load('Pirate_Captain.glb', (gltf) => {
    capi = gltf.scene;
    capi.scale.set(1.4, 1.4, 1.4);
    capi.userData.animations = gltf.animations;

    setInterval(spawnPirate, 5000);
  });
});




//FUNCTION



function spawnPirate() {
  if (!capi) return;

  const capiClone = SkeletonUtils.clone(capi);
  const spawnPosition = getRandomPositionInCastle();
  capiClone.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);
  scene.add(capiClone);

  const shape = new CANNON.Sphere(1);
  const body = new CANNON.Body({
    mass: 1,
    position: spawnPosition,
    shape: shape
  });
  world.addBody(body);
  targets.push({ capi: capiClone, body });

  const mixer = new AnimationMixer(capiClone);
  capiClone.userData.mixer = mixer;
  capiClone.userData.animations = capi.userData.animations;
  const action = mixer.clipAction(capi.userData.animations[11]);
  action.play();
}


//gestion collisions
function killenemy(bodyA, bodyB) {
  let pirate = targets.find((t) => t.body === bodyA || t.body === bodyB);
  let arrow = arrows.find((a) => a.userData.body === bodyA || a.userData.body === bodyB);

  if (!pirate || !arrow) return;
  if (pirate.isDead) return;

  pirate.body.velocity.set(0, 0, 0);
  pirate.body.angularVelocity.set(0, 0, 0);
  pirate.isDead = true;

  // Jouer l'animation de mort
  if (pirate.capi?.userData.mixer && pirate.capi?.userData.animations) {
    const hitAnimation = pirate.capi.userData.animations[0];
    if (hitAnimation) {
      const action = pirate.capi.userData.mixer.clipAction(hitAnimation);
      action.reset();
      action.setLoop(LoopOnce);
      action.clampWhenFinished = true;
      action.play();

      action.getMixer().addEventListener("finished", () => {
        scene.remove(pirate.capi);
        world.removeBody(pirate.body);
        targets = targets.filter((t) => t !== pirate);
      });
    }
  }

  // Augmenter le score et mettre à jour
  score += 10;
}



//VECTEUR AVANT
function getForwardVector() {

  camera.getWorldDirection(playerDirection);
  playerDirection.y = 0;
  playerDirection.normalize();

  return playerDirection;
}

//position aleatoire
function getRandomPositionInCastle() {
  // Coordonnées des murs (doivent être ajustées selon ton modèle)
  const minX = -80, maxX = 80;
  const minZ = -70, maxZ = 70;
  const y = 1; // Position au sol

  const x = Math.random() * (maxX - minX) + minX;
  const z = Math.random() * (maxZ - minZ) + minZ;

  return new CANNON.Vec3(x, y, z);
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

  // Physique fleche
  const arrowBody = new CANNON.Body({
    mass: 0.5,
    position: new CANNON.Vec3(arrowClone.position.x, arrowClone.position.y, arrowClone.position.z),
    quaternion: quaternion.clone()
  });

  const boxSize = new CANNON.Vec3(0.05, 0.05, 0.7);
  const boxShape = new CANNON.Box(boxSize);
  arrowBody.addShape(boxShape);

  const sphereRadius = 0.03;
  const sphereShape = new CANNON.Sphere(sphereRadius);

  arrowBody.addShape(sphereShape, new CANNON.Vec3(0, 0, boxSize.z));
  arrowBody.addEventListener("collide", (event) => {
    let relativeVelocity = event.contact.getImpactVelocityAlongNormal();
    if (Math.abs(relativeVelocity) > 15) {
      killenemy(event.body, event.target);
    } else { }
  });


  //charge fleche
  let charge = pressDuration * 50
  if (charge > 100) {
    charge = 100;
  }

  //Vitesse
  const arrowSpeedVector = direction.clone().multiplyScalar(arrowSpeed + charge);
  arrowBody.velocity.set(arrowSpeedVector.x, arrowSpeedVector.y, arrowSpeedVector.z);

  //ajout fleche monde

  arrowClone.userData.body = arrowBody;
  world.addBody(arrowBody);
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

//Player Update
function player_update() {
  hitboxPlayer.position.copy(camera.position);
  hitboxPlayer.position.y = camera.position.y - 1.69;
};

//enemy update
function update_enemy() {
  const delta = clock.getDelta();
  targets.forEach(({ capi, body, isDead }) => {
    if (!isDead) {
      // Mettre à jour la position et la rotation uniquement si le pirate n'est pas mort
      capi.position.copy(body.position);
      capi.position.y -= 1;

      const direction = new Vector3();
      direction.subVectors(camera.position, capi.position).setY(0).normalize();
      capi.rotation.y = Math.atan2(direction.x, direction.z);

      const speed = 1;
      body.velocity.set(direction.x * speed, body.velocity.y, direction.z * speed);
    }

    // Mettre à jour l'animation même si le pirate est mort
    if (capi.userData.mixer) {
      capi.userData.mixer.update(delta);
    }
  });
}

// Fonction pour mettre à jour le score
let score = 0;
function updateScore() {
  scoreCtx.clearRect(0, 0, scoreCanvas.width, scoreCanvas.height);
  scoreCtx.fillStyle = "green";
  scoreCtx.font = "40px Uncial Antiqua";
  scoreCtx.fillText(`Score: ${score}`, 20, 60);
  scoreTexture.needsUpdate = true;
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

  cannonDebugger.update()


  for (let i = 0; i < STEPS_PER_FRAME; i++) {

    controls();
    bullet_update();
    //player_update();
    update_enemy();
    updateScore();
    world.fixedStep()

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
