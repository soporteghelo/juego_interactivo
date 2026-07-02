import * as THREE from 'three';
import { MineMaterials, PALETTE } from '../world/materials/MineMaterials.js';
import { crearPtTag } from './pt_tag.js';

/**
 * PERSONA / MINERO — figura humanoide ARTICULADA con EPP configurable (md).
 * Torso, cabeza, casco (color por rol), headlamp, dos brazos (hombro+codo) y dos piernas
 * (cadera+rodilla), guantes y botas mina negras. Los pies quedan a y=0.
 *
 * Articulaciones expuestas en group.userData.partes para animar (caminar/idle):
 *   { brazoIzq, brazoDer, piernaIzq, piernaDer, cabeza }
 *
 * EPP opcional via param epp:
 *   chaleco        — chaleco reflectivo (banda clara en torso)
 *   respirador     — media mascara con filtros laterales (cubre nariz y boca)
 *   autorescatador — dispositivo de auto-rescate en cinturon (cadera derecha)
 * Cualquier item omitido o true = se coloca; false = no se coloca.
 *
 * Roles y color de casco: operador=amarillo, supervisor=blanco, geomecanica=verde.
 */

export const meta = {
  id: 'persona',
  nombre: 'Persona / minero (EPP)',
  descripcion: 'Trabajador humanoide articulado con EPP: casco, chaleco, respirador, autorescatador, guantes, botas mina.'
};

const CASCO_POR_ROL = {
  operador:    PALETTE.cascoOperario,
  supervisor:  PALETTE.cascoSupervisor,
  geomecanica: PALETTE.cascoGeomecanica,
  ssoma:       0xffffff,
  peaton:      PALETTE.cascoOperario
};

/**
 * Genera rasgos faciales sobre el cráneo esférico (r=0.12, centro en y=0.20 del grupo cabeza).
 * Cada rasgo es una malla plana o pequeña geometría posicionada sobre la superficie de la esfera.
 * Se usa polygonOffset en todos los materiales — misma técnica que DecalGeometry en el ejemplo
 * three/examples/jsm/geometries/DecalGeometry.js para evitar z-fighting sobre superficies curvas.
 *
 * Posiciones calculadas con: z_superficie = sqrt(r² - x² - (y_local)²), r=0.12
 *
 * @param {{usarRespirador:boolean}} opts
 * @returns {THREE.Mesh[]}
 */
function crearRostro({ usarRespirador = false } = {}) {
  const po = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  const matBlancoOjo = new THREE.MeshStandardMaterial({ color: 0xeeeae3, roughness: 0.65, ...po });
  const matIris      = new THREE.MeshStandardMaterial({ color: 0x261504, roughness: 0.55, ...po });
  const matPupila    = new THREE.MeshStandardMaterial({ color: 0x070303, roughness: 0.40, ...po });
  const matCeja      = new THREE.MeshStandardMaterial({ color: 0x140d04, roughness: 0.85, ...po });
  const matNariz     = new THREE.MeshStandardMaterial({ color: 0xbe9070, roughness: 0.90, ...po });
  const matBoca      = new THREE.MeshStandardMaterial({ color: 0x7a2218, roughness: 0.75, ...po });

  const meshes = [];

  // Ojos: x=±0.043, y_local=+0.020 → z_sup ≈ 0.110
  for (const sx of [-1, 1]) {
    const eX = sx * 0.043;
    const eY = 0.220;   // cabeza-space: 0.200 (centro craneo) + 0.020
    const eZ = 0.111;   // ligeramente por delante de la superficie (r=0.12)

    // Blanco del ojo (CircleGeometry enfrenta +z por defecto)
    const ojo = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), matBlancoOjo);
    ojo.position.set(eX, eY, eZ);
    meshes.push(ojo);

    // Iris
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.013, 10), matIris);
    iris.position.set(eX, eY, eZ + 0.0010);
    meshes.push(iris);

    // Pupila
    const pupila = new THREE.Mesh(new THREE.CircleGeometry(0.0065, 8), matPupila);
    pupila.position.set(eX, eY, eZ + 0.0020);
    meshes.push(pupila);

    // Ceja — caja delgada inclinada siguiendo la curvatura del cráneo
    const ceja = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.009, 0.007), matCeja);
    ceja.position.set(sx * 0.044, 0.243, 0.105);
    ceja.rotation.z = sx * 0.14;   // interior más alto, exterior más bajo
    ceja.rotation.x = -0.11;       // sigue la curvatura esférica
    meshes.push(ceja);
  }

  // Nariz y boca solo cuando no hay respirador que las tape
  if (!usarRespirador) {
    // Nariz: pequeña protuberancia achatada sobre la superficie
    // x=0, y_local=-0.010 → z_sup ≈ 0.1196
    const nariz = new THREE.Mesh(new THREE.SphereGeometry(0.013, 7, 5), matNariz);
    nariz.position.set(0, 0.190, 0.122);
    nariz.scale.set(1.1, 0.75, 0.72);
    meshes.push(nariz);

    // Boca: barra horizontal fina (expresión neutra)
    // x=0, y_local=-0.040 → z_sup ≈ 0.113
    const boca = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.007, 0.006), matBoca);
    boca.position.set(0, 0.162, 0.114);
    meshes.push(boca);
  }

  return meshes;
}

