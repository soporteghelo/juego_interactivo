import * as THREE from 'three';
import { texturaMetal, texturaGoma } from '../../world/materials/Texturas.js';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crear as crearExtintor } from '../ssoma/extintor.js';
import { sub } from '../_comun/subelemento.js';
import { marcarEquipo } from './codigo_equipo.js';

/**
 * TELEHANDLER / MANIPULADOR TELESCOPICO — Manitou MT 1030 S (+ variante PAUS 853-S8).
 *
 * Modelado a partir de la flota de servicios de la mina: equipo utilitario de
 * bajo perfil para MANIPULAR CARGA y dar servicio (movilizar materiales, pernos, tuberia,
 * bombas, paletas) y — en su variante PAUS — TRABAJO EN ALTURA / servicio con plataforma.
 *
 *  Variante 'manitou' (default): chasis rigido 4x4, cabina lateral IZQUIERDA, CONTRAPESO
 *    trasero y PLUMA TELESCOPICA lateral derecha que se extiende y eleva un carro con
 *    HORQUILLAS (forks). Rojo Manitou.
 *  Variante 'paus': mismo chasis utilitario, pero en lugar de la pluma lleva una PLATAFORMA
 *    ELEVADORA DE TIJERA con canasta/barandas para trabajo en altura (sostenimiento, servicios).
 *
 * ~2.0 m de ancho, ~2.6-2.9 m de alto (plegado).
 */

export const meta = {
  id: 'telehandler',
  nombre: 'Telehandler Manitou MT 1030 S',
  descripcion: 'Manipulador telescopico de bajo perfil (Manitou MT 1030 S): chasis rigido 4x4, cabina lateral, contrapeso y PLUMA TELESCOPICA con horquillas. Variante PAUS con plataforma elevadora de tijera. Rojo Manitou.'
};

function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cy(rt, rb, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat); }
function tor(r, tube, arc, mat) { return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 14, arc), mat); }
function fender(r, w, arcRad, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 16, 1, true, -arcRad / 2, arcRad), mat); }
function put(grp, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m;
}

let _mats = null;
function thMats() {
  if (_mats) return _mats;
  const metal = texturaMetal(), goma = texturaGoma();
  const paint = (color, rough) => new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.3
  });
  const steel = (color, rough, metalness) => new THREE.MeshStandardMaterial({ color, map: metal, roughness: rough, metalness });
  _mats = {
    rojo:  paint(0xcf1a1a, 0.5),                                                                   // rojo Manitou
    rojoD: paint(0x971010, 0.55),
    gris:  paint(0x50535a, 0.55),                                                                  // gris estructura
    k:     steel(0x24242a, 0.62, 0.55),
    gom:   new THREE.MeshStandardMaterial({ color: 0x0e0e10, map: goma, roughness: 0.97, metalness: 0.0 }),
    ace:   steel(0xa2a2ac, 0.42, 0.62),
    chr:   new THREE.MeshStandardMaterial({ color: 0xd0d5d9, roughness: 0.14, metalness: 0.95 }),
    boom:  paint(0xd8dade, 0.45),                                                                  // pluma gris claro
    cab:   new THREE.MeshStandardMaterial({ color: 0x0e1a26, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.5 }),
    far:   new THREE.MeshStandardMaterial({ color: 0xeef0ff, emissive: 0xeef0ff, emissiveIntensity: 1.8, roughness: 0.08 }),
    tail:  new THREE.MeshStandardMaterial({ color: 0xcc1100, emissive: 0xcc0000, emissiveIntensity: 0.7, roughness: 0.3 }),
    rin:   steel(0x2a2a30, 0.45, 0.6),
    amar:  paint(0xf2c200, 0.5)                                                                    // barandas/canasta amarillas (PAUS)
  };
  return _mats;
}

/**
 * @param {{variante?:'manitou'|'paus'}} opts
 */
