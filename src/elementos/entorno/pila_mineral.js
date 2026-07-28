import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { sub } from '../_comun/subelemento.js';

/**
 * PILA DE MINERAL (muck pile) — montón de roca volada en el fondo de una cámara/stope,
 * listo para ser cargado por el LHD. "Respira": el ciclo de acarreo (HaulCycle) la BAJA de
 * nivel al muck-ear y se regenera lentamente (siguiente disparo/limpieza).
 *
 * API: `userData.pila.extraer(f)` baja el nivel; el `userData.tick` regenera lento y aplica
 * la escala (0.7↔1.0). Que tenga tick lo EXIME del congelado de matrices del mundo.
 *
 * Origen en el PISO; el cono se apoya en y=0.
 */

export const meta = {
  id: 'pila_mineral',
  nombre: 'Pila de mineral (muck pile)',
  descripcion: 'Montón cónico de roca mineralizada con bolones sueltos. Se agota al cargarla y se regenera. userData.pila.extraer().'
};

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  const mRoca = MineMaterials.roca();

  const S = sub(g, 'monticulo', 'Montículo y bolones',
    'Cono achatado de material volado con bolones de sulfuro sobresaliendo.');

  // Cono achatado (el muck no es liso: pocas caras = aspecto pedregoso)
  const cono = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.4, 9, 1), mRoca);
  cono.position.y = 0.68; cono.rotation.y = 0.4;
  S.add(cono);
  // Falda inferior mas ancha
  const falda = new THREE.Mesh(new THREE.ConeGeometry(2.5, 0.5, 10, 1), mRoca);
  falda.position.y = 0.24;
  S.add(falda);
  // Bolones sueltos encima/alrededor (mineralizados = un poco mas claros)
  const mMin = MineMaterials.plano(0x8a7a52, { rough: 0.85, metal: 0.15 });
  const lump = new THREE.IcosahedronGeometry(0.34, 0);
  for (const [x, y, z, s] of [
    [0.2, 1.25, 0.1, 1.0], [-0.7, 0.7, 0.5, 1.3], [0.8, 0.55, -0.4, 1.1],
    [-0.3, 0.4, -0.8, 0.9], [1.1, 0.3, 0.6, 1.2], [-1.0, 0.28, -0.3, 1.0]
  ]) {
    const b = new THREE.Mesh(lump, (x + z) > 0.4 ? mMin : mRoca);
    b.position.set(x, y, z); b.scale.setScalar(s);
    b.rotation.set(x * 2, z * 3, y);
    S.add(b);
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.name = 'pila_mineral';

  const estado = { nivel: 1 };
  g.userData.pila = {
    get nivel() { return estado.nivel; },
    /** Baja el nivel al cargar (fraccion 0..1). */
    extraer(f = 0.08) { estado.nivel = Math.max(0.3, estado.nivel - f); }
  };
  g.userData.tick = (dt) => {
    estado.nivel = Math.min(1, estado.nivel + dt * 0.02);   // regenera lento
    const s = 0.7 + 0.3 * estado.nivel;
    g.scale.set(s, s, s);
  };
  return g;
}

/**
 * DISPARO SIN LIMPIAR — el muck que TAPA el tope justo despues de la voladura.
 *
 * No es la pila conica de un tajeo: es el disparo entero derramado contra el frente, que llena
 * la labor de hastial a hastial y sube hasta media altura. La roca recien volada esta FRESCA
 * (caras limpias, sin la patina de polvo del resto de la mina), por eso se ve mucho mas clara
 * que la caja — es lo primero que delata que el tope acaba de disparar y todavia no se lampea.
 *
 * Estatico a proposito (sin `tick`): esto no se agota como la pila de un tajeo, se limpia con
 * el scoop y desaparece la fase entera. Al ser anonimo y opaco, el fusor de estaticos lo
 * absorbe en la malla del tramo.
 *
 * @param {{ancho?:number, alto?:number, fondo?:number, seed?:number}} opts
 * @returns {THREE.Group}
 */
export function crearDisparo({ ancho = 4.4, alto = 2.3, fondo = 3.2, seed = 1 } = {}) {
  let s = seed & 0xffff;
  const rnd = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };

  const g = new THREE.Group();
  g.name = 'disparo_sin_limpiar';

  // Roca recien volada: caras frescas, mucho mas claras que la caja polvorienta.
  const mFresca = MineMaterials.plano(0xa8a49a, { rough: 0.92, metal: 0.02 });
  const mSombra = MineMaterials.plano(0x6e6a62, { rough: 0.95, metal: 0.02 });

  const S = sub(g, 'muck', 'Muck del disparo',
    'Roca volada derramada contra el tope: caras frescas, bloques angulares, talud natural.');

  // Talud: se derrama desde el tope hacia la boca perdiendo altura.
  const capas = 5;
  for (let i = 0; i < capas; i++) {
    const t = i / (capas - 1);
    const z = -fondo * 0.5 + fondo * t;
    const h = alto * (1 - t * 0.72);
    const w = ancho * (1 - t * 0.18);
    const capa = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.56, h, 7, 1), i % 2 ? mSombra : mFresca);
    capa.position.set((rnd() - 0.5) * 0.3, h * 0.5 - 0.15, z);
    capa.rotation.y = rnd() * Math.PI;
    capa.scale.z = 0.55;
    S.add(capa);
  }

  // Bloques angulares sueltos: el muck no es un monton liso, son lajas y bolones quebrados.
  const laja = new THREE.IcosahedronGeometry(0.42, 0);
  const nBloques = 26;
  for (let i = 0; i < nBloques; i++) {
    const t = rnd();
    const b = new THREE.Mesh(laja, rnd() < 0.62 ? mFresca : mSombra);
    const z = -fondo * 0.5 + fondo * t;
    const yMax = alto * (1 - t * 0.72);
    b.position.set(
      (rnd() - 0.5) * ancho * (0.95 - t * 0.15),
      rnd() * yMax,
      z + (rnd() - 0.5) * 0.5
    );
    b.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    b.scale.set(0.5 + rnd() * 1.1, 0.35 + rnd() * 0.7, 0.5 + rnd() * 1.1);
    S.add(b);
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return g;
}
