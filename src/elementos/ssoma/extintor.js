import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';

/**
 * EXTINTOR DE INCENDIOS — cilindro rojo con abrazadera metalica y tarjeta de
 * inspeccion colgante (como se ve en los equipos de la mina).
 * Se monta verticalmente; usar ry para orientar la boquilla.
 */
export const meta = {
  id: 'extintor',
  nombre: 'Extintor con tarjeta de inspeccion',
  descripcion: 'Extintor rojo ABC montado en abrazadera con tarjeta de inspeccion colgante.'
};

/**
 * @param {{x?:number, y?:number, z?:number, ry?:number}} opts
 * @returns {THREE.Group}
 */
export function crear({ x = 0, y = 0, z = 0, ry = 0 } = {}) {
  const g = new THREE.Group();

  const mRojo  = MineMaterials.plano(0xbb1100, { rough: 0.55, metal: 0.35 });
  const mNegro = MineMaterials.plano(0x1a1a1a, { rough: 0.75, metal: 0.45 });
  const mAce   = MineMaterials.plano(0x8a8a88, { rough: 0.40, metal: 0.75 });
  const mCard  = MineMaterials.plano(0xf0ecd8, { rough: 0.95, metal: 0 });

  // Cuerpo principal (cilindro rojo)
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.085, 0.50, 12), mRojo);
  cuerpo.position.y = 0.27;
  g.add(cuerpo);

  // Base disco
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 12), mNegro);
  base.position.y = 0.02;
  g.add(base);

  // Cuello / valvula superior
  const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.055, 0.10, 8), mNegro);
  cuello.position.y = 0.56;
  g.add(cuello);

  // Manija de la valvula
  const manija = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.022, 0.022), mNegro);
  manija.position.y = 0.64;
  g.add(manija);

  // Manguera con boquilla (curva hacia adelante-abajo)
  const manguera = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 6), mNegro);
  manguera.rotation.z = Math.PI / 3.5;
  manguera.position.set(0.10, 0.22, 0);
  g.add(manguera);
  const boquilla = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.06, 6), mNegro);
  boquilla.rotation.z = -Math.PI / 2.8;
  boquilla.position.set(0.20, 0.12, 0);
  g.add(boquilla);

  // Abrazadera metalica (bracket)
  const abr = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.032), mAce);
  abr.position.set(0, 0.38, -0.06);
  g.add(abr);
  for (const xs of [-0.09, 0.09]) {
    const perno = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 5), mAce);
    perno.position.set(xs, 0.38, -0.10);
    perno.rotation.x = Math.PI / 2;
    g.add(perno);
  }

  // Tarjeta de inspeccion colgante
  const cordel = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.10, 4), mNegro);
  cordel.position.set(0.06, 0.58, 0.07);
  cordel.rotation.z = 0.30;
  g.add(cordel);

  const tarjeta = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.090, 0.004), mCard);
  tarjeta.position.set(0.07, 0.51, 0.09);
  tarjeta.rotation.set(0.15, -0.30, 0.12);
  g.add(tarjeta);

  // Lineas de inspeccion simuladas sobre la tarjeta
  const mLinea = MineMaterials.plano(0x777777, { rough: 0.9 });
  for (let i = 0; i < 4; i++) {
    const linea = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.006, 0.005), mLinea);
    linea.position.set(0.07, 0.535 - i * 0.016, 0.093);
    linea.rotation.set(0.15, -0.30, 0.12);
    g.add(linea);
  }

  g.position.set(x, y, z);
  g.rotation.y = ry;
  g.name = 'extintor';
  return g;
}
