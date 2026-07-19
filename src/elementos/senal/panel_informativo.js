import * as THREE from 'three';

/**
 * PANEL INFORMATIVO SSOMA — tablero mural verde con bolsillos de documentos.
 *
 * Basado en la foto real: tabla verde (~1.4m x 1.0m) montada en pared, header
 * "NUESTROS VALORES", dos filas de bolsillos porta-documentos con etiquetas:
 *   Fila 1: POLITICAS | IPERC-MAPA DE RIESGO | ESTANDARES | PROCEDIMIENTOS | ESTADISTICAS
 *   Fila 2: GESTION AMBIENTAL | PLAN DE RESPUESTA A EMERGENCIAS | PLANO TOPOGRAFICO | PLANO GEOMECANICO | HERRAMIENTAS DE GESTION
 */

export const meta = {
  id: 'panel_informativo',
  nombre: 'Panel informativo (valores y documentos)',
  descripcion: 'Tablero verde de pared con bolsillos de documentos (POLITICAS, IPERC, ESTANDARES, PROCEDIMIENTOS).'
};

const W = 1.40; // ancho total
const H = 1.00; // alto total

const FILA1 = ['POLÍTICAS', 'IPERC - MAPA\nDE RIESGO', 'ESTÁNDARES', 'PROCEDIMIENTOS', 'ESTADÍSTICAS'];
const FILA2 = ['GESTIÓN AMBIENTAL\nHOJAS DE SEGURIDAD', 'PLAN DE RESPUESTA\nA EMERGENCIAS', 'PLANO\nTOPOGRÁFICO', 'PLANO\nGEOMECÁNICO', 'HERRAMIENTAS\nDE GESTIÓN'];

const VERDE_TABLERO = '#1f8038';  // verde institucional (medio, saturado)
const VERDE_OSCURO  = '#155726';  // verde oscuro (etiquetas / seams)

