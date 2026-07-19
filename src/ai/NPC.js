import * as THREE from 'three';
import { Settings } from '../core/Settings.js';
import { Device } from '../core/Device.js';
import { crear as crearMinero, actualizar as actualizarMinero, setTarea as setTareaMinero } from '../elementos/personas/minero.js';

const _tmp = new THREE.Vector3();

/**
 * NPC — trabajador de mina con comportamiento situado en la galería.
 *
 * Novedades frente al stub anterior (que solo oscilaba con un seno y podía atravesar
 * paredes):
 *  - CAMINA a lo largo del EJE del túnel y da media vuelta al llegar al final de su tramo.
 *  - NO SE TRASPASA la roca: cada paso se valida contra `boundsCheck(pos)` (el gálibo
 *    transitable del mundo). Si un movimiento saldría del túnel, se cancela ese componente.
 *  - SE REFUGIA cuando se acerca un equipo pesado: corre hacia el hastial OPUESTO al vehículo,
 *    se pega a la pared y lo observa pasar; al alejarse, retoma su marcha. Reduce atropellos.
 *  - LOD: la animación de esqueleto (mixer + seguidores de EPP, lo más caro) se ACTUALIZA a
 *    tasa reducida cuando el NPC está lejos, y el modelo se oculta más allá de la distancia de
 *    dibujado. Clave para el framerate en celular con varios personajes.
 *
 * Coordenadas locales de navegación (baratas y robustas):
 *   posición = origin + axis·s + perp·l
 *   - `s`: avance a lo largo del eje del túnel (patrulla).
 *   - `l`: desplazamiento lateral (carril / pegado al hastial al refugiarse).
 */
