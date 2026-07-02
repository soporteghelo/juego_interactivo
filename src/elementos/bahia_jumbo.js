import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';
import { crear as crearJumbo } from './jumbo.js';

/**
 * BAHÍA DE JUMBO — excavación 5×5×20m en el hastial.
 *
 * Misma tecnica visual que nicho_electrico:
 *   - PlaneGeometry subdividida con desplazamiento fBm y vertex colors (THREE.Color lineal).
 *   - Material rocaTunel() con vertexColors:true.
 *   - Marco de entrada irregular (mismo sistema de "marcos" que el nicho pequeño).
 *   - Bloqueo LOTO con cadenas a 1.2 m de altura.
 */

// ── fBm (idéntico a nicho_electrico) ────────────────────────────────────────
function _hash(ix, iy) {
  let h = ((ix * 1664525) ^ (iy * 22695477) ^ 2531011) >>> 0;
  h ^= (h >>> 16); h = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= (h >>> 16);
  return (h >>> 0) / 0xffffffff;
}
function _smooth(t) { return t * t * (3 - 2 * t); }
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
function _fbm(x, y, oct = 5) {
  let v = 0, amp = 1.0, freq = 1.0, norm = 0;
  for (let o = 0; o < oct; o++) {
    v    += _valueNoise(x * freq, y * freq) * amp;
    norm += amp;
    amp  *= 0.50;
    freq *= 2.07;
  }
  return v / norm;
}

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
 * PlaneGeometry con desplazamiento fBm + vertex colors (idéntico a nicho_electrico).
 * edgeAmp > 0 perturba la silueta exterior para que no sea un rectángulo perfecto.
 */
function _planoRoca(w, h, segsX, segsY, amp, scale, ox, oy, edgeAmp = 0) {
  const geo  = new THREE.PlaneGeometry(w, h, segsX, segsY);
  const pos  = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const nx = (px / w + 0.5) * scale + ox;
    const ny = (py / h + 0.5) * scale + oy;
    const n  = _fbm(nx, ny, 5);
    const edgeU = Math.abs(px) / (w * 0.5);
    const edgeV = Math.abs(py) / (h * 0.5);
    const fade  = Math.max(0, 1 - Math.pow(Math.max(edgeU, edgeV), 4) * 8);
    pos.setZ(i, (n - 0.5) * amp * 2 * fade);
    if (edgeAmp > 0) {
      const efU = Math.max(0, (edgeU - 0.72) / 0.28);
      const efV = Math.max(0, (edgeV - 0.72) / 0.28);
      if (efU > 0) pos.setX(i, px + (_fbm(nx + 100, ny + 50, 4) - 0.5) * edgeAmp * 2 * efU);
      if (efV > 0) pos.setY(i, py + (_fbm(nx + 200, ny + 150, 4) - 0.5) * edgeAmp * 2 * efV);
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

// ── Dimensiones exportadas (usadas por PropScatter._punchBahiaHole) ──────────
export const BW = 5.0;   // ancho (a lo largo del túnel, eje Z local)
export const BH = 4.8;   // alto
export const BD = 20.0;  // profundidad (hacia la roca, eje -Z local)

export const meta = {
  id: 'bahia_jumbo',
  nombre: 'Bahía de jumbo',
  descripcion: 'Excavación 5×5×20m en el hastial. Perforadora estacionada. Bloqueo LOTO activo.'
};

export function crear({ seed = 1 } = {}) {
  const g = new THREE.Group();
  g.name = 'bahia_jumbo';

  const mRoca  = MineMaterials.rocaTunel();
  const mSuelo = MineMaterials.plano(0x1e1c18, { rough: 1.0 });
  const ox = seed * 0.37, oy = seed * 0.61;

  // ── PARED DEL FONDO (alta amplitud: perforadora deja la roca muy irregular) ──
  const fondo = new THREE.Mesh(_planoRoca(BW, BH, 36, 30, 0.68, 2.4, ox, oy, 0.35), mRoca);
  fondo.position.set(0, BH / 2, -BD);
  g.add(fondo);

  // ── PAREDES LATERALES ────────────────────────────────────────────────────────
  // Amplitud alta en la dimension larga (20m): crea ondulaciones de 1-3m de diametro
  for (const sign of [-1, 1]) {
    const lat = new THREE.Mesh(_planoRoca(BD, BH, 50, 30, 0.72, 2.0, ox + sign * 14, oy + 7, 0.30), mRoca);
    lat.rotation.y = -sign * Math.PI / 2;
    lat.position.set(sign * BW / 2, BH / 2, -BD / 2);
    g.add(lat);
  }

  // ── TECHO (el más irregular: bloques colgantes, grietas) ────────────────────
  const techo = new THREE.Mesh(_planoRoca(BW, BD, 32, 50, 0.85, 2.2, ox + 22, oy + 5, 0.28), mRoca);
  techo.rotation.x = Math.PI / 2;
  techo.position.set(0, BH, -BD / 2);
  g.add(techo);

  // ── SUELO (excavado con barro compacto) ─────────────────────────────────────
  const gSuelo = new THREE.PlaneGeometry(BW, BD, 5, 12);
  const suelo  = new THREE.Mesh(gSuelo, mSuelo);
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.set(0, 0.01, -BD / 2);
  g.add(suelo);

  // ── MARCO DE ENTRADA IRREGULAR (mismo sistema que nicho_electrico) ───────────
  // 4 planks con silueta fBm para romper el borde rectangular de la excavación.
  const espesor = 0.65;
  const marcoW  = BW + 0.60;
  const marcoH  = BH + 0.45;
  const mAmp    = 0.38;
  const mEdge   = 0.40;
  const mScl    = 3.2;
  const marcos = [
    // Franja superior
    { geo: _planoRoca(marcoW,    espesor,       28, 14, mAmp, mScl, ox+25, oy,     mEdge), pos: [0,  BH + espesor / 2 + 0.01,          0] },
    // Franja inferior (debajo del suelo)
    { geo: _planoRoca(marcoW,    espesor * 0.7, 28,  8, mAmp, mScl, ox+30, oy+4,   mEdge), pos: [0, -espesor * 0.35,                   0] },
    // Jamba izquierda
    { geo: _planoRoca(espesor, marcoH,          14, 34, mAmp, mScl, ox+34, oy+8,   mEdge), pos: [-BW / 2 - espesor / 2 - 0.01, BH / 2, 0] },
    // Jamba derecha
    { geo: _planoRoca(espesor, marcoH,          14, 34, mAmp, mScl, ox+38, oy+12,  mEdge), pos: [ BW / 2 + espesor / 2 + 0.01, BH / 2, 0] },
  ];
  for (const { geo, pos: p } of marcos) {
    const m = new THREE.Mesh(geo, mRoca);
    m.position.set(...p);
    g.add(m);
  }

  // ── JUMBO (estacionado al fondo, brazos hacia la cara de avance) ─────────────
  const jumbo = crearJumbo();
  jumbo.position.set(0.6, 0, -BD + 6.5);
  jumbo.rotation.y = 0;
  g.add(jumbo);

  // ── ILUMINACIÓN DE TRABAJO (bombillas cálidas de mina) ──────────────────────
  // Intensidad alta para vencer el verde de los LEDs del túnel principal
  for (const [zl, int] of [[-2.5, 36], [-BD * 0.45, 40], [-BD + 6, 36]]) {
    const luz = new THREE.PointLight(0xffcc66, int, 16, 2);
    luz.position.set(0, BH - 0.5, zl);
    g.add(luz);
    // Bombilla visible
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 4),
      MineMaterials.plano(0xffcc44, { rough: 0.2, emissive: 0xffaa22, emissiveIntensity: 5 })
    );
    bulb.position.copy(luz.position);
    g.add(bulb);
  }

  // ── BLOQUEO LOTO ─────────────────────────────────────────────────────────────
  _agregarBloqueoLoto(g);

  g.userData.interactable = {
    object: g,
    descriptor: {
      label: 'Inspeccionar bloqueo LOTO',
      onInteract: () => window.__mina?.bus.emit('ui:read', {
        title: 'BLOQUEO LOTO — BAHÍA JUMBO',
        body:  'PELIGRO: Equipo en mantenimiento.\nBloqueo LOTO activo.\n\nAcceso prohibido sin autorización del supervisor de guardia.\nDistancia mínima de seguridad: 3 m del equipo.\n\nAESA — Cerro Lindo'
      })
    }
  };

  return g;
}