/**
 * Crea un miembro articulado con cilindros cónicos y esfera de articulación, siguiendo
 * proporciones anatómicas: más ancho en la articulación proximal, estrecho en la distal.
 * El pivote queda en la articulación superior (hombro o cadera).
 *
 * @param {object} p
 * @param {number} p.radioSupTop  radio en el extremo proximal del segmento superior (bíceps/muslo)
 * @param {number} p.radioSupBot  radio en el extremo distal del segmento superior (justo encima del codo/rodilla)
 * @param {number} p.radioInfTop  radio en la cabeza del segmento inferior (antebrazo/gemelo)
 * @param {number} p.radioInfBot  radio distal (muñeca/tobillo)
 * @param {number} p.radioArt     radio de la esfera de codo/rodilla
 * @param {number} p.extremoW     ancho del extremo (guante/bota)
 * @param {number} p.extremoD     profundidad del extremo
 */
function crearMiembro({
  largoSup, largoInf,
  radioSupTop, radioSupBot,
  radioInfTop, radioInfBot,
  radioArt,
  matSup, matInf, matExtremo,
  extremoAlto, extremoW, extremoD
}) {
  const pivote = new THREE.Group();

  // Segmento proximal cónico (bíceps / muslo)
  const sup = new THREE.Mesh(
    new THREE.CylinderGeometry(radioSupTop, radioSupBot, largoSup, 10, 1),
    matSup
  );
  sup.position.y = -largoSup / 2;
  pivote.add(sup);

  // Esfera de articulación (codo / rótula de rodilla)
  const art = new THREE.Mesh(new THREE.SphereGeometry(radioArt, 9, 7), matSup);
  art.position.y = -largoSup;
  pivote.add(art);

  // Segmento distal con pivote propio (para doblar en codo/rodilla)
  const inferior = new THREE.Group();
  inferior.position.y = -largoSup;

  const inf = new THREE.Mesh(
    new THREE.CylinderGeometry(radioInfTop, radioInfBot, largoInf, 10, 1),
    matInf
  );
  inf.position.y = -largoInf / 2;
  inferior.add(inf);

  // Extremo: guante o bota mina
  const eW = extremoW ?? radioInfBot * 2.6;
  const eD = extremoD ?? radioInfBot * 4.4;
  const extremo = new THREE.Mesh(new THREE.BoxGeometry(eW, extremoAlto, eD), matExtremo);
  extremo.position.set(0, -largoInf - extremoAlto / 2 + 0.02, eD * 0.18);
  inferior.add(extremo);

  pivote.add(inferior);
  pivote.userData.inferior = inferior;
  return pivote;
}

/**
 * @param {{rol?:string, epp?:{chaleco?:boolean,respirador?:boolean,autorescatador?:boolean}}} opts
 * @returns {THREE.Group}
 */
