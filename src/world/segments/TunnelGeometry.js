import * as THREE from 'three';

// ── Ruido deterministico — misma tecnica que webgl_geometry_terrain_raycast ──
// hash2 → smoothNoise (interpolacion de Hermite) → fbm (octavas fractales).
// Sin Math.random(): reproducible, sin semilla, sin parpadeos entre cargas.

function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix,        fy = y - iy;
  // Curva de Hermite: elimina discontinuidades en la cuadricula
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix,     iy),     b = hash2(ix + 1, iy);
  const c = hash2(ix,     iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (d - b - c + a) * ux * uy;
}

/**
 * Fractal Brownian Motion: superpone octavas de smoothNoise para obtener
 * variacion multi-escala natural. Mismo patron que el terrain example de three.js.
 * @param {number} octaves  4-5 es suficiente; mas = mas detalle fino
 */
function fbm(x, y, octaves = 4) {
  let val = 0, amp = 0.5, freq = 1, total = 0;
  for (let i = 0; i < octaves; i++) {
    val   += smoothNoise(x * freq, y * freq) * amp;
    total += amp;
    amp   *= 0.5;
    freq  *= 2.0;
  }
  return val / total; // normalizado 0..1
}

// ── Rampa de color identica a la de nicho_electrico — roca subterranea excavada ──
// Mismo rango visual que el terrain example: de sombra casi negra (#18160f) a
// roca clara expuesta (#7a7672). Contraste natural, sin el rango estrecho anterior.
// Mismos objetos THREE.Color que nicho_electrico → mismo espacio lineal correcto.
const _RAMP = [
  { t: 0.00, c: new THREE.Color(0x18160f) },
  { t: 0.35, c: new THREE.Color(0x2e2a22) },
  { t: 0.60, c: new THREE.Color(0x47413a) },
  { t: 0.80, c: new THREE.Color(0x5e5a54) },
  { t: 1.00, c: new THREE.Color(0x7a7672) },
];

function rampColor(t) {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  for (let i = 1; i < _RAMP.length; i++) {
    if (u <= _RAMP[i].t) {
      const lo = _RAMP[i - 1], hi = _RAMP[i];
      const f  = (u - lo.t) / (hi.t - lo.t);
      return lo.c.clone().lerp(hi.c, f);
    }
  }
  return _RAMP[_RAMP.length - 1].c.clone();
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera la carcasa geometrica de un tramo de galeria (perfil herradura barrido en -Z).
 *
 * v3 — "terrain approach":
 *  • Colores por vertice calculados con fBM (identico al terrain_raycast example).
 *  • Variacion deliberadamente CONTENIDA (rango 0.09-0.24) para no exagerar.
 *  • Normales recomputadas DESPUES del jitter (computeVertexNormals) → iluminacion
 *    correcta sobre la superficie desplazada, igual que hace el terrain example.
 *  • Sin flatShading: shading suave = aspecto terroso natural, no low-poly.
 *
 * @param {object}     o
 * @param {number}     o.width      ancho de la galeria (m)
 * @param {number}     o.height     alto total hasta la clave del arco (m)
 * @param {number}     o.length     largo del tramo (m)
 * @param {number}    [o.segmentsZ] subdivisiones longitudinales
 * @param {number}    [o.archRatio] fraccion del alto para el arco (0..1)
 * @param {number}    [o.jitter]    desplazamiento max de vertices en m
 * @param {()=>number}[o.rng]       PRNG 0..1 (semilla reproducible)
 * @returns {THREE.BufferGeometry}  con atributos position, uv, color (listo para vertexColors)
 */
export function createTunnelShell({
  width,
  height,
  length,
  segmentsZ = 10,
  archRatio = 0.4,
  jitter    = 0.35,
  rng       = Math.random
}) {
  const halfW   = width / 2;
  const wallTop = height * (1 - archRatio);
  const archH   = height - wallTop;

  // ── Perfil 2D de la seccion transversal ─────────────────────────────────
  const profile   = [];
  const normals2D = [];

  const wallSteps = 4;   // subdivisiones en pared recta (5 puntos)
  const archSteps = 14;  // subdivisiones en el arco (13 puntos internos)

  for (let i = 0; i <= wallSteps; i++) {
    profile.push(new THREE.Vector2(halfW, (wallTop * i) / wallSteps));
    normals2D.push(new THREE.Vector2(-1, 0));
  }
  for (let i = 1; i < archSteps; i++) {
    const t = (Math.PI * i) / archSteps;
    profile.push(new THREE.Vector2(halfW * Math.cos(t), wallTop + archH * Math.sin(t)));
    normals2D.push(new THREE.Vector2(-Math.cos(t), -Math.sin(t)));
  }
  for (let i = wallSteps; i >= 0; i--) {
    profile.push(new THREE.Vector2(-halfW, (wallTop * i) / wallSteps));
    normals2D.push(new THREE.Vector2(1, 0));
  }

  const cols = profile.length;
  const rows = segmentsZ + 1;

  const positions = [];
  const uvs       = [];
  const colors    = [];
  const indices   = [];

  // ── Vertices + colores fBM ───────────────────────────────────────────────
  // Semilla UNICA POR TRAMO: garantiza que segmentos distintos muestren
  // patrones de roca distintos (sin repeticion visual entre galerias).
  const seedX = rng() * 231.7;
  const seedY = rng() * 171.3;

  for (let r = 0; r < rows; r++) {
    const z = -(length * r) / segmentsZ;

    for (let c = 0; c < cols; c++) {
      const p  = profile[c];
      const nx = normals2D[c].x;
      const ny = normals2D[c].y;

      // Jitter fBm COHERENTE: mismo tipo de desplazamiento que nicho_electrico.
      // Crea ondulaciones de 0.5-2m de diametro sobre la pared, no ruido granulado.
      // Los bordes extremos (r=0, r=rows-1) no se desplazan → segmentos encajan.
      const isEdge = (r === 0 || r === rows - 1);
      const jFbm = fbm(p.x * 0.55 + z * 0.21 + seedX, p.y * 0.48 + z * 0.17 + seedY, 4);
      const j = isEdge ? 0 : (jFbm - 0.5) * 2 * jitter;

      positions.push(p.x - nx * j, p.y - ny * j, z);
      uvs.push(c / (cols - 1), r / (rows - 1));

      // ── Color: IDENTICO a nicho_electrico — THREE.Color lineal + fBm ──
      const sx = p.x * 0.85 + z * 0.28 + seedX * 0.5;
      const sy = p.y * 0.75 + z * 0.22 + seedY * 0.5;
      const n  = fbm(sx, sy, 4);
      const col = rampColor(n);
      colors.push(col.r, col.g, col.b);
    }
  }

  // ── Indices (quads → 2 tri, winding para normales interiores) ────────────
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs,       2));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors,    3));
  geo.setIndex(indices);

  // Recomputa normales SOBRE LA GEOMETRIA DESPLAZADA (jitter), no sobre el perfil
  // original. Esto es lo que hace que la iluminacion sea correcta sobre la roca rugosa,
  // igual que en el terrain example que recalcula normales tras el heightmap.
  geo.computeVertexNormals();

  return geo;
}
