import * as THREE from 'three';
import { MineMaterials } from '../materials/MineMaterials.js';

/**
 * RockDetail — geometria de ROCA EXCAVADA compartida por nodos (cruces) y salas (labores)
 * de la reticula. Objetivo: que NINGUNA esquina/interseccion/via se vea CUADRADA:
 *
 *  - FILETES DE ESQUINA: las esquinas dejan de ser pilares rectos; una cinta vertical curva
 *    (bezier con ruido) redondea el encuentro de dos vias, como la roca volada real.
 *  - JAMBAS DE BOCA: sella y ACAMPANA la transicion tunel→cruce (antes quedaba una rendija
 *    recta entre el ancho del tunel y la boca del bloque). La boca se abre en abanico, como
 *    una interseccion disparada de verdad.
 *  - BOVEDA (corona) colgante irregular y PAREDES de fondo con relieve.
 *
 * RENDIMIENTO: TODAS las geometrias se cachean por dimensiones y se comparten entre las
 * decenas de nodos/salas (la variedad la dan rotaciones por instancia). El ruido usa un PRNG
 * determinista fijo → misma roca en cada arranque (no depende de la semilla del mundo).
 * Los colisionadores de los segmentos NO cambian (siguen siendo cajas).
 */

export const POST_T = 1.4;   // huella de la esquina (m) — igual que el collider historico

const _cache = new Map();

/** PRNG determinista (mulberry32). */
function _prng(seed) {
  let s = seed >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Material de roca a DOS CARAS (las cintas curvas se ven por ambos lados). Cacheado. */
export function rocaDoble() {
  if (_cache.has('matRocaDS')) return _cache.get('matRocaDS');
  const m = MineMaterials.roca().clone();
  m.side = THREE.DoubleSide;
  _cache.set('matRocaDS', m);
  return m;
}

/**
 * Cinta vertical a lo largo de la CURVA DE ESQUINA (bezier cuadratica) para el corner (+x,+z)
 * en espacio local del bloque. Los demas corners se obtienen ROTANDO la malla 90°/180°/270°.
 * La curva pasa por A=(half-POST_T, half) → control=(half-POST_T-0.6, ...) → B=(half, half-POST_T),
 * de modo que el collider cuadrado historico queda DETRAS de la superficie visible.
 *
 * @param {number} half   semilado del bloque
 * @param {number} H      alto
 * @param {number} y0     altura inicial de la cinta
 * @param {number} y1     altura final
 * @param {number} noise  amplitud del ruido radial (0 = banda lisa de demarcacion)
 * @param {number} inset  desplazamiento hacia el centro (bandas pintadas SOBRE la roca)
 */
export function cornerRibbonGeo(half, H, y0, y1, noise = 0, inset = 0) {
  const key = `fillet:${half}:${Math.round(H * 10)}:${Math.round(y0 * 100)}:${Math.round(y1 * 100)}:${Math.round(noise * 100)}:${Math.round(inset * 100)}`;
  if (_cache.has(key)) return _cache.get(key);

  const A = new THREE.Vector2(half - POST_T, half);
  const C = new THREE.Vector2(half - POST_T - 0.6, half - POST_T - 0.6);
  const B = new THREE.Vector2(half, half - POST_T);

  const N = 8;                       // muestras a lo largo de la curva
  const M = noise > 0 ? 4 : 1;       // filas verticales (la roca ondula; las bandas no)
  const rnd = _prng(0xF11E7E);

  const positions = [], uvs = [], indices = [];
  const p = new THREE.Vector2();
  for (let j = 0; j <= M; j++) {
    const y = y0 + ((y1 - y0) * j) / M;
    // La roca ondula menos en el piso y muere en el techo (encaja con la boveda).
    const vTaper = Math.sin(Math.PI * Math.min(1, Math.max(0, (y / H))));
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      p.set(
        u * u * A.x + 2 * u * t * C.x + t * t * B.x,
        u * u * A.y + 2 * u * t * C.y + t * t * B.y
      );
      // Direccion hacia el centro del bloque (para ruido/inset).
      const len = p.length() || 1;
      const dx = -p.x / len, dz = -p.y / len;
      // Extremos de la curva sin ruido → empalman limpios con las jambas/hastiales.
      const tTaper = Math.sin(Math.PI * t);
      const n = noise > 0 ? (rnd() - 0.35) * noise * tTaper * (0.35 + 0.65 * vTaper) : 0;
      const off = n + inset;
      positions.push(p.x + dx * off, y, p.y + dz * off);
      uvs.push(t, j / M);
    }
  }
  const cols = N + 1;
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * cols + i, b = a + 1, d = a + cols, e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  _cache.set(key, geo);
  return geo;
}

