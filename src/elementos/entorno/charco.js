import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';

/**
 * CHARCO DE AGUA — md: charcos con reflejo metalico, muy presentes; no olvidar el reflejo
 * del suelo mojado. Plano casi-espejo oscuro a ras de piso.
 */

export const meta = {
  id: 'charco',
  nombre: 'Charco de agua',
  descripcion: 'Agua estancada reflectiva en el piso. Muy presente en toda la mina.'
};

/**
 * @param {{radio?:number}} opts
 * @returns {THREE.Mesh}
 */
export function crear({ radio = 1.1 } = {}) {
  const geo = new THREE.CircleGeometry(radio, 18);
  const mesh = new THREE.Mesh(geo, MineMaterials.charco());
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.015;
  mesh.scale.set(1, 0.6 + Math.random() * 0.8, 1);
  mesh.name = 'charco';
  return mesh;
}

// ── Instanciado: geometria unitaria plana (radio 1) compartida ──────────────
// Un solo CircleGeometry apoyado en el piso (rotacion ya horneada) para que las
// instancias solo necesiten trasladar + escalar. Elimina ~11 draw calls por tramo.
let _geoCache = null;

/** Geometria base del charco (radio 1, horizontal). Se comparte entre instancias. */
export function geometriaCharco() {
  if (_geoCache) return _geoCache;
  const geo = new THREE.CircleGeometry(1, 18);
  geo.rotateX(-Math.PI / 2);   // horneada: queda plana sobre el suelo
  _geoCache = geo;
  return _geoCache;
}

/** Material reflectivo compartido (mismo que crear()). */
export function materialCharco() {
  return MineMaterials.charco();
}
