import * as THREE from 'three';

/**
 * Controlador de personaje sobre el character controller cinematico de Rapier.
 *
 * Gestiona gravedad, salto y colision con paredes/piso de los tramos. Recibe un vector de
 * movimiento horizontal "deseado" (ya orientado segun la camara) y resuelve la colision.
 *
 * No conoce el input ni la camara: el Player le pasa el vector ya calculado (desacople).
 */
export class CharacterController {
  constructor(physics, spawn) {
    this.physics = physics;
    const { body, collider, controller } = physics.createCharacter({ position: spawn });
    this.body = body;
    this.collider = collider;
    this.controller = controller;

    this.verticalVelocity = 0;
    this.grounded = false;
    this.gravity = -18;       // un poco mas que 9.81 para un salto "gameplay"
    this.jumpSpeed = 6.2;

    this._tmp = new THREE.Vector3();
    this._stuckFrames = 0;    // contador anti-atasco
  }

  get position() {
    const t = this.body.translation();
    return this._tmp.set(t.x, t.y, t.z);
  }

  /** Solicita un salto (solo si esta en el piso). */
  jump() {
    if (this.grounded) this.verticalVelocity = this.jumpSpeed;
  }

  /**
   * Mueve el personaje resolviendo colisiones.
   * @param {THREE.Vector3} horizontal  desplazamiento horizontal deseado este paso (x,z)
   * @param {number} dt
   */
  move(horizontal, dt) {
    // Gravedad / salto
    this.verticalVelocity += this.gravity * dt;
    const desired = {
      x: horizontal.x,
      y: this.verticalVelocity * dt,
      z: horizontal.z
    };

    this.controller.computeColliderMovement(this.collider, desired);
    const corrected = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();

    if (this.grounded && this.verticalVelocity < 0) {
      this.verticalVelocity = -1; // mantener pegado al piso
    }

    // Anti-atasco: si el jugador intenta moverse horizontalmente pero el controlador
    // devuelve movimiento nulo durante varias frames seguidas, aplica un pequeño empuje
    // hacia arriba para que la cápsula salga de la arista donde quedó enganchada.
    const hDeseado   = horizontal.x * horizontal.x + horizontal.z * horizontal.z;
    const hCorregido = corrected.x  * corrected.x  + corrected.z  * corrected.z;
    if (hDeseado > 1e-4 && this.grounded && hCorregido < hDeseado * 0.04) {
      this._stuckFrames++;
    } else {
      this._stuckFrames = 0;
    }
    // Empuje suave de 3 cm/frame tras ~0.33 s atascado; se resetea al desbloquearse.
    const nudgeY = this._stuckFrames >= 20 ? 0.03 : 0;
    if (this._stuckFrames > 60) this._stuckFrames = 0; // evita empujar indefinidamente

    const t = this.body.translation();
    this.body.setNextKinematicTranslation({
      x: t.x + corrected.x,
      y: t.y + corrected.y + nudgeY,
      z: t.z + corrected.z
    });
  }

  /** Reposiciona el cuerpo (ej: respawn). */
  teleport(position) {
    this.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    this.verticalVelocity = 0;
  }
}
