import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crear as crearExtintor } from '../ssoma/extintor.js';
import { crear as crearOperador } from './operador_sentado.js';
import { sub } from '../_comun/subelemento.js';

/**
 * CAMION MINERO / VOLQUETE (dump truck 6×4, estilo Volvo FMX) — equipo pesado de acarreo
 * de mineral por la via principal. Referencia: volquetes convencionales que operan en
 * minas subterraneas peruanas (galibo RN 96: 7.0 × 5.2 m).
 *
 * Realismo:
 *  - Cabina COE (cab-over-engine) con parrilla, parasol, espejos en brazo, estribos,
 *    interior visible (asientos + volante) y luces de trabajo en el techo.
 *  - Escape vertical con guarda termica + snorkel de admision (ambiente polvoriento).
 *  - Chasis con bastidor, cardan, ejes, tanque de combustible, tanques de aire y baterias.
 *  - TOLVA de roca reforzada: costillas, visera de proteccion sobre la cabina (rock guard),
 *    compuerta trasera con bisagras/seguros y GATA HIDRAULICA visible tras la cabina.
 *  - CARGA DE MINERAL conmutable: `userData.carga.set(true|false)` — el VehicleSystem la
 *    activa al pasar por la camara (carguio) y la vacia al pasar el echadero (acarreo real).
 *  - Ruedas posteriores DUALES en tandem (2 ejes), guardafangos y pantallas antibarro.
 *  - Cintas retrorreflectivas laterales, chevron trasero rojo/blanco y placa de flota VOLQ-N.
 *
 * Convenciones del proyecto: frente a +Z (VehicleSystem orienta con atan2(dir.x, dir.z)),
 * `userData._speed` (m/s) lo inyecta quien lo mueve, `userData.tick` anima baliza y ruedas.
 * Para editar dimensiones/colores, modifica este archivo.
 */

export const meta = {
  id: 'camion',
  nombre: 'Camion / volquete',
  descripcion: 'Volquete 6×4 de acarreo (estilo FMX): cabina COE con escape vertical, tolva de roca con visera y gata hidraulica, duales en tandem, chevron trasero, cintas reflectivas, baliza ambar y carga de mineral conmutable.'
};

// ─── helpers (mismo idioma que camioneta.js) ─────────────────────────────────
function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cy(rt, rb, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat); }
/** Caja de bordes redondeados (panel de chapa). */
function rbx(w, h, d, mat, r = 0.05) {
  const rr = Math.max(0.008, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, rr), mat);
}
function put(grp, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m;
}

/** Placa de flota "VOLQ-0N" (CanvasTexture pequeña, una por camion). */
function texPlacaFlota(num) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 48;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2f2ee'; ctx.fillRect(0, 0, 128, 48);
  ctx.strokeStyle = '#15181c'; ctx.lineWidth = 5; ctx.strokeRect(0, 0, 128, 48);
  ctx.fillStyle = '#15181c'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`VOLQ-0${num}`, 64, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Chevron trasero rojo/blanco (franjas diagonales, panel de alta visibilidad). */
