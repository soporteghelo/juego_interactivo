import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { Settings } from '../../core/Settings.js';
import { sub } from '../_comun/subelemento.js';

/**
 * MANGA DE VENTILACION — md: Ø600–1000mm, naranja/rojo brillante (activa) o cafe-oxido
 * (antigua), plastico flexible colgante por el techo de la galeria.
 *
 * Una manga real NO flota: va COLGADA de la boveda por estrobos/cadenas cada pocos metros, se
 * arma por tramos unidos con ACOPLES (bridas), y en labor de sostenimiento acaba cubierta de
 * SALPICADURA BLANCA de shotcrete. Donde el circuito de aire se ramifica queda ademas la manga
 * VIEJA del ramal anterior, oxidada y rasgada, colgando muerta al lado de la activa.
 *
 * VIVA: la manga ONDULA suavemente con la corriente de aire (billowing barato por
 * `userData.tick`, deformando los vertices con una onda que viaja por el ducto) y expone su
 * BOCA DE DESCARGA (`userData.ventOutlet`) para que el `VentFlowSystem` sople alli un penacho
 * de polvo/vaho — el flujo de aire se VE (evacua gases/polvo tras voladura).
 */

export const meta = {
  id: 'ventilacion',
  nombre: 'Manga de ventilacion',
  descripcion: 'Ducto flexible colgado de la boveda por estrobos, con acoples de tramo y salpicadura de shotcrete. Ondula con el flujo. Variante antigua oxidada y ramal rasgado.'
};

/** Separacion entre acoples de tramo (la manga se arma en tramos de ~5 m). */
const PASO_ACOPLE = 5;
/** Separacion entre estrobos de suspension a la boveda. */
const PASO_ESTROBO = 3;

/**
 * @param {{length?:number, radius?:number, aged?:boolean, side?:number, height?:number,
 *          ramal?:boolean, seed?:number}} opts
 * @returns {THREE.Group}
 */
export function crear({
  length = 12, radius = 0.4, aged = false, side = 1, height = 4, ramal = false, seed = 1
} = {}) {
  const g = new THREE.Group();
  g.name = aged ? 'ventilacion_antigua' : 'ventilacion';

  const xDucto = side * 1.4;
  const yDucto = height - 0.2;

  // ── DUCTO PRINCIPAL ────────────────────────────────────────────────────────
  const segs = Math.max(6, Math.round(length / 1.5));
  const path = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const sag = Math.sin(t * Math.PI * (length / 3)) * 0.08; // catenaria entre soportes
    path.push(new THREE.Vector3(xDucto, yDucto - sag, -t * length));
  }
  const curve = new THREE.CatmullRomCurve3(path);
  const geoDucto = new THREE.TubeGeometry(curve, segs * 2, radius, 10, false);

  // ── ACOPLES DE TRAMO (bridas) ──────────────────────────────────────────────
  // Se FUSIONAN en la geometria del ducto en vez de ir como mallas aparte: asi el billowing
  // (que desplaza cada vertice en funcion de su z) los arrastra con la manga y quedan siempre
  // pegados, y ademas no cuestan ni una llamada de dibujo extra.
  const piezas = [geoDucto];
  for (let z = -PASO_ACOPLE; z > -length; z -= PASO_ACOPLE) {
    const t = -z / length;
    const p = curve.getPoint(t);
    const brida = new THREE.CylinderGeometry(radius * 1.14, radius * 1.14, 0.09, 12, 1, true);
    brida.rotateX(Math.PI / 2);
    brida.translate(p.x, p.y, p.z);
    piezas.push(brida);
  }
  const geo = piezas.length > 1 ? mergeGeometries(piezas) : geoDucto;
  if (piezas.length > 1) for (let i = 1; i < piezas.length; i++) piezas[i].dispose();

  const mat = aged ? MineMaterials.plano(0x8b4513, { rough: 0.9 }) : MineMaterials.mangaVent();
  const ducto = new THREE.Mesh(geo, mat);
  ducto.name = 'manga_ducto';
  sub(g, 'ducto', 'Manga y acoples', 'Ducto flexible de lona plastificada con bridas de union cada 5 m.').add(ducto);

  // ── SUSPENSION: estrobos de acero a la boveda + abrazadera en la manga ──────
  // Todo en UNA geometria fusionada: la manga se cuelga cada ~3 m y sin esto el ducto "flota",
  // que es el detalle que mas delata un modelo de mina.
  if ((Settings.current.heavyDetail ?? 1) >= 0.5) {
    const estrobos = [];
    for (let z = -1.5; z > -length; z -= PASO_ESTROBO) {
      const t = Math.min(1, -z / length);
      const p = curve.getPoint(t);
      // Abrazadera: anillo que rodea la manga por arriba.
      const abraz = new THREE.TorusGeometry(radius * 1.06, 0.016, 4, 10, Math.PI * 1.25);
      abraz.rotateY(Math.PI / 2);
      abraz.rotateZ(-Math.PI * 0.12);
      abraz.translate(p.x, p.y, p.z);
      estrobos.push(abraz);
      // Tirante hasta la boveda (ligeramente inclinado hacia el eje del tunel).
      const yAncla = height + 0.12;
      const xAncla = xDucto - side * 0.35;
      const largo = Math.hypot(yAncla - (p.y + radius), xAncla - p.x);
      const tirante = new THREE.CylinderGeometry(0.011, 0.011, largo, 4);
      tirante.rotateZ(Math.atan2(xAncla - p.x, yAncla - (p.y + radius)) * -1);
      tirante.translate((p.x + xAncla) / 2, (p.y + radius + yAncla) / 2, p.z);
      estrobos.push(tirante);
      // Grillete en el anclaje a la roca.
      const grillete = new THREE.TorusGeometry(0.05, 0.012, 4, 8);
      grillete.rotateY(Math.PI / 2);
      grillete.translate(xAncla, yAncla - 0.05, p.z);
      estrobos.push(grillete);
    }
    if (estrobos.length) {
      const fusion = mergeGeometries(estrobos);
      for (const e of estrobos) e.dispose();
      const susp = new THREE.Mesh(fusion, MineMaterials.aceroOxidado());
      susp.name = 'manga_suspension';
      sub(g, 'suspension', 'Estrobos de suspension',
        'Abrazaderas, tirantes de acero y grilletes que cuelgan la manga de la boveda cada 3 m.').add(susp);
    }
  }

  // ── RAMAL MUERTO: manga vieja oxidada y RASGADA colgando del empalme ────────
  if (ramal) {
    const rg = _ramalRasgado({ radius, xDucto, yDucto, side, seed });
    sub(g, 'ramal', 'Ramal en desuso',
      'Manga antigua del ramal anterior: oxidada, descolgada y con el extremo rasgado.').add(rg);
  }

  // Boca de DESCARGA (extremo profundo del ducto): de aqui "sopla" el aire hacia la labor.
  g.userData.ventOutlet = {
    pos: new THREE.Vector3(xDucto, height - 0.35, -length + 0.6),
    dir: new THREE.Vector3(0, -0.12, -1).normalize()
  };

  // BILLOWING: onda viajera que ondula la manga (deforma vertices; barato). Se omite en gama
  // muy baja (heavyDetail < 0.4) donde prima el framerate — la manga queda estatica.
  if ((Settings.current.heavyDetail ?? 1) >= 0.4) {
    const posAttr = geo.attributes.position;
    const base = Float32Array.from(posAttr.array);
    const arr = posAttr.array;
    const ampX = aged ? 0.03 : 0.05, ampY = aged ? 0.022 : 0.035; // la antigua ondula menos (rigida)
    g.userData.tick = (dt, elapsed) => {
      const t = elapsed || 0;
      for (let i = 0; i < base.length; i += 3) {
        const z = base[i + 2];
        arr[i]     = base[i]     + Math.sin(z * 0.7 - t * 2.4) * ampX;
        arr[i + 1] = base[i + 1] + Math.cos(z * 0.6 - t * 1.9) * ampY;
      }
      posAttr.needsUpdate = true;
    };
  }
  return g;
}

