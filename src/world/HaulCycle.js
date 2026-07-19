import * as THREE from 'three';

/**
 * HaulCycle — CICLO DE ACARREO autonomo del LHD (scoop) en la camara/stope: mucking real.
 *
 * Reutiliza el scoop YA estacionado en la sala `camara` (mira a la pila) y ejecuta una
 * maquina de estados CINEMATICA que muck-ea la pila de mineral y descarga hacia la boca:
 *   cargar (nariz en la pila, baja brazo + curl) → salir (tram en REVERSA hacia la boca, con
 *   alarma de retroceso) → volcar (sube brazo + dump) → volver (regresa a la pila). ~12.5 s.
 *
 * Robusto frente a la CONDUCCION del jugador: si alguien se sube al scoop (userData._driven),
 * el ciclo se pausa; al bajarse, retoma suavemente regresando a su posicion de trabajo (sin
 * teletransporte). Solo AVANZA cuando la sala es visible (el streaming ya la oculta lejos).
 *
 * Trabaja en POSICION MUNDO (this._wp) y la escribe al scoop via parent.worldToLocal, asi el
 * ciclo funciona igual sea el scoop hijo de la sala o reparentado a la escena tras conducirlo.
 */

const STATES = [
  { name: 'cargar', target: 'pila', boom: 0.0,  bucket: 1.0, dur: 3.0 },
  { name: 'salir',  target: 'out',  boom: 0.5,  bucket: 1.0, dur: 3.5, reverse: true },
  { name: 'volcar', target: 'out',  boom: 0.85, bucket: 0.0, dur: 2.5 },
  { name: 'volver', target: 'home', boom: 0.2,  bucket: 0.2, dur: 3.5 },
];

const _smooth = (k) => k * k * (3 - 2 * k);
const _lerp = (a, b, k) => a + (b - a) * k;

export class HaulCycle {
  constructor({ world, bus }) {
    this.bus = bus;
    this.room = (world.segments || []).find(s => s.type === 'room' && s.roomType === 'camara') || null;
    this.scoop = this.room ? this.room.group.getObjectByName('scoop') : null;
    this.pila = this.room ? this.room.group.getObjectByName('pila_mineral') : null;
    this.pilaApi = this.pila?.userData.pila || null;

    this._scratch = new THREE.Vector3();
    this._wp = new THREE.Vector3();
    this._from = new THREE.Vector3();
    this._fromBoom = 0; this._fromBucket = 0;
    this._t = 0; this._idx = 0; this._beep = 0; this._wasDriven = false;

    if (!this.scoop) return;
    this.scoop.userData.scoop?.setManual?.();
    this.scoop.getWorldPosition(this._wp);
    const yaw = this.scoop.rotation.y;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));  // el scoop mira a la pila
    this._yaw = yaw;
    this.targets = {
      home: this._wp.clone(),
      pila: this._wp.clone().addScaledVector(fwd, 1.3),    // nariz metida en la pila
      out:  this._wp.clone().addScaledVector(fwd, -3.4),   // tram en reversa hacia la boca
    };
    this._enter(0);
  }

  /** Posicion mundo del scoop (para que los NPC se aparten), o null si no hay ciclo. */
  get vehiclePos() { return this.scoop && !this.scoop.userData._driven ? this._wp : null; }

  _enter(idx) {
    this._idx = idx; this._t = 0;
    this._from.copy(this._wp);
    const api = this.scoop.userData.scoop;
    this._fromBoom = api ? api.boom : 0;
    this._fromBucket = api ? api.bucket : 0;
  }

  update(dt) {
    const scoop = this.scoop;
    if (!scoop) return;

    // Pausado mientras lo conduce el jugador: solo seguimos su posicion real.
    if (scoop.userData._driven) {
      scoop.getWorldPosition(this._wp);
      this._wasDriven = true;
      return;
    }
    // Recien soltado: retoma regresando a la posicion de trabajo desde donde quedo.
    if (this._wasDriven) {
      this._wasDriven = false;
      scoop.getWorldPosition(this._wp);
      this._enter(3); // 'volver' → regresa a la pila
    }

    // Solo trabaja con la sala a la vista (fuera de la niebla nadie lo ve).
    if (this.room && this.room.group.visible === false) return;

    const st = STATES[this._idx];
    this._t += dt;
    const k = _smooth(Math.min(1, this._t / st.dur));

    // Posicion + hidraulica interpoladas.
    this._wp.lerpVectors(this._from, this.targets[st.target], k);
    const api = scoop.userData.scoop;
    if (api) { api.boom = _lerp(this._fromBoom, st.boom, k); api.bucket = _lerp(this._fromBucket, st.bucket, k); }

    // Escribe al scoop en el espacio de SU padre (sala o escena).
    scoop.position.copy(scoop.parent.worldToLocal(this._scratch.copy(this._wp)));
    scoop.rotation.y = this._yaw;
    scoop.userData._speed = st.reverse ? -1.5 : 0;   // motor/diesel de proximidad

    // Alarma de retroceso durante el tram en reversa.
    if (st.reverse) {
      this._beep -= dt;
      if (this._beep <= 0) { this._beep = 1.0; this.bus?.emit('audio:reverseBeep', { position: this._wp.clone() }); }
    }

    if (this._t >= st.dur) {
      if (st.name === 'cargar') this.pilaApi?.extraer(0.09);   // muck: baja la pila
      this._enter((this._idx + 1) % STATES.length);
    }
  }
}
