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

    // Al presionar contra el hastial NO se altera Y. El antiguo empuje anti-atasco de 3 cm/frame
    // hacia arriba rebotaba la camara y se percibia como lag; las costuras entre tramos se
    // resuelven en Physics (autostep/snap + FIX_INTERNAL_EDGES), no empujando la capsula.

    const t = this.body.translation();
    this.body.setNextKinematicTranslation({
      x: t.x + corrected.x,
      y: t.y + corrected.y,
      z: t.z + corrected.z
    });
  }

  /** Reposiciona el cuerpo (ej: respawn). */
  teleport(position) {
    const target = { x: position.x, y: position.y, z: position.z };
    this.body.setTranslation(target, true);
    // Un cuerpo cinematico conserva su siguiente destino. Igualarlo evita que el proximo
    // world.step lo arrastre hacia la ubicacion previa y parezca un segundo reinicio.
    this.body.setNextKinematicTranslation(target);
    this.verticalVelocity = 0;
    this.grounded = false;
  }
}
