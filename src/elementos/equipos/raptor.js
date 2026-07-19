import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { texturaMetal, texturaGoma } from '../../world/materials/Texturas.js';
import { crear as crearExtintor } from '../ssoma/extintor.js';
import { sub } from '../_comun/subelemento.js';
import { marcarEquipo } from './codigo_equipo.js';

/**
 * RAPTOR (XP) — JUMBO DE PERFORACION FRONTAL DE UN SOLO BRAZO.
 *
 * Modelado a partir de la foto de referencia (equipo amarillo) y de la ficha tecnica
 * del Raptor 44/55 XP:
 *  - Equipo electro-hidraulico de avance, ~14.5 t, brazo hidraulico unico "AP" con paralelismo
 *    automatico, perforadora (drifter) HC95 (Ø51-75 mm).
 *  - Chasis articulado 4x4 compacto (ancho ~1.5 m), power pack TRASERO (motor diesel +
 *    compresor + tanques) con rejillas, escape vertical y paradas de emergencia rojas.
 *  - Cabina CERRADA FOPS/ROPS centrada con parabrisas inclinado, baliza ambar y barra de
 *    luces de trabajo. Rotulo "RAPTOR" en el costado.
 *  - Brazo unico central que arranca del porta-brazos frontal y sostiene la VIGA DE AVANCE
 *    con la perforadora deslizante, barra y broca de botones; MOTOR DE AVANCE VERDE en la
 *    cola de la viga y CANASTA/guarda superior (proteccion de la posicion de perforacion),
 *    rasgos caracteristicos del Raptor.
 *  - Abundante tendido de MANGUERAS hidraulicas en lazos entre la cabina y el brazo.
 *  - 4 gatas estabilizadoras con zapata al piso.
 * Dimensiones ~escala real: ~10.5 m de largo con el brazo, ~2.0 m de ancho con ruedas,
 * ~2.9 m de alto de cabina (feed sobresale por encima).
 */

export const meta = {
  id: 'raptor',
  nombre: 'Jumbo Raptor (frontal)',
  descripcion: 'Jumbo de perforacion frontal de UN brazo (Raptor XP): chasis articulado, power pack trasero, cabina cerrada, viga de avance con perforadora deslizante, motor de avance verde, canasta guarda y mangueras. Amarillo.'
};

function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cy(rt, rb, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat); }
function tor(r, tube, arc, mat) { return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 14, arc), mat); }
// Guardabarros: medio-tubo abierto (cobertura angular en radianes, centrada arriba).
function fender(r, w, arcRad, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 16, 1, true, -arcRad / 2, arcRad), mat); }
function put(grp, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m;
}

/**
 * Materiales del Raptor, COMPARTIDOS entre instancias (se crean una sola vez).
 * Amarillo (pintura con clearcoat) + acero cepillado en la estructura + el
 * caracteristico MOTOR DE AVANCE VERDE de la viga.
 */
let _mats = null;
function raptorMats() {
  if (_mats) return _mats;
  const metal = texturaMetal(), goma = texturaGoma();
  const paint = (color, rough) => new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0.15, clearcoat: 0.7, clearcoatRoughness: 0.22
  });
  const steel = (color, rough, metalness) => new THREE.MeshStandardMaterial({ color, map: metal, roughness: rough, metalness });
  _mats = {
    am:   paint(0xf2c200, 0.48),                                                                 // amarillo (vivo)
    amD:  paint(0xc99a00, 0.56),                                                                 // amarillo oscuro
    k:    steel(0x24242a, 0.62, 0.55),                                                           // fundicion/acero negro
    gom:  new THREE.MeshStandardMaterial({ color: 0x0e0e10, map: goma, roughness: 0.97, metalness: 0.0 }), // goma neumatico
    ace:  steel(0xa2a2ac, 0.42, 0.62),                                                           // acero barras/estructura
    chr:  new THREE.MeshStandardMaterial({ color: 0xd0d5d9, roughness: 0.14, metalness: 0.95 }), // vastago cromado pulido
    vig:  new THREE.MeshStandardMaterial({ color: 0xc4c9ce, map: metal, roughness: 0.5, metalness: 0.28 }), // viga aluminio claro
    man:  new THREE.MeshStandardMaterial({ color: 0x141420, roughness: 0.85, metalness: 0.05 }), // manguera hidraulica negra
    agua: new THREE.MeshStandardMaterial({ color: 0x2a5f8a, roughness: 0.7, metalness: 0.12 }),  // manguera de agua azul
    verde:new THREE.MeshStandardMaterial({ color: 0x2f9e34, roughness: 0.45, metalness: 0.3 }),  // MOTOR DE AVANCE VERDE (rasgo Raptor)
    cab:  new THREE.MeshStandardMaterial({ color: 0x0e1a26, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.5 }), // vidrio cabina
    far:  new THREE.MeshStandardMaterial({ color: 0xeef0ff, emissive: 0xeef0ff, emissiveIntensity: 1.8, roughness: 0.08 }), // faros
    tail: new THREE.MeshStandardMaterial({ color: 0xcc1100, emissive: 0xcc0000, emissiveIntensity: 0.7, roughness: 0.3 }),   // calaveras
    rojo: new THREE.MeshStandardMaterial({ color: 0xcc1c1c, roughness: 0.5, metalness: 0.1 }),   // parada de emergencia
    vid:  new THREE.MeshStandardMaterial({ color: 0x141519, roughness: 0.25, metalness: 0.65 }), // vidrio/plastico oscuro
    rin:  steel(0x2a2a30, 0.45, 0.6)                                                             // rin metalico
  };
  return _mats;
}