export function crear({ rol = 'operador', epp = {} } = {}) {
  const usarChaleco        = epp.chaleco        !== false;
  const usarRespirador     = epp.respirador     !== false;
  const usarAutorescatador = epp.autorescatador !== false;

  const g = new THREE.Group();

  const naranja  = MineMaterials.plano(PALETTE.eppNaranja, { rough: 0.85 });
  const piel     = MineMaterials.plano(0xd8b48c, { rough: 0.9 });
  const guante   = MineMaterials.plano(0x1b1b1b, { rough: 0.8 });
  const bota     = MineMaterials.plano(0x111111, { rough: 0.8 }); // bota mina (jebe negro)
  const cascoMat = MineMaterials.plano(CASCO_POR_ROL[rol] || PALETTE.cascoOperario, { rough: 0.6 });

  // Proporciones (pies en y=0)
  const yCadera = 0.95;
  const yHombro = 1.5;

  // --- Torso anatómico (coverall naranja) ---
  // LatheGeometry revolve un perfil corporal alrededor del eje Y para obtener la silueta humana:
  // base de cadera → flare de cadera → cintura estrecha → pecho ancho → hombros → cuello.
  // Escalado en Z (0.70) para que el cuerpo sea más ancho de frente que de perfil.
  const perfilCuerpo = [
    new THREE.Vector2(0.095, 0.00),  // base pelvis
    new THREE.Vector2(0.210, 0.07),  // flare de cadera
    new THREE.Vector2(0.188, 0.23),  // cintura (estrechamiento)
    new THREE.Vector2(0.210, 0.44),  // pecho
    new THREE.Vector2(0.198, 0.55),  // hombros
    new THREE.Vector2(0.080, 0.58),  // base del cuello
  ];
  const torso = new THREE.Mesh(new THREE.LatheGeometry(perfilCuerpo, 14), naranja);
  torso.scale.z = 0.70;
  torso.position.y = yCadera;
  torso.castShadow = true;
  g.add(torso);

  // Pelvis redondeada: cubre la unión piernas-torso
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.195, 10, 8), naranja);
  pelvis.scale.set(1.0, 0.50, 0.68);
  pelvis.position.y = yCadera + 0.02;
  g.add(pelvis);

  // Deltoides: esfera que redondea la unión torso-brazo en cada hombro
  for (const sx of [-1, 1]) {
    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.086, 9, 7), naranja);
    deltoid.scale.set(0.88, 0.82, 0.76);
    deltoid.position.set(sx * 0.205, yHombro - 0.04, 0);
    g.add(deltoid);
  }

  // Chaleco reflectivo: dos bandas horizontales lime + tirantes diagonales en X
  if (usarChaleco) {
    const matRefl = MineMaterials.plano(0xd4e800, { rough: 0.32, emissive: 0x556600, emissiveIntensity: 0.35 });
    const R = 0.218; // ajustado al nuevo torso LatheGeometry (cintura ~0.188, pecho ~0.210)
    for (const yB of [1.16, 1.37]) {
      const banda = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.058, 12, 1, true), matRefl);
      banda.position.y = yB; banda.scale.z = 0.70;
      g.add(banda);
    }
    // Tirantes en X (frente y espalda)
    for (const sz of [1, -1]) {
      for (const sx of [1, -1]) {
        const tir = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.60, 0.026), matRefl);
        tir.position.set(0, 1.24, sz * 0.155);
        tir.rotation.z = sx * 0.46;
        g.add(tir);
      }
    }
  }

  // --- Cabeza + cuello + casco + headlamp ---
  const cabeza = new THREE.Group();
  cabeza.position.y = yHombro + 0.05;

  const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), piel);
  cuello.position.y = 0.05; cabeza.add(cuello);

  const craneo = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 16), piel);
  craneo.position.y = 0.2; cabeza.add(craneo);

  const casco = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2), cascoMat);
  casco.position.y = 0.235; cabeza.add(casco);

  const ala = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 12), cascoMat);
  ala.position.set(0, 0.21, 0.03); cabeza.add(ala);

  // Headlamp (esfera emisiva fria al frente del casco)
  const lampara = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 8),
    MineMaterials.plano(PALETTE.headlampFrio, { emissive: PALETTE.headlampFrio, emissiveIntensity: 4 })
  );
  lampara.position.set(0, 0.24, 0.13); cabeza.add(lampara);

  // Respirador de media cara: cuerpo + puente nasal + dos cartuchos filtrantes laterales
  if (usarRespirador) {
    const matMascara = MineMaterials.plano(0x252525, { rough: 0.72 });
    const matFiltro  = MineMaterials.plano(0x404040, { rough: 0.8, metal: 0.15 });
    const matSello   = MineMaterials.plano(0x1a1a1a, { rough: 0.9 });
    // Cuerpo principal (cubre nariz y boca)
    const mascara = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.095, 0.065), matMascara);
    mascara.position.set(0, 0.145, 0.128);
    cabeza.add(mascara);
    // Puente nasal (protrusion superior)
    const puente = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.028), matMascara);
    puente.position.set(0, 0.20, 0.134);
    cabeza.add(puente);
    // Sello de silicona (borde exterior)
    const sello = new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.105, 0.018), matSello);
    sello.position.set(0, 0.145, 0.108);
    cabeza.add(sello);
    // Cartuchos filtrantes (dos cilindros laterales)
    for (const sx of [-1, 1]) {
      const cartucho = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.024, 0.058, 8), matFiltro);
      cartucho.rotation.z = Math.PI / 2;
      cartucho.position.set(sx * 0.082, 0.143, 0.112);
      cabeza.add(cartucho);
      // Tapa del cartucho
      const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.010, 8), matMascara);
      tapa.rotation.z = Math.PI / 2;
      tapa.position.set(sx * (0.082 + 0.034), 0.143, 0.112);
      cabeza.add(tapa);
    }
  }

  // Rasgos faciales (ojos, cejas, nariz, boca) con polygonOffset anti z-fighting
  for (const m of crearRostro({ usarRespirador })) cabeza.add(m);

  g.add(cabeza);

  // --- Brazos (pivote en el hombro) ---
  // bíceps(0.058r) → codo(0.047r) | antebrazo(0.041r) → muñeca(0.033r)
  const paramsBrazo = {
    largoSup: 0.30, largoInf: 0.28,
    radioSupTop: 0.058, radioSupBot: 0.047,
    radioInfTop: 0.041, radioInfBot: 0.033,
    radioArt: 0.048,
    matSup: naranja, matInf: naranja, matExtremo: guante,
    extremoAlto: 0.10, extremoW: 0.090, extremoD: 0.145
  };
  const brazoIzq = crearMiembro(paramsBrazo);
  brazoIzq.position.set(-0.27, yHombro, 0);
  g.add(brazoIzq);

  const brazoDer = crearMiembro(paramsBrazo);
  brazoDer.position.set(0.27, yHombro, 0);
  g.add(brazoDer);

  // --- Piernas (pivote en la cadera) ---
  // muslo(0.088r) → rodilla(0.070r) | gemelo(0.066r) → tobillo(0.047r)
  const paramsPierna = {
    largoSup: 0.42, largoInf: 0.40,
    radioSupTop: 0.088, radioSupBot: 0.070,
    radioInfTop: 0.066, radioInfBot: 0.047,
    radioArt: 0.073,
    matSup: naranja, matInf: naranja, matExtremo: bota,
    extremoAlto: 0.14, extremoW: 0.130, extremoD: 0.210
  };
  const piernaIzq = crearMiembro(paramsPierna);
  piernaIzq.position.set(-0.12, yCadera, 0);
  g.add(piernaIzq);

  const piernaDer = crearMiembro(paramsPierna);
  piernaDer.position.set(0.12, yCadera, 0);
  g.add(piernaDer);

  // PT-TAG (dispositivo de rastreo personal, pecho derecho)
  const bateriaOpts = ['ok', 'ok', 'ok', 'ok', 'baja'];
  const tag = crearPtTag({ bateria: bateriaOpts[Math.floor(Math.random() * bateriaOpts.length)] });
  tag.position.set(0.20, 1.30, 0.14);
  g.add(tag);

  // Autorescatador (dispositivo de auto-rescate en cinturon, cadera derecha)
  if (usarAutorescatador) {
    const matAr   = MineMaterials.plano(0x111111, { rough: 0.85 });
    const matClip = MineMaterials.plano(0x666666, { rough: 0.5 });
    const cuerpoAr = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.05), matAr);
    cuerpoAr.position.set(0.24, 0.82, 0.0);
    g.add(cuerpoAr);
    const clipAr = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.055), matClip);
    clipAr.position.set(0.24, 0.96, 0.0);
    g.add(clipAr);
  }

  g.name = `persona_${rol}`;
  g.userData.partes = { brazoIzq, brazoDer, piernaIzq, piernaDer, cabeza };
  g.userData.epp = { chaleco: usarChaleco, respirador: usarRespirador, autorescatador: usarAutorescatador };

  // Animacion idle por defecto (respiracion/balanceo leve).
  g.userData.tick = (dt, elapsed) => {
    const s = Math.sin(elapsed * 1.5) * 0.04;
    brazoIzq.rotation.x = s; brazoDer.rotation.x = -s;
    tag.userData.tick?.(dt, elapsed);
  };
  return g;
}

/**
 * Aplica una pose de marcha (caminar) a una persona segun una fase.
 * @param {THREE.Group} persona  resultado de crear()
 * @param {number} fase  angulo de la marcha (avanza con el tiempo)
 * @param {number} amplitud  cuanto se balancean los miembros
 */
export function animarMarcha(persona, fase, amplitud = 0.6) {
  const p = persona.userData.partes;
  if (!p) return;
  const sw = Math.sin(fase) * amplitud;
  p.piernaIzq.rotation.x = sw;
  p.piernaDer.rotation.x = -sw;
  p.brazoIzq.rotation.x = -sw * 0.8;
  p.brazoDer.rotation.x = sw * 0.8;
}
