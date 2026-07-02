import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';

/**
 * BALIZA / DELINEADOR DE TRAFICO — md: poste cilindrico ~80cm, bandas reflectivas
 * (rojo-blanco arriba, azul, amarillo, verde abajo), base de concreto Ø30cm. Marca el
 * borde del carril.
 */

export const meta = {
  id: 'baliza',
  nombre: 'Baliza / delineador',
  descripcion: 'Poste reflectivo de borde de carril, base de concreto.'
};

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.18, 0.12, 10),
    MineMaterials.plano(0x9a9a92, { rough: 1 })
  );
  base.position.y = 0.06;
  g.add(base);

  const bandas = [
    { c: 0x2e7d32, h: 0.16 }, // verde
    { c: 0xffdd00, h: 0.16 }, // amarillo
    { c: 0x0d47a1, h: 0.16 }, // azul
    { c: 0xf0f0f0, h: 0.16 }, // blanco
    { c: 0xcc0000, h: 0.16 }  // rojo
  ];
  let y = 0.12;
  for (const b of bandas) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, b.h, 8),
      MineMaterials.plano(b.c, { rough: 0.5, emissive: b.c, emissiveIntensity: 0.3 })
    );
    seg.position.y = y + b.h / 2;
    g.add(seg);
    y += b.h;
  }

  g.name = 'baliza';
  return g;
}
