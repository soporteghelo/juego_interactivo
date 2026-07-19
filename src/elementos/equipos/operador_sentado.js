import * as THREE from 'three';
import { MineMaterials, PALETTE } from '../../world/materials/MineMaterials.js';
import { sub } from '../_comun/subelemento.js';

/**
 * OPERADOR SENTADO — minero low-poly en posicion de conduccion, para las CABINAS de los
 * vehiculos (volquete, camioneta, scoop...). Todo vehiculo en movimiento debe verse
 * OPERADO: un equipo que se desplaza "solo" rompe el realismo y ademas es una condicion
 * subestandar que el simulador no debe normalizar.
 *
 * Es deliberadamente barato (~16 mallas, sin esqueleto): se ve tras el vidrio de una
 * cabina, no de cuerpo entero. Coverall naranja + chaleco hi-vis + casco por rol con
 * lampara. Origen = punto del ASIENTO (cadera); mira a +Z (mismo criterio que los
 * vehiculos: frente = +Z). Brazos extendidos hacia el volante.
 *
 * Uso tipico dentro de otro elemento:
 *   const op = crearOperadorSentado({ rol: 'operador' });
 *   op.position.set(x_asiento, y_cojin, z_asiento);
 *   g.userData.operador = op;   // los sistemas lo muestran/ocultan (visible)
 */

export const meta = {
  id: 'operador_sentado',
  nombre: 'Operador sentado (cabina)',
  descripcion: 'Minero low-poly en posicion de conduccion: coverall naranja, chaleco hi-vis, casco con lampara y brazos al volante. Para cabinas de vehiculos en movimiento.'
};

const CASCO_POR_ROL = {
  operador:    PALETTE.cascoOperario,
  supervisor:  PALETTE.cascoSupervisor,
  geomecanica: PALETTE.cascoGeomecanica
};

function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function put(grp, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m;
}

/**
 * @param {{rol?:string}} opts
 * @returns {THREE.Group}
 */
export function crear({ rol = 'operador' } = {}) {
  const g = new THREE.Group();
  const mOv  = MineMaterials.plano(PALETTE.eppNaranja, { rough: 0.9 });        // coverall
  const mVest= MineMaterials.plano(0xc6e600, { rough: 0.6, emissive: 0x3a4a00, emissiveIntensity: 0.25 }); // chaleco
  const mPiel= MineMaterials.plano(0xc98d63, { rough: 0.85 });                  // piel
  const mBota= MineMaterials.plano(0x111111, { rough: 0.85 });                  // botas/guantes
  const mCasco = MineMaterials.plano(CASCO_POR_ROL[rol] || PALETTE.cascoOperario, { rough: 0.35 });

  const S = sub(g, 'cuerpo', 'Cuerpo sentado',
    'Postura de conduccion: muslos horizontales, tronco erguido con chaleco, brazos al volante, cabeza con casco y lampara.');

  // Pelvis (origen ≈ cojin del asiento) y tronco levemente inclinado adelante
  put(S, bx(0.40, 0.16, 0.32, mOv), 0, 0.08, 0);
  put(S, bx(0.42, 0.52, 0.26, mVest), 0, 0.42, 0.04, 0.08);        // torso con chaleco
  put(S, bx(0.44, 0.14, 0.28, mOv), 0, 0.70, 0.06, 0.08);          // hombros

  // Piernas: muslos horizontales hacia adelante + canillas verticales + botas
  for (const xs of [-1, 1]) {
    put(S, bx(0.15, 0.14, 0.42, mOv), xs * 0.12, 0.07, 0.26);      // muslo
    put(S, bx(0.13, 0.34, 0.13, mOv), xs * 0.12, -0.16, 0.44);     // canilla
    put(S, bx(0.12, 0.09, 0.24, mBota), xs * 0.12, -0.36, 0.50);   // bota
  }

  // Brazos extendidos hacia el volante (+Z) con guantes
  for (const xs of [-1, 1]) {
    put(S, bx(0.11, 0.11, 0.34, mOv), xs * 0.26, 0.60, 0.22, -0.35);   // brazo
    put(S, bx(0.09, 0.09, 0.26, mOv), xs * 0.24, 0.50, 0.44, -0.15);   // antebrazo
    put(S, bx(0.09, 0.08, 0.10, mBota), xs * 0.23, 0.48, 0.58);        // guante
  }

  // Cabeza + casco con visera y lampara frontal
  put(S, new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), mPiel), 0, 0.90, 0.06);
  const casco = new THREE.Mesh(
    new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mCasco);
  put(S, casco, 0, 0.93, 0.05);
  put(S, bx(0.20, 0.02, 0.10, mCasco), 0, 0.94, 0.17, -0.15);      // visera
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 8, 6),
    MineMaterials.plano(PALETTE.headlampFrio, { rough: 0.2, emissive: PALETTE.headlampFrio, emissiveIntensity: 4 })
  );
  put(S, lamp, 0, 0.99, 0.17);

  // Dentro de una cabina: sin sombras (coste) y sin culling raro por animacion del padre.
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.name = 'operador_sentado';
  return g;
}
