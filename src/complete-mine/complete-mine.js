import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import mineCsvUrl from '../../prueba/elementos/_mina_completa.csv?url';
import { COMPLETE_MINE_PLAN } from '../world/complete/CompleteMinePlan.js';

const canvas = document.getElementById('mine-canvas');
const loadingScreen = document.getElementById('loading-screen');
const loadingLabel = document.getElementById('loading-label');
const loadingProgress = document.getElementById('loading-progress');
const list = document.getElementById('mine-list');
const selectionDetail = document.getElementById('selection-detail');
const elevationCut = document.getElementById('elevation-cut');
const elevationValue = document.getElementById('elevation-value');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0c);
scene.fog = new THREE.FogExp2(0x090b0c, 0.00145);
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.2, 3000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.screenSpacePanning = true;
controls.minDistance = 5;
controls.maxDistance = 1300;

scene.add(new THREE.HemisphereLight(0xc9d2d0, 0x241b13, 2.25));
const keyLight = new THREE.DirectionalLight(0xffe6bd, 4.4);
keyLight.position.set(-120, 220, 180);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x88a9ba, 2.4);
rimLight.position.set(240, 80, -260);
scene.add(rimLight);

const clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 26);
const rockMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.94, metalness: 0.02, flatShading: true,
  side: THREE.DoubleSide, clippingPlanes: [clippingPlane]
});
const serviceMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.64, metalness: 0.18, flatShading: true,
  side: THREE.DoubleSide, clippingPlanes: [clippingPlane]
});

const root = new THREE.Group();
root.name = 'mina_completa_csv';
scene.add(root);
const objectById = new Map();
const planById = new Map(COMPLETE_MINE_PLAN.map(item => [item.id, item]));
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let allBounds = new THREE.Box3();
let selectedId = null;
let servicesVisible = true;
let pointerStart = null;

const highlight = new THREE.Box3Helper(new THREE.Box3(), 0xf1bd5d);
highlight.visible = false;
scene.add(highlight);

function isServiceLayer(layer) {
  return /MANGA|TUBERIA|CABLE|PLACA_PERNO|COLLAR_|PARRILLA|REVESTIMIENTO_PIQUE/.test(layer);
}

function layerColor(layer, colour) {
  if (layer.includes('MANGA')) return new THREE.Color(0xd89d35);
  if (layer.includes('TUBERIA_AGUA')) return new THREE.Color(0x419bc5);
  if (layer.includes('TUBERIA_AIRE')) return new THREE.Color(0xc65d4e);
  if (layer.includes('CABLE')) return new THREE.Color(0x252629);
  if (layer.includes('PLACA_PERNO') || colour === 6) return new THREE.Color(0xd6a54a);
  if (layer.includes('COLLAR')) return new THREE.Color(0x27292b);
  if (layer.includes('CUNETA')) return new THREE.Color(0x252c2c);
  if (layer.includes('PISO') || layer.includes('MURO_PISO')) return new THREE.Color(0x49443d);
  if (layer.includes('MUCK') || layer.includes('MARINA')) return new THREE.Color(0x614a35);
  if (layer.includes('SHOTCRETE') || layer.includes('CORONA') || layer.includes('RINON')) return new THREE.Color(0x9b9991);
  if (layer.includes('REVESTIMIENTO')) return new THREE.Color(0x777b7b);
  if (layer.includes('TAJO') || layer.includes('CAJA_')) return new THREE.Color(0x7c6045);
  return new THREE.Color(0x746655);
}

function makeBucket() { return { positions: [], colors: [], triangles: 0 }; }
function pushVertex(bucket, x, y, z, color) {
  // CSV: X este, Y norte, Z cota. Three.js: X este, Y cota, Z sur.
  bucket.positions.push(x, z, -y);
  bucket.colors.push(color.r, color.g, color.b);
}
function updateLoading(progress, label) {
  loadingProgress.style.width = `${Math.max(3, Math.min(100, progress))}%`;
  loadingLabel.textContent = label;
}

