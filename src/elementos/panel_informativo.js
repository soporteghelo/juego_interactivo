import * as THREE from 'three';

/**
 * PANEL INFORMATIVO AESA — tablero mural verde con bolsillos de documentos.
 *
 * Basado en la foto real: tabla verde (~1.4m x 1.0m) montada en pared, header
 * "AESA: NUESTROS VALORES", dos filas de bolsillos porta-documentos con etiquetas:
 *   Fila 1: POLITICAS | IPERC-MAPA DE RIESGO | ESTANDARES | PROCEDIMIENTOS | ESTADISTICAS
 *   Fila 2: GESTION AMBIENTAL | PLAN DE RESPUESTA A EMERGENCIAS | PLANO TOPOGRAFICO | PLANO GEOMECANICO | HERRAMIENTAS DE GESTION
 */

export const meta = {
  id: 'panel_informativo',
  nombre: 'Panel informativo AESA (valores y documentos)',
  descripcion: 'Tablero verde de pared con bolsillos de documentos (POLITICAS, IPERC, ESTANDARES, PROCEDIMIENTOS).'
};

const W = 1.40; // ancho total
const H = 1.00; // alto total

const FILA1 = ['POLITICAS', 'IPERC\nMAPA RIESGO', 'ESTANDARES', 'PROCED-\nIMIENTOS', 'ESTADIS-\nTICAS'];
const FILA2 = ['GESTION\nAMBIENTAL', 'PLAN RESP.\nEMERGENCIAS', 'PLANO\nTOPOGRAFICO', 'PLANO\nGEOMEC.', 'HERRAM.\nGESTION'];

function buildTexture() {
  const c = document.createElement('canvas');
  c.width = 700; c.height = 500;
  const ctx = c.getContext('2d');

  // Fondo verde AESA
  ctx.fillStyle = '#1a6b32';
  ctx.fillRect(0, 0, 700, 500);

  // Borde dorado
  ctx.strokeStyle = '#d4aa00';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 692, 492);

  // Header AESA
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('AESA: NUESTROS VALORES', 350, 44);

  // Sub-texto valores
  ctx.font = '13px Arial';
  ctx.fillStyle = '#c8e8c0';
  ctx.fillText('Seguridad · Integridad · Calidad · Compromiso · Trabajo en Equipo', 350, 66);

  // Linea separadora
  ctx.strokeStyle = '#d4aa00';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(20, 78); ctx.lineTo(680, 78); ctx.stroke();

  // Titulo filas
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('DOCUMENTOS DEL SISTEMA DE GESTION:', 20, 100);

  // Bolsillos fila 1
  const pw = 116, ph = 150;
  for (let i = 0; i < FILA1.length; i++) {
    const bx = 18 + i * (pw + 8);
    const by = 112;
    // Bolsillo gris
    ctx.fillStyle = '#b0b8b4';
    ctx.fillRect(bx, by, pw, ph);
    // Papel visible dentro
    ctx.fillStyle = '#f4f4f0';
    ctx.fillRect(bx + 4, by + 30, pw - 8, ph - 34);
    // Etiqueta superior del bolsillo
    ctx.fillStyle = '#1a3a28';
    ctx.fillRect(bx, by, pw, 28);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    const lines = FILA1[i].split('\n');
    lines.forEach((l, li) => ctx.fillText(l, bx + pw / 2, by + 11 + li * 12));
    // Sombra bolsillo
    ctx.strokeStyle = '#7a8a84';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, pw, ph);
  }

  // Bolsillos fila 2
  for (let i = 0; i < FILA2.length; i++) {
    const bx = 18 + i * (pw + 8);
    const by = 278;
    ctx.fillStyle = '#b0b8b4';
    ctx.fillRect(bx, by, pw, ph);
    ctx.fillStyle = '#f4f4f0';
    ctx.fillRect(bx + 4, by + 30, pw - 8, ph - 34);
    ctx.fillStyle = '#1a3a28';
    ctx.fillRect(bx, by, pw, 28);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    const lines = FILA2[i].split('\n');
    lines.forEach((l, li) => ctx.fillText(l, bx + pw / 2, by + 11 + li * 12));
    ctx.strokeStyle = '#7a8a84';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, pw, ph);
  }

  // Pie de pagina
  ctx.fillStyle = '#c8e8c0';
  ctx.font = '11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('AESA — Compañia Minera / Cerro Lindo — NEXA Resources', 350, 486);

  return new THREE.CanvasTexture(c);
}

export function crear() {
  const g = new THREE.Group();
  g.name = 'panel_informativo';

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
        title: 'AESA: NUESTROS VALORES',
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
