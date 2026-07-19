import * as THREE from 'three';
import { texturaMetal, texturaGoma } from '../../world/materials/Texturas.js';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crear as crearExtintor } from '../ssoma/extintor.js';
import { sub } from '../_comun/subelemento.js';
import { marcarEquipo } from './codigo_equipo.js';

/**
 * MIXER / AGITADOR DE SHOTCRETE (Utimec 6 m3) — transmixer de bajo perfil.
 *
 * Modelado a partir de la flota de sostenimiento de la mina: camion agitador
 * autopropulsado que TRANSPORTA y MANTIENE EN AGITACION el concreto desde la planta hasta el
 * frente, donde alimenta a la shotcretera (robot lanzador).
 *  - Chasis articulado 4x4 compacto con cabina lateral.
 *  - TAMBOR AGITADOR inclinado que gira continuamente (espiral interna mantiene la mezcla);
 *    boca de carga trasera-superior.
 *  - TOLVA/CANALETA DE DESCARGA trasera que vuelca hacia la tolva de la bomba.
 *  - Gatas/apoyos, luces de trabajo, baliza ambar y extintor.
 * Colores: chasis naranja Utimec + tambor gris claro. ~2.0 m de ancho, ~2.8 m de alto.
 */

export const meta = {
  id: 'mixer',
  nombre: 'Mixer / agitador de shotcrete',
  descripcion: 'Camion agitador de bajo perfil (Utimec 6 m3): chasis articulado, cabina, TAMBOR AGITADOR inclinado giratorio y canaleta de descarga. Transporta y agita el concreto para la shotcretera. Naranja Utimec.'
};

function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cy(rt, rb, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat); }
function tor(r, tube, arc, mat) { return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 14, arc), mat); }
function fender(r, w, arcRad, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 16, 1, true, -arcRad / 2, arcRad), mat); }
function put(grp, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m;
}

let _mats = null;
function mixMats() {
  if (_mats) return _mats;
  const metal = texturaMetal(), goma = texturaGoma();
  const paint = (color, rough) => new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.3
  });
  const steel = (color, rough, metalness) => new THREE.MeshStandardMaterial({ color, map: metal, roughness: rough, metalness });
  _mats = {
    nar:   paint(0xe8720c, 0.5),                                                                   // naranja Utimec
    narD:  paint(0xb0540a, 0.55),
    tam:   steel(0xc4c9ce, 0.5, 0.35),                                                             // tambor gris claro
    k:     steel(0x24242a, 0.62, 0.55),
    gom:   new THREE.MeshStandardMaterial({ color: 0x0e0e10, map: goma, roughness: 0.97, metalness: 0.0 }),
    ace:   steel(0xa2a2ac, 0.42, 0.62),
    chr:   new THREE.MeshStandardMaterial({ color: 0xd0d5d9, roughness: 0.14, metalness: 0.95 }),
    cab:   new THREE.MeshStandardMaterial({ color: 0x0e1a26, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.5 }),
    far:   new THREE.MeshStandardMaterial({ color: 0xeef0ff, emissive: 0xeef0ff, emissiveIntensity: 1.8, roughness: 0.08 }),
    tail:  new THREE.MeshStandardMaterial({ color: 0xcc1100, emissive: 0xcc0000, emissiveIntensity: 0.7, roughness: 0.3 }),
    rin:   steel(0x2a2a30, 0.45, 0.6),
    conc:  new THREE.MeshStandardMaterial({ color: 0x54565c, roughness: 0.95, metalness: 0.0 })    // costras de concreto
  };
  return _mats;
}

