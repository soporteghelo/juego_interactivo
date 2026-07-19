import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { sub } from '../_comun/subelemento.js';

/**
 * DUCHA DE EMERGENCIA + LAVAOJOS — obligatoria donde se manipulan quimicos
 * (acelerante de shotcrete, electrolito de baterias en subestacion, reactivos).
 * Pedestal amarillo con taza lavaojos verde de dos rociadores, regadera superior,
 * palanca de accionamiento y pedal. Interactuable: [E] repasa el uso correcto.
 *
 * Origen en el PISO; frente = +Z.
 */

export const meta = {
  id: 'ducha_lavaojos',
  nombre: 'Ducha de emergencia y lavaojos',
  descripcion: 'Pedestal amarillo con lavaojos de taza verde, regadera superior, palanca y pedal. Para labores con químicos (shotcrete/subestación). Interactuable.'
};

function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cy(rt, rb, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat); }
function put(grp, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m;
}

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  const mAm  = MineMaterials.plano(0xf5c400, { rough: 0.5, metal: 0.3 });   // tuberia amarilla
  const mVer = MineMaterials.plano(0x1b8a2e, { rough: 0.45 });               // taza/regadera verde
  const mIno = MineMaterials.plano(0xb9bec4, { rough: 0.35, metal: 0.8 });   // inox

  const S = sub(g, 'ducha', 'Ducha y lavaojos',
    'Columna amarilla con regadera superior de accionamiento por palanca, taza lavaojos con dos rociadores y pedal.');

  // Columna principal + brazo superior con regadera
  put(S, cy(0.045, 0.045, 2.45, 10, mAm), 0, 1.23, 0);
  put(S, cy(0.035, 0.035, 0.45, 8, mAm), 0, 2.42, 0.22, Math.PI / 2);
  const regadera = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.05, 0.10, 14), mVer);
  put(S, regadera, 0, 2.34, 0.44);
  // Palanca colgante (triangulo + varilla)
  put(S, cy(0.008, 0.008, 0.55, 6, mIno), 0.12, 2.10, 0.44);
  put(S, bx(0.16, 0.10, 0.02, mVer), 0.12, 1.78, 0.44);

  // Taza lavaojos + rociadores + tapa abatible
  const taza = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 0.12, 14), mVer);
  put(S, taza, 0, 1.05, 0.26);
  for (const sx of [-0.07, 0.07]) put(S, cy(0.02, 0.02, 0.08, 6, mIno), sx, 1.13, 0.26);
  // Pedal de accionamiento
  put(S, bx(0.26, 0.03, 0.14, mIno), 0, 0.12, 0.34);
  put(S, cy(0.015, 0.015, 0.30, 6, mAm), -0.12, 0.55, 0.30, 0.5);
  // Base anclada
  put(S, cy(0.14, 0.17, 0.06, 10, mIno), 0, 0.03, 0);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.name = 'ducha_lavaojos';
  g.userData.interactable = {
    object: g,
    descriptor: {
      label: 'Revisar ducha lavaojos',
      onInteract: () => window.__mina?.bus.emit('ui:read', {
        title: 'DUCHA DE EMERGENCIA Y LAVAOJOS',
        body:
          'Ante contacto con químicos (acelerante de shotcrete, electrolito, reactivos):\n\n' +
          '1. Acude DE INMEDIATO — cada segundo cuenta con quemaduras químicas.\n' +
          '2. OJOS: mantén los párpados abiertos sobre los rociadores 15 MINUTOS.\n' +
          '3. PIEL: retira la ropa contaminada bajo la regadera (palanca).\n' +
          '4. Reporta al supervisor y acude a la posta aunque no sientas dolor.\n\n' +
          'Se prueba semanalmente: flujo continuo y agua limpia.'
      })
    }
  };
  return g;
}
