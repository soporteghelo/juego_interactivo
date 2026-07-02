import * as THREE from 'three';
import { crear as crearPersona, animarMarcha } from '../elementos/persona.js';

export class NPC {
  /** @param {{role:string, position:THREE.Vector3, behavior?:string, patrolRange?:number}} cfg */
  constructor(cfg) {
    this.role      = cfg.role || 'operador';
    this.behavior  = cfg.behavior || 'idle';
    this.patrolRange = cfg.patrolRange ?? 4;
    this.origin    = cfg.position.clone();
    this._t        = Math.random() * Math.PI * 2;
    this.alive     = true;

    this.object = crearPersona({ rol: this.role, epp: NPC._randomEpp() });
    this.object.userData.tick = null;
    this.object.position.copy(cfg.position);

    // Posiciones de vehiculos cercanos (actualizadas por VehicleSystem)
    this._vehiclePositions = [];
    this._evadeVec = new THREE.Vector3();
  }

  static _randomEpp() {
    if (Math.random() < 0.9) return {};
    const r = Math.random();
    if (r < 0.50) return { respirador: false };
    if (r < 0.80) return { autorescatador: false };
    if (r < 0.90) return { chaleco: false };
    return { respirador: false, autorescatador: false };
  }

  /** VehicleSystem llama esto cada frame con la lista de posiciones actuales. */
  setVehiclePositions(positions) {
    this._vehiclePositions = positions;
  }

  /** Marca al NPC como muerto (atropellado). Oculta el modelo. */
  die() {
    this.alive = false;
    this.object.visible = false;
  }

  update(dt) {
    if (!this.alive) return;
    this._t += dt;

    // --- Evasion de equipos pesados ---
    this._evadeVec.set(0, 0, 0);
    let minDist = Infinity;
    for (const vp of this._vehiclePositions) {
      const dx = this.object.position.x - vp.x;
      const dz = this.object.position.z - vp.z;
      const d2 = dx * dx + dz * dz;
      const d  = Math.sqrt(d2);
      if (d < minDist) minDist = d;
      if (d < 7) {
        // Empujar al NPC perpendicular al vehiculo (hacia el hastial mas cercano)
        this._evadeVec.x += dx / (d + 0.1);
        this._evadeVec.z += dz / (d + 0.1);
      }
    }

    // Movimiento base segun comportamiento
    if (this.behavior === 'patrol') {
      const vel = Math.cos(this._t * 0.4) * this.patrolRange * 0.4;
      this.object.position.z = this.origin.z + Math.sin(this._t * 0.4) * this.patrolRange;
      this.object.rotation.y = vel >= 0 ? Math.PI : 0;
      animarMarcha(this.object, this._t * 6, 0.6);
    } else {
      this.object.rotation.y = Math.sin(this._t * 0.4) * 0.3;
      animarMarcha(this.object, this._t * 1.5, 0.08);
    }

    // Aplicar desplazamiento lateral de evasion (se aleja del eje de circulacion)
    if (this._evadeVec.lengthSq() > 0) {
      this._evadeVec.normalize();
      this.object.position.x += this._evadeVec.x * 3.5 * dt;
      this.object.position.z += this._evadeVec.z * 3.5 * dt;
      // Orientar hacia donde huye
      this.object.rotation.y = Math.atan2(this._evadeVec.x, this._evadeVec.z);
      animarMarcha(this.object, this._t * 6, 0.8);
    }
  }
}
