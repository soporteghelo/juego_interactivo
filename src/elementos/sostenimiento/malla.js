import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { herraduraProfile } from '../../world/segments/TunnelGeometry.js';

/**
 * MALLA DE ACERO (wire mesh) de sostenimiento.
 * md: cuadricula ~10cm, se oxida (cafe-oxido), cubre paredes y techo.
 *
 * Tres piezas distintas viven en este archivo:
 *
 *  1. `crearManto()` — la MALLA REAL DE LA LABOR: un manto CONTINUO que envuelve toda la
 *     herradura (hastiales + boveda) colgando de los pernos. Es lo que domina cualquier foto
 *     de galeria: la malla no son parches sueltos, es un solo tejido que cubre el contorno
 *     perfilado y COMBA entre anclajes, puenteando la sobre-excavacion en vez de calcar la roca.
 *     Tejido ESLABONADO/romboidal (chain-link), que es el que se usa en la mina real, no la
 *     cuadricula ortogonal.
 *  2. `crear({sobresalida:true})` — el paño DEFORMADO Y RASGADO que se deja como hallazgo
 *     geomecanico puntual, con extremos de varilla cortantes (hazard tipo:'corte').
 *  3. `crear()` plano — paño suelto para el visor y colocaciones puntuales.
 */

export const meta = {
  id: 'malla',
  nombre: 'Malla de acero',
  descripcion: 'Manto eslabonado continuo sobre toda la herradura. Variante sobresalida con extremos de varilla peligrosos.'
};

let _texCache = null;
let _matNormal = null;
let _matSobre  = null;

function texturaCuadricula() {
  if (_texCache) return _texCache;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  // Fondo transparente
  ctx.clearRect(0, 0, 256, 256);
  // Alambres: trama cruzada oxidada
  ctx.strokeStyle = '#8B3A18';
  ctx.lineWidth = 8;
  const paso = 28;
  for (let i = 0; i <= 256; i += paso) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  // Nodos de union mas oscuros/gruesos
  ctx.fillStyle = '#5A1E08';
  for (let x = 0; x <= 256; x += paso) {
    for (let y = 0; y <= 256; y += paso) {
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Manchas de oxido irregulares
  const rustPts = [[30,40],[90,120],[180,60],[140,200],[60,210],[220,150]];
  for (const [rx, ry] of rustPts) {
    const rg = ctx.createRadialGradient(rx, ry, 2, rx, ry, 22);
    rg.addColorStop(0, 'rgba(130,55,15,0.55)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(rx, ry, 22, 0, Math.PI * 2); ctx.fill();
  }
  _texCache = new THREE.CanvasTexture(c);
  _texCache.wrapS = _texCache.wrapT = THREE.RepeatWrapping;
  return _texCache;
}

function _getMat(sobresalida) {
  if (sobresalida) {
    if (!_matSobre) _matSobre = new THREE.MeshStandardMaterial({
      map: texturaCuadricula(),
      transparent: true, alphaTest: 0.3,
      roughness: 0.92, metalness: 0.55,
      color: 0x6a2a0a, side: THREE.DoubleSide
    });
    return _matSobre;
  }
  if (!_matNormal) _matNormal = new THREE.MeshStandardMaterial({
    map: texturaCuadricula(),
    transparent: true, alphaTest: 0.3,
    roughness: 0.92, metalness: 0.55,
    color: 0x7a3a18, side: THREE.DoubleSide
  });
  return _matNormal;
}

// Escala los UVs de la geometría en lugar de clonar la textura con repeat distinto.
function _scaleUVs(geo, repeatX, repeatY) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * repeatX, uv.getY(i) * repeatY);
  }
  uv.needsUpdate = true;
}

