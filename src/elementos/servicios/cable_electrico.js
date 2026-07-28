import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crear as crearAlcayata, CRADLE } from '../entorno/alcayata.js';
import { COLORES_TAG } from '../sostenimiento/perno.js';

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

  // ── TAGS DE IDENTIFICACION del circuito ────────────────────────────────────
  // En la mina oscura, un tendido de cable se lee sobre todo por sus etiquetas: grupos de
  // plaquitas de color abrazadas al cable cada pocos metros, que identifican de que tablero
  // viene y a que equipo alimenta. Son de lo primero que devuelve el headlamp al alumbrar el
  // hastial. Se colocan por GRUPOS de 2-3 colores, como el codigo real.
  const tags = _tagsCable(curve, dir);
  for (const t of tags) g.add(t);

  return g;
}

/**
 * Grupos de plaquitas de identificacion colgadas del cable. Un mesh FUSIONADO por color (no uno
 * por plaquita): comparten material cacheado, asi que el tendido entero cuesta 3-4 llamadas de
 * dibujo y ademas queda elegible para el fusor de estaticos del tramo.
 */
function _tagsCable(curve, dir) {
  const porColor = new Map();
  const largo = curve.getLength();
  // Un grupo de etiquetas cada ~7 m de tendido.
  for (let d = 3; d < largo; d += 7) {
    const t = d / largo;
    const p = curve.getPoint(t);
    const n = 2 + Math.floor(((d * 37) % 10) / 7);          // 2-3 plaquitas por grupo (determinista)
    for (let k = 0; k < n; k++) {
      const c = COLORES_TAG[Math.floor((d * 13 + k * 5)) % COLORES_TAG.length];
      const geo = new THREE.BoxGeometry(0.006, 0.055, 0.038);
      // Colgando bajo el cable, escalonadas: asi se leen como un codigo y no como un bloque.
      geo.translate(p.x + dir * 0.012, p.y - 0.045 - k * 0.052, p.z);
      if (!porColor.has(c)) porColor.set(c, []);
      porColor.get(c).push(geo);
    }
  }

  const out = [];
  for (const [c, geos] of porColor) {
    const fusion = mergeGeometries(geos);
    for (const gg of geos) gg.dispose();
    // Rugosidad baja + env-map alto: plaquita retro-reflectiva que devuelve el headlamp.
    out.push(new THREE.Mesh(fusion, MineMaterials.plano(c, { rough: 0.3, metal: 0.1 })));
  }
  return out;
}
