import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';
import { disposeObject } from '../utils/Disposable.js';

/**
 * Evento: CAIDA DE ROCAS (md: "caida de rocas", zona de peligro geologico).
 * Genera varias rocas que caen del techo delante del jugador y se asientan en el piso.
 * Placeholder funcional (sin fisica rigida): caida por gravedad simple con rebote amortiguado.
 */
export function createRockFall({ scene, camera }) {
  const group = new THREE.Group();
  scene.add(group);

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const center = camera.position.clone().add(dir.multiplyScalar(5));

  const rocks = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const s = 0.2 + Math.random() * 0.4;
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), MineMaterials.rocaMineralizada());
    mesh.position.set(
      center.x + (Math.random() - 0.5) * 3,
      center.y + 2.5 + Math.random() * 1.5,
      center.z + (Math.random() - 0.5) * 3
    );
    group.add(mesh);
    rocks.push({ mesh, vy: 0, rest: 0.12 + Math.random() * 0.2, settled: false });
  }

  let life = 0;
  return {
    message: 'PELIGRO: caida de rocas. Aleja al personal y acordona la zona (IPERC).',
    update(dt) {
      life += dt;
      let allSettled = true;
      for (const r of rocks) {
        if (r.settled) continue;
        allSettled = false;
        r.vy += -18 * dt;
        r.mesh.position.y += r.vy * dt;
        r.mesh.rotation.x += dt * 2;
        r.mesh.rotation.z += dt * 1.5;
        if (r.mesh.position.y <= r.rest) {
          r.mesh.position.y = r.rest;
          r.vy *= -0.3;
          if (Math.abs(r.vy) < 0.5) r.settled = true;
        }
      }
      // Termina cuando todo se asento (las rocas quedan como escombros en la escena).
      return allSettled && life > 1.5;
    },
    stop() {
      // Las rocas permanecen como evidencia; si se quiere limpiar: disposeObject(group).
      void disposeObject;
    }
  };
}