async function parseMineCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const expected = 'TRIANGLE,XP1,YP1,ZP1,XP2,YP2,ZP2,XP3,YP3,ZP3,COLOUR,LAYERS,LABOR,LINK';
  if (lines.shift() !== expected) throw new Error('El CSV maestro tiene un encabezado incompatible');
  const buckets = new Map();
  for (const item of COMPLETE_MINE_PLAN) buckets.set(item.id, { rock: makeBucket(), service: makeBucket() });

  for (let row = 0; row < lines.length; row++) {
    const values = lines[row].split(',');
    if (values.length !== 14) throw new Error(`Fila ${row + 2} incompleta en la mina maestra`);
    const layer = values[11];
    const labor = values[12];
    const pair = buckets.get(labor);
    if (!pair) throw new Error(`Labor desconocida en el CSV maestro: ${labor}`);
    const bucket = isServiceLayer(layer) ? pair.service : pair.rock;
    const color = layerColor(layer, Number(values[10]));
    for (let vertex = 0; vertex < 3; vertex++) {
      const x = Number(values[1 + vertex * 3]);
      const y = Number(values[2 + vertex * 3]);
      const z = Number(values[3 + vertex * 3]);
      if (![x, y, z].every(Number.isFinite)) throw new Error(`Coordenada inválida en fila ${row + 2}`);
      pushVertex(bucket, x, y, z, color);
    }
    bucket.triangles++;
    if (row > 0 && row % 6000 === 0) {
      updateLoading(18 + row / lines.length * 62, `Procesando triángulos · ${Math.round(row / lines.length * 100)}%`);
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  }
  return { buckets, triangles: lines.length };
}