/**
 * Añade a `group` los 4 FILETES DE ESQUINA rocosos + su demarcacion reflectiva curva
 * (linea roja a la altura de faros). Los colisionadores no se tocan.
 */
export function addCornerFillets(group, half, H) {
  const roca = rocaDoble();
  const matBandaR = MineMaterials.plano(0xc41414, { rough: 0.4, emissive: 0x7a0c0c, emissiveIntensity: 0.3 });
  if (matBandaR.side !== THREE.DoubleSide) { matBandaR.side = THREE.DoubleSide; matBandaR.needsUpdate = true; }

  const rockGeo  = cornerRibbonGeo(half, H, 0, H, 0.22, 0);
  const bandGeoR = cornerRibbonGeo(half, H, 1.62, 1.72, 0, 0.05);

  // Rotaciones que llevan el corner (+,+) a cada esquina (la curva es simetrica en x/z).
  const RY = { '1,1': 0, '1,-1': Math.PI / 2, '-1,-1': Math.PI, '-1,1': -Math.PI / 2 };
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const ry = RY[`${sx},${sz}`];
      const fillet = new THREE.Mesh(rockGeo, roca);
      fillet.rotation.y = ry;
      group.add(fillet);
      const r = new THREE.Mesh(bandGeoR, matBandaR);
      r.rotation.y = ry; group.add(r);
    }
  }
}

/** Corona abovedada: plano subdividido que cuelga hacia abajo con roca QUEBRADA (no una cúpula lisa). */
export function vaultGeo(size, H) {
  const key = `vault:${size}:${Math.round(H * 10)}`;
  if (_cache.has(key)) return _cache.get(key);
  const side = size + 0.6;
  // Mas subdivision → la corona resuelve bolsones/aristas de voladura en vez de un domo suave.
  const geo = new THREE.PlaneGeometry(side, side, 12, 12);
  geo.rotateX(Math.PI / 2);               // normal hacia -Y (se ve desde abajo)
  const rnd = _prng(0xC040A7);
  const ph1 = rnd() * 6.283, ph2 = rnd() * 6.283;
  const pos = geo.attributes.position;
  const half = side / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    // Taper a 0 en los bordes: la boveda debe morir limpia contra bocas y paredes.
    const edge = Math.max(Math.abs(x), Math.abs(z)) / half;
    const taper = Math.pow(Math.max(0, 1 - edge), 1.15);
    // Corona QUEBRADA: bolsones coherentes (dos frecuencias) + grano de voladura. Sin cara plana.
    const bumps = Math.abs(Math.sin(x * 0.85 + ph1) * Math.cos(z * 0.85 + ph2)) * 0.55
                + Math.abs(Math.sin(x * 1.7 - ph2) * Math.cos(z * 1.6 + ph1)) * 0.28;
    const grain = (rnd() - 0.5) * 0.30;
    pos.setY(i, -(0.28 + bumps + grain * 0.5) * taper);
  }
  geo.computeVertexNormals();
  _cache.set(key, geo);
  return geo;
}

/**
 * Piso IRREGULAR de un cruce (muck/barro pisado): plano subdividido con baches/surcos suaves,
 * para que el nodo NO tenga una losa plana visible. Relieve pequeño (no descuadra el collider
 * plano que queda debajo). Cacheado por tamaño.
 */
export function nodeFloorGeo(size) {
  const key = `nodefloor:${Math.round(size * 10)}`;
  if (_cache.has(key)) return _cache.get(key);
  const side = size + 1;
  const geo = new THREE.PlaneGeometry(side, side, 12, 12);
  geo.rotateX(-Math.PI / 2);              // normal hacia +Y (se pisa desde arriba)
  const rnd = _prng(0x5A17C0);
  const ph1 = rnd() * 6.283, ph2 = rnd() * 6.283;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = Math.sin(x * 0.7 + ph1) * Math.cos(z * 0.6 + ph2) * 0.06
            + Math.sin(x * 1.6 - ph2) * 0.03
            + (rnd() - 0.5) * 0.04;
    pos.setY(i, h);
  }
  geo.computeVertexNormals();
  _cache.set(key, geo);
  return geo;
}

