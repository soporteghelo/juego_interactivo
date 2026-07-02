import * as THREE from 'three';
import { clamp } from '../utils/math.js';

/**
 * Gestiona la orientacion de la camara (yaw/pitch) y alterna 1a / 3a persona.
 *
 * - 1a persona: camara a la altura de los ojos del minero.
 * - 3a persona: camara detras y arriba, mirando al jugador.
 *
 * El yaw tambien define la direccion de avance del personaje (lo usa el Player).
 */
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI;   // mirando hacia -Z (la galeria avanza hacia el fondo)
    this.pitch = 0;
    this.mode = 'first';  // 'first' | 'third'

    this.eyeHeight = 1.6;
    this.crouchEyeHeight = 1.0;
    this.thirdDistance = 4.5;
    this.thirdHeight = 2.2;

    this._maxPitch = Math.PI / 2 - 0.05;
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
   * Coloca la camara cada frame segun la posicion del jugador y el modo.
   * @param {THREE.Vector3} playerPos  posicion del cuerpo (centro de la capsula)
   * @param {boolean} crouching
   */
  update(playerPos, crouching) {
    const eye = crouching ? this.crouchEyeHeight : this.eyeHeight;

    if (this.mode === 'first') {
      this.camera.position.set(playerPos.x, playerPos.y + eye - 0.7, playerPos.z);
      const dir = new THREE.Vector3(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch)
      );
      this.camera.lookAt(this.camera.position.clone().add(dir));
    } else {
      const back = this.getForward().multiplyScalar(-this.thirdDistance);
      this.camera.position.set(
        playerPos.x + back.x,
        playerPos.y + this.thirdHeight,
        playerPos.z + back.z
      );
      this.camera.lookAt(playerPos.x, playerPos.y + 1.2, playerPos.z);
    }
  }
}
