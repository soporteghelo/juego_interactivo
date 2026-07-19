import * as THREE from 'three';

/**
 * DriveController — hace CONDUCIBLE cualquier vehiculo de la mina (scoop, volquete,
 * camioneta, telehandler, equipos de labor...). Generaliza al antiguo ScoopController
 * y corrige sus bugs de conduccion:
 *
 *  - COLISION: el vehiculo ya no atraviesa la roca. Cada paso se valida contra el galibo
 *    transitable (world.boundsCheck) en el CENTRO y en una SONDA en la trompa/cola segun
 *    el sentido de marcha; si el paso completo falla se intenta deslizar por cada eje
 *    (resbala a lo largo del hastial) y si no, se detiene.
 *  - DESMONTAJE SEGURO: al bajarse se prueba una lista de puntos candidatos (lado del
 *    conductor, lado opuesto, atras, adelante) y se usa el primero DENTRO del galibo;
 *    antes podias quedar incrustado en la pared o fuera del mapa.
 *  - TACTIL: en celular el joystick conduce (adelante/atras + direccion) y TouchControls
 *    muestra una botonera contextual (BAJAR, BOCINA y BRAZO/CUCHARA si el equipo tiene
 *    hidraulica). Antes solo existia teclado.
 *  - OPERADOR VISIBLE: si el vehiculo tiene `userData.operador`, se muestra al conducir
 *    (el equipo se ve OPERADO, no fantasma) y se restaura su estado al bajar.
 *  - FLOTA: los vehiculos del VehicleSystem se ceden con onBoard/onExit (modo manual) y
 *    retoman su ruta suavemente al soltarlos.
 *
 * El jugador se acerca, mira el equipo y pulsa E ("Conducir X"). Al SUBIRSE se congela el
 * personaje (input.enabled=false → Player/Interaction/mirada/Hazards en pausa) y la camara
 * pasa a vista de conduccion (chase cam) detras del equipo. Mientras se conduce se emite
 * 'player:moved' con la posicion del vehiculo para que el streaming de tramos lo siga.
 */

const ACCEL = 3.5;  // suavizado de aceleracion
const BOOM_RATE   = 0.7;  // fraccion de recorrido por segundo (hidraulica)
const BUCKET_RATE = 0.9;

export class DriveController {
  constructor({ scene, camera, input, bus, interaction, player, world }) {
    this.scene = scene;
    this.camera = camera;
    this.input = input;
    this.bus = bus;
    this.interaction = interaction;
    this.player = player;
    this.world = world;

    this.active = null;   // registro del vehiculo conducido (o null)
    this.speed = 0;
    this.yaw = 0;
    this._pitch = 0;      // cabeceo del equipo al subir/bajar rampas
    this._beepT = 0;      // temporizador de la alarma de retroceso
    this._t = 0;
    this._lastEmit = 0;
    this._boardT = 0;
    this._avatarWasVisible = false;
    this._keys = new Set();

    this._vehiculos = [];   // registros { mesh, opts }
    this._tmp = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._camAim = new THREE.Vector3();

    this._onKeyDown = (e) => this._keydown(e);
    this._onKeyUp = (e) => this._keys.delete(e.code);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    // Bocina desde el boton tactil (TouchControls emite 'drive:horn').
    this.bus?.on('drive:horn', () => {
      if (this.active) this.bus.emit('audio:horn', { position: this.active.mesh.position.clone() });
    });
  }

  /**
   * Registra un vehiculo conducible.
   * @param {THREE.Object3D} mesh raiz del vehiculo (frente = +Z local)
   * @param {{
   *   nombre?:string, maxSpeed?:number, turnRate?:number, halfLen?:number,
   *   camDist?:number, camUp?:number, tick?:boolean,
   *   onBoard?:Function, onExit?:Function
   * }} opts
   *  - halfLen: semilargo para la sonda de colision de trompa/cola.
   *  - tick: true si ESTE controlador debe animar el userData.tick del vehiculo mientras
   *    lo conduce (flota cedida / scoop propio). Los equipos de labor ya los tickea su sala.
   *  - onBoard/onExit: hooks (la flota se pone en modo manual y retoma su ruta).
   */
  addVehicle(mesh, opts = {}) {
    const reg = {
      mesh,
      nombre:   opts.nombre ?? 'Equipo',
      maxSpeed: opts.maxSpeed ?? 3.2,
      turnRate: opts.turnRate ?? 1.15,
      halfLen:  opts.halfLen ?? 3.5,
      camDist:  opts.camDist ?? 8.5,
      camUp:    opts.camUp ?? 4.6,
      tick:     opts.tick ?? false,
      alwaysTick: opts.alwaysTick ?? false,   // animar (baliza) aun estacionado sin conductor
      onBoard:  opts.onBoard ?? null,
      onExit:   opts.onExit ?? null
    };
    this._vehiculos.push(reg);
    if (reg.alwaysTick) (this._siempre ??= []).push(reg);
    // Orden YXZ: el cabeceo (x) se aplica sobre el eje LATERAL del vehiculo ya orientado
    // por el yaw — necesario para inclinar el equipo al bajar rampas. Con x=0 es identico
    // al orden por defecto, asi que no altera a la flota.
    mesh.rotation.order = 'YXZ';
    this.interaction.registerInteractable(mesh, {
      label: `Conducir ${reg.nombre} [E]`,
      onInteract: () => this.board(reg)
    });
    return reg;
  }

