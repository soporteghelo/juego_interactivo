import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';

/**
 * TABLERO DE MONITOREO DE GASES AESA — pizarra verde mural.
 *
 * Fiel a la foto real (tablero verde AESA, Cerro Lindo):
 *  - Fondo verde con header "MONITOREO DE GASES" en blanco.
 *  - Logotipo AESA (triangulos) en area superior izquierda.
 *  - Campos con casillas blancas: NIVEL, LABOR, FECHA, HORA, RESPONSABLE.
 *  - Tabla de 3 columnas: GUARDIA DIA | LMP | GUARDIA NOCHE.
 *  - Filas de gases: O2 (19.5%), CO (25 PPM), CO2 (5000 PPM), NO2 (3 PPM), H2S (10 PPM).
 *  - Valores escritos a mano (estilo tipico de mina).
 *
 * INTERACTUABLE: el jugador puede leer los datos al acercarse.
 */

export const meta = {
  id: 'pizarra_monitoreo',
  nombre: 'Tablero MONITOREO DE GASES (AESA)',
  descripcion: 'Pizarra verde mural estilo AESA con registros de O2, CO, CO2, NO2, H2S y limites permisibles.'
};

const BW = 1.20; // ancho del tablero en metros
const BH = 0.90; // alto del tablero en metros

