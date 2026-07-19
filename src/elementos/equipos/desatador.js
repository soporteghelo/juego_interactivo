import * as THREE from 'three';
import { texturaMetal, texturaGoma } from '../../world/materials/Texturas.js';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crear as crearExtintor } from '../ssoma/extintor.js';
import { sub } from '../_comun/subelemento.js';
import { marcarEquipo } from './codigo_equipo.js';

/**
 * DESATADOR / SCALER MECANIZADO (Normet Scamec / Getman) — desate mecanizado de rocas.
 *
 * Modelado a partir del ciclo de desate de la mina: equipo de bajo perfil que
 * DESPRENDE MECANIZADAMENTE la roca suelta del techo y hastiales tras la voladura, evitando
 * exponer al personal (hoy el sim solo tiene barretillas manuales).
 *  - Chasis articulado 4x4 con cabina cerrada FOPS/ROPS MUY reforzada (proteccion contra caida
 *    de rocas) y rejilla frontal sobre el parabrisas.
 *  - BRAZO DE DESATE robusto (telescopico) que termina en una HERRAMIENTA de desate: PICA/
 *    martillo hidraulico con punta conica que golpea/palanquea la roca inestable.
 *  - HOJA/PLACA frontal de empuje para juntar el escombro desatado.
 *  - Gatas estabilizadoras, luces, baliza ambar y extintor.
 * Colores: chasis blanco/azul (Normet Scamec) con acentos. ~2.0 m ancho, ~2.9 m alto.
 */

export const meta = {
  id: 'desatador',
  nombre: 'Desatador / Scaler mecanizado',
  descripcion: 'Equipo de desate mecanizado de rocas (Scamec): chasis articulado, cabina reforzada con rejilla, BRAZO DE DESATE telescopico con PICA/martillo hidraulico y hoja frontal. Blanco/azul.'
};

function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cy(rt, rb, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat); }
function cone(r, h, s, mat) { return new THREE.Mesh(new THREE.ConeGeometry(r, h, s), mat); }
function tor(r, tube, arc, mat) { return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 14, arc), mat); }
function fender(r, w, arcRad, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 16, 1, true, -arcRad / 2, arcRad), mat); }
function put(grp, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m;
}

let _mats = null;
function desMats() {
  if (_mats) return _mats;
  const metal = texturaMetal(), goma = texturaGoma();
  const paint = (color, rough) => new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0.18, clearcoat: 0.5, clearcoatRoughness: 0.3
  });
  const steel = (color, rough, metalness) => new THREE.MeshStandardMaterial({ color, map: metal, roughness: rough, metalness });
  _mats = {
    bl:    paint(0xe6e9ec, 0.5),                                                                   // blanco Normet
    az:    paint(0x1f4e8c, 0.5),                                                                   // azul acento
    azD:   paint(0x163a68, 0.55),
    k:     steel(0x24242a, 0.62, 0.55),
    gom:   new THREE.MeshStandardMaterial({ color: 0x0e0e10, map: goma, roughness: 0.97, metalness: 0.0 }),
    ace:   steel(0xa2a2ac, 0.42, 0.62),
    chr:   new THREE.MeshStandardMaterial({ color: 0xd0d5d9, roughness: 0.14, metalness: 0.95 }),
    pica:  steel(0x6a6a72, 0.35, 0.85),                                                            // acero de la pica
    cab:   new THREE.MeshStandardMaterial({ color: 0x0e1a26, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.5 }),
    far:   new THREE.MeshStandardMaterial({ color: 0xeef0ff, emissive: 0xeef0ff, emissiveIntensity: 1.8, roughness: 0.08 }),
    tail:  new THREE.MeshStandardMaterial({ color: 0xcc1100, emissive: 0xcc0000, emissiveIntensity: 0.7, roughness: 0.3 }),
    rin:   steel(0x2a2a30, 0.45, 0.6)
  };
  return _mats;
}

