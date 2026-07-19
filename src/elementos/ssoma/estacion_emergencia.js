import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crearSenal } from '../senal/senal.js';
import { sub } from '../_comun/subelemento.js';

/**
 * ESTACION DE EMERGENCIA (primeros auxilios) — D.S. 024-2016-EM: las labores deben contar
 * con medios de atencion de primeros auxilios accesibles.
 *
 * Montada al hastial: CAMILLA RIGIDA naranja (tabla espinal con correas) colgada en
 * vertical + GABINETE DE BOTIQUIN blanco con cruz verde + señal fotoluminiscente de
 * PRIMEROS AUXILIOS. Interactuable: [E] repasa el contenido y el procedimiento basico.
 *
 * Origen en el PISO contra la pared; frente = +Z (mirando a la via).
 */

export const meta = {
  id: 'estacion_emergencia',
  nombre: 'Estación de emergencia (camilla + botiquín)',
  descripcion: 'Camilla rígida naranja con correas colgada al hastial + gabinete de botiquín con cruz verde + señal de primeros auxilios. Interactuable.'
};

function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function put(grp, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m;
}

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  const mNar   = MineMaterials.plano(0xe8641b, { rough: 0.7 });                 // camilla naranja
  const mCorrea= MineMaterials.plano(0x16181c, { rough: 0.9 });                 // correas negras
  const mGab   = MineMaterials.plano(0xf2f2ee, { rough: 0.55, metal: 0.15 });   // gabinete blanco
  const mCruz  = MineMaterials.plano(0x1b8a2e, { rough: 0.5, emissive: 0x0c4a16, emissiveIntensity: 0.35 });

  // ── Camilla rigida (tabla espinal) colgada en vertical ──
  let S = sub(g, 'camilla', 'Camilla rígida',
    'Tabla espinal naranja con asas caladas y 3 correas de sujeción, colgada al hastial lista para descolgar.');
  const tabla = put(S, bx(0.48, 1.85, 0.06, mNar), -0.42, 1.25, 0.05);
  tabla.rotation.x = 0.03;
  for (const y of [0.65, 1.25, 1.80]) put(S, bx(0.52, 0.07, 0.09, mCorrea), -0.42, y, 0.055); // correas
  for (const sy of [-0.78, 0, 0.78]) for (const sx of [-1, 1]) {
    put(S, bx(0.05, 0.14, 0.08, mCorrea), -0.42 + sx * 0.19, 1.25 + sy, 0.05);                // asas caladas
  }
  put(S, bx(0.10, 0.10, 0.06, mCorrea), -0.42, 2.32, 0.03);                                    // gancho de cuelgue

  // ── Gabinete de botiquin con cruz verde ──
  S = sub(g, 'botiquin', 'Gabinete de botiquín',
    'Gabinete metálico blanco con cruz verde de primeros auxilios y cierre frontal.');
  put(S, bx(0.55, 0.68, 0.20, mGab), 0.42, 1.45, 0.10);
  put(S, bx(0.10, 0.40, 0.03, mCruz), 0.42, 1.45, 0.215);   // cruz vertical
  put(S, bx(0.34, 0.10, 0.03, mCruz), 0.42, 1.45, 0.215);   // cruz horizontal
  put(S, bx(0.06, 0.03, 0.04, mCorrea), 0.60, 1.45, 0.21);  // pestillo

  // ── Señal de PRIMEROS AUXILIOS sobre la estacion ──
  S = sub(g, 'senal', 'Señal de primeros auxilios', 'Señal verde fotoluminiscente sobre la estación.');
  const senal = crearSenal('primeros_auxilios');
  senal.position.set(0.02, 2.55, 0.06);
  S.add(senal);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.name = 'estacion_emergencia';
  g.userData.solid = true;   // obstaculo solido: el jugador/NPC no lo atraviesa
  g.userData.interactable = {
    object: g,
    descriptor: {
      label: 'Revisar estación de emergencia',
      onInteract: () => window.__mina?.bus.emit('ui:read', {
        title: 'ESTACIÓN DE EMERGENCIA — PRIMEROS AUXILIOS',
        body:
          'CAMILLA RÍGIDA (tabla espinal) con 3 correas de sujeción y BOTIQUÍN de labor.\n\n' +
          'Ante un accidente:\n' +
          '1. Asegura la zona (desate/ventilación) antes de acercarte.\n' +
          '2. Comunica por el teléfono de emergencia o radio al supervisor.\n' +
          '3. NO muevas al herido salvo peligro inminente; usa la camilla con inmovilización.\n' +
          '4. Acompaña al herido hasta el relevo del personal de rescate.\n\n' +
          'Inspecciona mensualmente el contenido del botiquín (D.S. 024-2016-EM).'
      })
    }
  };
  return g;
}
