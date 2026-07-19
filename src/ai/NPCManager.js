import * as THREE from 'three';
import { NPC } from './NPC.js';
import { Device } from '../core/Device.js';

/**
 * Gestor de NPCs. Genera un conjunto inicial de trabajadores repartidos por algunos tramos
 * (operadores, supervisor, geomecanica) y los actualiza cada frame.
 *
 * - Les inyecta `boundsCheck` del mundo para que CAMINEN sin traspasar la roca.
 * - Les pasa la posición del jugador cada frame para el LOD (congelar/animar a media tasa).
 * - En celular reduce el número de personajes (cada uno es un modelo con esqueleto).
 *
 * Extension point: navegación por waypoints/navmesh, diálogos, tareas de misión.
 */
export class NPCManager {
  constructor({ scene, bus, world }) {
    this.scene = scene;
    this.bus = bus;
    this.world = world;
    this.npcs = [];

    // boundsCheck del mundo (grid): mantiene a los NPC dentro del gálibo transitable.
    this._boundsCheck = typeof world.boundsCheck === 'function'
      ? world.boundsCheck.bind(world)
      : null;

    // blockedByProp del mundo: impide que los NPC traspasen props sólidos (refugio, mobiliario).
    this._blockedCheck = typeof world.blockedByProp === 'function'
      ? world.blockedByProp.bind(world)
      : null;

    // Física: cada NPC lleva una cápsula cinemática para que el JUGADOR no atraviese a las personas.
    this._physics = world.physics || null;

    // Query de nicho de refugio más cercano: los NPC se meten DENTRO al pasar un equipo pesado.
    this._refugeQuery = typeof world.nearestRefuge === 'function'
      ? world.nearestRefuge.bind(world)
      : null;

    // Posición del jugador para el LOD de los NPC (los NPC cuelgan de la escena, no de un tramo).
    this._playerPos = new THREE.Vector3();
    this.bus.on('player:moved', ({ position }) => this._playerPos.copy(position));

    this._spawnInitial();

    // Ante una emergencia, los NPCs "evacuan" (se ponen a caminar/patrullar hacia fuera).
    this.bus.on('event:fire', () => this._evacuate());
    this.bus.on('event:gas', () => this._evacuate());
  }

  _spawnInitial() {
    const roles = ['operador', 'supervisor', 'geomecanica', 'operador'];
    // En celular menos personajes (cada modelo con esqueleto pesa en CPU/GPU).
    const maxNpc = Device.isTouch ? 3 : roles.length;
    const segs = this.world.segments;
    if (!segs.length) return;

    // Tramos aptos: tuneles PLANOS. Excluye intersecciones/salas/accesos de la retICula y
    // rampas inclinadas (un NPC patrullando una pendiente flotaria/clipearia). En el mundo
    // lineal ningun tramo tiene esos tipos → la lista queda igual que `segs` (sin cambio).
    const candidatos = segs.filter(s =>
      s.type !== 'node' && s.type !== 'room' && s.type !== 'access' && !(s.edge && s.edge.pitch)
    );
    if (!candidatos.length) return;

    // Reparto: el lineal conserva el paso historico (tramos 1,3,5,7 cerca del inicio);
    // la retICula reparte los NPCs por TODO el mapa.
    const esGrid = segs.some(s => s.type === 'node');
    const paso = esGrid ? Math.max(2, Math.floor(candidatos.length / maxNpc)) : 2;

    let placed = 0;
    for (let i = 1; i < candidatos.length && placed < maxNpc; i += paso) {
      const seg = candidatos[i];
      seg.group.updateMatrixWorld(true);
      // Sobre la BERMA peatonal demarcada (si el tramo la tiene) → el NPC camina EXACTAMENTE por
      // la línea señalizada. Si no, a un costado del eje (fallback histórico).
      const enBerma = seg.bermLocalX != null;
      const laneX = enBerma ? seg.bermLocalX : (placed % 2 ? 1.2 : -1.2);
      const pos = new THREE.Vector3(laneX, 0, -seg.length / 2)
        .applyMatrix4(seg.group.matrixWorld);
      // Eje del tunel en mundo (local -Z): la patrulla recorre el tunel, no un eje fijo.
      const eje = new THREE.Vector3(0, 0, -1).applyQuaternion(seg.group.quaternion);
      const npc = new NPC({
        role: roles[placed % roles.length],
        position: pos,
        behavior: placed % 2 ? 'patrol' : 'idle',
        patrolRange: 5,
        patrolAxis: eje,
        boundsCheck: this._boundsCheck,
        blockedCheck: this._blockedCheck,
        physics: this._physics,
        refugeQuery: this._refugeQuery,
        // En berma: el origen YA está sobre la línea → carril objetivo 0 (camina sobre la berma).
        laneTarget: enBerma ? 0 : undefined
      });
      this.scene.add(npc.object);
      this.npcs.push(npc);
      placed++;
    }
  }

  _evacuate() {
    for (const npc of this.npcs) { npc.behavior = 'patrol'; if (npc.state !== 'refuge') npc.state = 'walk'; }
  }

  update(dt) {
    for (const npc of this.npcs) npc.update(dt, this._playerPos);
    // Retirar NPCs atropellados MUTANDO el array in situ. NO reasignar (this.npcs = ...):
    // VehicleSystem comparte ESTA MISMA referencia via setNpcs(), y reasignarla lo dejaria
    // apuntando a la lista vieja con NPCs ya muertos.
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      if (!this.npcs[i].alive) this.npcs.splice(i, 1);
    }
  }
}
