import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

/////////////////////////////////////////////////////////
// ESCENA
/////////////////////////////////////////////////////////

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);
scene.fog = new THREE.Fog(0x050505, 20, 100);

/////////////////////////////////////////////////////////
// CAMARA
/////////////////////////////////////////////////////////

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

/////////////////////////////////////////////////////////
// RENDERER
/////////////////////////////////////////////////////////

const renderer = new THREE.WebGLRenderer({
  antialias:true
});

renderer.setSize(
  window.innerWidth,
  window.innerHeight
);

renderer.shadowMap.enabled = true;

document
  .getElementById('app')
  .appendChild(renderer.domElement);

/////////////////////////////////////////////////////////
// LUCES
/////////////////////////////////////////////////////////

const ambient =
  new THREE.AmbientLight(
    0xffffff,
    0.25
  );

scene.add(ambient);

/////////////////////////////////////////////////////////
// MINERO
/////////////////////////////////////////////////////////

const player = new THREE.Group();
scene.add(player);

const body =
  new THREE.Mesh(
    new THREE.CapsuleGeometry(
      0.4,
      1.2,
      4,
      8
    ),
    new THREE.MeshStandardMaterial({
      color:0x0b5394
    })
  );

body.position.y = 1;
body.castShadow = true;

player.add(body);

const head =
  new THREE.Mesh(
    new THREE.SphereGeometry(
      0.3,
      16,
      16
    ),
    new THREE.MeshStandardMaterial({
      color:0xffd7b5
    })
  );

head.position.y = 2;

player.add(head);

const helmet =
  new THREE.Mesh(
    new THREE.SphereGeometry(
      0.36,
      16,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    ),
    new THREE.MeshStandardMaterial({
      color:0xffff00
    })
  );

helmet.position.y = 2.1;

player.add(helmet);

/////////////////////////////////////////////////////////
// LINTERNA
/////////////////////////////////////////////////////////

const flashlight =
  new THREE.SpotLight(
    0xffffff,
    200
  );

flashlight.angle = Math.PI / 7;
flashlight.distance = 40;
flashlight.penumbra = 0.5;

flashlight.position.set(
  0,
  2.1,
  0
);

flashlight.target.position.set(
  0,
  2,
  -10
);

player.add(flashlight);
player.add(flashlight.target);

/////////////////////////////////////////////////////////
// TUNEL
/////////////////////////////////////////////////////////

const tunnel =
  new THREE.Mesh(
    new THREE.CylinderGeometry(
      8,
      8,
      1000,
      32,
      32,
      true
    ),
    new THREE.MeshStandardMaterial({
      color:0x3b3b3b,
      roughness:1
    })
  );

tunnel.rotation.x = Math.PI / 2;
tunnel.position.z = -500;

scene.add(tunnel);

/////////////////////////////////////////////////////////
// SOPORTES METALICOS
/////////////////////////////////////////////////////////

for(let z = 0; z > -1000; z -= 5){

  const support =
    new THREE.Mesh(
      new THREE.TorusGeometry(
        7.8,
        0.15,
        8,
        24
      ),
      new THREE.MeshStandardMaterial({
        color:0x666666
      })
    );

  support.position.z = z;

  scene.add(support);
}

/////////////////////////////////////////////////////////
// SUELO
/////////////////////////////////////////////////////////

const floor =
  new THREE.Mesh(
    new THREE.PlaneGeometry(
      20,
      1000
    ),
    new THREE.MeshStandardMaterial({
      color:0x2b2b2b
    })
  );

floor.rotation.x = -Math.PI / 2;
floor.position.y = -7.8;
floor.position.z = -500;

scene.add(floor);

/////////////////////////////////////////////////////////
// DURMIENTES DEL RIEL
/////////////////////////////////////////////////////////

for(let z = 0; z > -1000; z -= 2){

  const sleeper =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        3,
        0.15,
        0.3
      ),
      new THREE.MeshStandardMaterial({
        color:0x4d3319
      })
    );

  sleeper.position.set(
    0,
    -7.7,
    z
  );

  scene.add(sleeper);
}

/////////////////////////////////////////////////////////
// RIELES
/////////////////////////////////////////////////////////

for(let x of [-0.8,0.8]){

  const rail =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.12,
        0.12,
        1000
      ),
      new THREE.MeshStandardMaterial({
        color:0x888888
      })
    );

  rail.position.set(
    x,
    -7.55,
    -500
  );

  scene.add(rail);
}

/////////////////////////////////////////////////////////
// TUBERIA
/////////////////////////////////////////////////////////

const pipe =
  new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.25,
      0.25,
      1000,
      16
    ),
    new THREE.MeshStandardMaterial({
      color:0x777777
    })
  );

pipe.rotation.x = Math.PI / 2;
pipe.position.set(
  6,
  4,
  -500
);

scene.add(pipe);

/////////////////////////////////////////////////////////
// ROCAS
/////////////////////////////////////////////////////////

for(let i=0;i<100;i++){

  const rock =
    new THREE.Mesh(
      new THREE.DodecahedronGeometry(
        Math.random()*0.4 + 0.2
      ),
      new THREE.MeshStandardMaterial({
        color:0x4a4a4a
      })
    );

  rock.position.set(
    (Math.random()-0.5)*12,
    -7.4,
    -Math.random()*1000
  );

  scene.add(rock);
}

/////////////////////////////////////////////////////////
// CONTROLES
/////////////////////////////////////////////////////////

const keys = {};

document.addEventListener(
  'keydown',
  e => keys[e.code] = true
);

document.addEventListener(
  'keyup',
  e => keys[e.code] = false
);

/////////////////////////////////////////////////////////
// MOVIMIENTO
/////////////////////////////////////////////////////////

const speed = 0.15;

function updatePlayer(){

  if(keys['KeyW'])
    player.position.z -= speed;

  if(keys['KeyS'])
    player.position.z += speed;

  if(keys['KeyA'])
    player.position.x -= speed;

  if(keys['KeyD'])
    player.position.x += speed;

  player.position.x =
    Math.max(
      -6,
      Math.min(
        6,
        player.position.x
      )
    );
}

/////////////////////////////////////////////////////////
// CAMARA
/////////////////////////////////////////////////////////

function updateCamera(){

  const target =
    player.position.clone()
    .add(
      new THREE.Vector3(
        0,
        3,
        8
      )
    );

  camera.position.lerp(
    target,
    0.08
  );

  camera.lookAt(
    player.position.clone()
      .add(
        new THREE.Vector3(
          0,
          1.5,
          0
        )
      )
  );
}

/////////////////////////////////////////////////////////
// LOOP
/////////////////////////////////////////////////////////

function animate(){

  requestAnimationFrame(
    animate
  );

  updatePlayer();
  updateCamera();

  renderer.render(
    scene,
    camera
  );
}

animate();

/////////////////////////////////////////////////////////
// RESIZE
/////////////////////////////////////////////////////////

window.addEventListener(
  'resize',
  () => {

    camera.aspect =
      window.innerWidth /
      window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );
  }
);