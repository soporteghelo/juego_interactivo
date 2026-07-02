import * as THREE from 'three';
import { NPC } from './NPC.js';

/**
 * Gestor de NPCs. Genera un conjunto inicial de personajes repartidos por algunos tramos
 * (operadores, supervisor, geomecanica) y los actualiza cada frame.
 *
 * Extension point: pooling de NPCs, navegacion por waypoints/navmesh, reaccion a eventos
 * del EventBus (evacuar ante 'event:fire'/'event:gas'), dialogos, tareas de mision.
 */
export class NPCManager {
  constructor({ scene, bus, world }) {
    this.scene = scene;
    this.bus = bus;
    this.world = world;
    this.npcs = [];

    this._spawnInitial();

    // Ejemplo de cableado al bus: ante una emergencia, los NPCs "evacuan" (stub).
    this.bus.on('event:fire', () => this._evacuate());
    this.bus.on('event:gas', () => this._evacuate());
  }

  _spawnInitial() {
    const roles = ['operador', 'supervisor', 'geomecanica', 'operador'];
    const segs = this.world.segments;
    if (!segs.length) return;

    // Coloca un NPC cerca del centro de algunos tramos (saltando el de spawn).
    let placed = 0;
    for (let i = 1; i < segs.length && placed < roles.length; i += 2) {
      const seg = segs[i];
      const base = seg.group.position.clone();
      const pos = new THREE.Vector3(
        base.x + (placed % 2 ? 1.2 : -1.2),
        base.y,
        base.z - seg.length / 2
      );
      const npc = new NPC({
        role: roles[placed],
        position: pos,
        behavior: placed % 2 ? 'patrol' : 'idle',
        patrolRange: 3
      });
      this.scene.add(npc.object);
      this.npcs.push(npc);
      placed++;
    }
  }

  _evacuate() {
    for (const npc of this.npcs) npc.behavior = 'patrol';
  }

  update(dt) {
    for (const npc of this.npcs) npc.update(dt);
    // Retirar NPCs atropellados MUTANDO el array in situ. NO reasignar (this.npcs = ...):
    // VehicleSystem comparte ESTA MISMA referencia via setNpcs(), y reasignarla lo dejaria
    // apuntando a la lista vieja con NPCs ya muertos.
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      if (!this.npcs[i].alive) this.npcs.splice(i, 1);
    }
  }
}
