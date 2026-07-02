import * as THREE from 'three';

/**
 * Factory de niveles de detalle (LOD).
 *
 * Optimizacion del plan: props y segmentos lejanos usan geometria mas barata.
 * Envuelve varias representaciones del mismo objeto en un THREE.LOD que Three
 * conmuta automaticamente segun la distancia a la camara.
 *
 * @param {Array<{ object: THREE.Object3D, distance: number }>} levels
 *        niveles ordenados de mas cercano (distance 0) a mas lejano.
 * @returns {THREE.LOD}
 */
export function makeLOD(levels) {
  const lod = new THREE.LOD();
  for (const { object, distance } of levels) {
    lod.addLevel(object, distance);
  }
  return lod;
}