export class NPC {
  /** @param {{role:string, position:THREE.Vector3, behavior?:string, patrolRange?:number, patrolAxis?:THREE.Vector3, boundsCheck?:Function}} cfg */
  constructor(cfg) {
    this.role      = cfg.role || 'operador';
    this.behavior  = cfg.behavior || 'idle';
    this.patrolRange = cfg.patrolRange ?? 5;

    // Trabajador de una labor (behavior 'trabajando'): micro-gesto de tarea + punto que mira.
    this.gesto      = cfg.gesto || null;
    this.faceTarget = cfg.faceTarget ? cfg.faceTarget.clone() : null;

    // Eje de patrulla EN MUNDO (unitario, plano XZ) y su perpendicular (hacia los hastiales).
    this.axis = cfg.patrolAxis ? cfg.patrolAxis.clone().setY(0).normalize() : new THREE.Vector3(0, 0, 1);
    this.perp = new THREE.Vector3(this.axis.z, 0, -this.axis.x);

    this.origin = cfg.position.clone();
    this.boundsCheck = typeof cfg.boundsCheck === 'function' ? cfg.boundsCheck : null;
    // Evita que el NPC atraviese props solidos (refugio, mobiliario) — mismo criterio que el jugador.
    this.blockedCheck = typeof cfg.blockedCheck === 'function' ? cfg.blockedCheck : null;
    // Consulta del nicho de refugio peatonal mas cercano (para meterse DENTRO al pasar un equipo).
    this.refugeQuery = typeof cfg.refugeQuery === 'function' ? cfg.refugeQuery : null;

    this.object = crearMinero({ rol: this.role, epp: cfg.epp || NPC._randomEpp() });
    this.object.position.copy(cfg.position);

    this.alive = true;
    this._t = Math.random() * Math.PI * 2;

    // Estado de navegación
    this._s = 0;
    this._l = 0;
    this.dir = Math.random() < 0.5 ? 1 : -1;         // sentido de avance a lo largo del eje
    this.walkSpeed = 0.85 + Math.random() * 0.4;      // m/s caminando (variación por persona)
    this.runSpeed  = 2.8;                             // m/s corriendo al refugio
    this.refugeDist = 1.9;                            // cuánto se pega al hastial al refugiarse (fallback)

    // Carril PEATONAL: la gente circula por la berma (un costado), no por el centro de la calzada
    // de equipos. `_laneTarget` es el desplazamiento lateral objetivo (m) al que vuelve al caminar.
    // Si el spawn ya está sobre la berma demarcada, cfg.laneTarget=0 (camina sobre la línea).
    this._laneTarget = (cfg.laneTarget != null)
      ? cfg.laneTarget
      : (Math.random() < 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.6);
    // Micro-pausas al caminar (mirar la labor / descansar): un solo temporizador alterna
    // "avanzar" ↔ "pausa" para que la marcha no sea metronómica.
    this._paused = false;
    this._walkTimer = 3 + Math.random() * 8;
    // Objetivo de refugio DENTRO de un nicho (s,l en el marco de navegación), o null → fallback.
    this._nicheTarget = null;

    // Máquina de estados: 'walk' (patrulla) | 'idle' (parado) | 'refuge' (pegado al hastial).
    this.state = this.behavior === 'patrol' ? 'walk' : 'idle';
    // Yaw base mirando a lo largo del túnel (el modelo mira a -Z con yaw=0).
    this._idleYaw = Math.atan2(-this.axis.x, -this.axis.z);
    this.object.rotation.y = this._idleYaw;
    // Giro SUAVE: el rumbo objetivo se interpola (no salta). Evita el giro instantáneo de 180°
    // al fin del tramo y el volteo brusco al refugiarse. `_yawRate` = rad/s de respuesta.
    this._targetYaw = this._idleYaw;
    this._yawRate = 7;

    // Velocidad real de avance (m/s), medida por desplazamiento entre frames → sincroniza la
    // cadencia del clip (sin patinaje) e incluye el caso "bloqueado" (velocidad ≈ 0).
    this._lastPos = this.object.position.clone();
    this._vel = 0;

    this._moving = false;
    this._running = false;

    // Posiciones de vehículos cercanos (actualizadas por VehicleSystem cada frame).
    this._vehiclePositions = [];
    this._animAccum = 0;

    // Umbrales de LOD (más agresivos en táctil).
    this._animFar = Device.isTouch ? 14 : 20;         // más allá: animación a tasa reducida
    this._animStep = Device.isTouch ? 0.14 : 0.1;     // periodo de la animación lejana (s)

    // Trabajador estatico de una labor: fija el gesto de tarea del minero (si tiene esqueleto).
    if (this.behavior === 'trabajando' && this.gesto) setTareaMinero(this.object, this.gesto);

    // Cápsula CINEMÁTICA: el character controller del jugador colisiona contra ella → el
    // jugador NO puede atravesar a las personas. El NPC la reubica sobre su torso cada frame.
    this._physics = cfg.physics || null;
    this._body = null;
    this._collider = null;
    if (this._physics?.world) {
      const p = cfg.position;
      const cap = this._physics.createKinematicCapsule({
        position: { x: p.x, y: p.y + 0.9, z: p.z }, radius: 0.3, halfHeight: 0.6
      });
      this._body = cap.body;
      this._collider = cap.collider;
    }
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

  /** Marca al NPC como muerto (atropellado). Oculta el modelo y retira su colisionador. */
  die() {
    this.alive = false;
    this.object.visible = false;
    this._removeBody();
  }

  /** Libera el colisionador de física (al morir o al despawnear una cuadrilla). */
  dispose() {
    this._removeBody();
  }

  _removeBody() {
    if (this._collider && this._physics?.world) {
      this._physics.world.removeCollider(this._collider, false);
      if (this._body) this._physics.world.removeRigidBody(this._body);
    }
    this._body = null;
    this._collider = null;
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} [playerPos] posición del jugador para el LOD por distancia.
   */
  update(dt, playerPos) {
    if (!this.alive) return;

    // --- Culling por distancia: los NPC cuelgan de la escena (no de un tramo), así que el
    // streaming del mundo no los oculta. Fuera de la distancia de dibujado no se ven (niebla
    // negra), así que los congelamos por completo: ni animación ni draw. ---
    const dist = playerPos ? this.object.position.distanceTo(playerPos) : 0;
    const cull = Settings.current.drawDistance + 12;
    if (dist > cull) {
      if (this.object.visible) this.object.visible = false;
      return;
    }
    if (!this.object.visible) this.object.visible = true;

    // El comportamiento/navegación es barato: siempre a tasa completa (fluye la evasión).
    this._updateBehavior(dt);

    // Velocidad REAL de avance (m/s) tras la navegación: distancia XZ recorrida / dt. Capta el
    // caso bloqueado (v≈0) → el clip se detiene en vez de patinar. Luego suaviza el rumbo.
    const mdx = this.object.position.x - this._lastPos.x;
    const mdz = this.object.position.z - this._lastPos.z;
    this._vel = dt > 1e-5 ? Math.hypot(mdx, mdz) / dt : 0;
    this._lastPos.copy(this.object.position);
    this._applyYaw(dt);

    // Reubica la cápsula de colisión sobre el torso (para que el jugador no atraviese al NPC).
    if (this._body) {
      const p = this.object.position;
      this._body.setNextKinematicTranslation({ x: p.x, y: p.y + 0.9, z: p.z });
    }

    // La ANIMACIÓN de esqueleto es cara (mixer + reubicar ~19 piezas de EPP por hueso):
    // a plena tasa de cerca; acumulada y a saltos cuando el NPC está lejos.
    if (dist > this._animFar) {
      this._animAccum += dt;
      if (this._animAccum >= this._animStep) {
        actualizarMinero(this.object, this._animAccum, this._moving, this._running, this._vel);
        this._animAccum = 0;
      }
    } else {
      actualizarMinero(this.object, dt, this._moving, this._running, this._vel);
    }
  }

  /** Interpola el rumbo del modelo hacia `_targetYaw` (giro suave, sin saltos). */
  _applyYaw(dt) {
    const cur = this.object.rotation.y;
    const d = Math.atan2(Math.sin(this._targetYaw - cur), Math.cos(this._targetYaw - cur));
    this.object.rotation.y = cur + d * Math.min(1, dt * this._yawRate);
  }

  // --- Lógica de decisión + movimiento (sin tocar el esqueleto) ---
  _updateBehavior(dt) {
    this._t += dt;

    // Trabajador de labor: no patrulla ni evalua vehiculos; se queda en su puesto trabajando.
    if (this.behavior === 'trabajando') { this._doWork(dt); return; }

    const pos = this.object.position;

    // Vehículo más cercano (distancia XZ) y su posición.
    let nearD2 = Infinity, vx = 0, vz = 0;
    for (const vp of this._vehiclePositions) {
      const dx = pos.x - vp.x, dz = pos.z - vp.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < nearD2) { nearD2 = d2; vx = vp.x; vz = vp.z; }
    }
    const nearD = Math.sqrt(nearD2);

    // Histéresis de refugio: entra pronto (9 m), sale tarde (13 m) para no titilar.
    if (this.state !== 'refuge' && nearD < 9) {
      this.state = 'refuge';
      this._pickRefugeNiche();                    // elige el nicho más cercano al entrar en refugio
    } else if (this.state === 'refuge' && nearD > 13) {
      this.state = this.behavior === 'patrol' ? 'walk' : 'idle';
      this._nicheTarget = null;
    }

    if (this.state === 'refuge') this._doRefuge(dt, vx, vz);
    else if (this.state === 'walk') this._doWalk(dt);
    else this._doIdle(dt);
  }

