import * as THREE from 'three';
import { MineMaterials, PALETTE } from '../world/materials/MineMaterials.js';

/**
 * Bombilla incandescente colgante (md: amarillo-naranja calido #ffcc44, halo difuso en
 * neblina). Tipica de galerias de trabajo sin LED. Cable + casquillo + bulbo emisivo +
 * un PointLight calido si hay presupuesto.
 *
 * @param {object} o
 * @param {THREE.Vector3} o.position  posicion del bulbo (local al segmento)
 * @returns {THREE.Group}
 */
export function createHangingBulb({ position, lighting }) {
  const group = new THREE.Group();
  group.position.copy(position);

  // Cable corto
  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4),
    MineMaterials.cable()
  );
  cable.position.y = 0.25;
  group.add(cable);

  // Bulbo emisivo (alimenta el bloom -> halo)
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    MineMaterials.bombilla()
  );
  group.add(bulb);

  if (lighting?.canAddLight()) {
    const light = new THREE.PointLight(PALETTE.bombillaCalida, 28, 18, 2);
    group.add(light);
    lighting.noteLight();
  }

  return group;
}
