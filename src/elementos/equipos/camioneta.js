import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crear as crearExtintor } from '../ssoma/extintor.js';
import { crear as crearOperador } from './operador_sentado.js';
import { sub } from '../_comun/subelemento.js';

/**
 * CAMIONETA HILUX MINERA (doble cabina) — pickup 4×4 de operaciones NEXA.
 *
 * Referencia: fotos reales de mina (Toyota Hilux / Mitsubishi L200) con bull bar,
 * dos faros auxiliares REDONDOS ámbar, franja neón, franjas rojas reflectivas,
 * baliza ámbar sobre mástil, extintor en la tolva y placa peruana amarilla.
 *
 * Proporciones reales (escala 1:1, SIN el antiguo truco scale.y=2):
 *  - Largo total ~5.85 m  |  Ancho 2.10 m  |  Alto ~1.98 m
 *  - Llanta off-road: radio 0.55 m (≈43") — buen clearance de carretera minera
 *  - Silueta correcta: capó bajo, cabina (greenhouse) angosta y elevada con
 *    parabrisas inclinado, tolva más baja, guardabarros negros abombados.
 *  - El frente apunta a +Z (VehicleSystem orienta con atan2(dir.x, dir.z)).
 */

export const meta = {
  id: 'camioneta',
  nombre: 'Camioneta Hilux minera',
  descripcion: 'Pickup 4×4 doble cabina. Blanca polvorienta, franja neón, bull bar con faros redondos ámbar, baliza en mástil, tolva con equipo y extintor.'
};