/**
 * Tramo de manga ABANDONADA que sale del empalme y cuelga muerta: baja en curva, pierde
 * seccion (la lona se descolgo sobre si misma) y termina en un extremo RASGADO de bordes
 * irregulares. Es la pieza que aparece en toda labor donde el circuito de aire cambio de
 * ramal y nadie retiro la manga vieja.
 */
function _ramalRasgado({ radius, xDucto, yDucto, side, seed }) {
  let s = seed & 0xffff;
  const rnd = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };

  const z0 = -2.2 - rnd() * 3;
  const pts = [
    new THREE.Vector3(xDucto, yDucto, z0),
    new THREE.Vector3(xDucto - side * 0.55, yDucto - 0.15, z0 - 0.7),
    new THREE.Vector3(xDucto - side * 1.15, yDucto - 0.55, z0 - 1.25),
    new THREE.Vector3(xDucto - side * 1.5, yDucto - 1.15, z0 - 1.55)
  ];
  const curva = new THREE.CatmullRomCurve3(pts);
  // Radio decreciente: la manga muerta se estrangula al descolgarse.
  const geo = new THREE.TubeGeometry(curva, 18, radius * 0.92, 9, false);
  const pos = geo.attributes.position;
  const fin = pts[pts.length - 1];
  for (let i = 0; i < pos.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(pos, i);
    const d = p.distanceTo(fin);
    // Estrangulamiento hacia el extremo + DESGARRO: los ultimos 40 cm se abren en jirones.
    if (d < 0.75) {
      const k = 1 - (0.75 - d) * 0.45;
      p.lerp(new THREE.Vector3(fin.x, p.y, fin.z), (0.75 - d) * 0.30);
      p.y = fin.y + (p.y - fin.y) * k;
    }
    if (d < 0.40) {
      p.x += (rnd() - 0.5) * 0.16;
      p.y += (rnd() - 0.5) * 0.16;
      p.z += (rnd() - 0.5) * 0.16;
    }
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, MineMaterials.plano(0x7a4a2a, { rough: 0.94, metal: 0.05 }));
  mesh.name = 'manga_ramal_muerto';
  return mesh;
}
