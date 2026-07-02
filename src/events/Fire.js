import * as THREE from 'three';
import { disposeObject } from '../utils/Disposable.js';

/**
 * Evento: INCENDIO (md: "incendio", emergencias/evacuaciones).
 * Crea un foco de fuego (planos emisivos animados + luz parpadeante calida) delante del
 * jugador. Re-emitido como 'event:fire' para que los NPCs evacuen (ver NPCManager).
 * Placeholder de efecto; extension: propagacion, humo denso, dano por calor/gases.
 */
export function createFire({ scene, camera, bus }) {
  const group = new THREE.Group();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const pos = camera.position.clone().add(dir.multiplyScalar(6));
  pos.y = 0.4;
  group.position.copy(pos);
  scene.add(group);

  // Registra el fuego como PELIGRO MORTAL dinamico (acercarse demasiado = muerte).
  const hazardId = 'fire_' + Math.random().toString(36).slice(2);
  bus?.emit('hazard:add', {
    id: hazardId,
    position: pos.clone(),
    warn: 4.5,
    kill: 1.6,
    tipo: 'fuego',
    aviso: 'INCENDIO: calor y gases toxicos. ALEJATE y evacua por la via de escape.',
    reflexion:
      'El fuego te alcanzo. Ante un incendio: activa la alarma, NO te acerques, usa el ' +
      'autorrescatador y evacua de inmediato por la via de escape hacia el refugio.'
  });

  // Llamas: planos emisivos naranjas/amarillos.
  const flames = [];
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: i % 2 ? 0xff6600 : 0xffcc00,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.2), mat);
    flame.position.set((Math.random() - 0.5) * 0.6, 0.6, (Math.random() - 0.5) * 0.6);
    group.add(flame);
    flames.push(flame);
  }

  const light = new THREE.PointLight(0xff5522, 8, 12, 2);
  light.position.y = 1;
  group.add(light);

  let life = 0;
  const duration = 12;
  return {
    message: 'INCENDIO declarado. Active la alarma, corte energia, use extintor (PQS) y evacue por la via de escape.',
    update(dt, elapsed) {
      life += dt;
      // Parpadeo de la luz + ondeo de las llamas.
      light.intensity = 6 + Math.sin(elapsed * 25) * 2 + Math.random();
      flames.forEach((f, i) => {
        f.scale.y = 1 + Math.sin(elapsed * 10 + i) * 0.2;
        f.rotation.y = elapsed * (i % 2 ? 1 : -1);
      });
      return life >= duration;
    },
    stop() {
      bus?.emit('hazard:remove', hazardId);
      disposeObject(group);
    }
  };
}
