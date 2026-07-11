import * as THREE from 'three';

/**
 * TEXTURAS PROCEDURALES — genera mapas (CanvasTexture) para dar realismo a los materiales
 * sin necesidad de imagenes externas (placeholders por codigo). Cada textura se cachea y se
 * configura con repeticion (tiling). Para editar el aspecto de una superficie, modifica su
 * funcion aqui.
 *
 * Nota: en MeshStandardMaterial, `map` se MULTIPLICA por `color`; por eso las texturas de
 * equipos (metal/grunge) son claras con vetas/manchas oscuras: tinen sin perder el color.
 */

const _cache = new Map();

function lienzo(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, ctx: c.getContext('2d') };
}

function manchas(ctx, size, n, colorFn, rMin, rMax) {
  for (let i = 0; i < n; i++) {
    const r = rMin + Math.random() * (rMax - rMin);
    ctx.fillStyle = colorFn();
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function crearTextura(id, dibujar, { repeat = [4, 4], size = 256 } = {}) {
  if (_cache.has(id)) return _cache.get(id);
  const { c, ctx } = lienzo(size);
  dibujar(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  _cache.set(id, tex);
  return tex;
}

/** Roca dura oscura, granulada e irregular. */
export const texturaRoca = () => crearTextura('roca', (ctx, s) => {
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(0, 0, s, s);
  manchas(ctx, s, 260, () => `rgba(${10 + Math.random() * 30 | 0},${10 + Math.random() * 30 | 0},${10 + Math.random() * 28 | 0},0.5)`, 2, 14);
  manchas(ctx, s, 120, () => `rgba(${70 + Math.random() * 40 | 0},${68 + Math.random() * 38 | 0},${62 + Math.random() * 34 | 0},0.35)`, 1, 6);
}, { repeat: [5, 5] });

/**
 * Roca de TÚNEL (caliza gris de mina, según el escaneo real): base gris clara con
 * grietas oscuras, salientes blancas, motas minerales/ocre y grano fino. Centrada en un gris
 * medio-alto para MODULAR (no oscurecer) el color por vértice del shell. 512px para detalle.
 */
export const texturaRocaTunel = () => crearTextura('rocaTunel', (ctx, s) => {
  ctx.fillStyle = '#a9a59d'; ctx.fillRect(0, 0, s, s);                                                       // base caliza
  manchas(ctx, s, 240, () => `rgba(${40 + Math.random() * 28 | 0},${38 + Math.random() * 26 | 0},${34 + Math.random() * 22 | 0},0.45)`, 3, 18); // grietas oscuras
  manchas(ctx, s, 190, () => `rgba(${196 + Math.random() * 45 | 0},${193 + Math.random() * 42 | 0},${186 + Math.random() * 40 | 0},0.42)`, 2, 13); // salientes claras
  manchas(ctx, s, 45,  () => `rgba(${150 + Math.random() * 40 | 0},${116 + Math.random() * 30 | 0},${74 + Math.random() * 28 | 0},0.28)`, 1, 6);  // ocre/mineral
  manchas(ctx, s, 500, () => `rgba(${120 + Math.random() * 80 | 0},${118 + Math.random() * 78 | 0},${112 + Math.random() * 72 | 0},0.18)`, 1, 3); // grano fino
}, { repeat: [3, 4], size: 512 });

/**
 * NORMAL MAP de la roca de túnel: se genera un campo de altura (huecos/salientes/grano) y se
 * derivan las normales por gradiente → la pared capta la luz del headlamp con relieve 3D real.
 * colorSpace lineal (NoColorSpace), como exige un normal map.
 */
export const texturaRocaTunelNormal = () => {
  if (_cache.has('rocaTunelN')) return _cache.get('rocaTunelN');
  const size = 512;
  // 1) Campo de altura en gris
  const { ctx: h } = lienzo(size);
  h.fillStyle = '#808080'; h.fillRect(0, 0, size, size);
  manchas(h, size, 320, () => `rgba(30,30,30,${0.12 + Math.random() * 0.22})`, 3, 22);   // huecos (bajos)
  manchas(h, size, 280, () => `rgba(220,220,220,${0.12 + Math.random() * 0.22})`, 2, 15); // salientes (altos)
  manchas(h, size, 600, () => `rgba(${Math.random() < 0.5 ? 60 : 200},${Math.random() < 0.5 ? 60 : 200},${Math.random() < 0.5 ? 60 : 200},0.16)`, 1, 3); // grano
  const src = h.getImageData(0, 0, size, size).data;
  // 2) Normales por gradiente central
  const { c: nc, ctx: nctx } = lienzo(size);
  const dst = nctx.createImageData(size, size);
  const H = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  const strength = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = H(x + 1, y) - H(x - 1, y);
      const dy = H(x, y + 1) - H(x, y - 1);
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      dst.data[i] = (nx * 0.5 + 0.5) * 255;
      dst.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      dst.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      dst.data[i + 3] = 255;
    }
  }
  nctx.putImageData(dst, 0, 0);
  const tex = new THREE.CanvasTexture(nc);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 4);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  _cache.set('rocaTunelN', tex);
  return tex;
};

/**
 * ROUGHNESS MAP de la roca de túnel: base CLARA (roca seca = mate) con ESCURRIMIENTOS
 * verticales y MANCHAS de humedad OSCURAS (rugosidad baja) → la pared BRILLA de humedad
 * donde corre/condensa el agua. En MeshStandardMaterial el canal verde del roughnessMap
 * MULTIPLICA `material.roughness`, así que oscuro = mojado/brillante, claro = seco/mate.
 * md: "wet glistening rock", "brillo húmedo en toda la roca", ambiente saturado (>90% HR).
 * colorSpace LINEAL (NoColorSpace), como todo dato no-color. Se cachea y comparte.
 * Mismo tiling (3×4) que el color/normal para que los tres mapas alineen.
 */
