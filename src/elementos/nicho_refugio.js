import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';
import { crear as crearRefugio } from './refugio_draeger.js';
import { crearSenal } from './senal.js';

/**
 * NICHO DEL REFUGIO MINERO — excavación en el hastial que aloja al refugio Dräger.
 *
 * Reconstruido de la foto real (Refugio Minero N°2, NEXA / Cerro Lindo):
 *  - Galería excavada con paredes de roca fBm PINTADAS DE SHOTCRETE BLANCO
 *    (tonos claros, no la roca oscura del túnel) y MALLA electrosoldada encima
 *    (grid diagonal oscuro multiplicado sobre los vertex colors).
 *  - Refugio Dräger al fondo, con el frente (puerta/semáforo) hacia la apertura.
 *  - Cordel con 3 letreros amarillos "REFUGIO MINERO N°2" cruzando el acceso.
 *  - Alas de roca a los lados de la apertura con señalética: "PROHIBIDO BOTAR
 *    BASURA" + punto de reunión (izq.), fila de placas doradas de emergencia (der.).
 *  - Piso de barro compacto con charco; luz cálida de mina + LED verde de acceso.
 *
 * Convención de ejes LOCAL (igual que bahia_jumbo):
 *   apertura en z=0 mirando a +Z, profundidad hacia -Z, Y = altura.
 */

// ── Dimensiones exportadas (para perforar el hastial si se integra al túnel) ──
export const NW = 6.2;   // ancho de la apertura (X)
export const NH = 4.8;   // alto
export const ND = 9.0;   // profundidad (hacia -Z)

export const meta = {
  id: 'nicho_refugio',
  nombre: 'Nicho del refugio Dräger',
  descripcion:
    'Excavación con shotcrete blanco y malla que aloja al refugio Dräger de 20 personas. ' +
    'Letreros amarillos "REFUGIO MINERO N°2" en cordel, señalética y luz de mina.'
};

// ════════════════════════════════════════════════════════════════════════
//  NOISE fBm (mismo patrón que nicho_electrico / bahia_jumbo)
// ════════════════════════════════════════════════════════════════════════

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

// Rampa de SHOTCRETE BLANCO (foto: roca cubierta de concreto lanzado claro).
// Sombras grises en las cavidades, blanco sucio en los salientes.
const _RAMP = [
  { t: 0.00, c: new THREE.Color(0x63635c) },
  { t: 0.35, c: new THREE.Color(0x8e8e86) },
  { t: 0.60, c: new THREE.Color(0xb2b2aa) },
  { t: 0.80, c: new THREE.Color(0xcbcbc3) },
  { t: 1.00, c: new THREE.Color(0xe0e0d8) },
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

/** PlaneGeometry con desplazamiento fBm + vertex colors de shotcrete blanco. */
function _planoRoca(w, h, segsX, segsY, amp, scale, ox, oy, edgeAmp = 0) {
  const geo  = new THREE.PlaneGeometry(w, h, segsX, segsY);
  const pos  = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i);
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
    cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

// ════════════════════════════════════════════════════════════════════════
//  MALLA ELECTROSOLDADA — grid diagonal como map (multiplica vertex colors)
// ════════════════════════════════════════════════════════════════════════

let _mallaCanvas = null;
function _canvasMalla() {
  if (_mallaCanvas) return _mallaCanvas;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);
  // rombos de malla (diagonales ±45°) — oscurecen la roca al multiplicar
  ctx.strokeStyle = 'rgba(38,38,34,0.5)';
  ctx.lineWidth = 4;
  for (let i = -1; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * 64 - 64, 0); ctx.lineTo(i * 64 + 64, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i * 64 + 64, 0); ctx.lineTo(i * 64 - 64, 128); ctx.stroke();
  }
  _mallaCanvas = c;
  return c;
}

/** Material de roca shotcrete + malla, con repeat del grid según el tamaño del plano. */
function _matRocaMalla(w, h) {
  const tex = new THREE.CanvasTexture(_canvasMalla());
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(w / 0.42, h / 0.42);
  tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex,
    vertexColors: true,
    roughness: 1.0,
    metalness: 0.0,
    side: THREE.DoubleSide
  });
}

