import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';

/**
 * MALLA SOBRESALIDA — malla metalica desprendida y abombada de la pared de la galeria.
 * Representa un peligro real de enganche o caida de roca.
 * El abombado es asimetrico (mayor en la zona central-superior) para mayor realismo.
 */
export const meta = {
  id: 'malla_sobresalida',
  nombre: 'Malla sobresalida / desprendida',
  descripcion: 'Malla metalica oxidada que sobresale de la pared — peligro de enganche y caida.'
};

/**
 * Crea la geometria de la rejilla como LineSegments sobre una superficie deformada.
 * @param {number} cols  columnas de la rejilla
 * @param {number} rows  filas de la rejilla
 * @param {function} fn  (u:0-1, v:0-1) => {x, y, z}
 */
function crearRejilla(cols, rows, fn) {
  const verts = [];
  // Lineas horizontales
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p0 = fn(c / cols, r / rows);
      const p1 = fn((c + 1) / cols, r / rows);
      verts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
    }
  }
  // Lineas verticales
  for (let c = 0; c <= cols; c++) {
    for (let r = 0; r < rows; r++) {
      const p0 = fn(c / cols, r / rows);
      const p1 = fn(c / cols, (r + 1) / rows);
      verts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return geo;
}

/**
 * @param {{side?:number, ancho?:number, alto?:number, wallX?:number}} opts
 *   side: 1 (pared derecha) | -1 (pared izquierda)
 *   wallX: distancia al eje de la galeria donde esta la pared (tipicamente halfWidth)
 */
export function crear({ side = 1, ancho = 2.2, alto = 2.1, wallX = 2.5 } = {}) {
  const g = new THREE.Group();

  // Funcion de deformacion: abombado asimetrico con detalle sinusoidal
  const fn = (u, v) => {
    const x = (u - 0.5) * ancho;
    const y = v * alto;
    const bx = (u - 0.5) * 2;
    // Bulge maximo en zona central, anclado en bordes; mayor en la parte alta
    const envX = 1 - bx * bx;
    const envV = Math.max(0, 1 - (v - 0.9) * (v - 0.9) * 3.5);
    const detalle = Math.sin(u * 11.3) * Math.cos(v * 8.6) * 0.055;
    const bulge = (envX * envV * 0.65 + detalle) * (side >= 0 ? 1 : -1);
    return { x, y, z: bulge };
  };

  // Rejilla de alambre oxido — 16x20 cuadriculas
  const matAlambre = new THREE.LineBasicMaterial({ color: 0x9a6820 });
  const rejillaGeo = crearRejilla(16, 20, fn);
  g.add(new THREE.LineSegments(rejillaGeo, matAlambre));

  // Capa de fondo semi-opaca para sombra y profundidad
  const bgGeo = new THREE.PlaneGeometry(ancho, alto, 16, 20);
  const bgPos = bgGeo.attributes.position;
  for (let i = 0; i < bgPos.count; i++) {
    const u = bgPos.getX(i) / ancho + 0.5;
    const v = bgPos.getY(i) / alto + 0.5;
    const p = fn(u, v);
    bgPos.setZ(i, p.z);
  }
  bgGeo.computeVertexNormals();
  const bg = new THREE.Mesh(
    bgGeo,
    new THREE.MeshStandardMaterial({ color: 0x6a4c18, roughness: 0.92, metalness: 0.55, transparent: true, opacity: 0.28 })
  );
  bg.position.y = alto / 2;
  g.add(bg);

  // Pernos de anclaje en las esquinas (algunos aun sujetan la malla)
  const matPerno = MineMaterials.plano(0x666660, { rough: 0.5, metal: 0.75 });
  for (const [pu, pv] of [[0.1, 0.88], [0.9, 0.82], [0.08, 0.06], [0.92, 0.10], [0.5, 0.95]]) {
    const p = fn(pu, pv);
    const perno = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.020, 0.14, 6), matPerno);
    perno.position.set(p.x, p.y, p.z);
    perno.rotation.z = (side >= 0 ? -1 : 1) * Math.PI / 2;
    g.add(perno);
  }

  // Orientar y posicionar sobre la pared lateral
  g.rotation.y = side >= 0 ? -Math.PI / 2 : Math.PI / 2;
  g.position.set(side * (wallX - 0.04), 0.3, 0);

  g.name = 'malla_sobresalida';
  g.userData.hazard = {
    tipo: 'mallaVencida',
    warn: 1.3,
    hurt: 0.5,   // enganche: lesion no fatal al contacto (no muerte)
    aviso: 'MALLA SOBRESALIDA — peligro de enganche. Aleja de la pared y reporta a geomecanica.',
    reflexion:
      'Pasaste demasiado cerca de una malla que sobresale de la pared. ' +
      'Las mallas desprendidas pueden engancharse en tu ropa o equipos y provocar caidas. ' +
      'Reporta de inmediato a geomecanica y nunca circules bajo roca sin soporte vigente.'
  };
  return g;
}
