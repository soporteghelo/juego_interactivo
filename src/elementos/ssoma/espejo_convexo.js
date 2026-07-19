import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { sub } from '../_comun/subelemento.js';

/**
 * ESPEJO CONVEXO de transito — se instala en los CRUCES CIEGOS de la mina para que
 * operadores y peatones vean el trafico que viene por la via perpendicular antes de
 * asomarse. Disco convexo pulido con marco naranja de alta visibilidad y brazo de montaje.
 *
 * El "reflejo" se sugiere con un material metalico pulido claro (sin envMap: barato y
 * suficiente bajo las luces puntuales de la mina, donde el domo capta los brillos).
 *
 * Origen = base del brazo (se ancla al hastial/esquina); el domo mira a +Z.
 */

export const meta = {
  id: 'espejo_convexo',
  nombre: 'Espejo convexo de tránsito',
  descripcion: 'Espejo convexo con marco naranja y brazo de montaje para cruces ciegos: visibilidad del tráfico perpendicular.'
};

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  const mMarco = MineMaterials.plano(0xe8641b, { rough: 0.5 });
  const mBrazo = MineMaterials.plano(0x3a3d42, { rough: 0.6, metal: 0.6 });
  const mEspejo = MineMaterials.plano(0xdfe6ea, { rough: 0.08, metal: 0.98 });
  const mDorso = MineMaterials.plano(0x2c2f33, { rough: 0.7, metal: 0.3 });

  const S = sub(g, 'espejo', 'Espejo y montaje',
    'Domo convexo pulido, marco naranja de alta visibilidad, dorso y brazo articulado de montaje.');

  // Brazo de montaje (desde el ancla hacia el frente-abajo)
  const brazo = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 8), mBrazo);
  brazo.position.set(0, -0.10, 0.16);
  brazo.rotation.x = Math.PI / 2 - 0.45;
  S.add(brazo);
  const rotula = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mBrazo);
  rotula.position.set(0, -0.19, 0.33);
  S.add(rotula);

  // Conjunto del espejo (inclinado hacia abajo, como se orienta en mina hacia la via)
  const cab = new THREE.Group();
  cab.position.set(0, -0.20, 0.36);
  cab.rotation.x = -0.35;
  // Domo convexo (casquete esferico pulido)
  const domo = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), mEspejo);
  domo.rotation.x = Math.PI / 2;
  domo.scale.z = 0.55;
  cab.add(domo);
  // Marco naranja + dorso
  const marco = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.035, 8, 22), mMarco);
  cab.add(marco);
  const dorso = new THREE.Mesh(new THREE.CircleGeometry(0.33, 22), mDorso);
  dorso.rotation.y = Math.PI;
  dorso.position.z = -0.015;
  cab.add(dorso);
  S.add(cab);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.name = 'espejo_convexo';
  return g;
}
