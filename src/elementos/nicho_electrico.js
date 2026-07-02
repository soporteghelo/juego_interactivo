import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';
import { crear as crearTablero } from './tablero_electrico.js';

/**
 * NICHO ELÉCTRICO — apertura excavada en el hastial del túnel.
 *
 * Las paredes interiores se generan con la misma técnica del ejemplo
 * webgl_geometry_terrain_raycast de Three.js:
 *   1. PlaneGeometry subdividida en muchos segmentos.
 *   2. Desplazamiento de vértices en Z usando fBm (fractal Brownian motion)
 *      con 5 octavas de value noise → superficie naturalmente irregular.
 *   3. Vertex colors basados en el valor de noise → rampa dark→mid→light
 *      que simula los tonos de roca excavada.
 *   4. Material rocaTunel() con vertexColors:true (igual que el terrain example).
 *
 * Convención de ejes LOCAL del grupo (antes de rotar para colocar en escena):
 *   +Z = hacia el túnel (apertura del nicho, cara visible)
 *   -Z = hacia el interior de la roca (fondo del nicho)
 *   Y  = altura  |  X = lateral
 */

export const meta = {
  id: 'nicho_electrico',
  nombre: 'Nicho eléctrico',
  descripcion: 'Apertura excavada en el hastial. Roca fBm-terrain, 1.5 m profundidad, tablero a 1 m del suelo.'
};

export const metaVacio = {
  id: 'nicho_vacio',
  nombre: 'Nicho vacío (refugio peatonal)',
  descripcion: 'Apertura en el hastial sin equipos — espacio de refugio para trabajadores cuando pasa un vehículo.'
};

// ════════════════════════════════════════════════════════════════════════
//  NOISE — value noise 2D + fBm multicapa (misma base que terrain example)
// ════════════════════════════════════════════════════════════════════════

function _hash(ix, iy) {
  // Wang hash de enteros
  let h = ((ix * 1664525) ^ (iy * 22695477) ^ 2531011) >>> 0;
  h ^= (h >>> 16); h = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= (h >>> 16);
  return (h >>> 0) / 0xffffffff;
}

function _smooth(t) { return t * t * (3 - 2 * t); } // smoothstep cúbico

function _valueNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = _smooth(x - ix), fy = _smooth(y - iy);
  return (
    _hash(ix,   iy  ) * (1 - fx) * (1 - fy) +
    _hash(ix+1, iy  ) *      fx  * (1 - fy) +
    _hash(ix,   iy+1) * (1 - fx) *      fy  +
    _hash(ix+1, iy+1) *      fx  *      fy
  );
}

/**
 * fBm con 5 octavas — identical approach to Three.js terrain example.
 * Returns value in [0, 1].
 */
function fbm(x, y, octaves = 5) {
  let v = 0, amp = 1.0, freq = 1.0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    v    += _valueNoise(x * freq, y * freq) * amp;
    norm += amp;
    amp  *= 0.50;
    freq *= 2.07; // ligeramente asimétrico — evita patrones de rejilla
  }
  return v / norm;
}

// ════════════════════════════════════════════════════════════════════════
//  GEOMETRÍA DE ROCA — PlaneGeometry + fBm + vertex colors
// ════════════════════════════════════════════════════════════════════════

// Rampa de color idéntica a la del terrain example pero para roca minera:
//   t=0.0 → sombra/profundidad (casi negro)   #18160f
//   t=0.4 → roca media                         #35302a
//   t=0.7 → roca clara, recién cortada          #524e48
//   t=1.0 → zona de mineral/cuarzo             #7a7570
const _RAMP = [
  { t: 0.00, c: new THREE.Color(0x18160f) },
  { t: 0.35, c: new THREE.Color(0x2e2a22) },
  { t: 0.60, c: new THREE.Color(0x47413a) },
  { t: 0.80, c: new THREE.Color(0x5e5a54) },
  { t: 1.00, c: new THREE.Color(0x7a7672) },
];

function _rampColor(t) {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  for (let i = 1; i < _RAMP.length; i++) {
    if (c <= _RAMP[i].t) {
      const lo = _RAMP[i - 1], hi = _RAMP[i];
      const f = (c - lo.t) / (hi.t - lo.t);
      return lo.c.clone().lerp(hi.c, f);
    }
  }
  return _RAMP[_RAMP.length - 1].c.clone();
}

/**
 * Crea una PlaneGeometry con desplazamiento fBm y vertex colors tipo terrain.
 *
 * @param {number} w        Ancho del plano
 * @param {number} h        Alto del plano
 * @param {number} segsX    Segmentos horizontales
 * @param {number} segsY    Segmentos verticales
 * @param {number} amp      Amplitud desplazamiento en Z (metros)
 * @param {number} scale    Frecuencia del noise
 * @param {number} ox       Offset X del noise
 * @param {number} oy       Offset Y del noise
 * @param {number} edgeAmp  Amplitud extra de perturbación X/Y en vértices de borde.
 *                          Cuando > 0, la silueta exterior deja de ser un rectángulo perfecto.
 */
