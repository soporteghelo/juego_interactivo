import * as THREE from 'three';
import { crear as crearCamion }    from '../elementos/camion.js';
import { crear as crearCamioneta } from '../elementos/camioneta.js';

/**
 * VehicleSystem — gestiona el trafico de vehiculos en toda la mina.
 *
 * Los vehiculos viajan en un UNICO SENTIDO a lo largo del trazado completo.
 * Estan escalonados (staggered) para que no lleguen todos a la vez.
 * Al finalizar el recorrido, regresan al punto de partida y reinician.
 *
 * Los vehiculos son hijos de la ESCENA (no de un tramo), por lo que atraviesan
 * todos los tramos sin estar limitados a uno solo.
 *
 * El HazardSystem recibe sus descriptores via engine.init() (live:true -> caja
 * envolvente recalculada cada frame).
 */

// Configuracion de la flota: tipo, carril (+X = derecha), velocidad m/s, fase inicial 0..1
// Las fases empiezan en 0.14+ para que ningun vehiculo aparezca cerca del spawn.
// Flota AMPLIADA (8 equipos) para el mapa mas grande: mas trafico atravesando los cruceros,
// escalonado a lo largo de todo el trazado para que siempre haya equipos en movimiento cerca.
const FLOTA = [
  { factory: 'camioneta', lane: 0.9, speed: 4.2, phase: 0.14 },
  { factory: 'camion',    lane: 0.9, speed: 2.5, phase: 0.26 },
  { factory: 'camioneta', lane: 0.9, speed: 3.8, phase: 0.38 },
  { factory: 'camion',    lane: 0.9, speed: 2.8, phase: 0.50 },
  { factory: 'camioneta', lane: 0.9, speed: 4.0, phase: 0.62 },
  { factory: 'camion',    lane: 0.9, speed: 2.6, phase: 0.74 },
  { factory: 'camioneta', lane: 0.9, speed: 3.5, phase: 0.86 },
  { factory: 'camion',    lane: 0.9, speed: 3.0, phase: 0.95 },
];

export class VehicleSystem {
  constructor({ scene, world, bus }) {
    this.scene = scene;
    this.bus   = bus;
    this._npcs = [];           // lista de NPC (set via setNpcs)
    this._hornTimers = [];     // cooldown de claxon por vehiculo (segundos)

    // ---- Construye la ruta como lista de puntos mundo ----
    // Cada tramo aporta: entrada (group.position) + salida (group.position + exit local).
    this._waypoints = world.segments.map(s => s.group.position.clone());
    const last = world.segments[world.segments.length - 1];
    this._waypoints.push(
      last.group.position.clone().add(last.connectors.exit.position)
    );

    // Longitud de cada segmento (distancia 3D real, incluye desnivel de rampas).
    this._segLens = world.segments.map(s => s.connectors.exit.position.length());
    this._totalLen = this._segLens.reduce((a, b) => a + b, 0);

    // ---- Crea y posiciona la flota ----
    this._fleet = FLOTA.map(cfg => {
      const mesh = cfg.factory === 'camion' ? crearCamion() : crearCamioneta();
      scene.add(mesh);
      const dist = cfg.phase * this._totalLen;
      const { pos, dir } = this._samplePath(dist);
      this._placeMesh(mesh, pos, dir, cfg.lane);
      return { mesh, lane: cfg.lane, speed: cfg.speed, dist, _t: 0 };
    });
    this._hornTimers = this._fleet.map(() => 0);
  }

  /** Recibe la lista de NPC activos para chequear proximidad. */
  setNpcs(npcs) { this._npcs = npcs; }

  // ---- Muestrea posicion + direccion en distancia d (con loop) ----
  _samplePath(d) {
    let rem = ((d % this._totalLen) + this._totalLen) % this._totalLen;
    const pts = this._waypoints;
    const lens = this._segLens;
    for (let i = 0; i < lens.length; i++) {
      if (rem <= lens[i] + 1e-6) {
        const t = Math.min(1, rem / Math.max(lens[i], 1e-6));
        const pos = new THREE.Vector3().lerpVectors(pts[i], pts[i + 1], t);
        const dir = new THREE.Vector3().subVectors(pts[i + 1], pts[i]).normalize();
        return { pos, dir };
      }
      rem -= lens[i];
    }
    return { pos: pts[pts.length - 1].clone(), dir: new THREE.Vector3(0, 0, -1) };
  }

  // ---- Aplica posicion + rotacion al mesh con offset de carril ----
  _placeMesh(mesh, pos, dir, lane) {
    // Perpendicular al eje de avance (carril derecho = +right)
    const right = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const finalPos = pos.clone().addScaledVector(right, lane);
    mesh.position.copy(finalPos);
    // El modelo tiene la cabina en +Z local: atan2(dir.x, dir.z) = PI para dir=(0,0,-1)
    mesh.rotation.y = Math.atan2(dir.x, dir.z);
  }

  /** Descriptores de peligro para HazardSystem (live = box recalculada cada frame). */
  get hazards() {
    return this._fleet.map(v => ({
      object: v.mesh,
      live: true,
      warn:  v.mesh.name === 'camion' ? 7   : 5,
      hurt:  0.5,    // contacto con equipo en movimiento = GOLPE (no fatal), no muerte
      aviso:    v.mesh.userData.hazard.aviso,
      reflexion: v.mesh.userData.hazard.reflexion,
      tipo: 'atropello'
    }));
  }

  update(dt) {
    // Recoger posiciones actuales de todos los vehiculos para pasarselas a los NPCs
    const vehPos = this._fleet.map(v => v.mesh.position);

    for (let i = 0; i < this._fleet.length; i++) {
      const v = this._fleet[i];
      v.dist += v.speed * dt;
      v._t   += dt;
      const { pos, dir } = this._samplePath(v.dist);
      this._placeMesh(v.mesh, pos, dir, v.lane);
      v.mesh.userData._speed = v.speed;
      v.mesh.userData.tick?.(dt, v._t);

      // Claxon + muerte al detectar NPCs cercanos
      this._hornTimers[i] = Math.max(0, this._hornTimers[i] - dt);
      for (const npc of this._npcs) {
        if (!npc.alive) continue;
        npc.setVehiclePositions(vehPos);

        const dx = npc.object.position.x - v.mesh.position.x;
        const dz = npc.object.position.z - v.mesh.position.z;
        const d  = Math.sqrt(dx * dx + dz * dz);

        if (d < 1.8) {
          // Contacto: atropello — el NPC muere
          npc.die();
        } else if (d < 9 && this._hornTimers[i] <= 0) {
          // Proximidad: claxon (maximo 1 vez cada 3 s por vehiculo)
          this.bus?.emit('audio:horn', { position: v.mesh.position.clone() });
          this._hornTimers[i] = 3;
        }
      }
    }
  }
}
