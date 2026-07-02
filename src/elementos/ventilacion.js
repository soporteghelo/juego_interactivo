import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';

/**
 * MANGA DE VENTILACION — md: Ø600–1000mm, naranja/rojo brillante (activa) o cafe-oxido
 * (antigua), plastico flexible colgante por el techo de la galeria.
 */

export const meta = {
  id: 'ventilacion',
  nombre: 'Manga de ventilacion',
  descripcion: 'Ducto flexible de aire por el techo. Variante antigua oxidada.'
};

/**
 * @param {{length?:number, radius?:number, aged?:boolean, side?:number, height?:number}} opts
 * @returns {THREE.Mesh}
 */
export function crear({ length = 12, radius = 0.4, aged = false, side = 1, height = 4 } = {}) {
  const segs = Math.max(6, Math.round(length / 1.5));
  const path = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = -t * length;
    const sag = Math.sin(t * Math.PI * (length / 3)) * 0.08; // catenaria entre soportes
    path.push(new THREE.Vector3(side * 1.4, height - 0.2 - sag, z));
  }
  const curve = new THREE.CatmullRomCurve3(path);
  const geo = new THREE.TubeGeometry(curve, segs * 2, radius, 10, false);
  const mat = aged ? MineMaterials.plano(0x8b4513, { rough: 0.9 }) : MineMaterials.ventNaranja();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = aged ? 'ventilacion_antigua' : 'ventilacion';
  return mesh;
}
