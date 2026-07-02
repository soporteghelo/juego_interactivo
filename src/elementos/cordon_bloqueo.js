import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';

/**
 * CORDON DE BLOQUEO CON ALCAYATAS EN C
 * Implementacion de alcayatas en 'C' ancladas en la roca con cordon naranja tensado entre
 * ellas y señal PELIGRO NO INGRESAR al centro. Delimita zonas peligrosas / labores bloqueadas.
 *
 * Basado en la practica real de la mina: alcayatas C forjadas clavadas en la roca (paredes
 * o hastiales), con cordon naranja de 6mm a dos alturas y señal roja centrada.
 */
export const meta = {
  id: 'cordon_bloqueo',
  nombre: 'Cordon de bloqueo con alcayatas en C',
  descripcion: 'Alcayatas en C + dos cordones naranjas + señal PELIGRO NO INGRESAR. Delimita labores.'
};

/** Alcayata en C: vastago + curva TorusGeometry de media vuelta. */
function crearAlcayata(mat) {
  const g = new THREE.Group();
  // Vastago (va dentro de la roca)
  const vastago = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), mat);
  vastago.position.y = 0.09;
  g.add(vastago);
  // Gancho curvo en C
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.013, 6, 12, Math.PI), mat);
  hook.rotation.z = -Math.PI / 2;
  hook.position.set(0.055, 0.18, 0);
  g.add(hook);
  return g;
}

/**
 * @param {{ancho?:number, alturaCinta?:number}} opts
 *   ancho          — ancho del tunel en metros (distancia entre paredes)
 *   alturaCinta    — altura del primer cordon desde el suelo (m)
 */
export function crear({ ancho = 5.0, alturaCinta = 1.05 } = {}) {
  const g = new THREE.Group();

  const matAce    = MineMaterials.plano(0x888886, { rough: 0.45, metal: 0.80 });
  const matCinta  = new THREE.MeshStandardMaterial({
    color: 0xff5500, emissive: 0x441100, emissiveIntensity: 0.25, roughness: 0.65
  });
  const matSenal  = MineMaterials.plano(0xcc0000, { rough: 0.60, metal: 0 });
  const matBlanco = MineMaterials.plano(0xffffff, { rough: 0.90, metal: 0 });

  const halfA = ancho / 2;

  // Alcayatas: una en cada pared
  for (const sx of [-1, 1]) {
    const alc = crearAlcayata(matAce);
    alc.rotation.y = sx === 1 ? -Math.PI / 2 : Math.PI / 2;
    alc.position.set(sx * halfA, alturaCinta, 0);
    g.add(alc);
    // Segunda alcayata (para el cordon alto)
    const alc2 = crearAlcayata(matAce);
    alc2.rotation.y = sx === 1 ? -Math.PI / 2 : Math.PI / 2;
    alc2.position.set(sx * halfA, alturaCinta + 0.28, 0);
    g.add(alc2);
  }

  // Genera curva catenaria entre dos puntos
  function makeCord(y0) {
    const pts = [];
    const segs = 24;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = -halfA + t * ancho;
      const sag = Math.cosh((t - 0.5) * 2.8) * 0.028 - 0.028;
      pts.push(new THREE.Vector3(x, y0 + sag, 0));
    }
    return new THREE.CatmullRomCurve3(pts);
  }

  // Cordon inferior
  const c1 = new THREE.Mesh(
    new THREE.TubeGeometry(makeCord(alturaCinta), 24, 0.018, 6, false),
    matCinta
  );
  g.add(c1);

  // Cordon superior
  const c2 = new THREE.Mesh(
    new THREE.TubeGeometry(makeCord(alturaCinta + 0.28), 24, 0.018, 6, false),
    matCinta
  );
  g.add(c2);

  // Señal PELIGRO NO INGRESAR — cuelga del cordon inferior al centro
  const senal = new THREE.Group();

  // Fondo rojo
  const fondo = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.38, 0.016), matSenal);
  senal.add(fondo);
  // Borde blanco
  const borde = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.35, 0.004), matBlanco);
  borde.position.z = 0.010;
  senal.add(borde);
  // Bloque texto "PELIGRO" (banda blanca superior)
  const txt1 = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.09, 0.004), matSenal);
  txt1.position.set(0, 0.09, 0.012);
  senal.add(txt1);
  // Bloque texto "NO INGRESAR" (banda blanca inferior)
  const txt2 = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.09, 0.004), matSenal);
  txt2.position.set(0, -0.06, 0.012);
  senal.add(txt2);

  // Cordelillo de suspension
  const cordelGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.12, 4);
  const cordel = new THREE.Mesh(cordelGeo, MineMaterials.plano(0x1a1a1a, { rough: 0.9 }));
  cordel.position.set(0, alturaCinta - 0.24, 0.01);
  g.add(cordel);

  senal.position.set(0, alturaCinta - 0.42, 0.02);
  g.add(senal);

  g.name = 'cordon_bloqueo';
  return g;
}
