import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * FUSION DE ESTATICOS — junta en una sola malla todas las piezas quietas de un tramo que
 * comparten material.
 *
 * Por que: cada elemento de la mina (tablero, refugio, estacion de emergencia, manguera,
 * barandas, equipo estacionado…) se modela con decenas de cajas y cilindros pequeños. Medido en
 * el juego cargado: ~6.600 mallas visibles, de las cuales ~6.300 eran piezas anonimas de props.
 * Cada una es una llamada de dibujo y un objeto que Three recorre en cada frame. Fusionadas por
 * material bajan a unas pocas por tramo, con el MISMO aspecto (misma geometria, mismos
 * materiales, mismas sombras) — solo desaparece el coste de dibujarlas por separado.
 *
 * REGLA DE SEGURIDAD: solo se fusionan mallas ANONIMAS. Si una malla tiene `name`, algo del
 * juego puede buscarla (`shell`, `node_luz`, `floor`, señaletica…) y se deja intacta. Ademas se
 * respeta todo lo que tenga comportamiento o lo consulte otro sistema:
 *   - `userData.tick`        → se anima (ventiladores, balizas, agua, roca colgada)
 *   - `userData.interactable`→ el jugador la usa
 *   - `userData.hazard`      → el HazardSystem le calcula la caja
 *   - `userData.signText`    → es un letrero legible
 *   - `userData.noBatch`     → exclusion explicita
 *   - materiales transparentes o sin `depthWrite` → su orden de dibujado importa (calcos, agua)
 *   - mallas con hijos, instanciadas, con esqueleto o multi-material
 *
 * Se debe llamar DESPUES de construir colisionadores y solidos de props (esos leen la jerarquia
 * original) y despues de posicionar el grupo en el mundo.
 */

const PROTEGIDO = ['tick', 'interactable', 'hazard', 'signText', 'noBatch'];

/** Firma de atributos: dos geometrias solo se pueden fusionar si coinciden exactamente. */
function firmaGeometria(geo) {
  const attrs = Object.keys(geo.attributes).sort()
    .map(n => `${n}${geo.attributes[n].itemSize}`)
    .join(',');
  return `${attrs}|${geo.index ? 'i' : 'n'}`;
}

/** True si la malla se puede fusionar sin cambiar el comportamiento del juego. */
function esFusionable(mesh) {
  if (!mesh.isMesh) return false;
  if (mesh.isInstancedMesh || mesh.isSkinnedMesh || mesh.isBatchedMesh) return false;
  if (mesh.name) return false;                       // alguien puede buscarla por nombre
  if (mesh.children.length) return false;            // cuelga algo de ella
  if (Array.isArray(mesh.material)) return false;    // multi-material (grupos de geometria)
  if (!mesh.geometry || !mesh.material) return false;
  if (mesh.geometry.morphAttributes && Object.keys(mesh.geometry.morphAttributes).length) return false;
  for (const clave of PROTEGIDO) if (mesh.userData?.[clave]) return false;
  const mat = mesh.material;
  if (mat.transparent || mat.depthWrite === false) return false;  // el orden de dibujado importa
  return true;
}

/**
 * Fusiona las piezas estaticas anonimas de `root`, agrupandolas por material.
 *
 * @param {THREE.Object3D} root        grupo del tramo (ya posicionado en el mundo)
 * @param {{minimo?:number}} [opts]    minimo de piezas para que valga la pena fusionar
 * @returns {{fusionadas:number, resultantes:number}} piezas absorbidas y mallas creadas
 */
export function batchStaticMeshes(root, { minimo = 3 } = {}) {
  if (!root) return { fusionadas: 0, resultantes: 0 };
  root.updateMatrixWorld(true);
  const inversaRaiz = new THREE.Matrix4().copy(root.matrixWorld).invert();

  // Un lote por (material, sombras, firma de atributos): son las condiciones que exige la fusion.
  const lotes = new Map();
  const protegidos = new Set();

  root.traverse(obj => {
    // Todo lo que cuelgue de un objeto con comportamiento queda fuera, aunque sea anonimo.
    if (obj !== root && (protegidos.has(obj.parent) || PROTEGIDO.some(c => obj.userData?.[c]))) {
      protegidos.add(obj);
      return;
    }
    if (!esFusionable(obj)) return;
    const clave = `${obj.material.uuid}|${obj.castShadow ? 1 : 0}${obj.receiveShadow ? 1 : 0}|${firmaGeometria(obj.geometry)}|${obj.renderOrder}`;
    if (!lotes.has(clave)) lotes.set(clave, []);
    lotes.get(clave).push(obj);
  });

  let fusionadas = 0, resultantes = 0;
  const matriz = new THREE.Matrix4();

  for (const piezas of lotes.values()) {
    if (piezas.length < minimo) continue;
    const geometrias = [];
    for (const pieza of piezas) {
      // Hornea la posicion de cada pieza RELATIVA al tramo: el resultado se mueve con el grupo.
      matriz.multiplyMatrices(inversaRaiz, pieza.matrixWorld);
      const geo = pieza.geometry.clone();
      geo.applyMatrix4(matriz);
      geometrias.push(geo);
    }
    let fusion = null;
    try {
      fusion = mergeGeometries(geometrias, false);
    } catch { /* geometrias incompatibles: se dejan como estaban */ }
    for (const g of geometrias) g.dispose();
    if (!fusion) continue;

    const modelo = piezas[0];
    const malla = new THREE.Mesh(fusion, modelo.material);
    malla.castShadow = modelo.castShadow;
    malla.receiveShadow = modelo.receiveShadow;
    malla.renderOrder = modelo.renderOrder;
    malla.name = 'estaticos_fusionados';
    malla.userData.noBatch = true;               // no volver a fusionar en una segunda pasada
    root.add(malla);

    // OJO: NO se libera `pieza.geometry` — media mina comparte geometrias cacheadas (pernos,
    // rocas, postes). Liberarlas aqui reventaria a los demas usuarios de ese mismo buffer.
    for (const pieza of piezas) pieza.removeFromParent();
    fusionadas += piezas.length;
    resultantes++;
  }

  return { fusionadas, resultantes };
}