/** Logo SSOMA estilizado: cuadro blanco con montaña verde y texto "SSOMA". */
function drawLogoMina(ctx, x, y, s) {
  ctx.save();
  ctx.fillStyle = '#f2f4f0';
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = '#0f3d1c'; ctx.lineWidth = 2; ctx.strokeRect(x, y, s, s);
  // Montaña / A
  ctx.fillStyle = VERDE_TABLERO;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.5, y + s * 0.18);
  ctx.lineTo(x + s * 0.86, y + s * 0.66);
  ctx.lineTo(x + s * 0.14, y + s * 0.66);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0f3d1c';
  ctx.font = `bold ${Math.round(s * 0.22)}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('SSOMA', x + s * 0.5, y + s * 0.92);
  ctx.restore();
}

/** Etiqueta verde con borde blanco y texto blanco centrado (multi-línea). */
function drawLabel(ctx, x, y, w, h, text) {
  ctx.save();
  ctx.fillStyle = VERDE_OSCURO;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#eef4ee'; ctx.lineWidth = 2.5; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = text.split('\n');
  const fs = lines.length > 1 ? 15 : 17;
  ctx.font = `bold ${fs}px Arial`;
  const lh = fs + 3;
  lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * lh));
  ctx.restore();
}

/** Documento/papel pineado (rotado levemente) con encabezado de color y cinta adhesiva. */
function drawPaper(ctx, cx, cy, w, h, rot, headColor, rng) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  // Papel
  ctx.fillStyle = '#f6f5ef'; ctx.fillRect(-w / 2, -h / 2, w, h);
  // Encabezado de color
  ctx.fillStyle = headColor; ctx.fillRect(-w / 2, -h / 2, w, Math.max(8, h * 0.16));
  // Líneas de texto simuladas
  ctx.fillStyle = '#9aa0a2';
  for (let i = 0; i < 5; i++) {
    const ly = -h / 2 + h * 0.28 + i * (h * 0.13);
    ctx.fillRect(-w / 2 + 6, ly, (w - 12) * (0.6 + rng() * 0.35), 2.5);
  }
  // Cinta adhesiva (2 esquinas)
  ctx.fillStyle = 'rgba(220,215,180,0.55)';
  ctx.fillRect(-w / 2 - 5, -h / 2 - 5, 22, 12);
  ctx.fillRect(w / 2 - 17, -h / 2 - 5, 22, 12);
  ctx.restore();
}

function buildTexture() {
  const c = document.createElement('canvas');
  c.width = 1120; c.height = 800;
  const ctx = c.getContext('2d');
  // RNG determinista para la disposición de papeles
  let s = 12345;
  const rng = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  // Fondo verde con seams verticales (paneles) y leve suciedad
  ctx.fillStyle = VERDE_TABLERO;
  ctx.fillRect(0, 0, 1120, 800);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(i * 224, 0); ctx.lineTo(i * 224, 800); ctx.stroke(); }
  // Manchas de suciedad tenues
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + rng() * 0.05})`;
    const r = 10 + rng() * 40;
    ctx.beginPath(); ctx.arc(rng() * 1120, rng() * 800, r, 0, Math.PI * 2); ctx.fill();
  }

  // ── HEADER: valores + logos ──
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, 0, 1120, 140);
  drawLogoMina(ctx, 26, 24, 92);
  drawLogoMina(ctx, 1120 - 26 - 92, 24, 92);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 40px Arial';
  ctx.fillText('NUESTROS VALORES', 560, 52);
  ctx.font = 'bold 20px Arial';
  ctx.fillText('INTEGRIDAD   ·   BIENESTAR Y SEGURIDAD   ·   PRODUCTIVIDAD', 560, 90);
  ctx.fillText('TRABAJO EN EQUIPO   ·   CLIENTE   ·   PASIÓN Y APRENDIZAJE', 560, 120);

  // Layout de 5 columnas
  const M = 24, GAP = 12;
  const colW = (1120 - M * 2 - GAP * 4) / 5;
  const colX = (i) => M + i * (colW + GAP);

  const headColors = ['#c0392b', '#2e6da4', '#e0a800', '#2e8b57', '#7d3c98', '#16a085'];

  // ── Documentos sobre la fila 1 ──
  for (let i = 0; i < 5; i++) {
    const x = colX(i) + colW / 2, y = 210;
    drawPaper(ctx, x, y, colW * 0.82, 110, (rng() - 0.5) * 0.10, headColors[i % headColors.length], rng);
  }
  // ── ETIQUETAS fila 1 ──
  for (let i = 0; i < 5; i++) drawLabel(ctx, colX(i), 290, colW, 62, FILA1[i]);

  // ── Documentos sobre la fila 2 ──
  for (let i = 0; i < 5; i++) {
    const x = colX(i) + colW / 2, y = 470;
    drawPaper(ctx, x, y, colW * 0.82, 150, (rng() - 0.5) * 0.10, headColors[(i + 2) % headColors.length], rng);
  }
  // ── ETIQUETAS fila 2 ──
  for (let i = 0; i < 5; i++) drawLabel(ctx, colX(i), 588, colW, 72, FILA2[i]);

  // ── Pie ──
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
  ctx.fillText('SISTEMA INTEGRADO DE GESTIÓN  ·  NEXA RESOURCES', 560, 700);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function crear() {
  const g = new THREE.Group();
  g.name = 'panel_informativo';
  g.userData.solid = true;   // obstaculo solido: el jugador/NPC no lo atraviesa

  const tex = buildTexture();

  // Tablero principal verde
  const tablero = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, 0.04),
    new THREE.MeshStandardMaterial({
      color: 0x1a6b32, roughness: 0.85, metalness: 0.05
    })
  );
  tablero.position.set(0, H / 2, 0);
  g.add(tablero);

  // Cara frontal con textura CanvasTexture
  const cara = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.02, H - 0.02),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 })
  );
  cara.position.set(0, H / 2, 0.021);
  g.add(cara);

  // Marco metalico (4 bordes)
  const mMarco = new THREE.MeshStandardMaterial({ color: 0x303830, roughness: 0.7, metalness: 0.6 });
  for (const [bw, bh, bd, bx, by, bz] of [
    [W + 0.02, 0.025, 0.045, 0, H, 0],         // top
    [W + 0.02, 0.025, 0.045, 0, 0, 0],         // bottom
    [0.025, H + 0.02, 0.045, -W / 2, H / 2, 0], // left
    [0.025, H + 0.02, 0.045,  W / 2, H / 2, 0], // right
  ]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mMarco);
    b.position.set(bx, by, bz);
    g.add(b);
  }

  // 4 tornillos/pernos de montaje en las esquinas
  const mTorn = new THREE.MeshStandardMaterial({ color: 0x707878, roughness: 0.5, metalness: 0.8 });
  for (const [ex, ey] of [[-W / 2 + 0.06, 0.08], [W / 2 - 0.06, 0.08], [-W / 2 + 0.06, H - 0.08], [W / 2 - 0.06, H - 0.08]]) {
    const perno = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 6), mTorn);
    perno.rotation.x = Math.PI / 2;
    perno.position.set(ex, ey, 0.045);
    g.add(perno);
  }

  // Interactable: al acercarse se puede "leer" el panel
  g.userData.interactable = {
    object: g,
    descriptor: {
      label: 'Leer panel informativo',
      onInteract: () => window.__mina?.bus.emit('ui:read', {
        title: 'NUESTROS VALORES',
        body:
          'POLITICAS DE SEGURIDAD, SALUD Y MEDIO AMBIENTE\n\n' +
          'IPERC — Identificacion de Peligros y Evaluacion de Riesgos\n\n' +
          'ESTANDARES DE TRABAJO SEGURO\n\n' +
          'PROCEDIMIENTOS OPERATIVOS ESTANDARIZADOS\n\n' +
          'ESTADISTICAS DE SEGURIDAD DEL MES\n\n' +
          'PLAN DE RESPUESTA A EMERGENCIAS\n\n' +
          'Responsable de Seguridad: Jefe de Guardia'
      })
    }
  };

  return g;
}
