import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { sub } from '../_comun/subelemento.js';

/**
 * TABLERO DE MONITOREO DE GASES — pizarra verde mural.
 *
 * Fiel a la foto real (tablero verde de mina):
 *  - Fondo verde con header "MONITOREO DE GASES" en blanco.
 *  - Logotipo SSOMA (triangulos) en area superior izquierda.
 *  - Campos con casillas blancas: NIVEL, LABOR, FECHA, HORA, RESPONSABLE.
 *  - Tabla de 3 columnas: GUARDIA DIA | LMP | GUARDIA NOCHE.
 *  - Filas de gases: O2 (19.5%), CO (25 PPM), CO2 (5000 PPM), NO2 (3 PPM), H2S (10 PPM).
 *  - Valores escritos a mano (estilo tipico de mina).
 *
 * INTERACTUABLE: el jugador puede leer los datos al acercarse.
 */

export const meta = {
  id: 'pizarra_monitoreo',
  nombre: 'Tablero MONITOREO DE GASES',
  descripcion: 'Pizarra verde mural con registros de O2, CO, CO2, NO2, H2S y limites permisibles.'
};

const BW = 1.20; // ancho del tablero en metros
const BH = 0.90; // alto del tablero en metros

// Registros del tablero (fieles a la foto real CX-989). Fuente única de verdad
// para el canvas y para el panel interactuable.
const REGISTRO = {
  nivel: '1710',
  labor: 'CX-989',
  fecha: '04-02-26',
  hora: '21:30 hrs',
  responsable: 'P. Gómez O.',
  // [gas, LMP, guardia día, guardia noche]
  gases: [
    ['O2',  '19.5 %',   '20.0 %',   '20.3 %'],
    ['CO',  '25 PPM',   '0.09 PPM', '10 PPM'],
    ['CO2', '5000 PPM', '0.14 PPM', '0 PPM'],
    ['NO2', '3 PPM',    '0.00 PPM', '0.2 PPM'],
    ['H2S', '10 PPM',   '0.0 PPM',  '0 PPM'],
  ],
};

/** Texto "manuscrito" con leve inclinación aleatoria (marcador sobre casilla blanca). */
function manuscrito(ctx, txt, x, y, size, seed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(((seed % 7) - 3) * 0.006);   // ±~1° determinista
  ctx.fillStyle = '#14306b';
  ctx.font = `bold ${size}px "Comic Sans MS", "Segoe Print", cursive`;
  ctx.textAlign = 'center';
  ctx.fillText(txt, 0, 0);
  ctx.restore();
}

/** Logotipo SSOMA: tres triángulos ascendentes + wordmark. */
function dibujarLogoMina(ctx, x, y, escala, conTexto) {
  const cols = ['#e9edf0', '#b9c0c6', '#7f878d'];
  for (let k = 0; k < 3; k++) {
    const w = 22 * escala, h = (20 + k * 16) * escala, px = x + k * 26 * escala;
    ctx.fillStyle = cols[k];
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px + w / 2, y - h);
    ctx.lineTo(px + w, y);
    ctx.closePath();
    ctx.fill();
  }
  if (conTexto) {
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = `bold ${44 * escala}px Arial`;
    ctx.fillText('SSOMA', x + 84 * escala, y - 4 * escala);
    ctx.fillStyle = '#bfe3c2';
    ctx.font = `${11 * escala}px Arial`;
    ctx.fillText('SEGURIDAD Y MEDIO AMBIENTE', x + 86 * escala, y + 12 * escala);
  }
}