  /** Al entrar en refugio: proyecta la boca del nicho más cercano al marco (s,l) de navegación. */
  _pickRefugeNiche() {
    this._nicheTarget = null;
    if (!this.refugeQuery) return;
    const n = this.refugeQuery(this.object.position, 14);
    if (!n) return;
    const dx = n.x - this.origin.x, dz = n.z - this.origin.z;
    const s = dx * this.axis.x + dz * this.axis.z;   // avance a lo largo del túnel
    const l = dx * this.perp.x + dz * this.perp.z;   // lateral (dentro del nicho)
    this._nicheTarget = { s, l };
  }

  /**
   * Intenta fijar la posición a origin + axis·(s+ds) + perp·(l+dl). Si cae FUERA del gálibo
   * transitable, no aplica nada y devuelve false (el llamador decide: girar, probar otro lado…).
   */
  _tryMove(ds, dl) {
    const s = this._s + ds, l = this._l + dl;
    const p = _tmp.copy(this.origin)
      .addScaledVector(this.axis, s)
      .addScaledVector(this.perp, l);
    p.y = this.origin.y;
    if (this.boundsCheck && !this.boundsCheck(p)) return false;
    if (this.blockedCheck && this.blockedCheck(p)) return false;   // no traspasar props solidos
    this._s = s; this._l = l;
    this.object.position.copy(p);
    return true;
  }

