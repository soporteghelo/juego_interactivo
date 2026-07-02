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