  _keydown(e) {
    this._keys.add(e.code);
    if (!this.active) return;
    if (e.code === 'Escape') {
      if (this._t - this._boardT > 0.3) this.exit();
    } else if (e.code === 'KeyH') {
      this.bus?.emit('audio:horn', { position: this.active.mesh.position.clone() });
    }
  }

  /** El jugador se sube al vehiculo. */
  board(reg) {
    if (this.active) return;
    this.active = reg;
    this._boardT = this._t;
    this.speed = 0;

    // Los equipos de labor viven DENTRO del grupo de su sala (coordenadas locales):
    // se reparentan a la escena CONSERVANDO su transform de mundo para poder conducirlos
    // por toda la mina.
    if (reg.mesh.parent !== this.scene) this.scene.attach(reg.mesh);
    this.yaw = reg.mesh.rotation.y;
    this._pitch = reg.mesh.rotation.x || 0;
    this._beepT = 0;

    // Hidraulica en modo manual (apaga la demo automatica del visor). El flag `_driven`
    // hace que el ciclo autonomo (HaulCycle) ceda el scoop de la camara al jugador.
    reg.mesh.userData.scoop?.setManual?.();
    reg.mesh.userData._driven = true;
    // Retira los tacos/cuñas de estacionamiento: el equipo pasa a operar.
    if (reg.mesh.userData._tacos) reg.mesh.userData._tacos.visible = false;

    // Operador visible al volante (se restaura al bajar).
    const op = reg.mesh.userData.operador;
    if (op) { reg._opWasVisible = op.visible; op.visible = true; }

    reg.onBoard?.(reg.mesh);

    this.input.enabled = false; // congela jugador + interaccion + mirada + peligros
    this._avatarWasVisible = this.player.mesh.visible;
    this.player.mesh.visible = false;

    const esTouch = this.input.controlScheme === 'touch';
    const tieneApi = !!reg.mesh.userData.scoop;
    this.bus?.emit('drive:enter', { nombre: reg.nombre, api: tieneApi, mesh: reg.mesh });
    this.bus?.emit('ui:prompt', esTouch
      ? `CONDUCIENDO ${reg.nombre.toUpperCase()}  ·  joystick: conducir  ·  BAJAR para salir`
      : `CONDUCIENDO ${reg.nombre.toUpperCase()}  ·  WASD mover${tieneApi ? '  ·  R/F brazo  ·  T/G cargar·volcar' : ''}  ·  H bocina  ·  E bajar`);
  }

  /** El jugador se baja: busca un punto SEGURO junto al equipo y devuelve el control. */
  exit() {
    const reg = this.active;
    if (!reg) return;
    this.active = null;
    this.speed = 0;
    reg.mesh.userData._speed = 0;
    reg.mesh.userData._steer = 0;        // el bastidor articulado vuelve a recto al bajarse
    reg.mesh.userData._driven = false;   // devuelve el scoop al ciclo autonomo (si lo tenia)
    // Restaura los tacos de estacionamiento: el equipo queda detenido/acuñado.
    if (reg.mesh.userData._tacos) reg.mesh.userData._tacos.visible = true;

    // Restaura el operador (la flota lo mantiene visible; los estacionados lo ocultan).
    const op = reg.mesh.userData.operador;
    if (op) op.visible = reg._opWasVisible ?? false;

    // ── Punto de desmontaje VALIDADO contra el galibo (antes: siempre "detras", aunque
    // fuera dentro de la roca). Candidatos: izquierda (lado del conductor), derecha,
    // atras y adelante, a distancia segun el tamaño del equipo.
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const fwd = { x: s, z: c };
    const right = { x: -c, z: s };
    const p0 = reg.mesh.position;
    const candidatos = [
      { x: -right.x * 2.6, z: -right.z * 2.6 },                       // izquierda
      { x:  right.x * 2.6, z:  right.z * 2.6 },                       // derecha
      { x: -fwd.x * (reg.halfLen + 1.6), z: -fwd.z * (reg.halfLen + 1.6) }, // atras
      { x:  fwd.x * (reg.halfLen + 2.0), z:  fwd.z * (reg.halfLen + 2.0) }  // adelante
    ];
    let spot = null;
    for (const cand of candidatos) {
      this._tmp.set(p0.x + cand.x, p0.y + 1.0, p0.z + cand.z);
      if (!this.world?.boundsCheck || this.world.boundsCheck(this._tmp)) {
        spot = new THREE.Vector3(p0.x + cand.x, p0.y + 1.4, p0.z + cand.z);
        break;
      }
    }
    // Ultimo recurso: sobre el punto del vehiculo (el BoundsGuard lo reubicara si hace falta).
    if (!spot) spot = new THREE.Vector3(p0.x, p0.y + 1.4, p0.z);
    // A la ALTURA del piso real (importante si se desmonta en la rampa o el nivel inferior).
    const gy = this.world?.groundHeight?.(spot);
    if (gy !== null && gy !== undefined) spot.y = gy + 1.4;
    this.player.controller.teleport(spot);
    this.player.mesh.visible = this._avatarWasVisible;

    reg.onExit?.(reg.mesh);

    this.input.enabled = true;
    // Drena TODOS los flags de un disparo acumulados durante la conduccion (botones
    // tactiles / teclas): sin esto, al bajar se disparaba un salto o linterna fantasma.
    for (const f of ['interact', 'jump', 'flashlight', 'view']) this.input.consumePressed(f);
    this.bus?.emit('drive:exit', {});
    this.bus?.emit('ui:prompt', null);
  }

