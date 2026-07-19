import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crearSenal } from '../senal/senal.js';
import { sub } from '../_comun/subelemento.js';

/**
 * TELEFONO DE EMERGENCIA — D.S. 024-2016-EM exige un sistema de comunicacion entre las
 * labores subterraneas y la superficie. Caja estanca AMARILLA montada al hastial con
 * auricular colgado, cable en espiral y señal azul de TELEFONO DE EMERGENCIA.
 * Interactuable: [E] simula la llamada de reporte a superficie.
 *
 * Origen en el PISO contra la pared; frente = +Z (mirando a la via).
 */

export const meta = {
  id: 'telefono_emergencia',
  nombre: 'Teléfono de emergencia',
  descripcion: 'Caja estanca amarilla con auricular y cable en espiral + señal azul. Comunicación labores↔superficie. Interactuable.'
};

function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cy(rt, rb, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat); }
function put(grp, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m;
}

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  const mCaja = MineMaterials.plano(0xf5c400, { rough: 0.55, metal: 0.2 });   // caja amarilla
  const mK    = MineMaterials.plano(0x16181c, { rough: 0.85 });               // auricular/cable
  const mLed  = MineMaterials.plano(0x2eff5e, { rough: 0.3, emissive: 0x2eff5e, emissiveIntensity: 2.5 });

  let S = sub(g, 'caja', 'Caja estanca',
    'Caja estanca amarilla con puerta frontal, bisagras y LED de linea activa.');
  put(S, bx(0.42, 0.55, 0.20, mCaja), 0, 1.45, 0.10);                 // cuerpo
  put(S, bx(0.36, 0.46, 0.03, mCaja), 0, 1.45, 0.215);                // puerta
  for (const y of [1.28, 1.62]) put(S, bx(0.03, 0.06, 0.05, mK), -0.20, y, 0.20); // bisagras
  put(S, cy(0.016, 0.016, 0.03, 8, mLed), 0.14, 1.66, 0.22, Math.PI / 2);         // LED linea

  S = sub(g, 'auricular', 'Auricular y cable',
    'Auricular colgado en horquilla lateral con cable en espiral hasta la caja.');
  put(S, bx(0.06, 0.20, 0.05, mK), 0.27, 1.47, 0.13);                 // horquilla
  put(S, bx(0.07, 0.26, 0.07, mK), 0.27, 1.44, 0.19, 0, 0, 0.1);      // cuerpo auricular
  put(S, cy(0.035, 0.035, 0.05, 8, mK), 0.27, 1.58, 0.20);            // capsula superior
  put(S, cy(0.035, 0.035, 0.05, 8, mK), 0.27, 1.31, 0.20);            // capsula inferior
  // Cable en espiral (pila de toros pequeños — barato y legible)
  for (let i = 0; i < 6; i++) {
    const rizo = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 5, 10), mK);
    rizo.position.set(0.20, 1.16 - i * 0.045, 0.16);
    rizo.rotation.x = Math.PI / 2;
    S.add(rizo);
  }

  S = sub(g, 'senal', 'Señal de teléfono', 'Señal azul de TELÉFONO DE EMERGENCIA sobre la caja.');
  const senal = crearSenal('telefono');
  senal.position.set(0, 2.35, 0.06);
  S.add(senal);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.name = 'telefono_emergencia';
  g.userData.interactable = {
    object: g,
    descriptor: {
      label: 'Usar teléfono de emergencia',
      onInteract: () => window.__mina?.bus.emit('ui:read', {
        title: 'TELÉFONO DE EMERGENCIA — CENTRAL DE CONTROL',
        body:
          '«Central de control, superficie. ¿Cuál es su emergencia?»\n\n' +
          'Protocolo de comunicación:\n' +
          '1. Identifícate: nombre, empresa y labor (Ga/Cx/Nv).\n' +
          '2. Describe el evento: heridos, gases, caída de roca, incendio, atrapamiento.\n' +
          '3. NO cuelgues hasta que la central confirme el mensaje.\n' +
          '4. Sigue las instrucciones: evacuación o refugio minero más cercano.\n\n' +
          'Los teléfonos de labor se prueban al inicio de cada guardia.'
      })
    }
  };
  return g;
}
