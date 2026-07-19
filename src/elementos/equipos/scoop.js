import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crear as crearExtintor } from '../ssoma/extintor.js';
import { crear as crearOperador } from './operador_sentado.js';
import { sub } from '../_comun/subelemento.js';
import { marcarEquipo } from './codigo_equipo.js';

/**
 * SCOOP / LHD (Load-Haul-Dump) — cargador de bajo perfil de mina subterranea.
 *
 * Proporciones tomadas de un Caterpillar R1700 real (hard rock loader, la misma
 * clase que el modelo de referencia de 3DHorse):
 *   - Largo total ≈10.6 m · Ancho maquina ≈2.87 m · Alto (cuchara arriba) ≈2.48 m.
 *   - Cuchara MAS ANCHA que la maquina (≈2.95 m), capacidad ~7 m³.
 *   - Chasis ARTICULADO en el centro (pivote vertical + 2 cilindros de direccion).
 *   - Perfil muy LARGO y BAJO para galerias subterraneas.
 *
 * Anatomia (fiel a la maquina real):
 *   - Bastidor delantero porta-cuchara + bastidor trasero con motor longitudinal.
 *   - CUCHARA de perfil curvo (ExtrudeGeometry) con labio de corte y dientes de ataque,
 *     cargada de muck (roca). Placas de desgaste atornilladas a los costados.
 *   - BRAZO de levante (boom) cranked de 2 vigas. Los cilindros HIDRAULICOS son
 *     DINAMICOS: los de levante conectan bastidor→brazo y el conjunto de VOLTEO Z-bar
 *     (bellcrank + cilindro de tumbado + biela a la cuchara) se re-orienta cada frame,
 *     asi nunca se "despegan" al animar el ciclo de carga.
 *   - Cabina/canopy ROPS-FOPS de perfil bajo al costado IZQUIERDO (asiento transversal),
 *     con parrilla FOPS anti-caida de roca.
 *   - Motor trasero con capot escalonado, rejillas, parrilla de radiador, escape/scrubber,
 *     precleaner de aire y argollas de izaje.
 *   - 4 neumaticos grandes de bajo perfil con taco (lugs), rines, pernos y guardabarros.
 *   - Faros delanteros y de trabajo, calaveras traseras, baliza ambar animada.
 *   - Terminacion naranja con polvo/barro en la parte baja (equipo en operacion).
 */

export const meta = {
  id: 'scoop',
  nombre: 'Scoop / LHD (cargador de bajo perfil)',
  descripcion: 'Cargador LHD articulado de bajo perfil (tipo Cat R1700) con cuchara curva y dientes, brazo de levante con cilindros hidraulicos dinamicos y conjunto de volteo Z-bar, cabina lateral ROPS/FOPS y baliza ambar. Naranja.'
};

// ── Helpers de construccion ──────────────────────────────────────────
function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cy(rt, rb, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat); }
function con(r, h, s, mat) { return new THREE.Mesh(new THREE.ConeGeometry(r, h, s), mat); }
function tor(r, tube, arc, mat) { return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 14, arc), mat); }
// Guardabarros: medio-tubo abierto (cobertura angular en radianes, centrada arriba).
function fender(r, w, arcRad, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18, 1, true, -arcRad / 2, arcRad), mat); }
function put(grp, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m;
}
// "Empty" (marcador de articulacion) para anclar cilindros hidraulicos dinamicos.
function anchor(grp, x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); grp.add(o); return o; }

