import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { Settings } from '../../core/Settings.js';

/**
 * MANGA DE VENTILACION — md: Ø600–1000mm, naranja/rojo brillante (activa) o cafe-oxido
 * (antigua), plastico flexible colgante por el techo de la galeria.
 *
 * VIVA: la manga ONDULA suavemente con la corriente de aire (billowing barato por
 * `userData.tick`, deformando los vertices con una onda que viaja por el ducto) y expone su
 * BOCA DE DESCARGA (`userData.ventOutlet`) para que el `VentFlowSystem` sople alli un penacho
 * de polvo/vaho — el flujo de aire se VE (evacua gases/polvo tras voladura).
 */

export const meta = {
  id: 'ventilacion',
  nombre: 'Manga de ventilacion',
  descripcion: 'Ducto flexible de aire por el techo que ondula con el flujo. Variante antigua oxidada.'
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

  // Boca de DESCARGA (extremo profundo del ducto): de aqui "sopla" el aire hacia la labor.
  mesh.userData.ventOutlet = {
    pos: new THREE.Vector3(side * 1.4, height - 0.35, -length + 0.6),
    dir: new THREE.Vector3(0, -0.12, -1).normalize()
  };

  // BILLOWING: onda viajera que ondula la manga (deforma vertices; barato). Se omite en gama
  // muy baja (heavyDetail < 0.4) donde prima el framerate — la manga queda estatica.
  if ((Settings.current.heavyDetail ?? 1) >= 0.4) {
    const posAttr = geo.attributes.position;
    const base = Float32Array.from(posAttr.array);
    const arr = posAttr.array;
    const ampX = aged ? 0.03 : 0.05, ampY = aged ? 0.022 : 0.035; // la antigua ondula menos (rigida)
    mesh.userData.tick = (dt, elapsed) => {
      const t = elapsed || 0;
      for (let i = 0; i < base.length; i += 3) {
        const z = base[i + 2];
        arr[i]     = base[i]     + Math.sin(z * 0.7 - t * 2.4) * ampX;
        arr[i + 1] = base[i + 1] + Math.cos(z * 0.6 - t * 1.9) * ampY;
      }
      posAttr.needsUpdate = true;
    };
  }
  return mesh;
}
