import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crear as crearPuntera } from './puntera_agua.js';

/**
 * MANGUERA — md: mangueras de agua (amarillas/blancas) y de aire (negras) sobre el piso,
 * serpenteando junto al borde del carril (riesgo de tropiezo).
 *
 * Las mangueras de AGUA llevan en cada extremo su PUNTERA (acople) con CABLE ANTILATIGAZO
 * (whip-check), como en las fotos reales de mina. Ver puntera_agua.js.
 */

export const meta = {
  id: 'manguera',
  nombre: 'Manguera (agua/aire)',
  descripcion: 'Manguera tendida en el piso. Verde=agua, azul=aire comprimido. Las de agua llevan puntera + cable antilatigazo en sus extremos.'
};

const RADIO = 0.04; // radio del tubo de la manguera

/**
 * @param {{length?:number, agua?:boolean, baseX?:number, punteras?:boolean}} opts
 * @returns {THREE.Mesh|THREE.Group}
 */
export function crear({ length = 12, agua = true, baseX = 0, punteras = agua } = {}) {
  const pts = [];
  const segs = Math.max(6, Math.round(length / 1.5));
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = -t * length;
    const x = baseX + Math.sin(t * Math.PI * 3) * 0.4;
    pts.push(new THREE.Vector3(x, 0.06, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, segs * 2, RADIO, 6, false);
  const mat = agua ? MineMaterials.mangueraVerde() : MineMaterials.mangueraAzul();
  const hose = new THREE.Mesh(geo, mat);
  hose.name = agua ? 'manguera_agua' : 'manguera_aire';
  hose.castShadow = true;

  if (!punteras) return hose;

  // Punteras (acople + cable antilatigazo) en ambos extremos, orientadas según la tangente.
  const g = new THREE.Group();
  g.name = hose.name;
  g.add(hose);
  for (const t of [0, 1]) {
    const p = curve.getPoint(t);
    const outward = curve.getTangent(t).normalize();
    if (t === 0) outward.negate(); // en el arranque, la tangente apunta hacia adentro
    const pu = crearPuntera({ diam: RADIO * 2 });
    pu.position.copy(p);
    pu.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward);
    g.add(pu);
  }
  return g;
}
