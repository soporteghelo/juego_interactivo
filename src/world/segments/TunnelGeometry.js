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

// ── Rampas de color por TIPO DE ROCA — la caja de cada labor no es igual a la de al lado ──
// Misma tecnica que nicho_electrico / el terrain example: THREE.Color en espacio lineal
// interpolado por fBm, de la sombra de la grieta a la roca expuesta. El `map` de `rocaTunel`
// MULTIPLICA por encima, asi que los tonos van aclarados para compensarlo.
//
// Cada tipo corresponde a una litologia distinta de las que atraviesan las labores; el
// generador sortea una por arista (`VARIETY.rockTypes` en MinePlan).
export const ROCK_RAMPS = {
  // Caliza gris de mina (calibrada con el escaneo por fotogrametria): la referencia historica.
  caliza: [
    { t: 0.00, c: new THREE.Color(0x26221a) },
    { t: 0.35, c: new THREE.Color(0x443e33) },
    { t: 0.60, c: new THREE.Color(0x6b6459) },
    { t: 0.80, c: new THREE.Color(0x968f83) },
    { t: 1.00, c: new THREE.Color(0xc0bab0) },
  ],
  // Caja oxidada: hierro lixiviado, pardo-rojizo (zonas de goteo y alteracion).
  ferruginosa: [
    { t: 0.00, c: new THREE.Color(0x241a12) },
    { t: 0.35, c: new THREE.Color(0x4d3320) },
    { t: 0.60, c: new THREE.Color(0x7a4c2b) },
    { t: 0.80, c: new THREE.Color(0xa2764c) },
    { t: 1.00, c: new THREE.Color(0xc9a479) },
  ],
  // Andesita/roca volcanica: gris azulado oscuro, poco reflectiva.
  andesita: [
    { t: 0.00, c: new THREE.Color(0x1a1c20) },
    { t: 0.35, c: new THREE.Color(0x33383f) },
    { t: 0.60, c: new THREE.Color(0x525a63) },
    { t: 0.80, c: new THREE.Color(0x767f89) },
    { t: 1.00, c: new THREE.Color(0x9aa3ad) },
  ],
  // Cuarcita clara con vetas: la labor mas luminosa del recorrido.
  cuarcita: [
    { t: 0.00, c: new THREE.Color(0x33302a) },
    { t: 0.35, c: new THREE.Color(0x6a6459) },
    { t: 0.60, c: new THREE.Color(0x9c968a) },
    { t: 0.80, c: new THREE.Color(0xc7c2b6) },
    { t: 1.00, c: new THREE.Color(0xe4e0d6) },
  ],
  // Esquisto verdoso (clorita/sericita): foliado, tipico de las cajas de veta.
  esquisto: [
    { t: 0.00, c: new THREE.Color(0x1b211a) },
    { t: 0.35, c: new THREE.Color(0x323d2e) },
    { t: 0.60, c: new THREE.Color(0x4f5d45) },
    { t: 0.80, c: new THREE.Color(0x78846a) },
    { t: 1.00, c: new THREE.Color(0xa2ab92) },
  ],
  // Roca MINERALIZADA (sulfuros Zn/Pb/Cu): manchones dorados sobre gris oscuro.
  mineralizada: [
    { t: 0.00, c: new THREE.Color(0x201d16) },
    { t: 0.35, c: new THREE.Color(0x453d24) },
    { t: 0.60, c: new THREE.Color(0x6f6231) },
    { t: 0.80, c: new THREE.Color(0x9d8a44) },
    { t: 1.00, c: new THREE.Color(0xc6b579) },
  ],
};

