import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';

/**
 * BANDEJA DE CABLES — md: bandeja metalica gris a ~2m, cables negros agrupados siguiendo
 * el techo de la galeria.
 */

export const meta = {
  id: 'bandeja_cables',
  nombre: 'Bandeja de cables',
  descripcion: 'Bandeja metalica con haz de cables electricos por la pared/techo.'
};

/**
 * @param {{length?:number, side?:number, height?:number}} opts
 * @returns {THREE.Group}
 */
export function crear({ length = 12, side = -1, height = 2.2 } = {}) {
  const g = new THREE.Group();

  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, length), MineMaterials.acero());
  tray.position.set(0, 0, -length / 2);
  g.add(tray);

  for (let i = 0; i < 3; i++) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, length, 6), MineMaterials.cable());
    cable.rotation.x = Math.PI / 2;
    cable.position.set((i - 1) * 0.05, 0.05, -length / 2);
    g.add(cable);
  }

  g.position.set(side * 0.1, height, 0);
  g.name = 'bandeja_cables';
  return g;
}
