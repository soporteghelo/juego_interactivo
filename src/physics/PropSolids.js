import * as THREE from 'three';

/**
 * PropSolids — convierte los PROPS del mapa en obstáculos SÓLIDOS.
 *
 * Los tramos ya registran sus paredes/piso/techo como colisionadores (ver Colliders.js), pero
 * los ELEMENTOS del catálogo (refugio, tableros, ventiladores, mobiliario…) eran meros meshes
 * decorativos: el jugador y los NPC los atravesaban. Este módulo recorre el grafo de un tramo
 * ya posicionado y, por cada objeto marcado como sólido, crea colisionadores estáticos en la
 * física (para el jugador) y una caja AABB en mundo (para que los NPC tampoco los traspasen).
 *
 * Dos formas de declarar solidez en un elemento:
 *   1. `group.userData.solids = [{ hx, hy, hz, pos:[x,y,z], door? }]`  (cajas LOCALES precisas)
 *      - Con `door:true` la caja es la HOJA de una puerta: se guarda su collider en
 *        `group.userData._doorColliders` y su estado sigue a `group.userData._doorOpen`
 *        (abierta = collider deshabilitado = se puede pasar). Así el refugio solo se cruza
 *        por la puerta, y ésta bloquea de verdad al cerrarse.
 *   2. `group.userData.solid = true`  (mobiliario boxy: se usa su AABB de mundo, encogido)
 *
 * Se llama DESPUÉS de posicionar/rotar el tramo y de dispersar sus props (matrices de mundo
 * al día), justo tras buildSegmentColliders. Empuja los colliders creados a
 * `seg.physicsColliders` (para liberarlos con el tramo) y las cajas a `seg.propBlocks`.
 */

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _c = new THREE.Vector3();
const _box = new THREE.Box3();

/** AABB de mundo (envolvente) de una caja orientada por el cuaternión `q`. */
function _worldAABB(cx, cy, cz, q, hx, hy, hz) {
  // Matriz de rotación (columna-mayor) a partir del cuaternión.
  const x = q.x, y = q.y, z = q.z, w = q.w;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  // filas de R
  const r00 = 1 - (yy + zz), r01 = xy - wz,       r02 = xz + wy;
  const r10 = xy + wz,       r11 = 1 - (xx + zz), r12 = yz - wx;
  const r20 = xz - wy,       r21 = yz + wx,       r22 = 1 - (xx + yy);
  const ex = Math.abs(r00) * hx + Math.abs(r01) * hy + Math.abs(r02) * hz;
  const ey = Math.abs(r10) * hx + Math.abs(r11) * hy + Math.abs(r12) * hz;
  const ez = Math.abs(r20) * hx + Math.abs(r21) * hy + Math.abs(r22) * hz;
  return {
    minX: cx - ex, maxX: cx + ex,
    minY: cy - ey, maxY: cy + ey,
    minZ: cz - ez, maxZ: cz + ez
  };
}

/**
 * Recorre `seg.group` y registra en la física los obstáculos sólidos de sus props.
 * @param {import('./Physics.js').Physics} physics
 * @param {{group:THREE.Object3D, physicsColliders?:Array, propBlocks?:Array}} seg
 */
export function registerPropSolids(physics, seg) {
  if (!physics?.world || !seg?.group) return;
  const group = seg.group;
  group.updateWorldMatrix(true, true);
  if (!seg.physicsColliders) seg.physicsColliders = [];
  const blocks = seg.propBlocks || (seg.propBlocks = []);

  group.traverse((o) => {
    const ud = o.userData;
    if (!ud) return;
    const explicit = Array.isArray(ud.solids) && ud.solids.length ? ud.solids : null;
    const auto = !explicit && ud.solid === true;
    if (!explicit && !auto) return;

    if (explicit) {
      o.updateWorldMatrix(true, false);
      const wm = o.matrixWorld;
      wm.decompose(_pos, _quat, _scl);
      const rot = { x: _quat.x, y: _quat.y, z: _quat.z, w: _quat.w };
      const sx = Math.abs(_scl.x), sy = Math.abs(_scl.y), sz = Math.abs(_scl.z);
      const doorColliders = [];
      for (const b of explicit) {
        const hx = b.hx * sx, hy = b.hy * sy, hz = b.hz * sz;
        _c.set(b.pos[0], b.pos[1], b.pos[2]).applyMatrix4(wm);
        const collider = physics.addStaticCuboid({ hx, hy, hz, pos: [_c.x, _c.y, _c.z], rot });
        seg.physicsColliders.push(collider);
        if (b.door) {
          collider.setEnabled(!ud._doorOpen);   // puerta abierta ⇒ no bloquea
          doorColliders.push(collider);
        } else {
          blocks.push(_worldAABB(_c.x, _c.y, _c.z, _quat, hx, hy, hz));
        }
      }
      if (doorColliders.length) ud._doorColliders = doorColliders;
    } else {
      // AUTO: caja AABB de mundo de toda la malla, encogida para no crear "muros invisibles"
      // más grandes que lo visible. Sirve para mobiliario boxy pegado al hastial.
      _box.setFromObject(o, true);
      if (_box.isEmpty() || !isFinite(_box.min.x)) return;
      const shrink = 0.12;
      const hx = Math.max(0.05, (_box.max.x - _box.min.x) / 2 - shrink);
      const hy = Math.max(0.05, (_box.max.y - _box.min.y) / 2);
      const hz = Math.max(0.05, (_box.max.z - _box.min.z) / 2 - shrink);
      const cx = (_box.max.x + _box.min.x) / 2;
      const cy = (_box.max.y + _box.min.y) / 2;
      const cz = (_box.max.z + _box.min.z) / 2;
      const collider = physics.addStaticCuboid({ hx, hy, hz, pos: [cx, cy, cz] });
      seg.physicsColliders.push(collider);
      blocks.push({ minX: cx - hx, maxX: cx + hx, minY: cy - hy, maxY: cy + hy, minZ: cz - hz, maxZ: cz + hz });
    }
  });
}

/**
 * ¿La posición `pos` (con un radio) cae dentro de alguna caja de prop sólido?
 * Usada por los NPC para no traspasar el mobiliario/refugios. `blocks` son AABB de mundo.
 */
export function blockedByProp(blocks, pos, radius = 0.35) {
  if (!blocks || !blocks.length) return false;
  const x = pos.x, y = pos.y, z = pos.z;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (y < b.minY - 1.6 || y > b.maxY + 0.3) continue;   // fuera del rango vertical del prop
    if (x > b.minX - radius && x < b.maxX + radius &&
        z > b.minZ - radius && z < b.maxZ + radius) return true;
  }
  return false;
}