export function crear({ variante = 'manitou' } = {}) {
  const g = new THREE.Group();
  const M = thMats();
  const HW = 1.00, GY = 0.55;
  const esPaus = variante === 'paus';

  // ── CHASIS RIGIDO 4x4 ──────────────────────────────────────────────
  let S = sub(g, 'chasis', 'Chasis rigido 4x4', 'Bastidor rigido de bajo perfil, deposito, escalera de acceso y soporte del brazo/plataforma en el costado derecho.');
  put(S, bx(HW * 2, 0.34, 4.10, M.k), 0, 0.38, 0);
  // Barro/polvo caked en los bajos (md: nada "de fabrica" limpio). Material COMPARTIDO.
  put(S, bx(HW * 2 + 0.03, 0.18, 3.80, MineMaterials.barroBajos()), 0, 0.27, 0);
  put(S, bx(HW * 2 - 0.06, 0.16, 0.18, M.k), 0, 0.42, 2.02);           // paragolpes
  put(S, bx(HW * 2 - 0.06, 0.16, 0.18, M.k), 0, 0.42, -2.02);
  put(S, bx(1.9, 0.5, 1.2, M.rojo), 0, 0.75, -0.2);                    // capot central/deposito
  for (const [sy, sz] of [[0.45, 1.20], [0.85, 1.06]]) put(S, bx(0.28, 0.05, 0.14, M.ace), -(HW - 0.02), sy, sz);

  // ── CABINA LATERAL IZQUIERDA ───────────────────────────────────────
  S = sub(g, 'cabina', 'Cabina lateral', 'Cabina cerrada FOPS/ROPS en el costado izquierdo con parabrisas amplio, asiento, volante y joystick del brazo.');
  const CX = -0.42, CZ = 0.55, CW = 1.02, CD = 1.55;
  put(S, bx(CW, 1.28, CD, M.rojo), CX, 1.35, CZ);                      // cuerpo de la cabina
  put(S, bx(CW + 0.08, 0.12, CD + 0.08, M.rojoD), CX, 2.02, CZ);      // techo
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(S, bx(0.07, 1.20, 0.07, M.k), CX + sx * (CW / 2 - 0.02), 1.42, CZ + sz * (CD / 2 - 0.02));
  put(S, bx(CW - 0.14, 0.90, 0.04, M.cab), CX, 1.55, CZ + CD / 2 - 0.02);          // parabrisas
  put(S, bx(CW - 0.14, 0.90, 0.04, M.cab), CX, 1.55, CZ - CD / 2 + 0.02);          // luneta
  put(S, bx(0.04, 0.90, CD - 0.16, M.cab), CX - CW / 2 + 0.01, 1.55, CZ);          // ventana izq
  put(S, bx(0.02, 1.10, 1.0, M.rojoD), CX + CW / 2 + 0.01, 1.40, CZ);              // panel derecho (hacia la pluma)
  put(S, bx(0.44, 0.12, 0.42, M.k), CX, 1.20, CZ - 0.10);                          // asiento
  put(S, bx(0.44, 0.46, 0.10, M.k), CX, 1.46, CZ - 0.28);
  put(S, cy(0.14, 0.14, 0.04, 16, M.k), CX, 1.42, CZ + 0.42, Math.PI / 2 - 0.5);   // volante

  // ── CONTRAPESO TRASERO ─────────────────────────────────────────────
  S = sub(g, 'contrapeso', 'Contrapeso trasero', 'Bloque de contrapeso fundido en la cola para equilibrar la carga elevada.');
  put(S, bx(HW * 2 - 0.1, 0.90, 0.70, M.gris), 0, 0.90, -1.85);
  put(S, bx(HW * 2 - 0.3, 0.30, 0.20, M.k), 0, 1.20, -2.22);          // nervios
  put(S, tor(0.10, 0.02, Math.PI * 2, M.ace), 0, 1.30, -2.22, Math.PI / 2); // argolla de izaje

  // ── NEUMATICOS (4, grandes de terreno) ─────────────────────────────
  S = sub(g, 'neumaticos', 'Neumaticos', '4 neumaticos grandes de terreno con banda gruesa, rines y guardabarros.');
  for (const [px, pz] of [[-HW, 1.25], [HW, 1.25], [-HW, -1.25], [HW, -1.25]]) {
    const side = px < 0 ? -1 : 1, xo = px + side * 0.14;
    put(S, cy(0.58, 0.58, 0.40, 18, M.gom), xo, GY, pz, 0, 0, Math.PI / 2);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2, taco = bx(0.42, 0.06, 0.14, M.k);
      taco.position.set(xo, GY + Math.sin(a) * 0.585, pz + Math.cos(a) * 0.585);
      taco.rotation.x = a; S.add(taco);
    }
    put(S, cy(0.28, 0.28, 0.42, 12, M.rin), xo, GY, pz, 0, 0, Math.PI / 2);
    put(S, fender(0.72, 0.50, 2.5, M.rojoD), xo, GY, pz, 0, 0, Math.PI / 2);
  }

  if (!esPaus) {
    // ══ VARIANTE MANITOU: PLUMA TELESCOPICA + HORQUILLAS (ESTACIONADA) ══
    // Parqueada de forma realista: pluma bajada y horquillas APOYADAS EN EL PISO al frente.
    S = sub(g, 'pluma_telescopica', 'Pluma telescopica',
      'Pluma telescopica de 3 secciones montada en el costado derecho; pivota en la cola y baja hacia el frente. Estacionada con las horquillas apoyadas en el suelo. Cilindro de elevacion, cilindro de inclinacion del carro y mangueras.');
    put(S, bx(0.30, 0.46, 0.50, M.k), 0.52, 1.42, -1.75);              // torreta/pivote trasero de la pluma
    put(S, cy(0.07, 0.07, 0.40, 10, M.chr), 0.52, 1.42, -1.75, 0, 0, Math.PI / 2); // pasador de pivote
    const B = new THREE.Group();
    B.position.set(0.52, 1.45, -1.75);
    const angB = 0.205;   // pluma bajada hacia el frente (parqueo)
    // 3 secciones telescopicas encajadas (anchos y altos decrecientes)
    put(B, bx(0.40, 0.44, 3.00, M.boom), 0, 0, 1.45);                 // seccion exterior
    put(B, bx(0.32, 0.36, 2.40, M.gris), 0, 0.005, 3.10);            // seccion media
    put(B, bx(0.26, 0.30, 1.80, M.boom), 0, 0.01, 4.35);            // seccion interior (extendida)
    put(B, bx(0.42, 0.06, 3.0, M.k), 0, 0.25, 1.45);                // patin de deslizamiento superior
    // Cilindro de elevacion (bajo la pluma, del chasis a la seccion base)
    put(B, cy(0.09, 0.09, 1.30, 10, M.rojoD), -0.02, -0.34, 0.95, Math.PI / 2 - 0.28);
    put(B, cy(0.055, 0.055, 1.20, 8, M.chr), 0.0, -0.22, 2.05, Math.PI / 2 - 0.28);
    // Mangueras hidraulicas a lo largo de la pluma (par)
    for (const hx of [-0.16, 0.16]) put(B, cy(0.02, 0.02, 5.0, 6, M.k), hx, 0.16, 2.7, Math.PI / 2);
    // Carro portahorquillas al frente (contrarrota para dejar las uñas HORIZONTALES sobre el piso)
    const carro = new THREE.Group();
    carro.position.set(0, 0, 5.15);
    carro.rotation.x = -angB;
    put(carro, cy(0.05, 0.05, 0.44, 8, M.chr), 0, 0.34, 0, 0, 0, Math.PI / 2); // cilindro de inclinacion
    put(carro, bx(0.90, 0.78, 0.10, M.k), 0, -0.02, 0);               // placa portahorquillas
    put(carro, bx(0.96, 0.10, 0.10, M.k), 0, 0.36, 0.02);            // travesaño superior (gancho)
    put(carro, bx(0.96, 0.10, 0.10, M.k), 0, -0.34, 0.02);          // travesaño inferior
    for (const fx of [-0.30, 0.30]) {                                  // 2 horquillas en L, uñas al piso
      put(carro, bx(0.11, 0.40, 0.10, M.k), fx, -0.14, 0.06);        // talon vertical
      put(carro, bx(0.11, 0.055, 1.15, M.k), fx, -0.36, 0.63);       // uña horizontal (apoyada)
      put(carro, bx(0.11, 0.09, 0.14, M.k), fx, -0.35, 1.16);        // punta biselada
    }
    B.add(carro);
    B.rotation.x = angB;
    S.add(B);

    g.userData.tick = (dt, elapsed) => { _blink(g, elapsed); };       // parqueado: solo baliza
  } else {
    // ══ VARIANTE PAUS: PLATAFORMA ELEVADORA DE TIJERA ════════════════
    meta.nombreVariante = 'PAUS 853-S8 (plataforma)';
    S = sub(g, 'plataforma_tijera', 'Plataforma elevadora de tijera',
      'Plataforma de trabajo en altura con TIJERA pantografica (brazos cruzados pinados) y canasta con barandas, pasamano medio y rodapie. Estacionada elevada a media altura. Se anima un leve ciclo de subida/bajada.');
    // Bancada de la tijera sobre el chasis
    put(S, bx(1.7, 0.16, 1.7, M.k), 0, 1.02, -0.5);
    for (const dz of [-0.7, 0.7]) put(S, bx(1.5, 0.10, 0.14, M.gris), 0, 1.10, -0.5 + dz); // rieles de rodadura
    const P = new THREE.Group();          // conjunto elevable (tijera + canasta)
    P.position.set(0, 1.12, -0.5);

    // TIJERA pantografica: N niveles de brazos CRUZADOS (X), pinados en el centro.
    const NIV = 3;
    const LBRZ = 1.55;    // largo de cada brazo del pantografo (m)
    const tijera = new THREE.Group();
    const nivels = [];
    for (let n = 0; n < NIV; n++) {
      const nivel = new THREE.Group();
      for (const sx of [-0.62, 0.62]) {                                // dos lados (izq/der)
        for (const dir of [1, -1]) {                                   // dos brazos que cruzan (X)
          const brazo = bx(0.06, 0.09, LBRZ, M.rojo);
          brazo.position.set(sx, 0, 0);                                // pinados en el centro del nivel
          brazo.userData.dir = dir;
          nivel.add(brazo);
        }
        put(nivel, cy(0.03, 0.03, 0.16, 6, M.chr), sx, 0, 0, 0, 0, Math.PI / 2); // pasador central del X
      }
      nivel.userData.brazos = nivel.children.filter(c => c.geometry?.type === 'BoxGeometry');
      tijera.add(nivel);
      nivels.push(nivel);
    }
    P.add(tijera);

    // CANASTA abierta: piso + barandas (pasamano superior, pasamano medio y rodapie) + puerta.
    const canasta = new THREE.Group();
    put(canasta, bx(1.75, 0.10, 1.75, M.gris), 0, 0, 0);              // piso rejado
    const lados = [[0, 0.85, 1.75, 0.05], [0, -0.85, 1.75, 0.05], [0.85, 0, 0.05, 1.75], [-0.85, 0, 0.05, 1.75]];
    for (const [dx, dz, w, d] of lados) {
      put(canasta, bx(w, 0.06, d, M.amar), dx, 1.05, dz);            // pasamano superior
      put(canasta, bx(w, 0.05, d, M.amar), dx, 0.60, dz);            // pasamano medio
      put(canasta, bx(w, 0.16, d, M.amar), dx, 0.10, dz);            // rodapie (toe board)
    }
    for (const [px, pz] of [[0.85, 0.85], [-0.85, 0.85], [0.85, -0.85], [-0.85, -0.85]]) // parantes de esquina
      put(canasta, bx(0.06, 1.10, 0.06, M.amar), px, 0.55, pz);
    P.add(canasta);
    S.add(P);

    // Pose parametrica de la tijera para una ALTURA DE PLATAFORMA objetivo H (m).
    // Cada X aporta LBRZ*sin(phi) de altura; los brazos suben su angulo phi al elevarse.
    const poseTijera = (H) => {
      const perNivel = H / NIV;
      const phi = Math.asin(Math.min(0.82, perNivel / LBRZ));          // angulo del brazo desde la horizontal
      for (let n = 0; n < NIV; n++) {
        nivels[n].position.y = n * perNivel;                           // apila cada X sobre el anterior
        for (const b of nivels[n].userData.brazos) b.rotation.x = b.userData.dir * phi;
      }
      canasta.position.y = NIV * perNivel + 0.10;
    };
    poseTijera(1.3);   // estacionada a media altura (~1.3 m de plataforma)

    g.userData.tick = (dt, elapsed) => {
      _blink(g, elapsed);
      poseTijera(1.3 + Math.sin(elapsed * 0.3) * 0.4);                 // leve vaiven de la plataforma
    };
  }

  // ── LUCES (comunes) ────────────────────────────────────────────────
  S = sub(g, 'luces', 'Faros, calaveras y baliza', 'Faros frontales, luces de trabajo del techo, calaveras traseras y baliza ambar animada.');
  for (const xs of [-1, 1]) {
    put(S, cy(0.09, 0.09, 0.09, 16, M.k), xs * 0.72, 0.72, 2.06, Math.PI / 2);
    put(S, cy(0.068, 0.068, 0.02, 16, M.far), xs * 0.72, 0.72, 2.12, Math.PI / 2);
  }
  for (const lx of [-0.7, -0.3]) put(S, cy(0.07, 0.07, 0.05, 14, M.far), lx, 2.06, CZ + CD / 2 + 0.05, Math.PI / 2);
  for (const xs of [-1, 1]) put(S, bx(0.10, 0.16, 0.04, M.tail), xs * (HW - 0.03), 0.90, -2.20);
  // Reflectivos traseros (chevrones rojo/blanco 45°) sobre el contrapeso + mudflaps
  for (let i = -3; i <= 3; i++) put(S, bx(0.19, 0.30, 0.015, (i & 1) ? M.rojoD : M.boom), i * 0.25, 0.62, -2.23, 0, 0, Math.PI / 4);
  for (const xs of [-1, 1]) put(S, bx(0.42, 0.36, 0.02, M.k), xs * (HW - 0.01), 0.30, -1.62);
  const balM = new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8800, emissiveIntensity: 2.5 });
  g.userData._balM = balM;
  const balX = CX + 0.30;
  put(S, cy(0.055, 0.066, 0.05, 12, M.k), balX, 2.09, CZ);
  put(S, cy(0.072, 0.072, 0.11, 14, balM), balX, 2.17, CZ);
  put(S, new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), balM), balX, 2.225, CZ);

  // ── EXTINTOR ───────────────────────────────────────────────────────
  S = sub(g, 'extintor', 'Extintor', 'Extintor con tarjeta de inspeccion (lateral del chasis).');
  S.add(crearExtintor({ x: HW + 0.08, y: 0.55, z: 0.20, ry: Math.PI / 2 }));

  g.name = esPaus ? 'telehandler_paus' : 'telehandler';
  g.userData.hazard = {
    tipo: 'equipoPesado', live: true, warn: 5, hurt: 0.6,
    aviso: 'MANIPULADOR EN OPERACION — carga suspendida / plataforma en movimiento. Mantente a distancia.',
    reflexion:
      'Estuviste demasiado cerca de un manipulador telescopico en operacion. Nunca te ubiques bajo ' +
      'una carga suspendida ni bajo una plataforma en movimiento; respeta el area de maniobra.'
  };
  marcarEquipo(g, { prefijo: 'TH', articulado: false });
  return g;
}

// Parpadeo de la baliza ambar (compartido por ambas variantes).
function _blink(g, elapsed) {
  const balM = g.userData._balM;
  if (balM) balM.emissiveIntensity = 1.5 + Math.abs(Math.sin(elapsed * 4)) * 2.5;
}