function planoRocaTerrain(w, h, segsX = 24, segsY = 20, amp = 0.18, scale = 2.8,
                          ox = 0, oy = 0, edgeAmp = 0) {
  const geo  = new THREE.PlaneGeometry(w, h, segsX, segsY);
  const pos  = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);

    const nx = (px / w + 0.5) * scale + ox;
    const ny = (py / h + 0.5) * scale + oy;
    const n  = fbm(nx, ny, 5);

    const edgeU = Math.abs(px) / (w * 0.5);
    const edgeV = Math.abs(py) / (h * 0.5);
    const fade  = Math.max(0, 1 - Math.pow(Math.max(edgeU, edgeV), 4) * 8);

    // Desplazamiento Z (profundidad, igual que antes)
    pos.setZ(i, (n - 0.5) * amp * 2 * fade);

    // ── PERTURBACIÓN DE SILUETA (solo en vértices del borde) ─────────
    // Desplaza X/Y para que la silueta exterior no sea un rectángulo.
    // Factor de borde: 0 en el interior, 1 en el borde absoluto.
    if (edgeAmp > 0) {
      const efU = Math.max(0, (edgeU - 0.72) / 0.28); // activado a partir del 72% del borde
      const efV = Math.max(0, (edgeV - 0.72) / 0.28);
      if (efU > 0) {
        // Perturbación X: noise independiente (offset +100 para decorrelacionar)
        const nX = fbm(nx + 100, ny + 50, 4);
        pos.setX(i, px + (nX - 0.5) * edgeAmp * 2 * efU);
      }
      if (efV > 0) {
        // Perturbación Y: noise independiente
        const nY = fbm(nx + 200, ny + 150, 4);
        pos.setY(i, py + (nY - 0.5) * edgeAmp * 2 * efV);
      }
    }

    const col = _rampColor(n);
    cols[i * 3]     = col.r;
    cols[i * 3 + 1] = col.g;
    cols[i * 3 + 2] = col.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

// ════════════════════════════════════════════════════════════════════════
//  NICHO ELÉCTRICO
// ════════════════════════════════════════════════════════════════════════

/**
 * @param {{ doble?:boolean, conTableros?:boolean, seed?:number }} opts
 *   conTableros: true  → nicho eléctrico con tableros (default)
 *   conTableros: false → nicho vacío (refugio peatonal, sin equipos)
 * @returns {THREE.Group}
 */
