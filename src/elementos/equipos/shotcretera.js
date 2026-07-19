import * as THREE from 'three';
import { texturaMetal, texturaGoma } from '../../world/materials/Texturas.js';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crear as crearExtintor } from '../ssoma/extintor.js';
import { sub } from '../_comun/subelemento.js';
import { marcarEquipo } from './codigo_equipo.js';

/**
 * SHOTCRETERA / ROBOT LANZADOR DE SHOTCRETE (Alpha / Tornado).
 *
 * Modelado a partir de la flota de sostenimiento con concreto lanzado de la mina:
 * equipo autopropulsado de bajo perfil que PROYECTA shotcrete sobre el hastial y la boveda.
 *  - Chasis articulado 4x4 compacto con cabina/cabina-canopy lateral.
 *  - BRAZO ARTICULADO DE LANZADO (3 secciones) que termina en la BOQUILLA rotatoria por donde
 *    sale el concreto; oscila de lado a lado para cubrir el area (rasgo del robot lanzador).
 *  - BOMBA DE CONCRETO + TOLVA de recepcion en el chasis, alimentada por el mixer.
 *  - TANQUE DE ADITIVO (acelerante) y su bomba dosificadora.
 *  - MANGUERA GRUESA de concreto que sube por el brazo hasta la boquilla.
 *  - Gatas estabilizadoras, luces de trabajo, baliza ambar y extintor.
 * Colores Normet: rojo con acentos gris/blanco. ~2.0 m de ancho, ~2.9 m de alto.
 */

export const meta = {
  id: 'shotcretera',
  nombre: 'Shotcretera / robot lanzador',
  descripcion: 'Robot lanzador de shotcrete autopropulsado (Alpha/Tornado): chasis articulado, cabina, BRAZO DE LANZADO con boquilla oscilante, bomba de concreto, tolva, tanque de aditivo y manguera gruesa. Rojo Normet.'
};

function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cy(rt, rb, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat); }
function tor(r, tube, arc, mat) { return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 14, arc), mat); }
function fender(r, w, arcRad, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 16, 1, true, -arcRad / 2, arcRad), mat); }
function put(grp, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m;
}

let _mats = null;
function shotMats() {
  if (_mats) return _mats;
  const metal = texturaMetal(), goma = texturaGoma();
  const paint = (color, rough) => new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.3
  });
  const steel = (color, rough, metalness) => new THREE.MeshStandardMaterial({ color, map: metal, roughness: rough, metalness });
  _mats = {
    rojo:  paint(0xc22118, 0.5),                                                                   // rojo Normet
    rojoD: paint(0x8f1810, 0.55),
    gris:  paint(0x9aa0a6, 0.5),
    k:     steel(0x24242a, 0.62, 0.55),
    gom:   new THREE.MeshStandardMaterial({ color: 0x0e0e10, map: goma, roughness: 0.97, metalness: 0.0 }),
    ace:   steel(0xa2a2ac, 0.42, 0.62),
    chr:   new THREE.MeshStandardMaterial({ color: 0xd0d5d9, roughness: 0.14, metalness: 0.95 }),
    conc:  new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.95, metalness: 0.0 }),  // manguera de concreto (gruesa)
    cab:   new THREE.MeshStandardMaterial({ color: 0x0e1a26, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.5 }),
    far:   new THREE.MeshStandardMaterial({ color: 0xeef0ff, emissive: 0xeef0ff, emissiveIntensity: 1.8, roughness: 0.08 }),
    tail:  new THREE.MeshStandardMaterial({ color: 0xcc1100, emissive: 0xcc0000, emissiveIntensity: 0.7, roughness: 0.3 }),
    rin:   steel(0x2a2a30, 0.45, 0.6),
    amar:  paint(0xf2c200, 0.5)                                                                    // tanque de aditivo amarillo
  };
  return _mats;
}

