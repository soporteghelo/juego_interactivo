import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CATALOGO } from '../elementos/index.js';
import { disposeObject } from '../utils/Disposable.js';

/**
 * VISUALIZADOR DE ELEMENTOS.
 *
 * Renderiza cada elemento de la mina de forma aislada: rota, mide su tamaño,
 * permite wireframe y grilla. Funciona en escritorio (ratón) y en celular
 * (OrbitControls touch: 1 dedo = rotar, 2 dedos = zoom/pan).
 */

const holder = document.getElementById('canvas-holder');

// ── Escena / cámara / renderer ────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15181d);

const camera = new THREE.PerspectiveCamera(
  50,
  holder.clientWidth / holder.clientHeight,
  0.05,
  500
);
camera.position.set(4, 3, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(holder.clientWidth, holder.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
holder.appendChild(renderer.domElement);

// ── OrbitControls — configuracion touch completa ──────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping  = true;
controls.dampingFactor  = 0.08;
controls.rotateSpeed    = 0.75;
controls.zoomSpeed      = 1.1;
controls.panSpeed       = 0.8;
controls.minDistance    = 0.2;
controls.maxDistance    = 80;
controls.target.set(0, 1, 0);

// Gestos táctiles:
//   1 dedo  → rotar
//   2 dedos → zoom (pellizcar) + pan (desplazar)
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN
};

// Pausa la auto-rotacion mientras el usuario esta arrastrando/pellizcando
let interactuando = false;
controls.addEventListener('start', () => { interactuando = true; });
controls.addEventListener('end',   () => {
  // Pequeño retardo para que el objeto no "salte" al recuperar la rotacion
  setTimeout(() => { interactuando = false; }, 180);
});

// ── Iluminacion de editor (clara y neutra) ────────────────────────────────
scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(5, 8, 4);
scene.add(key);
const fill = new THREE.DirectionalLight(0xafc4ff, 0.6);
fill.position.set(-6, 3, -4);
scene.add(fill);

// ── Ayudas visuales ───────────────────────────────────────────────────────
const gridHelper = new THREE.GridHelper(20, 40, 0x39ff14, 0x2c333c);
scene.add(gridHelper);
const axes = new THREE.AxesHelper(1.5);
scene.add(axes);

// ── Estado ────────────────────────────────────────────────────────────────
let actual   = null;   // Object3D del elemento actualmente visible
const animados = [];   // funciones tick recogidas del elemento
let autoRotar = true;
let wireframe = false;

// ── Lista lateral ─────────────────────────────────────────────────────────
const lista  = document.getElementById('lista');
const search = document.getElementById('search');

function pintarLista(filtro = '') {
  lista.innerHTML = '';
  const f = filtro.trim().toLowerCase();
  CATALOGO.forEach((el, i) => {
    if (f && !(`${el.nombre} ${el.id}`.toLowerCase().includes(f))) return;
    const div = document.createElement('div');
    div.className = 'item' + (actual?.userData?.__id === el.id ? ' activo' : '');
    div.textContent = el.nombre;
    div.dataset.index = i;
    div.addEventListener('click', () => mostrar(i));
    lista.appendChild(div);
  });
}

search.addEventListener('input', () => pintarLista(search.value));

// ── Mostrar elemento ──────────────────────────────────────────────────────
function mostrar(index) {
  const el = CATALOGO[index];
  if (!el) return;

  if (actual) { disposeObject(actual); actual = null; }
  animados.length = 0;

  const obj = el.crear();
  obj.userData.__id = el.id;
  scene.add(obj);
  actual = obj;

  // Recolecta animaciones (userData.tick) del elemento y sus hijos
  obj.traverse((c) => { if (c.userData?.tick) animados.push(c.userData.tick); });

  aplicarWireframe();

  // Bounding box: tamaño, centro y distancia de encuadre
  const box    = new THREE.Box3().setFromObject(obj);
  const size   = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  document.getElementById('nombre').textContent = el.nombre;
  document.getElementById('desc').textContent   = el.descripcion || '';
  document.getElementById('dims').textContent   =
    `Dimensiones: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m  ·  id: ${el.id}`;

  // Encuadra la cámara proporcional al tamaño del objeto
  const radio = Math.max(size.length() * 0.65, 0.5);
  controls.target.copy(center);
  camera.position.copy(center).add(
    new THREE.Vector3(radio, radio * 0.65, radio * 1.2)
  );
  camera.near = radio / 100;
  camera.far  = radio * 120;
  camera.updateProjectionMatrix();
  controls.update();

  // Reiniciar rotacion acumulada para que el objeto arranque siempre de frente
  actual.rotation.y = 0;

  pintarLista(search.value);
}

function aplicarWireframe() {
  if (!actual) return;
  actual.traverse((c) => {
    if (c.isMesh && c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach((m) => { if ('wireframe' in m) m.wireframe = wireframe; });
    }
  });
}

// ── Controles de UI ───────────────────────────────────────────────────────
document.getElementById('autorot').addEventListener('change', (e) => {
  autoRotar = e.target.checked;
  if (actual) actual.rotation.y = 0; // evita salto al reactivar
});
document.getElementById('grid').addEventListener('change', (e) => {
  gridHelper.visible = e.target.checked;
});
document.getElementById('wire').addEventListener('change', (e) => {
  wireframe = e.target.checked;
  aplicarWireframe();
});

// ── Resize ───────────────────────────────────────────────────────────────
function onResize() {
  // En mobile el canvas puede haber cambiado de tamaño al abrir/cerrar el panel
  const w = holder.clientWidth;
  const h = holder.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

// Observa cambios de tamaño del contenedor del canvas (panel abierto/cerrado)
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(onResize).observe(holder);
}

// ── Bucle de render ───────────────────────────────────────────────────────
const clock = new THREE.Clock();
function animar() {
  requestAnimationFrame(animar);
  const dt = clock.getDelta();
  const t  = clock.elapsedTime;

  // Auto-rotacion: se pausa mientras el usuario interactua con el objeto
  if (autoRotar && actual && !interactuando) {
    actual.rotation.y += dt * 0.45;
  }

  animados.forEach((fn) => fn(dt, t));
  controls.update();
  renderer.render(scene, camera);
}

// ── Arranque ─────────────────────────────────────────────────────────────
pintarLista();
mostrar(0);
animar();