export function crear({ doble = false, conTableros = true, seed = 1 } = {}) {
  const g = new THREE.Group();
  g.name = conTableros ? 'nicho_electrico' : 'nicho_vacio';

  // ── Dimensiones ─────────────────────────────────────────────────
  const W = doble ? 2.10 : 1.55;
  const H = 2.30;
  const D = 1.55;

  const mRoca  = MineMaterials.rocaTunel();
  const mSuelo = MineMaterials.plano(0x1e1c18, { rough: 1.0 });
  const mCable = MineMaterials.cable();

  const ox = seed * 0.37, oy = seed * 0.61;

  // ── PARED DEL FONDO ──────────────────────────────────────────────
  // Amplitud alta: la perforadora deja la roca muy irregular
  const gFondo = planoRocaTerrain(W, H, 28, 24, 0.32, 3.8, ox,      oy     );
  const fondo  = new THREE.Mesh(gFondo, mRoca);
  fondo.position.set(0, H / 2, -D);
  g.add(fondo);

  // ── PAREDES LATERALES ────────────────────────────────────────────
  const gLatIzq = planoRocaTerrain(D, H, 24, 24, 0.40, 4.0, ox+5.1, oy+2.3);
  const latIzq  = new THREE.Mesh(gLatIzq, mRoca);
  latIzq.position.set(-W / 2, H / 2, -D / 2);
  latIzq.rotation.y = -Math.PI / 2;
  g.add(latIzq);

  const gLatDer = planoRocaTerrain(D, H, 24, 24, 0.40, 4.0, ox+9.7, oy+6.1);
  const latDer  = new THREE.Mesh(gLatDer, mRoca);
  latDer.position.set(W / 2, H / 2, -D / 2);
  latDer.rotation.y = Math.PI / 2;
  g.add(latDer);

  // ── TECHO ────────────────────────────────────────────────────────
  // Mayor amplitud que las paredes: el techo siempre queda más irregular
  // (las rocas cuelgan por gravedad, las explosiones lo dejan muy rugoso)
  const gTecho = planoRocaTerrain(W, D, 26, 22, 0.50, 4.2, ox+13.3, oy+4.7);
  const techo  = new THREE.Mesh(gTecho, mRoca);
  techo.position.set(0, H, -D / 2);
  techo.rotation.x = Math.PI / 2;
  g.add(techo);

  // ── SUELO ────────────────────────────────────────────────────────
  const gSuelo = planoRocaTerrain(W, D, 14, 12, 0.04, 2.2, ox+18.5, oy+11.2);
  const sueloM = new THREE.Mesh(gSuelo, mSuelo);
  sueloM.position.set(0, 0.01, -D / 2);
  sueloM.rotation.x = -Math.PI / 2;
  g.add(sueloM);

  // ── BORDE DE APERTURA (rock collar con silueta IRREGULAR) ────────
  // edgeAmp > 0 perturba los vértices del borde en X/Y → la silueta ya no es un rectángulo.
  // Espesor grueso y amplia zona de perturbación → borde parece roca bruta perforada.
  const espesor = 0.50;
  const marcoW  = W + 0.50, marcoH = H + 0.38;
  const mAmp    = 0.28;   // desplazamiento de superficie (profundidad)
  const mEdge   = 0.32;   // perturbación de silueta — CLAVE para romper el rectángulo
  const mScl    = 4.0;
  //                                          w         h         sX  sY  ampZ   scl   ox       oy       edgeAmp
  const marcos = [
    { geo: planoRocaTerrain(marcoW, espesor,        24, 12, mAmp, mScl, ox+21, oy,     mEdge), pos: [0,  H + espesor / 2 + 0.01,         0] },
    { geo: planoRocaTerrain(marcoW, espesor * 0.75, 24,  8, mAmp, mScl, ox+24, oy+3,  mEdge), pos: [0, -espesor * 0.38,                  0] },
    { geo: planoRocaTerrain(espesor, marcoH,        12, 28, mAmp, mScl, ox+27, oy+7,  mEdge), pos: [-W / 2 - espesor / 2 - 0.01, H / 2,  0] },
    { geo: planoRocaTerrain(espesor, marcoH,        12, 28, mAmp, mScl, ox+30, oy+10, mEdge), pos: [ W / 2 + espesor / 2 + 0.01, H / 2,  0] },
  ];
  for (const { geo, pos: p } of marcos) {
    const m = new THREE.Mesh(geo, mRoca);
    m.position.set(...p);
    g.add(m);
  }

  // ── TABLEROS ELÉCTRICOS (solo si conTableros=true) ────────────────
  if (conTableros) {
    const posTabl = doble
      ? [[-0.42, 0, -D + 0.40], [0.42, 0, -D + 0.40]]
      : [[0,    0, -D + 0.40]];
    for (const [tx, ty, tz] of posTabl) {
      const tablero = crearTablero();
      tablero.position.set(tx, ty, tz);
      tablero.rotation.y = Math.PI;
      g.add(tablero);
      if (tablero.userData?.interactable) {
        g.userData._tableroInteractable = tablero.userData.interactable;
      }
    }

    // Cables eléctricos colgando
    const nC = 3 + (seed % 3);
    for (let i = 0; i < nC; i++) {
      const t   = nC > 1 ? i / (nC - 1) : 0.5;
      const cx  = (t - 0.5) * W * 0.75;
      const cz  = -D * (0.25 + (i % 2) * 0.35);
      const len = 0.4 + (i % 3) * 0.15;
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.013, 0.010, len, 4), mCable
      );
      cable.position.set(cx, H - len / 2 - 0.06, cz);
      cable.rotation.z = ((seed + i) % 7 - 3) * 0.07;
      cable.rotation.x = ((seed + i * 2) % 5 - 2) * 0.05;
      g.add(cable);
    }
  } else {
    // Nicho vacío: solo un par de cables sueltos / pintura desgastada
    for (let i = 0; i < 2; i++) {
      const len = 0.55 + i * 0.20;
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.010, 0.008, len, 4), mCable
      );
      cable.position.set((i === 0 ? -0.28 : 0.28), H - len / 2 - 0.06, -D * 0.4);
      cable.rotation.z = (i === 0 ? -1 : 1) * 0.18;
      g.add(cable);
    }
  }

  // ── ESCORRENTÍA / HUMEDAD ─────────────────────────────────────────
  if (seed % 2 === 0) {
    const mAgua = MineMaterials.plano(0x0c0c0a, { rough: 0.10 });
    const hGeo  = planoRocaTerrain(
      0.24 + (seed % 4) * 0.06, 0.70 + (seed % 3) * 0.14,
      6, 12, 0.028, 1.8, ox + 40, oy + 15
    );
    const hm   = new THREE.Mesh(hGeo, mAgua);
    const lado = seed % 4 < 2 ? -1 : 1;
    hm.position.set(lado * (W / 2 - 0.01), H * 0.42, -D * 0.55);
    hm.rotation.y = lado < 0 ? -Math.PI / 2 + 0.012 : Math.PI / 2 - 0.012;
    g.add(hm);
  }

  // ── LUZ INTERIOR ─────────────────────────────────────────────────
  const bulbMat = MineMaterials.plano(0xffcc44,
    { rough: 0.25, emissive: 0xffaa22, emissiveIntensity: 4.5 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), bulbMat);
  bulb.position.set(0, H - 0.12, -D * 0.42);
  g.add(bulb);

  const luz = new THREE.PointLight(0xffcc66, 10, 7, 2);
  luz.position.copy(bulb.position);
  g.add(luz);

  return g;
}

/** Alias para el nicho vacío (refugio peatonal sin equipos). */
export function crearVacio({ seed = 1 } = {}) {
  return crear({ doble: false, conTableros: false, seed });
}
