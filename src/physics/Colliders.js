/**
 * Helpers para construir colisionadores de un tramo a partir de sus specs locales.
 *
 * Cada BaseSegment expone `colliders` (cajas en espacio LOCAL). Al colocar el tramo en el
 * mundo (con un offset de posicion), trasladamos cada caja a coordenadas de mundo y la
 * registramos en la fisica. Devolvemos los colliders creados para poder liberarlos luego.
 */
export function buildSegmentColliders(physics, segment, worldPosition) {
  const created = [];
  for (const c of segment.colliders) {
    const collider = physics.addStaticCuboid({
      hx: c.hx,
      hy: c.hy,
      hz: c.hz,
      pos: [
        c.pos[0] + worldPosition.x,
        c.pos[1] + worldPosition.y,
        c.pos[2] + worldPosition.z
      ]
    });
    created.push(collider);
  }
  return created;
}
