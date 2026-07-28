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
    this.player = player;
    this.controller = player.controller;
    this.world = world;
    this._safe = this.controller.position.clone();
    this._sinceSave = 0;
    this._invalidTime = 0;
  }

  fixedUpdate(dt) {
    const pos = this.controller.position;

    if (this.world.boundsCheck(pos)) {
      this._invalidTime = 0;
      // Dentro del gabarito: guarda un punto seguro cuando esta apoyado en el piso.
      this._sinceSave += dt;
      if (this._sinceSave > 0.25 && this.controller.grounded) {
        this._sinceSave = 0;
        this._safe.set(pos.x, pos.y, pos.z);
      }
      return;
    }

    // Tolera costuras de uno o pocos pasos físicos. Antes una única lectura inválida al
    // cruzar la boca de un nicho teletransportaba inmediatamente a la posición anterior.
    this._invalidTime += dt;
    if (this._invalidTime < 0.35) return;

    // En la mina topografica una costura del indice puede dar un falso negativo. Si el mundo
    // distingue una caida real, no se teletransporta por una lectura geometrica aislada.
    const recoveryReason = this.world.recoveryReason?.(pos) ?? null;
    if (typeof this.world.recoveryReason === 'function' && !recoveryReason) {
      this._invalidTime = 0.35;
      return;
    }

    // Fuera del mapa de forma inequivoca: restaurar y limpiar toda inercia del jugador.
    this.player.teleport?.(this._safe);
    if (!this.player.teleport) this.controller.teleport(this._safe);
    this.world.bus?.emit?.('player:recovered', {
      reason: recoveryReason || 'fuera_galibo',
      from: { x: pos.x, y: pos.y, z: pos.z },
      to: this._safe.clone()
    });
    this._invalidTime = 0;
  }
}
