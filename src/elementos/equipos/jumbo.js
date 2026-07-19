import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { texturaMetal, texturaGoma } from '../../world/materials/Texturas.js';
import { crear as crearExtintor } from '../ssoma/extintor.js';
import { sub } from '../_comun/subelemento.js';
import { marcarEquipo } from './codigo_equipo.js';

/**
 * JUMBO DE PERFORACION (drilling jumbo de 3 brazos) — equipo pesado de avance.
 *
 * Basado en fotos reales (Sandvik DD321 / Troidon) y ficha tecnica
 * Epiroc Boomer (dimensiones y radio de giro/cobertura de brazos):
 *  - Trocha (track) 2.66 m, alto 2.8 m, largo de carrier ~4.6 m (sin brazos).
 *  - 3 brazos articulados con cilindros hidraulicos de elevacion y giro visibles:
 *    2 inferiores (izquierda/derecha) + 1 central elevado para barrenos de techo.
 *  - Viga de avance (feed) de aluminio ~4.2 m con perforadora (drifter) que se
 *    DESLIZA sobre la viga, barra de acero y centralizador frontal. Alcance
 *    desde el pivote del brazo ≈5.9 m, acorde al radio de giro de la ficha.
 *  - Manguera de agua (azul) de flushing junto a la hidraulica en cada viga,
 *    con swivel de agua en la perforadora. Caja de sensor MWD y luz de
 *    trabajo auxiliar en cada cabezal.
 *  - Carrete de mangueras con grooves separadas entre los brazos + lazos de
 *    manguera hidraulica y abrazaderas (P-clips) colgando bajo brazos y vigas.
 *  - 4 gatas estabilizadoras con manguera de alimentacion, pasador de
 *    seguridad y zapata apoyada al piso (2 frontales, 2 traseras).
 *  - Chasis articulado 4x4 (pivote + cilindros de direccion), tanques
 *    laterales de hidraulico/combustible, escalera de acceso a cabina.
 *  - Cabina ROPS/FOPS con pantalla superior inclinada (~15°), espejos,
 *    palancas de control, 4 lamparas redondas frontales + baliza ambar.
 *  - Guardabarros sobre cada neumatico, pernos de rueda, faldones traseros,
 *    calaveras rojas y parrilla de radiador en el bloque motor.
 *  - Carrete trasero de cable con motorreductor, rodillos guia, cable
 *    amarillo enrollado y cola al piso.
 * Dimensiones ~escala real: 10.2 m de largo (11.5 m con cola de cable), 3.0 m
 * de ancho con ruedas, 2.9 m de alto.
 */

export const meta = {
  id: 'jumbo',
  nombre: 'Jumbo de perforacion',
  descripcion: 'Jumbo de 3 brazos (2 inferiores + 1 central elevado) con vigas de avance, perforadoras deslizantes, chasis articulado, gatas estabilizadoras y carrete de cable. Naranja.'
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
 * Materiales del jumbo, COMPARTIDOS entre instancias (se crean una sola vez).
 * A diferencia del color plano, la carrocería lleva textura de polvo/rayones (grunge) con
 * clearcoat (pintura con brillo), y el acero/estructura textura de metal cepillado → look de
 * maquinaria real y no de plástico. El `map` se MULTIPLICA por el color (tiñe sin aplanar).
 */
let _mats = null;
function jumboMats() {
  if (_mats) return _mats;
  const metal = texturaMetal(), goma = texturaGoma();
  // Pintura LIMPIA con brillo (clearcoat) — SIN textura de polvo (daba aspecto oxidado).
  const paint = (color, rough) => new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0.15, clearcoat: 0.7, clearcoatRoughness: 0.22
  });
  // Solo las piezas realmente metálicas llevan textura de acero cepillado.
  const steel = (color, rough, metalness) => new THREE.MeshStandardMaterial({ color, map: metal, roughness: rough, metalness });
  _mats = {
    nar:   paint(0xe06200, 0.50),                                                                // naranja carrocería (vivo)
    narD:  paint(0xb84e00, 0.58),                                                                // naranja oscuro
    k:     steel(0x26262b, 0.62, 0.55),                                                          // fundición/acero negro
    gom:   new THREE.MeshStandardMaterial({ color: 0x0e0e10, map: goma, roughness: 0.97, metalness: 0.0 }), // goma neumático
    ace:   steel(0xa2a2ac, 0.42, 0.62),                                                          // acero barras/estructura
    chr:   new THREE.MeshStandardMaterial({ color: 0xd0d5d9, roughness: 0.14, metalness: 0.95 }), // vástago cromado pulido
    vig:   new THREE.MeshStandardMaterial({ color: 0xc4c9ce, map: metal, roughness: 0.5, metalness: 0.28 }), // viga aluminio claro
    man:   new THREE.MeshStandardMaterial({ color: 0x141420, roughness: 0.85, metalness: 0.05 }), // manguera hidráulica negra
    agua:  new THREE.MeshStandardMaterial({ color: 0x2a5f8a, roughness: 0.7, metalness: 0.12 }),  // manguera de agua azul
    cab:   new THREE.MeshStandardMaterial({ color: 0x0e1a26, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.5 }), // vidrio cabina
    far:   new THREE.MeshStandardMaterial({ color: 0xeef0ff, emissive: 0xeef0ff, emissiveIntensity: 1.8, roughness: 0.08 }), // faros
    tail:  new THREE.MeshStandardMaterial({ color: 0xcc1100, emissive: 0xcc0000, emissiveIntensity: 0.7, roughness: 0.3 }),   // calaveras
    vid:   new THREE.MeshStandardMaterial({ color: 0x141519, roughness: 0.25, metalness: 0.65 }), // vidrio/plástico oscuro
    cable: new THREE.MeshStandardMaterial({ color: 0xc9a400, roughness: 0.55, metalness: 0.12 }), // cable amarillo
    rin:   steel(0x2a2a30, 0.45, 0.6)                                                            // rin metálico
  };
  return _mats;
}