function dibujarTablero() {
  const c = document.createElement('canvas');
  c.width = 720; c.height = 540;
  const ctx = c.getContext('2d');

  // ── FONDO VERDE AESA ────────────────────────────────────────────
  ctx.fillStyle = '#1e6b2a';
  ctx.fillRect(0, 0, 720, 540);

  // Borde blanco exterior
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 714, 534);

  // ── HEADER SUPERIOR ─────────────────────────────────────────────
  ctx.fillStyle = '#1a5e22';
  ctx.fillRect(3, 3, 714, 72);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(3, 75); ctx.lineTo(717, 75); ctx.stroke();

  // Logotipo AESA (triangulos caracteristicos — lado izquierdo del header)
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(20, 65); ctx.lineTo(50, 15); ctx.lineTo(80, 65); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d4aa00';
  ctx.beginPath(); ctx.moveTo(38, 65); ctx.lineTo(58, 35); ctx.lineTo(78, 65); ctx.closePath(); ctx.fill();

  // Texto AESA
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('AESA', 86, 44);
  ctx.font = '10px Arial';
  ctx.fillStyle = '#c8e8c0';
  ctx.fillText('Cerro Lindo', 86, 60);

  // Titulo principal
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('MONITOREO DE GASES', 400, 48);

  // ── CAMPOS DE INFORMACION (NIVEL, LABOR, FECHA, HORA, RESPONSABLE) ──
  const campos = [
    ['NIVEL:', 'NV-1600'],
    ['LABOR:', 'GL CX.081'],
    ['FECHA:', '30/06/2026'],
    ['HORA:', '07:00'],
  ];
  const cx0 = 20, cy0 = 95, cw = 310, ch = 20, gap = 28;
  ctx.font = 'bold 12px Arial';
  for (let i = 0; i < campos.length; i++) {
    const cy = cy0 + i * gap;
    ctx.fillStyle = '#d0eed0';
    ctx.textAlign = 'left';
    ctx.fillText(campos[i][0], cx0, cy + 15);
    // Casilla blanca
    ctx.fillStyle = '#f0f4f0';
    ctx.fillRect(cx0 + 70, cy, cw - 70, ch);
    ctx.strokeStyle = '#4a8a4a';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx0 + 70, cy, cw - 70, ch);
    // Valor escrito
    ctx.fillStyle = '#1a3a28';
    ctx.font = 'italic 11px Arial';
    ctx.fillText(campos[i][1], cx0 + 76, cy + 14);
    ctx.font = 'bold 12px Arial';
  }
  // RESPONSABLE (campo largo en segunda columna)
  ctx.fillStyle = '#d0eed0';
  ctx.textAlign = 'left';
  ctx.fillText('RESPONSABLE:', 380, cy0 + 15);
  ctx.fillStyle = '#f0f4f0';
  ctx.fillRect(380, cy0, 330, 20);
  ctx.strokeStyle = '#4a8a4a'; ctx.lineWidth = 1;
  ctx.strokeRect(380, cy0, 330, 20);
  ctx.fillStyle = '#1a3a28'; ctx.font = 'italic 11px Arial';
  ctx.fillText('Ing. J. Quispe Mamani', 386, cy0 + 14);

  // ── TABLA DE GASES ───────────────────────────────────────────────
  const tableY = 208;
  const rowH   = 42;
  const col = [20, 260, 400, 560]; // columnas: GAS, DIA, LMP, NOCHE

  // Header de tabla
  ctx.fillStyle = '#0d4a1a';
  ctx.fillRect(20, tableY - 28, 690, 28);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('GAS', 100, tableY - 8);
  ctx.fillText('GUARDIA DIA', 330, tableY - 8);
  ctx.fillText('LMP', 480, tableY - 8);
  ctx.fillText('GUARDIA NOCHE', 625, tableY - 8);

  // Lineas de columnas del header
  for (const x of [col[1], col[2], col[3]]) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, tableY - 28); ctx.lineTo(x, tableY); ctx.stroke();
  }

  // Datos de gases: [nombre, unidad, dia, LMP, noche, colorFila]
  const GASES = [
    ['O2',  '%',   '20.8',  '19.5 %',  '20.6', '#e8f8e8'],
    ['CO',  'PPM', '12',    '25 PPM',  '15',   '#e8f8e8'],
    ['CO2', 'PPM', '380',   '5000 PPM','410',  '#e8f8e8'],
    ['NO2', 'PPM', '0.2',   '3 PPM',   '0.3',  '#e8f8e8'],
    ['H2S', 'PPM', '0',     '10 PPM',  '0',    '#e8f8e8'],
  ];

  for (let i = 0; i < GASES.length; i++) {
    const gy = tableY + i * rowH;
    const [gas, unidad, dia, lmp, noche, bgColor] = GASES[i];

    // Fondo alterno
    ctx.fillStyle = i % 2 === 0 ? bgColor : '#d4ecd4';
    ctx.fillRect(20, gy, 690, rowH);

    // Lineas de fila
    ctx.strokeStyle = '#4a8a4a'; ctx.lineWidth = 1;
    ctx.strokeRect(20, gy, 690, rowH);
    for (const x of [col[1], col[2], col[3]]) {
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy + rowH); ctx.stroke();
    }

    // Nombre del gas (grande, estilo panel)
    ctx.fillStyle = '#0a2a14';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(gas, 90, gy + 26);
    ctx.font = '10px Arial';
    ctx.fillText(unidad, 90, gy + 38);

    // Casilla blanca GUARDIA DIA (valor escrito a mano)
    ctx.fillStyle = '#fff';
    ctx.fillRect(col[1] + 10, gy + 6, 115, rowH - 12);
    ctx.strokeStyle = '#4a8a4a'; ctx.lineWidth = 1;
    ctx.strokeRect(col[1] + 10, gy + 6, 115, rowH - 12);
    ctx.fillStyle = '#1a1a44';
    ctx.font = 'italic bold 17px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(dia, col[1] + 68, gy + 28);

    // LMP (en rojo si es limite)
    ctx.fillStyle = '#cc2200';
    ctx.font = 'bold 13px Arial';
    ctx.fillText(lmp, col[2] + 80, gy + 26);

    // Casilla blanca GUARDIA NOCHE
    ctx.fillStyle = '#fff';
    ctx.fillRect(col[3] + 10, gy + 6, 140, rowH - 12);
    ctx.strokeStyle = '#4a8a4a'; ctx.lineWidth = 1;
    ctx.strokeRect(col[3] + 10, gy + 6, 140, rowH - 12);
    ctx.fillStyle = '#1a1a44';
    ctx.font = 'italic bold 17px Arial';
    ctx.fillText(noche, col[3] + 80, gy + 28);
  }

  // ── PIE DE TABLA ────────────────────────────────────────────────
  const footY = tableY + GASES.length * rowH + 8;
  ctx.fillStyle = '#c8eed0';
  ctx.font = '11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('LMP = Limite Maximo Permisible  ·  Valores en guardia de 07:00 – 19:00', 360, footY + 16);
  ctx.fillText('AESA — Sistema de Gestion de Seguridad y Salud Ocupacional', 360, footY + 30);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  g.name = 'pizarra_monitoreo';

  // ── Cuerpo del tablero (caja verde) ─────────────────────────────
  const tablero = new THREE.Mesh(
    new THREE.BoxGeometry(BW, BH, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x1e6b2a, roughness: 0.88, metalness: 0.04 })
  );
  tablero.position.set(0, BH / 2, 0);
  g.add(tablero);

  // ── Cara frontal con la textura completa ─────────────────────────
  const cara = new THREE.Mesh(
    new THREE.PlaneGeometry(BW - 0.01, BH - 0.01),
    new THREE.MeshStandardMaterial({ map: dibujarTablero(), roughness: 0.78 })
  );
  cara.position.set(0, BH / 2, 0.021);
  g.add(cara);

  // ── Marco de acero ───────────────────────────────────────────────
  const mM = new THREE.MeshStandardMaterial({ color: 0x2a3428, roughness: 0.7, metalness: 0.5 });
  const t = 0.022;
  for (const [bw, bh, bx, by] of [
    [BW + t * 2, t, 0, BH], [BW + t * 2, t, 0, 0],
    [t, BH + t * 2, -BW / 2, BH / 2], [t, BH + t * 2, BW / 2, BH / 2]
  ]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.048), mM);
    b.position.set(bx, by, 0);
    g.add(b);
  }

  // ── 4 pernos de montaje ──────────────────────────────────────────
  const mP = new THREE.MeshStandardMaterial({ color: 0x707878, roughness: 0.5, metalness: 0.8 });
  for (const [ex, ey] of [[-BW / 2 + 0.05, 0.05], [BW / 2 - 0.05, 0.05], [-BW / 2 + 0.05, BH - 0.05], [BW / 2 - 0.05, BH - 0.05]]) {
    const pe = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.055, 6), mP);
    pe.rotation.x = Math.PI / 2;
    pe.position.set(ex, ey, 0.045);
    g.add(pe);
  }

  // ── Interactable ─────────────────────────────────────────────────
  g.userData.interactable = {
    object: tablero,
    descriptor: {
      label: 'Revisar monitoreo de gases',
      onInteract: () => window.__mina?.bus.emit('ui:read', {
        title: 'MONITOREO DE GASES — NV-1600 / CX.081',
        body:
          'O2: 20.8% (LMP 19.5%) — NORMAL\n' +
          'CO: 12 PPM (LMP 25 PPM) — NORMAL\n' +
          'CO2: 380 PPM (LMP 5000 PPM) — NORMAL\n' +
          'NO2: 0.2 PPM (LMP 3 PPM) — NORMAL\n' +
          'H2S: 0 PPM (LMP 10 PPM) — NORMAL\n\n' +
          'Responsable: Ing. J. Quispe Mamani\n' +
          'Si algun gas supera el LMP: evacuar de inmediato y reportar a sala de control.'
      })
    }
  };

  return g;
}
