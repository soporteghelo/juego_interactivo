import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';

/**
 * TABLERO ELECTRICO / SUBESTACION — md: caja ~60×80×40cm naranja oxidada, breakers
 * Schneider verde/negro, cables saliendo por la base. INTERACTUABLE: inspeccionar tablero.
 *
 * El descriptor de interaccion queda en group.userData.interactable para que el mundo lo
 * registre (convencion comun de los elementos interactivos).
 */

export const meta = {
  id: 'tablero_electrico',
  nombre: 'Tablero electrico',
  descripcion: 'Subestacion naranja con breakers y cables. Interactuable (inspeccion / LOTO).'
};

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();

  const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.8), MineMaterials.panelNaranja());
  box.position.y = 1.1;
  box.castShadow = true;
  g.add(box);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.78, 0.76), MineMaterials.panelNaranja());
  door.position.set(-0.31, 1.1, 0.38);
  door.rotation.y = 0.5;
  g.add(door);

  for (let i = 0; i < 6; i++) {
    const br = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.05, 0.05),
      MineMaterials.plano(i % 2 ? 0x1b5e20 : 0x111111, { rough: 0.6 })
    );
    br.position.set(-0.18 + (i % 3) * 0.12, 1.35 - Math.floor(i / 3) * 0.12, 0.38);
    g.add(br);
  }

  const cables = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), MineMaterials.cable());
  cables.position.set(0, 0.5, 0.38);
  g.add(cables);

  g.name = 'tablero_electrico';
  g.userData.solid = true;   // obstaculo solido: el jugador/NPC no lo atraviesa
  // Peligro: descarga/arco electrico al manipular el tablero energizado sin proteccion.
  g.userData.hazard = {
    tipo: 'electrico',
    warn: 2.4,
    kill: 0.85,
    aviso: 'PELIGRO ELECTRICO: no manipules el tablero sin bloqueo (LOTO) ni EPP dielectrico.',
    reflexion:
      'Sufriste una descarga / arco electrico al tomar un tablero energizado sin protocolo. ' +
      'Antes de intervenir energia: Corta, Bloquea, Etiqueta y Verifica ausencia de tension ' +
      '(LOTO). Usa EPP dielectrico y autorizacion del area.'
  };
  g.userData.interactable = {
    object: box,
    descriptor: {
      label: 'Inspeccionar tablero electrico',
      onInteract: () => window.__mina?.bus.emit('ui:read', {
        title: 'TABLERO ELECTRICO — Subestacion',
        body:
          'Tablero de distribucion (Schneider Electric). Verificar: ausencia de tension antes ' +
          'de intervenir (bloqueo y etiquetado / LOTO), estado de breakers, puesta a tierra, ' +
          'ausencia de humedad y polvo en bornes. Riesgo: arco electrico. EPP dielectrico ' +
          'obligatorio. Reportar cualquier breaker recalentado.'
      })
    }
  };
  return g;
}