export const texturaRocaTunelRough = () => {
  if (_cache.has('rocaTunelRough')) return _cache.get('rocaTunelRough');
  const size = 512;
  const { c, ctx } = lienzo(size);
  // Base seca (clara = rugosa/mate)
  ctx.fillStyle = '#efeeea'; ctx.fillRect(0, 0, size, size);
  // Escurrimientos verticales de agua (elipses alargadas, húmedas = oscuras = brillantes)
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 3 + Math.random() * 11;
    const h = 55 + Math.random() * 250;
    const g = 55 + Math.random() * 75 | 0;          // 55..130 → roughness ~0.22..0.51
    ctx.fillStyle = `rgba(${g},${g},${g + 6 | 0},0.5)`;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Manchas de humedad/condensación irregulares repartidas
  manchas(ctx, size, 70, () => {
    const g = 70 + Math.random() * 80 | 0;
    return `rgba(${g},${g},${g + 4 | 0},0.4)`;
  }, 4, 26);
  // Pocas pozas muy brillantes: agua estancada en oquedades/repisas
  manchas(ctx, size, 14, () => `rgba(38,40,46,0.55)`, 2, 9);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 4);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  _cache.set('rocaTunelRough', tex);
  return tex;
};

/** Shotcrete: spray rugoso gris claro con motas. */
export const texturaShotcrete = () => crearTextura('shotcrete', (ctx, s) => {
  ctx.fillStyle = '#c8c8c0'; ctx.fillRect(0, 0, s, s);
  manchas(ctx, s, 500, () => `rgba(${150 + Math.random() * 60 | 0},${150 + Math.random() * 60 | 0},${145 + Math.random() * 55 | 0},0.5)`, 1, 4);
  manchas(ctx, s, 60, () => `rgba(120,118,110,0.25)`, 6, 22); // manchas de humedad
}, { repeat: [4, 4] });

/** Barro de piso (marron mojado mezclado con grava). */
export const texturaBarro = () => crearTextura('barro', (ctx, s) => {
  ctx.fillStyle = '#4a4036'; ctx.fillRect(0, 0, s, s);
  manchas(ctx, s, 300, () => `rgba(${40 + Math.random() * 30 | 0},${34 + Math.random() * 26 | 0},${26 + Math.random() * 20 | 0},0.6)`, 2, 12);
  manchas(ctx, s, 120, () => `rgba(${90 + Math.random() * 40 | 0},${82 + Math.random() * 36 | 0},${70 + Math.random() * 30 | 0},0.4)`, 1, 5); // grava clara
}, { repeat: [4, 8] });

/** Lodo espeso (marron mas oscuro y uniforme). */
export const texturaLodo = () => crearTextura('lodo', (ctx, s) => {
  ctx.fillStyle = '#332a20'; ctx.fillRect(0, 0, s, s);
  manchas(ctx, s, 200, () => `rgba(${30 + Math.random() * 24 | 0},${24 + Math.random() * 20 | 0},${16 + Math.random() * 16 | 0},0.6)`, 4, 20);
}, { repeat: [2, 2] });

/** Metal cepillado claro con rayones (para acero; tine con color del material). */
export const texturaMetal = () => crearTextura('metal', (ctx, s) => {
  ctx.fillStyle = '#cfcfcf'; ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(150,150,150,0.35)'; ctx.lineWidth = 1;
  for (let y = 0; y < s; y += 2) { ctx.beginPath(); ctx.moveTo(0, y + Math.random()); ctx.lineTo(s, y + Math.random()); ctx.stroke(); }
  manchas(ctx, s, 40, () => 'rgba(90,90,90,0.3)', 1, 5); // rayones/manchas
}, { repeat: [2, 2] });

/** Grunge claro con polvo y rayones (para equipos de color: tablero, manga, vehiculos). */
export const texturaGrunge = () => crearTextura('grunge', (ctx, s) => {
  ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, 0, s, s);
  manchas(ctx, s, 160, () => `rgba(${120 + Math.random() * 60 | 0},${110 + Math.random() * 60 | 0},${100 + Math.random() * 50 | 0},0.35)`, 2, 16); // polvo
  ctx.strokeStyle = 'rgba(70,60,50,0.25)';
  for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.moveTo(Math.random() * s, Math.random() * s); ctx.lineTo(Math.random() * s, Math.random() * s); ctx.stroke(); }
}, { repeat: [1, 1] });

/** Oxido naranja-cafe (para malla y piezas oxidadas). */
export const texturaOxido = () => crearTextura('oxido', (ctx, s) => {
  ctx.fillStyle = '#a0522d'; ctx.fillRect(0, 0, s, s);
  manchas(ctx, s, 220, () => `rgba(${120 + Math.random() * 50 | 0},${60 + Math.random() * 40 | 0},${20 + Math.random() * 30 | 0},0.5)`, 2, 12);
}, { repeat: [3, 3] });

/** Goma de neumatico (negro con surcos). */
export const texturaGoma = () => crearTextura('goma', (ctx, s) => {
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#2c2c2c';
  for (let x = 0; x < s; x += 18) ctx.fillRect(x, 0, 9, s); // banda de rodadura
}, { repeat: [3, 1] });