  _doWalk(dt) {
    this._walkTimer -= dt;
    // Camina por la BERMA peatonal (un costado), no por el centro de la calzada de equipos.
    const laneReturn = (this._laneTarget - this._l) * Math.min(1, dt * 2);

    if (this._paused) {
      // Micro-pausa: se queda en la berma mirando alrededor (mira la labor / descansa).
      this._tryMove(0, laneReturn);
      this._targetYaw = this._idleYaw + Math.sin(this._t * 0.6) * 0.4;
      this._moving = false;
      this._running = false;
      if (this._walkTimer <= 0) { this._paused = false; this._walkTimer = 6 + Math.random() * 9; }
      return;
    }

    const step = this.walkSpeed * dt * this.dir;
    if (!this._tryMove(step, laneReturn)) {
      // Fuera del gálibo (fin de túnel / hastial): da media vuelta (el yaw la suaviza).
      this.dir *= -1;
      this._tryMove(0, laneReturn);
    }
    // Límite de patrulla: no se aleja demasiado de su punto de origen.
    if (Math.abs(this._s) > this.patrolRange) this.dir = -Math.sign(this._s) || 1;

    this._face(this.dir * this.axis.x, this.dir * this.axis.z);
    this._moving = true;
    this._running = false;

    // Programa una pausa ocasional (marcha no metronómica).
    if (this._walkTimer <= 0) { this._paused = true; this._walkTimer = 1.5 + Math.random() * 3.5; }
  }

  _doIdle(dt) {
    // Parado en la berma (no en el centro), con leve balanceo mirando a lo largo del túnel.
    const laneReturn = (this._laneTarget - this._l) * Math.min(1, dt * 1.5);
    this._tryMove(0, laneReturn);
    this._targetYaw = this._idleYaw + Math.sin(this._t * 0.4) * 0.25;
    this._moving = false;
    this._running = false;
  }

  _doRefuge(dt, vx, vz) {
    // ── Con nicho: NAVEGA al nicho y se mete DENTRO ──────────────────────────
    const nt = this._nicheTarget;
    if (nt) {
      const dS = nt.s - this._s;
      if (Math.abs(dS) >= 0.35) {
        // Aún no alineado: corre a lo largo del túnel hasta quedar frente al nicho.
        const ds = THREE.MathUtils.clamp(dS, -this.runSpeed * dt, this.runSpeed * dt);
        const ok = this._tryMove(ds, (this._laneTarget - this._l) * Math.min(1, dt * 2));
        const dsign = Math.sign(dS) || 1;
        this._face(dsign * this.axis.x, dsign * this.axis.z);
        this._moving = true;
        this._running = true;
        if (ok) return;                 // si quedó bloqueado, cae al fallback de hastial
      } else {
        // Alineado: entra lateralmente hacia el fondo del nicho.
        const dl = THREE.MathUtils.clamp(nt.l - this._l, -this.runSpeed * dt, this.runSpeed * dt);
        this._tryMove(0, dl);
        const reached = Math.abs(nt.l - this._l) < 0.18;
        // Dentro del nicho OBSERVA pasar el equipo; entrando, mira hacia el nicho.
        if (reached) this._face(vx - this.object.position.x, vz - this.object.position.z);
        else { const ls = Math.sign(nt.l) || 1; this._face(ls * this.perp.x, ls * this.perp.z); }
        this._moving = !reached;
        this._running = !reached;
        return;
      }
    }

    // ── Fallback (sin nicho / bloqueado): hastial OPUESTO al vehículo ────────
    const lv = this.perp.x * (vx - this.origin.x) + this.perp.z * (vz - this.origin.z);
    const target = (lv > 0 ? -1 : 1) * this.refugeDist;
    const dl = THREE.MathUtils.clamp(target - this._l, -this.runSpeed * dt, this.runSpeed * dt);
    if (!this._tryMove(0, dl)) {
      const dl2 = THREE.MathUtils.clamp(-target - this._l, -this.runSpeed * dt, this.runSpeed * dt);
      this._tryMove(0, dl2);
    }
    const reached = Math.abs(target - this._l) < 0.06;
    this._face(vx - this.object.position.x, vz - this.object.position.z);
    this._moving = !reached;
    this._running = !reached;
  }

  /** Trabajador ESTATICO: mira a su punto de trabajo; el gesto de tarea lo anima el minero. */
  _doWork() {
    if (this.faceTarget) {
      this._face(this.faceTarget.x - this.object.position.x, this.faceTarget.z - this.object.position.z);
    }
    this._moving = false;
    this._running = false;
  }

  /** Fija el rumbo OBJETIVO (mira a -Z con yaw=0) hacia la dirección mundo (dx,dz). El giro
   *  real lo interpola `_applyYaw` cada frame → sin saltos. */
  _face(dx, dz) {
    if (Math.abs(dx) + Math.abs(dz) < 1e-4) return;
    this._targetYaw = Math.atan2(-dx, -dz);
  }
}
