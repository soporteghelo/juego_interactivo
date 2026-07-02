import * as THREE from 'three';
import { MineMaterials, PALETTE } from '../world/materials/MineMaterials.js';

/**
 * REFUGIO MINERO DRÄGER (cámara de rescate, capacidad 20 personas).
 *
 * Reconstrucción a partir de fotos reales (Dräger | SIMSA — NEXA / Cerro Lindo):
 *
 *  EXTERIOR ─ Contenedor de acero blanco sobre patín (skid), franjas reflectivas
 *  rojo/blanco en zócalo y esquinas, logo azul "Dräger" en el costado, cáncamos de
 *  izaje en las 4 esquinas superiores, rejilla de ventilación lateral, y en la cara
 *  frontal: puerta estanca con ojo de buey, manijas/volante, y columna semáforo
 *  rojo/ámbar/verde con placas de señalización. Ruedas/rodillos en la base.
 *
 *  INTERIOR ─ Anatomía según diagrama Dräger (5 zonas):
 *   1. PRECÁMARA (esclusa): área de transición tras la puerta exterior, separada de
 *      la cámara principal por un mamparo con segunda puerta estanca (ojo de buey).
 *   2. BPU "Dräger | SIMSA": unidad azul que purifica el aire — pantalla, paro de
 *      emergencia rojo y botón verde.
 *   3. BANCO DE BATERÍAS: estantería al fondo con cajas de baterías (energía
 *      ininterrumpida para iluminación y A/C).
 *   4. CILINDROS DE O2: blancos (correa naranja), azules Dräger junto a la BPU y
 *      negros de alta presión junto al mamparo de la esclusa.
 *   5. ASIENTOS Y ALMACENAMIENTO: bancas-cajón con cojín y respaldo acolchado.
 *   + Techo abovedado con LED lineal, split A/C, manómetros, tubería y señalética.
 *
 *  Convención de ejes LOCAL (antes de colocar en escena):
 *    +X = largo (frente/puerta en +X, BPU al fondo en -X)
 *    +Z = ancho (costado del logo Dräger en +Z)
 *     Y = altura
 *
 *  El descriptor de interacción queda en group.userData.interactable.
 */

export const meta = {
  id: 'refugio_draeger',
  nombre: 'Refugio minero Dräger (20 personas)',
  descripcion:
    'Cámara de rescate Dräger|SIMSA, cap. 20. Exterior con franjas reflectivas, ' +
    'semáforo y puerta estanca; interior con precámara (esclusa), BPU, banco de ' +
    'baterías, cilindros de O2, bancas con respaldo, A/C y señalética. Interactuable.'
};

// ════════════════════════════════════════════════════════════════════════
//  UTILIDADES DE TEXTURA (CanvasTexture)
// ════════════════════════════════════════════════════════════════════════

function _lienzo(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

function _aTextura(canvas, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeatX !== 1 || repeatY !== 1) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
  }
  return t;
}

/** Franjas diagonales NARANJA/blanco (cinta reflectiva, foto real). Se repite a lo largo. */
function _texturaRayas() {
  const { canvas, ctx } = _lienzo(128, 128);
  ctx.fillStyle = '#f2f2ee'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#e05a12';
  ctx.lineWidth = 0;
  // franjas a 45°
  for (let i = -128; i < 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 64, 0);
    ctx.lineTo(i + 64 - 128, 128);
    ctx.lineTo(i - 128, 128);
    ctx.closePath();
    ctx.fill();
  }
  return canvas;
}

/** Logo azul "Dräger" sobre fondo transparente. */
function _texturaLogo() {
  const { canvas, ctx } = _lienzo(512, 200);
  ctx.clearRect(0, 0, 512, 200);
  ctx.fillStyle = '#12307e';
  ctx.font = 'bold 150px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Dräger', 256, 108);
  return canvas;
}

/**
 * Rotulación de la puerta exterior (foto real): "REFUGIO MINERO" arriba,
 * flechas curvas amarillas de ingreso, "ENTRADA / ENTRY" y capacidad "20 + icono".
 * Deja libre la zona del ojo de buey y del volante (elementos 3D superpuestos).
 */
