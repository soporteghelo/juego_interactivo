import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';

/**
 * SHOTCRETE (concreto proyectado) — panel de pared.
 * md: textura spray rugosa; envejecido con manchas de humedad; con FISURAS diagonales
 * de 2–5mm de borde negro (zona peligrosa).
 *
 * Este elemento crea un PANEL de shotcrete craquelado (fisuras pintadas via canvas) para
 * superponer sobre paredes y marcar zonas de riesgo geomecanico. Para editar el patron de
 * grietas, modifica `texturaCraquelada()`.
 */

export const meta = {
  id: 'shotcrete',
  nombre: 'Shotcrete craquelado',
  descripcion: 'Panel de concreto proyectado con fisuras diagonales (hallazgo geomecanico).'
};

function texturaCraquelada(craquelado = true) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');

  // Base de shotcrete con manchas de humedad
  ctx.fillStyle = '#bcbcb4';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    const r = 8 + Math.random() * 40;
    ctx.fillStyle = `rgba(80,80,72,${0.05 + Math.random() * 0.12})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (craquelado) {
    // Fisuras diagonales ramificadas (borde negro)
    ctx.strokeStyle = 'rgba(15,15,15,0.9)';
    const ramas = 3 + Math.floor(Math.random() * 3);
    for (let g = 0; g < ramas; g++) {
      let x = Math.random() * 256;
      let y = Math.random() * 60;
      let ang = Math.PI / 2 + (Math.random() - 0.5);
      ctx.lineWidth = 1 + Math.random() * 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const pasos = 12 + Math.floor(Math.random() * 10);
      for (let s = 0; s < pasos; s++) {
        ang += (Math.random() - 0.5) * 0.7;
        x += Math.cos(ang) * 16;
        y += Math.sin(ang) * 16;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Material de shotcrete liso (para la carcasa del tramo). */
export function materialShotcrete({ envejecido = false } = {}) {
  return MineMaterials.shotcrete(!envejecido);
}

/**
 * Panel de shotcrete craquelado.
 * @param {{width?:number, height?:number, craquelado?:boolean}} opts
 * @returns {THREE.Mesh}
 */
export function crear({ width = 3, height = 2.4, craquelado = true } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    map: texturaCraquelada(craquelado),
    roughness: 0.97,
    metalness: 0,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.name = 'shotcrete_craquelado';
  return mesh;
}