// ─── helpers ─────────────────────────────────────────────────────────────────
function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cy(rt, rb, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat); }
/** Caja de bordes redondeados (panel de chapa) — el mayor salto de realismo. */
function rbx(w, h, d, mat, r = 0.06) {
  const rr = Math.max(0.008, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, rr), mat);
}
function put(grp, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m;
}

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();

  // ── MATERIALES ────────────────────────────────────────────────────────────
  const mW  = MineMaterials.plano(0xf4f4f0, { rough: 0.55, metal: 0.12 }); // chapa blanca (algo de brillo)
  const mD  = MineMaterials.plano(0xdedacf, { rough: 0.90, metal: 0.03 }); // blanco sucio/polvo
  const mDust = MineMaterials.plano(0xb9ad97, { rough: 0.98, metal: 0.0 }); // polvo/barro en bajos
  const mK  = MineMaterials.plano(0x161618, { rough: 0.78, metal: 0.35 }); // negro estructura
  const mTr = MineMaterials.plano(0x0e0e10, { rough: 0.95, metal: 0.08 }); // plástico negro (flares/parachoque)
  const mNe = new THREE.MeshStandardMaterial({                              // franja neón amarillo-verde
    color: 0xc6f000, emissive: 0x7fbf00, emissiveIntensity: 0.55, roughness: 0.5
  });
  const mGl = new THREE.MeshPhysicalMaterial({                              // vidrio oscuro
    color: 0x0e1a26, roughness: 0.06, metalness: 0.0,
    transparent: true, opacity: 0.62, clearcoat: 1.0, clearcoatRoughness: 0.05
  });
  const mRu = MineMaterials.plano(0x0d0d10, { rough: 0.98 });               // goma rueda
  const mTd = MineMaterials.plano(0x161619, { rough: 0.95 });               // banda de rodadura
  const mRi = MineMaterials.plano(0x3a3a40, { rough: 0.55, metal: 0.55 });  // rin oscuro off-road
  const mRiC= MineMaterials.plano(0x9a9aa2, { rough: 0.35, metal: 0.85 });  // buje cromo
  const mCr = MineMaterials.plano(0x9a9a9c, { rough: 0.30, metal: 0.85 });  // cromo (manijas, molduras)
  const mGr = MineMaterials.plano(0x202024, { rough: 0.6, metal: 0.4 });    // rejilla grille
  const mRe = new THREE.MeshStandardMaterial({                              // reflectivo rojo
    color: 0xdd1100, emissive: 0xcc0000, emissiveIntensity: 0.6, roughness: 0.3
  });
  const mAm = new THREE.MeshStandardMaterial({                              // domo baliza ámbar
    color: 0xff9500, emissive: 0xff8400, emissiveIntensity: 2.5, roughness: 0.25,
    transparent: true, opacity: 0.9
  });
  const mAux = new THREE.MeshStandardMaterial({                             // faro auxiliar redondo (ámbar/amarillo)
    color: 0xffcc1a, emissive: 0xffb000, emissiveIntensity: 1.2, roughness: 0.2
  });
  const mFa = new THREE.MeshStandardMaterial({                             // faro delantero blanco
    color: 0xeef2ff, emissive: 0xdfe6ff, emissiveIntensity: 1.1, roughness: 0.08
  });
  const mTl = new THREE.MeshStandardMaterial({                             // calavera roja
    color: 0xcc1100, emissive: 0xcc0000, emissiveIntensity: 0.7, roughness: 0.25
  });
  const mTn = MineMaterials.plano(0xff7a00, { rough: 0.5, emissive: 0xcc4400, emissiveIntensity: 0.4 }); // intermitente ámbar
  const mInt = MineMaterials.plano(0x1e1e22, { rough: 0.92, metal: 0.05 });  // interior/tablero
  const mSeat= MineMaterials.plano(0x33333a, { rough: 0.95, metal: 0.02 });  // asientos

  // ── DIMENSIONES PRINCIPALES ───────────────────────────────────────────────
  const HW = 1.05;   // semi-ancho carrocería (total 2.10 m)
  const GW = 0.95;   // semi-ancho del greenhouse (cabina superior, más angosta)
  const GY = 0.48;   // radio de llanta = centro de rueda (≈33" todoterreno minero)

  // Todo se construye a ESCALA REAL directamente sobre `g`.
  // ══════════════════════════════════════════════════════════════════════════
  //  CHASIS (bastidor + rieles)
  // ══════════════════════════════════════════════════════════════════════════
  let S = sub(g, 'chasis', 'Chasis (bastidor)', 'Bastidor negro con rieles longitudinales.');
  put(S, bx(HW * 2 - 0.30, 0.14, 5.20, mK), 0, 0.42, -0.10);
  for (const xs of [-1, 1]) put(S, bx(0.10, 0.16, 5.00, mK), xs * (HW - 0.30), 0.44, -0.10);

  // ══════════════════════════════════════════════════════════════════════════
  //  CABINA DOBLE — cuerpo inferior (puertas) + greenhouse (techo)
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'cabina', 'Cabina doble', 'Cuerpo inferior, greenhouse, vidrios, pilares, espejos, manijas y estribos.');
  // Cuerpo inferior de la cabina (puertas) — de la mampara al fondo de cabina
  put(S, rbx(HW * 2, 0.76, 2.62, mW, 0.10), 0, 0.98, 0.30);
  // Greenhouse (invernadero): más angosto y elevado, con caída trasera
  put(S, rbx(GW * 2, 0.62, 2.02, mW, 0.12), 0, 1.60, 0.22);
  // Techo (panel superior mate para leer la curvatura)
  put(S, rbx(GW * 2 - 0.10, 0.10, 1.78, mD, 0.05), 0, 1.92, 0.18);

  // ── INTERIOR (silueta visible a través de los vidrios) ──
  put(S, bx(GW * 2 - 0.14, 0.02, 2.30, mInt), 0, 0.86, 0.18);                 // piso de cabina
  put(S, rbx(GW * 2 - 0.16, 0.22, 0.24, mInt, 0.04), 0, 1.20, 1.18);         // tablero
  for (const [sx, sz] of [[-0.44, 0.62], [0.44, 0.62], [-0.44, -0.28], [0.44, -0.28]]) {
    put(S, rbx(0.34, 0.14, 0.36, mSeat, 0.05), sx, 1.00, sz);               // cojín
    put(S, rbx(0.34, 0.44, 0.12, mSeat, 0.05), sx, 1.24, sz - 0.18);        // respaldo
    put(S, rbx(0.14, 0.12, 0.10, mSeat, 0.03), sx, 1.48, sz - 0.20);        // apoyacabeza
  }
  // Volante + columna (conductor izquierdo, LHD Perú)
  put(S, new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 6, 12), mInt), -0.44, 1.18, 0.98, -0.5, 0, 0);
  put(S, cy(0.02, 0.02, 0.22, 6, mInt), -0.44, 1.12, 1.08, Math.PI / 2.6, 0, 0);

  // Cowl (base del parabrisas / bandeja de limpiaparabrisas) — cierra el hueco capó↔vidrio
  put(S, rbx(GW * 2 - 0.06, 0.10, 0.32, mD, 0.03), 0, 1.28, 1.44);
  // ── Parabrisas (inclinado hacia atrás) y luneta ──
  put(S, rbx(GW * 2 - 0.14, 0.66, 0.05, mGl, 0.02), 0, 1.55, 1.24, -0.42, 0, 0);
  put(S, rbx(GW * 2 - 0.16, 0.44, 0.05, mGl, 0.02), 0, 1.58, -0.80, 0.16, 0, 0);
  // ── Ventanas laterales (delantera + trasera por lado) ──
  for (const xs of [-1, 1]) {
    put(S, rbx(0.05, 0.46, 0.92, mGl, 0.02), xs * (GW + 0.005), 1.55, 0.72);
    put(S, rbx(0.05, 0.44, 0.80, mGl, 0.02), xs * (GW + 0.005), 1.55, -0.32);
  }
  // ── Pilares A / B / C (negros) ──
  for (const xs of [-1, 1]) {
    put(S, bx(0.06, 0.66, 0.07, mK), xs * (GW + 0.01), 1.55, 1.20, -0.42, 0, 0); // A raked
    put(S, bx(0.06, 0.60, 0.09, mK), xs * (GW + 0.01), 1.58, 0.18);              // B
    put(S, bx(0.06, 0.50, 0.08, mK), xs * (GW + 0.01), 1.58, -0.78);            // C
  }

  // ── Molduras de ventana: cinturón cromado (beltline) + canalón de techo ──
  for (const xs of [-1, 1]) {
    put(S, bx(0.02, 0.03, 1.92, mCr), xs * (GW + 0.02), 1.31, 0.20);  // beltline bajo los vidrios
    put(S, bx(0.03, 0.03, 1.78, mCr), xs * (GW + 0.01), 1.86, 0.18);  // canalón de techo
  }

  // ── Líneas de puerta + manijas + molduras ──
  for (const z of [0.90, -0.06]) put(S, bx(HW * 2 + 0.01, 0.72, 0.02, mK), 0, 0.98, z); // corte de puertas
  for (const xs of [-1, 1]) for (const z of [1.06, 0.10]) put(S, bx(0.03, 0.05, 0.18, mCr), xs * (HW + 0.005), 1.14, z);
  // Espejos retrovisores (brazo + carcasa)
  for (const xs of [-1, 1]) {
    put(S, bx(0.14, 0.03, 0.03, mK), xs * (HW + 0.10), 1.42, 1.36);
    put(S, rbx(0.06, 0.16, 0.20, mK, 0.03), xs * (HW + 0.20), 1.40, 1.34);
  }
  // Estribos / running boards
  for (const xs of [-1, 1]) put(S, rbx(0.14, 0.06, 2.30, mTr, 0.03), xs * (HW + 0.03), 0.46, 0.35);
  // Franja de polvo/barro en los bajos (las unidades de mina van sucias)
  for (const xs of [-1, 1]) put(S, bx(0.02, 0.16, 2.55, mDust), xs * (HW + 0.015), 0.66, 0.33);

  // ── SNORKEL (toma de aire elevada, lado derecho — típico en mina) ──
  put(S, cy(0.05, 0.05, 0.92, 8, mK), HW + 0.05, 1.40, 1.52);                      // tubo vertical (pilar A)
  put(S, cy(0.05, 0.05, 0.26, 8, mK), HW + 0.05, 0.99, 1.63, Math.PI / 2.3, 0, 0); // codo hacia el guardabarro
  put(S, cy(0.065, 0.05, 0.18, 8, mK), HW + 0.05, 1.90, 1.60, Math.PI / 2.4, 0, 0);// cabezal ram-air
  // ── ANTENA de radio (guardabarro delantero izquierdo) ──
  put(S, cy(0.012, 0.012, 0.10, 6, mK), -(HW - 0.02), 1.10, 1.72);
  put(S, cy(0.008, 0.008, 0.82, 4, mK), -(HW - 0.02), 1.55, 1.74, 0.05, 0, 0.05);

  // ══════════════════════════════════════════════════════════════════════════
  //  CAPÓ + FASCIA + GRILLE FRONTAL
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'capot', 'Capó y fascia frontal', 'Capó inclinado, grille cromado y fascia.');
  put(S, rbx(HW * 2 - 0.06, 0.16, 0.98, mW, 0.07), 0, 1.24, 2.00, 0.05, 0, 0); // capó (caído al frente)
  put(S, rbx(HW * 2 - 0.02, 0.60, 0.14, mD, 0.05), 0, 0.98, 2.50);             // fascia
  // Grille con marco cromado + rejilla + 2 travesaños cromados
  put(S, rbx(HW * 2 - 0.30, 0.44, 0.10, mGr, 0.03), 0, 1.02, 2.56);
  for (const y of [1.14, 0.90]) put(S, cy(0.025, 0.025, HW * 2 - 0.30, 8, mCr), 0, y, 2.60, 0, 0, Math.PI / 2);
  // Guardabarros delanteros (unen capó con cabina)
  for (const xs of [-1, 1]) put(S, rbx(0.16, 0.50, 0.70, mW, 0.06), xs * (HW - 0.06), 1.06, 1.86);

  // ══════════════════════════════════════════════════════════════════════════
  //  BULL BAR (defensa negra pesada + 2 FAROS AUXILIARES REDONDOS ámbar)
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'bull_bar', 'Bull bar', 'Defensa frontal tubular negra con dos faros auxiliares redondos ámbar (foto real).');
  const rTube = 0.05;
  put(S, cy(rTube, rTube, HW * 2 + 0.06, 8, mK), 0, 0.72, 2.74, 0, 0, Math.PI / 2);  // barra superior
  put(S, cy(rTube, rTube, HW * 2 + 0.02, 8, mK), 0, 0.30, 2.70, 0, 0, Math.PI / 2);  // barra inferior
  for (const xs of [-1, 1]) put(S, cy(rTube, rTube, 0.52, 8, mK), xs * 0.80, 0.51, 2.72); // verticales
  for (const xs of [-1, 1]) put(S, cy(rTube, rTube, 0.46, 8, mK), xs * 0.80, 0.72, 2.55, Math.PI / 2.4, 0, 0); // tirantes al frente
  put(S, rbx(HW * 2 + 0.02, 0.14, 0.16, mTr, 0.05), 0, 0.20, 2.62);  // skid inferior
  // Faros auxiliares REDONDOS montados sobre la barra superior (como foto 1)
  for (const xs of [-1, 1]) {
    put(S, cy(0.04, 0.04, 0.12, 6, mK), xs * 0.40, 0.84, 2.70);                          // soporte a la barra
    put(S, cy(0.10, 0.10, 0.09, 16, mK), xs * 0.40, 0.96, 2.72, Math.PI / 2, 0, 0);      // carcasa
    put(S, cy(0.085, 0.085, 0.055, 16, mAux), xs * 0.40, 0.96, 2.78, Math.PI / 2, 0, 0); // lente ámbar
  }
  // Placa delantera peruana (blanca)
  put(S, bx(0.34, 0.14, 0.02, MineMaterials.plano(0xf2f2ee, { rough: 0.6 })), 0, 0.44, 2.79);

  // ══════════════════════════════════════════════════════════════════════════
  //  TOLVA / BED (más baja que la cabina) + rollbar + equipo
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'tolva', 'Tolva / bed', 'Caja de carga con paredes, piso, rollbar y equipo de trabajo.');
  put(S, rbx(HW * 2 - 0.14, 0.06, 1.86, mK, 0.02), 0, 0.66, -1.90);            // piso
  for (const xs of [-1, 1]) put(S, rbx(0.12, 0.56, 1.90, mW, 0.05), xs * (HW - 0.05), 0.92, -1.88); // paredes
  put(S, rbx(HW * 2 - 0.06, 0.58, 0.10, mW, 0.05), 0, 0.93, -0.98);            // pared frontal (contra cabina)
  put(S, rbx(HW * 2 - 0.04, 0.56, 0.10, mW, 0.05), 0, 0.92, -2.82);            // compuerta trasera
  // Interior tolva (recubrimiento negro)
  put(S, bx(HW * 2 - 0.28, 0.40, 1.70, mTr), 0, 0.90, -1.88);
  // Parachoque trasero tipo step + enganche de remolque
  put(S, rbx(HW * 2 - 0.10, 0.16, 0.22, mTr, 0.05), 0, 0.50, -2.98);
  for (const xs of [-1, 1]) put(S, bx(0.10, 0.14, 0.20, mK), xs * 0.55, 0.52, -2.88); // brackets
  put(S, bx(0.10, 0.08, 0.26, mK), 0, 0.44, -3.06);                             // lengua del enganche
  put(S, cy(0.045, 0.045, 0.09, 8, mCr), 0, 0.52, -3.14);                       // bola de remolque

  // Rollbar / sports bar (arco tubular detrás de la cabina)
  for (const xs of [-1, 1]) put(S, cy(0.05, 0.05, 0.62, 8, mK), xs * (HW - 0.16), 1.22, -1.08);
  put(S, cy(0.05, 0.05, HW * 2 - 0.30, 8, mK), 0, 1.52, -1.08, 0, 0, Math.PI / 2);
  for (const xs of [-1, 1]) put(S, cy(0.045, 0.045, 0.55, 8, mK), xs * (HW - 0.16), 1.20, -1.34, Math.PI / 5, 0, 0); // tirantes traseros

  // Equipo suelto en la tolva (tubo, varillas, cono)
  put(S, cy(0.15, 0.15, 0.72, 10, MineMaterials.plano(0x7a3320, { rough: 0.85 })), -0.30, 0.86, -2.10, 0, 0, Math.PI / 2);
  for (const dz of [0, 0.13]) put(S, cy(0.035, 0.035, 1.15, 6, MineMaterials.plano(0x30302f, { rough: 0.9, metal: 0.3 })), 0.34, 0.80, -1.85 + dz, 0.14, 0, 0);
  put(S, new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.42, 8), MineMaterials.plano(0xff4400, { rough: 0.7 })), 0.48, 0.90, -2.50);

  // ══════════════════════════════════════════════════════════════════════════
  //  FRANJA NEÓN + FRANJAS ROJAS REFLECTIVAS
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'franja_neon', 'Franja neón', 'Franja emisiva amarillo-verde de alta visibilidad a lo largo del vehículo.');
  put(S, bx(HW * 2 + 0.02, 0.10, 2.66, mNe), 0, 0.86, 0.30);   // cabina
  for (const xs of [-1, 1]) put(S, bx(0.02, 0.10, 1.92, mNe), xs * (HW + 0.02), 0.86, -1.88); // tolva

  S = sub(g, 'reflectivos', 'Franjas rojas reflectivas', 'Marcas reflectivas rojas laterales.');
  for (let z = 1.60; z >= -2.60; z -= 0.62) {
    for (const xs of [-1, 1]) put(S, bx(0.012, 0.09, 0.22, mRe), xs * (HW + 0.03), 1.14, z);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LUCES (faros, intermitentes, calaveras, reflectivos traseros)
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'luces', 'Luces', 'Faros delanteros, intermitentes ámbar, calaveras verticales y reflectivos.');
  for (const xs of [-1, 1]) {
    // Faro delantero barrido (carcasa negra + lente + tira de posición), gira hacia el guardabarro
    put(S, rbx(0.40, 0.26, 0.10, mK, 0.03), xs * 0.66, 1.09, 2.50, 0, -xs * 0.14, 0);   // carcasa
    put(S, rbx(0.34, 0.19, 0.06, mFa, 0.02), xs * 0.66, 1.11, 2.55, 0, -xs * 0.14, 0);  // lente
    put(S, rbx(0.30, 0.04, 0.05, MineMaterials.plano(0xffffff, { emissive: 0xbcd0ff, emissiveIntensity: 0.8 }), 0.015), xs * 0.66, 1.00, 2.56, 0, -xs * 0.14, 0); // DRL
    put(S, rbx(0.15, 0.13, 0.06, mTn, 0.02), xs * 0.82, 0.90, 2.52, 0, -xs * 0.18, 0);  // intermitente
    // Calavera vertical estilo Hilux (marco negro + lente rojo + reversa blanca)
    put(S, rbx(0.18, 0.46, 0.07, mK, 0.03), xs * 0.86, 1.02, -2.84);
    put(S, rbx(0.13, 0.34, 0.05, mTl, 0.02), xs * 0.86, 1.06, -2.87);
    put(S, rbx(0.11, 0.08, 0.05, MineMaterials.plano(0xf2f2ee, { rough: 0.3 }), 0.02), xs * 0.86, 0.86, -2.87);
    put(S, bx(0.20, 0.08, 0.012, mRe), xs * 0.60, 0.70, -2.87);        // reflectivo trasero
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  BALIZA ÁMBAR sobre MÁSTIL (foto 2) — giratoria animada
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'baliza', 'Baliza ámbar', 'Baliza giratoria sobre mástil detrás de la cabina.');
  put(S, cy(0.03, 0.035, 1.30, 8, mK), -0.02, 1.75, -1.06);            // mástil
  put(S, bx(0.16, 0.05, 0.16, mK), -0.02, 1.10, -1.06);               // base del mástil sobre la tolva
  const balizaBase = cy(0.10, 0.11, 0.10, 12, mK);
  put(S, balizaBase, -0.02, 2.40, -1.06);                             // cuerpo baliza
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mAm.clone()
  );
  put(S, dome, -0.02, 2.45, -1.06);
  // Reflector interno (da la sensación de giro)
  const reflector = bx(0.02, 0.09, 0.16, MineMaterials.plano(0xffffff, { rough: 0.3, emissive: 0xffaa00, emissiveIntensity: 1.5 }));
  put(S, reflector, -0.02, 2.45, -1.06);

  // ══════════════════════════════════════════════════════════════════════════
  //  PLACA PERUANA trasera (amarilla)
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'placa', 'Placa trasera', 'Placa peruana amarilla.');
  put(S, bx(0.40, 0.15, 0.02, MineMaterials.plano(0xe8cf12, { rough: 0.6 })), 0, 0.66, -2.88);

  // ══════════════════════════════════════════════════════════════════════════
  //  RUEDAS off-road + guardabarros negros abombados (flares)
  //  eje del cilindro → X; cara circular en plano Y-Z (rueda VERTICAL)
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'ruedas', 'Ruedas y guardabarros', 'Llantas off-road ~33" con tacos, rines de 6 rayos, bujes, pernos, válvula y flares negros.');
  const TW = 0.32;   // ancho del neumático
  const ruedas = [];
  for (const [px, pz] of [[-HW, 1.52], [HW, 1.52], [-HW, -1.52], [HW, -1.52]]) {
    const side = px < 0 ? -1 : 1;
    const xo   = px - side * 0.05;   // metida bajo la carrocería (no sobresale)

    // Pozo de rueda oscuro (evita ver "a través") — estático
    put(S, cy(GY + 0.05, GY + 0.05, 0.02, 20, mK), px - side * 0.14, GY, pz, 0, 0, Math.PI / 2);

    // ── RUEDA como GRUPO que gira COMPLETO (antes solo giraba el neumático) ──
    const wheel = new THREE.Group();
    wheel.position.set(xo, GY, pz);
    put(wheel, cy(GY, GY, TW, 26, mRu), 0, 0, 0, 0, 0, Math.PI / 2);                         // neumático
    put(wheel, new THREE.Mesh(new THREE.TorusGeometry(GY * 0.99, 0.05, 6, 26), mTd), 0, 0, 0, 0, Math.PI / 2, 0); // hombro
    // Tacos off-road (banda de rodadura)
    for (let t = 0; t < 16; t++) {
      const a = (t / 16) * Math.PI * 2;
      put(wheel, bx(TW + 0.02, 0.06, 0.12, mTd), 0, Math.sin(a) * (GY + 0.005), Math.cos(a) * (GY + 0.005), a, 0, 0);
    }
    // Rin de disco + buje + 6 rayos + pernos + válvula
    put(wheel, cy(GY * 0.56, GY * 0.56, TW + 0.02, 14, mRi), 0, 0, 0, 0, 0, Math.PI / 2);
    put(wheel, cy(GY * 0.17, GY * 0.17, TW + 0.05, 10, mRiC), 0, 0, 0, 0, 0, Math.PI / 2);
    for (let p = 0; p < 6; p++) {
      const ang = (p / 6) * Math.PI * 2;
      put(wheel, bx(0.055, GY * 0.62, 0.028, mRi), side * (TW / 2 - 0.02), Math.sin(ang) * GY * 0.24, Math.cos(ang) * GY * 0.24, ang, Math.PI / 2, 0);
      put(wheel, cy(0.015, 0.015, 0.04, 6, mK), side * (TW / 2 + 0.01), Math.sin(ang) * GY * 0.38, Math.cos(ang) * GY * 0.38, 0, 0, Math.PI / 2);
    }
    put(wheel, cy(0.014, 0.014, 0.05, 6, mK), side * (TW / 2 + 0.02), GY * 0.44, 0, 0, 0, Math.PI / 2); // válvula
    S.add(wheel);
    ruedas.push(wheel);

    // GUARDABARRO negro abombado (eyebrow): arco de segmentos anchos que TAPA la rueda — estático
    const Rf = GY + 0.12, N = 9;
    for (let k = 0; k <= N; k++) {
      const a = Math.PI * (0.10 + 0.80 * (k / N)); // de ~18° a ~162° sobre la rueda
      put(S, rbx(0.44, 0.10, 0.22, mTr, 0.04),
        px, GY + Math.sin(a) * Rf, pz + Math.cos(a) * Rf,
        (Math.PI / 2 - a), 0, 0);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  EXTINTOR en la tolva (montado junto al rollbar, como foto 2)
  // ══════════════════════════════════════════════════════════════════════════
  S = sub(g, 'extintor', 'Extintor', 'Extintor con tarjeta de inspección montado en la tolva.');
  S.add(crearExtintor({ x: -0.55, y: 0.68, z: -1.30, ry: 0 }));

  // OPERADOR al volante (asiento del conductor, LHD Perú). Conmutable via userData.operador.
  const operador = crearOperador({ rol: 'operador' });
  operador.position.set(-0.44, 1.04, 0.58);
  operador.scale.setScalar(0.72);   // a la escala del interior de la doble cabina
  sub(g, 'cabina', 'Cabina doble').add(operador);
  g.userData.operador = operador;

  g.name = 'camioneta';
  g.userData._speed = 0;
  const dM = dome.material;
  g.userData.tick = (dt, elapsed) => {
    // Baliza: pulso ámbar + reflector giratorio
    const p = 1.4 + Math.abs(Math.sin(elapsed * 5)) * 2.4;
    dM.emissiveIntensity = p;
    reflector.rotation.y += dt * 8;
    // Giro de ruedas proporcional a velocidad (radio GY = 0.55 m)
    const vel = g.userData._speed;
    if (vel !== 0) {
      for (const r of ruedas) r.rotation.x += (vel / GY) * dt;
    }
  };
  // hurt (no kill): el contacto con el vehículo en movimiento GOLPEA pero no es fatal.
  g.userData.hazard = {
    tipo: 'atropello', live: true, warn: 5, hurt: 0.5,
    aviso: 'VEHICULO EN MOVIMIENTO — mantente en la via peatonal y contacto visual con el conductor.',
    reflexion:
      'Fuiste golpeado por una camioneta en movimiento. Respeta siempre las vias peatonales ' +
      'demarcadas, manten contacto visual con el conductor y nunca cruces por delante ' +
      'o detras de un vehiculo en maniobra.'
  };
  return g;
}