function _texturaPuerta() {
  const { canvas, ctx } = _lienzo(512, 1024);
  ctx.clearRect(0, 0, 512, 1024);
  // BORDE NEGRO REDONDEADO de la puerta (junta/sello, foto real)
  const r = 70, bx = 14, by = 14, bw = 512 - 28, bh = 1024 - 28;
  ctx.strokeStyle = '#1c1c1a';
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bw - r, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
  ctx.lineTo(bx + bw, by + bh - r);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
  ctx.lineTo(bx + r, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#20241f';
  ctx.textAlign = 'center';
  ctx.font = 'bold 46px Arial, sans-serif';
  ctx.fillText('REFUGIO', 256, 78);
  ctx.fillText('MINERO', 256, 128);
  // flecha curva NEGRA (↰) de ingreso, como la foto
  const flecha = (cx, cy, s) => {
    ctx.strokeStyle = '#1c1c1a';
    ctx.lineWidth = 15 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy + 62 * s);
    ctx.lineTo(cx, cy + 8 * s);
    ctx.quadraticCurveTo(cx, cy - 32 * s, cx - 42 * s, cy - 32 * s);
    ctx.stroke();
    ctx.fillStyle = '#1c1c1a';
    ctx.beginPath();
    ctx.moveTo(cx - 42 * s, cy - 58 * s);
    ctx.lineTo(cx - 42 * s, cy - 6 * s);
    ctx.lineTo(cx - 84 * s, cy - 32 * s);
    ctx.closePath();
    ctx.fill();
  };
  flecha(190, 470, 1.0);
  flecha(160, 830, 0.85);
  // ENTRADA / ENTRY
  ctx.fillStyle = '#20241f';
  ctx.font = 'bold 42px Arial, sans-serif';
  ctx.fillText('ENTRADA', 330, 442);
  ctx.font = '34px Arial, sans-serif';
  ctx.fillText('ENTRY', 330, 486);
  // 20 + icono persona
  ctx.font = 'bold 74px Arial, sans-serif';
  ctx.fillText('20', 300, 668);
  ctx.beginPath(); ctx.arc(392, 614, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(380, 634, 24, 42);
  return canvas;
}

/**
 * Rotulación de la cara INTERIOR de la puerta de salida (foto real):
 * borde negro redondeado, "SALIDA" arriba, "EXIT" bajo el ojo de buey,
 * flechas curvas negras y pictograma rojo de PROHIBIDO FUEGO.
 */
function _texturaPuertaSalida() {
  const { canvas, ctx } = _lienzo(512, 1024);
  ctx.clearRect(0, 0, 512, 1024);
  // borde negro redondeado (junta/sello)
  const r = 70, bx = 14, by = 14, bw = 512 - 28, bh = 1024 - 28;
  ctx.strokeStyle = '#1c1c1a';
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bw - r, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
  ctx.lineTo(bx + bw, by + bh - r);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
  ctx.lineTo(bx + r, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#1c1c1a';
  ctx.textAlign = 'center';
  ctx.font = 'bold 54px Arial, sans-serif';
  ctx.fillText('SALIDA', 256, 100);
  ctx.fillText('EXIT', 256, 420);
  // flechas curvas negras (↰)
  const flechaS = (cx, cy, s) => {
    ctx.strokeStyle = '#1c1c1a';
    ctx.lineWidth = 15 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy + 62 * s);
    ctx.lineTo(cx, cy + 8 * s);
    ctx.quadraticCurveTo(cx, cy - 32 * s, cx - 42 * s, cy - 32 * s);
    ctx.stroke();
    ctx.fillStyle = '#1c1c1a';
    ctx.beginPath();
    ctx.moveTo(cx - 42 * s, cy - 58 * s);
    ctx.lineTo(cx - 42 * s, cy - 6 * s);
    ctx.lineTo(cx - 84 * s, cy - 32 * s);
    ctx.closePath();
    ctx.fill();
  };
  flechaS(165, 490, 0.95);
  flechaS(165, 840, 0.95);
  // pictograma PROHIBIDO ENCENDER FUEGO (referencia real: llama negra +
  // fósforos, cruzados por la diagonal roja)
  const pcx = 290, pcy = 700, pr = 78;
  ctx.strokeStyle = '#b8202a';
  ctx.lineWidth = 13;
  ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI * 2); ctx.stroke();
  // llama negra estilizada (lado izquierdo-superior)
  ctx.fillStyle = '#1c1c1a';
  ctx.save();
  ctx.translate(pcx - 14, pcy - 12);
  ctx.beginPath();
  ctx.moveTo(0, 34);
  ctx.bezierCurveTo(-30, 16, -24, -18, -2, -42);   // costado izquierdo hasta la punta
  ctx.bezierCurveTo(-10, -20, 6, -22, 4, -6);      // lengüeta interior
  ctx.bezierCurveTo(24, -16, 30, 12, 0, 34);       // costado derecho
  ctx.fill();
  // chispa suelta sobre la punta
  ctx.beginPath(); ctx.ellipse(8, -48, 5, 9, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // fósforos (palitos hacia arriba-derecha, cabezas abajo-izquierda)
  ctx.save();
  ctx.translate(pcx - 8, pcy + 34);
  ctx.rotate(-0.62);
  ctx.fillStyle = '#1c1c1a';
  for (let i = 0; i < 3; i++) {
    const oy = i * 9 - 9;
    ctx.fillRect(0, oy - 2.5, 78, 5);                              // palito
    ctx.beginPath(); ctx.arc(-2, oy, 6.5, 0, Math.PI * 2); ctx.fill(); // cabeza
  }
  ctx.restore();
  // diagonal roja de prohibición (encima del dibujo)
  ctx.strokeStyle = '#b8202a';
  ctx.beginPath();
  ctx.moveTo(pcx - pr * 0.72, pcy - pr * 0.72);
  ctx.lineTo(pcx + pr * 0.72, pcy + pr * 0.72);
  ctx.stroke();
  return canvas;
}

/**
 * Póster de plano/mapa de mina a color (fotos reales: esquemas NEXA junto a
 * la puerta). Red de galerías en rojo/naranja/verde sobre fondo claro.
 */
function _texturaMapa(sem = 1) {
  const { canvas, ctx } = _lienzo(360, 270);
  ctx.fillStyle = '#f4f2ea'; ctx.fillRect(0, 0, 360, 270);
  ctx.fillStyle = '#12307e'; ctx.fillRect(0, 0, 360, 30);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 17px Arial, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(sem === 1 ? 'ESQUEMA DE RESCATE — NV-1600' : 'UBICACIÓN DE REFUGIOS', 180, 21);
  const cols = ['#c22222', '#e07000', '#1a8f3c', '#666660'];
  let s = sem * 7919;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = cols[i % 4];
    ctx.beginPath();
    const x0 = 20 + rnd() * 320, yy = 45 + rnd() * 200;
    ctx.moveTo(x0, yy);
    ctx.lineTo(x0 + (rnd() - 0.3) * 120, yy + (rnd() - 0.5) * 80);
    ctx.lineTo(x0 + (rnd() - 0.3) * 160, yy + (rnd() - 0.5) * 110);
    ctx.stroke();
  }
  // punto rojo: "USTED ESTÁ AQUÍ" (refugio)
  ctx.fillStyle = '#c22222';
  ctx.beginPath(); ctx.arc(200, 150, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c22222'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(200, 150, 14, 0, Math.PI * 2); ctx.stroke();
  return canvas;
}

/** Logo "Dräger | SIMSA — Breathing Protection Unit" para el frente de la BPU. */
function _texturaBPU() {
  const { canvas, ctx } = _lienzo(512, 160);
  ctx.clearRect(0, 0, 512, 160);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 60px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Dräger', 24, 58);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(240, 20); ctx.lineTo(240, 92); ctx.stroke();
  ctx.font = '44px Arial, sans-serif';
  ctx.fillText('SIMSA', 260, 56);
  ctx.font = '30px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('Breathing Protection Unit', 24, 122);
  return canvas;
}

/**
 * Cara del panel de control de la BPU (render Dräger): panel blanco con
 * indicadores verdes/rojos, dial y diagrama de flujo del sistema.
 */
function _texturaPanelBPU() {
  const { canvas, ctx } = _lienzo(360, 240);
  ctx.fillStyle = '#f2f2ec'; ctx.fillRect(0, 0, 360, 240);
  ctx.strokeStyle = '#9a9a92'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 352, 232);
  // título
  ctx.fillStyle = '#12307e'; ctx.font = 'bold 20px Arial, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Dräger', 16, 30);
  ctx.fillStyle = '#333'; ctx.font = '13px Arial, sans-serif';
  ctx.fillText('Breathing Protection Unit', 92, 30);
  // indicadores (2 filas de pilotos verdes/rojos/ámbar)
  const cols = ['#1db93c', '#1db93c', '#d21f1f', '#1db93c', '#d8a11a', '#1db93c'];
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = cols[i];
    ctx.beginPath();
    ctx.arc(36 + (i % 3) * 44, 78 + Math.floor(i / 3) * 44, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.stroke();
  }
  // diagrama de flujo (derecha)
  ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
  ctx.strokeRect(190, 56, 152, 156);
  ctx.beginPath(); ctx.arc(230, 108, 22, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(302, 162, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(252, 108); ctx.lineTo(302, 108); ctx.lineTo(302, 144); ctx.stroke();
  // dial inferior
  ctx.beginPath(); ctx.arc(80, 182, 26, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(80, 182); ctx.lineTo(96, 166); ctx.stroke();
  return canvas;
}

/** Placa de señalética gris con líneas de texto simuladas + título opcional. */
function _texturaPlaca(titulo, colorTitulo = '#1a1a1a') {
  const { canvas, ctx } = _lienzo(256, 340);
  ctx.fillStyle = '#dcdcd6'; ctx.fillRect(0, 0, 256, 340);
  ctx.strokeStyle = '#9a9a92'; ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 332);
  if (titulo) {
    ctx.fillStyle = colorTitulo;
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(titulo, 128, 34);
  }
  // renglones de "texto" simulados
  ctx.fillStyle = '#5a5a54';
  for (let y = 64; y < 320; y += 18) {
    const w = 200 - Math.floor(Math.random() * 70);
    ctx.fillRect(28, y, w, 6);
  }
  return canvas;
}

/** Flecha roja de evacuación (apunta hacia abajo). */
function _texturaFlecha() {
  const { canvas, ctx } = _lienzo(128, 200);
  ctx.clearRect(0, 0, 128, 200);
  ctx.fillStyle = '#d21f1f';
  ctx.beginPath();
  ctx.moveTo(48, 10); ctx.lineTo(80, 10); ctx.lineTo(80, 120);
  ctx.lineTo(112, 120); ctx.lineTo(64, 190); ctx.lineTo(16, 120);
  ctx.lineTo(48, 120); ctx.closePath();
  ctx.fill();
  return canvas;
}

// ════════════════════════════════════════════════════════════════════════
//  SUBCONJUNTOS
// ════════════════════════════════════════════════════════════════════════

/** Manómetro circular (dial blanco con aguja) montado sobre soporte. */
function _manometro(radio = 0.07) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(
    new THREE.CylinderGeometry(radio, radio, 0.03, 16),
    MineMaterials.plano(0x2a2a2a, { rough: 0.5, metal: 0.6 })
  );
  cuerpo.rotation.x = Math.PI / 2;
  g.add(cuerpo);
  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(radio * 0.86, 16),
    MineMaterials.plano(0xf4f4ee, { rough: 0.4 })
  );
  dial.position.z = 0.017;
  g.add(dial);
  const aguja = new THREE.Mesh(
    new THREE.BoxGeometry(radio * 0.7, 0.006, 0.003),
    MineMaterials.plano(0xcc1111, { rough: 0.4 })
  );
  aguja.position.set(radio * 0.2, radio * 0.15, 0.02);
  aguja.rotation.z = 0.9;
  g.add(aguja);
  return g;
}

/**
 * Cilindro de O2 con ojiva, cuello y válvula.
 * Colores por defecto: cuerpo blanco + ojiva verde (O2 medicinal). Parametrizable
 * para las variantes del diagrama Dräger: negros (alta presión) y azules (BPU).
 */
function _cilindroO2(alto = 1.15, radio = 0.115, { cuerpo: cCuerpo = 0xf1f1ec, ojiva: cOjiva = 0x2a9d4a, metal = 0.25 } = {}) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(
    new THREE.CylinderGeometry(radio, radio, alto, 20),
    MineMaterials.plano(cCuerpo, { rough: 0.45, metal })
  );
  cuerpo.position.y = alto / 2;
  cuerpo.castShadow = true;
  g.add(cuerpo);
  // ojiva (hombro)
  const ojiva = new THREE.Mesh(
    new THREE.SphereGeometry(radio, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    MineMaterials.plano(cOjiva, { rough: 0.5, metal: metal * 0.8 })
  );
  ojiva.position.y = alto;
  g.add(ojiva);
  // cuello + válvula
  const cuello = new THREE.Mesh(
    new THREE.CylinderGeometry(radio * 0.28, radio * 0.28, 0.09, 10),
    MineMaterials.plano(0x8a8a8a, { rough: 0.4, metal: 0.7 })
  );
  cuello.position.y = alto + radio * 0.55;
  g.add(cuello);
  const valvula = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.05, 0.13),
    MineMaterials.plano(0xb08d3a, { rough: 0.4, metal: 0.7 })
  );
  valvula.position.y = alto + radio * 0.55 + 0.05;
  g.add(valvula);
  return g;
}

/** Banca lateral: cajón blanco (almacenamiento) + cojín gris envuelto. */
function _banca(largo, prof = 0.42, alto = 0.44) {
  const g = new THREE.Group();
  const cajon = new THREE.Mesh(
    new THREE.BoxGeometry(largo, alto, prof),
    MineMaterials.plano(0xeceae2, { rough: 0.6, metal: 0.15 })
  );
  cajon.position.y = alto / 2;
  cajon.castShadow = true;
  g.add(cajon);
  const cojin = new THREE.Mesh(
    new THREE.BoxGeometry(largo - 0.04, 0.09, prof - 0.02),
    MineMaterials.plano(0x63625c, { rough: 0.35, metal: 0.05 }) // gris con leve brillo (envoltura)
  );
  cojin.position.y = alto + 0.045;
  g.add(cojin);
  return g;
}

// ════════════════════════════════════════════════════════════════════════
//  REFUGIO
// ════════════════════════════════════════════════════════════════════════

/**
 * @param {{ ocupado?:boolean, numero?:number }} opts
 * @returns {THREE.Group}
 */
