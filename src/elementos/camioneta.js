import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';
import { crear as crearExtintor } from './extintor.js';

/**
 * CAMIONETA HILUX MINERA (doble cabina) — Toyota Hilux de operaciones AESA.
 *
 * Proporciones reales (escala 1:1):
 *  - Largo total: ~5.80 m  |  Ancho: 2.10 m  |  Alto: 1.95 m aprox. con llanta
 *  - Llanta grande off-road: radio 0.55 m (diámetro 1.10 m ≈ 43")
 *  - Altura de eje: 0.55 m → buen clearance para carretera minera
 *  - Cabina DOBLE (4 puertas) con altura interior suficiente para EPP
 */

export const meta = {
  id: 'camioneta',
  nombre: 'Camioneta Hilux minera',
  descripcion: 'Pickup 4×4 doble cabina AESA. Blanca polvoriento, franja neon amarilla, bull bar, baliza ambar, tolva con equipo.'
};

// ─── helpers ───────────────────────────────────────────────────────────────
function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cy(rt, rb, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat); }
function put(g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
}

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();

  // ── MATERIALES ──────────────────────────────────────────────────────────
  const mW  = MineMaterials.plano(0xe0ddd5, { rough: 0.88, metal: 0.05 }); // blanco polvoriento
  const mD  = MineMaterials.plano(0xcac7bc, { rough: 0.95, metal: 0.02 }); // blanco más sucio
  const mK  = MineMaterials.plano(0x18181a, { rough: 0.80, metal: 0.35 }); // negro estructura
  const mNe = new THREE.MeshStandardMaterial({                               // franja neon amarilla
    color: 0xd4ff00, emissive: 0x88cc00, emissiveIntensity: 0.55, roughness: 0.5
  });
  const mGl = new THREE.MeshStandardMaterial({                               // vidrio oscuro
    color: 0x152535, roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.75
  });
  const mRu = MineMaterials.plano(0x111114, { rough: 0.98 });               // goma rueda
  const mRi = MineMaterials.plano(0x606068, { rough: 0.55, metal: 0.55 }); // llanta metálica
  const mRiC= MineMaterials.plano(0x888890, { rough: 0.40, metal: 0.80 }); // buje cromo
  const mCr = MineMaterials.plano(0x8a8a8c, { rough: 0.35, metal: 0.8  }); // cromo estribo
  const mRe = new THREE.MeshStandardMaterial({                               // reflectivo rojo
    color: 0xdd1100, emissive: 0xcc0000, emissiveIntensity: 0.6, roughness: 0.3
  });
  const mAm = new THREE.MeshStandardMaterial({                               // ambar baliza
    color: 0xff8800, emissive: 0xff8800, emissiveIntensity: 2.5
  });
  const mLd = new THREE.MeshStandardMaterial({                               // LED aux amarillo
    color: 0xffee44, emissive: 0xffcc00, emissiveIntensity: 3.0
  });
  const mFa = new THREE.MeshStandardMaterial({                               // faro blanco
    color: 0xeef0ff, emissive: 0xeef0ff, emissiveIntensity: 1.2, roughness: 0.08
  });
  const mTl = new THREE.MeshStandardMaterial({                               // calavera roja
    color: 0xcc1100, emissive: 0xcc0000, emissiveIntensity: 0.7, roughness: 0.25
  });

  // ── DIMENSIONES PRINCIPALES ─────────────────────────────────────────────
  const HW = 1.05;   // semi-ancho (total 2.10 m)
  const GY = 0.55;   // centro de rueda = radio de llanta (55 cm ≈ llanta 43" off-road)

  // ── GRUPO DE CARROCERIA (escala Y×2 para doble altura) ──────────
  // Las ruedas quedan en el grupo raiz (g) sin escalar.
  const body = new THREE.Group();

  // ══════════════════════════════════════════════════════════════════
  //  CHASIS (bastidor)
  // ══════════════════════════════════════════════════════════════════
  put(body, bx(HW * 2 - 0.14, 0.28, 5.50, mK), 0, 0.40, -0.10);

  // ══════════════════════════════════════════════════════════════════
  //  CAPOT + FASCIA FRONTAL
  // ══════════════════════════════════════════════════════════════════
  put(body, bx(HW * 2, 0.16, 1.35, mW), 0, 0.94, 1.68);          // capot
  put(body, bx(HW * 2, 0.14, 0.08, mW), 0, 0.82, 2.45);          // labio capot
  put(body, bx(HW * 2, 0.70, 0.22, mD), 0, 0.56, 2.42);          // grille/fascia frontal

  // ══════════════════════════════════════════════════════════════════
  //  BULL BAR (negro pesado con LED aux cuadrados)
  // ══════════════════════════════════════════════════════════════════
  put(body, bx(HW * 2 + 0.16, 0.10, 0.10, mK), 0, 0.70, 2.70);  // barra H
  for (const xs of [-1, 1]) put(body, bx(0.08, 0.58, 0.08, mK), xs * 0.82, 0.36, 2.64); // patas
  put(body, bx(HW * 2 + 0.10, 0.09, 0.09, mK), 0, 0.18, 2.65);  // barra inferior
  for (const xs of [-1, 1]) {
    put(body, bx(0.07, 0.07, 0.38, mK), xs * 0.62, 0.45, 2.62, xs * 0.32, 0, 0);
  }
  put(body, bx(HW * 2 + 0.08, 0.16, 0.28, mK), 0, 0.24, 2.50);  // bumper inferior
  // LED aux cuadrados sobre bull bar
  for (const xs of [-1, 1]) {
    put(body, bx(0.30, 0.30, 0.08, mK),  xs * 0.73, 0.72, 2.67); // carcasa
    put(body, bx(0.25, 0.25, 0.10, mLd), xs * 0.73, 0.72, 2.73); // LED
  }

  // ══════════════════════════════════════════════════════════════════
  //  CABINA DOBLE (4 puertas)
  // ══════════════════════════════════════════════════════════════════
  put(body, bx(HW * 2, 1.10, 3.20, mW), 0, 0.96, 0.55);          // cuerpo cabina
  put(body, bx(HW * 2 - 0.06, 0.12, 2.85, mD), 0, 1.52, 0.50);  // techo

  // ── FRANJA NEON AMARILLA ──────────────────────────────────────────
  put(body, bx(HW * 2 + 0.02, 0.17, 5.60, mNe), 0, 0.80, -0.08);

  // Parabrisas (inclinado — rx pasado como argumento para no ser sobreescrito)
  put(body, bx(HW * 2 - 0.16, 0.70, 0.08, mGl), 0, 1.21, 2.20, -0.30, 0, 0);
  // Luneta trasera
  put(body, bx(HW * 2 - 0.16, 0.48, 0.07, mGl), 0, 1.16, -1.00);
  // Ventanas laterales
  for (const xs of [-1, 1]) {
    put(body, bx(0.06, 0.50, 0.85, mGl), xs * (HW + 0.02), 1.18, 1.44);
    put(body, bx(0.06, 0.48, 0.80, mGl), xs * (HW + 0.02), 1.16, 0.25);
  }
  // Separacion de puerta
  for (const z of [0.70, -0.15]) put(body, bx(HW * 2 + 0.02, 1.00, 0.028, mK), 0, 0.96, z);
  // Espejos laterales
  for (const xs of [-1, 1]) put(body, bx(0.07, 0.10, 0.16, mK), xs * (HW + 0.10), 1.28, 2.08);
  // Manijas
  for (const xs of [-1, 1]) for (const z of [1.28, 0.10]) put(body, bx(0.025, 0.045, 0.16, mCr), xs * (HW + 0.01), 1.04, z);
  // Estribos / running boards
  for (const xs of [-1, 1]) put(body, bx(0.10, 0.045, 2.50, mCr), xs * (HW + 0.06), 0.32, 0.45);

  // ── FRANJAS ROJAS REFLECTIVAS ──────────────────────────────────
  for (let z = 1.85; z >= -1.65; z -= 0.60) {
    for (const xs of [-1, 1]) put(body, bx(0.012, 0.08, 0.18, mRe), xs * (HW + 0.006), 0.66, z);
  }

  // ══════════════════════════════════════════════════════════════════
  //  TOLVA / BED
  // ══════════════════════════════════════════════════════════════════
  put(body, bx(HW * 2 - 0.10, 0.08, 1.90, mK), 0, 0.62, -1.85);  // piso tolva
  for (const xs of [-1, 1]) put(body, bx(0.07, 0.48, 1.90, mD), xs * (HW - 0.04), 0.92, -1.85);
  put(body, bx(HW * 2 - 0.05, 0.48, 0.07, mD), 0, 0.92, -0.88);  // frente tolva
  put(body, bx(HW * 2 - 0.05, 0.48, 0.07, mD), 0, 0.92, -2.78);  // compuerta trasera

  // Rollbar (arco de la tolva) — rz pasado como arg
  for (const xs of [-1, 1]) put(body, cy(0.045, 0.045, 0.65, 6, mK), xs * (HW - 0.12), 1.16, -0.98);
  put(body, cy(0.045, 0.045, HW * 2 - 0.22, 6, mK), 0, 1.49, -0.98, 0, 0, Math.PI / 2);

  // Equipo en tolva
  put(body, cy(0.16, 0.16, 0.70, 10, MineMaterials.plano(0x883322, { rough: 0.85 })), -0.32, 0.96, -1.85, 0, 0, Math.PI / 2);
  for (const dz of [0, 0.14]) {
    put(body, cy(0.04, 0.04, 1.20, 6, MineMaterials.plano(0x333333, { rough: 0.9, metal: 0.3 })), 0.32, 1.00, -1.60 + dz, 0.12, 0, 0);
  }
  put(body, new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.42, 6), MineMaterials.plano(0xff4400, { rough: 0.7 })), 0.46, 0.96, -2.40);

  // ══════════════════════════════════════════════════════════════════
  //  LUCES (en carroceria — escalan con el body)
  // ══════════════════════════════════════════════════════════════════
  for (const xs of [-1, 1]) {
    put(body, bx(0.32, 0.18, 0.07, mFa), xs * 0.68, 0.94, 2.60);
    put(body, bx(0.16, 0.16, 0.06, mLd), xs * 0.68, 0.60, 2.68);
    put(body, bx(0.25, 0.22, 0.045, mTl), xs * 0.64, 0.96, -2.78);
    put(body, bx(0.18, 0.07, 0.012, mRe), xs * 0.58, 0.76, -2.79);
  }

  // ══════════════════════════════════════════════════════════════════
  //  BALIZA AMBAR (giratoria animada en rollbar)
  // ══════════════════════════════════════════════════════════════════
  put(body, cy(0.045, 0.045, 0.30, 6, mK), 0, 1.56, -0.98);
  const baliza = cy(0.11, 0.10, 0.16, 10, mAm.clone());
  put(body, baliza, 0, 1.79, -0.98);
  const domeAmb = mAm.clone();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), domeAmb
  );
  put(body, dome, 0, 1.88, -0.98);

  // ══════════════════════════════════════════════════════════════════
  //  PLACA PERUANA (amarilla trasera)
  // ══════════════════════════════════════════════════════════════════
  put(body, bx(0.40, 0.15, 0.028, MineMaterials.plano(0xddcc00, { rough: 0.6 })), 0, 0.82, -2.82);

  // ── Escala el cuerpo al doble de altura y lo agrega al vehiculo ──
  body.scale.y = 2;
  g.add(body);

  // ══════════════════════════════════════════════════════════════════
  //  RUEDAS — CORRECCION: rz = π/2 se pasa como argumento a put()
  //  (antes se asignaba antes de put() y era sobreescrito por rotation.set)
  //  eje del cilindro → X (eje de la rueda), cara circular → plano Y-Z (VERTICAL)
  // ══════════════════════════════════════════════════════════════════
  const ruedas = [];
  for (const [px, pz] of [[-HW, 1.52], [HW, 1.52], [-HW, -1.45], [HW, -1.45]]) {
    const side = px < 0 ? -1 : 1;
    const xo   = px + side * 0.18;

    const tire = cy(GY, GY, 0.38, 20, mRu);
    put(g, tire, xo, GY, pz, 0, 0, Math.PI / 2);
    ruedas.push(tire);

    const sidewall = new THREE.Mesh(new THREE.TorusGeometry(GY * 0.78, GY * 0.22, 8, 20), mRu);
    put(g, sidewall, xo + side * 0.19, GY, pz, 0, Math.PI / 2, 0);

    const rim = cy(GY * 0.50, GY * 0.50, 0.39, 10, mRi);
    put(g, rim, xo, GY, pz, 0, 0, Math.PI / 2);

    const buje = cy(GY * 0.18, GY * 0.18, 0.40, 8, mRiC);
    put(g, buje, xo, GY, pz, 0, 0, Math.PI / 2);

    for (let p = 0; p < 5; p++) {
      const ang = (p / 5) * Math.PI * 2;
      put(g, cy(0.018, 0.018, 0.042, 5, mK),
        xo + side * 0.195,
        GY + Math.sin(ang) * GY * 0.32,
        pz + Math.cos(ang) * GY * 0.32,
        0, 0, Math.PI / 2
      );
    }

    // Arco de rueda y guardabarro (sin escalar — van con las ruedas)
    put(g, bx(0.06, 0.30, 0.80, mD), px < 0 ? -HW : HW, GY + 0.42, pz);
    put(g, bx(0.025, 0.34, 0.32, mK), px, GY - 0.14, pz - (pz > 0 ? 0.58 : -0.58));
  }

  // ══════════════════════════════════════════════════════════════════
  //  EXTINTOR (lateral derecho)
  // ══════════════════════════════════════════════════════════════════
  // Extintor con tarjeta de inspeccion (lado derecho, zona de rodabarro trasero)
  g.add(crearExtintor({ x: HW + 0.10, y: 0.66, z: -0.70, ry: Math.PI / 2 }));

  g.name = 'camioneta';
  g.userData._speed = 0;
  const bM = baliza.material, dM = dome.material;
  g.userData.tick = (dt, elapsed) => {
    const p = 1.5 + Math.abs(Math.sin(elapsed * 5)) * 3.0;
    bM.emissiveIntensity = p; dM.emissiveIntensity = p;
    // Giro de ruedas proporcional a velocidad (radio GY = 0.55 m)
    const vel = g.userData._speed;
    if (vel !== 0) {
      for (const r of ruedas) r.rotation.x += (vel / GY) * dt;
    }
  };
  // hurt (no kill): el contacto con el vehiculo en movimiento GOLPEA pero no es fatal.
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
