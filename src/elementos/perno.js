import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MineMaterials } from '../world/materials/MineMaterials.js';

/**
 * PERNO DE ROCA (rock bolt) — sostenimiento de la galeria.
 * md: Ø22–25mm, sobresale 5–10cm, placa cuadrada ~15×15cm oxidada, patron 1.0–1.5m.
 *
 * Variante "sobresalido": perno mal instalado/aflojado que sobresale mucho mas (riesgo de
 * golpe/atrapamiento), tipico hallazgo de inspeccion geomecanica.
 *
 * Para editar el look del perno, modifica este archivo.
 */

export const meta = {
  id: 'perno',
  nombre: 'Perno de roca',
  descripcion: 'Sostenimiento: vastago + placa + tuerca. Variante sobresalido (hallazgo de inspeccion).'
};

const _geoCache = new Map();

/** Material de acero oxidado del perno. */
export function materialPerno() {
  return MineMaterials.plano(0x8b5a2b, { rough: 0.85, metal: 0.6 });
}

/**
 * Geometria MERGEADA del perno (para instanciar miles con InstancedMesh = 1 draw call).
 * @param {{sobresalido?:boolean}} opts
 */
export function geometriaPerno({ sobresalido = false } = {}) {
  const key = sobresalido ? 'largo' : 'normal';
  if (_geoCache.has(key)) return _geoCache.get(key);

  const largo = sobresalido ? 0.28 : 0.1; // cuanto sobresale de la pared
  const shaft = new THREE.CylinderGeometry(0.012, 0.012, largo, 6);
  shaft.rotateX(Math.PI / 2);
  shaft.translate(0, 0, largo / 2);

  const plate = new THREE.BoxGeometry(0.15, 0.15, 0.02);
  plate.translate(0, 0, 0.005);

  const nut = new THREE.CylinderGeometry(0.025, 0.025, 0.03, 6);
  nut.rotateX(Math.PI / 2);
  nut.translate(0, 0, largo - 0.02);

  const geo = mergeGeometries([shaft, plate, nut]);
  _geoCache.set(key, geo);
  return geo;
}

/**
 * Crea un perno como malla individual (para el visualizador y colocaciones puntuales).
 * @param {{sobresalido?:boolean}} opts
 * @returns {THREE.Mesh}
 */
export function crear({ sobresalido = false } = {}) {
  const mesh = new THREE.Mesh(geometriaPerno({ sobresalido }), materialPerno());
  mesh.name = sobresalido ? 'perno_sobresalido' : 'perno';
  return mesh;
}
