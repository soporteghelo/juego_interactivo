import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';

/**
 * ROCA SUELTA / ESCOMBROS — md: escombros angulares 5–50cm al pie de la pared; en zonas de
 * peligro, roca con mineralizacion dorada (sulfuros). Geometria angular para instanciar.
 */

export const meta = {
  id: 'roca_suelta',
  nombre: 'Roca suelta / escombros',
  descripcion: 'Fragmentos angulares al pie de la pared. Variante mineralizada (sulfuros dorados).'
};

let _geo = null;

export function geometriaRoca() {
  if (!_geo) _geo = new THREE.DodecahedronGeometry(0.18, 0);
  return _geo;
}

export function materialRoca(mineralizada = false) {
  return mineralizada ? MineMaterials.rocaMineralizada() : MineMaterials.roca();
}

/**
 * Crea un monton de roca suelta (para el visualizador).
 * @param {{cantidad?:number, mineralizada?:boolean}} opts
 * @returns {THREE.Group}
 */
export function crear({ cantidad = 12, mineralizada = false } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < cantidad; i++) {
    const m = new THREE.Mesh(geometriaRoca(), materialRoca(mineralizada));
    const s = 0.4 + Math.random() * 1.6;
    m.scale.setScalar(s);
    m.position.set((Math.random() - 0.5) * 1.6, 0.1 + Math.random() * 0.15, (Math.random() - 0.5) * 1.2);
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    g.add(m);
  }
  g.name = 'roca_suelta';
  return g;
}