export function crear() {
  const g = new THREE.Group();
  const M = desMats();
  const HW = 1.00, GY = 0.55;

  // ── CHASIS ARTICULADO ──────────────────────────────────────────────
  let S = sub(g, 'chasis', 'Chasis articulado', 'Bastidor articulado 4x4, porta-brazos frontal robusto, articulacion de direccion y escalera de acceso.');
  put(S, bx(HW * 2, 0.32, 4.20, M.k), 0, 0.37, -0.30);
  // Barro/polvo caked en los bajos (md: nada "de fabrica" limpio). Material COMPARTIDO.
  put(S, bx(HW * 2 + 0.03, 0.18, 3.90, MineMaterials.barroBajos()), 0, 0.26, -0.30);
  put(S, bx(HW * 2 - 0.16, 0.62, 0.62, M.azD), 0, 0.70, 1.55);          // porta-brazos frontal
  put(S, cy(0.12, 0.12, 0.62, 10, M.ace), 0, 0.55, -0.20);             // pivote de articulacion
  for (const xs of [-1, 1]) put(S, bx(0.16, 0.32, 1.4, M.azD), xs * (HW - 0.03), 0.54, -0.95);
  for (const [sy, sz] of [[0.45, 0.90], [0.85, 0.76], [1.25, 0.62]]) put(S, bx(0.30, 0.05, 0.14, M.ace), -(HW - 0.02), sy, sz);
  put(S, bx(0.04, 1.30, 0.04, M.k), -(HW + 0.04), 1.35, 0.45, 0.12);

  // ── HOJA FRONTAL DE EMPUJE ─────────────────────────────────────────
  S = sub(g, 'hoja_frontal', 'Hoja frontal de empuje', 'Placa/hoja frontal para juntar y empujar el escombro desatado.');
  put(S, bx(HW * 2 - 0.05, 0.55, 0.12, M.az), 0, 0.42, 2.02);
  put(S, bx(HW * 2 - 0.05, 0.10, 0.20, M.k), 0, 0.17, 2.05);            // cuchilla inferior
  for (const xs of [-1, 1]) put(S, cy(0.045, 0.045, 0.60, 8, M.chr), xs * 0.5, 0.55, 1.85, Math.PI / 2 - 0.5); // cilindros

  // ── POWER PACK TRASERO ─────────────────────────────────────────────
  S = sub(g, 'motor', 'Power pack trasero', 'Compartimento del motor diesel/hidraulico: bloque, rejillas, escape vertical, radiador y paradas de emergencia.');
  put(S, bx(HW * 2, 1.20, 2.05, M.bl), 0, 1.02, -1.40);
  put(S, bx(HW * 2 - 0.1, 0.20, 1.95, M.az), 0, 1.64, -1.40);
  for (const xs of [-1, 1]) for (let z = -0.7; z >= -2.0; z -= 0.34) put(S, bx(0.04, 0.60, 0.20, M.k), xs * (HW - 0.01), 0.98, z);
  put(S, cy(0.05, 0.05, 0.50, 16, M.k), -0.70, 1.98, -2.05);
  put(S, cy(0.065, 0.065, 0.04, 16, M.k), -0.70, 2.24, -2.05);
  put(S, bx(HW * 2 - 0.30, 0.68, 0.05, M.k), 0, 1.06, -2.40);
  for (const [ex, ez] of [[HW - 0.01, -0.80], [-(HW - 0.01), -2.00]]) {
    put(S, cy(0.05, 0.05, 0.06, 10, M.k), ex, 1.20, ez, 0, 0, Math.PI / 2);
    put(S, cy(0.055, 0.04, 0.05, 10, M.tail), ex + Math.sign(ex) * 0.05, 1.20, ez, 0, 0, Math.PI / 2);
  }

  // ── CABINA REFORZADA (FOPS/ROPS + rejilla anti-caida de rocas) ─────
  S = sub(g, 'cabina', 'Cabina reforzada', 'Cabina cerrada FOPS/ROPS reforzada con REJILLA frontal anti-caida de rocas, asiento, panel y joysticks del brazo de desate.');
  const CX = -0.34, CZ = 0.30, CW = 1.30, CD = 1.52;
  put(S, bx(HW * 2, 0.16, 1.62, M.bl), 0, 1.55, 0.35);
  put(S, bx(CW, 0.62, CD, M.bl), CX, 1.93, CZ);
  put(S, bx(CW + 0.02, 0.12, CD + 0.02, M.k), CX, 1.66, CZ);
  put(S, bx(CW + 0.14, 0.16, CD + 0.14, M.az), CX, 2.63, CZ);           // techo reforzado (grueso)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(S, bx(0.11, 0.66, 0.11, M.k), CX + sx * (CW / 2 - 0.02), 2.25, CZ + sz * (CD / 2 - 0.02)); // parantes gruesos
  const gY = 2.28, gH = 0.60;
  put(S, bx(CW - 0.18, gH + 0.06, 0.04, M.cab), CX, gY - 0.02, CZ + CD / 2 - 0.02, -0.22);
  put(S, bx(CW - 0.18, gH, 0.04, M.cab), CX, gY, CZ - CD / 2 + 0.01);
  for (const sx of [-1, 1]) put(S, bx(0.04, gH, CD - 0.20, M.cab), CX + sx * (CW / 2 - 0.01), gY, CZ);
  // REJILLA frontal (barras verticales y horizontales sobre el parabrisas)
  for (let bxp = -0.5; bxp <= 0.5; bxp += 0.16) put(S, bx(0.025, gH + 0.1, 0.025, M.k), CX + bxp, gY, CZ + CD / 2 + 0.02);
  for (const by of [gY - 0.22, gY + 0.22]) put(S, bx(CW - 0.1, 0.025, 0.025, M.k), CX, by, CZ + CD / 2 + 0.02);
  // techo tambien enrejado
  for (let bz = -0.5; bz <= 0.5; bz += 0.18) put(S, bx(CW - 0.1, 0.02, 0.02, M.k), CX, 2.73, CZ + bz);
  put(S, bx(0.50, 0.12, 0.48, M.k), CX, 1.87, CZ - 0.12);              // asiento
  put(S, bx(0.50, 0.52, 0.10, M.k), CX, 2.15, CZ - 0.34);
  put(S, bx(0.92, 0.22, 0.12, M.k), CX, 2.03, CZ + 0.48);
  for (const jx of [-0.22, 0.22]) put(S, cy(0.016, 0.016, 0.20, 6, M.k), CX + jx, 2.21, CZ + 0.49);

  // ── NEUMATICOS (4) ─────────────────────────────────────────────────
  S = sub(g, 'neumaticos', 'Neumaticos', '4 neumaticos con banda minera, rines y guardabarros.');
  for (const [px, pz] of [[-HW, 1.05], [HW, 1.05], [-HW, -1.80], [HW, -1.80]]) {
    const side = px < 0 ? -1 : 1, xo = px + side * 0.16;
    put(S, cy(0.55, 0.55, 0.34, 18, M.gom), xo, GY, pz, 0, 0, Math.PI / 2);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2, taco = bx(0.36, 0.05, 0.12, M.k);
      taco.position.set(xo, GY + Math.sin(a) * 0.555, pz + Math.cos(a) * 0.555);
      taco.rotation.x = a; S.add(taco);
    }
    put(S, cy(0.27, 0.27, 0.36, 12, M.rin), xo, GY, pz, 0, 0, Math.PI / 2);
    put(S, fender(0.68, 0.44, 2.5, M.azD), xo, GY, pz, 0, 0, Math.PI / 2);
  }

  // ── GATAS ESTABILIZADORAS (4) ──────────────────────────────────────
  S = sub(g, 'gatas', 'Gatas estabilizadoras', '4 gatas hidraulicas con vastago cromado y zapata al piso.');
  for (const [gx, gz] of [[-(HW + 0.06), 1.55], [HW + 0.06, 1.55], [-(HW + 0.02), -2.45], [HW + 0.02, -2.45]]) {
    put(S, bx(0.22, 0.16, 0.24, M.azD), gx * 0.90, 0.95, gz);
    put(S, cy(0.075, 0.075, 0.55, 10, M.azD), gx, 0.72, gz);
    put(S, cy(0.042, 0.042, 0.50, 8, M.chr), gx, 0.28, gz);
    put(S, cy(0.15, 0.17, 0.06, 10, M.k), gx, 0.035, gz);
  }

  // ── BRAZO DE DESATE + PICA/MARTILLO (conjunto animado) ─────────────
  S = sub(g, 'brazo_desate', 'Brazo de desate y pica',
    'Brazo hidraulico robusto (telescopico) que posiciona la PICA/martillo hidraulico; la punta conica golpea/palanquea la roca suelta del techo y hastiales. Se anima el barrido del brazo y la percusion.');
  put(S, cy(0.24, 0.28, 0.36, 14, M.k), 0.10, 0.98, 1.60);             // torreta/base del brazo

  const B = new THREE.Group();
  B.position.set(0.10, 1.10, 1.68);
  const angV = 0.85;    // brazo apuntando hacia arriba (desate de techo)
  put(B, bx(0.30, 0.34, 0.34, M.k), 0, 0, 0.06);                       // hombro
  put(B, bx(0.28, 0.30, 2.30, M.bl), 0, 0, 1.25);                     // pluma
  put(B, bx(0.22, 0.24, 1.40, M.az), 0, 0, 2.90);                     // seccion telescopica
  put(B, cy(0.075, 0.075, 1.00, 10, M.azD), 0.22, -0.10, 0.90, Math.PI / 2 - 0.15); // cilindro
  put(B, cy(0.044, 0.044, 0.90, 8, M.chr), 0.22, -0.04, 1.80, Math.PI / 2 - 0.15);
  // Martillo hidraulico + pica (en la punta del brazo)
  const H = new THREE.Group();
  H.position.set(0, 0, 3.70);
  put(H, bx(0.22, 0.22, 0.60, M.k), 0, 0, 0);                          // cuerpo del martillo
  put(H, cy(0.05, 0.05, 0.20, 8, M.azD), 0.14, 0.0, -0.05, Math.PI / 2); // acumulador lateral
  const pica = new THREE.Group();
  pica.position.set(0, 0, 0.35);
  put(pica, cy(0.05, 0.05, 0.40, 10, M.pica), 0, 0, 0.10, Math.PI / 2);              // vastago de la pica
  put(pica, cone(0.05, 0.30, 10, MineMaterials.aceroPulido()), 0, 0, 0.45, Math.PI / 2); // punta PULIDA por golpear roca
  H.add(pica);
  B.add(H);
  B.rotation.x = -angV;
  S.add(B);

  // ── LUCES ──────────────────────────────────────────────────────────
  S = sub(g, 'luces', 'Faros, calaveras y baliza', 'Faros del porta-brazos, luces de trabajo, calaveras traseras y baliza ambar animada.');
  for (const xs of [-1, 1]) {
    put(S, cy(0.10, 0.10, 0.09, 16, M.k), xs * 0.82, 0.92, 1.86, Math.PI / 2);
    put(S, cy(0.076, 0.076, 0.02, 16, M.far), xs * 0.82, 0.92, 1.92, Math.PI / 2);
    put(S, tor(0.10, 0.014, Math.PI * 2, M.k), xs * 0.82, 0.92, 1.94);
  }
  for (const lx of [-0.76, -0.34, 0.08]) put(S, cy(0.072, 0.072, 0.05, 14, M.far), lx, 2.72, CZ + CD / 2 + 0.06, Math.PI / 2);
  for (const xs of [-1, 1]) put(S, bx(0.10, 0.16, 0.04, M.tail), xs * (HW - 0.03), 0.78, -2.42);
  // Reflectivos traseros (chevrones rojo/blanco 45°) + mudflaps de lodo tras las ruedas
  for (let i = -3; i <= 3; i++) put(S, bx(0.20, 0.34, 0.015, (i & 1) ? M.tail : M.bl), i * 0.26, 0.44, -2.44, 0, 0, Math.PI / 4);
  for (const xs of [-1, 1]) put(S, bx(0.40, 0.36, 0.02, M.k), xs * (HW - 0.01), 0.28, -2.10);
  const balM = new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8800, emissiveIntensity: 2.5 });
  const balX = CX + 0.40;
  put(S, cy(0.055, 0.066, 0.05, 12, M.k), balX, 2.79, CZ);
  put(S, cy(0.072, 0.072, 0.11, 14, balM), balX, 2.87, CZ);
  put(S, new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), balM), balX, 2.925, CZ);

  // ── EXTINTOR ───────────────────────────────────────────────────────
  S = sub(g, 'extintor', 'Extintor', 'Extintor con tarjeta de inspeccion (lateral del power pack).');
  S.add(crearExtintor({ x: HW + 0.10, y: 0.92, z: -1.20, ry: Math.PI / 2 }));

  g.name = 'desatador';
  g.userData.tick = (dt, elapsed) => {
    balM.emissiveIntensity = 1.5 + Math.abs(Math.sin(elapsed * 4)) * 2.5;
    // Barrido del brazo por el techo/hastial + percusion de la pica
    B.rotation.y = Math.sin(elapsed * 0.5) * 0.30;
    B.rotation.x = -angV + Math.sin(elapsed * 0.4) * 0.10;
    pica.position.z = 0.35 + Math.max(0, Math.sin(elapsed * 30)) * 0.06;  // golpeteo del martillo
  };
  g.userData.hazard = {
    tipo: 'equipoPesado', live: true, warn: 6, hurt: 0.6,
    aviso: 'DESATADOR EN OPERACION — desprendimiento de roca activo. Nunca ingreses bajo el brazo.',
    reflexion:
      'Estuviste demasiado cerca de un desatador mecanizado en operacion. El brazo desprende roca ' +
      'suelta del techo que puede caer, y la pica golpea con fuerza. Nunca te ubiques bajo el area ' +
      'de desate ni dentro del radio de giro del brazo.'
  };
  marcarEquipo(g, { prefijo: 'SCL', articulado: true });
  return g;
}
