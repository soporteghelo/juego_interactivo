import * as THREE from 'three';
import { texturaMetal, texturaGoma } from '../../world/materials/Texturas.js';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crear as crearExtintor } from '../ssoma/extintor.js';
import { sub } from '../_comun/subelemento.js';
import { marcarEquipo } from './codigo_equipo.js';

/**
 * EMPERNADOR / BOLTER 88D — EQUIPO DE SOSTENIMIENTO MECANIZADO (enmallador).
 *
 * Modelado a partir de la flota real de la mina (NEXA): el Bolter 88D es un
 * jumbo empernador electro-hidraulico de bajo perfil para el ciclo de SOSTENIMIENTO —
 * instala PERNOS de roca y coloca MALLA en un solo pase.
 *  - Chasis articulado 4x4 compacto (ancho ~2.0 m), power pack trasero.
 *  - Cabina cerrada FOPS/ROPS lateral con techo protector.
 *  - BRAZO de empernado con VIGA DE AVANCE que integra la perforadora (drifter Montabert
 *    HC50) y el CARRUSEL/REVOLVER de pernos: tras perforar el taladro, el carrusel gira y
 *    presenta el siguiente perno para insertarlo con resina/lechada. Rasgo caracteristico.
 *  - MANIPULADOR DE MALLA (canasta/plato con brazo) para sostener la plancha de malla
 *    contra el hastial mientras se empernan sus esquinas.
 *  - Gatas estabilizadoras, mangueras, luces de trabajo, baliza ambar y extintor.
 * Colores Epiroc: gris estructural + acentos rojos (se diferencia del Raptor amarillo).
 * Dimensiones ~escala real: ~11 m de largo con el brazo, ~2.0 m de ancho, ~2.9 m de alto.
 */

export const meta = {
  id: 'empernador',
  nombre: 'Empernador / Bolter 88D',
  descripcion: 'Jumbo empernador-enmallador de sostenimiento (Bolter 88D): chasis articulado, power pack, cabina cerrada, brazo con viga de avance, perforadora, CARRUSEL de pernos y manipulador de malla. Gris Epiroc con acentos rojos.'
};

function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cy(rt, rb, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat); }
function tor(r, tube, arc, mat) { return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 14, arc), mat); }
function fender(r, w, arcRad, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 16, 1, true, -arcRad / 2, arcRad), mat); }
function put(grp, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m;
}

let _mats = null;
function empMats() {
  if (_mats) return _mats;
  const metal = texturaMetal(), goma = texturaGoma();
  const paint = (color, rough) => new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.3
  });
  const steel = (color, rough, metalness) => new THREE.MeshStandardMaterial({ color, map: metal, roughness: rough, metalness });
  _mats = {
    gris:  paint(0x9aa0a6, 0.5),                                                                   // gris Epiroc
    grisD: paint(0x6d7378, 0.55),                                                                  // gris oscuro
    rojo:  paint(0xc0261f, 0.5),                                                                   // acento rojo Epiroc
    k:     steel(0x24242a, 0.62, 0.55),                                                            // fundicion/acero negro
    gom:   new THREE.MeshStandardMaterial({ color: 0x0e0e10, map: goma, roughness: 0.97, metalness: 0.0 }),
    ace:   steel(0xa2a2ac, 0.42, 0.62),                                                            // acero estructura
    chr:   new THREE.MeshStandardMaterial({ color: 0xd0d5d9, roughness: 0.14, metalness: 0.95 }),  // vastago cromado
    vig:   new THREE.MeshStandardMaterial({ color: 0xc4c9ce, map: metal, roughness: 0.5, metalness: 0.28 }), // viga aluminio
    man:   new THREE.MeshStandardMaterial({ color: 0x141420, roughness: 0.85, metalness: 0.05 }), // manguera negra
    cab:   new THREE.MeshStandardMaterial({ color: 0x0e1a26, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.5 }), // vidrio
    far:   new THREE.MeshStandardMaterial({ color: 0xeef0ff, emissive: 0xeef0ff, emissiveIntensity: 1.8, roughness: 0.08 }),
    tail:  new THREE.MeshStandardMaterial({ color: 0xcc1100, emissive: 0xcc0000, emissiveIntensity: 0.7, roughness: 0.3 }),
    rin:   steel(0x2a2a30, 0.45, 0.6),                                                             // rin
    malla: new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.6, metalness: 0.7, wireframe: true }), // plancha de malla
    res:   new THREE.MeshStandardMaterial({ color: 0xe0b23a, roughness: 0.4, metalness: 0.2 })     // perno con resina (dorado)
  };
  return _mats;
}

