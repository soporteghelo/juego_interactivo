import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CATALOGO } from '../elementos/index.js';
import { recolectarSubelementos } from '../elementos/_comun/subelemento.js';
import { disposeObject } from '../utils/Disposable.js';
import { precargarMinero, actualizar as actualizarMinero } from '../elementos/personas/minero.js';

/**
 * VISUALIZADOR DE ELEMENTOS.
 *
 * Renderiza cada elemento de la mina de forma aislada: rota, mide su tamaño,
 * permite wireframe y grilla. Funciona en escritorio (ratón) y en celular
 * (OrbitControls touch: 1 dedo = rotar, 2 dedos = zoom/pan).
 *
 * DISCRETIZACIÓN: los elementos complejos exponen SUBELEMENTOS (grupos con
 * userData.subelemento). Al seleccionar el elemento, sus subelementos se
 * listan debajo en el panel; al hacer clic en uno, se AÍSLA (solo esa parte
 * queda visible) y la cámara lo encuadra para inspección/edición.
 *
 * PERSISTENCIA: la selección (elemento + subelemento) se guarda en
 * localStorage; al recargar la página (p. ej. por un cambio de código con
 * Vite) se restaura la misma vista en lugar de volver al primer objeto.
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
let subGrupos = [];    // subelementos (grupos etiquetados) del elemento actual
let subSel    = null;  // subelemento aislado actualmente (null = elemento completo)

// ── Persistencia de la selección (sobrevive recargas / HMR de Vite) ──────
const LS_KEY = 'visor.seleccion';
function guardarSeleccion() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      id:  actual?.userData?.__id ?? null,
      sub: subSel?.userData?.subelemento?.id ?? null
    }));
  } catch { /* almacenamiento no disponible: se ignora */ }
}
function leerSeleccion() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; }
}

// ── Lista lateral ─────────────────────────────────────────────────────────
const lista  = document.getElementById('lista');
const search = document.getElementById('search');

function pintarLista(filtro = '') {
  lista.innerHTML = '';
  const f = filtro.trim().toLowerCase();
  CATALOGO.forEach((el, i) => {
    if (f && !(`${el.nombre} ${el.id}`.toLowerCase().includes(f))) return;
    const esActivo = actual?.userData?.__id === el.id;
    const div = document.createElement('div');
    div.className = 'item' + (esActivo ? ' activo' : '');
    div.textContent = el.nombre;
    div.dataset.index = i;
    div.addEventListener('click', () => mostrar(i));
    lista.appendChild(div);

    // ── Subelementos del elemento activo (discretización) ────────────
    if (esActivo && subGrupos.length) {
      const completo = document.createElement('div');
      completo.className = 'subitem' + (!subSel ? ' activo' : '');
      completo.textContent = '⬒ Elemento completo';
      completo.addEventListener('click', () => seleccionarSub(null));
      lista.appendChild(completo);
      for (const sg of subGrupos) {
        const metaSub = sg.userData.subelemento;
        const sdiv = document.createElement('div');
        sdiv.className = 'subitem' + (subSel === sg ? ' activo' : '');
        sdiv.textContent = metaSub.nombre;
        sdiv.title = metaSub.descripcion || '';
        sdiv.addEventListener('click', () => seleccionarSub(metaSub.id));
        lista.appendChild(sdiv);
      }
    }
  });
}

search.addEventListener('input', () => pintarLista(search.value));

// ── Mostrar elemento ──────────────────────────────────────────────────────
function mostrar(index) {
  const el = CATALOGO[index];
  if (!el) return;

  if (actual) {
    // El minero FBX comparte geometría/materiales entre clones (SkeletonUtils.clone):
    // NO se debe disposear o romperíamos los siguientes clones. Solo se quita de la escena.
    if (actual.userData?.anim) actual.parent?.remove(actual);
    else disposeObject(actual);
    actual = null;
  }
  animados.length = 0;
  subGrupos = [];
  subSel = null;

  const obj = el.crear();
  obj.userData.__id = el.id;
  obj.userData.__meta = el;
  scene.add(obj);
  actual = obj;

  // Recolecta animaciones (userData.tick) del elemento y sus hijos
  obj.traverse((c) => { if (c.userData?.tick) animados.push(c.userData.tick); });

  // Subelementos etiquetados de primer nivel (discretización)
  subGrupos = recolectarSubelementos(obj);

  aplicarWireframe();

  // Reiniciar rotacion acumulada para que el objeto arranque siempre de frente
  actual.rotation.y = 0;
  actual.updateMatrixWorld(true);

  encuadrar(actual);
  actualizarInfo();
  guardarSeleccion();
  pintarLista(search.value);
}