export function crear() {
  const g = new THREE.Group();

  // ── MATERIALES ────────────────────────────────────────────────────
  const mNar  = MineMaterials.plano(0xd45a00, { rough: 0.72, metal: 0.25 }); // naranja
  const mNarD = MineMaterials.plano(0xa84300, { rough: 0.82, metal: 0.2 });  // naranja oscuro
  const mK    = MineMaterials.plano(0x18181a, { rough: 0.85, metal: 0.3 });  // negro
  const mGom  = MineMaterials.plano(0x101012, { rough: 0.98 });               // goma neumatico
  const mRi   = MineMaterials.plano(0xc4531f, { rough: 0.5, metal: 0.4 });   // rin naranja
  const mAce  = MineMaterials.plano(0x8a8e96, { rough: 0.35, metal: 0.75 }); // acero
  const mChr  = MineMaterials.plano(0xcbced2, { rough: 0.18, metal: 0.92 }); // vastago cromado
  // Cuchara: material propio DoubleSide (la geometria extruida se ve desde dentro y fuera).
  const mBuck = new THREE.MeshStandardMaterial({ color: 0x5f636b, roughness: 0.55, metalness: 0.72, side: THREE.DoubleSide });
  const mDien = MineMaterials.plano(0x36393f, { rough: 0.5, metal: 0.7 });   // portadientes / placas de desgaste
  const mFilo = MineMaterials.aceroPulido();                                 // filo PULIDO por abrasion (dientes/labio)
  const mMan  = MineMaterials.plano(0x181828, { rough: 0.9, metal: 0.1 });   // manguera hidraulica
  const mBarro = MineMaterials.plano(0x4a3a26, { rough: 0.98, metal: 0.0 }); // polvo/barro de operacion
  const mRoj  = MineMaterials.plano(0xb42017, { rough: 0.55, metal: 0.15 }); // rojo reflectivo / ANSUL
  const mBl   = MineMaterials.plano(0xe8e8e0, { rough: 0.5,  metal: 0.1 });  // blanco reflectivo
  const mTan  = MineMaterials.plano(0xb89a5e, { rough: 0.6,  metal: 0.2 });  // beige (tanque ANSUL)
  const mCab  = new THREE.MeshStandardMaterial({ color: 0x142234, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.68 });
  const mFar  = new THREE.MeshStandardMaterial({ color: 0xeef0ff, emissive: 0xeef0ff, emissiveIntensity: 1.8, roughness: 0.08 });
  const mTail = new THREE.MeshStandardMaterial({ color: 0xcc1100, emissive: 0xcc0000, emissiveIntensity: 0.7, roughness: 0.3 });
  const mVid  = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.3, metalness: 0.6 });

  const HW = 1.35; // semi-ancho maquina (ancho ≈2.7 m)
  const GY = 0.68; // centro de rueda (radio 0.68)
  const WR = 0.68; // radio de neumatico

  // ══════════════════════════════════════════════════════════════════
  //  BASTIDOR DELANTERO (porta-cuchara + torres del brazo + eje delantero)
  // ══════════════════════════════════════════════════════════════════
  // Z del PASADOR central: todo lo que va DELANTE de este plano se cuelga del pivote y DOBLA
  // al virar (ver "ARTICULACION QUE DOBLA" al final de crear()).
  const PIVZ = 0.05;

  let S = sub(g, 'chasis_del', 'Bastidor delantero', 'Bastidor delantero porta-cuchara con torres de montaje del brazo y eje delantero.');
  const Schasis = S;
  // Anclajes DELANTEROS de los cilindros de direccion (se mueven con el bastidor al doblar).
  const steerTip = [anchor(S, -0.55, 0.82, 0.44), anchor(S, 0.55, 0.82, 0.44)];
  put(S, bx(HW * 2, 0.56, 2.30, mNarD), 0, 0.82, 1.35);              // bastidor delantero
  put(S, bx(HW * 2 - 0.12, 0.20, 2.10, mBarro), 0, 0.55, 1.35);      // parte baja embarrada
  put(S, bx(HW * 2 - 0.05, 0.34, 0.60, mNarD), 0, 1.16, 0.42);       // travesano superior
  // Torres de montaje del brazo (2 placas verticales robustas)
  for (const xs of [-1, 1]) {
    put(S, bx(0.22, 1.10, 0.55, mNar), xs * 0.70, 1.28, 0.62);       // torre
    put(S, cy(0.10, 0.10, 0.24, 12, mK), xs * 0.70, 1.55, 0.65, 0, 0, Math.PI / 2); // buje del pivote del brazo
  }
  // Faldones laterales sobre las ruedas delanteras
  for (const xs of [-1, 1]) put(S, bx(0.10, 0.42, 2.0, mNar), xs * (HW - 0.02), 0.98, 1.35);

  // ══════════════════════════════════════════════════════════════════
  //  ARTICULACION CENTRAL (pivote de direccion 4x4 + cilindros)
  // ══════════════════════════════════════════════════════════════════
  S = sub(g, 'articulacion', 'Articulación central', 'Junta articulada: pivote vertical y 2 cilindros hidráulicos de dirección que DOBLAN la máquina al virar.');
  put(S, bx(0.66, 0.95, 0.55, mK), 0, 1.00, 0.05);                  // bloque de junta
  put(S, cy(0.15, 0.15, 1.05, 12, mAce), 0, 1.00, 0.05);            // pivote vertical
  // Anclajes TRASEROS de los cilindros de direccion (el bastidor trasero NO se mueve). Los
  // cilindros son DINAMICOS: se re-orientan entre estos anclajes y los del bastidor delantero,
  // asi que se estiran/comprimen solos al doblar la junta (mismo patron que la hidraulica del brazo).
  const steerBase = [anchor(S, -0.55, 0.82, -0.36), anchor(S, 0.55, 0.82, -0.36)];
  // Fuelle de la articulacion (boot de goma acordeonado sobre el pivote)
  for (let y = 0.55; y <= 1.35; y += 0.16) put(S, tor(0.19, 0.03, Math.PI * 2, mK), 0, y, 0.05, Math.PI / 2);
  // Manojo de mangueras hidraulicas cruzando la junta (lazo flexible)
  for (const dx of [-0.12, 0, 0.12]) put(S, tor(0.22, 0.024, Math.PI, mMan), dx, 1.30, 0.30, 0, 0, 0);

  // ══════════════════════════════════════════════════════════════════
  //  BASTIDOR TRASERO + MOTOR (capot escalonado)
  // ══════════════════════════════════════════════════════════════════
  S = sub(g, 'motor', 'Bastidor trasero y motor', 'Bastidor trasero con capot escalonado de motor, rejillas, parrilla de radiador, escape y tanques.');
  put(S, bx(HW * 2, 0.56, 3.90, mNarD), 0, 0.82, -2.35);            // bastidor trasero
  put(S, bx(HW * 2 - 0.10, 0.22, 3.6, mBarro), 0, 0.54, -2.35);     // parte baja embarrada
  // Capot escalonado: cuerpo bajo + cofre elevado del motor
  put(S, bx(HW * 2, 0.80, 1.35, mNar), 0, 1.30, -1.05);             // escalon frontal (bajo, junto a cabina)
  put(S, bx(HW * 2, 1.15, 2.35, mNar), 0, 1.48, -2.70);             // cofre principal del motor
  put(S, bx(HW * 2 - 0.16, 0.16, 2.25, mNarD), 0, 2.08, -2.70);     // tapa superior
  // Paneles laterales inclinados del cofre (chaflan)
  for (const xs of [-1, 1]) put(S, bx(0.10, 0.55, 2.25, mNarD), xs * (HW - 0.02), 1.85, -2.70, 0, 0, xs * 0.32);
  // Rejillas de ventilacion laterales del motor
  for (const xs of [-1, 1]) for (let z = -1.9; z >= -3.4; z -= 0.30) {
    put(S, bx(0.04, 0.60, 0.18, mK), xs * (HW + 0.01), 1.45, z);
  }
  // Tanques laterales (combustible / hidraulico)
  for (const xs of [-1, 1]) {
    put(S, bx(0.16, 0.40, 1.10, mNarD), xs * (HW - 0.02), 0.75, -1.55);
    put(S, cy(0.05, 0.05, 0.09, 8, mK), xs * (HW - 0.02), 0.97, -1.15); // tapa de llenado
  }
  // Parrilla del radiador (trasera)
  put(S, bx(HW * 2 - 0.28, 0.85, 0.06, mK), 0, 1.40, -3.92);
  for (let gy = 1.05; gy <= 1.78; gy += 0.11) put(S, bx(HW * 2 - 0.38, 0.02, 0.07, mNarD), 0, gy, -3.89);
  // Argollas de izaje sobre la tapa
  for (const xs of [-1, 1]) put(S, tor(0.08, 0.02, Math.PI * 2, mAce), xs * 0.6, 2.20, -2.70, Math.PI / 2);
  // Escape / scrubber (purificador de gases) + cola de escape sobre el cofre
  put(S, cy(0.16, 0.16, 0.95, 14, mK), 0.62, 2.30, -3.15, 0, 0, Math.PI / 2);
  put(S, cy(0.055, 0.055, 0.30, 8, mK), 1.02, 2.58, -3.15);
  // Precleaner de aire (bocha) sobre el cofre
  put(S, cy(0.10, 0.14, 0.20, 12, mK), -0.55, 2.30, -3.15);
  // Escalera de acceso trasera + pasamanos
  for (const [sy, sz] of [[0.45, -3.60], [0.85, -3.60]]) put(S, bx(0.40, 0.05, 0.14, mAce), 0, sy, sz);
  put(S, bx(0.04, 1.30, 0.04, mK), 0.42, 1.20, -3.55, 0.1);
  // Guarda vertical del radiador (barras protectoras traseras)
  for (let x = -HW + 0.2; x <= HW - 0.2; x += 0.28) put(S, cy(0.025, 0.025, 0.85, 6, mK), x, 1.40, -3.98);
  // Sistema contra incendios ANSUL (tanque beige + cartucho actuador) — lado derecho del motor
  put(S, cy(0.14, 0.14, 0.70, 12, mTan), HW - 0.02, 1.05, -2.65, Math.PI / 2); // tanque de agente
  put(S, cy(0.14, 0.14, 0.05, 12, mRoj), HW - 0.02, 1.05, -3.02, Math.PI / 2); // tapa roja
  put(S, cy(0.05, 0.05, 0.24, 8, mRoj), HW - 0.02, 1.30, -2.30);               // cartucho de nitrogeno
  put(S, cy(0.018, 0.018, 0.55, 6, mMan), HW - 0.06, 1.05, -2.10, Math.PI / 2 - 0.2); // manguera de descarga

  // ══════════════════════════════════════════════════════════════════
  //  CABINA / CANOPY ROPS-FOPS (perfil bajo, costado izquierdo, transversal)
  // ══════════════════════════════════════════════════════════════════
  S = sub(g, 'cabina', 'Cabina ROPS/FOPS (bajo perfil)', 'Canopy de perfil bajo con postes ROPS, parrilla FOPS anti-caída de roca, asiento transversal y consolas de control.');
  const CX = -0.10; // ligeramente a la izquierda (tipico LHD)
  put(S, bx(HW * 2 - 0.15, 0.16, 1.75, mNar), CX, 1.14, -0.35);      // plataforma
  // 4 postes ROPS (bajos)
  for (const xs of [-1, 1]) for (const zs of [0.42, -1.12]) {
    put(S, cy(0.058, 0.058, 1.15, 8, mK), CX + xs * (HW - 0.24), 1.78, zs);
  }
  // Techo ROPS + parrilla FOPS (barras transversales anti-caida de roca)
  put(S, bx(HW * 2 - 0.14, 0.10, 1.70, mNar), CX, 2.38, -0.35);
  for (let z = 0.34; z >= -1.05; z -= 0.20) put(S, bx(HW * 2 - 0.32, 0.05, 0.06, mK), CX, 2.42, z);
  // Vidrio lateral (el operador va sentado transversal, mirando a -X)
  put(S, bx(0.05, 0.78, 1.45, mCab), CX - (HW - 0.22), 1.82, -0.35);
  put(S, bx(0.05, 0.55, 1.45, mCab), CX + (HW - 0.22), 1.95, -0.35); // ventana derecha
  // Asiento del operador (mira hacia -X)
  put(S, bx(0.58, 0.13, 0.55, mK), CX + 0.02, 1.40, -0.35);
  put(S, bx(0.12, 0.52, 0.55, mK), CX + 0.30, 1.64, -0.35);
  // Consolas de control con joysticks a ambos lados del asiento
  for (const zs of [0.00, -0.70]) {
    put(S, bx(0.36, 0.24, 0.22, mK), CX - 0.12, 1.46, zs);
    put(S, cy(0.016, 0.016, 0.20, 6, mK), CX - 0.12, 1.63, zs);
  }
  // Espejo retrovisor en poste delantero + agarradera de acceso
  put(S, cy(0.02, 0.02, 0.32, 6, mK), CX - (HW - 0.24), 2.22, 0.55, 0, 0, 0.5);
  put(S, bx(0.03, 0.20, 0.15, mVid), CX - (HW - 0.02), 2.34, 0.60);
  put(S, bx(0.03, 0.03, 0.50, mAce), CX - (HW - 0.12), 1.55, 0.45, Math.PI / 2 - 0.3);

  // ══════════════════════════════════════════════════════════════════
  //  BRAZO DE LEVANTE (boom) + CUCHARA + Z-BAR — geometria + anclajes
  // ══════════════════════════════════════════════════════════════════
  S = sub(g, 'brazo', 'Brazo de levante, cuchara y volteo',
    'Brazo cranked de 2 vigas; cuchara curva con dientes; cilindros de levante y conjunto Z-bar (bellcrank, cilindro de volteo y biela), todos hidráulicos dinámicos.');
  const Sbrazo = S;   // va montado en el bastidor DELANTERO → dobla con la articulación

  // Anclajes FIJOS (en el bastidor delantero) de los cilindros de levante y volteo.
  const liftBase = [anchor(S, -0.70, 1.06, -0.05), anchor(S, 0.70, 1.06, -0.05)];
  const tiltBase = anchor(S, 0, 1.30, -0.05);   // base del cilindro de volteo (alto, junto a las torres)

  // Grupo del BRAZO: pivota en las torres del bastidor delantero.
  const boom = new THREE.Group();
  boom.position.set(0, 1.55, 0.65);
  const boomRest = -0.30; // reposo: cuchara al piso adelante
  boom.rotation.x = boomRest;
  // 2 vigas del brazo cranked (segmento base + segmento hacia la cuchara)
  for (const xs of [-1, 1]) {
    put(boom, bx(0.22, 0.28, 1.10, mNar), xs * 0.70, 0.02, 0.55);   // segmento base
    put(boom, bx(0.20, 0.24, 1.90, mNar), xs * 0.70, -0.14, 1.75, 0.12); // segmento a la cuchara (cranked)
  }
  // Travesanos que unen las 2 vigas
  put(boom, bx(1.40, 0.16, 0.20, mNarD), 0, 0.02, 0.35);
  put(boom, bx(1.30, 0.16, 0.20, mNarD), 0, -0.22, 2.55);
  // Mangueras hidraulicas tendidas sobre el brazo
  for (const xs of [-0.55, 0.55]) put(boom, cy(0.026, 0.026, 2.4, 6, mMan), xs, 0.16, 1.35, Math.PI / 2 + 0.08);
  // Anclajes (en el brazo) de la punta de los cilindros de levante
  const liftTip = [anchor(boom, -0.70, -0.30, 1.55), anchor(boom, 0.70, -0.30, 1.55)];

  // Bellcrank del Z-bar: pivota sobre el brazo a media viga y GIRA con el volteo.
  const bell = new THREE.Group();
  bell.position.set(0, 0.42, 1.15);
  put(bell, cy(0.09, 0.09, 1.34, 10, mNarD), 0, 0, 0, 0, 0, Math.PI / 2); // eje
  put(bell, bx(0.55, 0.62, 0.16, mNarD),  0,  0.02, 0);                    // placa central
  const tiltTip = anchor(bell, 0, 0.40, -0.10);   // brazo superior del bellcrank (recibe el cilindro de volteo)
  const linkTop = anchor(bell, 0, -0.36, 0.14);   // brazo inferior del bellcrank (tira de la biela)
  boom.add(bell);

  // CUCHARA (bucket): perfil curvo extruido + labio + dientes + carga de muck.
  const bucket = new THREE.Group();
  bucket.position.set(0, -0.32, 2.90); // articula en la punta del brazo
  const bucketRest = 0.34;             // curl de reposo (cargada)
  bucket.rotation.x = bucketRest;
  const BW = 2.95;                     // ancho de cuchara (mas ancha que la maquina)
  {
    // Perfil lateral (silueta) de la cuchara. x=adelante, y=arriba; origen en el pivote alto-trasero.
    const p = new THREE.Shape();
    p.moveTo(0.00, 0.00);
    p.lineTo(1.35, -0.30);   // borde superior del labio (boca), inclinado hacia adelante
    p.lineTo(1.66, -0.92);   // cara frontal sobre el labio
    p.lineTo(1.58, -1.14);   // punta del labio de corte
    p.lineTo(0.95, -1.34);   // curva del piso
    p.lineTo(0.34, -1.30);
    p.lineTo(0.02, -0.95);   // pared posterior
    p.lineTo(0.00, 0.00);
    const geo = new THREE.ExtrudeGeometry(p, { depth: BW, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -BW / 2);
    geo.rotateY(-Math.PI / 2);   // ancho a lo largo de X, boca hacia +Z
    put(bucket, new THREE.Mesh(geo, mBuck));
    // Labio de corte (barra reforzada al frente-bajo) + dientes de ataque: metal PULIDO por
    // abrasion (espeja contra el resto polvoriento).
    put(bucket, bx(BW, 0.10, 0.20, mFilo), 0, -1.10, 1.60);
    for (let i = 0; i < 7; i++) {
      const dx = (i / 6 - 0.5) * (BW - 0.35);
      put(bucket, con(0.09, 0.34, 6, mFilo), dx, -1.12, 1.78, Math.PI / 2);
    }
    // Placas de desgaste atornilladas a los costados
    for (const xs of [-1, 1]) put(bucket, bx(0.05, 0.55, 0.90, mDien), xs * (BW / 2 + 0.02), -0.85, 0.55);
    // Cinta reflectiva de peligro (rojo/blanco) en el borde superior de la boca
    for (let i = 0; i < 12; i++) {
      put(bucket, bx(BW / 12, 0.12, 0.03, i % 2 ? mBl : mRoj), -BW / 2 + (BW / 12) * (i + 0.5), -0.24, 1.30, -0.35);
    }
    // Nervaduras de refuerzo exteriores del piso
    for (const dx of [-0.7, 0, 0.7]) put(bucket, bx(0.06, 0.10, 1.0, mDien), dx, -1.28, 0.75);
    // Carga de muck (roca) asomando por la boca
    put(bucket, bx(BW - 0.25, 0.42, 1.15, MineMaterials.roca()), 0, -0.25, 0.62);
  }
  const linkBucket = anchor(bucket, 0, 0.30, 0.05); // oreja de la cuchara (recibe la biela del Z-bar)
  boom.add(bucket);
  S.add(boom);

  // Cilindros hidraulicos DINAMICOS (cuerpo naranja + vastago cromado + clevises).
  // Se re-orientan cada frame entre sus anclajes → nunca se despegan al animar.
  function makeHyd(rBody, rRod, matBody = mNarD) {
    const grp = new THREE.Group();               // unidad de altura 1 (de y=-0.5 a y=+0.5)
    put(grp, cy(rBody, rBody, 0.60, 12, matBody), 0, -0.18, 0);       // cuerpo
    put(grp, cy(rRod, rRod, 0.58, 10, mChr), 0, 0.22, 0);            // vastago
    put(grp, bx(rBody * 2.4, 0.10, rBody * 1.6, mK), 0, -0.48, 0);    // clevis base
    put(grp, bx(rRod * 2.6, 0.10, rRod * 1.8, mK), 0, 0.48, 0);       // clevis punta
    g.add(grp);
    return grp;
  }
  const hydLift = [makeHyd(0.075, 0.042), makeHyd(0.075, 0.042)];
  const hydTilt = makeHyd(0.070, 0.040);
  // Biela rigida del Z-bar (bellcrank → cuchara): barra de acero re-orientada igual.
  const linkRod = (() => {
    const grp = new THREE.Group();
    put(grp, cy(0.05, 0.05, 1.0, 8, mAce), 0, 0, 0);
    put(grp, bx(0.14, 0.10, 0.10, mK), 0, -0.5, 0);
    put(grp, bx(0.14, 0.10, 0.10, mK), 0, 0.5, 0);
    g.add(grp);
    return grp;
  })();

  // ══════════════════════════════════════════════════════════════════
  //  NEUMATICOS (4 grandes de bajo perfil, con taco)
  // ══════════════════════════════════════════════════════════════════
  // Separados en DELANTEROS / TRASEROS: los delanteros cuelgan del bastidor articulado y doblan
  // con el, los traseros quedan en el bastidor de motor.
  const SneuDel = sub(g, 'neumaticos_del', 'Neumáticos delanteros', '2 neumáticos de bajo perfil del bastidor DELANTERO (doblan con la articulación): taco, rin naranja, pernos y guardabarros.');
  const SneuTra = sub(g, 'neumaticos_tras', 'Neumáticos traseros', '2 neumáticos de bajo perfil del bastidor TRASERO: taco, rin naranja, pernos, guardabarros y mud flaps.');
  const ruedas = [];
  for (const [px, pz] of [[-HW, 1.55], [HW, 1.55], [-HW, -2.55], [HW, -2.55]]) {
    const side = px < 0 ? -1 : 1;
    const xo = px + side * 0.14;
    S = pz > 0 ? SneuDel : SneuTra;   // delante del pasador → bastidor articulado
    const r = cy(WR, WR, 0.48, 20, mGom); put(S, r, xo, GY, pz, 0, 0, Math.PI / 2); // neumatico
    // Taco (lugs) alrededor de la banda de rodadura
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const lug = bx(0.10, 0.06, 0.44, mK);
      put(S, lug, xo, GY + Math.sin(a) * (WR + 0.01), pz + Math.cos(a) * (WR + 0.01), a, 0, 0);
    }
    put(S, cy(0.32, 0.32, 0.50, 12, mRi), xo, GY, pz, 0, 0, Math.PI / 2); // rin
    for (let i = 0; i < 6; i++) {                                          // pernos
      const a = (i / 6) * Math.PI * 2;
      put(S, cy(0.026, 0.026, 0.07, 6, mK), xo + side * 0.25, GY + Math.sin(a) * 0.18, pz + Math.cos(a) * 0.18, 0, 0, Math.PI / 2);
    }
    put(S, fender(0.82, 0.56, 2.2, mNarD), xo, GY, pz, 0, 0, Math.PI / 2); // guardabarros
    ruedas.push(r);
  }
  // Mud flaps de goma detras de las ruedas traseras (explicitamente al sub TRASERO)
  for (const xs of [-1, 1]) put(SneuTra, bx(0.44, 0.42, 0.02, mK), xs * (HW + 0.02), 0.42, -3.10);

  // ══════════════════════════════════════════════════════════════════
  //  LUCES
  // ══════════════════════════════════════════════════════════════════
  // Separadas en DELANTERAS / TRASERAS: los faros del bastidor delantero APUNTAN hacia donde
  // dobla la maquina (como en un LHD real); el resto vive en el bastidor trasero/cabina.
  const SlucDel = sub(g, 'luces_del', 'Faros delanteros', 'Faros del bastidor DELANTERO con guarda protectora: apuntan hacia donde dobla la articulación.');
  const SlucTra = sub(g, 'luces_tras', 'Faros de trabajo, calaveras y baliza', 'Faros de trabajo del techo, calaveras traseras, franja reflectiva y baliza ámbar animada.');
  for (const xs of [-1, 1]) {
    put(SlucDel, cy(0.08, 0.08, 0.06, 12, mFar), xs * 0.70, 1.50, 0.92, Math.PI / 2);   // faros delanteros
    // Guarda protectora del faro (jaula de barras horizontales)
    put(SlucDel, tor(0.11, 0.012, Math.PI * 2, mK), xs * 0.70, 1.50, 0.95, Math.PI / 2);
    for (const gy of [-0.06, 0, 0.06]) put(SlucDel, cy(0.006, 0.006, 0.20, 5, mK), xs * 0.70, 1.50 + gy, 0.96, 0, 0, Math.PI / 2);
  }
  for (const xs of [-0.55, 0.55]) put(SlucTra, cy(0.07, 0.07, 0.06, 12, mFar), CX + xs, 2.44, 0.50, Math.PI / 2); // faros de trabajo (techo)
  for (const xs of [-1, 1]) put(SlucTra, bx(0.12, 0.18, 0.04, mTail), xs * (HW - 0.06), 1.05, -3.93);            // calaveras traseras
  // Franja reflectiva de peligro (rojo/blanco) sobre la parrilla trasera
  for (let i = 0; i < 10; i++) {
    put(SlucTra, bx((HW * 2) / 10, 0.14, 0.03, i % 2 ? mBl : mRoj), -HW + ((HW * 2) / 10) * (i + 0.5), 1.92, -3.93);
  }
  const balM = new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff8800, emissiveIntensity: 2.5 });
  const baliza = cy(0.085, 0.085, 0.14, 10, balM);
  put(SlucTra, baliza, CX + (HW - 0.32), 2.50, 0.30);

  // ══════════════════════════════════════════════════════════════════
  //  EXTINTOR + TICK (ciclo de carga + hidraulica dinamica) + HAZARD
  // ══════════════════════════════════════════════════════════════════
  S = sub(g, 'extintor', 'Extintor', 'Extintor con tarjeta de inspección (lateral derecho del motor).');
  S.add(crearExtintor({ x: HW + 0.10, y: 0.80, z: -1.55, ry: Math.PI / 2 }));

  // OPERADOR sentado transversal (mirando a -X, tipico LHD). OCULTO por defecto: se muestra
  // cuando el equipo esta en movimiento/operado (DriveController / ciclo autonomo).
  const operador = crearOperador({ rol: 'operador' });
  operador.position.set(CX + 0.02, 1.48, -0.35);
  operador.rotation.y = -Math.PI / 2;
  operador.scale.setScalar(0.78);   // bajo el canopy de perfil bajo
  operador.visible = false;
  sub(g, 'cabina', 'Cabina ROPS/FOPS (bajo perfil)').add(operador);
  g.userData.operador = operador;

  g.name = 'scoop';
  g.userData._speed = 0; // lo inyecta PropScatter si patrulla

  // --- Re-orienta un cilindro/biela (unidad, eje +Y) entre 2 anclajes en mundo ---
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _mid = new THREE.Vector3(), _dir = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();
  function aim(grp, aObj, bObj) {
    aObj.getWorldPosition(_a); bObj.getWorldPosition(_b);
    g.worldToLocal(_a); g.worldToLocal(_b);
    _mid.addVectors(_a, _b).multiplyScalar(0.5);
    _dir.subVectors(_b, _a);
    const len = _dir.length() || 1e-4;
    grp.position.copy(_mid);
    _q.setFromUnitVectors(_up, _dir.multiplyScalar(1 / len));
    grp.quaternion.copy(_q);
    grp.scale.set(1, len, 1);
  }

  // ── ESTADO DE BRAZO/CUCHARA + API DE CONTROL ──────────────────────
  // st.boom / st.bucket: valor ACTUAL suavizado (0 = reposo/abajo · 1 = arriba/volcado).
  // st.tBoom / st.tBucket: OBJETIVO al que se acerca la hidraulica (nunca instantaneo).
  const st = { boom: 0, tBoom: 0, bucket: 0, tBucket: 0 };
  let modo = 'auto'; // 'auto' = demo de ciclo (visor/preview) · 'manual' = control del jugador
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  // API que consume DriveController cuando el jugador opera el equipo.
  g.userData.scoop = {
    setManual() { modo = 'manual'; },
    setAuto()   { modo = 'auto'; },
    get boom()   { return st.tBoom; },
    set boom(v)  { st.tBoom = clamp01(v); },
    get bucket()  { return st.tBucket; },
    set bucket(v) { st.tBucket = clamp01(v); },
    raiseBoom(a) { st.tBoom  = clamp01(st.tBoom + a); },   // subir brazo
    lowerBoom(a) { st.tBoom  = clamp01(st.tBoom - a); },   // bajar brazo
    curl(a)      { st.tBucket = clamp01(st.tBucket + a); }, // recoger / cargar
    dump(a)      { st.tBucket = clamp01(st.tBucket - a); }  // volcar / descargar
  };

  // ══════════════════════════════════════════════════════════════════
  //  ARTICULACION QUE DOBLA (la firma visual del trackless)
  // ══════════════════════════════════════════════════════════════════
  // Un LHD largo NO vira girando ruedas: se QUIEBRA por el pasador central. Se cuelga la mitad
  // DELANTERA (bastidor, brazo/cuchara, ruedas y faros delanteros) de un grupo `pivote` puesto en
  // el pasador; el tick lo rota segun `userData._steer` (-1..1) que inyectan DriveController y
  // VehicleSystem (mismo patron ya probado con `_speed`). Los 2 cilindros de direccion son
  // DINAMICOS: `aim()` los re-orienta entre su anclaje trasero y el delantero, asi que se
  // estiran/comprimen solos al doblar.
  // El VISOR no se altera: `recolectarSubelementos` desciende por grupos SIN etiquetar, de modo
  // que los sub() de la mitad delantera se siguen listando igual.
  const pivote = new THREE.Group();
  pivote.name = 'pivote_articulacion';
  pivote.position.set(0, 0, PIVZ);
  g.add(pivote);
  for (const part of [Schasis, Sbrazo, SneuDel, SlucDel]) {
    part.position.z -= PIVZ;    // compensa el offset del pivote → la geometria NO se mueve
    pivote.add(part);
  }
  const hydSteer = [makeHyd(0.070, 0.040), makeHyd(0.070, 0.040)];
  const ART_MAX = 0.62;         // ~35° de quiebre a cada lado (LHD real: ~40°)
  let artNow = 0;

  g.userData._steer = 0;        // lo inyecta DriveController / VehicleSystem

  g.userData.tick = (dt, elapsed) => {
    balM.emissiveIntensity = 1.5 + Math.abs(Math.sin(elapsed * 4)) * 2.5;
    // ARTICULACION: dobla hacia la direccion pedida (la hidraulica no es instantanea).
    const steerIn = THREE.MathUtils.clamp(g.userData._steer || 0, -1, 1);
    artNow += (steerIn * ART_MAX - artNow) * Math.min(1, dt * 3.5);
    pivote.rotation.y = artNow;
    if (modo === 'auto') {
      // Demo: ciclo de carga automatico (brazo y cuchara desfasados).
      st.tBoom   = Math.sin(elapsed * 0.32) * 0.5 + 0.5;
      st.tBucket = Math.sin(elapsed * 0.32 - 0.9) * 0.5 + 0.5;
    }
    // Suavizado hacia el objetivo (la hidraulica no es instantanea).
    const k = Math.min(1, dt * 4);
    st.boom   += (st.tBoom   - st.boom)   * k;
    st.bucket += (st.tBucket - st.bucket) * k;
    boom.rotation.x   = boomRest   + st.boom   * 0.55;
    bucket.rotation.x = bucketRest - st.bucket * 0.80;
    bell.rotation.x   = -0.15 + st.bucket * 0.55;
    // Actualiza matrices del brazo (y descendientes) antes de leer los anclajes.
    g.updateWorldMatrix(true, true);
    aim(hydLift[0], liftBase[0], liftTip[0]);
    aim(hydLift[1], liftBase[1], liftTip[1]);
    aim(hydTilt, tiltBase, tiltTip);
    aim(linkRod, linkTop, linkBucket);
    // Cilindros de DIRECCION: se estiran/comprimen segun cuanto dobla la junta.
    aim(hydSteer[0], steerBase[0], steerTip[0]);
    aim(hydSteer[1], steerBase[1], steerTip[1]);
    // Giro de ruedas segun velocidad de avance (radio 0.68 m).
    const vel = g.userData._speed;
    if (vel !== 0) for (const r of ruedas) r.rotation.z += (vel / WR) * dt;
  };

  // hurt (no kill): el contacto con el equipo GOLPEA pero no es fatal.
  g.userData.hazard = {
    tipo: 'equipoPesado', live: true, warn: 6, hurt: 0.6,
    aviso: 'SCOOP / LHD EN OPERACION — zona de carga activa. Mantente fuera del radio de la cuchara.',
    reflexion:
      'Estuviste demasiado cerca de un scoop (LHD) en operacion. La cuchara y el brazo de ' +
      'levante se mueven con gran fuerza y el operador tiene puntos ciegos amplios por su ' +
      'posicion transversal. Nunca ingreses al radio de giro ni a la trayectoria de un ' +
      'cargador de bajo perfil; manten contacto visual con el operador y usa la via peatonal.'
  };
  marcarEquipo(g, { prefijo: 'SC', articulado: true });
  return g;
}
