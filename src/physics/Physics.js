import * as RAPIER from '@dimforge/rapier3d-compat';

/**
 * Envoltorio del mundo de fisica Rapier.
 *
 * Rapier (-compat) carga su WASM de forma asincrona: hay que llamar a init() y esperar
 * antes de crear cuerpos. El paso de simulacion (world.step) lo ejecuta este sistema en
 * fixedUpdate, DESPUES de que el jugador haya fijado su movimiento cinematico
 * (ver orden de registro en Engine).
 *
 * Expone helpers para crear colisionadores estaticos (paredes/piso de los tramos) y el
 * character controller del jugador.
 */
export class Physics {
  constructor() {
    this.RAPIER = null;
    this.world = null;
    this.ready = false;
  }

  async init() {
    await RAPIER.init();
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.ready = true;
  }

  /** Paso fijo de simulacion (lo llama el Loop). */
  fixedUpdate() {
    if (this.ready) this.world.step();
  }

  /**
   * Crea un colisionador estatico tipo caja (para paredes/piso/techo de los tramos).
   *
   * `rot` es un cuaternion opcional {x,y,z,w}: en el modo lineal los tramos no rotan y se
   * omite (comportamiento identico al historico). En el modo retICula (GridWorld) las galerias
   * corren en X y los cruceros en Z, por lo que sus cajas van rotadas sobre el eje Y.
   * @param {{hx:number,hy:number,hz:number, pos:[number,number,number], rot?:{x:number,y:number,z:number,w:number}}} spec
   * @returns {object} collider de Rapier
   */
  addStaticCuboid({ hx, hy, hz, pos, rot }) {
    const bodyDesc = this.RAPIER.RigidBodyDesc.fixed().setTranslation(pos[0], pos[1], pos[2]);
    if (rot) bodyDesc.setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });
    const body = this.world.createRigidBody(bodyDesc);
    const colDesc = this.RAPIER.ColliderDesc.cuboid(hx, hy, hz);
    return this.world.createCollider(colDesc, body);
  }

  /** Elimina un colisionador estatico (al descargar un tramo lejano). */
  removeCollider(collider) {
    if (collider && this.world) {
      const body = collider.parent();
      this.world.removeCollider(collider, false);
      if (body) this.world.removeRigidBody(body);
    }
  }

  /**
   * Crea el cuerpo cinematico + capsula + character controller del jugador.
   * @returns {{body:object, collider:object, controller:object}}
   */
  createCharacter({ position, radius = 0.35, halfHeight = 0.7 }) {
    const bodyDesc = this.RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      position.x,
      position.y,
      position.z
    );
    const body = this.world.createRigidBody(bodyDesc);

    const colDesc = this.RAPIER.ColliderDesc.capsule(halfHeight, radius);
    const collider = this.world.createCollider(colDesc, body);

    const controller = this.world.createCharacterController(0.05); // offset 5cm: más estable en esquinas
    controller.enableAutostep(0.45, 0.20, true);  // sube escalones/aristas hasta 45 cm
    controller.enableSnapToGround(0.50);          // se pega al piso en rampas/costuras
    controller.setApplyImpulsesToDynamicBodies(true);
    controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);

    return { body, collider, controller };
  }

  /**
   * Cápsula CINEMÁTICA para un personaje NO jugador (NPC): un cuerpo que el NPC reubica cada
   * frame. No resuelve colisiones por sí mismo, pero el character controller del jugador SÍ
   * colisiona contra él → el jugador no puede atravesar a las demás personas.
   * @returns {{body:object, collider:object}}
   */
  createKinematicCapsule({ position, radius = 0.3, halfHeight = 0.6 }) {
    const bodyDesc = this.RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(position.x, position.y, position.z);
    const body = this.world.createRigidBody(bodyDesc);
    const colDesc = this.RAPIER.ColliderDesc.capsule(halfHeight, radius);
    const collider = this.world.createCollider(colDesc, body);
    return { body, collider };
  }
}
