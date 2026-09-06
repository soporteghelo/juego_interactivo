import * as THREE from 'three';
import { clamp } from '../utils/math.js';

/**
 * Gestiona la orientacion de la camara (yaw/pitch), la MARCHA del jugador y alterna 1a / 3a.
 *
 * - 1a persona: camara a la altura de los ojos del minero, con el cabeceo de la caminata.
 * - 3a persona: camara detras y arriba, mirando al jugador.
 *
 * El yaw tambien define la direccion de avance del personaje (lo usa el Player).
 *
 * ── POR QUE HAY MARCHA ────────────────────────────────────────────────────────
 * Antes la camara se fijaba a una altura constante sobre la capsula: cero cabeceo, cero
 * balanceo, cero inercia. Recorrer 300 m de galeria se sentia como desplazar un dron por un
 * rail, y era lo primero que delataba que el jugador no estaba ANDANDO por la mina.
 *
 * Aqui se camina sobre roca triturada y barro, con botas de punta de acero, casco y
 * autorrescatador a la cadera: el paso es pesado y descompensado. Eso se modela con tres cosas
 * que cuestan tres senos por frame y ni un solo triangulo:
 *   · CABECEO   — el ojo sube y baja DOS veces por zancada completa (una por pie).
 *   · BALANCEO  — el cuerpo se vuelca de lado UNA vez por zancada, en cuadratura con el cabeceo
 *                 (juntos dibujan el "ocho" que describe la cabeza al caminar) + un alabeo leve.
 *   · IMPACTO   — al aterrizar, el ojo se hunde y se recupera con un muelle amortiguado.
 *
 * La amplitud sigue a la velocidad REAL medida (desplazamiento/dt), no al input: si el jugador
 * empuja contra un hastial no avanza, y la camara tampoco debe cabecear.
 */

// Zancada completa (dos pasos) en metros. A 3 m/s salen ~3.2 pasos/s, cadencia de marcha viva.
const ZANCADA = 1.9;
// Amplitudes a velocidad de caminata. Deliberadamente CONTENIDAS: pasarse marea, y en una
// galeria oscura el cabeceo se nota mucho mas que a plena luz.
const BOB_Y = 0.022;      // m — hundimiento vertical del ojo
const BOB_X = 0.016;      // m — vaiven lateral
const BOB_ALABEO = 0.011; // rad (~0.6°)
// Correr no es caminar rapido: el paso es mas largo y el cuerpo se descompensa mas.
const BOB_CARRERA = 1.35;
// En 3a persona la camara NO es un ojo, es una camara de seguimiento: se atenua fuerte para que
// el encuadre no tiemble al mirar al avatar.
const BOB_TERCERA = 0.35;
// Velocidad de referencia (walkSpeed del Player) a la que la amplitud vale 1.
const VEL_REF = 3.0;
// Muelle del impacto de aterrizaje: rigidez y amortiguacion.
const IMPACTO_K = 90, IMPACTO_C = 13;
const IMPACTO_ESCALA = 0.075;   // m de hundimiento por m/s de caida
const IMPACTO_MAX = 0.08;       // tope de hundimiento (m)