function geometryFromBucket(bucket) {
  if (!bucket.positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(bucket.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(bucket.colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  bucket.positions = null;
  bucket.colors = null;
  return geometry;
}

function buildMeshes(buckets) {
  for (const item of COMPLETE_MINE_PLAN) {
    const pair = buckets.get(item.id);
    const group = new THREE.Group();
    group.name = item.id;
    group.userData = { plan: item, triangles: pair.rock.triangles + pair.service.triangles };
    const rockGeometry = geometryFromBucket(pair.rock);
    if (rockGeometry) {
      const mesh = new THREE.Mesh(rockGeometry, rockMaterial);
      mesh.name = `${item.id}_roca`;
      mesh.userData.mineId = item.id;
      group.add(mesh);
    }
    const serviceGeometry = geometryFromBucket(pair.service);
    if (serviceGeometry) {
      const mesh = new THREE.Mesh(serviceGeometry, serviceMaterial);
      mesh.name = `${item.id}_servicios`;
      mesh.userData.mineId = item.id;
      mesh.userData.service = true;
      group.add(mesh);
    }
    root.add(group);
    objectById.set(item.id, group);
  }
  root.updateMatrixWorld(true);
  allBounds = new THREE.Box3().setFromObject(root);
  return COMPLETE_MINE_PLAN.length;
}

const formatInt = value => new Intl.NumberFormat('es-PE').format(value);
function populateList() {
  const fragment = document.createDocumentFragment();
  COMPLETE_MINE_PLAN.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mine-item';
    button.dataset.mineId = item.id;
    button.innerHTML = `<span class="mine-index">${String(index + 1).padStart(2, '0')}</span><span class="mine-copy"><strong>${item.label}</strong><span>${item.type}</span></span><span class="mine-level">${item.level.split(' → ')[0]}</span>`;
    button.addEventListener('click', () => selectMine(item.id, true));
    fragment.appendChild(button);
  });
  list.appendChild(fragment);
}

function fitBox(box, view = 'general') {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const max = Math.max(size.x, size.y, size.z, 8);
  camera.up.set(0, 1, 0);
  if (view === 'planta') {
    camera.up.set(0, 0, -1);
    camera.position.set(center.x, center.y + max * 1.45, center.z + 0.001);
  } else if (view === 'perfil') {
    camera.position.set(center.x, center.y + max * .10, center.z + max * 1.35);
  } else {
    camera.position.set(center.x + max * .82, center.y + max * .58, center.z + max * .92);
  }
  controls.target.copy(center);
  controls.update();
}

function selectMine(id, focus = false) {
  const object = objectById.get(id);
  const item = planById.get(id);
  if (!object || !item) return;
  selectedId = id;
  document.querySelectorAll('.mine-item').forEach(button => button.classList.toggle('selected', button.dataset.mineId === id));
  const box = new THREE.Box3().setFromObject(object);
  highlight.box.copy(box);
  highlight.visible = true;
  const size = box.getSize(new THREE.Vector3());
  selectionDetail.textContent = `${item.label} · ${item.type} · ${item.level} · ${formatInt(object.userData.triangles)} triángulos · ${size.x.toFixed(1)} × ${size.z.toFixed(1)} × ${size.y.toFixed(1)} m`;
  if (focus) fitBox(box);
}

function showAll(view = 'general') {
  selectedId = null;
  highlight.visible = false;
  document.querySelectorAll('.mine-item').forEach(button => button.classList.remove('selected'));
  selectionDetail.textContent = `Mina ampliada · ${COMPLETE_MINE_PLAN.length} emplazamientos · superficie y niveles 160, 128, 96 y 64 · escala 1:1.`;
  fitBox(allBounds, view);
}

function setServicesVisible(visible) {
  servicesVisible = visible;
  root.traverse(object => { if (object.userData?.service) object.visible = visible; });
  document.getElementById('services-toggle').setAttribute('aria-pressed', String(visible));
}

async function init() {
  try {
    updateLoading(7, 'Descargando mina completa…');
    const response = await fetch(mineCsvUrl);
    if (!response.ok) throw new Error(`No se pudo cargar la mina (${response.status})`);
    const text = await response.text();
    updateLoading(18, 'Interpretando geometría topográfica…');
    const { buckets, triangles } = await parseMineCsv(text);
    updateLoading(84, 'Construyendo mallas y normales…');
    await new Promise(resolve => requestAnimationFrame(resolve));
    const elements = buildMeshes(buckets);
    const size = allBounds.getSize(new THREE.Vector3());
    const center = allBounds.getCenter(new THREE.Vector3());
    const gridSize = Math.ceil(Math.max(size.x, size.z) / 50) * 50;
    const grid = new THREE.GridHelper(gridSize, gridSize / 10, 0x715d3a, 0x282b2b);
    grid.position.set(center.x, allBounds.min.y - .5, center.z);
    grid.material.transparent = true;
    grid.material.opacity = .35;
    scene.add(grid);
    document.getElementById('stat-elements').textContent = elements;
    document.getElementById('stat-triangles').textContent = formatInt(triangles);
    document.getElementById('stat-size').textContent = `${Math.round(size.x)} × ${Math.round(size.z)} × ${Math.round(size.y)} m`;
    elevationCut.min = Math.floor(allBounds.min.y);
    elevationCut.max = Math.ceil(allBounds.max.y) + 1;
    elevationCut.value = elevationCut.max;
    clippingPlane.constant = Number(elevationCut.value);
    populateList();
    showAll();
    updateLoading(100, 'Mina lista');
    setTimeout(() => loadingScreen.classList.add('hidden'), 220);
  } catch (error) {
    console.error(error);
    updateLoading(100, `Error: ${error.message}`);
    loadingProgress.style.background = '#b94a3c';
  }
}

document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => {
    const box = selectedId ? new THREE.Box3().setFromObject(objectById.get(selectedId)) : allBounds;
    fitBox(box, button.dataset.view);
  });
});
document.getElementById('focus-all').addEventListener('click', () => showAll());
document.getElementById('wireframe-toggle').addEventListener('click', event => {
  const enabled = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  event.currentTarget.setAttribute('aria-pressed', String(enabled));
  rockMaterial.wireframe = enabled;
  serviceMaterial.wireframe = enabled;
});
document.getElementById('services-toggle').addEventListener('click', () => setServicesVisible(!servicesVisible));
elevationCut.addEventListener('input', () => {
  const value = Number(elevationCut.value);
  clippingPlane.constant = value;
  elevationValue.textContent = value >= Number(elevationCut.max) ? 'Modelo completo' : `${value.toFixed(0)} m`;
});
renderer.domElement.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; });
renderer.domElement.addEventListener('pointerup', event => {
  if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(root.children, true).find(result => result.object.userData.mineId);
  if (hit) selectMine(hit.object.userData.mineId, false);
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
});
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
init();