function rampColor(t, rockType = 'caliza') {
  const ramp = ROCK_RAMPS[rockType] || ROCK_RAMPS.caliza;
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  for (let i = 1; i < ramp.length; i++) {
    if (u <= ramp[i].t) {
      const lo = ramp[i - 1], hi = ramp[i];
      const f  = (u - lo.t) / (hi.t - lo.t);
      return lo.c.clone().lerp(hi.c, f);
    }
  }
  return ramp[ramp.length - 1].c.clone();
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
  segmentsZ  = 10,
  archRatio  = 0.4,
  jitter     = 0.35,
  breatheAmp = 0.12,   // amplitud de la "respiracion" de seccion (ensanche/altura a lo largo)
  rockType   = 'caliza', // litologia de la caja → rampa de color por vertice
  crownRough = 0.5,      // 0 = corona perfilada, 1 = corona muy sobre-excavada (desquinche)
  rng        = Math.random
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
    // En los anillos de BOCA vale 1 (perfil nominal exacto): asi la junta con el cruce casa con
    // el collar de boca, que se construye con la misma herradura nominal.
    const breathe = isEdge ? 1 : 1 + fbm(z * 0.11 + seedX, seedY * 0.7, 2) * breatheAmp;

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
      let over  = (broad - 0.32) * 1.6 + (fine - 0.5) * 0.7;   // sesgo positivo = hacia la roca
      // CORONA: es donde la voladura deja la roca mas rota (sobre-excavacion del techo, bolsones
      // y cuñas colgadas). Sobre el arco se suma una tercera octava mas contrastada, pesada por
      // la altura del punto → los hastiales quedan como estaban y el TECHO se ve accidentado.
      const crownW = Math.pow(Math.max(0, py / (height || 1)), 2.2);
      if (crownW > 0) {
        const cavity = fbm(px * 0.9 + z * 0.42 + seedY * 1.9, z * 0.31 + seedX * 1.3, 3);
        over += Math.max(0, cavity - 0.38) * (0.9 + crownRough * 2.4) * crownW;
      }
      const j = isEdge ? 0 : over * jitter;

      // nx>0 apunta al interior → (p - n*j) con j>0 empuja la superficie HACIA LA ROCA.
      positions.push(px - nx * j, py - ny * j, z);
      uvs.push(c / (cols - 1), r / (rows - 1));

      // ── Color: IDENTICO a nicho_electrico — THREE.Color lineal + fBm, sobre la rampa de la
      // litologia que le toco a esta labor (`rockType`).
      const sx = p.x * 0.85 + z * 0.28 + seedX * 0.5;
      const sy = p.y * 0.75 + z * 0.22 + seedY * 0.5;
      const n  = fbm(sx, sy, 4);
      const col = rampColor(n, rockType);
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

/**
 * Carcasa facetada para accesos a labores activas. Replica el carácter del wireframe de
 * prueba: sección asimétrica, hastiales quebrados, corona con sobreexcavación y anillos
 * longitudinales de separación variable. La primera y última sección conservan el gálibo
 * nominal para casar con las bocas de los nodos; toda irregularidad interior crece hacia la
 * roca, de modo que nunca invade el espacio transitable ni contradice los colliders.
 */
export function createWireframeLaborShell({
  width,
  height,
  length,
  segmentsZ = 7,
  jitter = 0.42,
  rockType = 'caliza',
  rng = Math.random
}) {
  // Perfil abierto por la solera: el piso transitable sigue siendo la malla de BaseSegment.
  // Coordenadas normalizadas [lateral en anchos, vertical en fracción de alto].
  const profile = [
    [ 0.50, 0.00], [ 0.52, 0.28], [ 0.49, 0.60], [ 0.40, 0.82],
    [ 0.22, 0.96], [ 0.00, 1.00], [-0.21, 0.965], [-0.39, 0.83],
    [-0.50, 0.61], [-0.53, 0.29], [-0.50, 0.00]
  ];
  const cols = profile.length;
  const rows = Math.max(4, segmentsZ) + 1;
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const seedX = rng() * 311.7;
  const seedY = rng() * 197.3;

  for (let row = 0; row < rows; row++) {
    const f = row / (rows - 1);
    const z = -length * f;
    const edgeRing = row === 0 || row === rows - 1;
    const sectionNoise = fbm(f * 4.2 + seedX, seedY, 3);
    const breathe = edgeRing ? 0 : 0.035 + sectionNoise * 0.13;
    const heightBreathe = edgeRing ? 0 : 0.025 + fbm(f * 3.7 + seedY, seedX, 3) * 0.10;
    const centerShift = edgeRing ? 0 : (fbm(f * 5.1 + seedX * 0.3, seedY * 0.4, 3) - 0.5) * 0.24;
    // Los anillos interiores no son perfectamente equidistantes, como una nube levantada
    // después de varios disparos. El orden siempre se conserva para evitar caras invertidas.
    const zJitter = edgeRing ? 0 : (fbm(f * 8.3 + seedY, seedX, 2) - 0.5) * Math.min(0.32, length / rows * 0.18);

    for (let col = 0; col < cols; col++) {
      const [lateral, vertical] = profile[col];
      const sign = Math.sign(lateral);
      const baseX = lateral * width;
      const crownWeight = Math.pow(vertical, 1.7);
      const broad = fbm(f * 6.1 + col * 0.37 + seedX, vertical * 2.4 + seedY, 4);
      const chips = fbm(f * 13.7 + col * 0.91 + seedY, lateral * 3.1 + seedX, 3);
      const outward = edgeRing || sign === 0 ? 0 : Math.max(0, broad - 0.24) * jitter + Math.max(0, chips - 0.58) * jitter * 0.32;
      const crownOverbreak = edgeRing ? 0 : Math.max(0, broad - 0.20) * jitter * 0.82 * crownWeight;

      let x;
      if (edgeRing) {
        // En las bocas, limita el perfil al ancho nominal para sellar contra las jambas.
        x = THREE.MathUtils.clamp(baseX, -width / 2, width / 2);
      } else {
        x = baseX * (1 + breathe) + centerShift + sign * outward;
        // Garantiza que los hastiales nunca entren dentro del gálibo de colisión.
        if (sign > 0) x = Math.max(x, Math.min(baseX, width / 2));
        if (sign < 0) x = Math.min(x, Math.max(baseX, -width / 2));
      }
      const y = edgeRing
        ? vertical * height
        : Math.max(0, vertical * height * (1 + heightBreathe) + crownOverbreak);

      positions.push(x, y, z + zJitter);
      uvs.push(col / (cols - 1), f * (length / 12));
      const colorNoise = fbm(x * 0.72 + z * 0.21 + seedX, y * 0.8 + z * 0.16 + seedY, 4);
      const color = rampColor(colorNoise, rockType);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const a = row * cols + col;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.wireframeLabor = true;
  return geometry;
}

/**
 * COLLAR DE BOCA — cierra el anillo de roca entre la seccion de un TUNEL y la boca (mas ancha y
 * mas alta) de la INTERSECCION a la que llega.
 *
 * El problema que resuelve: el tunel y el cruce son mallas independientes con secciones
 * distintas (p. ej. galeria de 6.0 x 4.9 m entrando a un cruce de 6.8 x 5.4 m). En la junta
 * quedaba una franja SIN GEOMETRIA por la que se veia el vacio exterior — los huecos negros en
 * las esquinas altas de las bocas. Este collar es la cara de roca de esa franja.
 *
 * Se construye como un anillo PLANO en el plano de la junta: contorno interior = la herradura
 * exacta del tunel (misma formula que `createTunnelShell`, asi que casa vertice a vertice) y
 * contorno exterior = el rectangulo que envuelve la boca del cruce. Cada punto exterior se
 * obtiene proyectando el interior desde el centro de la seccion, con `t >= 1` para que el
 * anillo nunca se invierta aunque el tunel sea MAS ancho que la boca.
 *
 * Espacio local: X lateral, Y desde el piso, la cara mira a ±Z (material a doble cara).
 *
 * @param {object} o
 * @param {number} o.width      ancho del tunel (m)
 * @param {number} o.height     alto del tunel (m)
 * @param {number} o.spanHalf   semi-ancho de la boca del cruce a cubrir (m)
 * @param {number} o.topY       alto de la boca del cruce a cubrir (m)
 * @param {number} [o.archRatio]fraccion del alto ocupada por el arco (igual que el tunel)
 * @param {string} [o.rockType] litologia (rampa de color por vertice)
 * @param {number} [o.relief]   relieve en Z del contorno exterior (m) — evita una placa plana
 * @returns {THREE.BufferGeometry} con position, uv y color (listo para vertexColors)
 */
export function createMouthCollarGeo({
  width, height, spanHalf, topY, archRatio = 0.4, rockType = 'caliza', relief = 0.12, inset = 0.03
}) {
  const { profile } = herraduraProfile(width, height, archRatio);
  const cy = height * 0.42;                 // centro de proyeccion, dentro de la herradura
  const n = profile.length;

  const positions = [], uvs = [], colors = [], indices = [];

  for (let i = 0; i < n; i++) {
    const p = profile[i];
    let ox, oy;
    if (Math.abs(p.y) < 1e-4) {
      // Los dos extremos apoyan en la solera: se abren en horizontal hasta el borde de la boca.
      ox = Math.sign(p.x) * Math.max(spanHalf, Math.abs(p.x));
      oy = 0;
    } else {
      const dx = p.x - 0, dy = p.y - cy;
      // Primer plano del rectangulo que corta el rayo (centro → punto del perfil).
      let t = Infinity;
      if (Math.abs(dx) > 1e-6) t = Math.min(t, (Math.sign(dx) * spanHalf) / dx);
      if (dy > 1e-6) t = Math.min(t, (topY - cy) / dy);
      else if (dy < -1e-6) t = Math.min(t, (0 - cy) / dy);
      if (!Number.isFinite(t)) t = 1;
      t = Math.max(1, t);                   // nunca hacia dentro del galibo del tunel
      ox = dx * t;
      oy = cy + dy * t;
    }

    // Relieve: el borde exterior no es una linea recta de sierra mecanica.
    const wobble = (fbm(p.x * 1.4 + 11.3, p.y * 1.4 + 7.1, 3) - 0.5) * relief;

    // LABIO DE SOLAPE: el contorno interior se mete un 3% hacia la via (escalado desde la
    // solera, que se queda en y=0). Asi el collar SIEMPRE monta un poco sobre la boca del tunel
    // en vez de dejar una rendija, aunque la labor tenga perfil facetado en vez de herradura.
    positions.push(p.x * (1 - inset), p.y * (1 - inset), 0);
    positions.push(ox, oy, wobble);         // contorno exterior: borde de la boca del cruce
    uvs.push(p.x / 2.4, p.y / 2.4, ox / 2.4, oy / 2.4);

    const cIn  = rampColor(fbm(p.x * 0.8 + 3.1, p.y * 0.7 + 5.7, 4), rockType);
    const cOut = rampColor(fbm(ox * 0.8 + 3.1, oy * 0.7 + 5.7, 4) * 0.85, rockType);
    colors.push(cIn.r, cIn.g, cIn.b, cOut.r, cOut.g, cOut.b);
  }

  for (let i = 0; i < n - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * ABRE UN HUECO en la carcasa (shell) de un tramo, en el HASTIAL indicado, para que un nicho de
 * refugio se VEA desde la via y el jugador, ya DENTRO, vea la via afuera (ventana real, no una
 * pared continua que lo tapa). Filtra los triangulos del shell cuyo centroide cae en la caja de
 * la apertura (espacio LOCAL del tramo), en ese hastial. Robusto: trabaja por centroide, sin
 * depender del mapeo perfil↔vertice. Barato (~1-2k triangulos por tramo, pocos nichos).
 *
 * @param {THREE.Mesh} shell            malla del shell (seg.shell)
 * @param {{side:number, halfW:number, zCenter:number, halfWidth:number, yBottom?:number, yTop?:number}} o
 */
export function punchShellOpening(shell, { side, halfW, zCenter, halfWidth, yBottom = 0.05, yTop = 2.2 }) {
  const geo = shell?.geometry;
  const idx = geo?.index;
  if (!geo || !idx) return;
  const pos = geo.attributes.position;
  const a = idx.array;
  const zMin = zCenter - halfWidth, zMax = zCenter + halfWidth;
  const xThresh = halfW * 0.72;   // solo el HASTIAL de ese lado (no arco/piso ni el hastial opuesto)
  const keep = [];
  for (let t = 0; t < a.length; t += 3) {
    const i0 = a[t], i1 = a[t + 1], i2 = a[t + 2];
    const mx = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3;
    const my = (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3;
    const mz = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3;
    const enHueco = (mx * side > 0) && Math.abs(mx) > xThresh &&
      mz >= zMin && mz <= zMax && my >= yBottom && my <= yTop;
    if (!enHueco) keep.push(i0, i1, i2);
  }
  if (keep.length !== a.length) {
    geo.setIndex(keep);
    geo.computeVertexNormals();
    shell.userData.shellHoles = (shell.userData.shellHoles || 0) + (a.length - keep.length) / 3;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RAMPA EN ESPIRAL (helicoidal) — mismo perfil de herradura + fBm, pero barrido a lo
// largo de una HELICE en vez de una recta. Las minas trackless bajan de nivel con
// rampa en espiral (decline curvo) para compactar la huella. La geometria se genera en
// espacio LOCAL con el EJE del helicoide en el origen (x=z=0), y descendiendo en -Y.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Perfil 2D de herradura (lateral p.x ∈ [-halfW,halfW], vertical p.y ∈ [0,height]) + normales.
 *
 * Las `normals2D` apuntan HACIA DENTRO del tunel (hacia el eje), de modo que desplazar un punto
 * del perfil por `+normal * d` lo separa de la roca y lo mete en la labor. Lo usa tambien el
 * MANTO DE MALLA (`elementos/sostenimiento/malla.js`) para colgar la malla del mismo arco que
 * excavo la carcasa: asi la malla envuelve la herradura REAL de cada labor y no un arco generico.
 */
export function herraduraProfile(width, height, archRatio = 0.4) {
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
  rows = 48, archRatio = 0.4, jitter = 0.3, rockType = 'caliza', rng = Math.random
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
    // Respiracion de seccion (solo hacia fuera, >=1) — misma idea que el tunel recto; los
    // anillos de boca quedan al perfil nominal para casar con el collar del cruce.
    const breathe = isEdge ? 1 : 1 + fbm(along * 0.11 + seedX, seedY * 0.7, 2) * 0.12;

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
      // V con la MISMA densidad de texel que las VIAS (tunel: V normalizado sobre ~14 m con
      // repeat(3,4) → ~1 mosaico cada ~3.5 m). Antes `along/1.5` daba un patron mucho mas
      // apretado que la via → la rampa se veia con "otra textura". `along/14` iguala la escala.
      uvs.push(c / (cols - 1), along / 14);

      const sx = p.x * 0.85 + cy * 0.28 + seedX * 0.5;
      const sy = p.y * 0.75 + seedY * 0.5;
      const col = rampColor(fbm(sx, sy, 4), rockType);
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