export class CameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {object} [bus]  EventBus — recibe `player:paso` en cada contacto de talon.
   */
  constructor(camera, bus = null) {
    this.camera = camera;
    this.bus = bus;
    this.yaw = Math.PI;   // mirando hacia -Z (la galeria avanza hacia el fondo)
    this.pitch = 0;
    this.mode = 'first';  // 'first' | 'third'

    this.eyeHeight = 1.6;
    this.crouchEyeHeight = 1.0;
    this.thirdDistance = 4.5;
    this.thirdHeight = 2.2;

    this._maxPitch = Math.PI / 2 - 0.05;

    // ── Estado de la marcha ──
    this._fase = 0;                    // avanza 2π por zancada completa
    this._ultimoPaso = 0;              // indice del ultimo talon que toco el piso
    this._alturaOjo = this.eyeHeight;  // altura interpolada (el agachado ya no salta)
    this._impacto = 0;                 // desplazamiento actual del muelle de aterrizaje
    this._impactoVel = 0;
    // Base de FOV: la refresca el Engine al redimensionar (75 apaisado / 82 en vertical), asi
    // que se re-lee cada vez que cambia por fuera en vez de congelarla en el constructor.
    this._fovBase = camera.fov;
    this._fovAplicado = camera.fov;

    this._dir = new THREE.Vector3();
    this._lado = new THREE.Vector3();
  }

  toggleMode() {
    this.mode = this.mode === 'first' ? 'third' : 'first';
  }

  /** Aplica el delta de mirada acumulado (raton/arrastre tactil). */
  applyLook(dx, dy) {
    this.yaw += dx;
    this.pitch = clamp(this.pitch + dy, -this._maxPitch, this._maxPitch);
  }

  /** Direccion horizontal de avance (segun el yaw). */
  getForward(target = new THREE.Vector3()) {
    return target.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
  }

  getRight(target = new THREE.Vector3()) {
    // Derecha = adelante girado -90° en Y. (Con +90° quedaba invertida: "A" iba a la derecha.)
    return target.set(Math.sin(this.yaw - Math.PI / 2), 0, Math.cos(this.yaw - Math.PI / 2)).normalize();
  }

  /**
   * Avanza la marcha y devuelve el desplazamiento del ojo respecto a la vertical del cuerpo.
   * Emite `player:paso` en cada contacto de talon, que es lo que sincroniza el sonido de la
   * pisada con lo que se ve (antes el audio llevaba su propio temporizador y sonaba a destiempo).
   */
  _avanzarMarcha(dt, velocidad, corriendo, enSuelo) {
    // Solo se camina con los pies en el piso: en el aire el cuerpo no da zancadas.
    const v = enSuelo ? velocidad : 0;
    this._fase += (v / ZANCADA) * 2 * Math.PI * dt;

    // El talon toca el piso en el punto BAJO del cabeceo: sin(2f) minimo ⇒ f = 3π/4 + kπ.
    // Sale un paso cada π de fase, o sea dos por zancada. Uno por pie.
    const paso = Math.floor((this._fase - (3 * Math.PI) / 4) / Math.PI);
    if (paso !== this._ultimoPaso) {
      // Si la fase salta varios pasos (framerate bajo) solo se emite uno: no se acumulan pisadas.
      if (paso > this._ultimoPaso && v > 0.5) {
        this.bus?.emit?.('player:paso', { velocidad: v, pie: paso % 2 === 0 ? 'izq' : 'der' });
      }
      this._ultimoPaso = paso;
    }

    // Amplitud proporcional a la velocidad real: parado no cabecea, y al frenar se desvanece
    // solo sin necesidad de amortiguar la fase.
    let amp = Math.min(1, v / VEL_REF);
    if (corriendo) amp *= BOB_CARRERA;
    if (this.mode === 'third') amp *= BOB_TERCERA;

    return {
      vertical: Math.sin(this._fase * 2) * BOB_Y * amp,
      lateral: Math.sin(this._fase) * BOB_X * amp,
      alabeo: Math.sin(this._fase) * BOB_ALABEO * amp
    };
  }

  /** Muelle amortiguado del impacto de aterrizaje. `impacto` = velocidad de caida (m/s). */
  _avanzarImpacto(dt, impacto) {
    if (impacto > 0) {
      this._impactoVel -= Math.min(impacto, 14) * IMPACTO_ESCALA;
    }
    this._impactoVel += (-IMPACTO_K * this._impacto - IMPACTO_C * this._impactoVel) * dt;
    this._impacto = clamp(this._impacto + this._impactoVel * dt, -IMPACTO_MAX, IMPACTO_MAX);
    return this._impacto;
  }

  /**
   * Coloca la camara cada frame segun la posicion del jugador y el modo.
   *
   * @param {THREE.Vector3} playerPos  posicion del cuerpo (centro de la capsula)
   * @param {boolean} crouching
   * @param {object} [marcha]
   * @param {number}  marcha.dt          delta de tiempo del frame
   * @param {number}  marcha.velocidad   velocidad REAL de avance (m/s), no la deseada
   * @param {boolean} marcha.corriendo
   * @param {boolean} marcha.enSuelo
   * @param {number}  marcha.impacto     velocidad de caida al tocar suelo este frame (m/s)
   */
  update(playerPos, crouching, marcha = {}) {
    const { dt = 0, velocidad = 0, corriendo = false, enSuelo = true, impacto = 0 } = marcha;

    // Agachado SUAVE: antes el ojo saltaba de 1.6 a 1.0 m en un frame y se veia como un corte.
    const objetivo = crouching ? this.crouchEyeHeight : this.eyeHeight;
    this._alturaOjo += (objetivo - this._alturaOjo) * (1 - Math.exp(-12 * Math.max(dt, 1e-4)));

    const bob = this._avanzarMarcha(Math.max(dt, 1e-4), velocidad, corriendo, enSuelo);
    const hundimiento = this._avanzarImpacto(Math.max(dt, 1e-4), impacto);

    if (this.mode === 'first') {
      this.getRight(this._lado);
      this.camera.position.set(
        playerPos.x + this._lado.x * bob.lateral,
        playerPos.y + this._alturaOjo - 0.7 + bob.vertical + hundimiento,
        playerPos.z + this._lado.z * bob.lateral
      );
      this._dir.set(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch)
      );
      this.camera.lookAt(
        this.camera.position.x + this._dir.x,
        this.camera.position.y + this._dir.y,
        this.camera.position.z + this._dir.z
      );
      // El alabeo va DESPUES del lookAt: es una rotacion sobre el eje de vision.
      this.camera.rotateZ(bob.alabeo);
    } else {
      const back = this.getForward().multiplyScalar(-this.thirdDistance);
      this.camera.position.set(
        playerPos.x + back.x,
        playerPos.y + this.thirdHeight + bob.vertical + hundimiento,
        playerPos.z + back.z
      );
      this.camera.lookAt(playerPos.x, playerPos.y + 1.2, playerPos.z);
    }

    this._aplicarFov(Math.max(dt, 1e-4), corriendo && velocidad > VEL_REF * 0.6);
  }

  /**
   * Ligera apertura de FOV al correr: el tunel se estrecha en la periferia y da sensacion de
   * velocidad sin tocar la velocidad real. Se re-lee la base si el Engine la cambio (resize).
   */
  _aplicarFov(dt, corriendo) {
    if (Math.abs(this.camera.fov - this._fovAplicado) > 0.001) this._fovBase = this.camera.fov;
    const objetivo = this._fovBase * (corriendo ? 1.052 : 1);
    if (Math.abs(this.camera.fov - objetivo) > 0.01) {
      this.camera.fov += (objetivo - this.camera.fov) * (1 - Math.exp(-6 * dt));
      this.camera.updateProjectionMatrix();
    }
    this._fovAplicado = this.camera.fov;
  }
}