/** Letrero blanco "PROHIBIDO BOTAR BASURA" (círculo rojo con figura cruzada). */
function _texturaBasura() {
  const c = document.createElement('canvas');
  c.width = 300; c.height = 420;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f4ee'; ctx.fillRect(0, 0, 300, 420);
  ctx.strokeStyle = '#b8b8b0'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 294, 414);
  ctx.fillStyle = '#c01818';
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.fillText('PROHIBIDO', 150, 52);
  // círculo rojo con diagonal
  ctx.strokeStyle = '#c01818'; ctx.lineWidth = 14;
  ctx.beginPath(); ctx.arc(150, 175, 85, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(90, 115); ctx.lineTo(210, 235); ctx.stroke();
  // figura botando basura (silueta negra simple)
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(135, 140, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(124, 156, 22, 46);
  ctx.fillRect(146, 160, 30, 9);   // brazo
  ctx.fillRect(178, 152, 12, 12);  // bolsa
  ctx.fillStyle = '#c01818';
  ctx.font = 'bold 44px Arial, sans-serif';
  ctx.fillText('BOTAR', 150, 320);
  ctx.fillText('BASURA', 150, 372);
  return c;
}

/** Placa dorada/café de estación de emergencia (fila derecha de la foto). */
function _texturaPlacaDorada(icono) {
  const c = document.createElement('canvas');
  c.width = 220; c.height = 280;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a8874a'; ctx.fillRect(0, 0, 220, 280);
  ctx.fillStyle = '#f0e6d0'; ctx.fillRect(12, 12, 196, 200);
  // arco superior (estilo de las placas de la foto)
  ctx.strokeStyle = '#7a5f2e'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(110, 120, 70, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#7a5f2e';
  ctx.font = 'bold 60px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(icono, 110, 150);
  // franja inferior con "check"
  ctx.fillStyle = '#f0e6d0';
  ctx.font = 'bold 30px Arial, sans-serif';
  ctx.fillText('✓', 110, 254);
  return c;
}

function _tex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ════════════════════════════════════════════════════════════════════════
//  NICHO
// ════════════════════════════════════════════════════════════════════════

/**
 * @param {{ seed?:number, numero?:number }} opts
 * @returns {THREE.Group}
 */
export function crear({ seed = 3, numero = 2 } = {}) {
  const g = new THREE.Group();
  g.name = 'nicho_refugio';

  const ox = seed * 0.37, oy = seed * 0.61;
  const mSuelo = MineMaterials.plano(0x2b2924, { rough: 1.0 });

  // ── PARED DEL FONDO ──────────────────────────────────────────────
  const fondo = new THREE.Mesh(_planoRoca(NW, NH, 32, 26, 0.5, 2.6, ox, oy, 0.3), _matRocaMalla(NW, NH));
  fondo.position.set(0, NH / 2, -ND);
  g.add(fondo);

  // ── PAREDES LATERALES ────────────────────────────────────────────
  for (const sign of [-1, 1]) {
    const lat = new THREE.Mesh(
      _planoRoca(ND, NH, 44, 26, 0.55, 2.2, ox + sign * 12, oy + 6, 0.28),
      _matRocaMalla(ND, NH)
    );
    lat.rotation.y = -sign * Math.PI / 2;
    lat.position.set(sign * NW / 2, NH / 2, -ND / 2);
    g.add(lat);
  }

  // ── TECHO (bóveda irregular) ─────────────────────────────────────
  const techo = new THREE.Mesh(
    _planoRoca(NW, ND, 30, 44, 0.65, 2.4, ox + 20, oy + 4, 0.26),
    _matRocaMalla(NW, ND)
  );
  techo.rotation.x = Math.PI / 2;
  techo.position.set(0, NH, -ND / 2);
  g.add(techo);

  // ── SUELO interior + delantal exterior (barro compacto) ──────────
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(NW, ND, 4, 8), mSuelo);
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.set(0, 0.01, -ND / 2);
  g.add(suelo);
  const delantal = new THREE.Mesh(new THREE.PlaneGeometry(NW + 5, 3.2, 4, 3), mSuelo);
  delantal.rotation.x = -Math.PI / 2;
  delantal.position.set(0, 0.005, 1.6);
  g.add(delantal);
  // charco frente a la entrada (foto: piso húmedo con escorrentía)
  const charco = new THREE.Mesh(new THREE.CircleGeometry(0.9, 18), MineMaterials.charco());
  charco.rotation.x = -Math.PI / 2;
  charco.position.set(-1.1, 0.015, 0.9);
  charco.scale.set(1, 0.45, 1);
  g.add(charco);

  // ── MARCO DE APERTURA IRREGULAR + ALAS LATERALES ─────────────────
  const esp = 0.6, mAmp = 0.32, mEdge = 0.36, mScl = 3.0;
  const marcoW = NW + 0.5, marcoH = NH + 0.4;
  const marcos = [
    { geo: _planoRoca(marcoW, esp,       26, 12, mAmp, mScl, ox+25, oy,    mEdge), pos: [0, NH + esp / 2 + 0.01, 0],                dims: [marcoW, esp] },
    { geo: _planoRoca(esp, marcoH,       12, 30, mAmp, mScl, ox+30, oy+6,  mEdge), pos: [-NW / 2 - esp / 2 - 0.01, NH / 2, 0],      dims: [esp, marcoH] },
    { geo: _planoRoca(esp, marcoH,       12, 30, mAmp, mScl, ox+34, oy+10, mEdge), pos: [ NW / 2 + esp / 2 + 0.01, NH / 2, 0],      dims: [esp, marcoH] },
  ];
  for (const { geo, pos: p, dims } of marcos) {
    const m = new THREE.Mesh(geo, _matRocaMalla(dims[0], dims[1]));
    m.position.set(...p);
    g.add(m);
  }
  // alas de hastial a ambos lados (donde cuelga la señalética de la foto)
  const alaW = 2.4;
  for (const sign of [-1, 1]) {
    const ala = new THREE.Mesh(
      _planoRoca(alaW, marcoH, 20, 30, 0.4, 2.6, ox + 40 + sign * 6, oy + 14, 0.3),
      _matRocaMalla(alaW, marcoH)
    );
    ala.position.set(sign * (NW / 2 + esp + alaW / 2 - 0.05), marcoH / 2 - 0.2, 0);
    g.add(ala);
  }

  // ════════════════════════════════════════════════════════════════
  //  REFUGIO DRÄGER (frente hacia la apertura)
  // ════════════════════════════════════════════════════════════════
  const refugio = crearRefugio({ numero });
  refugio.rotation.y = -Math.PI / 2;      // frente local +X → +Z (hacia la salida)
  refugio.position.set(-0.25, 0, -4.2);   // frente a z ≈ -1.2; recámara trasera a -7.8
  g.add(refugio);
  // reexpone la interacción del refugio en el nicho
  g.userData.interactable = refugio.userData.interactable;

  // ════════════════════════════════════════════════════════════════
  //  CORDEL CON LETREROS AMARILLOS "REFUGIO MINERO N°2"
  // ════════════════════════════════════════════════════════════════
  const cordel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, NW + 3.6, 5),
    MineMaterials.plano(0x8a8578, { rough: 0.9 })
  );
  cordel.rotation.z = Math.PI / 2;
  cordel.position.set(0, 1.02, 0.55);
  g.add(cordel);
  for (let i = 0; i < 3; i++) {
    const banner = crearSenal('refugio_banner');
    banner.scale.set(1.05, 0.5, 1);
    banner.position.set(-2.6 + i * 2.6, 0.72, 0.56);
    banner.rotation.y = (i - 1) * 0.06;         // leve desalineación natural
    banner.rotation.x = -0.05 + (i % 2) * 0.08; // colgados, no perfectos
    g.add(banner);
  }

  // ════════════════════════════════════════════════════════════════
  //  SEÑALÉTICA DE LAS PAREDES (como la foto)
  // ════════════════════════════════════════════════════════════════
  // Izquierda: PROHIBIDO BOTAR BASURA + punto de reunión (verde)
  const xIzq = -(NW / 2 + esp + alaW / 2 - 0.05);
  const basura = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.77),
    new THREE.MeshStandardMaterial({ map: _tex(_texturaBasura()), roughness: 0.7 })
  );
  basura.position.set(xIzq - 0.35, 3.15, 0.45);
  basura.rotation.y = 0.12;
  g.add(basura);
  const reunion = crearSenal('via_escape');
  reunion.scale.set(0.6, 0.6, 1);
  reunion.position.set(xIzq + 0.75, 2.95, 0.48);
  reunion.rotation.y = 0.08;
  g.add(reunion);

  // Derecha: fila de 4 placas doradas de estación de emergencia
  const iconos = ['⛑', '🕯', '🚿', '✚'];
  const xDer = NW / 2 + esp + 0.15;
  for (let i = 0; i < 4; i++) {
    const pd = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.54),
      new THREE.MeshStandardMaterial({ map: _tex(_texturaPlacaDorada(iconos[i])), roughness: 0.65 })
    );
    pd.position.set(xDer + 0.28 + i * 0.55, 3.3 - i * 0.06, 0.46);
    pd.rotation.y = -0.1 - i * 0.02;
    g.add(pd);
  }

  // ── Cables por la pared derecha (catenaria simple, foto real) ────
  const mCable = MineMaterials.cable();
  for (let i = 0; i < 2; i++) {
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, alaW + 1.6, 5),
      mCable
    );
    cable.rotation.z = Math.PI / 2 + 0.06 + i * 0.05;
    cable.position.set(xDer + 1.0, 2.2 - i * 0.35, 0.42);
    g.add(cable);
  }

  // ════════════════════════════════════════════════════════════════
  //  ILUMINACIÓN — luz cálida de mina + LED verde de acceso
  // ════════════════════════════════════════════════════════════════
  for (const [zl, int] of [[0.8, 26], [-2.8, 22]]) {
    const luz = new THREE.PointLight(0xffcc66, int, 13, 2);
    luz.position.set(0.4, NH - 0.6, zl);
    g.add(luz);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 4),
      MineMaterials.plano(0xffcc44, { rough: 0.2, emissive: 0xffaa22, emissiveIntensity: 5 })
    );
    bulb.position.copy(luz.position);
    g.add(bulb);
  }
  // LED verde de zona de refugio (punto en el techo del acceso, foto)
  const ledVerde = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 6),
    MineMaterials.plano(0x39ff14, { emissive: 0x39ff14, emissiveIntensity: 4 })
  );
  ledVerde.position.set(0.9, NH - 0.15, -0.5);
  g.add(ledVerde);
  const luzVerde = new THREE.PointLight(0x39ff14, 4, 6, 2);
  luzVerde.position.copy(ledVerde.position);
  g.add(luzVerde);

  return g;
}
