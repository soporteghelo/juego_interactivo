/**
 * BoundsGuard — RED DE SEGURIDAD DE CONTENCION.
 *
 * Garantiza que el jugador NUNCA se quede fuera del mapa, pase lo que pase con la fisica
 * (clip por una costura entre tramos, hueco de nicho, caida por una rampa, autostep que
 * lo empuje a la roca, etc.). Es una salvaguarda independiente del sistema de colisiones:
 * si el jugador escapa del gabarito de la labor, se le teletransporta a la ultima posicion
 * segura conocida.
 *
 * Aprovecha una invariante del ensamblador: TODOS los tramos estan centrados en x=0 y
 * encadenados a lo largo de -Z (las rampas solo cambian la cota Y). Por eso basta con:
 *   1) hallar el tramo que contiene la Z del jugador,
 *   2) comprobar que su X este dentro del ancho del tramo y su Y cerca del piso,
 *   3) si no, devolverlo al ultimo punto seguro.
 *
 * Corre en fixedUpdate DESPUES del paso de fisica (ver orden en Engine), para leer la
 * posicion ya resuelta por Rapier.
 */
export class BoundsGuard {
  /** @param {{player:object, world:object}} deps */
  constructor({ player, world }) {
    this.controller = player.controller;
    this.world = world;

    // Ultima posicion segura conocida (arranca en el spawn).
    this._safe = this.controller.position.clone();
    this._sinceSave = 0;

    // Cache del ultimo tramo que contuvo al jugador (evita recorrer toda la lista).
    this._lastSeg = null;
  }

  fixedUpdate(dt) {
    const pos = this.controller.position; // Vector3 (reutilizado por el controller)
    const seg = this._segmentAt(pos.z);

    if (seg) {
      const cx      = seg.group.position.x;
      const floorY  = seg.group.position.y;
      const lateral = Math.abs(pos.x - cx);
      const halfW   = seg.width / 2;

      // Dentro de un nicho/bahía el jugador puede estar mucho más allá del ancho del
      // túnel: usar un límite generoso (22 m cubre la bahía más profunda = 20 m).
      const enNicho       = this._enNichoZone(seg, pos);
      const limLateral    = enNicho ? halfW + 22 : halfW + 0.6;

      const dentro =
        lateral < limLateral &&
        pos.y > floorY - 2.5 &&                  // no cayo por debajo del piso
        pos.y < floorY + seg.height + 3;         // no atraveso el techo hacia arriba

      if (dentro) {
        // Guarda un punto seguro solo cuando esta BIEN centrado y apoyado en el piso,
        // para que al restaurar nunca lo dejemos pegado a una pared o en el aire.
        this._sinceSave += dt;
        if (this._sinceSave > 0.25 && this.controller.grounded && lateral < halfW - 0.5) {
          this._sinceSave = 0;
          this._safe.set(pos.x, pos.y, pos.z);
        }
        return;
      }
    }

    // Fuera del gabarito (o mas alla de los extremos del mapa): restaurar.
    this.controller.teleport(this._safe);
  }

  /**
   * Comprueba si la posición mundial del jugador está dentro de una zona de nicho/bahía
   * registrada por PropScatter (seg.nichoZones). Devuelve true si la lateral excede el
   * ancho normal del túnel Y cae dentro de un rango Z de nicho conocido.
   */
  _enNichoZone(seg, worldPos) {
    if (!seg.nichoZones) return false;
    const halfW   = seg.width / 2;
    const lateral = Math.abs(worldPos.x - seg.group.position.x);
    if (lateral <= halfW + 0.1) return false;        // aún dentro del pasillo normal
    const localZ  = worldPos.z - seg.group.position.z;
    const side    = worldPos.x > seg.group.position.x ? 1 : -1;
    return seg.nichoZones.some(
      z => z.side === side && localZ >= z.zMin && localZ <= z.zMax
    );
  }

  /** Devuelve el tramo cuyo rango en Z contiene a `z`, o null si ninguno. */
  _segmentAt(z) {
    // Intenta primero el ultimo tramo conocido (coherencia temporal).
    if (this._lastSeg && this._contains(this._lastSeg, z)) return this._lastSeg;

    for (const s of this.world.segments) {
      if (this._contains(s, z)) {
        this._lastSeg = s;
        return s;
      }
    }
    return null;
  }

  _contains(seg, z) {
    const z0 = seg.group.position.z;   // entrada del tramo
    const z1 = z0 - seg.length;        // salida (mas negativa)
    // Pequeno margen para no fallar justo en la costura entre dos tramos.
    return z <= z0 + 0.5 && z >= z1 - 0.5;
  }
}