  /**
   * Provee las posiciones de OTROS equipos (flota + scoop de acarreo) como obstaculos solidos:
   * el vehiculo que conduce el jugador NO puede traspasarlos. `fn` devuelve un array de Vector3.
   */
  setBlockers(fn) { this._blockersFn = fn; }

  /**
   * Intenta mover el vehiculo a (nx, nz) validando CENTRO y SONDA de trompa/cola contra el
   * galibo Y contra otros equipos (no traspasarse). Devuelve true si el movimiento (o un
   * deslizamiento por un eje) se aplico.
   */
  _tryMove(reg, nx, nz, dirSign) {
    const bc = this.world?.boundsCheck;
    const pos = reg.mesh.position;

    // Otros equipos como OBSTACULO solido (circulo = suma de semilargos + margen).
    const blockers = this._blockersFn?.();
    const blocked = (px, pz) => {
      if (!blockers || !blockers.length) return false;
      const R = reg.halfLen + 3.0;
      const R2 = R * R;
      for (const b of blockers) {
        const dx = b.x - px, dz = b.z - pz;
        if (dx * dx + dz * dz < R2) return true;
      }
      return false;
    };

    if (!bc) {   // mundo sin galibo (lineal): solo evita traspasar equipos
      if (blocked(nx, nz)) return false;
      pos.x = nx; pos.z = nz; return true;
    }

    const probe = (px, pz) => {
      if (blocked(px, pz)) return false;
      // Centro del vehiculo…
      if (!bc(this._tmp.set(px, pos.y + 1.0, pz))) return false;
      // …y trompa/cola segun el sentido (que el frente no se incruste en el hastial).
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      return bc(this._tmp.set(
        px + s * reg.halfLen * dirSign,
        pos.y + 1.0,
        pz + c * reg.halfLen * dirSign
      ));
    };

    if (probe(nx, nz)) { pos.x = nx; pos.z = nz; return true; }
    if (probe(nx, pos.z)) { pos.x = nx; return true; }   // desliza por X
    if (probe(pos.x, nz)) { pos.z = nz; return true; }   // desliza por Z
    return false;
  }

