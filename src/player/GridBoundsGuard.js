/**
 * GridBoundsGuard — red de seguridad de contencion para el mundo en RETICULA (GridWorld).
 *
 * A diferencia del BoundsGuard lineal (que localiza el tramo por su Z, asumiendo que todos
 * estan centrados en x=0), aqui los tramos estan rotados y repartidos en XZ, asi que la
 * comprobacion se delega en `world.boundsCheck(pos)` (dentro de la caja orientada de algun
 * tramo/nodo). Si el jugador escapa del gabarito, se le repone a la ultima posicion segura.
 *
 * Corre en fixedUpdate DESPUES del paso de fisica (mismo orden que BoundsGuard).
 */
export class GridBoundsGuard {
  /** @param {{player:object, world:object}} deps */
  constructor({ player, world }) {
    this.controller = player.controller;
    this.world = world;
    this._safe = this.controller.position.clone();
    this._sinceSave = 0;
  }

  fixedUpdate(dt) {
    const pos = this.controller.position;

    if (this.world.boundsCheck(pos)) {
      // Dentro del gabarito: guarda un punto seguro cuando esta apoyado en el piso.
      this._sinceSave += dt;
      if (this._sinceSave > 0.25 && this.controller.grounded) {
        this._sinceSave = 0;
        this._safe.set(pos.x, pos.y, pos.z);
      }
      return;
    }

    // Fuera del gabarito: restaurar.
    this.controller.teleport(this._safe);
  }
}
