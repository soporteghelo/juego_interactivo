import * as THREE from 'three';

/**
 * Helpers para construir colisionadores de un tramo a partir de sus specs locales.
 *
 * Cada BaseSegment expone `colliders` (cajas en espacio LOCAL). Al colocar el tramo en el
 * mundo (con un offset de posicion), trasladamos cada caja a coordenadas de mundo y la
 * registramos en la fisica. Devolvemos los colliders creados para poder liberarlos luego.
 *
 * Modo lineal (historico): los tramos NO rotan (quaternion identidad) y estan centrados en
 * x=0, por lo que basta sumar `worldPosition` a cada `c.pos` — ruta exacta de siempre.
 *
 * Modo retICula (GridWorld): las galerias corren en X y los cruceros en Z, de modo que sus
 * grupos van ROTADOS sobre el eje Y. En ese caso transformamos el centro de cada caja por la
 * matriz de mundo del grupo y pasamos su cuaternion a la fisica.
 */

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _IDENTITY = new THREE.Quaternion();

export function buildSegmentColliders(physics, segment, worldPosition) {
  const created = [];

  // ¿El tramo esta rotado? (grid) — decidimos por el cuaternion del grupo.
  const group = segment.group;
  group.updateMatrixWorld(true);
  group.matrixWorld.decompose(_v, _q, _s);
  const rotated = Math.abs(_q.w) < 0.99999; // distinto de identidad

  if (!rotated) {
    // ── Ruta lineal historica: solo traslacion ──
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

  // ── Ruta grid: transformar cada caja local por la matriz de mundo del grupo ──
  const rot = { x: _q.x, y: _q.y, z: _q.z, w: _q.w };
  for (const c of segment.colliders) {
    const world = _v.set(c.pos[0], c.pos[1], c.pos[2]).applyMatrix4(group.matrixWorld);
    const collider = physics.addStaticCuboid({
      hx: c.hx,
      hy: c.hy,
      hz: c.hz,
      pos: [world.x, world.y, world.z],
      rot
    });
    created.push(collider);
  }
  return created;
}
