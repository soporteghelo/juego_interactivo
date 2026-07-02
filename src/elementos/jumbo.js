import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';
import { crear as crearExtintor } from './extintor.js';

/**
 * JUMBO DE PERFORACION (drilling jumbo) — equipo pesado de perforacion.
 *
 * Basado en las fotos reales: cuerpo naranja bajo, 4 neumaticos grandes,
 * jaula ROPS, 2 brazos de perforacion articulados con barras de acero,
 * carrete de cable trasero amarillo, mangueras hidraulicas negras.
 * Dimensiones aproximadas: 8m de largo (con brazos), 2.2m de ancho, 2.4m de alto.
 */

export const meta = {
  id: 'jumbo',
  nombre: 'Jumbo de perforacion',
  descripcion: 'Equipo pesado de perforacion de frentes. Dos brazos articulados con barras de acero. Naranja AESA.'
};

function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cy(rt, rb, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat); }
function put(g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
}

export function crear() {
  const g = new THREE.Group();

  // ── MATERIALES ────────────────────────────────────────────────────
  const mNar = MineMaterials.plano(0xd45a00, { rough: 0.7, metal: 0.25 }); // naranja
  const mNarD = MineMaterials.plano(0xb04500, { rough: 0.8, metal: 0.2 }); // naranja oscuro
  const mK   = MineMaterials.plano(0x1a1a1c, { rough: 0.85, metal: 0.3 }); // negro
  const mGom = MineMaterials.plano(0x111113, { rough: 0.98 });              // goma
  const mRi  = MineMaterials.plano(0xd45a00, { rough: 0.5, metal: 0.4 });  // llanta naranja
  const mAce = MineMaterials.plano(0x888898, { rough: 0.35, metal: 0.7 }); // acero barras
  const mAm  = new THREE.MeshStandardMaterial({ color: 0xeecc00, emissive: 0x998800, emissiveIntensity: 0.5, roughness: 0.4 });
  const mMan = MineMaterials.plano(0x1a1a2a, { rough: 0.9, metal: 0.1 });  // manguera
  const mCab = new THREE.MeshStandardMaterial({ color: 0x152535, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.7 });

  const HW = 1.10; // semi-ancho cuerpo
  const GY = 0.50; // centro rueda

  // ══════════════════════════════════════════════════════════════════
  //  CHASIS PRINCIPAL
  // ══════════════════════════════════════════════════════════════════
  put(g, bx(HW * 2, 0.28, 3.50, mK), 0, 0.36, -0.50); // bastidor

  // ── CUERPO TRASERO (motor / hidraulicos) ──────────────────────
  put(g, bx(HW * 2, 1.15, 2.00, mNar),  0, 1.00, -1.20); // bloque motor
  put(g, bx(HW * 2 - 0.1, 0.20, 1.90, mNarD), 0, 1.58, -1.20); // tapa superior
  // Rejillas laterales motor
  for (const xs of [-1, 1]) {
    for (let z = -0.5; z >= -1.9; z -= 0.35) {
      put(g, bx(0.04, 0.55, 0.22, mK), xs * (HW - 0.02), 0.95, z);
    }
  }

  // ── CABINA DEL OPERADOR (ROPS) ────────────────────────────────
  // Asiento / plataforma
  put(g, bx(HW * 2, 0.18, 1.40, mNar), 0, 1.62, 0.45);
  // 4 postes ROPS
  for (const xs of [-1, 1]) {
    for (const zs of [-0.25, 0.55]) {
      put(g, cy(0.05, 0.05, 1.00, 6, mNar), xs * (HW - 0.1), 2.22, zs);
    }
  }
  // Techo ROPS plano
  put(g, bx(HW * 2 + 0.1, 0.08, 1.10, mNar), 0, 2.72, 0.15);
  // Travesanos techo
  for (const xs of [-1, 1]) put(g, bx(0.06, 0.06, 1.10, mK), xs * (HW - 0.1), 2.72, 0.15);
  // Vidrio cabina (frontal)
  put(g, bx(HW * 2 - 0.12, 0.80, 0.05, mCab), 0, 2.2, 0.70);

  // Panel de control frente al operador
  put(g, bx(1.20, 0.50, 0.14, mK), 0, 2.05, 0.55);
  put(g, bx(1.00, 0.30, 0.08, MineMaterials.plano(0x223344, { rough: 0.3, metal: 0.5 })), 0, 2.12, 0.60);

  // ── CARRETE DE CABLE TRASERO (amarillo) ───────────────────────
  const carrete = cy(0.55, 0.55, 0.35, 16, mAm);
  carrete.rotation.z = Math.PI / 2;
  put(g, carrete, 0, 1.00, -2.18);
  put(g, cy(0.60, 0.60, 0.08, 16, mK), 0, 1.00, -2.35); // flange
  put(g, cy(0.60, 0.60, 0.08, 16, mK), 0, 1.00, -2.01); // flange
  put(g, cy(0.20, 0.20, 0.36, 16, mK), 0, 1.00, -2.18); // eje

  // ══════════════════════════════════════════════════════════════════
  //  NEUMATICOS (4 grandes)
  // ══════════════════════════════════════════════════════════════════
  for (const [px, pz] of [[-HW, 0.85], [HW, 0.85], [-HW, -1.65], [HW, -1.65]]) {
    const side = px < 0 ? -1 : 1;
    const xo = px + side * 0.18;
    const tire = cy(0.50, 0.50, 0.32, 14, mGom); tire.rotation.z = Math.PI / 2;
    put(g, tire, xo, GY, pz);
    const rim = cy(0.25, 0.25, 0.33, 8, mRi); rim.rotation.z = Math.PI / 2;
    put(g, rim, xo, GY, pz);
  }

  // ══════════════════════════════════════════════════════════════════
  //  BRAZOS DE PERFORACION (2)
  // ══════════════════════════════════════════════════════════════════
  // Los brazos se articulan hacia adelante y arriba desde el bastidor frontal

  // Soporte de brazos (boom carrier)
  put(g, bx(HW * 2, 0.50, 0.30, mNarD), 0, 1.55, 1.25);
  put(g, bx(0.10, 0.55, 0.14, mK), 0, 1.55, 1.38); // pivote central

  const brazos = [];
  for (const [lado, angV, angH] of [[-0.48, 0.72, -0.18], [0.48, 0.55, 0.15]]) {
    const brazo = new THREE.Group();
    brazo.position.set(lado, 1.60, 1.30);

    // Brazo principal (naranja, angled)
    const mainArm = bx(0.18, 0.18, 1.85, mNar);
    put(brazo, mainArm, 0, 0, 0.92);
    // Brazo secundario
    const secArm = bx(0.14, 0.14, 1.20, mNarD);
    put(brazo, secArm, 0, 0.06, 2.50);
    // Cilindro hidraulico del brazo
    put(brazo, cy(0.07, 0.07, 1.40, 8, mAce), 0, -0.12, 0.80);

    // Riel / feed (barra guia de la barrena)
    const riel = bx(0.14, 0.12, 2.80, mK);
    put(brazo, riel, 0, 0, 2.50);
    // Barra de acero (la que perfora)
    const barra = cy(0.06, 0.06, 2.50, 8, mAce);
    put(brazo, barra, 0, 0, 2.50);
    // Motor de perforacion (caja al final)
    put(brazo, bx(0.28, 0.28, 0.40, mNar), 0, 0, 3.82);

    brazo.rotation.x = -angV;
    brazo.rotation.y = angH;
    g.add(brazo);
    brazos.push(brazo);
  }

  // ── MANGUERAS HIDRAULICAS ────────────────────────────────────
  for (const [xs, dz] of [[-0.5, 0.3], [0.5, -0.2], [0, 0.5]]) {
    const m = cy(0.03, 0.03, 1.80, 6, mMan);
    m.rotation.x = 0.4; m.rotation.z = xs * 0.2;
    put(g, m, xs * 0.60, 1.30, 1.00 + dz);
  }

  // ══════════════════════════════════════════════════════════════════
  //  FAROS FRONTALES
  // ══════════════════════════════════════════════════════════════════
  const mFar = new THREE.MeshStandardMaterial({ color: 0xeef0ff, emissive: 0xeef0ff, emissiveIntensity: 1.8, roughness: 0.08 });
  for (const xs of [-1, 1]) put(g, bx(0.22, 0.16, 0.05, mFar), xs * 0.72, 1.80, 1.35);

  // Baliza ambar en techo ROPS
  const balM = new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff8800, emissiveIntensity: 2.5 });
  const baliza = cy(0.08, 0.08, 0.12, 8, balM.clone());
  put(g, baliza, 0.6, 2.82, 0.10);

  // ══════════════════════════════════════════════════════════════════
  //  TICK + HAZARD
  // ══════════════════════════════════════════════════════════════════
  // Extintor con tarjeta de inspeccion (lateral derecho del cuerpo motor)
  g.add(crearExtintor({ x: HW + 0.10, y: 0.90, z: -1.0, ry: Math.PI / 2 }));

  g.name = 'jumbo';
  const balizaM = baliza.material;
  g.userData.tick = (dt, elapsed) => {
    balizaM.emissiveIntensity = 1.5 + Math.abs(Math.sin(elapsed * 4)) * 2.5;
    // Leve oscilacion de los brazos (simula posicion de perforacion)
    for (const b of brazos) b.rotation.y += Math.sin(elapsed * 0.3) * 0.0004;
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
  return g;
}