export function crear() {
  const g = new THREE.Group();
  const M = mixMats();
  const HW = 1.00, GY = 0.55;

  // ── CHASIS ARTICULADO ──────────────────────────────────────────────
  let S = sub(g, 'chasis', 'Chasis articulado', 'Bastidor articulado 4x4, articulacion central de direccion, bancada del tambor y escalera de acceso.');
  put(S, bx(HW * 2, 0.30, 4.60, M.k), 0, 0.36, -0.30);
  // Barro/polvo caked en los bajos (md: nada "de fabrica" limpio). Material COMPARTIDO.
  put(S, bx(HW * 2 + 0.03, 0.18, 4.30, MineMaterials.barroBajos()), 0, 0.25, -0.30);
  put(S, bx(HW * 2 - 0.06, 0.16, 0.18, M.k), 0, 0.42, 1.95);            // paragolpes
  put(S, cy(0.12, 0.12, 0.62, 10, M.ace), 0, 0.55, -0.10);             // pivote articulacion
  // Bancada inclinada del tambor
  for (const xs of [-1, 1]) put(S, bx(0.10, 0.90, 2.6, M.narD), xs * 0.62, 1.05, -1.10);
  for (const [sy, sz] of [[0.45, 0.95], [0.85, 0.81], [1.25, 0.67]]) put(S, bx(0.30, 0.05, 0.14, M.ace), -(HW - 0.02), sy, sz);
  put(S, bx(0.04, 1.30, 0.04, M.k), -(HW + 0.04), 1.35, 0.50, 0.12);

  // ── CABINA LATERAL ─────────────────────────────────────────────────
  S = sub(g, 'cabina', 'Cabina del operador', 'Cabina protegida FOPS/ROPS lateral con parabrisas, asiento, volante/panel y espejos.');
  const CX = -0.38, CZ = 0.85, CW = 1.16, CD = 1.24;
  put(S, bx(CW, 0.60, CD, M.nar), CX, 1.90, CZ);
  put(S, bx(CW + 0.02, 0.12, CD + 0.02, M.k), CX, 1.62, CZ);
  put(S, bx(CW + 0.10, 0.14, CD + 0.10, M.nar), CX, 2.54, CZ);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(S, bx(0.09, 0.64, 0.09, M.k), CX + sx * (CW / 2 - 0.02), 2.20, CZ + sz * (CD / 2 - 0.02));
  put(S, bx(CW - 0.18, 0.58, 0.04, M.cab), CX, 2.22, CZ + CD / 2 - 0.02, -0.2);
  for (const sx of [-1, 1]) put(S, bx(0.04, 0.58, CD - 0.2, M.cab), CX + sx * (CW / 2 - 0.01), 2.22, CZ);
  put(S, bx(0.46, 0.12, 0.44, M.k), CX, 1.84, CZ - 0.10);
  put(S, bx(0.46, 0.48, 0.10, M.k), CX, 2.10, CZ - 0.28);
  put(S, cy(0.15, 0.15, 0.04, 16, M.k), CX, 2.02, CZ + 0.40, Math.PI / 2 - 0.4);  // volante

  // ── TAMBOR AGITADOR (giratorio, inclinado) ─────────────────────────
  S = sub(g, 'tambor_agitador', 'Tambor agitador',
    'Tambor agitador inclinado que gira continuamente para mantener la mezcla; boca de carga trasera-superior y espiral/aletas internas. Costras de concreto en la boca.');
  const T = new THREE.Group();
  T.position.set(0.10, 1.35, -1.15);
  T.rotation.x = 0.32;   // inclinacion caracteristica (boca hacia arriba-atras)
  // cuerpo del tambor (perfil abombado: 2 troncos de cono unidos + cilindro central)
  put(T, cy(0.70, 0.70, 1.30, 20, M.tam), 0, 0, 0, Math.PI / 2);
  put(T, cy(0.42, 0.70, 0.70, 20, M.tam), 0, 0, 1.00, Math.PI / 2);      // cono hacia la boca
  put(T, cy(0.70, 0.42, 0.70, 20, M.tam), 0, 0, -1.00, Math.PI / 2);     // cono trasero
  // aros de refuerzo + rodadura
  for (const z of [-0.6, 0, 0.6]) put(T, tor(0.71, 0.05, Math.PI * 2, M.k), 0, 0, z, 0, Math.PI / 2, 0);
  // nervadura espiral externa (2 vueltas simuladas por segmentos)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 * 2, z = -0.7 + (i / 16) * 1.4;
    put(T, bx(0.05, 0.10, 0.20, M.tam), Math.cos(a) * 0.72, Math.sin(a) * 0.72, z, 0, 0, a);
  }
  // boca de carga
  put(T, cy(0.26, 0.30, 0.30, 16, M.k), 0, 0, 1.40, Math.PI / 2);
  put(T, tor(0.28, 0.03, Math.PI * 2, M.conc), 0, 0, 1.52, 0, Math.PI / 2, 0);  // costra
  S.add(T);

  // ── CANALETA DE DESCARGA ───────────────────────────────────────────
  S = sub(g, 'descarga', 'Canaleta de descarga', 'Canaleta/tolva trasera-superior que vuelca el concreto hacia la tolva de la bomba de la shotcretera.');
  const canal = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.10, 12, 1, true, 0, Math.PI), M.ace);
  put(S, canal, 0.10, 1.62, -2.35, Math.PI / 2 - 0.3, 0, 0);
  put(S, cy(0.10, 0.10, 0.30, 8, M.chr), 0.10, 1.85, -2.05, 0.6);       // cilindro de giro de la canaleta
  put(S, bx(0.05, 0.05, 0.10, M.conc), 0.10, 1.30, -2.75);              // costra en la punta

  // ── NEUMATICOS (4) ─────────────────────────────────────────────────
  S = sub(g, 'neumaticos', 'Neumaticos', '4 neumaticos con banda minera, rines y guardabarros.');
  for (const [px, pz] of [[-HW, 1.10], [HW, 1.10], [-HW, -1.95], [HW, -1.95]]) {
    const side = px < 0 ? -1 : 1, xo = px + side * 0.16;
    put(S, cy(0.55, 0.55, 0.34, 18, M.gom), xo, GY, pz, 0, 0, Math.PI / 2);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2, taco = bx(0.36, 0.05, 0.12, M.k);
      taco.position.set(xo, GY + Math.sin(a) * 0.555, pz + Math.cos(a) * 0.555);
      taco.rotation.x = a; S.add(taco);
    }
    put(S, cy(0.27, 0.27, 0.36, 12, M.rin), xo, GY, pz, 0, 0, Math.PI / 2);
    put(S, fender(0.68, 0.44, 2.5, M.narD), xo, GY, pz, 0, 0, Math.PI / 2);
  }

  // ── LUCES ──────────────────────────────────────────────────────────
  S = sub(g, 'luces', 'Faros, calaveras y baliza', 'Faros frontales, calaveras traseras y baliza ambar animada.');
  for (const xs of [-1, 1]) {
    put(S, cy(0.09, 0.09, 0.09, 16, M.k), xs * 0.75, 0.72, 2.00, Math.PI / 2);
    put(S, cy(0.068, 0.068, 0.02, 16, M.far), xs * 0.75, 0.72, 2.06, Math.PI / 2);
  }
  for (const xs of [-1, 1]) put(S, bx(0.10, 0.16, 0.04, M.tail), xs * (HW - 0.03), 0.78, -2.55);
  // Reflectivos traseros (chevrones rojo/blanco 45°) + mudflaps de lodo tras las ruedas
  for (let i = -3; i <= 3; i++) put(S, bx(0.20, 0.34, 0.015, (i & 1) ? M.tail : M.tam), i * 0.26, 0.44, -2.57, 0, 0, Math.PI / 4);
  for (const xs of [-1, 1]) put(S, bx(0.40, 0.36, 0.02, M.k), xs * (HW - 0.01), 0.28, -2.25);
  const balM = new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8800, emissiveIntensity: 2.5 });
  const balX = CX + 0.30;
  put(S, cy(0.055, 0.066, 0.05, 12, M.k), balX, 2.69, CZ);
  put(S, cy(0.072, 0.072, 0.11, 14, balM), balX, 2.77, CZ);
  put(S, new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), balM), balX, 2.825, CZ);

  // ── EXTINTOR ───────────────────────────────────────────────────────
  S = sub(g, 'extintor', 'Extintor', 'Extintor con tarjeta de inspeccion (lateral del chasis).');
  S.add(crearExtintor({ x: HW + 0.08, y: 0.55, z: 0.30, ry: Math.PI / 2 }));

  g.name = 'mixer';
  g.userData.tick = (dt, elapsed) => {
    balM.emissiveIntensity = 1.5 + Math.abs(Math.sin(elapsed * 4)) * 2.5;
    T.rotation.z = elapsed * 0.9;   // agitacion continua del tambor
  };
  g.userData.hazard = {
    tipo: 'equipoPesado', live: true, warn: 5, hurt: 0.6,
    aviso: 'MIXER EN OPERACION — tambor en agitacion. Mantente a distancia segura del equipo.',
    reflexion:
      'Estuviste demasiado cerca de un mixer de shotcrete en operacion. El tambor gira y el equipo ' +
      'puede desplazarse. Respeta las distancias de seguridad alrededor de los equipos moviles.'
  };
  marcarEquipo(g, { prefijo: 'MIX', articulado: true });
  return g;
}