  update(dt, elapsed) {
    this._t += dt;

    // Baliza/hidraulica: los `alwaysTick` (scoop del spawn) se animan aun estacionados; el
    // vehiculo activo se anima aqui SOLO si nadie mas lo hace (flota en manual: tick=true;
    // equipos de labor: ya los tickea su sala → tick=false).
    for (const r of this._siempre || []) {
      if (r !== this.active) r.mesh.userData.tick?.(dt, this._t);
    }
    const reg = this.active;
    if (reg && (reg.tick || reg.alwaysTick)) reg.mesh.userData.tick?.(dt, this._t);

    if (!reg) return;

    const k = this._keys;
    // Teclado + joystick tactil suman en el MISMO eje (input.move lo escriben ambos).
    const mv = this.input.move;
    const fwd   = THREE.MathUtils.clamp(
      ((k.has('KeyW') || k.has('ArrowUp')) ? 1 : 0) - ((k.has('KeyS') || k.has('ArrowDown')) ? 1 : 0) + mv.y,
      -1, 1);
    const steer = THREE.MathUtils.clamp(
      ((k.has('KeyA') || k.has('ArrowLeft')) ? 1 : 0) - ((k.has('KeyD') || k.has('ArrowRight')) ? 1 : 0) - mv.x,
      -1, 1);

    // Aceleracion suavizada.
    this.speed += (fwd * reg.maxSpeed - this.speed) * Math.min(1, dt * ACCEL);
    if (Math.abs(this.speed) < 0.02) this.speed = 0;

    // Direccion tipo vehiculo: gira segun velocidad (al retroceder, invierte, como un auto).
    const turnFactor = THREE.MathUtils.clamp(this.speed / 1.5, -1, 1);
    this.yaw += steer * reg.turnRate * dt * turnFactor;

    // Avance cinematico CON COLISION (adelante local = +Z).
    if (this.speed !== 0) {
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      const nx = reg.mesh.position.x + s * this.speed * dt;
      const nz = reg.mesh.position.z + c * this.speed * dt;
      if (!this._tryMove(reg, nx, nz, Math.sign(this.speed) || 1)) this.speed = 0;
    }

    // ── Sigue la ALTURA DEL PISO (rampas/decline): el equipo baja al nivel inferior en vez
    // de chocar con un muro invisible. Dos muestras adelante/atras dan el CABECEO real.
    if (this.world?.groundHeight) {
      const p = reg.mesh.position;
      const gy = this.world.groundHeight(p);
      if (gy !== null) p.y += THREE.MathUtils.clamp(gy - p.y, -6 * dt, 6 * dt);
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      const gF = this.world.groundHeight(this._tmp.set(p.x + s * 2.5, p.y, p.z + c * 2.5));
      const gB = this.world.groundHeight(this._tmp.set(p.x - s * 2.5, p.y, p.z - c * 2.5));
      const pitchT = (gF !== null && gB !== null) ? Math.atan2(gB - gF, 5.0) : 0;
      this._pitch += (pitchT - this._pitch) * Math.min(1, dt * 5);
    }
    reg.mesh.rotation.set(this._pitch, this.yaw, 0);
    reg.mesh.userData._speed = this.speed;
    // DIRECCION (-1..1) para los equipos ARTICULADOS: su tick dobla el bastidor delantero por el
    // pasador central (los trackless largos viran quebrandose, no girando ruedas). Solo se dobla
    // si el equipo se esta moviendo de verdad (con la maquina detenida el volante no articula).
    reg.mesh.userData._steer = steer * Math.abs(turnFactor);

    // Alarma de RETROCESO (obligatoria en equipo minero): beep periodico mientras se
    // retrocede, sintetizado y espacializado por el AudioManager.
    if (this.speed < -0.3) {
      this._beepT -= dt;
      if (this._beepT <= 0) {
        this._beepT = 1.0;
        this.bus?.emit('audio:reverseBeep', { position: reg.mesh.position.clone() });
      }
    } else {
      this._beepT = 0;
    }

    // Hidraulica (si el equipo la tiene): teclas R/F/T/G + botones tactiles sostenidos.
    const api = reg.mesh.userData.scoop;
    if (api) {
      if (k.has('KeyR') || this.input.isDown('boomUp'))    api.raiseBoom(BOOM_RATE * dt);
      if (k.has('KeyF') || this.input.isDown('boomDown'))  api.lowerBoom(BOOM_RATE * dt);
      if (k.has('KeyT') || this.input.isDown('bucketIn'))  api.curl(BUCKET_RATE * dt);
      if (k.has('KeyG') || this.input.isDown('bucketOut')) api.dump(BUCKET_RATE * dt);
    }

    // Bajarse: E (teclado, via flag) o boton BAJAR tactil. Con guarda temporal para no
    // bajarse en el mismo gesto con el que se subio.
    if (this.input.consumePressed('interact') && this._t - this._boardT > 0.4) this.exit();
    if (!this.active) return;   // exit() pudo dispararse arriba

    // Chase cam: detras y arriba (distancias por tamaño de equipo), mirando al frente.
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const p = reg.mesh.position;
    this._camAim.set(p.x + s * 3, p.y + 1.8, p.z + c * 3);
    this._camPos.set(p.x - s * reg.camDist, p.y + reg.camUp, p.z - c * reg.camDist);
    this.camera.position.lerp(this._camPos, Math.min(1, dt * 6));
    // Que la camara no quede DENTRO de la roca al doblar en cruces estrechos: si el punto
    // cae fuera del galibo, se acerca al objetivo hasta reentrar (pocas iteraciones).
    if (this.world?.boundsCheck) {
      let guard = 0;
      while (guard++ < 4 && !this.world.boundsCheck(this.camera.position)) {
        this.camera.position.lerp(this._camAim, 0.35);
      }
    }
    this.camera.lookAt(this._camAim);

    // El streaming de tramos sigue al vehiculo (sin tag `pie`: no genera pasos).
    if (elapsed - this._lastEmit > 0.1) {
      this._lastEmit = elapsed;
      this.bus?.emit('player:moved', { position: p.clone(), yaw: this.yaw });
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