export function crear() {
  const g = new THREE.Group();
  const M = empMats();
  const HW = 1.00;  // semi-ancho (bajo perfil ~2.0 m)
  const GY = 0.55;  // centro rueda

  // ── CHASIS ARTICULADO ──────────────────────────────────────────────
  let S = sub(g, 'chasis', 'Chasis articulado', 'Bastidor articulado 4x4, porta-brazos frontal, articulacion de direccion y escalera de acceso.');
  put(S, bx(HW * 2, 0.30, 4.30, M.k), 0, 0.36, -0.30);
  // Barro/polvo caked en los bajos (md: nada "de fabrica" limpio). Material COMPARTIDO.
  put(S, bx(HW * 2 + 0.03, 0.18, 4.00, MineMaterials.barroBajos()), 0, 0.25, -0.30);
  put(S, bx(HW * 2 - 0.18, 0.58, 0.60, M.grisD), 0, 0.68, 1.55);        // porta-brazos frontal
  put(S, bx(HW * 2 - 0.06, 0.16, 0.18, M.k), 0, 0.42, 1.92);            // paragolpes
  put(S, cy(0.12, 0.12, 0.62, 10, M.ace), 0, 0.55, -0.20);             // pivote de articulacion
  for (const xs of [-1, 1]) {
    put(S, cy(0.055, 0.055, 0.55, 8, M.grisD), xs * (HW - 0.16), 0.44, -0.20, Math.PI / 2);
    put(S, bx(0.16, 0.30, 1.5, M.grisD), xs * (HW - 0.03), 0.52, -0.95);  // tanques laterales
  }
  for (const [sy, sz] of [[0.45, 0.95], [0.85, 0.81], [1.25, 0.67]]) put(S, bx(0.30, 0.05, 0.14, M.ace), -(HW - 0.02), sy, sz);
  put(S, bx(0.04, 1.30, 0.04, M.k), -(HW + 0.04), 1.35, 0.50, 0.12);

  // ── POWER PACK TRASERO ─────────────────────────────────────────────
  S = sub(g, 'motor', 'Power pack trasero', 'Compartimento del motor diesel/electro-hidraulico: bloque, rejillas de refrigeracion, escape vertical, radiador y paradas de emergencia.');
  put(S, bx(HW * 2, 1.20, 2.10, M.gris), 0, 1.02, -1.45);
  put(S, bx(HW * 2 - 0.1, 0.20, 2.00, M.grisD), 0, 1.64, -1.45);
  for (const xs of [-1, 1]) for (let z = -0.7; z >= -2.1; z -= 0.34) put(S, bx(0.04, 0.60, 0.20, M.k), xs * (HW - 0.01), 0.98, z);
  put(S, cy(0.05, 0.05, 0.50, 16, M.k), -0.70, 1.98, -2.10);            // escape vertical
  put(S, cy(0.065, 0.065, 0.04, 16, M.k), -0.70, 2.24, -2.10);
  put(S, bx(HW * 2 - 0.30, 0.68, 0.05, M.k), 0, 1.06, -2.44);          // radiador trasero
  for (let gy = 0.80; gy <= 1.34; gy += 0.11) put(S, bx(HW * 2 - 0.36, 0.02, 0.06, M.grisD), 0, gy, -2.42);
  for (const [ex, ez] of [[HW - 0.01, -0.85], [-(HW - 0.01), -2.05]]) {
    put(S, cy(0.05, 0.05, 0.06, 10, M.k), ex, 1.20, ez, 0, 0, Math.PI / 2);
    put(S, cy(0.055, 0.04, 0.05, 10, M.rojo), ex + Math.sign(ex) * 0.05, 1.20, ez, 0, 0, Math.PI / 2);
  }

  // ── CABINA CERRADA (FOPS/ROPS) ─────────────────────────────────────
  S = sub(g, 'cabina', 'Cabina del operador (cerrada)', 'Cabina cerrada FOPS/ROPS con parabrisas, puerta, asiento, panel de control con joysticks y espejos.');
  const CX = -0.34, CZ = 0.30, CW = 1.30, CD = 1.52;
  put(S, bx(HW * 2, 0.16, 1.62, M.gris), 0, 1.55, 0.35);
  put(S, bx(CW, 0.62, CD, M.gris), CX, 1.93, CZ);
  put(S, bx(CW + 0.02, 0.12, CD + 0.02, M.k), CX, 1.66, CZ);
  put(S, bx(CW + 0.10, 0.14, CD + 0.10, M.gris), CX, 2.62, CZ);
  put(S, bx(CW + 0.18, 0.05, CD + 0.18, M.grisD), CX, 2.71, CZ);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(S, bx(0.09, 0.66, 0.09, M.k), CX + sx * (CW / 2 - 0.02), 2.25, CZ + sz * (CD / 2 - 0.02));
  const gY = 2.28, gH = 0.60;
  put(S, bx(CW - 0.18, gH + 0.06, 0.04, M.cab), CX, gY - 0.02, CZ + CD / 2 - 0.02, -0.22);  // parabrisas
  put(S, bx(CW - 0.18, gH, 0.04, M.cab), CX, gY, CZ - CD / 2 + 0.01);                        // luneta
  for (const sx of [-1, 1]) put(S, bx(0.04, gH, CD - 0.20, M.cab), CX + sx * (CW / 2 - 0.01), gY, CZ);
  put(S, bx(0.02, 1.04, 0.88, M.grisD), CX - CW / 2 - 0.01, 2.03, CZ);                       // puerta
  put(S, bx(0.50, 0.12, 0.48, M.k), CX, 1.87, CZ - 0.12);                                    // asiento
  put(S, bx(0.50, 0.52, 0.10, M.k), CX, 2.15, CZ - 0.34);
  put(S, bx(0.92, 0.22, 0.12, M.k), CX, 2.03, CZ + 0.48);                                    // panel
  for (const jx of [-0.22, 0.22]) put(S, cy(0.016, 0.016, 0.20, 6, M.k), CX + jx, 2.21, CZ + 0.49);
  for (const sx of [-1, 1]) {
    put(S, cy(0.02, 0.02, 0.26, 6, M.k), CX + sx * (CW / 2), 2.44, CZ + 0.56, 0, 0, sx * 0.5);
    put(S, bx(0.14, 0.18, 0.03, M.k), CX + sx * (CW / 2 + 0.13), 2.58, CZ + 0.61, 0, sx * 0.35);
  }

  // ── NEUMATICOS (4) ─────────────────────────────────────────────────
  S = sub(g, 'neumaticos', 'Neumaticos', '4 neumaticos con banda de rodadura minera, rines, pernos y guardabarros.');
  for (const [px, pz] of [[-HW, 1.05], [HW, 1.05], [-HW, -1.80], [HW, -1.80]]) {
    const side = px < 0 ? -1 : 1, xo = px + side * 0.16;
    put(S, cy(0.55, 0.55, 0.34, 18, M.gom), xo, GY, pz, 0, 0, Math.PI / 2);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2, taco = bx(0.36, 0.05, 0.12, M.k);
      taco.position.set(xo, GY + Math.sin(a) * 0.555, pz + Math.cos(a) * 0.555);
      taco.rotation.x = a; S.add(taco);
    }
    put(S, cy(0.27, 0.27, 0.36, 12, M.rin), xo, GY, pz, 0, 0, Math.PI / 2);
    put(S, cy(0.10, 0.10, 0.38, 10, M.k), xo, GY, pz, 0, 0, Math.PI / 2);
    put(S, fender(0.68, 0.44, 2.5, M.grisD), xo, GY, pz, 0, 0, Math.PI / 2);
  }

  // ── GATAS ESTABILIZADORAS (4) ──────────────────────────────────────
  S = sub(g, 'gatas', 'Gatas estabilizadoras', '4 gatas hidraulicas con vastago cromado y zapata al piso.');
  for (const [gx, gz] of [[-(HW + 0.06), 1.55], [HW + 0.06, 1.55], [-(HW + 0.02), -2.50], [HW + 0.02, -2.50]]) {
    put(S, bx(0.22, 0.16, 0.24, M.grisD), gx * 0.90, 0.95, gz);
    put(S, cy(0.075, 0.075, 0.55, 10, M.grisD), gx, 0.72, gz);
    put(S, cy(0.042, 0.042, 0.50, 8, M.chr), gx, 0.28, gz);
    put(S, cy(0.15, 0.17, 0.06, 10, M.k), gx, 0.035, gz);
  }

  // ── BRAZO DE EMPERNADO + VIGA + PERFORADORA + CARRUSEL DE PERNOS ────
  // Todo el conjunto se anima junto (bajo un solo subelemento 'brazo'), igual que en raptor/jumbo.
  S = sub(g, 'brazo', 'Brazo, viga, perforadora y carrusel de pernos',
    'Brazo hidraulico de empernado con VIGA DE AVANCE, perforadora (drifter Montabert HC50) que barrena el taladro y CARRUSEL/REVOLVER giratorio de pernos que presenta el siguiente perno con resina para su insercion.');
  put(S, bx(1.30, 0.55, 0.35, M.grisD), 0, 0.94, 1.62);                 // bancada de pivote

  const B = new THREE.Group();
  B.position.set(0.10, 0.98, 1.72);
  const angV = 0.55;
  put(B, cy(0.20, 0.23, 0.16, 14, M.k), 0, -0.10, 0.02);                // turntable
  put(B, bx(0.34, 0.42, 0.36, M.k), 0, 0, 0.06);
  put(B, cy(0.058, 0.058, 0.50, 10, M.chr), 0, 0.02, 0.06, 0, 0, Math.PI / 2);
  put(B, bx(0.36, 0.38, 2.20, M.gris), 0, 0, 1.18);                     // cajon del brazo
  put(B, bx(0.28, 0.30, 1.20, M.grisD), 0, 0, 2.50);                    // seccion telescopica
  put(B, cy(0.075, 0.075, 0.90, 10, M.grisD), 0, -0.27, 0.78, Math.PI / 2 - 0.10); // cilindro elevacion
  put(B, cy(0.044, 0.044, 0.85, 8, M.chr), 0, -0.18, 1.62, Math.PI / 2 - 0.10);
  put(B, bx(0.36, 0.42, 0.44, M.k), 0, 0.02, 2.78);                     // cabezal basculante

  // VIGA DE AVANCE (feed) anidada
  const F = new THREE.Group();
  F.position.set(0, 0.16, 2.95);
  F.rotation.x = -0.05;
  const FL = 3.4, rodY = 0.20;
  put(F, bx(0.44, 0.24, 0.74, M.grisD), 0, -0.20, 0);
  put(F, bx(0.15, 0.17, FL, M.vig), 0, 0, 0.55);                        // cuerpo de la viga
  put(F, bx(0.17, 0.06, FL, M.k), 0, -0.10, 0.55);
  for (const rx of [-0.075, 0.075]) put(F, bx(0.035, 0.06, FL, M.ace), rx, 0.12, 0.55);
  put(F, cy(0.022, 0.022, FL - 0.5, 6, M.man), -0.11, -0.02, 0.55, Math.PI / 2);
  put(F, bx(0.26, 0.22, 0.16, M.k), 0, rodY, 2.20);                     // centralizador

  // CARRUSEL / REVOLVER de pernos (rasgo del empernador) — tambor con 6 pernos radiales.
  const carrusel = new THREE.Group();
  carrusel.position.set(0.34, rodY, 1.75);
  put(carrusel, cy(0.16, 0.16, 0.28, 14, M.rojo), 0, 0, 0, 0, 0, Math.PI / 2);   // tambor
  for (const ds of [-1, 1]) put(carrusel, cy(0.19, 0.19, 0.02, 14, M.k), ds * 0.15, 0, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, r = 0.135;
    // cada perno: varilla de acero + placa + tuerca (dorado resina en la punta)
    const varilla = cy(0.014, 0.014, 0.95, 6, M.ace);
    put(carrusel, varilla, 0, Math.sin(a) * r, Math.cos(a) * r, Math.PI / 2);
    put(carrusel, bx(0.05, 0.05, 0.01, M.k), 0.46, Math.sin(a) * r, Math.cos(a) * r);       // placa
    put(carrusel, cy(0.018, 0.018, 0.03, 6, M.res), -0.46, Math.sin(a) * r, Math.cos(a) * r, 0, 0, Math.PI / 2); // punta con resina
  }
  F.add(carrusel);

  // PERFORADORA (drifter) que se desliza sobre la viga
  const D = new THREE.Group();
  const drift0 = -0.55;
  D.position.set(0, 0.30, drift0);
  put(D, bx(0.24, 0.24, 0.58, M.gris), 0, 0, 0);
  put(D, bx(0.18, 0.10, 0.34, M.k), 0, 0.15, -0.06);
  put(D, bx(0.30, 0.09, 0.54, M.k), 0, -0.17, 0);
  put(D, cy(0.030, 0.030, 2.20, 8, M.ace), 0, -0.10, 1.45, Math.PI / 2); // barra de perforacion
  put(D, cy(0.050, 0.043, 0.13, 12, M.k), 0, -0.10, 2.55, Math.PI / 2);  // broca
  F.add(D);

  B.add(F);
  B.rotation.x = -angV;
  S.add(B);

  // ── MANIPULADOR DE MALLA ───────────────────────────────────────────
  S = sub(g, 'manipulador_malla', 'Manipulador de malla', 'Brazo secundario con plato/canasta que sostiene la plancha de malla contra el hastial mientras se empernan sus esquinas.');
  const Mn = new THREE.Group();
  Mn.position.set(-0.55, 1.30, 1.55);
  Mn.rotation.set(-0.35, 0.30, 0);
  put(Mn, cy(0.09, 0.09, 1.30, 10, M.grisD), 0, 0, 0.65, Math.PI / 2);   // brazo
  put(Mn, cy(0.05, 0.05, 0.90, 8, M.chr), 0, 0.10, 0.65, Math.PI / 2);   // cilindro
  put(Mn, bx(1.10, 0.06, 1.10, M.k), 0, 0, 1.40);                        // marco del plato
  put(Mn, bx(1.05, 0.02, 1.05, M.malla), 0, 0.02, 1.40);                // plancha de malla
  S.add(Mn);

  // ── MANGUERAS ──────────────────────────────────────────────────────
  S = sub(g, 'mangueras', 'Mangueras hidraulicas', 'Feston de mangueras hidraulicas drapeadas desde el deck hacia el brazo de empernado.');
  for (const [x, sag] of [[-0.05, 0.50], [0.10, 0.60], [0.24, 0.46]]) {
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 1.64, 0.60), new THREE.Vector3(x, 1.64 - sag, 1.20),
      new THREE.Vector3(x, 1.60 - sag * 0.6, 1.75), new THREE.Vector3(x, 1.72, 2.10)
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curva, 20, 0.026, 6, false), M.man);
    S.add(tube);
  }

  // ── LUCES ──────────────────────────────────────────────────────────
  S = sub(g, 'luces', 'Faros, calaveras y baliza', 'Faros del porta-brazos, barra de luces de trabajo del techo, calaveras traseras y baliza ambar animada.');
  for (const xs of [-1, 1]) {
    put(S, cy(0.10, 0.10, 0.09, 16, M.k), xs * 0.82, 0.90, 1.86, Math.PI / 2);
    put(S, cy(0.076, 0.076, 0.02, 16, M.far), xs * 0.82, 0.90, 1.92, Math.PI / 2);
    put(S, tor(0.10, 0.014, Math.PI * 2, M.k), xs * 0.82, 0.90, 1.94);
  }
  for (const lx of [-0.76, -0.34, 0.08]) {
    put(S, cy(0.078, 0.078, 0.05, 14, M.k), lx, 2.68, CZ + CD / 2 + 0.02, Math.PI / 2);
    put(S, cy(0.072, 0.072, 0.05, 14, M.far), lx, 2.68, CZ + CD / 2 + 0.06, Math.PI / 2);
  }
  for (const xs of [-1, 1]) put(S, bx(0.10, 0.16, 0.04, M.tail), xs * (HW - 0.03), 0.78, -2.45);
  // Reflectivos traseros (chevrones rojo/blanco 45°) + mudflaps de lodo tras las ruedas
  for (let i = -3; i <= 3; i++) put(S, bx(0.20, 0.34, 0.015, (i & 1) ? M.rojo : M.ace), i * 0.26, 0.44, -2.47, 0, 0, Math.PI / 4);
  for (const xs of [-1, 1]) put(S, bx(0.40, 0.36, 0.02, M.k), xs * (HW - 0.01), 0.28, -2.15);
  const balM = new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8800, emissiveIntensity: 2.5 });
  const balX = CX + 0.40;
  put(S, cy(0.055, 0.066, 0.05, 12, M.k), balX, 2.77, CZ);
  const baliza = cy(0.072, 0.072, 0.11, 14, balM);
  put(S, baliza, balX, 2.85, CZ);
  put(S, new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), balM), balX, 2.905, CZ);

  // ── EXTINTOR ───────────────────────────────────────────────────────
  S = sub(g, 'extintor', 'Extintor', 'Extintor con tarjeta de inspeccion (lateral derecho del power pack).');
  S.add(crearExtintor({ x: HW + 0.10, y: 0.92, z: -1.25, ry: Math.PI / 2 }));

  g.name = 'empernador';
  g.userData.tick = (dt, elapsed) => {
    balM.emissiveIntensity = 1.5 + Math.abs(Math.sin(elapsed * 4)) * 2.5;
    B.rotation.y = Math.sin(elapsed * 0.26) * 0.03;
    B.rotation.x = -angV + Math.sin(elapsed * 0.20) * 0.015;
    // Avance de la perforadora + percusion (barrenado del taladro para el perno)
    const feed = (Math.sin(elapsed * 0.4) * 0.5 + 0.5) * 0.55;
    D.position.z = drift0 + feed + Math.sin(elapsed * 40) * 0.005;
    // Giro lento del carrusel de pernos (indexado)
    carrusel.rotation.x = elapsed * 0.35;
  };
  g.userData.hazard = {
    tipo: 'equipoPesado', live: true, warn: 6, hurt: 0.6,
    aviso: 'EMPERNADOR EN OPERACION — zona de sostenimiento activa. Mantente a distancia segura.',
    reflexion:
      'Estuviste demasiado cerca de un empernador en operacion. El brazo, la barra de perforacion ' +
      'y el manipulador de malla pueden golpear sin aviso. Respeta las distancias de seguridad y ' +
      'nunca ingreses al radio de giro del brazo de un equipo en movimiento.'
  };
  marcarEquipo(g, { prefijo: 'EMP', articulado: true });
  return g;
}
