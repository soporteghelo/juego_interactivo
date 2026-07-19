import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';

/**
 * ALCAYATA (gancho J / hook bolt) — barra de acero doblada en gancho, anclada al hastial
 * con lechada, usada para SUJETAR CABLES eléctricos a lo largo de la labor. Según fotos
 * reales de mina: varilla pintada de naranja de seguridad, forma de "J" con la
 * abertura hacia arriba donde reposa el cable, y el vástago empotrado en la roca.
 *
 * El punto donde reposa el cable se exporta como CRADLE (relativo al origen = cara del
 * hastial) para que cable_electrico.js enrute el cable por la fila de ganchos.
 */

export const meta = {
  id: 'alcayata',
  nombre: 'Alcayata (gancho para cable)',
  descripcion: 'Gancho J de acero anclado al hastial (pintado naranja) para sujetar cables eléctricos en la labor.'
};

// Punto de apoyo del cable (fondo del gancho), relativo al origen del elemento.
export const CRADLE = new THREE.Vector3(0.095, -0.125, 0);

/** Perfil de la varilla doblada: vástago empotrado (-x) → sale del hastial → gancho "J" abierto arriba. */
function perfilAlcayata() {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.10,  0.020, 0),  // ancla profunda en la roca
    new THREE.Vector3( 0.00,  0.020, 0),  // cara del hastial
    new THREE.Vector3( 0.09,  0.012, 0),  // sale recto
    new THREE.Vector3( 0.145, -0.030, 0), // empieza a curvar (lado externo)
    new THREE.Vector3( 0.145, -0.100, 0), // baja
    new THREE.Vector3( 0.100, -0.135, 0), // fondo del gancho (reposa el cable)
    new THREE.Vector3( 0.045, -0.115, 0), // sube por el lado interno
    new THREE.Vector3( 0.020, -0.060, 0)  // punta (abertura hacia arriba)
  ]);
}

export function crear() {
  const g = new THREE.Group();
  g.name = 'alcayata';

  const mat = MineMaterials.plano(0xcf4a20, { rough: 0.68, metal: 0.35 }); // acero pintado naranja
  const varilla = new THREE.Mesh(new THREE.TubeGeometry(perfilAlcayata(), 44, 0.011, 8, false), mat);
  varilla.castShadow = true;
  g.add(varilla);

  // Lechada/grout gris donde el vástago entra a la roca
  const grout = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 8, 6),
    MineMaterials.plano(0x8a8880, { rough: 1.0 })
  );
  grout.scale.set(0.55, 1.0, 1.0);
  grout.position.set(0.005, 0.02, 0);
  g.add(grout);

  return g;
}