function seudoRng(seed) {
  let s = seed & 0xffffffff;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  MANTO ESLABONADO — la malla continua que envuelve la herradura de la labor
// ════════════════════════════════════════════════════════════════════════════

/** Lado del tile de la textura, en metros. 8 rombos por tile → celda ~10 cm (md: malla ~10x10cm). */
const TILE_M = 0.8;
/** Separacion entre pernos de sostenimiento (md: patron regular 1.0-1.5 m). Manda la comba. */
export const PASO_ANCLAJE = 1.3;
/** Altura del pie del manto: por debajo queda el hastial desnudo/pintado, como en la mina real. */
const Y_PIE = 0.95;

let _texEslabon = null;
let _matManto = null;

/**
 * Tejido ESLABONADO (chain-link): dos familias de alambre a 45° formando rombos.
 * Se dibuja con periodo divisor del lienzo para que TEJA SIN COSTURA, y el oxido se aplica con
 * `source-atop` para que tiña SOLO el alambre — si se pintara al fondo, el patron de manchas
 * se repetiria visiblemente en cada tile.
 */
function texturaEslabonada() {
  if (_texEslabon) return _texEslabon;
  const S = 256, paso = 32;                 // 8 rombos por tile
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  ctx.lineCap = 'round';
  // Dos familias de diagonales. La segunda va mas clara: el alambre de arriba del tejido recibe
  // la luz y el de abajo queda en sombra — es lo que da la lectura de "tejido" y no de "rejilla".
  for (const [dir, color, w] of [[1, '#4a4a48', 7], [-1, '#6b6360', 6]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    for (let k = -S; k <= S * 2; k += paso) {
      ctx.beginPath();
      ctx.moveTo(k, 0);
      ctx.lineTo(k + dir * S, S);
      ctx.stroke();
    }
  }

  // Oxido SOLO sobre el alambre (md: la malla se oxida en cafe-naranja #8b4513-#a0522d).
  ctx.globalCompositeOperation = 'source-atop';
  for (const [rx, ry, r] of [[40, 60, 55], [180, 40, 45], [120, 170, 60], [225, 200, 50], [60, 220, 40]]) {
    const rg = ctx.createRadialGradient(rx, ry, 2, rx, ry, r);
    rg.addColorStop(0, 'rgba(139,69,19,0.75)');
    rg.addColorStop(1, 'rgba(139,69,19,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, S, S);
  }
  ctx.globalCompositeOperation = 'source-over';

  _texEslabon = new THREE.CanvasTexture(c);
  _texEslabon.wrapS = _texEslabon.wrapT = THREE.RepeatWrapping;
  _texEslabon.colorSpace = THREE.SRGBColorSpace;
  _texEslabon.anisotropy = 4;
  return _texEslabon;
}

/**
 * Material UNICO del manto. `transparent:false` + `alphaTest`: recorta el hueco del rombo sin
 * entrar en la cola de transparencias (nada de ordenar por profundidad decenas de mantos) y,
 * al escribir profundidad, el fusor de estaticos y el z-buffer lo tratan como solido normal.
 */
function materialManto() {
  if (_matManto) return _matManto;
  _matManto = new THREE.MeshStandardMaterial({
    map: texturaEslabonada(),
    color: 0x7d6a5e,
    alphaTest: 0.42,
    transparent: false,
    side: THREE.DoubleSide,
    roughness: 0.86,
    metalness: 0.45,
    envMapIntensity: 0.25
  });
  return _matManto;
}

/** Perfil de la herradura recortado al pie del manto, con longitud de arco acumulada. */
function _perfilManto(width, height, archRatio) {
  const { profile, normals2D } = herraduraProfile(width, height, archRatio);
  const pts = [], nrm = [];
  for (let i = 0; i < profile.length; i++) {
    const p = profile[i];
    const dentro = p.y >= Y_PIE;
    if (i > 0) {
      const ant = profile[i - 1];
      // CRUCE del pie del manto: se inserta el punto EXACTO en Y_PIE. Si solo se descartaran los
      // vertices por debajo, el pie saltaria al siguiente vertice del perfil (hasta +40 cm segun
      // la altura de la labor) y el manto arrancaria a una altura distinta en cada labor.
      if (dentro !== (ant.y >= Y_PIE) && Math.abs(p.y - ant.y) > 1e-6) {
        const t = (Y_PIE - ant.y) / (p.y - ant.y);
        pts.push(new THREE.Vector2(ant.x + (p.x - ant.x) * t, Y_PIE));
        nrm.push(normals2D[dentro ? i : i - 1]);
      }
    }
    if (!dentro) continue;
    pts.push(p);
    nrm.push(normals2D[i]);
  }
  // Longitud de arco acumulada → UV metrica: el rombo mide igual en hastial y en clave.
  const arc = [0];
  for (let i = 1; i < pts.length; i++) arc.push(arc[i - 1] + pts[i].distanceTo(pts[i - 1]));
  return { pts, nrm, arc };
}

/**
 * Puntos de ANCLAJE del manto = donde van los pernos que lo sujetan.
 *
 * Lo consume `PropScatter._rockBolts` para que CADA perno caiga exactamente en un nudo del
 * manto: si los pernos se sortearan aparte, se verian pernos al aire y malla colgando de nada.
 *
 * @returns {Array<{x:number,y:number,z:number,nx:number,ny:number,enArco:boolean}>}
 */
export function anclajesManto({ width, height, length, archRatio = 0.4, soloHastial = false }) {
  const { pts, nrm, arc } = _perfilManto(width, height, archRatio);
  const total = arc[arc.length - 1];
  const halfW = width / 2;

  // Columnas de anclaje repartidas UNIFORMEMENTE por el arco (paso ~PASO_ANCLAJE).
  const nCols = Math.max(3, Math.round(total / PASO_ANCLAJE));
  const cols = [];
  for (let k = 0; k <= nCols; k++) {
    const objetivo = (total * k) / nCols;
    let i = 1;
    while (i < arc.length - 1 && arc[i] < objetivo) i++;
    cols.push(i);
  }

  const out = [];
  for (const i of [...new Set(cols)]) {
    const p = pts[i], n = nrm[i];
    const enArco = Math.abs(p.x) < halfW - 0.12;   // fuera del hastial recto = boveda
    if (soloHastial && enArco) continue;
    for (let z = -PASO_ANCLAJE * 0.5; z > -length; z -= PASO_ANCLAJE) {
      out.push({ x: p.x, y: p.y, z, nx: n.x, ny: n.y, enArco });
    }
  }
  return out;
}

/**
 * MANTO DE MALLA de un tramo: superficie continua barrida sobre la herradura.
 *
 * Forma (asi cuelga la malla de verdad):
 *   - se ancla en los pernos y COMBA entre ellos, en las dos direcciones (a lo largo de la labor
 *     y a lo largo del arco) → nunca es una superficie tensa;
 *   - PUENTEA la sobre-excavacion: se cuelga del perfil NOMINAL, no de la roca jitteada, que
 *     siempre queda por fuera. Ademas de ser lo correcto, evita z-fighting con la carcasa;
 *   - lleva JOROBAS donde la roca suelta se acumulo detras del tejido;
 *   - marca el TRASLAPE de paños cada ~2.5 m (el paño de encima cuelga un poco mas).
 *
 * @param {{width:number,height:number,length:number,archRatio?:number,seed?:number,
 *          detail?:number,skipZones?:Array<{side:number,zMin:number,zMax:number}>}} opts
 * @returns {THREE.Mesh}
 */
export function crearManto({
  width, height, length, archRatio = 0.4, seed = 1, detail = 1, skipZones = null
} = {}) {
  const { pts, nrm, arc } = _perfilManto(width, height, archRatio);
  const cols = pts.length;
  const total = arc[arc.length - 1];
  const halfW = width / 2;
  const rng = seudoRng(seed * 7919 + 13);

  // Filas por vano de anclaje: 3 en escritorio (comba suave), 2 en gama baja. La malla del manto
  // es UNA geometria por tramo, asi que esto es todo el coste que hay que dosificar.
  const porVano = detail >= 0.8 ? 3 : 2;
  const pasoZ = PASO_ANCLAJE / porVano;
  const rows = Math.max(2, Math.ceil(length / pasoZ)) + 1;

  // Anclajes a lo largo del arco (misma reparticion que `anclajesManto`) para que la comba
  // transversal sea CERO justo donde hay perno.
  const nAnc = Math.max(3, Math.round(total / PASO_ANCLAJE));

  // Jorobas: roca suelta acumulada detras del tejido. Pocas y grandes, como en las fotos.
  const nJorobas = 2 + Math.floor(rng() * 3);
  const jorobas = [];
  for (let j = 0; j < nJorobas; j++) {
    jorobas.push({
      s: rng() * total,                       // posicion a lo largo del arco
      z: -rng() * length,                     // posicion a lo largo de la labor
      rs: 0.7 + rng() * 1.1,
      rz: 0.9 + rng() * 1.6,
      str: 0.10 + rng() * 0.24
    });
  }

  const positions = [], uvs = [], indices = [];
  const OFF = 0.055;          // separacion base de la roca nominal
  const COMBA = 0.085;        // flecha de la comba entre pernos

  for (let r = 0; r < rows; r++) {
    const z = -Math.min(length, r * pasoZ);
    const fracZ = (r % porVano) / porVano;
    const combaZ = Math.sin(Math.PI * fracZ);
    // Traslape de paños: cada ~2.5 m el paño superior monta sobre el siguiente y cuelga algo mas.
    const traslape = (Math.floor(-z / 2.5) % 2 === 0) ? 0 : 0.018;

    for (let c = 0; c < cols; c++) {
      const p = pts[c], n = nrm[c];
      const fracA = (arc[c] / total) * nAnc;
      const combaA = Math.sin(Math.PI * (fracA % 1));

      let d = OFF + traslape + COMBA * combaZ * combaA;
      for (const j of jorobas) {
        const ds = (arc[c] - j.s) / j.rs;
        const dz = (z - j.z) / j.rz;
        d += j.str * Math.exp(-(ds * ds + dz * dz));
      }
      // Rugosidad fina del tejido (el alambre nunca queda en un plano perfecto).
      d += (rng() - 0.5) * 0.012;

      positions.push(p.x + n.x * d, p.y + n.y * d, z);
      uvs.push(arc[c] / TILE_M, -z / TILE_M);
    }
  }

  // Caras. Se OMITEN las que caen sobre la boca de un nicho/refugio: la malla no tapa un acceso.
  const enZonaLibre = (c, z) => {
    if (!skipZones) return false;
    const p = pts[c];
    if (Math.abs(p.x) < halfW - 0.12) return false;      // solo el hastial recto tiene bocas
    const side = p.x > 0 ? 1 : -1;
    return skipZones.some(zn => zn.side === side && z <= zn.zMax + 0.25 && z >= zn.zMin - 0.25);
  };

  for (let r = 0; r < rows - 1; r++) {
    const z0 = -Math.min(length, r * pasoZ);
    for (let c = 0; c < cols - 1; c++) {
      if (enZonaLibre(c, z0) || enZonaLibre(c + 1, z0)) continue;
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, materialManto());
  mesh.name = 'manto_malla';
  return mesh;
}

/**
 * COSTURA DE ALAMBRE galvanizado (lacing) en los traslapes de paño: el zigzag brillante que
 * cose un paño con el siguiente. Va en una sola geometria fusionada y con material propio
 * (alambre nuevo, claro y metalico) para que destaque contra el tejido oxidado.
 *
 * @returns {THREE.Mesh|null}
 */
export function crearCosturaManto({ width, height, length, archRatio = 0.4, seed = 1 } = {}) {
  const { pts, nrm, arc } = _perfilManto(width, height, archRatio);
  const total = arc[arc.length - 1];
  const rng = seudoRng(seed * 104729 + 7);

  const positions = [], indices = [];
  const R = 0.011;                         // radio del alambre de costura
  const paso = 0.26;                       // ancho del diente del zigzag
  const amp  = 0.085;                      // altura del diente

  // Un cordon de costura por cada traslape de paño (~cada 2.5 m).
  for (let zc = -2.5; zc > -length; zc -= 2.5) {
    const puntos = [];
    for (let s = 0; s <= total; s += paso) {
      // Interpola el perfil a longitud de arco `s`.
      let i = 1;
      while (i < arc.length - 1 && arc[i] < s) i++;
      const t = (s - arc[i - 1]) / Math.max(1e-4, arc[i] - arc[i - 1]);
      const px = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t;
      const py = pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t;
      const nx = nrm[i - 1].x, ny = nrm[i - 1].y;
      const d = 0.065 + rng() * 0.01;
      // Zigzag: el alambre alterna a un lado y otro de la linea de traslape.
      const dz = (Math.round(s / paso) % 2 === 0 ? 1 : -1) * amp;
      puntos.push(new THREE.Vector3(px + nx * d, py + ny * d, zc + dz));
    }
    if (puntos.length < 2) continue;
    const curva = new THREE.CatmullRomCurve3(puntos);
    const tubo = new THREE.TubeGeometry(curva, puntos.length, R, 4, false);
    const base = positions.length / 3;
    const pa = tubo.attributes.position.array;
    for (let k = 0; k < pa.length; k++) positions.push(pa[k]);
    for (const idx of tubo.index.array) indices.push(base + idx);
    tubo.dispose();
  }
  if (!indices.length) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Alambre galvanizado: claro y metalico, sin oxidar todavia (se instala al final).
  const mesh = new THREE.Mesh(geo, MineMaterials.plano(0xb9bcc0, { rough: 0.42, metal: 0.85 }));
  mesh.name = 'costura_manto';
  return mesh;
}

/**
 * @param {{width?:number, height?:number, sobresalida?:boolean, seed?:number}} opts
 * @returns {THREE.Mesh|THREE.Group}
 */
export function crear({ width = 3, height = 2.2, sobresalida = false, seed = 42 } = {}) {
  const mat = _getMat(sobresalida);
  const repeatX = width * 2.8;
  const repeatY = height * 2.8;

  if (!sobresalida) {
    // Malla plana simple con leve irregularidad
    const geo = new THREE.PlaneGeometry(width, height, 6, 5);
    _scaleUVs(geo, repeatX, repeatY);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, (Math.random() - 0.5) * 0.025);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'malla';
    return mesh;
  }

  // ══════════════════════════════════════════════════════════════════
  //  MALLA SOBRESALIDA — con deformacion grave y extremos peligrosos
  // ══════════════════════════════════════════════════════════════════
  const g = new THREE.Group();
  g.name = 'malla_sobresalida';

  const rng = seudoRng(seed);

  // Numero de jorobas/abombamientos (2-4 segun seed)
  const nBulges = 2 + Math.floor(rng() * 3);
  const bulges = [];
  for (let b = 0; b < nBulges; b++) {
    bulges.push({
      cx:  (rng() - 0.5) * width  * 0.72,
      cy:  (rng() - 0.5) * height * 0.65,
      str: 0.18 + rng() * 0.28,   // protrusion: 0.18 - 0.46m (un tercio del original)
      rx:  0.5  + rng() * 0.70,
      ry:  0.45 + rng() * 0.55
    });
  }

  // Panel principal con deformacion (alta subdivision para mejor forma)
  const segsX = 18, segsY = 12;
  const geo = new THREE.PlaneGeometry(width, height, segsX, segsY);
  _scaleUVs(geo, repeatX, repeatY);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let z = 0;
    for (const b of bulges) {
      const dx = (x - b.cx) / b.rx;
      const dy = (y - b.cy) / b.ry;
      const r2 = dx * dx + dy * dy;
      // Funcion de joroba: maxima en el centro, cae suavemente
      z += b.str * Math.max(0, 1 - r2 * 0.7) * Math.exp(-r2 * 0.35);
    }
    // Jitter de rugosidad (la malla no es lisa)
    z += (rng() - 0.5) * 0.018;
    pos.setZ(i, z);
  }
  geo.computeVertexNormals();

  const panel = new THREE.Mesh(geo, mat);
  g.add(panel);

  // ── EXTREMOS DE VARILLA / ALAMBRE SUELTO ─────────────────────────
  // Simulan los extremos cortados de la malla que sobresalen peligrosamente.
  const matVar = MineMaterials.plano(0x4a1a06, { rough: 0.92, metal: 0.75 });

  const nVarillas = 9 + Math.floor(rng() * 8); // 9-16 extremos sueltos
  for (let i = 0; i < nVarillas; i++) {
    const largo  = 0.10 + rng() * 0.40; // 10-50cm
    const radio  = 0.003 + rng() * 0.004;
    const varilla = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio * 0.5, largo, 5), matVar);

    // Posicion: mezcla de bordes (mas peligrosos) y superficie irregular
    const enBorde = rng() < 0.55;
    let vx, vy, vz;
    if (enBorde) {
      const borde = Math.floor(rng() * 4);
      const t = rng();
      switch (borde) {
        case 0: vx = -width / 2 + t * width; vy =  height / 2 + rng() * 0.08; break;
        case 1: vx = -width / 2 + t * width; vy = -height / 2 - rng() * 0.08; break;
        case 2: vx = -width / 2 - rng() * 0.06; vy = -height / 2 + t * height; break;
        default: vx =  width / 2 + rng() * 0.06; vy = -height / 2 + t * height; break;
      }
      // Profundidad de la joroba en ese punto (estimacion)
      let zBase = 0;
      for (const b of bulges) {
        const dx = (vx - b.cx) / b.rx;
        const dy = (vy - b.cy) / b.ry;
        const r2 = dx * dx + dy * dy;
        zBase += b.str * Math.max(0, 1 - r2 * 0.7) * Math.exp(-r2 * 0.35);
      }
      vz = zBase + largo * 0.3;
    } else {
      vx = (rng() - 0.5) * width  * 0.9;
      vy = (rng() - 0.5) * height * 0.9;
      // Profundidad de la joroba en este punto
      let zBase = 0;
      for (const b of bulges) {
        const dx = (vx - b.cx) / b.rx;
        const dy = (vy - b.cy) / b.ry;
        const r2 = dx * dx + dy * dy;
        zBase += b.str * Math.max(0, 1 - r2 * 0.7) * Math.exp(-r2 * 0.35);
      }
      vz = zBase + 0.05 + rng() * 0.25;
    }

    varilla.position.set(vx, vy, vz + largo / 2);
    // Angulo peligroso: mayormente saliendo hacia afuera (+Z), con desviacion irregular
    varilla.rotation.x = (rng() - 0.5) * 1.6;
    varilla.rotation.z = (rng() - 0.5) * 1.6;
    g.add(varilla);
  }

  // ── FRAGMENTOS DE SHOTCRETE pegados a la malla ─────────────────
  // Trozos de concreto colgando donde la roca empezo a ceder.
  const matCem = MineMaterials.plano(0x8a8880, { rough: 0.98, metal: 0 });
  const nFrags = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < nFrags; i++) {
    const fw = 0.15 + rng() * 0.30;
    const fh = 0.10 + rng() * 0.20;
    const fd = 0.04 + rng() * 0.08;
    const frag = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fd), matCem);
    const fx = (rng() - 0.5) * width * 0.7;
    const fy = (rng() - 0.5) * height * 0.7;
    let fz = 0;
    for (const b of bulges) {
      const dx = (fx - b.cx) / b.rx;
      const dy = (fy - b.cy) / b.ry;
      const r2 = dx * dx + dy * dy;
      fz += b.str * Math.max(0, 1 - r2 * 0.7) * Math.exp(-r2 * 0.35);
    }
    frag.position.set(fx, fy, fz - fd / 2 - 0.01);
    frag.rotation.set((rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5, (rng() - 0.5) * 0.3);
    g.add(frag);
  }

  // ── PELIGRO: corte al contacto (NO mata, solo hiere) ────────────
  g.userData.hazard = {
    tipo:     'corte',
    warn:     1.5,    // avisa al acercarse
    hurt:     0.35,   // causa herida al contacto (~35cm = rozar la pared)
    aviso:    'MALLA SOBRESALIDA — extremos de varilla cortantes. Mantente alejado de la pared.',
    reflexion:
      'La malla de sostenimiento estaba deformada con extremos de varilla sueltos. ' +
      'Al rozar la pared, estos extremos te produjeron una cortadura. Siempre inspecciona ' +
      'visualmente las paredes antes de acercarte y reporta toda malla sobresalida ' +
      'al responsable de geomecanica para reparacion inmediata.'
  };

  return g;
}
