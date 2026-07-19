import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { sub } from '../_comun/subelemento.js';

/**
 * PILA DE MINERAL (muck pile) — montón de roca volada en el fondo de una cámara/stope,
 * listo para ser cargado por el LHD. "Respira": el ciclo de acarreo (HaulCycle) la BAJA de
 * nivel al muck-ear y se regenera lentamente (siguiente disparo/limpieza).
 *
 * API: `userData.pila.extraer(f)` baja el nivel; el `userData.tick` regenera lento y aplica
 * la escala (0.7↔1.0). Que tenga tick lo EXIME del congelado de matrices del mundo.
 *
 * Origen en el PISO; el cono se apoya en y=0.
 */

export const meta = {
  id: 'pila_mineral',
  nombre: 'Pila de mineral (muck pile)',
  descripcion: 'Montón cónico de roca mineralizada con bolones sueltos. Se agota al cargarla y se regenera. userData.pila.extraer().'
};

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  const mRoca = MineMaterials.roca();

  const S = sub(g, 'monticulo', 'Montículo y bolones',
    'Cono achatado de material volado con bolones de sulfuro sobresaliendo.');

  // Cono achatado (el muck no es liso: pocas caras = aspecto pedregoso)
  const cono = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.4, 9, 1), mRoca);
  cono.position.y = 0.68; cono.rotation.y = 0.4;
  S.add(cono);
  // Falda inferior mas ancha
  const falda = new THREE.Mesh(new THREE.ConeGeometry(2.5, 0.5, 10, 1), mRoca);
  falda.position.y = 0.24;
  S.add(falda);
  // Bolones sueltos encima/alrededor (mineralizados = un poco mas claros)
  const mMin = MineMaterials.plano(0x8a7a52, { rough: 0.85, metal: 0.15 });
  const lump = new THREE.IcosahedronGeometry(0.34, 0);
  for (const [x, y, z, s] of [
    [0.2, 1.25, 0.1, 1.0], [-0.7, 0.7, 0.5, 1.3], [0.8, 0.55, -0.4, 1.1],
    [-0.3, 0.4, -0.8, 0.9], [1.1, 0.3, 0.6, 1.2], [-1.0, 0.28, -0.3, 1.0]
  ]) {
    const b = new THREE.Mesh(lump, (x + z) > 0.4 ? mMin : mRoca);
    b.position.set(x, y, z); b.scale.setScalar(s);
    b.rotation.set(x * 2, z * 3, y);
    S.add(b);
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.name = 'pila_mineral';

  const estado = { nivel: 1 };
  g.userData.pila = {
    get nivel() { return estado.nivel; },
    /** Baja el nivel al cargar (fraccion 0..1). */
    extraer(f = 0.08) { estado.nivel = Math.max(0.3, estado.nivel - f); }
  };
  g.userData.tick = (dt) => {
    estado.nivel = Math.min(1, estado.nivel + dt * 0.02);   // regenera lento
    const s = 0.7 + 0.3 * estado.nivel;
    g.scale.set(s, s, s);
  };
  return g;
}
