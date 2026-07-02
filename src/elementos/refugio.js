import * as THREE from 'three';
import { MineMaterials, PALETTE } from '../world/materials/MineMaterials.js';
import { crearSenal } from './senal.js';

/**
 * REFUGIO MINERO (contenedor Drager) — md "ELEMENTO ESPECIAL: REFUGIO MINERO".
 * Contenedor verde ~3×2×1.8m: puerta frontal, semaforo verde/rojo (disponible/ocupado),
 * letrero ENTRADA/ENTRY (capacidad 20), extintor lateral. INTERACTUABLE: ingresar.
 *
 * El descriptor de interaccion queda en group.userData.interactable.
 */

export const meta = {
  id: 'refugio',
  nombre: 'Refugio minero (Drager)',
  descripcion: 'Camara de refugio para emergencias. Semaforo, puerta y extintor. Interactuable.'
};

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  const W = 3, H = 2, D = 1.8;

  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), MineMaterials.plano(0x1b6e3c, { rough: 0.6, metal: 0.5 }));
  body.position.y = H / 2;
  body.castShadow = true;
  g.add(body);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.08), MineMaterials.plano(0x14502b, { rough: 0.5, metal: 0.5 }));
  door.position.set(-0.6, 0.85, D / 2 + 0.04);
  g.add(door);

  const greenLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    MineMaterials.plano(PALETTE.ledVerde, { emissive: PALETTE.ledVerde, emissiveIntensity: 3 })
  );
  greenLamp.position.set(0.6, 1.5, D / 2 + 0.05);
  g.add(greenLamp);

  const redLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    MineMaterials.plano(0x330000, { emissive: 0xcc0000, emissiveIntensity: 0 })
  );
  redLamp.position.set(0.6, 1.25, D / 2 + 0.05);
  g.add(redLamp);

  const entry = crearSenal('refugio_entrada');
  entry.scale.set(0.9, 0.45, 1);
  entry.position.set(-0.6, 1.85, D / 2 + 0.06);
  g.add(entry);

  const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 10), MineMaterials.plano(0xcc0000, { rough: 0.4, metal: 0.3 }));
  ext.position.set(W / 2 + 0.12, 0.6, D / 2 - 0.3);
  g.add(ext);

  g.name = 'refugio';

  let abierto = false;
  g.userData.interactable = {
    object: body,
    descriptor: {
      label: 'Ingresar al Refugio Minero N°2',
      onInteract: () => {
        abierto = !abierto;
        greenLamp.material.emissiveIntensity = abierto ? 0 : 3;
        redLamp.material.emissiveIntensity = abierto ? 3 : 0;
        window.__mina?.bus.emit('ui:read', {
          title: 'REFUGIO MINERO N°2 — NEXA / Cerro Lindo',
          body:
            (abierto ? 'Refugio OCUPADO. ' : 'Refugio DISPONIBLE. ') +
            'Capacidad: 20 personas. Fabricante: Drager. En caso de emergencia: ingresar, ' +
            'sellar la puerta, activar el sistema de aire/scrubber de CO2 y mantener la calma ' +
            'hasta el rescate. Verificar oxigeno y comunicar por linea de vida.'
        });
      }
    }
  };
  return g;
}