export function crear({ ocupado = false, numero = 2 } = {}) {
  const g = new THREE.Group();
  g.name = 'refugio_draeger';

  // ── Dimensiones del contenedor ───────────────────────────────────
  const L = 6.0;   // largo (X)
  const A = 2.94;  // ancho (Z) — ampliado +20% (pedido de diseño)
  const H = 2.45;  // alto de paredes (Y)
  const t = 0.06;  // espesor de panel
  const hSkid = 0.18; // altura del patín/skid

  // Materiales
  // Casco exterior verde pálido/crema (foto real en mina: Dräger N°2 Cerro Lindo)
  const mAcero   = MineMaterials.plano(0xd9dfc9, { rough: 0.5, metal: 0.4 });
  const mAceroIn = MineMaterials.plano(0xf3f2ec, { rough: 0.7, metal: 0.15 }); // interior mate
  const mMarco   = MineMaterials.plano(0x9a9a96, { rough: 0.5, metal: 0.6 });
  const mBPU     = MineMaterials.plano(0x1559ad, { rough: 0.45, metal: 0.35 }); // azul Dräger
  const mNegro   = MineMaterials.plano(0x1a1a1a, { rough: 0.6, metal: 0.3 });
  const mCromo   = MineMaterials.plano(0xb8b8b8, { rough: 0.3, metal: 0.85 });

  const y0 = hSkid; // piso interior arranca sobre el patín

  // ════════════════════════════════════════════════════════════════
  //  PATÍN / SKID + RUEDAS
  // ════════════════════════════════════════════════════════════════
  const skid = new THREE.Mesh(new THREE.BoxGeometry(L + 0.1, hSkid, A + 0.1), mMarco);
  skid.position.y = hSkid / 2;
  skid.castShadow = true;
  g.add(skid);

  // largueros longitudinales
  for (const sz of [-1, 1]) {
    const larguero = new THREE.Mesh(new THREE.BoxGeometry(L + 0.2, 0.1, 0.12), mMarco);
    larguero.position.set(0, hSkid * 0.5, sz * (A / 2 - 0.02));
    g.add(larguero);
  }
  // rodillos/ruedas en las 4 esquinas
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const rueda = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.1, 12),
      MineMaterials.plano(0x2b2b2b, { rough: 0.7, metal: 0.2 })
    );
    rueda.rotation.x = Math.PI / 2;
    rueda.position.set(sx * (L / 2 - 0.2), 0.09, sz * (A / 2 - 0.05));
    g.add(rueda);
  }

  // ════════════════════════════════════════════════════════════════
  //  CASCO EXTERIOR (paredes, piso, techo abovedado)
  // ════════════════════════════════════════════════════════════════
  // Piso
  const piso = new THREE.Mesh(new THREE.BoxGeometry(L, t, A), MineMaterials.plano(0x8f8a80, { rough: 0.95 }));
  piso.position.set(0, y0 + t / 2, 0);
  piso.receiveShadow = true;
  g.add(piso);

  // Pared trasera (-X, fondo donde va la BPU)
  const parTras = new THREE.Mesh(new THREE.BoxGeometry(t, H, A), mAcero);
  parTras.position.set(-L / 2, y0 + H / 2, 0);
  parTras.castShadow = true;
  g.add(parTras);
  // cara interior
  const parTrasIn = new THREE.Mesh(new THREE.PlaneGeometry(A, H), mAceroIn);
  parTrasIn.position.set(-L / 2 + t / 2 + 0.001, y0 + H / 2, 0);
  parTrasIn.rotation.y = Math.PI / 2;
  g.add(parTrasIn);

  // Paredes laterales (±Z)
  for (const sz of [-1, 1]) {
    const lat = new THREE.Mesh(new THREE.BoxGeometry(L, H, t), mAcero);
    lat.position.set(0, y0 + H / 2, sz * (A / 2));
    lat.castShadow = true;
    g.add(lat);
    // corrugado/paneles: líneas verticales sutiles
    for (let i = 1; i < 8; i++) {
      const ranura = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, H - 0.1, 0.008),
        MineMaterials.plano(0xcfcfca, { rough: 0.6, metal: 0.3 })
      );
      ranura.position.set(-L / 2 + (i * L) / 8, y0 + H / 2, sz * (A / 2 + t / 2 + 0.004));
      g.add(ranura);
    }
    // cara interior
    const latIn = new THREE.Mesh(new THREE.PlaneGeometry(L, H), mAceroIn);
    latIn.position.set(0, y0 + H / 2, sz * (A / 2 - t / 2 - 0.001));
    latIn.rotation.y = sz > 0 ? Math.PI : 0;
    g.add(latIn);
  }

  // Techo con ARCO SUTIL (foto real: flecha ~0.28 m, NO medio círculo).
  // Se usa un cilindro de radio grande y ángulo pequeño centrado en el ápice.
  const sArco = 0.28;                                        // flecha (altura del arco)
  const wArco = A / 2 + 0.05;                                // semi-ancho
  const rArco = (wArco * wArco + sArco * sArco) / (2 * sArco); // radio del arco
  const thArco = Math.asin(wArco / rArco);                   // semi-ángulo
  const cyArco = y0 + H - 0.02 - rArco * Math.cos(thArco);   // centro del círculo
  const arco = new THREE.Mesh(
    new THREE.CylinderGeometry(rArco, rArco, L, 24, 1, true, Math.PI / 2 - thArco, 2 * thArco),
    mAcero
  );
  arco.rotation.z = Math.PI / 2;
  arco.position.set(0, cyArco, 0);
  arco.castShadow = true;
  g.add(arco);
  // cara interior del arco (clara)
  const arcoIn = new THREE.Mesh(
    new THREE.CylinderGeometry(rArco - 0.03, rArco - 0.03, L - 0.02, 24, 1, true, Math.PI / 2 - thArco, 2 * thArco),
    new THREE.MeshStandardMaterial({ color: 0xf4f3ed, roughness: 0.85, metalness: 0.1, side: THREE.BackSide })
  );
  arcoIn.rotation.z = Math.PI / 2;
  arcoIn.position.set(0, cyArco + 0.03, 0);
  g.add(arcoIn);
  // tapas de creciente en los extremos (cierran el arco contra las paredes)
  const capShape = new THREE.Shape();
  capShape.absarc(0, -rArco * Math.cos(thArco), rArco, Math.PI / 2 - thArco, Math.PI / 2 + thArco, false);
  capShape.closePath();
  const capGeo = new THREE.ShapeGeometry(capShape, 16);
  const mCap = MineMaterials.plano(0xd9dfc9, { rough: 0.5, metal: 0.4 });
  mCap.side = THREE.DoubleSide;
  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(capGeo, mCap);
    cap.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    cap.position.set(sx * (L / 2 - 0.005), y0 + H - 0.02, 0);
    g.add(cap);
  }

  // ── Cáncamos de izaje (4 esquinas superiores) ────────────────────
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const anillo = new THREE.Mesh(
      new THREE.TorusGeometry(0.07, 0.018, 8, 14),
      mMarco
    );
    anillo.position.set(sx * (L / 2 - 0.35), y0 + H + 0.12, sz * (A / 2 - 0.2));
    g.add(anillo);
  }

  // ── Rejilla de ventilación lateral (costado -Z, cerca del frente) ─
  const rejilla = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.4, 0.03),
    MineMaterials.plano(0xbdbdb8, { rough: 0.6, metal: 0.5 })
  );
  rejilla.position.set(L / 2 - 1.1, y0 + H - 0.55, -(A / 2 + t / 2 + 0.01));
  g.add(rejilla);
  for (let i = 0; i < 6; i++) {
    const lama = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.03, 0.04),
      MineMaterials.plano(0x77776f, { rough: 0.6, metal: 0.5 })
    );
    lama.position.set(L / 2 - 1.1, y0 + H - 0.72 + i * 0.06, -(A / 2 + t / 2 + 0.02));
    g.add(lama);
  }

  // ════════════════════════════════════════════════════════════════
  //  FRANJAS REFLECTIVAS ROJO/BLANCO (zócalo + esquinas)
  // ════════════════════════════════════════════════════════════════
  const matRayasZ = new THREE.MeshStandardMaterial({ map: _aTextura(_texturaRayas(), L / 0.5, 1), roughness: 0.4, metalness: 0.2 });
  const matRayasX = new THREE.MeshStandardMaterial({ map: _aTextura(_texturaRayas(), A / 0.5, 1), roughness: 0.4, metalness: 0.2 });
  const matRayasV = new THREE.MeshStandardMaterial({ map: _aTextura(_texturaRayas(), 1, 4), roughness: 0.4, metalness: 0.2 });
  const zocaloH = 0.22;
  // zócalos longitudinales
  for (const sz of [-1, 1]) {
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(L, zocaloH), matRayasZ);
    fr.position.set(0, y0 + zocaloH / 2 + 0.02, sz * (A / 2 + t / 2 + 0.006));
    fr.rotation.y = sz > 0 ? 0 : Math.PI;
    g.add(fr);
  }
  // zócalo frontal (bajo la puerta, a los lados)
  const frFrente = new THREE.Mesh(new THREE.PlaneGeometry(A, zocaloH), matRayasX);
  frFrente.position.set(L / 2 + t / 2 + 0.006, y0 + zocaloH / 2 + 0.02, 0);
  frFrente.rotation.y = Math.PI / 2;
  g.add(frFrente);
  // franjas verticales en las 4 esquinas frontales/traseras
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const fv = new THREE.Mesh(new THREE.PlaneGeometry(0.16, H - 0.1), matRayasV);
    fv.position.set(sx * (L / 2 + t / 2 + 0.006), y0 + (H - 0.1) / 2 + 0.05, sz * (A / 2 - 0.12));
    fv.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(fv);
  }

  // ── Logo "Dräger" en el costado +Z ───────────────────────────────
  const logoMat = new THREE.MeshStandardMaterial({ map: _aTextura(_texturaLogo()), transparent: true, roughness: 0.5, metalness: 0.1 });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.5), logoMat);
  logo.position.set(0.6, y0 + H - 0.7, A / 2 + t / 2 + 0.006);
  g.add(logo);

  // ════════════════════════════════════════════════════════════════
  //  FRENTE: PUERTA ESTANCA + SEMÁFORO + PLACAS
  // ════════════════════════════════════════════════════════════════
  const xF = L / 2;   // plano frontal
  // Pared frontal con hueco de puerta: la construimos con 3 paneles (izq, der, dintel)
  const puertaW = 0.95, puertaH = 1.95;
  const doorZ = 0; // puerta CENTRADA en el ancho (igual que la puerta interna)
  const izqW = A / 2 + doorZ - puertaW / 2; // panel entre esquina -Z y puerta
  const derW = A / 2 - doorZ - puertaW / 2; // panel entre puerta y esquina +Z
  // panel lado -Z
  const pFrenteA = new THREE.Mesh(new THREE.BoxGeometry(t, H, izqW), mAcero);
  pFrenteA.position.set(xF, y0 + H / 2, -A / 2 + izqW / 2);
  g.add(pFrenteA);
  // panel lado +Z (aquí va el semáforo)
  const pFrenteB = new THREE.Mesh(new THREE.BoxGeometry(t, H, derW), mAcero);
  pFrenteB.position.set(xF, y0 + H / 2, A / 2 - derW / 2);
  g.add(pFrenteB);
  // dintel sobre la puerta
  const dintel = new THREE.Mesh(new THREE.BoxGeometry(t, H - puertaH, puertaW), mAcero);
  dintel.position.set(xF, y0 + puertaH + (H - puertaH) / 2, doorZ);
  g.add(dintel);

  // Marco de puerta NEGRO (junta/sello redondeado de la foto)
  const marco = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, puertaH + 0.12, puertaW + 0.12),
    MineMaterials.plano(0x1f1f1c, { rough: 0.6, metal: 0.3 })
  );
  marco.position.set(xF + 0.01, y0 + puertaH / 2, doorZ);
  g.add(marco);

  // Puerta con bisagras en +Z (izquierda del observador, como la foto) — pivote
  const puertaPivote = new THREE.Group();
  puertaPivote.position.set(xF + 0.03, y0, doorZ + puertaW / 2);
  g.add(puertaPivote);
  const hoja = new THREE.Mesh(new THREE.BoxGeometry(0.07, puertaH, puertaW), mAceroIn);
  hoja.position.set(0, puertaH / 2, -puertaW / 2);
  hoja.castShadow = true;
  puertaPivote.add(hoja);
  // rotulación de la puerta (borde negro redondeado / REFUGIO MINERO / flechas / 20)
  const rotulo = new THREE.Mesh(
    new THREE.PlaneGeometry(puertaW - 0.06, puertaH - 0.06),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPuerta()), transparent: true, roughness: 0.6 })
  );
  rotulo.rotation.y = Math.PI / 2;
  rotulo.position.set(0.037, puertaH / 2, -puertaW / 2);
  puertaPivote.add(rotulo);
  // ojo de buey (porthole)
  const anilloVentana = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 10, 20), mMarco);
  anilloVentana.rotation.y = Math.PI / 2;
  anilloVentana.position.set(0.04, puertaH - 0.5, -puertaW / 2);
  puertaPivote.add(anilloVentana);
  const vidrio = new THREE.Mesh(
    new THREE.CircleGeometry(0.15, 20),
    new THREE.MeshStandardMaterial({ color: 0x0c1a22, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.75 })
  );
  vidrio.rotation.y = -Math.PI / 2;
  vidrio.position.set(0.045, puertaH - 0.5, -puertaW / 2);
  puertaPivote.add(vidrio);
  // 3 BISAGRAS en el canto de pivote (foto: lado izquierdo)
  for (const hy of [0.32, 0.98, 1.62]) {
    const bisagra = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.1), mAceroIn);
    bisagra.position.set(0.05, hy, -0.02);
    puertaPivote.add(bisagra);
  }
  // 2 PALANCAS largas de apertura con pomo (foto: cruzan el borde derecho)
  for (const hy of [puertaH - 0.68, puertaH - 1.42]) {
    const brazo = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 8), mCromo);
    brazo.rotation.x = Math.PI / 2; // a lo largo de Z
    brazo.position.set(0.075, hy, -puertaW + 0.1);
    puertaPivote.add(brazo);
    const pomo = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mCromo);
    pomo.position.set(0.075, hy, -puertaW + 0.1 - 0.31);
    puertaPivote.add(pomo);
    // eje/soporte de la palanca sobre la hoja
    const eje = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), mCromo);
    eje.rotation.z = Math.PI / 2;
    eje.position.set(0.05, hy, -puertaW + 0.22);
    puertaPivote.add(eje);
  }

  // ── PANEL DE LUCES 2×2 (foto real: ámbar/rojo arriba, verde abajo) ─
  const panelLuz = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.56, 0.52),
    MineMaterials.plano(0xd6d3c4, { rough: 0.55, metal: 0.25 })
  );
  panelLuz.position.set(xF + t / 2 + 0.03, y0 + H - 0.6, A / 2 - 0.38);
  g.add(panelLuz);
  const lamparas = {};
  // Fila superior: ROJA a la izquierda del observador (+Z) y ÁMBAR/naranja
  // a la derecha (-Z); abajo verde + bisel de reserva.
  const defsLuz = [
    { id: 'rojo',    color: 0xcc1111, on: ocupado,  dy:  0.13, dz:  0.115 },
    { id: 'ambar',   color: 0xe08a00, on: true,     dy:  0.13, dz: -0.115 },
    { id: 'verde',   color: 0x28c838, on: !ocupado, dy: -0.13, dz:  0.115 },
    { id: 'reserva', color: 0x2a2a26, on: false,    dy: -0.13, dz: -0.115 }, // bisel vacío
  ];
  for (const d of defsLuz) {
    // bisel negro
    const bisel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.05, 16),
      MineMaterials.plano(0x1d1d1a, { rough: 0.5, metal: 0.4 })
    );
    bisel.rotation.z = Math.PI / 2;
    bisel.position.set(xF + t / 2 + 0.06, y0 + H - 0.6 + d.dy, A / 2 - 0.38 + d.dz);
    g.add(bisel);
    if (d.id === 'reserva') continue;
    const foco = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 10),
      MineMaterials.plano(d.on ? d.color : 0x201f1c, { emissive: d.color, emissiveIntensity: d.on ? 3.2 : 0 })
    );
    foco.position.set(xF + t / 2 + 0.09, y0 + H - 0.6 + d.dy, A / 2 - 0.38 + d.dz);
    g.add(foco);
    lamparas[d.id] = foco;
  }
  // luz puntual verde/roja de estado (halo/bloom)
  const luzEstado = new THREE.PointLight(ocupado ? 0xff2200 : 0x33ff44, 2.2, 3.5, 2);
  luzEstado.position.set(xF + 0.2, y0 + H - 0.6, A / 2 - 0.38);
  g.add(luzEstado);

  // ── Placas de señalética junto a la puerta (panel izquierdo) ─────
  const placaMat = new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPlaca(`REFUGIO N°${numero}`, '#12307e')), roughness: 0.6 });
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.45), placaMat);
  placa.position.set(xF + t / 2 + 0.02, y0 + H - 0.45, -A / 2 + izqW * 0.5);
  placa.rotation.y = Math.PI / 2;
  g.add(placa);
  const placa2 = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.4),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPlaca('INSTRUCCIONES')), roughness: 0.6 })
  );
  placa2.position.set(xF + t / 2 + 0.02, y0 + H - 1.05, -A / 2 + izqW * 0.5);
  placa2.rotation.y = Math.PI / 2;
  g.add(placa2);

  // ── Porta-documentos bajo las luces (marco metálico + hoja, foto) ─
  const cajaDoc = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.4, 0.32),
    MineMaterials.plano(0x8f8d82, { rough: 0.55, metal: 0.35 })
  );
  cajaDoc.position.set(xF + t / 2 + 0.03, y0 + H - 1.2, A / 2 - 0.38);
  g.add(cajaDoc);
  const docPlano = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.32),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPlaca('EMERGENCIA', '#c01818')), roughness: 0.8 })
  );
  docPlano.rotation.y = Math.PI / 2;
  docPlano.position.set(xF + t / 2 + 0.065, y0 + H - 1.2, A / 2 - 0.38);
  g.add(docPlano);

  // ── Extintor rojo montado en el frente (foto real, lado derecho) ─
  const extFrente = new THREE.Group();
  extFrente.position.set(xF + 0.11, y0, A / 2 - 0.72);
  g.add(extFrente);
  const extCuerpo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.46, 12),
    MineMaterials.plano(0xc41414, { rough: 0.45, metal: 0.25 })
  );
  extCuerpo.position.y = 0.72;
  extCuerpo.castShadow = true;
  extFrente.add(extCuerpo);
  const extCuello = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.07, 8),
    mCromo
  );
  extCuello.position.y = 0.985;
  extFrente.add(extCuello);
  const extManija = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.03, 0.02),
    MineMaterials.plano(0x1a1a1a, { rough: 0.5, metal: 0.4 })
  );
  extManija.position.y = 1.03;
  extFrente.add(extManija);
  // soporte al casco
  const extSoporte = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.05, 0.04),
    mMarco
  );
  extSoporte.position.set(-0.06, 0.85, 0);
  extFrente.add(extSoporte);

  // ── Logo "Dräger" también en el frente (zócalo, foto real) ───────
  const logoFrente = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.23),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaLogo()), transparent: true, roughness: 0.5, metalness: 0.1 })
  );
  logoFrente.rotation.y = Math.PI / 2;
  logoFrente.position.set(xF + t / 2 + 0.008, y0 + 0.42, -(A / 2 - 0.72));
  g.add(logoFrente);

  // ════════════════════════════════════════════════════════════════
  //  1. PRECÁMARA (ESCLUSA) — área de transición contra gases tóxicos
  // ════════════════════════════════════════════════════════════════
  // Mamparo interior a ~1.05 m de la puerta exterior, con segunda puerta
  // estanca (ojo de buey + volante), alineada con la exterior.
  const xBulk = L / 2 - 1.05;
  const mMamparo = MineMaterials.plano(0xeeede6, { rough: 0.65, metal: 0.2 });

  // panel lado -Z, panel lado +Z y dintel (mismo despiece que el frente)
  const mamA = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, izqW), mMamparo);
  mamA.position.set(xBulk, y0 + H / 2, -A / 2 + izqW / 2);
  g.add(mamA);
  const mamB = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, derW), mMamparo);
  mamB.position.set(xBulk, y0 + H / 2, A / 2 - derW / 2);
  g.add(mamB);
  const mamDintel = new THREE.Mesh(new THREE.BoxGeometry(0.05, H - puertaH, puertaW), mMamparo);
  mamDintel.position.set(xBulk, y0 + puertaH + (H - puertaH) / 2, doorZ);
  g.add(mamDintel);
  // tapa del hueco de la bóveda sobre el mamparo
  const mamTapa = new THREE.Mesh(new THREE.BoxGeometry(0.05, sArco + 0.12, A), mMamparo);
  mamTapa.position.set(xBulk, y0 + H + (sArco + 0.12) / 2 - 0.02, 0);
  g.add(mamTapa);

  // marco + puerta interior estanca (pivote en -Z, como la exterior)
  const marcoInt = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, puertaH + 0.12, puertaW + 0.12), mMarco
  );
  marcoInt.position.set(xBulk - 0.01, y0 + puertaH / 2, doorZ);
  g.add(marcoInt);
  const puertaIntPivote = new THREE.Group();
  puertaIntPivote.position.set(xBulk - 0.04, y0, doorZ + puertaW / 2);
  g.add(puertaIntPivote);
  const hojaInt = new THREE.Mesh(new THREE.BoxGeometry(0.06, puertaH, puertaW), mAceroIn);
  hojaInt.position.set(0, puertaH / 2, -puertaW / 2);
  hojaInt.castShadow = true;
  puertaIntPivote.add(hojaInt);
  // rotulación "SALIDA / EXIT" en la cara que mira a la cámara principal
  const rotuloSalida = new THREE.Mesh(
    new THREE.PlaneGeometry(puertaW - 0.06, puertaH - 0.06),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPuertaSalida()), transparent: true, roughness: 0.6 })
  );
  rotuloSalida.rotation.y = -Math.PI / 2;
  rotuloSalida.position.set(-0.032, puertaH / 2, -puertaW / 2);
  puertaIntPivote.add(rotuloSalida);
  const anilloInt = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.028, 10, 20), mMarco);
  anilloInt.rotation.y = Math.PI / 2;
  anilloInt.position.set(-0.035, puertaH - 0.5, -puertaW / 2);
  puertaIntPivote.add(anilloInt);
  // pernos del ojo de buey (foto real)
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const perno = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), mCromo);
    perno.position.set(-0.038, puertaH - 0.5 + Math.sin(ang) * 0.185, -puertaW / 2 + Math.cos(ang) * 0.185);
    puertaIntPivote.add(perno);
  }
  // vidrio con luz cálida de la precámara detrás (foto: brillo dorado)
  const vidrioInt = new THREE.Mesh(
    new THREE.CircleGeometry(0.14, 20),
    new THREE.MeshStandardMaterial({
      color: 0xd8c070, emissive: 0xc8a84a, emissiveIntensity: 1.4,
      roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92, side: THREE.DoubleSide
    })
  );
  vidrioInt.rotation.y = Math.PI / 2;
  vidrioInt.position.set(-0.04, puertaH - 0.5, -puertaW / 2);
  puertaIntPivote.add(vidrioInt);
  const volanteInt = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.018, 8, 18), mCromo);
  volanteInt.rotation.y = Math.PI / 2;
  volanteInt.position.set(-0.045, puertaH - 1.05, -puertaW / 2);
  puertaIntPivote.add(volanteInt);
  // 3 bisagras en el canto de pivote (foto: bloques crema)
  for (const hy of [0.32, 0.98, 1.62]) {
    const bisInt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.09), mAceroIn);
    bisInt.position.set(-0.045, hy, -0.015);
    puertaIntPivote.add(bisInt);
  }
  // ── Lámparas DORADAS de emergencia flanqueando la puerta (foto) ───
  for (const szL of [-1, 1]) {
    const lampara = new THREE.Group();
    lampara.position.set(xBulk - 0.1, y0 + H - 0.38, doorZ + szL * 0.78);
    lampara.rotation.z = 0.5; // inclinadas hacia la cámara
    g.add(lampara);
    const cuerpoLamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.17, 10),
      MineMaterials.plano(0xb08a2a, { rough: 0.35, metal: 0.7 })
    );
    lampara.add(cuerpoLamp);
    const focoLamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 6),
      MineMaterials.plano(0xffe9b0, { rough: 0.3, emissive: 0xffcc55, emissiveIntensity: 1.6 })
    );
    focoLamp.position.y = -0.1;
    lampara.add(focoLamp);
  }
  // etiquetas blancas pequeñas sobre el dintel (foto: "VÁLVULA DE SOBREPRESIÓN")
  for (const szE of [-1, 1]) {
    const etiq = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.07),
      MineMaterials.plano(0xf4f4ee, { rough: 0.8 })
    );
    etiq.rotation.y = -Math.PI / 2;
    etiq.position.set(xBulk - 0.045, y0 + H - 0.22, doorZ + szE * 0.72);
    g.add(etiq);
  }

  // piso de rejilla antideslizante de la esclusa + placa "PRECÁMARA"
  const grating = new THREE.Mesh(
    new THREE.BoxGeometry(L / 2 - xBulk - 0.1, 0.02, A - 0.16),
    MineMaterials.plano(0x6f6e66, { rough: 0.9, metal: 0.3 })
  );
  grating.position.set((xBulk + L / 2) / 2, y0 + t + 0.011, 0);
  g.add(grating);
  const placaPre = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.4),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPlaca('PRECÁMARA', '#12307e')), roughness: 0.7 })
  );
  placaPre.position.set(xBulk + 0.03, y0 + H - 0.55, A / 2 - derW * 0.5);
  placaPre.rotation.y = Math.PI / 2;
  g.add(placaPre);

  // ════════════════════════════════════════════════════════════════
  //  INTERIOR — cámara principal
  // ════════════════════════════════════════════════════════════════
  // ── Luminaria LED lineal en el vértice de la bóveda ──────────────
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.05, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.4, roughness: 0.3 })
  );
  led.position.set(-0.5, y0 + H + 0.12, 0);
  g.add(led);
  // LED corto de la precámara
  const ledPre = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.05, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.3 })
  );
  ledPre.position.set((xBulk + L / 2) / 2, y0 + H + 0.12, 0);
  g.add(ledPre);
  const luzInt1 = new THREE.PointLight(0xf0f4ff, 6, 6, 2);
  luzInt1.position.set(1.0, y0 + H, 0);
  g.add(luzInt1);
  const luzInt2 = new THREE.PointLight(0xf0f4ff, 6, 6, 2);
  luzInt2.position.set(-1.4, y0 + H, 0);
  g.add(luzInt2);
  const luzPre = new THREE.PointLight(0xf0f4ff, 3, 3.5, 2);
  luzPre.position.set((xBulk + L / 2) / 2, y0 + H - 0.1, 0);
  g.add(luzPre);

  // ════════════════════════════════════════════════════════════════
  //  5. ASIENTOS Y ALMACENAMIENTO — bancas-cajón con cojín y respaldo
  // ════════════════════════════════════════════════════════════════
  // Bancas ampliadas HASTA EL FONDO: la +Z llega a la pared trasera; la -Z
  // deja el hueco de los balones de O2 blancos (grupo 2×2 junto a la BPU)
  const bancas = [
    { sz:  1, largo: 4.55, cx: -0.625 },
    { sz: -1, largo: 3.35, cx:  0.0 },
  ];
  for (const { sz, largo, cx } of bancas) {
    const banca = _banca(largo, 0.42, 0.44);
    banca.position.set(cx, y0 + t, sz * (A / 2 - 0.24));
    g.add(banca);
    // respaldo acolchado sobre la pared (fotos reales: rollo gris envuelto)
    const respaldo = new THREE.Mesh(
      new THREE.BoxGeometry(largo - 0.06, 0.30, 0.07),
      MineMaterials.plano(0x6b6a64, { rough: 0.4, metal: 0.05 })
    );
    respaldo.position.set(cx, y0 + 0.84, sz * (A / 2 - t - 0.055));
    g.add(respaldo);
  }
  // raciones de supervivencia / botiquín bajo el asiento (cajas visibles)
  for (let i = 0; i < 3; i++) {
    const caja = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.16, 0.06),
      MineMaterials.plano(i === 1 ? 0xc23030 : 0x3563b0, { rough: 0.7 }) // roja = botiquín
    );
    // apoyadas contra la cara frontal de la banca (+Z)
    caja.position.set(-1.2 + i * 1.0, y0 + t + 0.08, (A / 2 - 0.24) - 0.21 - 0.031);
    g.add(caja);
  }

  // ── Piso interior de triplay (madera clara, fotos reales) ─────────
  const pisoInt = new THREE.Mesh(
    new THREE.BoxGeometry(xBulk + L / 2 - 2 * t, 0.012, A - 2 * t),
    MineMaterials.plano(0x8a7358, { rough: 0.95 })
  );
  pisoInt.position.set((xBulk - L / 2) / 2, y0 + t + 0.007, 0);
  g.add(pisoInt);

  // ── Costillas verticales de los paneles de pared (fotos reales) ───
  const mCostilla = MineMaterials.plano(0xf0efe8, { rough: 0.55, metal: 0.15 });
  for (const szr of [-1, 1]) {
    for (const rx of [-2.45, -1.75, -0.85, 0.55, 1.75]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.07, H - 0.75, 0.04), mCostilla);
      rib.position.set(rx, y0 + 0.5 + (H - 0.75) / 2, szr * (A / 2 - t - 0.021));
      g.add(rib);
    }
  }

  // ── Sensor/cámara negro colgado del techo (foto 2, junto al LED) ──
  const sensorTecho = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.12, 0.09),
    MineMaterials.plano(0x15151a, { rough: 0.4, metal: 0.3 })
  );
  sensorTecho.position.set(-1.0, y0 + H + 0.1, 0);
  g.add(sensorTecho);
  const lente = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 8, 6),
    MineMaterials.plano(0x0a0a10, { rough: 0.2, metal: 0.5 })
  );
  lente.position.set(-1.0, y0 + H + 0.03, 0);
  g.add(lente);

  // ── Unidad de Protección Respiratoria (BPU) "Dräger | SIMSA" ──────
  const bpu = new THREE.Group();
  bpu.position.set(-L / 2 + 0.55, y0 + t, 0); // contra el fondo (las baterías van en la recámara exterior)
  g.add(bpu);
  const gabAlto = 1.55, gabW = 0.62, gabD = 0.7;
  const gabinete = new THREE.Mesh(new THREE.BoxGeometry(gabD, gabAlto, gabW), mBPU);
  gabinete.position.set(0, gabAlto / 2, 0);
  gabinete.castShadow = true;
  bpu.add(gabinete);
  // rejilla de ventilación frontal NEGRA perforada (foto real)
  const grid = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.52, 0.46),
    MineMaterials.plano(0x14181c, { rough: 0.75, metal: 0.3 })
  );
  grid.position.set(gabD / 2 + 0.001, 0.82, 0);
  bpu.add(grid);
  // manguera negra enrollada colgada al costado frontal-izquierdo (foto)
  for (let i = 0; i < 3; i++) {
    const rollo = new THREE.Mesh(
      new THREE.TorusGeometry(0.085, 0.013, 8, 18),
      MineMaterials.plano(0x101012, { rough: 0.7 })
    );
    rollo.rotation.y = Math.PI / 2;
    rollo.position.set(gabD / 2 + 0.03 + i * 0.018, 0.72, -gabW / 2 + 0.1);
    bpu.add(rollo);
  }
  // panel de control INCLINADO (render Dräger): cara blanca con indicadores,
  // diagrama de flujo y dial + paro de emergencia y botón verde 3D
  const panelGrupo = new THREE.Group();
  panelGrupo.position.set(gabD / 2 - 0.07, gabAlto - 0.13, 0);
  panelGrupo.rotation.z = -0.38; // inclinado hacia el operador
  bpu.add(panelGrupo);
  const panelCtrl = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.3, 0.56),
    MineMaterials.plano(0x0f4a90, { rough: 0.5, metal: 0.3 })
  );
  panelGrupo.add(panelCtrl);
  const caraPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.26),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPanelBPU()), roughness: 0.5 })
  );
  caraPanel.rotation.y = Math.PI / 2;
  caraPanel.position.set(0.026, 0, 0);
  panelGrupo.add(caraPanel);
  const paro = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.03, 14),
    MineMaterials.plano(0xd01111, { rough: 0.4, emissive: 0x400000, emissiveIntensity: 0.4 })
  );
  paro.rotation.z = Math.PI / 2;
  paro.position.set(0.04, -0.09, -0.21);
  panelGrupo.add(paro);
  const btnVerde = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.025, 12),
    MineMaterials.plano(0x18b038, { rough: 0.4, emissive: 0x0a4015, emissiveIntensity: 0.6 })
  );
  btnVerde.rotation.z = Math.PI / 2;
  btnVerde.position.set(0.038, -0.09, 0.21);
  panelGrupo.add(btnVerde);
  // dos TORRETAS superiores con letreros blancos (foto real: control de
  // oxígeno y esclusa de agua sobre el gabinete)
  for (const [tz, txt] of [[-0.17, 'CONTROL DE OXÍGENO'], [0.17, 'ESCLUSA DE AGUA']]) {
    const torre = new THREE.Mesh(new THREE.BoxGeometry(gabD * 0.8, 0.3, 0.26), mBPU);
    torre.position.set(-0.03, gabAlto + 0.15, tz);
    torre.castShadow = true;
    bpu.add(torre);
    const letrero = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.13),
      new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPlaca(txt, '#444')), roughness: 0.7 })
    );
    letrero.rotation.y = Math.PI / 2;
    letrero.position.set(-0.03 + gabD * 0.4 + 0.002, gabAlto + 0.15, tz);
    bpu.add(letrero);
  }
  // etiqueta amarilla de advertencia (render: frontal inferior)
  const etiqueta = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.07),
    MineMaterials.plano(0xf5c300, { rough: 0.6 })
  );
  etiqueta.rotation.y = Math.PI / 2;
  etiqueta.position.set(gabD / 2 + 0.002, 0.2, -0.18);
  bpu.add(etiqueta);
  // logo Dräger | SIMSA — Breathing Protection Unit
  const bpuLogo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.16),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaBPU()), transparent: true, roughness: 0.5 })
  );
  bpuLogo.rotation.y = Math.PI / 2;
  bpuLogo.position.set(gabD / 2 + 0.022, 0.46, 0);
  bpu.add(bpuLogo);

  // ── GRUPO de cilindros de O2 BLANCOS (2×2) junto a la BPU, con
  //    correa naranja y manifold de bronce con mini-manómetros ────────
  const o2Blancos = new THREE.Group();
  o2Blancos.position.set(-1.98, y0 + t, -A / 2 + 0.41);
  g.add(o2Blancos);
  for (let i = 0; i < 4; i++) {
    const cil = _cilindroO2(1.6, 0.115);
    cil.position.set(0.13 - (i % 2) * 0.26, 0, -0.13 + Math.floor(i / 2) * 0.26);
    o2Blancos.add(cil);
  }
  const correa = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.05, 0.1),
    MineMaterials.plano(0xf07000, { rough: 0.7 })
  );
  correa.position.set(0, 0.95, 0.13);
  o2Blancos.add(correa);
  // VÁLVULAS DE BRONCE por cilindro (foto real): volante gris moleteado,
  // collar verde, regulador con manómetro de dial blanco y palanca cromada
  const mBronce = MineMaterials.plano(0xb08a2a, { rough: 0.35, metal: 0.75 });
  const mVolanteGris = MineMaterials.plano(0x9a9a94, { rough: 0.45, metal: 0.7 });
  const mVerdeO2 = MineMaterials.plano(0x1d7a3a, { rough: 0.5, metal: 0.3 });
  for (let i = 0; i < 4; i++) {
    const va = new THREE.Group();
    va.position.set(0.13 - (i % 2) * 0.26, 1.7, -0.13 + Math.floor(i / 2) * 0.26);
    o2Blancos.add(va);
    // cuerpo de válvula
    const cuerpoV = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.1, 8), mBronce);
    cuerpoV.position.y = 0.04;
    va.add(cuerpoV);
    // volante gris moleteado encima
    const ejeV = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.035, 6), mVolanteGris);
    ejeV.position.y = 0.1;
    va.add(ejeV);
    const volanteV = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.016, 14), mVolanteGris);
    volanteV.position.y = 0.12;
    va.add(volanteV);
    // salida lateral con collar VERDE hacia el pasillo (+X)
    const salidaV = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.07, 8), mBronce);
    salidaV.rotation.z = Math.PI / 2;
    salidaV.position.set(0.05, 0.03, 0);
    va.add(salidaV);
    const collarV = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.028, 8), mVerdeO2);
    collarV.rotation.z = Math.PI / 2;
    collarV.position.set(0.078, 0.03, 0);
    va.add(collarV);
    // regulador con manómetro de dial blanco mirando al pasillo
    const regV = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.055, 8), mBronce);
    regV.position.set(0.105, 0.06, 0);
    va.add(regV);
    const manoV = _manometro(0.048);
    manoV.rotation.y = Math.PI / 2;
    manoV.position.set(0.105, 0.13, 0);
    va.add(manoV);
    // palanca cromada apuntando hacia arriba
    const palancaV = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 6), mCromo);
    palancaV.position.set(0.12, 0.22, 0);
    palancaV.rotation.z = -0.28;
    va.add(palancaV);
  }
  // tubería gris en la pared sobre los cilindros, con bajadas a las válvulas
  const mTuboO2 = MineMaterials.plano(0x9a9a94, { rough: 0.4, metal: 0.7 });
  const tuboO2 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.85, 8), mTuboO2);
  tuboO2.rotation.z = Math.PI / 2;
  tuboO2.position.set(0, 2.08, -0.33);
  o2Blancos.add(tuboO2);
  for (const bx of [-0.13, 0.13]) {
    const bajadaO2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), mTuboO2);
    bajadaO2.position.set(bx, 1.96, -0.29);
    bajadaO2.rotation.x = 0.35;
    o2Blancos.add(bajadaO2);
  }


  // ════════════════════════════════════════════════════════════════
  //  3. BANCO DE BATERÍAS — en RECÁMARA EXTERIOR anexa al testero
  //  trasero (fuera de la cabina pero adosada, diagrama punto 3)
  // ════════════════════════════════════════════════════════════════
  const batD = 0.6;                    // profundidad del anexo
  const xAnFin = -L / 2 - batD;        // testero del anexo
  const rack = new THREE.Group();
  rack.position.set(-L / 2 - batD + 0.3, y0 + t, 0);
  rack.rotation.y = -Math.PI / 2; // frente del rack hacia -X (puertas de servicio)
  g.add(rack);
  const mRack = MineMaterials.plano(0xe3e1d9, { rough: 0.6, metal: 0.25 });
  const rackH = 1.42, rackW = 0.92, rackD = 0.4; // rackW a lo largo de X
  // laterales
  for (const sxr of [-1, 1]) {
    const lateral = new THREE.Mesh(new THREE.BoxGeometry(0.04, rackH, rackD), mRack);
    lateral.position.set(sxr * (rackW / 2), rackH / 2, 0);
    rack.add(lateral);
  }
  // repisas + cajas de baterías azules Dräger con tapa de bornes negra
  const niveles = [0.1, 0.54, 0.98, 1.4];
  for (let n = 0; n < niveles.length; n++) {
    const repisa = new THREE.Mesh(new THREE.BoxGeometry(rackW, 0.035, rackD - 0.02), mRack);
    repisa.position.set(0, niveles[n], 0);
    rack.add(repisa);
    if (n === niveles.length - 1) continue; // la superior queda de tapa
    for (let b = 0; b < 3; b++) {
      const esNegra = n === 1 && b === 2;
      const bateria = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.3, 0.28),
        MineMaterials.plano(esNegra ? 0x24241f : 0x2a5fb0, { rough: 0.5, metal: 0.2 })
      );
      bateria.position.set(-0.29 + b * 0.29, niveles[n] + 0.17, 0.02);
      rack.add(bateria);
      // tapa de bornes
      const tapa = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.04, 0.2),
        MineMaterials.plano(0x14140f, { rough: 0.5 })
      );
      tapa.position.set(-0.29 + b * 0.29, niveles[n] + 0.34, 0.02);
      rack.add(tapa);
    }
  }
  // placa "BATERÍAS" sobre el rack + cable hacia la BPU
  const placaBat = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.4),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPlaca('BATERÍAS', '#12307e')), roughness: 0.7 })
  );
  // ── Estructura de la RECÁMARA (anexo exterior) ───────────────────
  const xAnC = -L / 2 - batD / 2; // centro del anexo
  const anPiso = new THREE.Mesh(new THREE.BoxGeometry(batD, t, A), mAcero);
  anPiso.position.set(xAnC, y0 + t / 2, 0);
  g.add(anPiso);
  const anTecho = new THREE.Mesh(new THREE.BoxGeometry(batD + 0.02, t, A), mAcero);
  anTecho.position.set(xAnC, y0 + H - 0.02, 0);
  anTecho.castShadow = true;
  g.add(anTecho);
  for (const szn of [-1, 1]) {
    const anLat = new THREE.Mesh(new THREE.BoxGeometry(batD, H, t), mAcero);
    anLat.position.set(xAnC, y0 + H / 2, szn * (A / 2 - t / 2));
    g.add(anLat);
  }
  // testero: zócalo y dintel que cierran arriba/abajo de las puertas
  const anPH = H - 0.4, anPW = (A - 0.24) / 2;
  const anZoc = new THREE.Mesh(new THREE.BoxGeometry(t, 0.14, A), mAcero);
  anZoc.position.set(xAnFin, y0 + 0.07, 0);
  g.add(anZoc);
  const anDintel = new THREE.Mesh(new THREE.BoxGeometry(t, H - anPH - 0.14, A), mAcero);
  anDintel.position.set(xAnFin, y0 + 0.14 + anPH + (H - anPH - 0.14) / 2, 0);
  g.add(anDintel);
  // puerta de servicio CERRADA (lado -Z) con rejillas de ventilación
  const anPuertaCer = new THREE.Mesh(new THREE.BoxGeometry(t, anPH, anPW), mAceroIn);
  anPuertaCer.position.set(xAnFin, y0 + 0.14 + anPH / 2, -(0.06 + anPW / 2));
  g.add(anPuertaCer);
  for (let i = 0; i < 6; i++) {
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.045, anPW * 0.62),
      MineMaterials.plano(0x55544e, { rough: 0.6, metal: 0.4 })
    );
    slat.rotation.z = 0.5;
    slat.position.set(
      xAnFin - t / 2 - 0.012,
      y0 + (i < 3 ? 0.55 : 1.45) + (i % 3) * 0.1,
      -(0.06 + anPW / 2)
    );
    g.add(slat);
  }
  // puerta de servicio ABIERTA (lado +Z): muestra el banco de baterías
  const anPivote = new THREE.Group();
  anPivote.position.set(xAnFin, y0, A / 2 - t);
  anPivote.rotation.y = 0.95; // abierta hacia afuera
  g.add(anPivote);
  const anHoja = new THREE.Mesh(new THREE.BoxGeometry(t, anPH, anPW), mAceroIn);
  anHoja.position.set(0, 0.14 + anPH / 2, -anPW / 2);
  anHoja.castShadow = true;
  anPivote.add(anHoja);
  const anManija = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), mCromo);
  anManija.position.set(-t / 2 - 0.03, 1.15, -anPW + 0.1);
  anPivote.add(anManija);
  // franjas reflectivas verticales en las esquinas del anexo
  for (const szn of [-1, 1]) {
    const fvAn = new THREE.Mesh(new THREE.PlaneGeometry(0.16, H - 0.1), matRayasV);
    fvAn.position.set(xAnFin - t / 2 - 0.006, y0 + (H - 0.1) / 2 + 0.05, szn * (A / 2 - 0.12));
    fvAn.rotation.y = -Math.PI / 2;
    g.add(fvAn);
  }
  // placa "BATERÍAS" en la puerta cerrada + pasamuros del cable a la BPU
  placaBat.rotation.y = -Math.PI / 2;
  placaBat.position.set(xAnFin - t / 2 - 0.012, y0 + 1.65, -(0.06 + anPW / 2));
  g.add(placaBat);
  const cableBat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.8, 6),
    MineMaterials.plano(0x141414, { rough: 0.6 })
  );
  cableBat.rotation.z = Math.PI / 2;
  cableBat.position.set(-L / 2 - 0.1, y0 + 1.9, -0.3);
  g.add(cableBat);

  // ── PLACA DE MONTAJE crema en la pared del fondo (fotos reales):
  //    porta el split A/C, 4 manómetros con campanas y el termómetro ──
  const placaMont = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 1.05, 1.6),
    MineMaterials.plano(0xe9e7db, { rough: 0.6, metal: 0.15 })
  );
  placaMont.position.set(-L / 2 + t + 0.03, y0 + H - 0.62, 0.1);
  g.add(placaMont);

  // split de aire acondicionado montado sobre la placa (centro-derecha del
  // observador; deja el costado izquierdo de la placa a la instrumentación)
  const acBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.3, 0.95),
    MineMaterials.plano(0xf6f6f2, { rough: 0.5, metal: 0.1 })
  );
  acBody.position.set(-L / 2 + t + 0.18, y0 + H - 0.32, -0.2);
  g.add(acBody);
  const acRej = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.06, 0.9),
    MineMaterials.plano(0xd8d8d2, { rough: 0.6 })
  );
  acRej.position.set(-L / 2 + t + 0.30, y0 + H - 0.43, -0.2);
  g.add(acRej);

  // ── CLÚSTER DE INSTRUMENTACIÓN (foto real, a la izquierda del A/C;
  //    separado de la BPU para que sea visible desde la puerta) ───────
  const instr = new THREE.Group();
  instr.position.set(-L / 2 + t + 0.09, y0 + H - 0.62, 0.62); // costado IZQUIERDO del observador
  g.add(instr);
  const mNegroMate = MineMaterials.plano(0x17171a, { rough: 0.5, metal: 0.2 });
  const mCobre = MineMaterials.plano(0x8a6a30, { rough: 0.4, metal: 0.7 });

  // regulador con válvula sobre soporte negro (esquina superior izquierda,
  // fuera de la placa, pegado al rincón como en la foto)
  const soporteReg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.12), mNegroMate);
  soporteReg.position.set(-0.02, 0.5, 0.42);
  instr.add(soporteReg);
  const manoReg = _manometro(0.045);
  manoReg.rotation.y = Math.PI / 2;
  manoReg.position.set(0, 0.48, 0.48);
  instr.add(manoReg);
  const perillaReg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.06, 10), mNegroMate);
  perillaReg.position.set(0, 0.56, 0.42);
  instr.add(perillaReg);

  // DRÄGER POLYTRON 8000 — monitor fijo de gases (CO2/CO/O2), catálogo:
  // carcasa metálica robusta con nervaduras, display LCD verde, botones,
  // conexión de conducto lateral, tuerca hex y capuchón sensor negro grande
  const polytron = new THREE.Group();
  polytron.position.set(0.035, 0.22, 0.26); // arriba-izquierda, saliente de la placa
  instr.add(polytron);
  const mPolyGris = MineMaterials.plano(0x9c9c96, { rough: 0.35, metal: 0.65 });
  const polyCuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 14), mPolyGris);
  polyCuerpo.position.y = 0.12;
  polyCuerpo.castShadow = true;
  polytron.add(polyCuerpo);
  const polyTapa = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.03, 14), mPolyGris);
  polyTapa.position.y = 0.21;
  polytron.add(polyTapa);
  // nervaduras de la carcasa
  for (const ny of [0.07, 0.17]) {
    const nervio = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.008, 6, 14), mPolyGris);
    nervio.rotation.x = Math.PI / 2;
    nervio.position.y = ny;
    polytron.add(nervio);
  }
  // marco + display LCD verde
  const polyMarco = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.075, 0.095), mNegroMate);
  polyMarco.position.set(0.05, 0.13, 0);
  polytron.add(polyMarco);
  const polyDisplay = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x1a2e1a, emissive: 0x3fae4f, emissiveIntensity: 1.6, roughness: 0.3 })
  );
  polyDisplay.rotation.y = Math.PI / 2;
  polyDisplay.position.set(0.062, 0.13, 0);
  polytron.add(polyDisplay);
  // botones rojo/negro bajo el display
  for (let i = 0; i < 2; i++) {
    const btn = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.014, 0.03),
      MineMaterials.plano(i === 0 ? 0xb02020 : 0x222226, { rough: 0.5 })
    );
    btn.position.set(0.056, 0.075, -0.022 + i * 0.044);
    polytron.add(btn);
  }
  // conexión de conducto lateral (izquierda) con tapón hex
  const polyCond = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 8), mPolyGris);
  polyCond.rotation.x = Math.PI / 2;
  polyCond.position.set(0, 0.16, -0.08);
  polytron.add(polyCond);
  const polyHexL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 6), mPolyGris);
  polyHexL.rotation.x = Math.PI / 2;
  polyHexL.position.set(0, 0.16, -0.115);
  polytron.add(polyHexL);
  // tuerca hex de unión al sensor
  const polyHex = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.045, 6), mPolyGris);
  polyHex.position.y = 0.015;
  polytron.add(polyHex);
  // capuchón sensor electroquímico NEGRO (grande, como el catálogo)
  const polySensor = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.052, 0.13, 12), mNegroMate);
  polySensor.position.y = -0.07;
  polySensor.castShadow = true;
  polytron.add(polySensor);
  const polyPunta = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.038, 0.035, 12), mNegroMate);
  polyPunta.position.y = -0.15;
  polytron.add(polyPunta);
  // etiqueta blanca "POLYTRON 8000 — CO2 · CO · O2"
  const polyEtiq = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.055),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPlaca('POLYTRON 8000', '#12307e')), roughness: 0.7 })
  );
  polyEtiq.rotation.y = Math.PI / 2;
  polyEtiq.position.set(-0.02, -0.26, 0);
  polytron.add(polyEtiq);

  // 3 manómetros grandes (disposición de la foto): 1 arriba junto al
  // Polytron con codo ROJO a su derecha + 2 abajo con campanas protectoras
  const cluster = [
    { my: 0.24,  mz:  0.02, r: 0.085, campana: false },
    { my: -0.06, mz:  0.1,  r: 0.08,  campana: true },
    { my: -0.1,  mz: -0.14, r: 0.08,  campana: true },
  ];
  for (const c of cluster) {
    const m = _manometro(c.r);
    m.rotation.y = Math.PI / 2;
    m.position.set(0, c.my, c.mz);
    instr.add(m);
    if (!c.campana) continue;
    const tubito = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.12, 6), mCobre);
    tubito.position.set(0, c.my - c.r - 0.05, c.mz);
    instr.add(tubito);
    const campana = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.052, 0.17, 10), mNegroMate);
    campana.position.set(0, c.my - c.r - 0.19, c.mz);
    instr.add(campana);
  }
  // codo/conexión ROJA a la derecha del manómetro superior (foto)
  const codo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.1, 8),
    MineMaterials.plano(0x9e2a20, { rough: 0.45, metal: 0.5 })
  );
  codo.rotation.x = Math.PI / 2;
  codo.position.set(0, 0.24, -0.12);
  instr.add(codo);

  // ── Tubería aérea de aire/agua a lo largo del techo (costado +Z) ─
  const mTubo = MineMaterials.plano(0x9a9a94, { rough: 0.4, metal: 0.7 });
  const tubo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, L - 0.6, 10),
    mTubo
  );
  tubo.rotation.z = Math.PI / 2;
  tubo.position.set(0.1, y0 + H - 0.12, A / 2 - 0.14);
  g.add(tubo);
  // abrazaderas de soporte a la pared (foto real)
  for (const cxT of [-1.9, 0.1, 2.0]) {
    const abraz = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.09, 0.03),
      MineMaterials.plano(0x77766e, { rough: 0.5, metal: 0.5 })
    );
    abraz.position.set(cxT, y0 + H - 0.1, A / 2 - t - 0.02);
    g.add(abraz);
  }

  // ── Placas de señalética + flechas rojas en las paredes ──────────
  const placaTitulos = ['DIAGRAMA DE AGUA', 'PROCEDIMIENTO', 'RACIONES', 'PRESIÓN'];
  for (let i = 0; i < 4; i++) {
    const sz = i < 2 ? 1 : -1;
    const px = -1.4 + (i % 2) * 1.6;
    const pl = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.46),
      new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPlaca(placaTitulos[i])), roughness: 0.7 })
    );
    pl.position.set(px, y0 + H - 0.55, sz * (A / 2 - t - 0.01));
    pl.rotation.y = sz > 0 ? Math.PI : 0;
    g.add(pl);
  }
  // flechas rojas de evacuación (varias por pared, fotos reales)
  const flechaMat = new THREE.MeshStandardMaterial({ map: _aTextura(_texturaFlecha()), transparent: true, roughness: 0.7 });
  for (const sz of [-1, 1]) {
    for (const fx of [-2.1, -0.35, 1.3]) {
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.26), flechaMat);
      fl.position.set(fx, y0 + H - 0.45, sz * (A / 2 - t - 0.012));
      fl.rotation.y = sz > 0 ? Math.PI : 0;
      g.add(fl);
    }
  }
  // pósters de plano/mapa a color junto a la puerta (fotos reales, pared -Z)
  for (let i = 0; i < 2; i++) {
    const mapa = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.33),
      new THREE.MeshStandardMaterial({ map: _aTextura(_texturaMapa(i + 1)), roughness: 0.75 })
    );
    mapa.position.set(0.85 + i * 0.52, y0 + H - 1.0, -(A / 2 - t - 0.012));
    g.add(mapa);
  }

  // ════════════════════════════════════════════════════════════════
  //  INTERACCIÓN
  // ════════════════════════════════════════════════════════════════
  let abierto = ocupado;
  // Las luces ya NO dependen de ocupado/disponible: indican la FUENTE DE
  // ENERGÍA (ver tick más abajo). El estado solo abre/cierra las puertas.
  const setEstado = (ocup) => {
    puertaPivote.rotation.y = ocup ? -Math.PI * 0.62 : 0;
    puertaIntPivote.rotation.y = ocup ? Math.PI * 0.55 : 0;
  };
  setEstado(abierto);

  // ── ANIMACIÓN DE LUCES (userData.tick) ───────────────────────────
  //  1. VERDE fija  = refugio alimentado por la RED ELÉCTRICA de mina.
  //  2. ROJA  fija  = refugio usando sus PROPIAS BATERÍAS.
  //     Alternan cada 60 s y son EXCLUYENTES (nunca ambas a la vez).
  //  3. ÁMBAR: SIEMPRE parpadeando (1 Hz), independiente de las demás.
  let tLuces = 0;
  g.userData.tick = (dt) => {
    tLuces += dt;
    const enRed = (tLuces % 120) < 60; // 1 min red de mina ↔ 1 min baterías
    lamparas.verde.material.emissiveIntensity = enRed ? 3.2 : 0;
    lamparas.verde.material.color.set(enRed ? 0x28c838 : 0x201f1c);
    lamparas.rojo.material.emissiveIntensity = enRed ? 0 : 3.2;
    lamparas.rojo.material.color.set(enRed ? 0x201f1c : 0xcc1111);
    luzEstado.color.set(enRed ? 0x33ff44 : 0xff2200);
    // ámbar intermitente
    const blink = (tLuces % 1.0) < 0.5;
    lamparas.ambar.material.emissiveIntensity = blink ? 3.2 : 0.12;
    lamparas.ambar.material.color.set(blink ? 0xe08a00 : 0x2a2418);
  };
  g.userData.tick(0); // estado inicial coherente (verde encendida)

  g.userData.interactable = {
    object: gabinete,
    descriptor: {
      label: `Ingresar al Refugio Minero Dräger N°${numero}`,
      onInteract: () => {
        abierto = !abierto;
        setEstado(abierto);
        window.__mina?.bus.emit('ui:read', {
          title: `REFUGIO MINERO DRÄGER N°${numero} — NEXA / Cerro Lindo`,
          body:
            (abierto ? 'Estado: OCUPADO (semáforo rojo). ' : 'Estado: DISPONIBLE (semáforo verde). ') +
            'Cámara de rescate Dräger | SIMSA. Capacidad: 20 personas. ' +
            'ANATOMÍA: 1) PRECÁMARA (esclusa) — área de transición que evita el ingreso de ' +
            'gases tóxicos; 2) BPU — unidad de protección respiratoria que purifica el aire; ' +
            '3) BANCO DE BATERÍAS — energía ininterrumpida para iluminación y A/C; ' +
            '4) CILINDROS DE O2 — reservas de alta presión para regenerar la atmósfera; ' +
            '5) ASIENTOS Y ALMACENAMIENTO — raciones de supervivencia, agua y botiquín. ' +
            'PROCEDIMIENTO: ingresar por la esclusa, sellar ambas puertas estancas, activar la ' +
            'BPU, abrir el O2 y comunicar por la línea de vida hasta el rescate. Autonomía: 36 h.'
        });
      }
    }
  };

  return g;
}
