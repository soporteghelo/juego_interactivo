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
// Caliza gris de mina (según el escaneo real): grietas oscuras → roca clara. Aclarada
// respecto al rango anterior para compensar el oscurecimiento del `map` (que MULTIPLICA).
const _RAMP = [
  { t: 0.00, c: new THREE.Color(0x26221a) },
  { t: 0.35, c: new THREE.Color(0x443e33) },
  { t: 0.60, c: new THREE.Color(0x6b6459) },
  { t: 0.80, c: new THREE.Color(0x968f83) },
  { t: 1.00, c: new THREE.Color(0xc0bab0) },
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
    const isEdge = (r === 0 || r === rows - 1);

    // RESPIRACION de seccion: la labor se ENSANCHA/eleva suavemente a lo largo (excavacion
    // real, nunca un tubo constante). Solo hacia FUERA (>=1) → jamas estrecha el galibo.
    const breathe = 1 + fbm(z * 0.11 + seedX, seedY * 0.7, 2) * 0.12;

    for (let c = 0; c < cols; c++) {
      const p  = profile[c];
      const nx = normals2D[c].x;
      const ny = normals2D[c].y;
      // Perfil que respira (ensanche/altura hacia fuera).
      const px = p.x * breathe;
      const py = p.y * breathe;

      // OVERBREAK IRREGULAR (roca volada): el desplazamiento va sesgado HACIA LA ROCA (fuera
      // del galibo) para que la labor se vea SOBRE-EXCAVADA y quebrada, no un caño liso — y sin
      // estrechar nunca la seccion transitable. Dos octavas: ondulacion amplia (bolsones de
      // 0.5-2 m) + grano fino (aristas de voladura). Los bordes (r=0/rows-1) quedan al perfil
      // nominal → la boca casa exacta con la jamba del nodo.
      const broad = fbm(px * 0.55 + z * 0.21 + seedX, py * 0.48 + z * 0.17 + seedY, 4);
      const fine  = fbm(px * 1.9  + z * 1.35 + seedX * 1.7, py * 1.7 + z * 1.05 + seedY * 1.3, 3);
      const over  = (broad - 0.32) * 1.6 + (fine - 0.5) * 0.7;   // sesgo positivo = hacia la roca
      const j = isEdge ? 0 : over * jitter;

      // nx>0 apunta al interior → (p - n*j) con j>0 empuja la superficie HACIA LA ROCA.
      positions.push(px - nx * j, py - ny * j, z);
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

// ─────────────────────────────────────────────────────────────────────────────
// RAMPA EN ESPIRAL (helicoidal) — mismo perfil de herradura + fBm, pero barrido a lo
// largo de una HELICE en vez de una recta. Las minas trackless bajan de nivel con
// rampa en espiral (decline curvo) para compactar la huella. La geometria se genera en
// espacio LOCAL con el EJE del helicoide en el origen (x=z=0), y descendiendo en -Y.
// ─────────────────────────────────────────────────────────────────────────────

/** Perfil 2D de herradura (lateral p.x ∈ [-halfW,halfW], vertical p.y ∈ [0,height]) + normales. */
function herraduraProfile(width, height, archRatio = 0.4) {
  const halfW = width / 2;
  const wallTop = height * (1 - archRatio);
  const archH = height - wallTop;
  const profile = [], normals2D = [];
  const wallSteps = 4, archSteps = 14;
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
  return { profile, normals2D };
}

/**
 * Carcasa (hastiales + arco) de una rampa helicoidal. El perfil de herradura se barre a lo
 * largo de la helice de radio `radius`, girando `totalAngle` rad y bajando `drop` m. Para
 * cada anillo se orienta el perfil con la lateral = RADIAL (hacia afuera) y la vertical = +Y
 * (pendiente suave → basta la vertical del mundo). Colores por vertice fBM identicos al tunel
 * recto. DoubleSide en el material evita preocuparse por el winding.
 *
 * @returns {THREE.BufferGeometry} atributos position, uv, color (vertexColors)
 */
export function createHelicalTunnelShell({
  width, height, radius, startAngle, totalAngle, drop,
  rows = 48, archRatio = 0.4, jitter = 0.3, rng = Math.random
}) {
  const { profile, normals2D } = herraduraProfile(width, height, archRatio);
  const cols = profile.length;
  const R = rows + 1;
  const arcLen = Math.abs(totalAngle) * radius;

  const positions = [], uvs = [], colors = [], indices = [];
  const seedX = rng() * 231.7;
  const seedY = rng() * 171.3;

  for (let r = 0; r < R; r++) {
    const f = r / rows;
    const theta = startAngle + totalAngle * f;
    const cy = -drop * f;
    const ct = Math.cos(theta), st = Math.sin(theta);
    const along = f * arcLen;
    const isEdge = (r === 0 || r === R - 1);
    // Respiracion de seccion (solo hacia fuera, >=1) — misma idea que el tunel recto.
    const breathe = 1 + fbm(along * 0.11 + seedX, seedY * 0.7, 2) * 0.12;

    for (let c = 0; c < cols; c++) {
      const p = profile[c];
      const px = p.x * breathe, py = p.y * breathe;
      // OVERBREAK IRREGULAR sesgado a la roca (2 octavas), igual que el tunel recto: la rampa
      // tampoco es un caño liso. Anillos extremos al perfil nominal → casan con las jambas.
      const broad = fbm(px * 0.55 + cy * 0.21 + along * 0.05 + seedX, py * 0.48 + seedY, 4);
      const fine  = fbm(px * 1.9 + along * 0.9 + seedX * 1.7, py * 1.7 + cy * 0.5 + seedY * 1.3, 3);
      const over  = (broad - 0.32) * 1.6 + (fine - 0.5) * 0.7;
      const j = isEdge ? 0 : over * jitter;
      const lat = px - normals2D[c].x * j;   // desplazamiento sobre la lateral (radial)
      const ver = py - normals2D[c].y * j;   // desplazamiento sobre la vertical

      // Punto del eje del helicoide + offset (radial, vertical).
      positions.push(radius * ct + ct * lat, cy + ver, radius * st + st * lat);
      uvs.push(c / (cols - 1), along / 1.5);

      const sx = p.x * 0.85 + cy * 0.28 + seedX * 0.5;
      const sy = p.y * 0.75 + seedY * 0.5;
      const col = rampColor(fbm(sx, sy, 4));
      colors.push(col.r, col.g, col.b);
    }
  }

  for (let r = 0; r < R - 1; r++) {
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
  geo.computeVertexNormals();
  return geo;
}

/**
 * Piso curvo (barro) + BERMA de contencion en el hastial EXTERIOR de la rampa helicoidal.
 * Mismo eje local que `createHelicalTunnelShell`. La berma es una media caña de material
 * compactado barrida sobre el borde exterior (D.S. 024-2016-EM: bermas en rampas de transito
 * pesado). Devuelve dos geometrias separadas (materiales distintos).
 *
 * @returns {{ floorGeo: THREE.BufferGeometry, bermaGeo: THREE.BufferGeometry }}
 */
export function createHelicalFloorBerma({
  width, radius, startAngle, totalAngle, drop, rows = 48
}) {
  const halfW = width / 2;
  const R = rows + 1;
  const arcLen = Math.abs(totalAngle) * radius;

  // ── Piso: cinta subdividida a lo ancho (inner → outer), a la cota del eje (desciende) ──
  const across = 5;
  const fPos = [], fUv = [], fIdx = [];
  const fCols = across + 1;
  for (let r = 0; r < R; r++) {
    const f = r / rows;
    const theta = startAngle + totalAngle * f;
    const cy = -drop * f;
    const ct = Math.cos(theta), st = Math.sin(theta);
    for (let c = 0; c < fCols; c++) {
      const lat = -halfW + (width * c) / across;
      fPos.push(radius * ct + ct * lat, cy + 0.01, radius * st + st * lat);
      fUv.push(c / across, (f * arcLen) / 1.5);
    }
  }
  for (let r = 0; r < R - 1; r++) {
    for (let c = 0; c < fCols - 1; c++) {
      const a = r * fCols + c, b = a + 1, d = a + fCols, e = d + 1;
      fIdx.push(a, b, d, b, e, d);   // normal hacia +Y (se ve desde arriba)
    }
  }
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
  floorGeo.setAttribute('uv',       new THREE.Float32BufferAttribute(fUv, 2));
  floorGeo.setIndex(fIdx);
  floorGeo.computeVertexNormals();

  // ── Berma exterior: media caña (medio circulo, radio 0.45) barrida sobre el borde exterior ──
  const bR = 0.45;
  const bCenter = halfW - 0.32;    // eje de la berma, ligeramente hacia dentro del hastial
  const bSteps = 6;                // subdivisiones del medio arco
  const bPos = [], bIdx = [];
  const bCols = bSteps + 1;
  for (let r = 0; r < R; r++) {
    const f = r / rows;
    const theta = startAngle + totalAngle * f;
    const cy = -drop * f;
    const ct = Math.cos(theta), st = Math.sin(theta);
    for (let c = 0; c < bCols; c++) {
      const ang = (Math.PI * c) / bSteps;        // 0..π (media caña)
      const lat = bCenter + bR * Math.cos(ang);
      const up  = bR * Math.sin(ang);
      bPos.push(radius * ct + ct * lat, cy + up, radius * st + st * lat);
    }
  }
  for (let r = 0; r < R - 1; r++) {
    for (let c = 0; c < bCols - 1; c++) {
      const a = r * bCols + c, b = a + 1, d = a + bCols, e = d + 1;
      bIdx.push(a, d, b, b, d, e);
    }
  }
  const bermaGeo = new THREE.BufferGeometry();
  bermaGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
  bermaGeo.setIndex(bIdx);
  bermaGeo.computeVertexNormals();

  return { floorGeo, bermaGeo };
}
