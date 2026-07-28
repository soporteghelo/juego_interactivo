import * as THREE from 'three';
import { crear as crearCamion }    from '../elementos/equipos/camion.js';
import { crear as crearCamioneta } from '../elementos/equipos/camioneta.js';
import { crear as crearScoop }     from '../elementos/equipos/scoop.js';
import { crear as crearMixer }     from '../elementos/equipos/mixer.js';
import { crear as crearDesatador } from '../elementos/equipos/desatador.js';
import { Settings } from '../core/Settings.js';

// Fabricas de equipos que pueden CIRCULAR por el mapa (ademas de los que trabajan en las salas).
const FACTORIES = {
  camion: crearCamion, camioneta: crearCamioneta,
  scoop: crearScoop, mixer: crearMixer, desatador: crearDesatador,
};
// Semilargo (m) por tipo para el distanciamiento (car-following).
const HALFLEN = { camion: 4.4, camioneta: 3.0, scoop: 5.3, mixer: 4.6, desatador: 5.4 };
const HALFWIDTH = { camion: 1.25, camioneta: 1.05, scoop: 1.35, mixer: 1.28, desatador: 1.38 };

/** Prueba 2D orientada: evita confundir equipos largos en carriles paralelos con un choque. */
export function vehicleFootprintsOverlap(a, b) {
  const dx = b.mesh.position.x - a.mesh.position.x;
  const dz = b.mesh.position.z - a.mesh.position.z;
  const forwardX = Math.sin(a._yaw);
  const forwardZ = Math.cos(a._yaw);
  const along = Math.abs(dx * forwardX + dz * forwardZ);
  const across = Math.abs(dx * forwardZ - dz * forwardX);
  return along < (a.halfLen + b.halfLen) * 0.82 &&
    across < (a.halfWidth + b.halfWidth) * 0.92;
}