function _agregarBloqueoLoto(g) {
  const mAm  = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.50, metalness: 0.30 });
  const mRoj = new THREE.MeshStandardMaterial({ color: 0xdd1100, roughness: 0.75, metalness: 0.05 });

  // Postes amarillos de seguridad
  for (const sx of [-1, 1]) {
    // Poste (altura 1.35m)
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.35, 8), mAm);
    poste.position.set(sx * (BW / 2 - 0.30), 0.675, -0.65);
    g.add(poste);
    // Base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.07, 8), mAm);
    base.position.set(sx * (BW / 2 - 0.30), 0.035, -0.65);
    g.add(base);
    // Remate superior
    const remate = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mAm);
    remate.position.set(sx * (BW / 2 - 0.30), 1.375, -0.65);
    g.add(remate);
  }

  // Cadenas a 1.2 m de altura (estándar de seguridad en mina)
  const anchoCadena = BW - 0.60;
  const cadena = new THREE.Mesh(new THREE.BoxGeometry(anchoCadena, 0.06, 0.06), mRoj);
  cadena.position.set(0, 1.20, -0.65);
  g.add(cadena);

  // Segunda cadena más baja (refuerzo visual)
  const cadena2 = new THREE.Mesh(new THREE.BoxGeometry(anchoCadena, 0.05, 0.05), mRoj);
  cadena2.position.set(0, 0.80, -0.65);
  g.add(cadena2);

  // Señal BLOQUEO LOTO central (cartel sobre la cadena superior)
  const cv  = document.createElement('canvas');
  cv.width  = 320;
  cv.height = 160;
  const ctx = cv.getContext('2d');

  ctx.fillStyle = '#cc1100';
  ctx.fillRect(0, 0, 320, 160);
  ctx.strokeStyle = '#ffcc00';
  ctx.lineWidth = 7;
  ctx.strokeRect(4, 4, 312, 152);
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, 296, 136);

  // Ícono candado
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.arc(44, 72, 18, Math.PI, 2 * Math.PI);
  ctx.fill();
  ctx.fillRect(26, 72, 36, 28);
  ctx.fillStyle = '#cc1100';
  ctx.fillRect(34, 78, 20, 16);
  ctx.beginPath();
  ctx.arc(44, 72, 7, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('BLOQUEO LOTO', 190, 48);
  ctx.font = 'bold 20px Arial';
  ctx.fillText('PROHIBIDO INGRESAR', 190, 82);
  ctx.font = '14px Arial';
  ctx.fillText('EQUIPO EN MANTENIMIENTO', 190, 110);
  ctx.fillText('AESA  ·  NEXA  ·  CERRO LINDO', 190, 138);

  const tex  = new THREE.CanvasTexture(cv);
  const matS = new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.8, side: THREE.DoubleSide,
    emissive: 0x330000, emissiveIntensity: 0.3  // ligeramente autoluminoso para ser legible
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.50, 0.75), matS);
  sign.position.set(0, 1.65, -0.62);
  g.add(sign);
}