export function crear() {
  const g = new THREE.Group();
  const M = raptorMats();
  const mAm = M.am, mAmD = M.amD, mK = M.k, mGom = M.gom, mAce = M.ace, mChr = M.chr,
        mVig = M.vig, mMan = M.man, mAgua = M.agua, mVerde = M.verde, mCab = M.cab,
        mFar = M.far, mTail = M.tail, mRojo = M.rojo, mVid = M.vid, mRin = M.rin;

  const HW = 0.92; // semi-ancho cuerpo (Raptor XP compacto, trocha ~1.5-1.8 m)
  const GY = 0.55; // centro rueda (radio del neumatico → apoyo al piso en y=0)

  // ══════════════════════════════════════════════════════════════════
  //  CHASIS ARTICULADO
  // ══════════════════════════════════════════════════════════════════
  let S = sub(g, 'chasis', 'Chasis articulado', 'Bastidor articulado 4x4, porta-brazos frontal, tanques laterales, articulacion de direccion y escalera.');
  put(S, bx(HW * 2, 0.28, 4.10, mK), 0, 0.36, -0.35);                 // bastidor
  // Barro/polvo caked en los bajos (md: nada "de fabrica" limpio). Material COMPARTIDO.
  put(S, bx(HW * 2 + 0.03, 0.18, 3.80, MineMaterials.barroBajos()), 0, 0.25, -0.35);
  put(S, bx(HW * 2 - 0.18, 0.56, 0.58, mAmD), 0, 0.66, 1.45);        // porta-brazos frontal (robusto)
  put(S, bx(HW * 2 - 0.06, 0.16, 0.18, mK), 0, 0.42, 1.80);          // paragolpes frontal
  for (const xs of [-1, 1]) put(S, bx(0.10, 0.24, 0.12, mAmD), xs * (HW - 0.22), 0.46, 1.84); // cachos del bumper
  // Articulacion central de direccion (pivote + 2 cilindros)
  put(S, cy(0.12, 0.12, 0.60, 10, mAce), 0, 0.55, -0.25);
  for (const xs of [-1, 1]) {
    put(S, cy(0.055, 0.055, 0.55, 8, mAmD), xs * (HW - 0.16), 0.44, -0.25, Math.PI / 2);
    put(S, cy(0.032, 0.032, 0.28, 8, mChr), xs * (HW - 0.16), 0.44, 0.00, Math.PI / 2);
  }
  // Tanques laterales (hidraulico + agua) sobre los rieles
  for (const xs of [-1, 1]) {
    put(S, bx(0.16, 0.30, 1.50, mAmD), xs * (HW - 0.03), 0.52, -0.95);
    put(S, cy(0.05, 0.05, 0.10, 8, mK), xs * (HW - 0.03), 0.70, -1.60);
  }
  // Escalera de acceso a la cabina (lado izquierdo)
  for (const [sy, sz] of [[0.45, 0.90], [0.85, 0.76], [1.25, 0.62]]) {
    put(S, bx(0.30, 0.05, 0.14, mAce), -(HW - 0.02), sy, sz);
  }
  put(S, bx(0.04, 1.30, 0.04, mK), -(HW + 0.04), 1.35, 0.45, 0.12);   // pasamanos

  // ══════════════════════════════════════════════════════════════════
  //  POWER PACK TRASERO (motor diesel + compresor + hidraulica)
  // ══════════════════════════════════════════════════════════════════
  S = sub(g, 'motor', 'Power pack trasero', 'Compartimento del motor diesel/compresor: bloque, rejillas, escape vertical, radiador, filtro de aire, argollas de izaje y paradas de emergencia.');
  put(S, bx(HW * 2, 1.18, 2.05, mAm), 0, 1.02, -1.35);               // bloque del power pack
  put(S, bx(HW * 2 - 0.1, 0.20, 1.95, mAmD), 0, 1.62, -1.35);        // tapa superior
  // Rejillas laterales de refrigeracion
  for (const xs of [-1, 1]) {
    for (let z = -0.6; z >= -2.05; z -= 0.34) {
      put(S, bx(0.04, 0.60, 0.20, mK), xs * (HW - 0.01), 0.98, z);
    }
  }
  // Escape vertical con tapa antilluvia + filtro de aire
  put(S, cy(0.05, 0.05, 0.50, 16, mK), -0.70, 1.96, -2.02);
  put(S, cy(0.065, 0.065, 0.04, 16, mK), -0.70, 2.22, -2.02);
  put(S, cy(0.07, 0.045, 0.06, 12, mK), -0.70, 2.28, -2.02, Math.PI + 0.25);
  put(S, cy(0.13, 0.13, 0.50, 18, mK), 0.55, 1.80, -1.75, 0, 0, Math.PI / 2);
  put(S, cy(0.145, 0.145, 0.05, 18, mAmD), 0.35, 1.80, -1.75, 0, 0, Math.PI / 2);
  // Parrilla del radiador (trasera) + laminas
  put(S, bx(HW * 2 - 0.30, 0.68, 0.05, mK), 0, 1.06, -2.36);
  for (let gy = 0.80; gy <= 1.34; gy += 0.11) put(S, bx(HW * 2 - 0.36, 0.02, 0.06, mAmD), 0, gy, -2.34);
  // Argollas de izaje
  for (const xs of [-1, 1]) put(S, tor(0.07, 0.018, Math.PI * 2, mAce), xs * 0.52, 1.74, -1.35, Math.PI / 2);
  // Paradas de emergencia rojas (botones tipo hongo) en los costados del power pack
  for (const [ex, ez] of [[HW - 0.01, -0.75], [-(HW - 0.01), -1.95]]) {
    put(S, cy(0.05, 0.05, 0.06, 10, mK), ex, 1.20, ez, 0, 0, Math.PI / 2);
    put(S, cy(0.055, 0.04, 0.05, 10, mRojo), ex + Math.sign(ex) * 0.05, 1.20, ez, 0, 0, Math.PI / 2);
  }
  // Placa de datos + bocina (lateral derecho)
  put(S, bx(0.16, 0.11, 0.01, mVid), HW - 0.01, 1.18, -0.55, 0, Math.PI / 2);
  put(S, cy(0.05, 0.09, 0.14, 10, mK), HW - 0.08, 1.78, -0.75, 0, 0, Math.PI / 2 + 0.3);

  // ══════════════════════════════════════════════════════════════════
  //  CABINA CERRADA (FOPS/ROPS) — centrada, parabrisas inclinado
  // ══════════════════════════════════════════════════════════════════
  S = sub(g, 'cabina', 'Cabina del operador (cerrada)', 'Cabina cerrada FOPS/ROPS con parabrisas inclinado, puerta lateral, asiento, panel de control, espejos, limpiaparabrisas y rotulo RAPTOR.');
  const CX = -0.30, CZ = 0.28;   // centro de la cabina (ligeramente a la izquierda)
  const CW = 1.28, CD = 1.50;
  put(S, bx(HW * 2, 0.16, 1.60, mAm), 0, 1.55, 0.35);                // deck del operador
  put(S, bx(CW, 0.62, CD, mAm), CX, 1.93, CZ);                       // cuerpo inferior
  put(S, bx(CW + 0.02, 0.12, CD + 0.02, mK), CX, 1.66, CZ);         // zocalo negro
  put(S, bx(CW + 0.10, 0.14, CD + 0.10, mAm), CX, 2.62, CZ);        // techo
  put(S, bx(CW + 0.18, 0.05, CD + 0.18, mAmD), CX, 2.71, CZ);       // visera del techo
  // 4 parantes ROPS
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    put(S, bx(0.09, 0.66, 0.09, mK), CX + sx * (CW / 2 - 0.02), 2.25, CZ + sz * (CD / 2 - 0.02));
  }
  // Ventanas: parabrisas INCLINADO al frente (hacia el brazo) + laterales + luneta
  const gY = 2.28, gH = 0.60;
  put(S, bx(CW - 0.18, gH + 0.06, 0.04, mCab), CX, gY - 0.02, CZ + CD / 2 - 0.02, -0.22); // parabrisas inclinado
  put(S, bx(CW - 0.18, gH, 0.04, mCab), CX, gY, CZ - CD / 2 + 0.01);                       // luneta trasera
  put(S, bx(0.04, gH, CD - 0.20, mCab), CX + CW / 2 - 0.01, gY, CZ);                        // ventana derecha
  put(S, bx(0.04, gH, CD - 0.20, mCab), CX - CW / 2 + 0.01, gY, CZ);                        // ventana izq (puerta)
  // Puerta izquierda (panel + manija)
  put(S, bx(0.02, 1.04, 0.88, mAmD), CX - CW / 2 - 0.01, 2.03, CZ);
  put(S, cy(0.018, 0.018, 0.10, 6, mChr), CX - CW / 2 - 0.05, 2.00, CZ + 0.30, 0, 0, Math.PI / 2);
  // Asiento del operador (mira a +Z)
  put(S, bx(0.50, 0.12, 0.48, mK), CX, 1.87, CZ - 0.12);
  put(S, bx(0.50, 0.52, 0.10, mK), CX, 2.15, CZ - 0.34);
  // Panel de control + joysticks
  put(S, bx(0.92, 0.22, 0.12, mK), CX, 2.03, CZ + 0.48);
  put(S, bx(0.74, 0.16, 0.06, MineMaterials.plano(0x223344, { rough: 0.3, metal: 0.5 })), CX, 2.08, CZ + 0.53);
  for (const jx of [-0.22, 0.22]) put(S, cy(0.016, 0.016, 0.20, 6, mK), CX + jx, 2.21, CZ + 0.49);
  // Espejos retrovisores
  for (const sx of [-1, 1]) {
    put(S, cy(0.02, 0.02, 0.26, 6, mK), CX + sx * (CW / 2), 2.44, CZ + 0.56, 0, 0, sx * 0.5);
    put(S, bx(0.14, 0.18, 0.03, mVid), CX + sx * (CW / 2 + 0.13), 2.58, CZ + 0.61, 0, sx * 0.35);
  }
  // Limpiaparabrisas + antena
  put(S, cy(0.010, 0.010, 0.42, 6, mK), CX + 0.10, 2.10, CZ + CD / 2 + 0.02, 0, 0, 0.9);
  put(S, cy(0.012, 0.006, 0.55, 6, mK), CX - CW / 2 + 0.10, 2.97, CZ - 0.4);
  // Rotulo RAPTOR (placa clara con texto oscuro simulado por franja) en el costado derecho
  put(S, bx(0.62, 0.14, 0.01, MineMaterials.plano(0xf7f7f2, { rough: 0.4, metal: 0.0 })), CX + CW / 2 + 0.005, 1.95, CZ + 0.15, 0, Math.PI / 2);
  put(S, bx(0.46, 0.05, 0.012, MineMaterials.plano(0x111111, { rough: 0.5, metal: 0.0 })), CX + CW / 2 + 0.012, 1.95, CZ + 0.15, 0, Math.PI / 2);

  // ══════════════════════════════════════════════════════════════════
  //  NEUMATICOS (4)
  // ══════════════════════════════════════════════════════════════════
  S = sub(g, 'neumaticos', 'Neumaticos', '4 neumaticos con banda de rodadura minera, rines, pernos y guardabarros.');
  for (const [px, pz] of [[-HW, 1.00], [HW, 1.00], [-HW, -1.75], [HW, -1.75]]) {
    const side = px < 0 ? -1 : 1;
    const xo = px + side * 0.16;
    put(S, cy(0.55, 0.55, 0.34, 18, mGom), xo, GY, pz, 0, 0, Math.PI / 2); // neumatico
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const taco = bx(0.36, 0.05, 0.12, mK);
      taco.position.set(xo, GY + Math.sin(a) * 0.555, pz + Math.cos(a) * 0.555);
      taco.rotation.x = a; S.add(taco);
    }
    put(S, cy(0.27, 0.27, 0.36, 12, mRin), xo, GY, pz, 0, 0, Math.PI / 2);
    put(S, cy(0.10, 0.10, 0.38, 10, mK), xo, GY, pz, 0, 0, Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      put(S, cy(0.022, 0.022, 0.06, 6, mK), xo + side * 0.17, GY + Math.sin(a) * 0.15, pz + Math.cos(a) * 0.15, 0, 0, Math.PI / 2);
    }
    put(S, fender(0.68, 0.44, 2.5, mAmD), xo, GY, pz, 0, 0, Math.PI / 2);
  }

  // ══════════════════════════════════════════════════════════════════
  //  GATAS ESTABILIZADORAS (4)
  // ══════════════════════════════════════════════════════════════════
  S = sub(g, 'gatas', 'Gatas estabilizadoras', '4 gatas hidraulicas con vastago cromado, pasador de seguridad y zapata al piso.');
  for (const [gx, gz] of [[-(HW + 0.06), 1.45], [HW + 0.06, 1.45], [-(HW + 0.02), -2.45], [HW + 0.02, -2.45]]) {
    const gside = gx < 0 ? -1 : 1;
    put(S, bx(0.22, 0.16, 0.24, mAmD), gx * 0.90, 0.95, gz);
    put(S, cy(0.075, 0.075, 0.55, 10, mAmD), gx, 0.72, gz);
    put(S, cy(0.042, 0.042, 0.50, 8, mChr), gx, 0.28, gz);
    put(S, cy(0.15, 0.17, 0.06, 10, mK), gx, 0.035, gz);
    put(S, cy(0.022, 0.022, 0.10, 6, mAce), gx * 0.90, 0.72, gz + gside * 0.14, Math.PI / 2);
  }

  // ══════════════════════════════════════════════════════════════════
  //  BRAZO UNICO + VIGA DE AVANCE + PERFORADORA + CANASTA
  // ══════════════════════════════════════════════════════════════════
  // NOTA: el brazo, la viga, la canasta y la perforadora se ANIDAN (viga sobre el cabezal,
  // perforadora sobre la viga) para que la ARTICULACION las mueva juntas en el tick. Por eso,
  // igual que en jumbo.js, todo el conjunto vive bajo UN subelemento 'brazo' (los grupos F/C/D
  // son grupos planos internos, no subelementos separados que quedarian vacios o sin animar).
  S = sub(g, 'brazo', 'Brazo, viga y perforadora',
    'Conjunto de perforacion articulado: brazo hidraulico unico (turntable, rotula, cajon + extension telescopica, cilindros de elevacion/giro/extension, cabezal basculante), VIGA DE AVANCE (aluminio, guias, mangueras, centralizador, stinger, MOTOR DE AVANCE VERDE + carrete FRAD), CANASTA/guarda superior y PERFORADORA HC95 deslizante con barra y broca de botones.');
  put(S, bx(1.30, 0.55, 0.35, mAmD), 0, 0.92, 1.55);                 // bancada de pivote

  // Grupo del brazo (se anima con leve balanceo)
  const B = new THREE.Group();
  B.position.set(0, 0.95, 1.66);
  const angV = 0.50;   // elevacion del brazo (feed apunta hacia arriba-adelante, como en la foto)
  // Turntable + rotula + pasador
  put(B, cy(0.20, 0.23, 0.16, 14, mK), 0, -0.10, 0.02);
  put(B, cy(0.21, 0.21, 0.04, 14, mAmD), 0, -0.02, 0.02);
  put(B, bx(0.34, 0.42, 0.36, mK), 0, 0, 0.06);
  put(B, cy(0.058, 0.058, 0.50, 10, mChr), 0, 0.02, 0.06, 0, 0, Math.PI / 2);
  // Cuerpo del brazo (cajon) + extension telescopica
  put(B, bx(0.36, 0.38, 2.20, mAm), 0, 0, 1.18);
  put(B, bx(0.38, 0.13, 2.05, mAmD), 0, -0.23, 1.12);               // nervio inferior
  put(B, bx(0.28, 0.30, 1.20, mAmD), 0, 0, 2.50);                   // seccion telescopica
  // Cilindro de extension (sobre el cajon)
  put(B, cy(0.058, 0.058, 1.15, 10, mAmD), 0, 0.26, 1.25, Math.PI / 2 - 0.01);
  put(B, cy(0.036, 0.036, 1.00, 8, mChr), 0, 0.26, 2.20, Math.PI / 2 - 0.01);
  // Cilindro de elevacion (bajo el brazo)
  put(B, cy(0.075, 0.075, 0.90, 10, mAmD), 0, -0.27, 0.78, Math.PI / 2 - 0.10);
  put(B, cy(0.044, 0.044, 0.85, 8, mChr), 0, -0.18, 1.62, Math.PI / 2 - 0.10);
  // Cilindro de giro (lateral)
  put(B, cy(0.055, 0.055, 0.72, 8, mAmD), 0.22, 0.02, 0.80, Math.PI / 2);
  put(B, cy(0.032, 0.032, 0.62, 8, mChr), 0.22, 0.02, 1.42, Math.PI / 2);
  // Cabezal basculante (rollover)
  put(B, bx(0.36, 0.42, 0.44, mK), 0, 0.02, 2.78);
  put(B, cy(0.035, 0.035, 0.48, 8, mChr), 0, 0.22, 2.46, Math.PI / 2 - 0.25);
  // Lazos de manguera colgando bajo el brazo + P-clips
  for (const [lz, lr] of [[0.60, 0.18], [1.65, 0.16]]) {
    put(B, tor(lr, 0.030, Math.PI, mMan), 0.02, -0.18, lz, 0, Math.PI / 2, Math.PI);
  }
  for (let cz = 0.40; cz <= 2.10; cz += 0.42) {
    put(B, tor(0.16, 0.016, Math.PI * 1.3, mK), 0, 0.02, cz, 0, Math.PI / 2, Math.PI);
  }

  // ── VIGA DE AVANCE (feed) — grupo plano anidado en el brazo ──────
  // Perfil ESBELTO (no un tablon): cuerpo estrecho + tapa de cadena + 2 rieles guia por donde
  // se desliza la perforadora, con la barra de perforacion corriendo por ENCIMA (visible).
  const F = new THREE.Group();
  F.position.set(0, 0.16, 2.95);
  F.rotation.x = -0.05;
  const FL = 4.3;
  const rodY = 0.20;   // altura del eje de perforacion (barra) sobre la viga → todo se alinea aqui
  put(F, bx(0.44, 0.24, 0.74, mAmD), 0, -0.20, 0);                  // cuna de montaje al cabezal
  put(F, bx(0.15, 0.17, FL, mVig), 0, 0, 0.95);                    // cuerpo esbelto de la viga
  put(F, bx(0.17, 0.06, FL, mK), 0, -0.10, 0.95);                 // tapa de cadena inferior
  for (const rx of [-0.075, 0.075]) put(F, bx(0.035, 0.06, FL, mAce), rx, 0.12, 0.95); // rieles guia
  // Mangueras hidraulica + agua por el costado de la viga
  put(F, cy(0.022, 0.022, FL - 0.5, 6, mMan), -0.11, -0.02, 0.95, Math.PI / 2);
  put(F, cy(0.018, 0.018, FL - 0.5, 6, mAgua), 0.11, -0.02, 0.95, Math.PI / 2);
  // Centralizador frontal (guia del barreno) a la altura del eje de la barra
  put(F, bx(0.26, 0.22, 0.16, mK), 0, rodY, 3.05);
  for (const jsx of [-1, 1]) put(F, bx(0.06, 0.12, 0.18, mAce), jsx * 0.11, rodY, 3.11);
  // MOTOR DE AVANCE VERDE + carrete FRAD en la COLA de la viga (rasgo caracteristico)
  put(F, bx(0.26, 0.32, 0.46, mVerde), 0, 0.10, -1.30);           // cuerpo del motor de avance
  put(F, cy(0.11, 0.11, 0.22, 12, mVerde), 0, 0.10, -1.58, Math.PI / 2); // tapa del motor
  put(F, cy(0.14, 0.15, 0.22, 12, mK), 0, 0.30, -1.02, 0, 0, Math.PI / 2); // tambor FRAD
  for (const dsx of [-0.10, 0.10]) put(F, cy(0.17, 0.17, 0.02, 12, mAmD), dsx, 0.30, -1.02, 0, 0, Math.PI / 2);
  put(F, tor(0.13, 0.02, Math.PI * 2, mMan), 0, 0.30, -1.02, 0, Math.PI / 2, 0);

  // ── CANASTA / GUARDA (jaula CILINDRICA alrededor de la salida del barreno) ──
  // Jaula cerrada (anillos completos + barras longitudinales) en el frente de la viga: envuelve
  // la barra/broca y protege la posicion de perforacion. Al ser cilindrica lee como CANASTA
  // desde cualquier angulo (no como un rastrillo).
  const C = new THREE.Group();
  C.position.set(0, rodY, 3.28);
  const CR = 0.23;
  for (const cz of [-0.20, 0.05, 0.30, 0.55]) put(C, tor(CR, 0.020, Math.PI * 2, mK), 0, 0, cz); // anillos
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    put(C, cy(0.012, 0.012, 0.80, 6, mK), Math.cos(a) * CR, Math.sin(a) * CR, 0.17, Math.PI / 2); // barras
  }
  for (const sx of [-1, 1]) put(C, cy(0.02, 0.02, 0.34, 6, mAce), sx * (CR - 0.02), -CR - 0.02, -0.12, Math.PI / 2 - 0.35); // brazos de montaje
  F.add(C);

  // ── PERFORADORA (drifter) — grupo plano que se desliza sobre la viga ──
  const D = new THREE.Group();
  const drift0 = -1.05;
  D.position.set(0, 0.30, drift0);   // el cuerpo va SOBRE los rieles; la barra en el eje rodY
  put(D, bx(0.24, 0.24, 0.62, mAm), 0, 0, 0);                       // cuerpo del rock drill
  put(D, bx(0.18, 0.10, 0.34, mK), 0, 0.15, -0.06);                // bloque de valvulas (arriba)
  put(D, bx(0.30, 0.09, 0.58, mK), 0, -0.17, 0);                   // cradle que abraza los rieles
  put(D, cy(0.05, 0.05, 0.26, 10, mAmD), 0.15, 0.0, -0.10, Math.PI / 2); // acumulador
  for (const bsx of [-1, 1]) put(D, cy(0.012, 0.012, 0.60, 6, mChr), bsx * 0.11, -0.02, 0, Math.PI / 2); // pernos tirante
  put(D, cy(0.055, 0.045, 0.16, 10, mK), 0, -0.10, 0.36, Math.PI / 2); // chuck (eje de la barra)
  put(D, cy(0.042, 0.042, 0.10, 8, mAgua), 0, -0.10, 0.34, Math.PI / 2); // swivel de agua
  put(D, cy(0.030, 0.030, 3.90, 8, mAce), 0, -0.10, 2.30, Math.PI / 2);  // barra de perforacion (visible sobre la viga)
  put(D, cy(0.050, 0.043, 0.13, 12, mK), 0, -0.10, 4.30, Math.PI / 2);   // broca de botones
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    put(D, cy(0.010, 0.010, 0.02, 6, mChr), Math.sin(a) * 0.026, -0.10 + Math.cos(a) * 0.026, 4.37, Math.PI / 2); // botones de la broca
  }
  put(D, tor(0.12, 0.024, Math.PI, mMan), 0, 0.05, -0.42, 0, Math.PI / 2, Math.PI); // lazo de manguera
  F.add(D);

  B.add(F);
  B.rotation.x = -angV;
  S.add(B);   // todo el conjunto (brazo + viga + canasta + perforadora) bajo el subelemento 'brazo'

  // ══════════════════════════════════════════════════════════════════
  //  MANGUERAS (cuerpo → brazo)
  // ══════════════════════════════════════════════════════════════════
  S = sub(g, 'mangueras', 'Mangueras hidraulicas', 'Carrete de mangueras y tendido en lazos desde la cabina hacia el brazo unico.');
  put(S, cy(0.20, 0.20, 0.40, 14, mK), 0.35, 1.14, 1.20, 0, 0, Math.PI / 2); // tambor
  for (const fx of [0.16, 0.27, 0.43, 0.54]) put(S, cy(0.26, 0.26, 0.02, 14, mAmD), fx, 1.14, 1.20, 0, 0, Math.PI / 2);
  for (const cx of [0.25, 0.35, 0.45]) put(S, tor(0.19, 0.018, Math.PI * 2, mMan), cx, 1.14, 1.20, 0, Math.PI / 2, 0);
  // FESTON de mangueras: haz drapeado (catenaria real) desde el deck/cabina hasta el brazo —
  // rasgo MUY visible en la foto del Raptor. Cada manguera cuelga y vuelve a subir al brazo.
  for (const [x, sag, mm] of [[-0.12, 0.52, mMan], [0.0, 0.64, mMan], [0.12, 0.55, mAgua], [0.24, 0.42, mMan]]) {
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 1.64, 0.55),               // anclaje trasero (sobre el deck)
      new THREE.Vector3(x, 1.64 - sag, 1.15),         // panza del feston
      new THREE.Vector3(x, 1.58 - sag * 0.65, 1.75),
      new THREE.Vector3(x, 1.70, 2.15)                // sube al cajon del brazo
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curva, 22, 0.028, 6, false), mm);
    tube.name = 'manguera_festón';
    S.add(tube);
  }

  // ══════════════════════════════════════════════════════════════════
  //  LUCES
  // ══════════════════════════════════════════════════════════════════
  S = sub(g, 'luces', 'Faros, calaveras y baliza', 'Faros del porta-brazos con guarda, barra de luces de trabajo del techo, calaveras traseras y baliza ambar animada.');
  // Faros redondos con guarda en el frente
  for (const xs of [-1, 1]) {
    put(S, cy(0.10, 0.10, 0.09, 16, mK), xs * 0.82, 0.88, 1.76, Math.PI / 2);
    put(S, cy(0.076, 0.076, 0.02, 16, mFar), xs * 0.82, 0.88, 1.82, Math.PI / 2);
    put(S, tor(0.10, 0.014, Math.PI * 2, mK), xs * 0.82, 0.88, 1.84);
    for (const a of [0.4, Math.PI / 2 + 0.4]) put(S, bx(0.20, 0.013, 0.013, mK), xs * 0.82, 0.88, 1.845, 0, 0, a);
  }
  // Barra de luces de trabajo en el frente del techo de la cabina
  for (const lx of [-0.72, -0.30, 0.12]) {
    put(S, cy(0.078, 0.078, 0.05, 14, mK), lx, 2.68, CZ + CD / 2 + 0.02, Math.PI / 2);
    put(S, cy(0.072, 0.072, 0.05, 14, mFar), lx, 2.68, CZ + CD / 2 + 0.06, Math.PI / 2);
  }
  // Calaveras traseras (rojas)
  for (const xs of [-1, 1]) put(S, bx(0.10, 0.16, 0.04, mTail), xs * (HW - 0.03), 0.78, -2.37);
  // Baliza ambar en el techo
  const balM = new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8800, emissiveIntensity: 2.5 });
  const balX = CX + 0.40;
  put(S, cy(0.055, 0.066, 0.05, 12, mK), balX, 2.77, CZ);
  const baliza = cy(0.072, 0.072, 0.11, 14, balM);
  put(S, baliza, balX, 2.85, CZ);
  put(S, new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), balM), balX, 2.905, CZ);

  // ══════════════════════════════════════════════════════════════════
  //  EXTINTOR + TICK + HAZARD
  // ══════════════════════════════════════════════════════════════════
  S = sub(g, 'extintor', 'Extintor', 'Extintor con tarjeta de inspeccion (lateral derecho del power pack).');
  S.add(crearExtintor({ x: HW + 0.10, y: 0.92, z: -1.15, ry: Math.PI / 2 }));

  g.name = 'raptor';
  const balizaM = baliza.material;
  g.userData.tick = (dt, elapsed) => {
    balizaM.emissiveIntensity = 1.5 + Math.abs(Math.sin(elapsed * 4)) * 2.5;
    // Balanceo lento de posicionamiento del brazo (oscilacion absoluta, sin deriva)
    B.rotation.y = Math.sin(elapsed * 0.28) * 0.03;
    B.rotation.x = -angV + Math.sin(elapsed * 0.22) * 0.015;
    // Avance de la perforadora sobre la viga + PERCUSION (vibracion rapida = barrenando roca)
    const feed = (Math.sin(elapsed * 0.42) * 0.5 + 0.5) * 0.66;
    const percusion = Math.sin(elapsed * 42) * 0.006;
    D.position.z = drift0 + feed + percusion;
  };
  // hurt (no kill): el contacto con el equipo GOLPEA pero no es fatal.
  g.userData.hazard = {
    tipo: 'equipoPesado', live: true, warn: 6, hurt: 0.6,
    aviso: 'JUMBO RAPTOR EN OPERACION — zona de perforacion activa. Mantente a distancia segura.',
    reflexion:
      'Estuviste demasiado cerca de un jumbo Raptor en operacion. La barra de perforacion y el ' +
      'brazo hidraulico pueden golpear sin aviso. Respeta las distancias de seguridad y nunca ' +
      'ingreses al radio de giro del brazo de un equipo en movimiento.'
  };
  marcarEquipo(g, { prefijo: 'RA', articulado: true });
  return g;
}
