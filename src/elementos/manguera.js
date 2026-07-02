import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';

/**
 * MANGUERA — md: mangueras de agua (amarillas/blancas) y de aire (negras) sobre el piso,
 * serpenteando junto al borde del carril (riesgo de tropiezo).
 */

export const meta = {
  id: 'manguera',
  nombre: 'Manguera (agua/aire)',
  descripcion: 'Manguera tendida en el piso. Verde=agua, azul=aire comprimido.'
};

/**
 * @param {{length?:number, agua?:boolean, baseX?:number}} opts
 * @returns {THREE.Mesh}
 */
export function crear({ length = 12, agua = true, baseX = 0 } = {}) {
  const pts = [];
  const segs = Math.max(6, Math.round(length / 1.5));
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = -t * length;
    const x = baseX + Math.sin(t * Math.PI * 3) * 0.4;
    pts.push(new THREE.Vector3(x, 0.06, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, segs * 2, 0.04, 6, false);
  const mat = agua ? MineMaterials.mangueraVerde() : MineMaterials.mangueraAzul();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = agua ? 'manguera_agua' : 'manguera_aire';
  return mesh;
}