/** Pared de cierre rocosa (fondo de saco) QUEBRADA (bolsones coherentes, sin cara plana). */
export function wallGeo(H, mouth) {
  const key = `muro:${Math.round(H * 10)}:${Math.round(mouth * 10)}`;
  if (_cache.has(key)) return _cache.get(key);
  // Mas subdivision en alto y ancho para resolver el relieve de roca volada.
  const geo = new THREE.BoxGeometry(0.5, H, mouth, 2, 6, 12);
  const rnd = _prng(0xFACA11);
  const ph = rnd() * 6.283, ph2 = rnd() * 6.283;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), z = pos.getZ(i);
    // Bolsones coherentes (dos frecuencias) + grano; empuja la roca en X sin dejar cara plana.
    const bump = Math.sin(y * 1.2 + ph) * Math.cos(z * 1.0 - ph2) * 0.30
               + Math.sin(y * 2.3 - ph2) * 0.12
               + (rnd() - 0.5) * 0.28;
    pos.setX(i, pos.getX(i) + bump);
  }
  geo.computeVertexNormals();
  _cache.set(key, geo);
  return geo;
}

/** Cable en catenaria (cuelga entre dos alcayatas) cruzando el bloque. */
export function cableGeo(len) {
  const key = `cable:${Math.round(len)}`;
  if (_cache.has(key)) return _cache.get(key);
  const pts = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector3(0, -Math.sin(Math.PI * t) * 0.35, (t - 0.5) * len));
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.028, 5, false);
  _cache.set(key, geo);
  return geo;
}

/** Jamba rocosa (tabique de boca) con relieve, cacheada por (ancho, alto). */
function _jambGeo(gap, H) {
  const key = `jamba:${Math.round(gap * 10)}:${Math.round(H * 10)}`;
  if (_cache.has(key)) return _cache.get(key);
  const geo = new THREE.BoxGeometry(gap, H, 0.38, 2, 4, 1);
  const rnd = _prng(0x1A3BA5);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, pos.getZ(i) + (rnd() - 0.5) * 0.24);
  }
  geo.computeVertexNormals();
  _cache.set(key, geo);
  return geo;
}

/**
 * JAMBAS DE BOCA: en cada lado ABIERTO, sella el tramo entre el hastial del tunel (ancho
 * `dir.width`) y la esquina del bloque, ligeramente en ABANICO (boca acampanada de voladura).
 * Antes esa rendija recta quedaba abierta al vacio y delataba la caja cuadrada.
 * Añade tambien el colisionador (caja alineada a ejes) de cada jamba.
 *
 * @param {THREE.Group} group  grupo del segmento
 * @param {Array} colliders    arreglo de colisionadores del segmento (se le agregan cajas)
 * @param {Array<{x:number,z:number,width?:number}>} openDirs
 * @param {number} half        semilado del bloque
 * @param {number} H           alto
 */
export function addMouthJambs(group, colliders, openDirs, half, H) {
  const roca = rocaDoble();
  for (const d of openDirs) {
    const w = d.width;
    if (!w) continue;                                  // sin dato de ancho: no tocar
    const gap = (half - POST_T) - w / 2;
    if (gap < 0.35) continue;                          // boca ya al ras: nada que sellar

    const geo = _jambGeo(gap, H);
    const axisX = Math.abs(d.x) > 0.5;                 // la via corre en X (boca en ±X)
    const edge = axisX ? d.x : d.z;                    // ±1: que borde del bloque
    for (const s of [-1, 1]) {                         // a cada lado de la boca
      const lat = s * (w / 2 + gap / 2);               // centro lateral de la jamba
      const dep = edge * (half - 0.22);                // pegada al borde, hacia adentro
      const jamb = new THREE.Mesh(geo, roca);
      if (axisX) {
        jamb.position.set(dep, H / 2, lat);
        jamb.rotation.y = Math.PI / 2 + s * edge * 0.18;   // abanico hacia la via
        colliders.push({ hx: 0.3, hy: H / 2, hz: gap / 2 + 0.1, pos: [dep, H / 2, lat] });
      } else {
        jamb.position.set(lat, H / 2, dep);
        jamb.rotation.y = -s * edge * 0.18;
        colliders.push({ hx: gap / 2 + 0.1, hy: H / 2, hz: 0.3, pos: [lat, H / 2, dep] });
      }
      group.add(jamb);
    }
  }
}