/**
 * VehicleSystem — gestiona el trafico de vehiculos en toda la mina.
 *
 * Los vehiculos viajan en un UNICO SENTIDO a lo largo del trazado completo.
 * Estan escalonados (staggered) para que no lleguen todos a la vez.
 * Al finalizar el recorrido, regresan al punto de partida y reinician.
 *
 * REALISMO EN CURVAS (los cruces de la reticula son esquinas de 90°):
 *  - El trazado se SUAVIZA al construirse: cada esquina se reemplaza por un arco
 *    (bezier cuadratica de radio ~3.4 m) → el vehiculo DOBLA describiendo la curva
 *    en vez de rotar en seco sobre el nodo.
 *  - FRENA al entrar a la curva y reacelera al salir (mirada adelantada sobre el
 *    trazado: cuanto mas cerrada la curva, mas baja la velocidad objetivo).
 *  - La DIRECCION es progresiva (yaw suavizado con giro maximo por segundo) y la
 *    carroceria se INCLINA levemente hacia afuera de la curva (balanceo de suspension).
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
// Flota MIXTA que recorre TODO el trazado, escalonada. Incluye equipo PESADO que ademas de
// trabajar en las labores tambien se traslada por el mapa: SCOOPS con la cuchara CARGADA de muck
// (pose de acarreo), MIXERS y un SCALER.
//
// CARRIL: por defecto 1.15 m a la DERECHA del eje de la via. Con las labores ampliadas (6.0-6.8 m)
// el equipo mas ancho (scoop, 2.95 m de cuchara) queda a ~0.8 m de su hastial — el minimo legal —
// y deja ~3 m libres del otro lado, que es por donde el peaton lo pasa sin meterse bajo la
// cuchara. Con el carril centrado (0.9) ese margen era mas justo a ambos lados.
const FLOTA = [
  { factory: 'camioneta', speed: 4.2, phase: 0.05 },
  { factory: 'scoop',     speed: 2.6, phase: 0.13 },
  { factory: 'camion',    speed: 2.6, phase: 0.21 },
  { factory: 'mixer',     speed: 2.9, phase: 0.29 },
  { factory: 'camioneta', speed: 3.9, phase: 0.37 },
  { factory: 'scoop',     speed: 2.5, phase: 0.46 },
  { factory: 'desatador', speed: 2.7, phase: 0.54 },
  { factory: 'camion',    speed: 2.8, phase: 0.62 },
  { factory: 'scoop',     speed: 2.7, phase: 0.70 },
  { factory: 'camioneta', speed: 3.6, phase: 0.78 },
  { factory: 'mixer',     speed: 3.0, phase: 0.86 },
  { factory: 'camion',    speed: 3.0, phase: 0.94 },
];

// Radio de redondeo de esquina (m) y puntos del arco. 3.4 m entra holgado en un nodo de 10 m.
const RADIO_CURVA = 3.4;
const PASOS_ARCO  = 6;

// Dinamica de conduccion.
const LOOKAHEAD    = 4.5;  // m de mirada adelantada para anticipar la curva
const VEL_CURVA    = 0.45; // fraccion de velocidad en una curva de 90°
const GIRO_SUAVE   = 5.0;  // 1/s — respuesta del volante (yaw suavizado)
const FRENADA      = 3.2;  // 1/s — que tan rapido baja la velocidad al ver la curva
const ACELERACION  = 1.6;  // 1/s — reaceleracion al salir (mas lenta que la frenada)
const ROLL_MAX     = 0.055; // rad (~3°) — inclinacion maxima de carroceria

/** Envuelve un angulo a (-PI, PI]. */
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class VehicleSystem {
  constructor({ scene, world, bus, routes }) {
    this.scene = scene;
    this.bus   = bus;
    this._npcs = [];           // lista de NPC (set via setNpcs)
    this._hornTimers = [];     // cooldown de claxon por vehiculo (segundos)

    // Posicion del jugador para el CULLING por distancia (mismo criterio que los NPC): los
    // equipos cuelgan de la escena, no de un tramo, asi que el streaming del mundo no los oculta.
    this._playerPos = new THREE.Vector3();
    bus?.on?.('player:moved', ({ position }) => this._playerPos.copy(position));

    // ---- Construye la ruta como lista de puntos mundo ----
    let pts;
    if (routes && routes.length && routes[0].length >= 2) {
      // Modo RETICULA: circuito cerrado explicito (via principal RN 96). Cierra el loop
      // repitiendo el primer punto al final para que _samplePath interpole el ultimo tramo.
      const loop = routes[0].map(p => p.clone());
      pts = loop.concat([loop[0].clone()]);
    } else {
      // Modo LINEAL: cada tramo aporta entrada (group.position) + salida (group.position +
      // exit local) para formar el trazado del corredor.
      pts = world.segments.map(s => s.group.position.clone());
      const last = world.segments[world.segments.length - 1];
      pts.push(last.group.position.clone().add(last.connectors.exit.position));
    }

    // Esquinas → arcos (el realismo de la curva nace del propio trazado).
    this._waypoints = VehicleSystem._suavizarEsquinas(pts, RADIO_CURVA, PASOS_ARCO);

    // Longitud de cada segmento del camino (distancia 3D real entre waypoints consecutivos).
    this._segLens = [];
    for (let i = 0; i < this._waypoints.length - 1; i++) {
      this._segLens.push(this._waypoints[i].distanceTo(this._waypoints[i + 1]));
    }
    this._totalLen = this._segLens.reduce((a, b) => a + b, 0);

    // Scratch reutilizable (evita crear vectores cada frame).
    this._s0 = { pos: new THREE.Vector3(), dir: new THREE.Vector3() };
    this._s1 = { pos: new THREE.Vector3(), dir: new THREE.Vector3() };
    this._right = new THREE.Vector3();

    // ---- Crea y posiciona la flota ----
    const fleetConfig = FLOTA.slice(0, world.vehicleFleetLimit ?? FLOTA.length);
    this._fleet = fleetConfig.map(cfg => {
      const mesh = (FACTORIES[cfg.factory] || crearCamioneta)();
      // SCOOP rodante: cuchara CARGADA en pose de acarreo (brazo a media altura, cuchara
      // recogida) — el muck ya viene modelado en la cuchara. Se saca del ciclo demo (auto).
      if (cfg.factory === 'scoop') {
        const api = mesh.userData.scoop;
        if (api) { api.setManual?.(); api.boom = 0.35; api.bucket = 1.0; }
      }
      scene.add(mesh);
      const dist = cfg.phase * this._totalLen;
      const { dir } = this._samplePath(dist, this._s0);
      const v = {
        mesh, lane: cfg.lane ?? 1.15, speed: cfg.speed, dist, _t: 0,
        halfLen: HALFLEN[cfg.factory] ?? 3.0,   // semilargo para el distanciamiento
        halfWidth: HALFWIDTH[cfg.factory] ?? 1.2,
        _yaw: Math.atan2(dir.x, dir.z),  // direccion suavizada (volante)
        _speedF: 1,                      // factor de velocidad (frena en curvas)
        _roll: 0,                        // inclinacion de carroceria
        _manual: false,                  // true = lo conduce el jugador (DriveController)
        _blend: 1, _blendFrom: null      // reincorporacion suave a la ruta tras soltarlo
      };
      this._place(v, this._s0.pos);
      return v;
    });
    this._hornTimers = this._fleet.map(() => 0);
    this._stopTimer  = this._fleet.map(() => 0);   // segundos de paro por CHOQUE (0 = circulando)
  }

  /** Recibe la lista de NPC activos para chequear proximidad. */
  setNpcs(npcs) { this._npcs = npcs; }

  /**
   * Posiciones EXTRA de vehiculos que no son de la flota (p. ej. el equipo que conduce el
   * jugador): los NPC tambien se refugian ante ellos. `fn` devuelve un array de Vector3.
   */
  setExtraPositions(fn) { this._extraFn = fn; }

  /**
   * Puntos de CARGA (acceso a la camara) y DESCARGA (echadero) del circuito: al pasar cerca,
   * los CAMIONES conmutan su tolva llena/vacia → acarreo real de mineral por la RN 96.
   */
  setCargoPoints(loadPos, unloadPos) {
    this._loadPos = loadPos ? loadPos.clone() : null;
    this._unloadPos = unloadPos ? unloadPos.clone() : null;
  }

  /** Meshes de la flota (para audio de motores, conduccion, etc.). */
  get vehicles() { return this._fleet.map(v => v.mesh); }

  /**
   * Cede/retoma un vehiculo de la flota al DriveController. Al SOLTARLO, retoma su ruta
   * desde el punto MAS CERCANO del trazado y se reincorpora con un blend suave (sin
   * teletransporte), arrancando despacio.
   */
  setManual(mesh, manual) {
    const v = this._fleet.find(f => f.mesh === mesh);
    if (!v) return;
    v._manual = manual;
    if (!manual) {
      v.dist = this._nearestDist(mesh.position);
      v._yaw = mesh.rotation.y;      // parte del rumbo en que lo dejo el jugador
      v._roll = 0;
      v._speedF = 0.25;              // arranca despacio y reacelera solo
      v._blendFrom = mesh.position.clone();
      v._blend = 0;
    }
  }

  /**
   * Equipo mas cercano ADELANTE en el circuito (para NO traspasarlo). Devuelve la brecha (m a
   * lo largo de la ruta) y el vehiculo de adelante. Los MANUALES (el que conduce el jugador)
   * cuentan como obstaculo por su proyeccion al trazado.
   */
  _nearestAhead(i) {
    const me = this._fleet[i];
    const myDist = me._manual ? this._nearestDist(me.mesh.position) : me.dist;
    let bestGap = Infinity, ahead = null;
    for (let j = 0; j < this._fleet.length; j++) {
      if (j === i) continue;
      const o = this._fleet[j];
      const oDist = o._manual ? this._nearestDist(o.mesh.position) : o.dist;
      const gap = (((oDist - myDist) % this._totalLen) + this._totalLen) % this._totalLen;
      if (gap > 0.01 && gap < bestGap) { bestGap = gap; ahead = o; }
    }
    return { gap: bestGap, ahead };
  }

  /** Distancia acumulada del punto del trazado mas cercano a `pos` (proyeccion por tramo). */
  _nearestDist(pos) {
    const pts = this._waypoints, lens = this._segLens;
    let best = 0, bestD2 = Infinity, acc = 0;
    const ab = new THREE.Vector3(), ap = new THREE.Vector3(), proy = new THREE.Vector3();
    for (let i = 0; i < lens.length; i++) {
      const a = pts[i], b = pts[i + 1];
      ab.subVectors(b, a);
      ap.subVectors(pos, a);
      const t = THREE.MathUtils.clamp(ab.lengthSq() > 1e-8 ? ap.dot(ab) / ab.lengthSq() : 0, 0, 1);
      proy.copy(a).addScaledVector(ab, t);
      const d2 = proy.distanceToSquared(pos);
      if (d2 < bestD2) { bestD2 = d2; best = acc + t * lens[i]; }
      acc += lens[i];
    }
    return best;
  }

  /**
   * Redondea las esquinas del trazado: cada vertice interior se reemplaza por un ARCO
   * (bezier cuadratica B1→B→B2 con B1/B2 a `radio` metros sobre cada tramo). En un circuito
   * cerrado (primer punto repetido al final) tambien se redondea el vertice de cierre.
   */
  static _suavizarEsquinas(pts, radio = RADIO_CURVA, pasos = PASOS_ARCO) {
    if (pts.length < 3) return pts.map(p => p.clone());
    const cerrado = pts[0].distanceToSquared(pts[pts.length - 1]) < 1e-6;
    const base = cerrado ? pts.slice(0, -1) : pts.slice();
    const n = base.length;
    const out = [];
    const push = (p) => {
      if (!out.length || out[out.length - 1].distanceToSquared(p) > 1e-4) out.push(p);
    };
    const dIn = new THREE.Vector3(), dOut = new THREE.Vector3();

    for (let i = 0; i < n; i++) {
      const B = base[i];
      // Extremos de un trazado ABIERTO: se conservan tal cual.
      if (!cerrado && (i === 0 || i === n - 1)) { push(B.clone()); continue; }
      const A = base[(i - 1 + n) % n];
      const C = base[(i + 1) % n];
      dIn.subVectors(B, A);  const lIn = dIn.length();
      dOut.subVectors(C, B); const lOut = dOut.length();
      if (lIn < 1e-4 || lOut < 1e-4) { push(B.clone()); continue; }
      dIn.divideScalar(lIn); dOut.divideScalar(lOut);

      // Casi recto: no hace falta arco.
      if (dIn.dot(dOut) > 0.985) { push(B.clone()); continue; }

      // Radio efectivo acotado por la mitad de cada tramo (no invadir la esquina vecina).
      const r = Math.min(radio, lIn * 0.5 - 0.05, lOut * 0.5 - 0.05);
      if (r <= 0.2) { push(B.clone()); continue; }

      const B1 = B.clone().addScaledVector(dIn, -r);
      const B2 = B.clone().addScaledVector(dOut, r);
      for (let k = 0; k <= pasos; k++) {
        const t = k / pasos, u = 1 - t;
        push(new THREE.Vector3()
          .addScaledVector(B1, u * u)
          .addScaledVector(B, 2 * u * t)
          .addScaledVector(B2, t * t));
      }
    }
    if (cerrado) push(out[0].clone());
    // Reasegura el cierre exacto del loop.
    if (cerrado && out[0].distanceToSquared(out[out.length - 1]) > 1e-6) out.push(out[0].clone());
    return out;
  }

  // ---- Muestrea posicion + direccion en distancia d (con loop). `out` es reutilizable. ----
  _samplePath(d, out = { pos: new THREE.Vector3(), dir: new THREE.Vector3() }) {
    let rem = ((d % this._totalLen) + this._totalLen) % this._totalLen;
    const pts = this._waypoints;
    const lens = this._segLens;
    for (let i = 0; i < lens.length; i++) {
      if (rem <= lens[i] + 1e-6) {
        const t = Math.min(1, rem / Math.max(lens[i], 1e-6));
        out.pos.lerpVectors(pts[i], pts[i + 1], t);
        out.dir.subVectors(pts[i + 1], pts[i]).normalize();
        return out;
      }
      rem -= lens[i];
    }
    out.pos.copy(pts[pts.length - 1]);
    out.dir.set(0, 0, -1);
    return out;
  }

  /** Coloca el mesh con el yaw/roll SUAVIZADOS del vehiculo y su offset de carril. */
  _place(v, pos) {
    // Perpendicular al rumbo suavizado (carril derecho = +right). Para yaw: fwd=(sin,0,cos).
    this._right.set(-Math.cos(v._yaw), 0, Math.sin(v._yaw));
    v.mesh.position.copy(pos).addScaledVector(this._right, v.lane);
    v.mesh.rotation.set(0, v._yaw, v._roll);
  }

  /** Descriptores de peligro para HazardSystem (live = box recalculada cada frame). */
  get hazards() {
    return this._fleet.map(v => ({
      object: v.mesh,
      live: true,
      // Equipo PESADO (camion/scoop/mixer/scaler) avisa mas lejos que una camioneta.
      warn:  v.mesh.name === 'camioneta' ? 5 : 7,
      hurt:  0.5,    // contacto con equipo en movimiento = GOLPE (no fatal), no muerte
      aviso:    v.mesh.userData.hazard?.aviso,
      reflexion: v.mesh.userData.hazard?.reflexion,
      tipo: 'atropello'
    }));
  }

  update(dt) {
    // Recoger posiciones actuales de todos los vehiculos para pasarselas a los NPCs
    // (incluye las EXTRA: equipo conducido por el jugador fuera de la flota).
    const extras = this._extraFn?.() || [];
    const vehPos = this._fleet.map(v => v.mesh.position);
    for (const p of extras) vehPos.push(p);

    // Reparte las posiciones de vehiculos a cada NPC UNA sola vez por frame. Antes esto se hacia
    // dentro del doble bucle (vehiculo × NPC), reasignando el MISMO array N×M veces por frame.
    for (const npc of this._npcs) if (npc.alive) npc.setVehiclePositions(vehPos);

    // ── CHOQUE entre equipos en movimiento ──────────────────────────────────────
    // La antigua prueba circular marcaba como chocados equipos que circulaban en carriles
    // paralelos. Ahora se compara su huella orientada y solo uno cede brevemente.
    for (let i = 0; i < this._fleet.length; i++) {
      if (this._fleet[i]._manual) continue;
      for (let j = i + 1; j < this._fleet.length; j++) {
        if (this._fleet[j]._manual) continue;
        if (vehicleFootprintsOverlap(this._fleet[i], this._fleet[j])) {
          const yielding = this._fleet[i].dist > this._fleet[j].dist ? i : j;
          this._stopTimer[yielding] = Math.max(this._stopTimer[yielding], 1.8);
        }
      }
    }

    // Fuera de la distancia de dibujado el equipo esta detras de la niebla negra: se oculta y se
    // le salta la animacion. Un scoop son ~1.200 mallas y su `tick` reorienta toda la hidraulica
    // (con `updateWorldMatrix` incluido) — hacerlo para equipos que nadie ve era puro gasto. El
    // RECORRIDO sigue avanzando: el trafico permanece coherente y al acercarse ya esta donde toca.
    const cull = Settings.current.drawDistance + 20;

    for (let i = 0; i < this._fleet.length; i++) {
      const v = this._fleet[i];
      // El equipo que conduce el jugador nunca se oculta (lo anima el DriveController).
      const cerca = v._manual || v.mesh.position.distanceTo(this._playerPos) <= cull;
      if (v.mesh.visible !== cerca) v.mesh.visible = cerca;

      // Conducido por el jugador: el DriveController lo mueve/anima; aqui solo se
      // mantienen los chequeos de claxon/atropello de NPCs (mas abajo).
      if (!v._manual && this._stopTimer[i] > 0) {
        // Cesion breve por contacto real: el otro equipo conserva el paso y despeja la zona.
        this._stopTimer[i] -= dt;
        v._t += dt;
        v.mesh.userData._speed = 0;
        v.mesh.userData._steer = 0;
        v._speedF = 0;
        // Baliza/hidraulica siguen animando aunque este parado — pero solo si se ve.
        if (cerca) v.mesh.userData.tick?.(dt, v._t);
      } else if (!v._manual) {
        // --- Anticipacion de curva: compara el rumbo actual con el de unos metros adelante.
        const now   = this._samplePath(v.dist, this._s0);
        const ahead = this._samplePath(v.dist + LOOKAHEAD, this._s1);
        const align = THREE.MathUtils.clamp(now.dir.dot(ahead.dir), 0, 1);
        const targetF = VEL_CURVA + (1 - VEL_CURVA) * align * align;
        // Frena rapido al ver la curva; reacelera con calma al salir.
        const gain = targetF < v._speedF ? FRENADA : ACELERACION;
        v._speedF += (targetF - v._speedF) * Math.min(1, dt * gain);

        const vel = v.speed * v._speedF;
        v.dist += vel * dt;
        v._t   += dt;

        // ── DISTANCIAMIENTO (car-following): no traspasar al equipo de adelante en el loop.
        // Si al avanzar la brecha cae bajo el minimo, se retrocede el avance → queda pegado
        // detras y casi detenido, en vez de encimarse. Evita deadlock: el lider (brecha ≈
        // toda la ruta) nunca se frena a si mismo. ──
        const sep = this._nearestAhead(i);
        if (sep.ahead) {
          const minGap = v.halfLen + sep.ahead.halfLen + 2.0;
          if (sep.gap < minGap) {
            v.dist -= (minGap - sep.gap);
            v._speedF = Math.min(v._speedF, 0.04);
          }
        }
        // Frena tambien ante el equipo que conduce el JUGADOR (o el scoop del acarreo) si esta
        // justo ADELANTE en la via (chequeo en espacio-mundo con las posiciones extra).
        for (const ep of extras) {
          const dx = ep.x - now.pos.x, dz = ep.z - now.pos.z;
          if (dx * dx + dz * dz < (v.halfLen + 4.0) ** 2 && (now.dir.x * dx + now.dir.z * dz) > 0) {
            v.dist -= vel * dt;                 // deshace el avance de este frame
            v._speedF = Math.min(v._speedF, 0.04);
            break;
          }
        }

        // --- Direccion progresiva (volante) + inclinacion hacia afuera de la curva.
        const yawT = Math.atan2(now.dir.x, now.dir.z);
        const dy = wrapPi(yawT - v._yaw) * Math.min(1, dt * GIRO_SUAVE);
        v._yaw = wrapPi(v._yaw + dy);
        const yawRate = dt > 1e-5 ? dy / dt : 0;
        const rollT = THREE.MathUtils.clamp(-yawRate * vel * 0.022, -ROLL_MAX, ROLL_MAX);
        v._roll += (rollT - v._roll) * Math.min(1, dt * 4);

        // Reincorporacion suave a la ruta tras soltar el vehiculo (sin teletransporte).
        if (v._blend < 1 && v._blendFrom) {
          v._blend = Math.min(1, v._blend + dt / 1.6);
          const e = v._blend * v._blend * (3 - 2 * v._blend);   // smoothstep
          this._s1.pos.lerpVectors(v._blendFrom, now.pos, e);
          this._place(v, this._s1.pos);
        } else {
          this._place(v, now.pos);
        }
        v.mesh.userData._speed = vel;   // ruedas (y motor) giran con la velocidad REAL
        // DIRECCION (-1..1) derivada del giro real: los equipos ARTICULADOS doblan su bastidor
        // delantero por el pasador central. Los rigidos (camion/camioneta) lo ignoran.
        v.mesh.userData._steer = THREE.MathUtils.clamp(yawRate * 1.6, -1, 1);
        if (cerca) v.mesh.userData.tick?.(dt, v._t);

        // Acarreo: los CAMIONES se cargan al pasar por la camara y descargan en el echadero.
        const carga = v.mesh.userData.carga;
        if (carga && v.mesh.name === 'camion' && this._loadPos) {
          const p = v.mesh.position;
          if (p.distanceToSquared(this._loadPos) < 64) { if (!carga.cargado) carga.set(true); }
          else if (this._unloadPos && p.distanceToSquared(this._unloadPos) < 64) { if (carga.cargado) carga.set(false); }
        }
      }

      // Claxon + muerte al detectar NPCs cercanos
      this._hornTimers[i] = Math.max(0, this._hornTimers[i] - dt);
      for (const npc of this._npcs) {
        if (!npc.alive) continue;

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
