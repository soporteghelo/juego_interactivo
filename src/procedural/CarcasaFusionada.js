import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * CARCASA FUSIONADA — una copia ESTÁTICA y de pocas mallas de un equipo, para verlo de lejos.
 *
 * POR QUÉ EXISTE. `BatchStatics` no puede tocar un equipo: la máquina lleva `userData.tick`,
 * `interactable` y `hazard` en su raíz, y la regla de seguridad protege todo el subárbol. Medido
 * en el juego cargado: una camioneta aparcada son 348 mallas y un scoop 314 — cada una su propia
 * llamada de dibujo. Con 13 equipos en el mapa eso domina el presupuesto de draw calls en móvil.
 *
 * No se puede fusionar la máquina "en su sitio" porque su `tick` guarda REFERENCIAS DIRECTAS a
 * las piezas que anima (ruedas, cilindros hidráulicos, baliza, articulación); quitarlas del padre
 * rompería la animación en silencio — sin error, solo una pieza que deja de moverse.
 *
 * La salida de aquí es un objeto SEPARADO: la jerarquía original no se toca. `ActoresLod` enseña
 * la jerarquía completa y animada cuando el jugador está cerca —que es cuando inspecciona la
 * máquina— y cambia a esta carcasa a media distancia, donde la mina ya está en penumbra y la
 * diferencia entre una rueda girando y una quieta no se percibe.
 *
 * La carcasa CONGELA la pose del momento en que se construye. Se construye tarde (la primera vez
 * que hace falta) para que el equipo ya esté en su pose de reposo definitiva.
 */

/** Firma de atributos: dos geometrías solo se pueden fusionar si coinciden exactamente. */
function firmaGeometria(geo) {
  const attrs = Object.keys(geo.attributes).sort()
    .map(n => `${n}${geo.attributes[n].itemSize}`)
    .join(',');
  return `${attrs}|${geo.index ? 'i' : 'n'}`;
}

/**
 * Construye la carcasa fusionada de `raiz`.
 *
 * A diferencia de `batchStaticMeshes`, aquí SÍ se absorben las mallas con nombre y con
 * comportamiento: la carcasa es una copia aparte que nunca se anima, así que no hay nada que
 * romper. Se respetan material, sombras y `renderOrder` para que el aspecto no cambie.
 *
 * @param {THREE.Object3D} raiz  equipo ya posicionado en el mundo
 * @returns {THREE.Group|null}   grupo con las mallas fusionadas (en el espacio local de `raiz`)
 */
export function construirCarcasa(raiz) {
  if (!raiz) return null;
  raiz.updateMatrixWorld(true);
  const inversa = new THREE.Matrix4().copy(raiz.matrixWorld).invert();

  const lotes = new Map();
  raiz.traverse(obj => {
    if (!obj.isMesh || obj.isSkinnedMesh || obj.isInstancedMesh) return;
    if (!obj.visible || !obj.geometry || !obj.material) return;
    if (Array.isArray(obj.material)) return;               // multi-material: se deja fuera
    const clave = `${obj.material.uuid}|${obj.castShadow ? 1 : 0}${obj.receiveShadow ? 1 : 0}|${firmaGeometria(obj.geometry)}|${obj.renderOrder}`;
    if (!lotes.has(clave)) lotes.set(clave, []);
    lotes.get(clave).push(obj);
  });
  if (!lotes.size) return null;

  const carcasa = new THREE.Group();
  carcasa.name = `${raiz.name || 'equipo'}_carcasa`;
  // La carcasa no se mueve nunca: ahorra a Three recomponer su matriz cada frame.
  carcasa.matrixAutoUpdate = false;
  const matriz = new THREE.Matrix4();

  for (const piezas of lotes.values()) {
    const geometrias = [];
    for (const pieza of piezas) {
      matriz.multiplyMatrices(inversa, pieza.matrixWorld);
      const geo = pieza.geometry.clone();
      geo.applyMatrix4(matriz);
      geometrias.push(geo);
    }
    let fusion = null;
    try {
      fusion = mergeGeometries(geometrias, false);
    } catch { /* geometrías incompatibles: ese lote se descarta */ }
    for (const g of geometrias) g.dispose();
    if (!fusion) continue;

    const modelo = piezas[0];
    const malla = new THREE.Mesh(fusion, modelo.material);
    malla.castShadow = modelo.castShadow;
    malla.receiveShadow = modelo.receiveShadow;
    malla.renderOrder = modelo.renderOrder;
    malla.matrixAutoUpdate = false;
    // Que nadie la confunda con una pieza real: no es interactuable ni fusionable otra vez.
    malla.userData.noBatch = true;
    carcasa.add(malla);
  }

  if (!carcasa.children.length) return null;
  carcasa.updateMatrixWorld(true);
  return carcasa;
}

/** Libera la geometría propia de una carcasa (los materiales son compartidos: NO se tocan). */
export function liberarCarcasa(carcasa) {
  if (!carcasa) return;
  for (const m of carcasa.children) m.geometry?.dispose();
  carcasa.removeFromParent();
}
