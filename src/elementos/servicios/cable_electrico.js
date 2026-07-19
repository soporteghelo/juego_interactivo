import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crear as crearAlcayata, CRADLE } from '../entorno/alcayata.js';

/**
 * CABLE ELÉCTRICO EN ALCAYATAS — tendido de cable de energía a lo largo de la labor,
 * sujeto al hastial mediante una fila de ALCAYATAS (ganchos J). El cable reposa en el
 * fondo de cada gancho y forma CATENARIA (comba) entre ellos, como en las fotos reales.
 *
 * Se construye a lo largo de -Z (dirección de la galería), con los ganchos anclados en
 * el hastial (x=0) y el cable colgando ~0.1 m afuera. Al colocar en el mundo se rota/posiciona
 * como cualquier prop de pared (rotation.y = ±π/2 en x = ±semiancho).
 *
 * `side`: +1 = hastial derecho (ganchos hacia -x), -1 = hastial izquierdo (ganchos hacia +x).
 *
 * @param {{length?:number, alturaHook?:number, spacing?:number, sag?:number, color?:number, side?:number}} opts
 */

export const meta = {
  id: 'cable_electrico',
  nombre: 'Cable eléctrico en alcayatas',
  descripcion: 'Tendido de cable de energía sujeto al hastial con alcayatas (ganchos J), con comba entre ganchos.'
};

export function crear({ length = 12, alturaHook = 1.5, spacing = 2.0, sag = 0.14, color = 0xa5482a, side = -1 } = {}) {
  const g = new THREE.Group();
  g.name = 'cable_electrico';

  // dir = dirección x hacia la que apuntan los ganchos (interior del túnel).
  const dir = side >= 0 ? -1 : 1;
  const flip = dir < 0;

  const nTramos = Math.max(2, Math.round(length / spacing));
  const hookZs = [];
  for (let i = 0; i <= nTramos; i++) {
    const z = -(i / nTramos) * length;
    hookZs.push(z);
    const a = crearAlcayata();
    if (flip) a.rotation.y = Math.PI;   // ganchos hacia -x (hastial derecho)
    a.position.set(0, alturaHook, z);
    g.add(a);
  }

  // Cable con catenaria: pasa por el fondo de cada gancho (CRADLE) y comba entre ganchos.
  const cx = CRADLE.x * dir;
  const cy = alturaHook + CRADLE.y;
  const pts = [];
  for (let i = 0; i < hookZs.length; i++) {
    pts.push(new THREE.Vector3(cx, cy, hookZs[i]));                       // apoyo en el gancho
    if (i < hookZs.length - 1) {
      const zmid = (hookZs[i] + hookZs[i + 1]) / 2;
      pts.push(new THREE.Vector3(cx + 0.02 * dir, cy - sag, zmid));       // comba (cuelga afuera)
    }
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const cableMat = MineMaterials.plano(color, { rough: 0.6, metal: 0.1 });
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, hookZs.length * 10, 0.022, 8, false), cableMat);
  cable.castShadow = true;
  g.add(cable);

  return g;
}
