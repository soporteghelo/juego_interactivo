import * as THREE from 'three';
import { MineMaterials, PALETTE } from '../world/materials/MineMaterials.js';
import { crearHaz, hayHaz } from './haz_luz.js';

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

  // HALO VOLUMETRICO (md: bombilla incandescente colgante = "halo difuso en neblina"). Cono muy
  // abierto y corto apuntando al piso: una bombilla desnuda no proyecta un pincel, ilumina una
  // campana de vaho a su alrededor. Gateado por `hazLuzFijas` (solo alto/medio).
  if (hayHaz(true)) {
    const haz = crearHaz({
      angulo: Math.PI / 3.4,
      alcance: 4.2,
      color: PALETTE.bombillaCalida,
      intensidad: 0.075
    });
    haz.rotation.x = -Math.PI / 2;   // el eje -Z local pasa a mirar hacia abajo (-Y)
    group.add(haz);
  }

  return group;
}