/**
 * Aísla un subelemento del elemento actual: solo esa parte queda visible y
 * la cámara la encuadra. `null` restaura el elemento completo.
 * @param {string|null} idSub
 */
function seleccionarSub(idSub) {
  if (!actual) return;
  subSel = idSub
    ? subGrupos.find((s) => s.userData.subelemento.id === idSub) || null
    : null;

  aislar(actual, subSel);

  // El subelemento aislado se muestra estático (sin autorrotación) y de
  // frente, para poder medirlo/inspeccionarlo con precisión.
  actual.rotation.y = 0;
  actual.updateMatrixWorld(true);

  encuadrar(subSel || actual);
  actualizarInfo();
  guardarSeleccion();
  pintarLista(search.value);
}

/** Muestra solo `sel` (y sus ancestros). Con sel=null todo vuelve a ser visible. */
function aislar(root, sel) {
  if (!sel) { root.traverse((o) => { o.visible = true; }); return; }
  root.traverse((o) => { o.visible = false; });
  sel.traverse((o) => { o.visible = true; });
  for (let p = sel; p && p !== root; p = p.parent) p.visible = true;
  root.visible = true;
}

/** Encuadra la cámara proporcional al bounding box del objeto dado. */
function encuadrar(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return;
  const size   = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const radio = Math.max(size.length() * 0.65, 0.5);
  controls.target.copy(center);
  camera.position.copy(center).add(
    new THREE.Vector3(radio, radio * 0.65, radio * 1.2)
  );
  camera.near = radio / 100;
  camera.far  = radio * 120;
  camera.updateProjectionMatrix();
  controls.update();
}

/** Refresca nombre/descripcion/dimensiones según elemento o subelemento activo. */
function actualizarInfo() {
  const el = actual?.userData?.__meta;
  if (!el) return;
  const objetivo = subSel || actual;
  const box  = new THREE.Box3().setFromObject(objetivo);
  const size = new THREE.Vector3();
  if (!box.isEmpty()) box.getSize(size);
  const dims = `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m`;

  if (subSel) {
    const metaSub = subSel.userData.subelemento;
    document.getElementById('nombre').textContent = `${el.nombre} — ${metaSub.nombre}`;
    document.getElementById('desc').textContent   = metaSub.descripcion || '';
    document.getElementById('dims').textContent   =
      `Dimensiones: ${dims}  ·  subelemento: ${metaSub.id}  ·  id: ${el.id}`;
  } else {
    const nSubs = subGrupos.length ? `  ·  ${subGrupos.length} subelementos` : '';
    document.getElementById('nombre').textContent = el.nombre;
    document.getElementById('desc').textContent   = el.descripcion || '';
    document.getElementById('dims').textContent   =
      `Dimensiones: ${dims}  ·  id: ${el.id}${nSubs}`;
  }
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
  // o mientras hay un SUBELEMENTO aislado (inspección estática).
  if (autoRotar && actual && !interactuando && !subSel) {
    actual.rotation.y += dt * 0.45;
  }

  // Minero FBX: avanza su animación de esqueleto (camina en el sitio) + EPP en huesos.
  // Velocidad nominal de marcha → cadencia natural (timeScale≈1) en la vista del visor.
  if (actual?.userData?.anim) actualizarMinero(actual, dt, true, false, 1.15);

  animados.forEach((fn) => fn(dt, t));
  controls.update();
  renderer.render(scene, camera);
}

// ── Arranque ─────────────────────────────────────────────────────────────
// Restaura la última selección guardada: si estabas viendo el refugio y el
// código cambió (recarga de Vite), sigues viendo el refugio (y el mismo
// subelemento). Si no hay selección guardada, arranca en el primer elemento.
const guardada = leerSeleccion();
const idxIni = guardada?.id ? CATALOGO.findIndex((e) => e.id === guardada.id) : -1;
pintarLista();
mostrar(idxIni >= 0 ? idxIni : 0);
if (idxIni >= 0 && guardada?.sub) seleccionarSub(guardada.sub);
animar();

// Carga el FBX del minero en segundo plano. Si el elemento visible es un minero que
// se mostró como fallback procedural, lo recarga ya con el modelo FBX real.
precargarMinero().then(() => {
  if (actual?.userData?.__id?.startsWith('minero_')) {
    const i = CATALOGO.findIndex((e) => e.id === actual.userData.__id);
    if (i >= 0) mostrar(i);
  }
});