function texChevron() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8dde2'; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#c41414';
  for (let x = -64; x < 256; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 64); ctx.lineTo(x + 24, 64); ctx.lineTo(x + 88, 0); ctx.lineTo(x + 64, 0);
    ctx.closePath(); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();

  // ── MATERIALES (cacheados salvo los emisivos ANIMADOS, que deben ser unicos) ──
  const mY   = MineMaterials.plano(0xd7a021, { rough: 0.62, metal: 0.18 }); // chapa amarillo industrial
  const mYD  = MineMaterials.plano(0xb08a2a, { rough: 0.92, metal: 0.06 }); // amarillo sucio/polvo
  const mK   = MineMaterials.plano(0x17181b, { rough: 0.78, metal: 0.35 }); // negro estructura
  const mTr  = MineMaterials.plano(0x0e0e10, { rough: 0.95, metal: 0.08 }); // plastico negro
  const mAc  = MineMaterials.plano(0x565b62, { rough: 0.45, metal: 0.75 }); // acero mecanico
  const mCr  = MineMaterials.plano(0x9a9a9c, { rough: 0.30, metal: 0.85 }); // cromo/inox (escape, hidraulica)
  const mRu  = MineMaterials.plano(0x0d0d10, { rough: 0.98 });              // goma neumatico
  const mTd  = MineMaterials.plano(0x161619, { rough: 0.95 });              // banda de rodadura
  const mRi  = MineMaterials.plano(0x3f3f46, { rough: 0.55, metal: 0.55 }); // rin
  const mGr  = MineMaterials.plano(0x202024, { rough: 0.6, metal: 0.4 });   // parrilla
  const mInt = MineMaterials.plano(0x1e1e22, { rough: 0.92, metal: 0.05 }); // interior/tablero
  const mSeat= MineMaterials.plano(0x33333a, { rough: 0.95, metal: 0.02 }); // asientos
  const mGl  = new THREE.MeshPhysicalMaterial({                              // vidrio oscuro
    color: 0x0e1a26, roughness: 0.08, metalness: 0.0,
    transparent: true, opacity: 0.65, clearcoat: 1.0, clearcoatRoughness: 0.06
  });
  const mRe  = new THREE.MeshStandardMaterial({                              // reflectivo rojo
    color: 0xdd1100, emissive: 0xcc0000, emissiveIntensity: 0.6, roughness: 0.3
  });
  const mWh  = new THREE.MeshStandardMaterial({                              // reflectivo blanco
    color: 0xe8ecef, emissive: 0x8a9094, emissiveIntensity: 0.35, roughness: 0.3
  });
  const mFa  = new THREE.MeshStandardMaterial({                              // faro delantero
    color: 0xeef2ff, emissive: 0xdfe6ff, emissiveIntensity: 1.2, roughness: 0.08
  });
  const mWk  = new THREE.MeshStandardMaterial({                              // luz de trabajo techo
    color: 0xfff4d6, emissive: 0xffe9b0, emissiveIntensity: 1.4, roughness: 0.1
  });
  const mTn  = MineMaterials.plano(0xff7a00, { rough: 0.5, emissive: 0xcc4400, emissiveIntensity: 0.4 }); // intermitente
  const mTl  = new THREE.MeshStandardMaterial({                              // calavera roja
    color: 0xcc1100, emissive: 0xcc0000, emissiveIntensity: 0.7, roughness: 0.25
  });
  const mRev = new THREE.MeshStandardMaterial({                              // luz de reversa
    color: 0xf2f4f6, emissive: 0xd8dde2, emissiveIntensity: 0.8, roughness: 0.15
  });
  const mAm  = new THREE.MeshStandardMaterial({                              // domo baliza (ANIMADO → unico)
    color: 0xff9500, emissive: 0xff8400, emissiveIntensity: 2.0, roughness: 0.25,
    transparent: true, opacity: 0.9
  });

  // ── DIMENSIONES PRINCIPALES ───────────────────────────────────────────────
  const HW = 1.25;   // semi-ancho carroceria (total 2.50 m)
  const R  = 0.60;   // radio de llanta (volquete)
  const ZF = 2.70;   // eje delantero
  const ZR1 = -1.30, ZR2 = -2.60; // tandem posterior

  // ══════════════════════════════════════════════════════════════════════════
  //  CHASIS — bastidor, transmision, tanques y proteccion trasera
  // ══════════════════════════════════════════════════════════════════════════
  let S = sub(g, 'chasis', 'Chasis (bastidor)',
    'Bastidor de largueros con travesaños, cardan, ejes en tandem, tanque de combustible, tanques de aire, caja de baterias, guardafangos posteriores y parachoque trasero.');
  for (const xs of [-1, 1]) put(S, bx(0.14, 0.24, 7.7, mK), xs * 0.55, 0.97, -0.15);   // largueros
  for (const z of [3.3, 0.4, -3.5]) put(S, bx(1.10, 0.12, 0.14, mK), 0, 0.97, z);      // travesaños
  put(S, cy(0.06, 0.06, 3.0, 8, mAc), 0, 0.72, 0.15, Math.PI / 2);                     // cardan
  for (const z of [ZR1, ZR2]) {
    put(S, cy(0.10, 0.10, 2.05, 10, mK), 0, R, z, 0, 0, Math.PI / 2);                  // puente del eje
    put(S, cy(0.17, 0.17, 0.45, 10, mK), 0, R, z, 0, 0, Math.PI / 2);                  // diferencial
  }
  // Tanque de combustible (izquierda) con cinchos
  put(S, cy(0.33, 0.33, 1.40, 14, mAc), -1.00, 0.90, 0.55, Math.PI / 2);
  for (const z of [0.15, 0.95]) put(S, bx(0.72, 0.06, 0.05, mK), -1.00, 0.92, z);
  // Tanques de aire (derecha) + caja de baterias
  for (const y of [0.72, 1.02]) put(S, cy(0.14, 0.14, 0.80, 10, mAc), 1.02, y, 0.35, Math.PI / 2);
  put(S, rbx(0.55, 0.42, 0.65, mTr, 0.04), 1.02, 0.92, -0.85);
  // Guardafangos posteriores (tapa superior + faldon trasero por eje) y pantallas antibarro
  for (const xs of [-1, 1]) for (const z of [ZR1, ZR2]) {
    put(S, rbx(0.50, 0.06, 1.30, mTr, 0.02), xs * 1.06, R + 0.74, z);
    put(S, rbx(0.50, 0.34, 0.05, mTr, 0.02), xs * 1.06, R + 0.56, z - 0.66);
  }
  for (const xs of [-1, 1]) put(S, bx(0.50, 0.55, 0.03, mTr), xs * 1.06, 0.42, -3.38); // antibarro
  put(S, bx(2.40, 0.16, 0.12, mK), 0, 0.72, -4.12);                                    // parachoque trasero

  // ══════════════════════════════════════════════════════════════════════════
  //  CABINA COE (cab-over-engine) — cuerpo, vidrios, parrilla, espejos, interior
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'cabina', 'Cabina COE',
    'Cabina sobre motor: cuerpo bajo y greenhouse, parabrisas y ventanas, parrilla con listones, parasol, espejos en brazo, estribos, manijas e interior con asientos y volante.');
  put(S, rbx(2.36, 0.92, 1.82, mY, 0.09), 0, 1.74, 3.01);                    // cuerpo inferior (puertas)
  put(S, rbx(2.28, 0.84, 1.76, mY, 0.10), 0, 2.60, 3.00);                    // greenhouse
  put(S, rbx(2.20, 0.08, 1.62, mYD, 0.03), 0, 3.04, 2.98);                   // techo (panel mate)
  put(S, rbx(2.02, 0.68, 0.05, mGl, 0.02), 0, 2.62, 3.90, -0.06);            // parabrisas
  for (const xs of [-1, 1]) put(S, bx(0.05, 0.56, 1.28, mGl), xs * 1.155, 2.58, 2.98); // ventanas laterales
  put(S, rbx(2.10, 0.78, 0.08, mGr, 0.03), 0, 1.72, 3.93);                   // parrilla
  for (const y of [1.50, 1.72, 1.94]) put(S, bx(1.90, 0.05, 0.10, mK), 0, y, 3.955);   // listones
  put(S, rbx(2.50, 0.34, 0.30, mTr, 0.05), 0, 0.95, 3.92);                   // parachoque delantero
  put(S, bx(1.10, 0.05, 0.26, mK), 0, 1.14, 3.92);                           // peldaño central (acceso a parabrisas)
  put(S, rbx(2.26, 0.12, 0.34, mYD, 0.03), 0, 3.02, 3.84, -0.25);            // parasol
  // Espejos principales en brazo (a la altura del pilar A)
  for (const xs of [-1, 1]) {
    put(S, bx(0.05, 0.05, 0.34, mK), xs * 1.30, 2.90, 3.62, 0, xs * 0.35, 0);
    put(S, rbx(0.16, 0.42, 0.05, mTr, 0.02), xs * 1.42, 2.62, 3.58);
  }
  // Estribos (2 peldaños por lado, DELANTE de la rueda de direccion) + manijas
  for (const xs of [-1, 1]) {
    for (const y of [0.55, 0.98]) put(S, bx(0.30, 0.05, 0.40, mK), xs * 1.20, y, 3.58);
    put(S, bx(0.03, 0.16, 0.05, mCr), xs * 1.19, 2.02, 3.35);
  }
  // Interior visible: piso, tablero, volante (LHD) y dos asientos
  put(S, bx(2.10, 0.04, 1.55, mInt), 0, 2.16, 2.95);
  put(S, rbx(2.00, 0.26, 0.30, mInt, 0.04), 0, 2.36, 3.60);
  put(S, new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 6, 12), mInt), -0.55, 2.48, 3.38, -0.6, 0, 0);
  for (const xs of [-0.55, 0.55]) {
    put(S, rbx(0.42, 0.12, 0.44, mSeat, 0.04), xs, 2.28, 2.70);
    put(S, rbx(0.42, 0.52, 0.12, mSeat, 0.04), xs, 2.56, 2.48);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ESCAPE VERTICAL + ADMISION (snorkel)
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'escape', 'Escape y admision',
    'Chimenea de escape vertical con guarda termica perforada (detras de la cabina) y snorkel de admision de aire elevado, tipicos de volquete en ambiente polvoriento.');
  put(S, cy(0.075, 0.075, 1.85, 10, mAc), -1.00, 2.05, 1.95);                // tubo de escape
  put(S, cy(0.105, 0.105, 1.10, 10, mGr), -1.00, 2.20, 1.95);                // guarda termica
  put(S, cy(0.08, 0.06, 0.16, 10, mK), -1.00, 3.02, 1.95, 0, 0, 0.5);        // salida biselada
  put(S, rbx(0.24, 1.60, 0.30, mTr, 0.05), 1.00, 2.30, 1.95);                // snorkel
  put(S, rbx(0.30, 0.28, 0.36, mTr, 0.05), 1.00, 3.14, 1.95);                // cabezal de admision

  // ══════════════════════════════════════════════════════════════════════════
  //  TOLVA DE ROCA — visera, costillas, compuerta y gata hidraulica
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'tolva', 'Tolva de roca (dump bed)',
    'Tolva reforzada de acarreo: piso y paredes con costillas verticales, visera de proteccion sobre la cabina, compuerta trasera con bisagras y seguros, subchasis, pivotes de volteo y gata hidraulica frontal.');
  for (const xs of [-1, 1]) put(S, bx(0.12, 0.14, 5.5, mK), xs * 0.55, 1.28, -1.15);   // subchasis
  put(S, bx(2.44, 0.14, 5.70, mYD), 0, 1.42, -1.15);                          // piso
  for (const xs of [-1, 1]) put(S, bx(0.10, 1.55, 5.70, mY), xs * 1.17, 2.26, -1.15);  // paredes
  put(S, bx(2.44, 1.55, 0.10, mY), 0, 2.26, 1.70);                            // frontal
  put(S, rbx(2.52, 0.12, 1.40, mY, 0.04), 0, 3.14, 2.48, -0.06);              // visera sobre cabina
  for (const xs of [-1, 1]) for (const z of [-3.3, -1.7, -0.1, 1.3]) {
    put(S, bx(0.08, 1.50, 0.16, mYD), xs * 1.245, 2.24, z);                   // costillas
  }
  for (const xs of [-1, 1]) put(S, bx(0.12, 0.12, 5.70, mYD), xs * 1.22, 3.06, -1.15); // rieles superiores
  // Compuerta trasera basculante + bisagras superiores + seguros inferiores
  put(S, bx(2.44, 1.48, 0.10, mY), 0, 2.24, -4.02, 0.06);
  for (const xs of [-1, 1]) put(S, cy(0.06, 0.06, 0.22, 8, mK), xs * 1.10, 3.00, -4.00, 0, 0, Math.PI / 2);
  for (const xs of [-1, 1]) put(S, bx(0.08, 0.26, 0.10, mAc), xs * 0.95, 1.56, -4.06);
  // Pivotes de volteo (traseros) y GATA hidraulica frontal (cilindro + vastago)
  for (const xs of [-1, 1]) put(S, bx(0.16, 0.26, 0.30, mK), xs * 0.55, 1.16, -3.85);
  put(S, cy(0.12, 0.12, 1.15, 12, mK), 0, 1.62, 1.90);
  put(S, cy(0.075, 0.075, 0.80, 10, mCr), 0, 2.55, 1.90);

  // ── CARGA DE MINERAL (conmutable: llena al salir de la camara, vacia tras el echadero) ──
  const cargaGrp = new THREE.Group();
  cargaGrp.name = 'carga_muck';
  const mRoca = MineMaterials.roca();
  put(cargaGrp, rbx(2.20, 0.62, 5.30, mRoca, 0.18), 0, 2.90, -1.15);          // colmo del mineral
  const lumpGeo = new THREE.IcosahedronGeometry(0.34, 0);
  for (const [lx, lz, s] of [[-0.6, -2.6, 1.1], [0.55, -1.4, 1.3], [-0.35, 0.2, 1.0], [0.7, 0.9, 0.85]]) {
    const lump = new THREE.Mesh(lumpGeo, mRoca);
    lump.position.set(lx, 3.22, lz); lump.scale.setScalar(s);
    lump.rotation.set(lx * 3.1, lz * 1.7, lx + lz);
    cargaGrp.add(lump);
  }
  S.add(cargaGrp);
  g.userData.carga = {
    cargado: true,
    set(v) { this.cargado = !!v; cargaGrp.visible = this.cargado; }
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  RUEDAS — delanteras simples + tandem posterior DUAL (giran con la velocidad)
  //  Idioma de camioneta.js: grupo de rueda vertical (cilindro con eje → X) que
  //  gira COMPLETO en rotation.x. Geometrias COMPARTIDAS entre ruedas (memoria).
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'ruedas', 'Ruedas', 'Delanteras simples de direccion + 4 duales en tandem posterior; tacos de rodadura, rines y bujes. Giran segun la velocidad.');
  const geoTireF = new THREE.CylinderGeometry(R, R, 0.42, 22);
  const geoTireR = new THREE.CylinderGeometry(R, R, 0.36, 22);
  const geoRim   = new THREE.CylinderGeometry(R * 0.52, R * 0.52, 0.44, 12);
  const geoHub   = new THREE.CylinderGeometry(R * 0.16, R * 0.16, 0.50, 8);
  const geoTacoF = new THREE.BoxGeometry(0.44, 0.07, 0.14);
  const geoTacoR = new THREE.BoxGeometry(0.38, 0.07, 0.14);
  const ruedas = [];

  const mkTacos = (wheel, geo, n, xOff = 0) => {
    for (let t = 0; t < n; t++) {
      const a = (t / n) * Math.PI * 2;
      const taco = new THREE.Mesh(geo, mTd);
      taco.position.set(xOff, Math.sin(a) * (R + 0.005), Math.cos(a) * (R + 0.005));
      taco.rotation.x = a;
      wheel.add(taco);
    }
  };

  // Delanteras (direccion)
  for (const xs of [-1, 1]) {
    const wheel = new THREE.Group();
    wheel.position.set(xs * 1.02, R, ZF);
    put(wheel, new THREE.Mesh(geoTireF, mRu), 0, 0, 0, 0, 0, Math.PI / 2);
    put(wheel, new THREE.Mesh(geoRim, mRi), 0, 0, 0, 0, 0, Math.PI / 2);
    put(wheel, new THREE.Mesh(geoHub, mAc), 0, 0, 0, 0, 0, Math.PI / 2);
    mkTacos(wheel, geoTacoF, 9);
    S.add(wheel); ruedas.push(wheel);
  }
  // Tandem posterior: DUAL (neumatico exterior + interior por lado y eje)
  for (const z of [ZR1, ZR2]) for (const xs of [-1, 1]) {
    const wheel = new THREE.Group();
    wheel.position.set(xs * 0.86, R, z);
    put(wheel, new THREE.Mesh(geoTireR, mRu), xs * 0.20, 0, 0, 0, 0, Math.PI / 2);  // exterior
    put(wheel, new THREE.Mesh(geoTireR, mRu), -xs * 0.20, 0, 0, 0, 0, Math.PI / 2); // interior
    put(wheel, new THREE.Mesh(geoRim, mRi), xs * 0.20, 0, 0, 0, 0, Math.PI / 2);
    put(wheel, new THREE.Mesh(geoHub, mAc), xs * 0.22, 0, 0, 0, 0, Math.PI / 2);
    mkTacos(wheel, geoTacoR, 8, xs * 0.20);
    S.add(wheel); ruedas.push(wheel);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LUCES — faros, intermitentes, trabajo en techo, calaveras y reversa
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'luces', 'Luces',
    'Faros delanteros, intermitentes ambar, 3 luces de trabajo en el techo, calaveras rojas traseras y luz de reversa.');
  for (const xs of [-1, 1]) {
    put(S, rbx(0.36, 0.18, 0.06, mFa, 0.02), xs * 0.86, 0.98, 4.08);          // faros (en el parachoque)
    put(S, rbx(0.14, 0.10, 0.05, mTn, 0.02), xs * 1.08, 1.34, 3.94);          // intermitentes (esquina del frontal)
  }
  for (const x of [-0.70, 0, 0.70]) put(S, cy(0.07, 0.09, 0.10, 10, mWk), x, 3.14, 3.72, Math.PI / 2); // trabajo
  for (const xs of [-1, 1]) put(S, rbx(0.16, 0.16, 0.06, mTl, 0.02), xs * 1.05, 0.80, -4.19);          // calaveras
  put(S, rbx(0.14, 0.14, 0.05, mRev, 0.02), 0.72, 0.80, -4.19);               // reversa

  // ══════════════════════════════════════════════════════════════════════════
  //  BALIZA ambar giratoria sobre la cabina (material UNICO: se anima el pulso)
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'baliza', 'Baliza ámbar', 'Baliza giratoria animada sobre el techo de la cabina (delante de la visera de la tolva).');
  put(S, cy(0.10, 0.11, 0.06, 10, mK), -0.90, 3.11, 3.50);                    // base
  const baliza = put(S, cy(0.085, 0.095, 0.17, 10, mAm), -0.90, 3.22, 3.50);  // domo

  // ══════════════════════════════════════════════════════════════════════════
  //  REFLECTIVOS Y PLACAS — cintas laterales, chevron trasero, placa de flota
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'reflectivos', 'Reflectivos y placas',
    'Cintas retrorreflectivas rojo/blanco a lo largo de la tolva, panel chevron trasero de alta visibilidad y placa de flota VOLQ-N en las puertas.');
  for (const xs of [-1, 1]) for (let i = 0; i < 4; i++) {
    put(S, bx(0.02, 0.12, 0.55, i % 2 ? mWh : mRe), xs * 1.23, 1.58, -3.30 + i * 1.45);
  }
  const chevron = new THREE.Mesh(
    new THREE.PlaneGeometry(1.85, 0.42),
    new THREE.MeshStandardMaterial({ map: texChevron(), roughness: 0.4, emissive: 0x552211, emissiveIntensity: 0.25 })
  );
  put(S, chevron, 0, 1.95, -4.11, 0, Math.PI, 0);                             // chevron en la compuerta
  const placaTex = texPlacaFlota(1 + Math.floor(Math.random() * 8));
  for (const xs of [-1, 1]) {
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.21),
      new THREE.MeshStandardMaterial({ map: placaTex, roughness: 0.5 }));
    put(S, placa, xs * 1.195, 1.86, 2.85, 0, xs * Math.PI / 2, 0);            // placa en cada puerta
  }

  // Extintor con tarjeta de inspeccion (lado derecho, tras la cabina)
  S = sub(g, 'extintor', 'Extintor', 'Extintor con tarjeta de inspección montado tras la cabina, lado derecho.');
  S.add(crearExtintor({ x: 1.16, y: 0.85, z: 1.55, ry: Math.PI / 2 }));

  // OPERADOR al volante (todo vehiculo en movimiento debe verse operado). Los sistemas
  // pueden ocultarlo/mostrarlo via g.userData.operador.visible.
  const operador = crearOperador({ rol: 'operador' });
  operador.position.set(-0.55, 2.31, 2.58);
  operador.scale.setScalar(0.58);   // a la escala del interior de la cabina COE
  sub(g, 'cabina', 'Cabina COE').add(operador);
  g.userData.operador = operador;

  g.name = 'camion';
  // _speed lo inyecta quien lo mueve (VehicleSystem / patrullaje).
  g.userData._speed = 0;
  g.userData.tick = (dt, elapsed) => {
    baliza.material.emissiveIntensity = 1.2 + Math.abs(Math.sin(elapsed * 6)) * 2.5;
    // Giro de ruedas proporcional a la velocidad de avance (radio R).
    const vel = g.userData._speed;
    if (vel !== 0) {
      for (const r of ruedas) r.rotation.x += (vel / R) * dt;
    }
  };

  // OPTIMIZACION CPU: congela las matrices locales de todo lo ESTATICO del camion. El grupo
  // raiz lo mueve el VehicleSystem y las RUEDAS giran (quedan con autoUpdate); el resto de
  // piezas nunca cambia su transform local → se evita recomponer ~170 matrices por frame.
  const animados = new Set(ruedas);
  g.traverse((o) => {
    if (o === g || animados.has(o)) return;
    let p = o.parent, dentroDeRueda = false;
    while (p) { if (animados.has(p)) { dentroDeRueda = true; break; } p = p.parent; }
    if (dentroDeRueda) return; // hijos de la rueda giran con su grupo (el grupo compone)
    o.updateMatrix();
    o.matrixAutoUpdate = false;
  });

  // live:true -> HazardSystem recalcula la caja envolvente cada frame.
  // hurt (no kill): el contacto con equipo en movimiento GOLPEA pero no es fatal.
  g.userData.hazard = {
    tipo: 'atropello',
    live: true,
    warn: 7,
    hurt: 0.5,
    aviso: 'EQUIPO PESADO EN MOVIMIENTO — via peatonal obligatoria, contacto visual con el operador.',
    reflexion:
      'Fuiste golpeado por un volquete en movimiento. En mineria NUNCA te ubiques en la ' +
      'trayectoria ni en el punto ciego de un equipo pesado. Usa siempre la via peatonal ' +
      'demarcada, manten contacto visual con el operador y respeta las distancias de seguridad.'
  };
  return g;
}