export function crear() {
  const g = new THREE.Group();

  // ── MATERIALES (compartidos, con textura → aspecto de maquinaria real) ──
  const M = jumboMats();
  const mNar = M.nar, mNarD = M.narD, mK = M.k, mGom = M.gom, mAce = M.ace,
        mChr = M.chr, mVig = M.vig, mMan = M.man, mAgua = M.agua, mCab = M.cab,
        mFar = M.far, mTail = M.tail, mVid = M.vid, mCable = M.cable, mRin = M.rin;

  const HW = 1.15; // semi-ancho cuerpo (trocha ≈2.66 m, spec Epiroc Boomer S2)
  const GY = 0.55; // centro rueda (radio del neumatico → apoyo al piso en y=0)

  // ══════════════════════════════════════════════════════════════════
  //  CHASIS PRINCIPAL
  // ══════════════════════════════════════════════════════════════════
  // `S` = grupo del SUBELEMENTO activo (discretización para el visor).
  let S = sub(g, 'chasis', 'Chasis principal', 'Bastidor articulado, tanques laterales, cilindros de dirección y escalera de acceso.');
  put(S, bx(HW * 2, 0.28, 3.90, mK), 0, 0.36, -0.45); // bastidor
  put(S, bx(HW * 2 - 0.20, 0.50, 0.55, mNarD), 0, 0.62, 1.30); // porta-brazos frontal
  put(S, bx(HW * 2 - 0.06, 0.16, 0.18, mK), 0, 0.42, 1.62);    // paragolpes/bumper frontal
  for (const xs of [-1, 1]) put(S, bx(0.10, 0.24, 0.12, mNarD), xs * (HW - 0.25), 0.46, 1.66); // cachos del bumper

  // Articulación central de dirección (4x4 articulado: pivote vertical + 2 cilindros)
  put(S, cy(0.12, 0.12, 0.60, 10, mAce), 0, 0.55, -0.32); // eje/pivote vertical
  for (const xs of [-1, 1]) {
    put(S, cy(0.06, 0.06, 0.60, 8, mNarD), xs * (HW - 0.18), 0.42, -0.32, Math.PI / 2); // cilindro de dirección
    put(S, cy(0.035, 0.035, 0.30, 8, mChr), xs * (HW - 0.18), 0.42, -0.05, Math.PI / 2); // vástago
  }

  // Tanques laterales (hidráulico + combustible) sobre los rieles del bastidor
  for (const xs of [-1, 1]) {
    put(S, bx(0.16, 0.30, 1.60, mNarD), xs * (HW - 0.04), 0.50, -1.05); // cuerpo del tanque
    put(S, cy(0.055, 0.055, 0.10, 8, mK), xs * (HW - 0.04), 0.68, -1.75); // tapa de llenado
  }

  // Escalera de acceso a la cabina (lado izquierdo)
  for (const [sy, sz] of [[0.45, 0.75], [0.85, 0.62], [1.25, 0.50]]) {
    put(S, bx(0.30, 0.05, 0.14, mAce), -(HW - 0.02), sy, sz); // peldaño
  }
  put(S, bx(0.04, 1.30, 0.04, mK), -(HW + 0.04), 1.35, 0.35, 0.12); // pasamanos

  // ── CUERPO TRASERO (motor / hidraulicos) ──────────────────────
  S = sub(g, 'motor', 'Cuerpo motor', 'Bloque motor naranja con tapa, rejillas, escape y filtro de aire.');
  put(S, bx(HW * 2, 1.15, 2.00, mNar),  0, 1.00, -1.20); // bloque motor
  put(S, bx(HW * 2 - 0.1, 0.20, 1.90, mNarD), 0, 1.58, -1.20); // tapa superior
  // Rejillas laterales motor
  for (const xs of [-1, 1]) {
    for (let z = -0.5; z >= -1.9; z -= 0.35) {
      put(S, bx(0.04, 0.55, 0.22, mK), xs * (HW - 0.02), 0.95, z);
    }
  }
  // Escape vertical (con tapa antilluvia) + filtro de aire sobre la tapa
  put(S, cy(0.05, 0.05, 0.48, 16, mK), -0.75, 1.92, -1.90);
  put(S, cy(0.065, 0.065, 0.04, 16, mK), -0.75, 2.17, -1.90);               // brida superior
  put(S, cy(0.07, 0.045, 0.06, 12, mK), -0.75, 2.23, -1.90, Math.PI + 0.25); // tapa antilluvia inclinada
  put(S, cy(0.13, 0.13, 0.50, 18, mK), 0.50, 1.78, -1.60, 0, 0, Math.PI / 2); // filtro de aire
  put(S, cy(0.145, 0.145, 0.05, 18, mNarD), 0.30, 1.78, -1.60, 0, 0, Math.PI / 2); // tapa del filtro
  // Parrilla del radiador (trasera)
  put(S, bx(HW * 2 - 0.30, 0.65, 0.05, mK), 0, 1.05, -2.18);
  for (let gy = 0.78; gy <= 1.32; gy += 0.11) put(S, bx(HW * 2 - 0.36, 0.02, 0.06, mNarD), 0, gy, -2.16); // laminas
  // Argollas de izaje sobre la tapa
  for (const xs of [-1, 1]) put(S, tor(0.07, 0.018, Math.PI * 2, mAce), xs * 0.55, 1.70, -1.20, Math.PI / 2);
  // Placa de datos + bocina (lateral derecho, cerca de cabina)
  put(S, bx(0.16, 0.11, 0.01, mVid), HW - 0.02, 1.15, -0.35, 0, Math.PI / 2);
  put(S, cy(0.05, 0.09, 0.14, 10, mK), HW - 0.10, 1.75, -0.55, 0, 0, Math.PI / 2 + 0.3); // bocina

  // ── CABINA DEL OPERADOR (cabina CERRADA, desplazada a la IZQUIERDA) ──────
  // Como en el equipo real (Sketchfab ref): cabina compacta ENCERRADA a un lado
  // (izquierda), a media eslora, mirando a los brazos (+Z). El lado derecho queda libre
  // para la hidráulica de los brazos y el tendido de mangueras.
  S = sub(g, 'cabina', 'Cabina del operador (cerrada)',
    'Cabina cerrada FOPS/ROPS desplazada a la izquierda, con ventanas oscuras, puerta, asiento y panel de control.');
  const CX = -0.52, CZ = 0.20;      // centro de la cabina (izquierda, media eslora)
  const CW = 1.24, CD = 1.46;       // ancho y largo de la cabina
  // Deck del operador (cruza el carrier para acceso + montaje)
  put(S, bx(HW * 2, 0.16, 1.55, mNar), 0, 1.55, 0.30);
  // Cuerpo inferior de la cabina (bajo ventanas: tablero/puertas) + zócalo negro
  put(S, bx(CW, 0.60, CD, mNar), CX, 1.92, CZ);
  put(S, bx(CW + 0.02, 0.12, CD + 0.02, mK), CX, 1.66, CZ);
  // Techo + visera
  put(S, bx(CW + 0.10, 0.14, CD + 0.10, mNar), CX, 2.60, CZ);
  put(S, bx(CW + 0.18, 0.05, CD + 0.18, mNarD), CX, 2.69, CZ);
  // 4 parantes de esquina (columnas ROPS)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    put(S, bx(0.09, 0.64, 0.09, mK), CX + sx * (CW / 2 - 0.02), 2.24, CZ + sz * (CD / 2 - 0.02));
  }
  // Ventanas (vidrio oscuro) en los 4 lados, entre cuerpo inferior y techo
  const gY = 2.26, gH = 0.60;
  put(S, bx(CW - 0.18, gH, 0.04, mCab), CX, gY, CZ + CD / 2 - 0.01);   // parabrisas (hacia brazos)
  put(S, bx(CW - 0.18, gH, 0.04, mCab), CX, gY, CZ - CD / 2 + 0.01);   // luneta trasera
  put(S, bx(0.04, gH, CD - 0.18, mCab), CX + CW / 2 - 0.01, gY, CZ);   // ventana derecha (interior)
  put(S, bx(0.04, gH, CD - 0.18, mCab), CX - CW / 2 + 0.01, gY, CZ);   // ventana izquierda (puerta)
  // Puerta en el lado izquierdo (panel + manija)
  put(S, bx(0.02, 1.02, 0.86, mNarD), CX - CW / 2 - 0.01, 2.02, CZ);
  put(S, cy(0.018, 0.018, 0.10, 6, mChr), CX - CW / 2 - 0.05, 2.00, CZ + 0.30, 0, 0, Math.PI / 2);
  // Asiento del operador (mira a +Z)
  put(S, bx(0.50, 0.12, 0.48, mK), CX, 1.86, CZ - 0.12);
  put(S, bx(0.50, 0.52, 0.10, mK), CX, 2.14, CZ - 0.34);
  // Panel de control + palancas frente al operador
  put(S, bx(0.90, 0.22, 0.12, mK), CX, 2.02, CZ + 0.46);
  put(S, bx(0.72, 0.16, 0.06, MineMaterials.plano(0x223344, { rough: 0.3, metal: 0.5 })), CX, 2.07, CZ + 0.51);
  for (const jx of [-0.22, 0.22]) put(S, cy(0.016, 0.016, 0.20, 6, mK), CX + jx, 2.20, CZ + 0.47);
  // Espejos retrovisores al frente de la cabina
  for (const sx of [-1, 1]) {
    put(S, cy(0.02, 0.02, 0.26, 6, mK), CX + sx * (CW / 2), 2.42, CZ + 0.55, 0, 0, sx * 0.5);
    put(S, bx(0.14, 0.18, 0.03, mVid), CX + sx * (CW / 2 + 0.13), 2.56, CZ + 0.60, 0, sx * 0.35);
  }
  // Agarradera de acceso al lado de la puerta (izquierda)
  put(S, bx(0.03, 0.03, 0.42, mAce), CX - CW / 2 - 0.06, 2.05, CZ, Math.PI / 2 - 0.2);
  // Luz interior (domo)
  put(S, cy(0.05, 0.05, 0.03, 8, mFar), CX, 2.52, CZ, Math.PI / 2);
  // Limpiaparabrisas sobre el parabrisas frontal
  put(S, cy(0.010, 0.010, 0.42, 6, mK), CX + 0.10, 2.02, CZ + CD / 2 + 0.02, 0, 0, 0.9);
  put(S, cy(0.008, 0.008, 0.05, 6, mChr), CX - 0.08, 1.83, CZ + CD / 2 + 0.03, Math.PI / 2); // motor del wiper
  // Antena látigo en el techo
  put(S, cy(0.012, 0.006, 0.55, 6, mK), CX - CW / 2 + 0.10, 2.95, CZ - 0.4);

  // ── CARRETE DE CABLE TRASERO ──────────────────────────────────
  S = sub(g, 'carrete', 'Carrete de cable', 'Carrete trasero con cable amarillo enrollado, flanges y cola de cable al piso.');
  // Montado DETRAS del cuerpo motor (expuesto, como en las fotos), sobre 2 brazos.
  for (const bxs of [-0.33, 0.33]) put(S, bx(0.08, 0.30, 0.55, mNarD), bxs, 1.05, -2.45); // brazos soporte
  put(S, cy(0.34, 0.34, 0.46, 14, mK), 0, 1.05, -2.72, 0, 0, Math.PI / 2); // tambor (eje X)
  for (const fx of [-0.26, 0.26]) { // flanges (discos perpendiculares al eje X)
    put(S, cy(0.62, 0.62, 0.06, 18, mNarD), fx, 1.05, -2.72, 0, 0, Math.PI / 2);
  }
  // Cable amarillo enrollado (espiras)
  for (const cx of [-0.14, 0, 0.14]) {
    put(S, tor(0.46, 0.045, Math.PI * 2, mCable), cx, 1.05, -2.72, 0, Math.PI / 2, 0);
  }
  put(S, cy(0.06, 0.06, 0.90, 8, mAce), 0, 1.05, -2.72, 0, 0, Math.PI / 2); // eje
  // Motorreductor de accionamiento del carrete (lateral)
  put(S, cy(0.11, 0.11, 0.22, 10, mK), 0.40, 1.05, -2.72, 0, 0, Math.PI / 2);
  // Rodillos guia por donde sale el cable hacia la cola
  for (const gx of [-0.10, 0.10]) put(S, cy(0.07, 0.07, 0.10, 8, mK), gx, 0.62, -2.95, 0, 0, Math.PI / 2);
  // Cola de cable: baja del tambor y corre por el piso
  put(S, cy(0.035, 0.035, 0.72, 6, mCable), 0, 0.42, -3.04, 0.35);
  put(S, cy(0.035, 0.035, 1.10, 6, mCable), 0, 0.045, -3.55, Math.PI / 2 - 0.06);

  // ══════════════════════════════════════════════════════════════════
  //  NEUMATICOS (4 grandes)
  // ══════════════════════════════════════════════════════════════════
  S = sub(g, 'neumaticos', 'Neumáticos', '4 neumáticos grandes con banda de rodadura, rines metálicos, pernos, guardabarros y faldones.');
  for (const [px, pz] of [[-HW, 0.85], [HW, 0.85], [-HW, -1.65], [HW, -1.65]]) {
    const side = px < 0 ? -1 : 1;
    const xo = px + side * 0.18;
    put(S, cy(0.55, 0.55, 0.36, 18, mGom), xo, GY, pz, 0, 0, Math.PI / 2); // neumatico
    // Banda de rodadura: tacos alrededor del neumático (tracción minera)
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const taco = bx(0.38, 0.05, 0.12, mK);
      taco.position.set(xo, GY + Math.sin(a) * 0.555, pz + Math.cos(a) * 0.555);
      taco.rotation.x = a; S.add(taco);
    }
    put(S, cy(0.27, 0.27, 0.38, 12, mRin), xo, GY, pz, 0, 0, Math.PI / 2);  // rin metálico
    put(S, cy(0.10, 0.10, 0.40, 10, mK), xo, GY, pz, 0, 0, Math.PI / 2);    // cubo central
    // Pernos de rueda (anillo de 6)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      put(S, cy(0.022, 0.022, 0.06, 6, mK), xo + side * 0.19, GY + Math.sin(a) * 0.15, pz + Math.cos(a) * 0.15, 0, 0, Math.PI / 2);
    }
    // Guardabarros (medio tubo abierto sobre el neumático)
    put(S, fender(0.68, 0.46, 2.5, mNarD), xo, GY, pz, 0, 0, Math.PI / 2);
  }
  // Faldones de goma traseros (mudflaps), colgando detras de las ruedas traseras
  for (const xs of [-1, 1]) {
    put(S, bx(0.34, 0.30, 0.02, mK), xs * (HW + 0.20), 0.30, -1.95);
  }

  // ══════════════════════════════════════════════════════════════════
  //  GATAS ESTABILIZADORAS (4, con zapata al piso)
  // ══════════════════════════════════════════════════════════════════
  S = sub(g, 'gatas', 'Gatas estabilizadoras', '4 gatas hidráulicas con vástago cromado, manguera de alimentación, pasador de seguridad y zapata al piso.');
  for (const [gx, gz] of [[-(HW + 0.06), 1.30], [HW + 0.06, 1.30], [-(HW + 0.02), -2.42], [HW + 0.02, -2.42]]) {
    const gside = gx < 0 ? -1 : 1;
    put(S, bx(0.22, 0.16, 0.24, mNarD), gx * 0.90, 0.95, gz); // mensula al chasis
    put(S, cy(0.075, 0.075, 0.55, 10, mNarD), gx, 0.72, gz);  // cuerpo del cilindro
    put(S, cy(0.042, 0.042, 0.50, 8, mChr), gx, 0.28, gz);    // vastago
    put(S, cy(0.15, 0.17, 0.06, 10, mK), gx, 0.035, gz);      // zapata
    put(S, cy(0.022, 0.022, 0.10, 6, mAce), gx * 0.90, 0.72, gz + gside * 0.14, Math.PI / 2); // pasador de seguridad
    put(S, tor(0.13, 0.020, Math.PI, mMan), gx * 0.96, 0.95, gz, 0, 0, Math.PI / 2); // manguera de alimentacion
  }

  // ══════════════════════════════════════════════════════════════════
  //  BRAZOS DE PERFORACION (2) + VIGAS DE AVANCE
  // ══════════════════════════════════════════════════════════════════
  // Cada brazo: turntable de giro, rótula, cuerpo de cajón con nervio de refuerzo +
  // extensión telescópica, cilindros de elevación y giro, cabezal basculante y viga
  // de avance con perforadora deslizante, barra de perforación y broca de botones.
  S = sub(g, 'brazos', 'Brazos de perforación',
    '2 brazos articulados: turntable de giro, pasador de pivote, cilindros de elevación/giro/extensión/basculación, cabezal rollover, viga de avance con FRAD, rock drill (cradle, acumulador, pernos tirante, chuck), centralizador de mordazas, barra y broca de botones.');
  // Bancada de pivote sobre el porta-brazos
  put(S, bx(1.55, 0.55, 0.35, mNarD), 0, 0.90, 1.42);

  const brazos = [];
  // [lado, angV, angH, fase] — 2 brazos convergiendo suavemente sobre la frente.
  for (const [lado, angV, angH, fase] of [[-0.55, 0.15, -0.11, 0.0], [0.55, 0.14, 0.11, 2.1]]) {
    const B = new THREE.Group();
    B.position.set(lado, 0.92, 1.55);
    const sgn = Math.sign(lado);

    // Turntable de giro horizontal (base rotatoria del brazo)
    put(B, cy(0.19, 0.22, 0.16, 14, mK), 0, -0.10, 0.02);
    put(B, cy(0.20, 0.20, 0.04, 14, mNarD), 0, -0.02, 0.02);   // corona/anillo del turntable
    // Rótula de articulación + pasador de pivote cromado que la atraviesa
    put(B, bx(0.32, 0.40, 0.34, mK), 0, 0, 0.05);
    put(B, cy(0.055, 0.055, 0.48, 10, mChr), 0, 0.02, 0.05, 0, 0, Math.PI / 2);
    // Cuerpo principal del brazo (perfil cajón robusto) + extensión telescópica
    put(B, bx(0.32, 0.34, 2.05, mNar), 0, 0, 1.10);
    put(B, bx(0.34, 0.12, 1.90, mNarD), 0, -0.21, 1.05);       // nervio de refuerzo inferior del cajón
    put(B, bx(0.25, 0.27, 1.10, mNarD), 0, 0, 2.32);           // sección telescópica
    // Cilindro de EXTENSIÓN del brazo (sobre el cajón): cuerpo + vástago
    put(B, cy(0.055, 0.055, 1.05, 10, mNarD), 0, 0.24, 1.15, Math.PI / 2 - 0.01);
    put(B, cy(0.034, 0.034, 0.95, 8, mChr), 0, 0.24, 2.02, Math.PI / 2 - 0.01);
    // Cilindro de elevacion (bajo el brazo): cuerpo + vastago cromado
    put(B, cy(0.070, 0.070, 0.85, 10, mNarD), 0, -0.24, 0.72, Math.PI / 2 - 0.10);
    put(B, cy(0.040, 0.040, 0.80, 8, mChr), 0, -0.16, 1.52, Math.PI / 2 - 0.10);
    // Cilindro de giro (lateral externo)
    put(B, cy(0.055, 0.055, 0.70, 8, mNarD), sgn * 0.20, 0.02, 0.75, Math.PI / 2);
    put(B, cy(0.032, 0.032, 0.60, 8, mChr), sgn * 0.20, 0.02, 1.35, Math.PI / 2);
    // Cabezal basculante (rollover) + cilindro de volteo
    put(B, bx(0.34, 0.40, 0.42, mK), 0, 0.02, 2.55);
    put(B, cy(0.035, 0.035, 0.45, 8, mChr), 0, 0.20, 2.25, Math.PI / 2 - 0.25);
    // Cilindros de BASCULACIÓN del feed (dump) a cada lado del cabezal
    for (const tsx of [-1, 1]) {
      put(B, cy(0.045, 0.045, 0.50, 8, mNarD), tsx * 0.17, 0.18, 2.42, 0.55);
      put(B, cy(0.028, 0.028, 0.42, 8, mChr), tsx * 0.17, 0.31, 2.66, 0.55);
    }
    // Lazos de manguera colgando bajo el brazo
    for (const [lz, lr] of [[0.55, 0.17], [1.55, 0.15]]) {
      put(B, tor(lr, 0.028, Math.PI, mMan), sgn * 0.02, -0.16, lz, 0, Math.PI / 2, Math.PI);
    }
    // Abrazaderas (P-clips) sujetando el manojo de mangueras al brazo
    for (let cz = 0.35; cz <= 1.95; cz += 0.40) {
      put(B, tor(0.15, 0.016, Math.PI * 1.3, mK), 0, 0.02, cz, 0, Math.PI / 2, Math.PI);
    }
    // Luz de trabajo (faro auxiliar orientado hacia la frente de avance)
    put(B, cy(0.06, 0.065, 0.06, 10, mK), sgn * 0.22, 0.20, 2.15, Math.PI / 2 - 0.35);
    put(B, cy(0.05, 0.05, 0.015, 10, mFar), sgn * 0.22, 0.24, 2.28, Math.PI / 2 - 0.35);
    // Caja de sensor MWD (medicion durante la perforacion) sobre el cabezal
    put(B, bx(0.16, 0.10, 0.14, mVid), 0, 0.24, 2.50);

    // ── VIGA DE AVANCE (feed) ─────────────────────────────────
    const F = new THREE.Group();
    F.position.set(0, 0.16, 2.70);
    F.rotation.x = angV - 0.06; // compensa el brazo: viga casi horizontal, punta al frente
    const FL = 4.2;
    put(F, bx(0.40, 0.20, 0.70, mNarD), 0, -0.18, 0);           // cuna de montaje
    put(F, bx(0.19, 0.28, FL, mVig), 0, 0, 0.85);               // viga de aluminio (perfil robusto)
    for (const rx of [-0.09, 0.09]) put(F, bx(0.04, 0.05, FL, mAce), rx, 0.16, 0.85); // guias de deslizamiento
    put(F, cy(0.024, 0.024, FL - 0.4, 6, mMan), -0.05, -0.15, 0.85, Math.PI / 2); // manguera hidraulica
    put(F, cy(0.020, 0.020, FL - 0.4, 6, mAgua), 0.05, -0.15, 0.85, Math.PI / 2); // manguera de agua (flushing)
    put(F, bx(0.30, 0.26, 0.14, mK), 0, 0.02, 2.92);            // centralizador frontal
    for (const jsx of [-1, 1]) put(F, bx(0.07, 0.13, 0.16, mAce), jsx * 0.14, 0.02, 2.98); // mordazas del centralizador
    put(F, cy(0.02, 0.05, 0.30, 6, mAce), 0, -0.02, 3.10, Math.PI / 2); // punta de apoyo (stinger)
    // Tambor de mangueras del feed (FRAD) en la cola de la viga
    put(F, cy(0.14, 0.15, 0.22, 12, mK), 0, 0.11, -1.05, 0, 0, Math.PI / 2);
    for (const dsx of [-0.10, 0.10]) put(F, cy(0.17, 0.17, 0.02, 12, mNarD), dsx, 0.11, -1.05, 0, 0, Math.PI / 2);
    put(F, tor(0.13, 0.02, Math.PI * 2, mMan), 0, 0.11, -1.05, 0, Math.PI / 2, 0);

    // ── PERFORADORA (drifter) — se desliza sobre la viga ──────
    const D = new THREE.Group();
    const drift0 = -0.95;
    D.position.set(0, 0.20, drift0);
    put(D, bx(0.28, 0.26, 0.66, mNar), 0, 0, 0);                 // cuerpo del rock drill
    put(D, bx(0.20, 0.12, 0.36, mK), 0, 0.17, -0.06);           // bloque de valvulas
    put(D, bx(0.34, 0.07, 0.62, mK), 0, -0.15, 0);              // cradle que abraza la viga
    put(D, cy(0.055, 0.055, 0.28, 10, mNarD), sgn * 0.15, -0.02, -0.10, Math.PI / 2); // acumulador (botella)
    for (const bsx of [-1, 1]) put(D, cy(0.013, 0.013, 0.64, 6, mChr), bsx * 0.12, 0, 0, Math.PI / 2); // pernos tirante (side stay bolts)
    put(D, cy(0.06, 0.05, 0.16, 10, mK), 0, -0.03, 0.36, Math.PI / 2); // chuck / portabarra
    put(D, cy(0.045, 0.045, 0.10, 8, mAgua), 0, -0.03, 0.34, Math.PI / 2); // swivel de agua (flushing del barreno)
    put(D, cy(0.032, 0.032, 3.60, 8, mAce), 0, -0.03, 2.10, Math.PI / 2); // barra de perforacion
    // Broca de botones (drill bit) en la punta de la barra
    put(D, cy(0.052, 0.045, 0.13, 12, mK), 0, -0.03, 3.96, Math.PI / 2);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      put(D, cy(0.010, 0.010, 0.02, 6, mChr), Math.sin(a) * 0.028, -0.03 + Math.cos(a) * 0.028, 4.03, Math.PI / 2);
    }
    put(D, tor(0.13, 0.026, Math.PI, mMan), 0, 0.02, -0.42, 0, Math.PI / 2, Math.PI); // lazo de manguera
    F.add(D);

    B.add(F);
    B.rotation.x = -angV;
    B.rotation.y = angH;
    S.add(B);
    brazos.push({ B, angV, angH, D, drift0, fase });
  }

  // ── MANGUERAS HIDRAULICAS (cuerpo → brazos) ──────────────────
  S = sub(g, 'mangueras', 'Mangueras hidráulicas', 'Carrete de mangueras con grooves separadas y tendido hacia ambos brazos.');
  // Carrete de mangueras (drum) entre los brazos: cada groove alimenta un brazo (mejora de vida util del sistema)
  put(S, cy(0.20, 0.20, 0.40, 14, mK), 0, 1.12, 1.18, 0, 0, Math.PI / 2); // tambor
  for (const fx of [-0.16, -0.055, 0.055, 0.16]) {
    put(S, cy(0.26, 0.26, 0.02, 14, mNarD), fx, 1.12, 1.18, 0, 0, Math.PI / 2); // separador de groove
  }
  for (const cx of [-0.10, 0, 0.10]) {
    put(S, tor(0.19, 0.018, Math.PI * 2, mMan), cx, 1.12, 1.18, 0, Math.PI / 2, 0); // manguera enrollada
  }
  for (const xs of [-1, 1]) {
    put(S, tor(0.30, 0.034, Math.PI, mMan), xs * 0.50, 1.28, 1.10, 0, Math.PI / 2, Math.PI);
    put(S, cy(0.030, 0.030, 1.30, 6, mMan), xs * 0.55, 1.42, 0.30, Math.PI / 2 + 0.06);
  }

  // ══════════════════════════════════════════════════════════════════
  //  LUCES
  // ══════════════════════════════════════════════════════════════════
  S = sub(g, 'luces', 'Faros, calaveras y baliza', 'Faros del porta-brazos, 4 lámparas redondas del canopy, calaveras traseras y baliza ámbar animada.');
  // Faros redondos con GUARDA protectora en el frente (outboard, bien visibles)
  for (const xs of [-1, 1]) {
    put(S, cy(0.10, 0.10, 0.09, 16, mK), xs * 0.84, 0.86, 1.58, Math.PI / 2);        // carcasa
    put(S, cy(0.076, 0.076, 0.02, 16, mFar), xs * 0.84, 0.86, 1.64, Math.PI / 2);    // lente
    put(S, tor(0.10, 0.014, Math.PI * 2, mK), xs * 0.84, 0.86, 1.66);                // aro guarda
    for (const a of [0.4, Math.PI / 2 + 0.4]) put(S, bx(0.20, 0.013, 0.013, mK), xs * 0.84, 0.86, 1.665, 0, 0, a); // barras guarda (cruz)
  }
  // Barra de luces de trabajo en el frente del techo de la cabina (miran a +Z) + carcasa
  for (const lx of [-0.95, -0.52, -0.09]) {
    put(S, cy(0.078, 0.078, 0.05, 14, mK), lx, 2.66, CZ + CD / 2 + 0.02, Math.PI / 2);  // carcasa
    put(S, cy(0.072, 0.072, 0.05, 14, mFar), lx, 2.66, CZ + CD / 2 + 0.06, Math.PI / 2); // lente
  }
  // Calaveras traseras (rojas) a cada lado del bloque motor
  for (const xs of [-1, 1]) {
    put(S, bx(0.10, 0.16, 0.04, mTail), xs * (HW - 0.03), 0.75, -2.19);
  }
  // Baliza ambar en el techo de la cabina (base negra + lente + cúpula, mismo material → pulsan juntas)
  const balM = new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8800, emissiveIntensity: 2.5 });
  const balX = CX + 0.36;
  put(S, cy(0.055, 0.066, 0.05, 12, mK), balX, 2.75, CZ);   // base negra
  const baliza = cy(0.072, 0.072, 0.11, 14, balM);          // lente ámbar (cilindro)
  put(S, baliza, balX, 2.83, CZ);
  put(S, new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), balM), balX, 2.885, CZ); // cúpula

  // ══════════════════════════════════════════════════════════════════
  //  TICK + HAZARD
  // ══════════════════════════════════════════════════════════════════
  // Extintor con tarjeta de inspeccion (lateral derecho del cuerpo motor)
  S = sub(g, 'extintor', 'Extintor', 'Extintor con tarjeta de inspección (lateral derecho del motor).');
  S.add(crearExtintor({ x: HW + 0.10, y: 0.90, z: -1.0, ry: Math.PI / 2 }));

  g.name = 'jumbo';
  const balizaM = baliza.material;
  g.userData.tick = (dt, elapsed) => {
    balizaM.emissiveIntensity = 1.5 + Math.abs(Math.sin(elapsed * 4)) * 2.5;
    for (const { B, angV, angH, D, drift0, fase } of brazos) {
      // Balanceo lento de posicionamiento (giro + elevación), oscilación absoluta sin deriva
      B.rotation.y = angH + Math.sin(elapsed * 0.30 + fase) * 0.02;
      B.rotation.x = -angV + Math.sin(elapsed * 0.22 + fase) * 0.012;
      // Avance de la perforadora sobre la viga + PERCUSIÓN (vibración rápida = barrenando roca)
      const feed = (Math.sin(elapsed * 0.45 + fase) * 0.5 + 0.5) * 0.62;
      const percusion = Math.sin(elapsed * 42 + fase) * 0.006;
      D.position.z = drift0 + feed + percusion;
    }
  };
  // hurt (no kill): el contacto con el equipo GOLPEA pero no es fatal.
  g.userData.hazard = {
    tipo: 'equipoPesado', live: true, warn: 6, hurt: 0.6,
    aviso: 'JUMBO EN OPERACION — zona de perforacion activa. Mantente a distancia segura.',
    reflexion:
      'Estuviste demasiado cerca de un jumbo en operacion. Las barras de perforacion y los ' +
      'brazos hidraulicos pueden golpear sin aviso. Respeta siempre las distancias de seguridad ' +
      'y nunca ingreses al radio de giro de los brazos de un equipo en movimiento.'
  };
  marcarEquipo(g, { prefijo: 'JU', articulado: true });
  return g;
}