export function crear() {
  const g = new THREE.Group();
  const M = shotMats();
  const HW = 1.00, GY = 0.55;

  // ── CHASIS ARTICULADO ──────────────────────────────────────────────
  let S = sub(g, 'chasis', 'Chasis articulado', 'Bastidor articulado 4x4, articulacion central de direccion y escalera de acceso.');
  put(S, bx(HW * 2, 0.30, 4.20, M.k), 0, 0.36, -0.25);
  // Barro/polvo caked en los bajos (md: nada "de fabrica" limpio). Material COMPARTIDO.
  put(S, bx(HW * 2 + 0.03, 0.18, 3.90, MineMaterials.barroBajos()), 0, 0.25, -0.25);
  put(S, bx(HW * 2 - 0.06, 0.16, 0.18, M.k), 0, 0.42, 1.85);
  put(S, cy(0.12, 0.12, 0.62, 10, M.ace), 0, 0.55, -0.15);
  for (const [sy, sz] of [[0.45, 0.90], [0.85, 0.76], [1.25, 0.62]]) put(S, bx(0.30, 0.05, 0.14, M.ace), -(HW - 0.02), sy, sz);
  put(S, bx(0.04, 1.30, 0.04, M.k), -(HW + 0.04), 1.35, 0.45, 0.12);

  // ── BOMBA DE CONCRETO + TOLVA ──────────────────────────────────────
  S = sub(g, 'bomba_tolva', 'Bomba de concreto y tolva', 'Bomba de piston de concreto y TOLVA de recepcion (alimentada por el mixer) montadas sobre el chasis trasero.');
  put(S, bx(HW * 2 - 0.1, 0.85, 1.60, M.gris), 0, 0.90, -1.30);          // bloque de la bomba
  // Tolva (tronco piramidal invertido) atras
  const tolva = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.34, 0.70, 4), M.rojoD);
  put(S, tolva, 0, 1.35, -1.95, 0, Math.PI / 4);
  put(S, bx(1.30, 0.10, 1.30, M.k), 0, 1.72, -1.95);                     // reja de la tolva
  put(S, cy(0.12, 0.12, 1.40, 10, M.ace), 0, 0.95, -1.10, Math.PI / 2);  // cilindros de bombeo
  put(S, cy(0.05, 0.05, 0.06, 10, M.k), HW - 0.05, 1.10, -0.75, 0, 0, Math.PI / 2);
  put(S, cy(0.055, 0.04, 0.05, 10, M.rojoD), HW, 1.10, -0.75, 0, 0, Math.PI / 2);  // parada de emergencia

  // ── TANQUE DE ADITIVO (acelerante) ─────────────────────────────────
  S = sub(g, 'tanque_aditivo', 'Tanque de aditivo', 'Tanque del acelerante (aditivo) con bomba dosificadora que se inyecta en la boquilla.');
  put(S, cy(0.30, 0.30, 0.90, 16, M.amar), -0.55, 1.55, -0.20, Math.PI / 2, 0, Math.PI / 2);
  for (const ds of [-0.45, 0.45]) put(S, cy(0.31, 0.31, 0.03, 16, M.k), -0.55, 1.55, -0.20 + ds, Math.PI / 2, 0, Math.PI / 2);
  put(S, bx(0.16, 0.20, 0.16, M.k), -0.55, 1.10, -0.20);                 // bomba dosificadora

  // ── CABINA / CANOPY LATERAL ────────────────────────────────────────
  S = sub(g, 'cabina', 'Cabina del operador', 'Cabina protegida FOPS/ROPS lateral con parabrisas, asiento, panel de control y joysticks del brazo de lanzado.');
  const CX = -0.36, CZ = 0.60, CW = 1.20, CD = 1.30;
  put(S, bx(CW, 0.60, CD, M.rojo), CX, 1.88, CZ);
  put(S, bx(CW + 0.02, 0.12, CD + 0.02, M.k), CX, 1.60, CZ);
  put(S, bx(CW + 0.10, 0.14, CD + 0.10, M.rojo), CX, 2.52, CZ);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(S, bx(0.09, 0.64, 0.09, M.k), CX + sx * (CW / 2 - 0.02), 2.18, CZ + sz * (CD / 2 - 0.02));
  put(S, bx(CW - 0.18, 0.58, 0.04, M.cab), CX, 2.20, CZ + CD / 2 - 0.02, -0.2);
  for (const sx of [-1, 1]) put(S, bx(0.04, 0.58, CD - 0.2, M.cab), CX + sx * (CW / 2 - 0.01), 2.20, CZ);
  put(S, bx(0.46, 0.12, 0.44, M.k), CX, 1.82, CZ - 0.12);
  put(S, bx(0.46, 0.48, 0.10, M.k), CX, 2.08, CZ - 0.30);
  put(S, bx(0.80, 0.20, 0.12, M.k), CX, 1.98, CZ + 0.42);
  for (const jx of [-0.2, 0.2]) put(S, cy(0.015, 0.015, 0.18, 6, M.k), CX + jx, 2.15, CZ + 0.44);

  // ── NEUMATICOS (4) ─────────────────────────────────────────────────
  S = sub(g, 'neumaticos', 'Neumaticos', '4 neumaticos con banda minera, rines y guardabarros.');
  for (const [px, pz] of [[-HW, 1.05], [HW, 1.05], [-HW, -1.85], [HW, -1.85]]) {
    const side = px < 0 ? -1 : 1, xo = px + side * 0.16;
    put(S, cy(0.55, 0.55, 0.34, 18, M.gom), xo, GY, pz, 0, 0, Math.PI / 2);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2, taco = bx(0.36, 0.05, 0.12, M.k);
      taco.position.set(xo, GY + Math.sin(a) * 0.555, pz + Math.cos(a) * 0.555);
      taco.rotation.x = a; S.add(taco);
    }
    put(S, cy(0.27, 0.27, 0.36, 12, M.rin), xo, GY, pz, 0, 0, Math.PI / 2);
    put(S, fender(0.68, 0.44, 2.5, M.rojoD), xo, GY, pz, 0, 0, Math.PI / 2);
  }

  // ── GATAS ESTABILIZADORAS (4) ──────────────────────────────────────
  S = sub(g, 'gatas', 'Gatas estabilizadoras', '4 gatas hidraulicas con vastago cromado y zapata al piso.');
  for (const [gx, gz] of [[-(HW + 0.06), 1.55], [HW + 0.06, 1.55], [-(HW + 0.02), -2.30], [HW + 0.02, -2.30]]) {
    put(S, bx(0.22, 0.16, 0.24, M.rojoD), gx * 0.90, 0.95, gz);
    put(S, cy(0.075, 0.075, 0.55, 10, M.rojoD), gx, 0.72, gz);
    put(S, cy(0.042, 0.042, 0.50, 8, M.chr), gx, 0.28, gz);
    put(S, cy(0.15, 0.17, 0.06, 10, M.k), gx, 0.035, gz);
  }

  // ── BRAZO DE LANZADO + BOQUILLA (conjunto animado) ─────────────────
  S = sub(g, 'brazo_lanzador', 'Brazo de lanzado y boquilla',
    'Brazo articulado de 3 secciones que posiciona la BOQUILLA rotatoria de proyeccion; la boquilla oscila para cubrir el area de shotcrete. Incluye la manguera gruesa de concreto que sube por el brazo.');
  put(S, cy(0.22, 0.26, 0.34, 14, M.k), 0.20, 1.55, 1.55);              // base/torreta del brazo

  const B = new THREE.Group();
  B.position.set(0.20, 1.72, 1.62);
  // seccion 1 (elevacion)
  put(B, bx(0.26, 0.26, 1.90, M.rojo), 0, 0, 0.85);
  put(B, cy(0.06, 0.06, 0.90, 10, M.chr), 0.16, -0.10, 0.55, Math.PI / 2 - 0.2); // cilindro
  // seccion 2 (nudillo)
  const B2 = new THREE.Group();
  B2.position.set(0, 0.05, 1.80);
  B2.rotation.x = 0.7;
  put(B2, bx(0.22, 0.22, 1.60, M.rojo), 0, 0, 0.75);
  put(B2, cy(0.05, 0.05, 0.80, 10, M.chr), 0.14, 0.10, 0.5, Math.PI / 2 - 0.3);
  // muñeca + boquilla oscilante
  const wrist = new THREE.Group();
  wrist.position.set(0, 0, 1.55);
  put(wrist, cy(0.10, 0.10, 0.22, 12, M.k), 0, 0, 0, Math.PI / 2);       // articulacion de muñeca
  const nozzle = new THREE.Group();
  nozzle.position.set(0, 0, 0.10);
  put(nozzle, cy(0.06, 0.09, 0.34, 12, M.ace), 0, 0, 0.20, Math.PI / 2); // cuerpo boquilla
  put(nozzle, cy(0.09, 0.05, 0.12, 12, M.chr), 0, 0, 0.42, Math.PI / 2); // punta de proyeccion
  put(nozzle, tor(0.10, 0.02, Math.PI * 2, M.k), 0, 0, 0.10, Math.PI / 2); // anillo de aire
  wrist.add(nozzle);
  B2.add(wrist);
  B.add(B2);
  // Manguera gruesa de concreto drapeada a lo largo del brazo
  const curva = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.15, -0.15, -0.1), new THREE.Vector3(-0.10, -0.20, 0.9),
    new THREE.Vector3(0.0, -0.10, 1.8), new THREE.Vector3(0.05, 0.2, 2.6), new THREE.Vector3(0.0, 0.0, 3.3)
  ]);
  put(B, new THREE.Mesh(new THREE.TubeGeometry(curva, 24, 0.05, 8, false), M.conc), 0, 0, 0);
  S.add(B);

  // ── LUCES ──────────────────────────────────────────────────────────
  S = sub(g, 'luces', 'Faros, calaveras y baliza', 'Faros frontales, luces de trabajo, calaveras traseras y baliza ambar animada.');
  for (const xs of [-1, 1]) {
    put(S, cy(0.09, 0.09, 0.09, 16, M.k), xs * 0.75, 0.70, 1.90, Math.PI / 2);
    put(S, cy(0.068, 0.068, 0.02, 16, M.far), xs * 0.75, 0.70, 1.96, Math.PI / 2);
  }
  for (const lx of [-0.7, -0.3, 0.1]) put(S, cy(0.07, 0.07, 0.05, 14, M.far), lx, 2.58, CZ + CD / 2 + 0.05, Math.PI / 2);
  for (const xs of [-1, 1]) put(S, bx(0.10, 0.16, 0.04, M.tail), xs * (HW - 0.03), 0.78, -2.30);
  // Reflectivos traseros (chevrones rojo/blanco 45°) + mudflaps de lodo tras las ruedas
  for (let i = -3; i <= 3; i++) put(S, bx(0.20, 0.34, 0.015, (i & 1) ? M.rojoD : M.ace), i * 0.26, 0.44, -2.32, 0, 0, Math.PI / 4);
  for (const xs of [-1, 1]) put(S, bx(0.40, 0.36, 0.02, M.k), xs * (HW - 0.01), 0.28, -2.05);
  const balM = new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8800, emissiveIntensity: 2.5 });
  const balX = CX + 0.35;
  put(S, cy(0.055, 0.066, 0.05, 12, M.k), balX, 2.67, CZ);
  put(S, cy(0.072, 0.072, 0.11, 14, balM), balX, 2.75, CZ);
  put(S, new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), balM), balX, 2.805, CZ);

  // ── EXTINTOR ───────────────────────────────────────────────────────
  S = sub(g, 'extintor', 'Extintor', 'Extintor con tarjeta de inspeccion (lateral del chasis).');
  S.add(crearExtintor({ x: HW + 0.08, y: 0.55, z: -0.30, ry: Math.PI / 2 }));

  g.name = 'shotcretera';
  g.userData.tick = (dt, elapsed) => {
    balM.emissiveIntensity = 1.5 + Math.abs(Math.sin(elapsed * 4)) * 2.5;
    // Oscilacion del brazo y de la boquilla (patron de barrido del shotcrete)
    B.rotation.y = Math.sin(elapsed * 0.6) * 0.25;
    B2.rotation.x = 0.7 + Math.sin(elapsed * 0.9) * 0.12;
    nozzle.rotation.z = elapsed * 3.0;   // giro de la boquilla rotatoria
  };
  g.userData.hazard = {
    tipo: 'equipoPesado', live: true, warn: 6, hurt: 0.6,
    aviso: 'SHOTCRETERA EN OPERACION — proyeccion de concreto activa. Mantente fuera del area de lanzado.',
    reflexion:
      'Estuviste demasiado cerca de una shotcretera en operacion. El brazo de lanzado se mueve solo ' +
      'y el concreto se proyecta a alta presion. Respeta el cerco del area de sostenimiento con shotcrete.'
  };
  marcarEquipo(g, { prefijo: 'SHT', articulado: true });
  return g;
}
