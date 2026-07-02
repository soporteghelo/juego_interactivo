import * as THREE from 'three';

/**
 * SENALETICA — md: "Senaletica — Sistema completo". Se dibuja con CanvasTexture usando los
 * colores y textos EXACTOS del md (sin imagenes externas). Para editar una senal, modifica
 * su funcion en TIPOS_SENAL.
 *
 * Cada senal lleva userData.signText (para "leerla" en el juego).
 */

export const meta = {
  id: 'senal',
  nombre: 'Senaletica',
  descripcion: 'Letreros del sistema de seguridad (peligro, advertencia, EPP, via de escape, etc.).'
};

const _texCache = new Map();

function lienzo(w = 512, h = 340) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

function textura(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function textoCentrado(ctx, text, x, y, maxWidth, fontSize, color, weight = 'bold') {
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${weight} ${fontSize}px Arial`;
  const lines = text.split('\n');
  const lh = fontSize * 1.1;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y - ((lines.length - 1) * lh) / 2 + i * lh, maxWidth);
  });
}

/** Definicion de cada tipo de senal (colores literales del md). */
export const TIPOS_SENAL = {
  peligro_no_ingresar() {
    const { canvas, ctx } = lienzo();
    ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 14;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    textoCentrado(ctx, 'PELIGRO\nNO INGRESAR', canvas.width / 2, canvas.height / 2, 460, 72, '#ffffff');
    return { canvas, text: 'PELIGRO — NO INGRESAR. Zona restringida.' };
  },
  peligro_caida() {
    const { canvas, ctx } = lienzo();
    ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    textoCentrado(ctx, 'PELIGRO\nCAIDA DE ROCA', canvas.width / 2, canvas.height / 2, 470, 64, '#ffffff');
    return { canvas, text: 'PELIGRO — Caida de roca. Riesgo de desprendimiento.' };
  },
  advertencia_aesa() {
    const { canvas, ctx } = lienzo(640, 320);
    ctx.fillStyle = '#ffcc00'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.moveTo(40, 70); ctx.lineTo(90, 70); ctx.lineTo(65, 25); ctx.closePath(); ctx.fill();
    ctx.font = 'bold 28px Arial'; ctx.textAlign = 'left'; ctx.fillText('AESA', 100, 60);
    textoCentrado(ctx, 'ADVERTENCIA', canvas.width / 2, canvas.height / 2 + 30, 560, 96, '#111');
    return { canvas, text: 'ADVERTENCIA (AESA) — Proceda con precaucion.' };
  },
  via_escape() {
    const { canvas, ctx } = lienzo();
    ctx.fillStyle = '#1b5e20'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(170, 110, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(150, 140, 40, 80);
    ctx.beginPath();
    ctx.moveTo(300, 170); ctx.lineTo(420, 170); ctx.lineTo(420, 140);
    ctx.lineTo(480, 190); ctx.lineTo(420, 240); ctx.lineTo(420, 210); ctx.lineTo(300, 210);
    ctx.closePath(); ctx.fill();
    textoCentrado(ctx, 'VIA DE ESCAPE', canvas.width / 2, 290, 460, 48, '#fff');
    return { canvas, text: 'VIA DE ESCAPE — Ruta de evacuacion.' };
  },
  uso_epp() {
    const { canvas, ctx } = lienzo(420, 540);
    ctx.fillStyle = '#0d47a1'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    textoCentrado(ctx, 'USO OBLIGATORIO\nE.P.P.', canvas.width / 2, 70, 380, 44, '#fff');
    const items = ['CASCO', 'LENTES', 'RESPIRADOR', 'BOTAS', 'GUANTES', 'CHALECO'];
    items.forEach((label, i) => {
      const cx = 110 + (i % 2) * 200;
      const cy = 200 + Math.floor(i / 2) * 120;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
      ctx.fillText(label, cx, cy + 64);
    });
    return { canvas, text: 'USO OBLIGATORIO DE EPP: casco, lentes, respirador, botas, guantes, chaleco.' };
  },
  refugio_banner() {
    const { canvas, ctx } = lienzo(700, 220);
    ctx.fillStyle = '#ffcc00'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    textoCentrado(ctx, 'REFUGIO MINERO N°2', canvas.width / 2, 80, 640, 64, '#111');
    textoCentrado(ctx, 'NEXA · UNIDAD MINERA CERRO LINDO', canvas.width / 2, 150, 640, 34, '#111', 'normal');
    return { canvas, text: 'REFUGIO MINERO N°2 — NEXA, Unidad Minera Cerro Lindo.' };
  },
  refugio_entrada() {
    const { canvas, ctx } = lienzo(400, 200);
    ctx.fillStyle = '#0d47a1'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    textoCentrado(ctx, 'ENTRADA / ENTRY', canvas.width / 2, 70, 360, 40, '#fff');
    textoCentrado(ctx, 'CAPACIDAD 20', canvas.width / 2, 140, 360, 36, '#ffcc00');
    return { canvas, text: 'ENTRADA / ENTRY — Capacidad 20 personas.' };
  },
  navegacion() {
    const { canvas, ctx } = lienzo(520, 200);
    ctx.fillStyle = '#1b3a1b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    textoCentrado(ctx, 'CX.081 · NV-1600', canvas.width / 2, 80, 480, 56, '#fff');
    textoCentrado(ctx, 'AESA', canvas.width / 2, 150, 480, 40, '#39ff14');
    return { canvas, text: 'Navegacion: CX.081 / NV-1600 / AESA.' };
  },
  monitoreo_gases() {
    const { canvas, ctx } = lienzo(440, 320);
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 10; ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    textoCentrado(ctx, 'MONITOREO DE GASES', canvas.width / 2, 50, 400, 32, '#39ff14');
    const rows = ['O2 .... 20.9%', 'CO ..... 0 ppm', 'CO2 ... 400 ppm', 'NO2 .... 0 ppm'];
    ctx.font = '24px monospace'; ctx.fillStyle = '#cfe8cf'; ctx.textAlign = 'left';
    rows.forEach((r, i) => ctx.fillText(r, 50, 120 + i * 44));
    return { canvas, text: 'Monitoreo de gases: O2 20.9%, CO 0ppm, CO2 400ppm, NO2 0ppm.' };
  },
  chevron() {
    const { canvas, ctx } = lienzo(256, 256);
    ctx.fillStyle = '#ffcc00'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111';
    for (let k = 0; k < 2; k++) {
      const off = k * 70;
      ctx.beginPath();
      ctx.moveTo(40 + off, 60); ctx.lineTo(120 + off, 128); ctx.lineTo(40 + off, 196);
      ctx.lineTo(70 + off, 196); ctx.lineTo(150 + off, 128); ctx.lineTo(70 + off, 60);
      ctx.closePath(); ctx.fill();
    }
    return { canvas, text: 'Chevron de direccion.' };
  }
};

/**
 * Crea una senal del tipo indicado.
 * @param {keyof typeof TIPOS_SENAL} tipo
 * @returns {THREE.Mesh}
 */
export function crearSenal(tipo) {
  const def = TIPOS_SENAL[tipo];
  if (!def) throw new Error(`[senal] tipo desconocido: ${tipo}`);

  let entry = _texCache.get(tipo);
  if (!entry) {
    const { canvas, text } = def();
    entry = { texture: textura(canvas), text, aspect: canvas.width / canvas.height };
    _texCache.set(tipo, entry);
  }

  const mat = new THREE.MeshStandardMaterial({
    map: entry.texture,
    roughness: 0.7,
    metalness: 0,
    emissive: 0x111111,
    emissiveIntensity: 0.15,
    side: THREE.DoubleSide
  });

  const h = 0.6;
  const w = h * entry.aspect;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.userData.signText = entry.text;
  mesh.name = `senal:${tipo}`;
  return mesh;
}

export const CLAVES_SENAL = Object.keys(TIPOS_SENAL);

/** Por defecto (para el visualizador): una senal representativa. */
export function crear({ tipo = 'uso_epp' } = {}) {
  return crearSenal(tipo);
}