function dibujarTablero() {
  const c = document.createElement('canvas');
  c.width = 800; c.height = 600;
  const ctx = c.getContext('2d');

  const VERDE = '#1f7a34';

  // ── FONDO VERDE ─────────────────────────────────────────────────
  ctx.fillStyle = VERDE;
  ctx.fillRect(0, 0, 800, 600);
  ctx.strokeStyle = '#f2f2f2';
  ctx.lineWidth = 7;
  ctx.strokeRect(4, 4, 792, 592);

  // ── HEADER: título + logo a la derecha ──────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('MONITOREO DE GASES', 30, 62);
  dibujarLogoMina(ctx, 706, 60, 0.62, false);   // logo pequeño esquina sup. der.
  ctx.strokeStyle = '#eaeaea'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(20, 86); ctx.lineTo(780, 86); ctx.stroke();

  // ── BANDA MEDIA: logo grande (izq) + campos de cabecera (der) ────
  dibujarLogoMina(ctx, 40, 200, 1.0, true);

  const campos = [
    ['NIVEL:', REGISTRO.nivel],
    ['LABOR:', REGISTRO.labor],
    ['FECHA:', REGISTRO.fecha],
    ['HORA:',  REGISTRO.hora],
    ['RESPONSABLE:', REGISTRO.responsable],
  ];
  const fx = 300, fy0 = 104, fgap = 30, boxX = 430, boxR = 780;
  for (let i = 0; i < campos.length; i++) {
    const y = fy0 + i * fgap;
    ctx.fillStyle = '#eaf6ea';
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px Arial';
    ctx.fillText(campos[i][0], fx, y + 16);
    // Casilla blanca
    ctx.fillStyle = '#fbfdfb';
    ctx.fillRect(boxX, y, boxR - boxX, 22);
    ctx.strokeStyle = '#0e4f1e'; ctx.lineWidth = 1.5;
    ctx.strokeRect(boxX, y, boxR - boxX, 22);
    // Valor manuscrito
    manuscrito(ctx, campos[i][1], (boxX + boxR) / 2, y + 17, 16, i + 3);
  }

  // ── TABLA: GUARDIA DÍA | LMP | GUARDIA NOCHE ─────────────────────
  const colDia = [18, 300], colLmp = [300, 500], colNoc = [500, 782];
  const headY = 262, headH = 34;

  const cabecera = (label, cx) => {
    ctx.fillStyle = '#0c4718';
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(label, cx, headY + 23);
  };
  ctx.strokeStyle = '#eaeaea'; ctx.lineWidth = 2;
  ctx.strokeRect(colDia[0], headY, colNoc[1] - colDia[0], headH);
  ctx.beginPath(); ctx.moveTo(colLmp[0], headY); ctx.lineTo(colLmp[0], headY + headH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(colNoc[0], headY); ctx.lineTo(colNoc[0], headY + headH); ctx.stroke();
  ctx.fillStyle = '#dff3df';
  ctx.fillRect(colDia[0], headY, colNoc[1] - colDia[0], headH);
  cabecera('GUARDIA DÍA', (colDia[0] + colDia[1]) / 2);
  cabecera('LMP', (colLmp[0] + colLmp[1]) / 2);
  cabecera('GUARDIA NOCHE', (colNoc[0] + colNoc[1]) / 2);

  const rowY = headY + headH;                 // 296
  const rowH = (588 - rowY) / REGISTRO.gases.length;

  for (let i = 0; i < REGISTRO.gases.length; i++) {
    const gy = rowY + i * rowH;
    const [gas, lmp, dia, noche] = REGISTRO.gases[i];

    // Separadores de columna verticales
    ctx.strokeStyle = '#0e4f1e'; ctx.lineWidth = 1.5;
    for (const x of [colLmp[0], colNoc[0]]) {
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy + rowH); ctx.stroke();
    }

    // — GUARDIA DÍA: rótulo del gas + casilla blanca manuscrita —
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(gas, colDia[0] + 14, gy + rowH / 2 + 7);
    const bDiaX = colDia[0] + 82, bDiaW = colDia[1] - bDiaX - 12;
    ctx.fillStyle = '#fbfdfb';
    ctx.fillRect(bDiaX, gy + 8, bDiaW, rowH - 16);
    ctx.strokeStyle = '#0e4f1e'; ctx.lineWidth = 1.5;
    ctx.strokeRect(bDiaX, gy + 8, bDiaW, rowH - 16);
    manuscrito(ctx, dia, bDiaX + bDiaW / 2, gy + rowH / 2 + 7, 20, i + 1);

    // — LMP: valor impreso centrado (blanco sobre verde) —
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(lmp, (colLmp[0] + colLmp[1]) / 2, gy + rowH / 2 + 7);

    // — GUARDIA NOCHE: rótulo del gas + casilla blanca manuscrita —
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(gas, colNoc[0] + 14, gy + rowH / 2 + 7);
    const bNocX = colNoc[0] + 82, bNocW = colNoc[1] - bNocX - 12;
    ctx.fillStyle = '#fbfdfb';
    ctx.fillRect(bNocX, gy + 8, bNocW, rowH - 16);
    ctx.strokeStyle = '#0e4f1e'; ctx.lineWidth = 1.5;
    ctx.strokeRect(bNocX, gy + 8, bNocW, rowH - 16);
    manuscrito(ctx, noche, bNocX + bNocW / 2, gy + rowH / 2 + 7, 20, i + 4);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  g.name = 'pizarra_monitoreo';
  g.userData.solid = true;   // obstaculo solido: el jugador/NPC no lo atraviesa

  // ── Cuerpo del tablero (caja verde) ─────────────────────────────
  // `S` = grupo del SUBELEMENTO activo (discretización para el visor).
  let S = sub(g, 'cuerpo', 'Cuerpo del tablero', 'Caja verde de 1.20 × 0.90 m.');
  const tablero = new THREE.Mesh(
    new THREE.BoxGeometry(BW, BH, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x1e6b2a, roughness: 0.88, metalness: 0.04 })
  );
  tablero.position.set(0, BH / 2, 0);
  S.add(tablero);

  // ── Cara frontal con la textura completa ─────────────────────────
  S = sub(g, 'cara', 'Cara con registros', 'CanvasTexture: header, campos y tabla de gases (O2/CO/CO2/NO2/H2S).');
  const cara = new THREE.Mesh(
    new THREE.PlaneGeometry(BW - 0.01, BH - 0.01),
    new THREE.MeshStandardMaterial({ map: dibujarTablero(), roughness: 0.78 })
  );
  cara.position.set(0, BH / 2, 0.021);
  S.add(cara);

  // ── Marco de acero ───────────────────────────────────────────────
  S = sub(g, 'marco', 'Marco de acero', 'Perfiles perimetrales del tablero.');
  const mM = new THREE.MeshStandardMaterial({ color: 0x2a3428, roughness: 0.7, metalness: 0.5 });
  const t = 0.022;
  for (const [bw, bh, bx, by] of [
    [BW + t * 2, t, 0, BH], [BW + t * 2, t, 0, 0],
    [t, BH + t * 2, -BW / 2, BH / 2], [t, BH + t * 2, BW / 2, BH / 2]
  ]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.048), mM);
    b.position.set(bx, by, 0);
    S.add(b);
  }

  // ── 4 pernos de montaje ──────────────────────────────────────────
  S = sub(g, 'pernos', 'Pernos de montaje', '4 pernos de fijación a la pared.');
  const mP = new THREE.MeshStandardMaterial({ color: 0x707878, roughness: 0.5, metalness: 0.8 });
  for (const [ex, ey] of [[-BW / 2 + 0.05, 0.05], [BW / 2 - 0.05, 0.05], [-BW / 2 + 0.05, BH - 0.05], [BW / 2 - 0.05, BH - 0.05]]) {
    const pe = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.055, 6), mP);
    pe.rotation.x = Math.PI / 2;
    pe.position.set(ex, ey, 0.045);
    S.add(pe);
  }

  // ── Interactable ─────────────────────────────────────────────────
  g.userData.interactable = {
    object: tablero,
    descriptor: {
      label: 'Revisar monitoreo de gases',
      onInteract: () => window.__mina?.bus.emit('ui:read', {
        title: `MONITOREO DE GASES — NV-${REGISTRO.nivel} / ${REGISTRO.labor}`,
        body:
          REGISTRO.gases
            .map(([gas, lmp, dia, noche]) => `${gas}: día ${dia} · noche ${noche} (LMP ${lmp})`)
            .join('\n') +
          `\n\nFecha: ${REGISTRO.fecha}  ·  Hora: ${REGISTRO.hora}\n` +
          `Responsable: ${REGISTRO.responsable}\n` +
          'Si algún gas supera el LMP: evacuar de inmediato y reportar a sala de control.'
      })
    }
  };

  return g;
}
