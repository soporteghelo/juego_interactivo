import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';

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
