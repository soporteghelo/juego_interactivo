import * as THREE from 'three';
import { MineMaterials, PALETTE } from '../../world/materials/MineMaterials.js';
import { crearPtTag } from '../ssoma/pt_tag.js';
import { sub } from '../_comun/subelemento.js';

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
  const matBlancoOjo = new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.30 });
  const matIris      = new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.40, ...po });
  const matPupila    = new THREE.MeshStandardMaterial({ color: 0x080503, roughness: 0.30, ...po });
  const matBrillo    = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.2, ...po });
  const matParpado   = new THREE.MeshStandardMaterial({ color: 0xcaa079, roughness: 0.90 });
  const matCeja      = new THREE.MeshStandardMaterial({ color: 0x140d04, roughness: 0.85, ...po });
  const matNariz     = new THREE.MeshStandardMaterial({ color: 0xcfa074, roughness: 0.90 });
  const matNostril   = new THREE.MeshStandardMaterial({ color: 0x2e1c10, roughness: 0.90, ...po });
  const matLabio     = new THREE.MeshStandardMaterial({ color: 0xb56a5a, roughness: 0.55 });
  const matBoca      = new THREE.MeshStandardMaterial({ color: 0x5a1a14, roughness: 0.70, ...po });

  const meshes = [];

  // --- Ojos: globo esférico embebido en la cuenca (emerge apenas del cráneo r=0.12) ---
  for (const sx of [-1, 1]) {
    const eX = sx * 0.043;
    const eY = 0.222;   // cabeza-space: 0.200 (centro cráneo) + 0.022
    const eZ = 0.100;   // el globo asoma ~0.006 por delante de la superficie (discreto)

    // Globo ocular: esfera blanca achatada (poco bulto)
    const globo = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 12), matBlancoOjo);
    globo.scale.set(1.0, 0.82, 0.70);
    globo.position.set(eX, eY, eZ);
    meshes.push(globo);

    // Iris (disco marrón mirando al frente, justo delante del globo)
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0105, 14), matIris);
    iris.position.set(eX, eY, eZ + 0.0160);
    meshes.push(iris);

    // Pupila
    const pupila = new THREE.Mesh(new THREE.CircleGeometry(0.0052, 10), matPupila);
    pupila.position.set(eX, eY, eZ + 0.0168);
    meshes.push(pupila);

    // Reflejo especular (catch-light) — da vida a la mirada
    const brillo = new THREE.Mesh(new THREE.CircleGeometry(0.0024, 8), matBrillo);
    brillo.position.set(eX - sx * 0.0035, eY + 0.004, eZ + 0.0176);
    meshes.push(brillo);

    // Párpado superior: fino casquete de piel que perfila el borde alto del globo
    const parpado = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      matParpado
    );
    parpado.scale.set(1.0, 0.85, 0.7);
    parpado.position.set(eX, eY + 0.005, eZ - 0.004);
    parpado.rotation.x = -0.38;
    meshes.push(parpado);

    // Ceja — caja delgada inclinada siguiendo la curvatura del cráneo
    const ceja = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.008, 0.006), matCeja);
    ceja.position.set(sx * 0.044, 0.246, 0.103);
    ceja.rotation.z = sx * 0.13;   // interior más alto, exterior más bajo
    ceja.rotation.x = -0.14;       // sigue la curvatura esférica
    meshes.push(ceja);
  }

  // Nariz y boca solo cuando no hay respirador que las tape
  if (!usarRespirador) {
    // --- Nariz: puente + punta + aletas con fosas nasales (perfil discreto) ---
    const puente = new THREE.Mesh(new THREE.BoxGeometry(0.017, 0.06, 0.013), matNariz);
    puente.position.set(0, 0.204, 0.112);
    puente.rotation.x = 0.14;
    meshes.push(puente);

    const punta = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 10, 8), matNariz);
    punta.scale.set(1.05, 0.8, 0.85);
    punta.position.set(0, 0.178, 0.121);
    meshes.push(punta);

    for (const sx of [-1, 1]) {
      const aleta = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), matNariz);
      aleta.scale.set(0.9, 0.8, 0.9);
      aleta.position.set(sx * 0.0135, 0.174, 0.117);
      meshes.push(aleta);

      const fosa = new THREE.Mesh(new THREE.CircleGeometry(0.0032, 8), matNostril);
      fosa.position.set(sx * 0.011, 0.170, 0.123);
      fosa.rotation.x = -1.2;   // mira hacia abajo
      meshes.push(fosa);
    }

    // --- Boca: leve sonrisa. Arcos de torus (comisuras hacia arriba) = labios + línea ---
    // El torus (arc=π) genera un semianillo "∩"; rotation.z=π lo voltea a "∪" (sonrisa).
    const labioSup = new THREE.Mesh(new THREE.TorusGeometry(0.023, 0.0032, 6, 18, Math.PI), matLabio);
    labioSup.position.set(0, 0.155, 0.111);
    labioSup.rotation.z = Math.PI;
    meshes.push(labioSup);

    const linea = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0022, 6, 18, Math.PI), matBoca);
    linea.position.set(0, 0.153, 0.113);
    linea.rotation.z = Math.PI;
    meshes.push(linea);

    const labioInf = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0042, 6, 18, Math.PI), matLabio);
    labioInf.position.set(0, 0.150, 0.112);
    labioInf.rotation.z = Math.PI;
    meshes.push(labioInf);
  }

  return meshes;
}

/**
 * PERFILES ANATÓMICOS de las extremidades (fracciones de longitud → radio, en metros).
 * Cada entrada [t, r]: t=0 en la articulación proximal (hombro/cadera o codo/rodilla),
 * t=1 en la distal. El vientre muscular se modela con un ensanchamiento intermedio,
 * igual que la silueta del modelo humano del ejemplo three/examples webgl_loader_obj.
 */
const PERFIL_BICEPS    = [[0.0, 0.056], [0.16, 0.063], [0.5, 0.052], [0.85, 0.046], [1.0, 0.044]];
const PERFIL_ANTEBRAZO = [[0.0, 0.046], [0.13, 0.049], [0.55, 0.039], [1.0, 0.030]];
const PERFIL_MUSLO     = [[0.0, 0.092], [0.2, 0.097], [0.62, 0.076], [1.0, 0.064]];
const PERFIL_GEMELO    = [[0.0, 0.068], [0.26, 0.079], [0.62, 0.055], [1.0, 0.044]];

/**
 * Convierte un perfil [[t, r], ...] (proximal→distal) en la lista de Vector2 que espera
 * LatheGeometry, con la y creciente (de -largo hasta 0) para que las normales apunten hacia
 * afuera. El vértice t=0 queda en y=0 (articulación superior del segmento).
 */
function perfilAVectores(perfil, largo) {
  const pts = [];
  for (let i = perfil.length - 1; i >= 0; i--) {
    const [t, r] = perfil[i];
    pts.push(new THREE.Vector2(Math.max(r, 0.001), -t * largo));
  }
  return pts;
}

/**
 * Mano con guante: palma, nudillos redondeados, cuatro dedos ligeramente flexionados y
 * pulgar opuesto. Origen en la muñeca (y=0), se extiende hacia abajo/adelante.
 */
function crearMano(mat) {
  const mano = new THREE.Group();

  const palma = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.078, 0.036), mat);
  palma.position.set(0, -0.044, 0.004);
  mano.add(palma);

  const nudillos = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), mat);
  nudillos.scale.set(1.0, 0.5, 0.55);
  nudillos.position.set(0, -0.084, 0.008);
  mano.add(nudillos);

  // Cuatro dedos con flexión leve y yema redondeada
  for (let i = 0; i < 4; i++) {
    const dx = (-1.5 + i) * 0.0185;
    const dedo = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0098, 0.058, 6), mat);
    dedo.position.set(dx, -0.112, 0.012);
    dedo.rotation.x = 0.28;
    mano.add(dedo);
    const yema = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 6, 5), mat);
    yema.position.set(dx, -0.138, 0.026);
    mano.add(yema);
  }

  // Pulgar opuesto (hacia adentro/adelante)
  const pulgar = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.012, 0.05, 6), mat);
  pulgar.position.set(0.04, -0.058, 0.016);
  pulgar.rotation.z = 0.95;
  pulgar.rotation.x = 0.35;
  mano.add(pulgar);

  return mano;
}

/**
 * Bota minera de seguridad: collar en el tobillo, empeine, puntera reforzada redondeada,
 * suela y tacón de jebe. Origen en el tobillo (y=0); la suela queda ~y=-0.12 (pie a ras
 * de piso, dado que el tobillo cae en y≈0.13). Se extiende hacia +z (adelante).
 */
function crearBota(mat) {
  const bota = new THREE.Group();
  const matSuela = MineMaterials.plano(0x0a0a0a, { rough: 0.95 });

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.053, 0.05, 12), mat);
  collar.position.y = -0.02;
  bota.add(collar);

  const empeine = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.08, 0.15), mat);
  empeine.position.set(0, -0.056, 0.048);
  bota.add(empeine);

  const puntera = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), mat);
  puntera.scale.set(0.92, 0.72, 1.05);
  puntera.position.set(0, -0.062, 0.125);
  bota.add(puntera);

  const suela = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.028, 0.24), matSuela);
  suela.position.set(0, -0.10, 0.05);
  bota.add(suela);

  const tacon = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.022, 0.05), matSuela);
  tacon.position.set(0, -0.108, -0.05);
  bota.add(tacon);

  return bota;
}

/**
 * Crea un miembro articulado con segmentos anatómicos (LatheGeometry con vientre muscular)
 * y esfera de articulación. El pivote queda en la articulación superior (hombro o cadera);
 * el segmento distal cuelga de su propio grupo `inferior` (para doblar codo/rodilla).
 *
 * @param {object} p
 * @param {number[][]} p.perfilSup  perfil anatómico del segmento proximal (bíceps/muslo)
 * @param {number[][]} p.perfilInf  perfil anatómico del segmento distal (antebrazo/gemelo)
 * @param {number} p.radioArt       radio de la esfera de codo/rodilla
 * @param {(mat:THREE.Material)=>THREE.Object3D} p.crearExtremo  fábrica de mano o bota
 */
function crearMiembro({
  largoSup, largoInf, perfilSup, perfilInf,
  radioArt, matSup, matInf, matExtremo, crearExtremo
}) {
  const pivote = new THREE.Group();

  // Segmento proximal anatómico (bíceps / muslo)
  const sup = new THREE.Mesh(new THREE.LatheGeometry(perfilAVectores(perfilSup, largoSup), 16), matSup);
  pivote.add(sup);

  // Esfera de articulación (codo / rótula de rodilla)
  const art = new THREE.Mesh(new THREE.SphereGeometry(radioArt, 12, 9), matSup);
  art.position.y = -largoSup;
  pivote.add(art);

  // Segmento distal con pivote propio (para doblar en codo/rodilla)
  const inferior = new THREE.Group();
  inferior.position.y = -largoSup;

  const inf = new THREE.Mesh(new THREE.LatheGeometry(perfilAVectores(perfilInf, largoInf), 16), matInf);
  inferior.add(inf);

  // Extremo: mano con guante o bota mina (con pivote propio para tobillo/muñeca)
  const distal = crearExtremo(matExtremo);
  distal.position.y = -largoInf;
  inferior.add(distal);

  pivote.add(inferior);
  // Articulaciones expuestas para el gait: codo/rodilla (inferior) y muñeca/tobillo (distal).
  pivote.userData.inferior = inferior;
  pivote.userData.distal = distal;
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
  // `S` = grupo del SUBELEMENTO activo (discretización para el visor).
  let S = sub(g, 'torso', 'Torso (coverall)', 'Torso anatómico LatheGeometry + pelvis + deltoides.');
  const torso = new THREE.Mesh(new THREE.LatheGeometry(perfilCuerpo, 14), naranja);
  torso.scale.z = 0.70;
  torso.position.y = yCadera;
  torso.castShadow = true;
  S.add(torso);

  // Pelvis redondeada: cubre la unión piernas-torso
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.195, 10, 8), naranja);
  pelvis.scale.set(1.0, 0.50, 0.68);
  pelvis.position.y = yCadera + 0.02;
  S.add(pelvis);

  // Deltoides: esfera que redondea la unión torso-brazo en cada hombro
  for (const sx of [-1, 1]) {
    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.086, 9, 7), naranja);
    deltoid.scale.set(0.88, 0.82, 0.76);
    deltoid.position.set(sx * 0.205, yHombro - 0.04, 0);
    S.add(deltoid);
  }

  // Chaleco hi-vis realista: PRENDA fluorescente lime sobre el torso + CINTAS
  // retrorreflectivas plateadas (2 horizontales + 2 verticales sobre los hombros),
  // igual que un chaleco de seguridad real. La prenda es una capa Lathe abierta que
  // envuelve el torso; las cintas son bandas plateadas de alta reflectancia.
  if (usarChaleco) {
    S = sub(g, 'chaleco', 'Chaleco hi-vis', 'Prenda fluorescente + cintas retrorreflectivas plateadas.');
    const matVest  = MineMaterials.plano(0xc6e600, { rough: 0.55, emissive: 0x3a4a00, emissiveIntensity: 0.28 });
    const matTape  = MineMaterials.plano(0xd7dde2, { rough: 0.18, metal: 0.35, emissive: 0x2a2f33, emissiveIntensity: 0.25 });

    // Prenda: capa Lathe abierta (mismo perfil que el torso, un pelín más ancho)
    const perfilVest = [
      new THREE.Vector2(0.212, 0.00),  // dobladillo inferior (cadera)
      new THREE.Vector2(0.198, 0.20),  // cintura
      new THREE.Vector2(0.220, 0.40),  // pecho
      new THREE.Vector2(0.208, 0.50),  // hombros
    ];
    const vest = new THREE.Mesh(new THREE.LatheGeometry(perfilVest, 16), matVest);
    vest.scale.z = 0.72;
    vest.position.y = yCadera + 0.10;
    vest.material.side = THREE.DoubleSide;
    S.add(vest);

    // Cintas retrorreflectivas horizontales (torso), envuelven la prenda
    for (const yB of [1.18, 1.40]) {
      const R = 0.223;
      const cinta = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.050, 16, 1, true), matTape);
      cinta.position.y = yB; cinta.scale.z = 0.72;
      cinta.material.side = THREE.DoubleSide;
      S.add(cinta);
    }
    // Cintas verticales sobre los hombros (frente y espalda)
    for (const sz of [1, -1]) {
      for (const sx of [-1, 1]) {
        const cintaV = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.34, 0.020), matTape);
        cintaV.position.set(sx * 0.085, 1.33, sz * 0.135);
        S.add(cintaV);
      }
    }
  }

  // --- Cabeza + cuello + casco + headlamp ---
  const cabeza = new THREE.Group();
  cabeza.position.y = yHombro + 0.05;
  cabeza.userData.baseY = cabeza.position.y; // referencia para el bob vertical del gait

  const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), piel);
  cuello.position.y = 0.05; cabeza.add(cuello);

  const craneo = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 16), piel);
  craneo.position.y = 0.2; cabeza.add(craneo);

  // Mandíbula / mentón: esfera achatada que da forma de rostro (no solo bola).
  const mandibula = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), piel);
  mandibula.scale.set(0.92, 0.72, 0.9);
  mandibula.position.set(0, 0.135, 0.012);
  cabeza.add(mandibula);

  // Orejas a ambos lados del cráneo
  for (const sx of [-1, 1]) {
    const oreja = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), piel);
    oreja.scale.set(0.48, 1.0, 0.72);
    oreja.position.set(sx * 0.118, 0.192, 0.0);
    cabeza.add(oreja);
  }

  const casco = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 16, 0, Math.PI * 2, 0, Math.PI / 2), cascoMat);
  casco.position.y = 0.235; cabeza.add(casco);

  // Cresta con nervaduras (refuerzos longitudinales típicos del casco minero)
  for (const sx of [-1, 0, 1]) {
    const nervadura = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.0075, 6, 14, Math.PI),
      cascoMat
    );
    nervadura.position.set(sx * 0.052, 0.235, 0);
    nervadura.rotation.y = Math.PI / 2;   // arco de frente a nuca
    nervadura.scale.set(1, 1, 1);
    cabeza.add(nervadura);
  }

  // Ala frontal más pronunciada (visera) + ala perimetral
  const ala = new THREE.Mesh(new THREE.CylinderGeometry(0.158, 0.158, 0.018, 16), cascoMat);
  ala.position.set(0, 0.212, 0.02); cabeza.add(ala);
  const visera = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.016, 0.075), cascoMat);
  visera.position.set(0, 0.208, 0.135);
  visera.rotation.x = -0.12;
  cabeza.add(visera);

  // Barbiquejo (correa de mentón) — dos tiras a los lados hacia la mandíbula
  const matCorrea = MineMaterials.plano(0x1a1a1a, { rough: 0.9 });
  for (const sx of [-1, 1]) {
    const correa = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.13, 0.010), matCorrea);
    correa.position.set(sx * 0.115, 0.15, 0.03);
    correa.rotation.z = sx * 0.16;
    cabeza.add(correa);
  }

  // Soporte/bracket de la lámpara en la visera
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.03), matCorrea);
  bracket.position.set(0, 0.238, 0.122); cabeza.add(bracket);

  // Headlamp (foco emisivo frío) con carcasa
  const carcasaLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.045, 0.03, 12), MineMaterials.plano(0x2a2a2a, { rough: 0.5 }));
  carcasaLamp.rotation.x = Math.PI / 2;
  carcasaLamp.position.set(0, 0.242, 0.138); cabeza.add(carcasaLamp);
  const lampara = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 10, 10),
    MineMaterials.plano(PALETTE.headlampFrio, { emissive: PALETTE.headlampFrio, emissiveIntensity: 4 })
  );
  lampara.position.set(0, 0.242, 0.152); cabeza.add(lampara);

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

  S = sub(g, 'cabeza', 'Cabeza, casco y headlamp', 'Cráneo con rostro, casco por rol, headlamp y respirador (si aplica).');
  S.add(cabeza);

  // --- Brazos (pivote en el hombro) ---
  // bíceps → codo | antebrazo → muñeca, con vientre muscular y mano articulada.
  const paramsBrazo = {
    largoSup: 0.30, largoInf: 0.28,
    perfilSup: PERFIL_BICEPS, perfilInf: PERFIL_ANTEBRAZO,
    radioArt: 0.047,
    matSup: naranja, matInf: naranja, matExtremo: guante,
    crearExtremo: crearMano
  };
  S = sub(g, 'brazos', 'Brazos articulados', 'Hombro + codo, con guantes negros.');
  const brazoIzq = crearMiembro(paramsBrazo);
  brazoIzq.position.set(-0.27, yHombro, 0);
  S.add(brazoIzq);

  const brazoDer = crearMiembro(paramsBrazo);
  brazoDer.position.set(0.27, yHombro, 0);
  S.add(brazoDer);

  // Pose de reposo natural: codos con leve flexión y brazos ligeramente separados del torso
  // (una persona nunca está con los brazos totalmente rectos y pegados).
  for (const [b, sx] of [[brazoIzq, -1], [brazoDer, 1]]) {
    b.userData.inferior.rotation.x = -0.28; // antebrazo hacia adelante
    b.rotation.z = sx * 0.10;               // separa el codo del costado
  }

  // --- Piernas (pivote en la cadera) ---
  // muslo → rodilla | gemelo → tobillo, con vientre muscular y bota minera.
  const paramsPierna = {
    largoSup: 0.42, largoInf: 0.40,
    perfilSup: PERFIL_MUSLO, perfilInf: PERFIL_GEMELO,
    radioArt: 0.073,
    matSup: naranja, matInf: naranja, matExtremo: bota,
    crearExtremo: crearBota
  };
  S = sub(g, 'piernas', 'Piernas articuladas', 'Cadera + rodilla, con botas mina negras.');
  const piernaIzq = crearMiembro(paramsPierna);
  piernaIzq.position.set(-0.12, yCadera, 0);
  S.add(piernaIzq);

  const piernaDer = crearMiembro(paramsPierna);
  piernaDer.position.set(0.12, yCadera, 0);
  S.add(piernaDer);

  // Cinturón minero: correa a la cintura + batería de la lámpara en la cadera + cable
  S = sub(g, 'cinturon', 'Cinturón minero', 'Correa + batería de lámpara (cadera) + cable a la lámpara.');
  const matCuero = MineMaterials.plano(0x241a12, { rough: 0.85 });
  const matBat   = MineMaterials.plano(0x161616, { rough: 0.6, metal: 0.2 });
  const correaCint = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.055, 20, 1, true), matCuero);
  correaCint.position.y = yCadera + 0.05; correaCint.scale.z = 0.72;
  correaCint.material.side = THREE.DoubleSide;
  S.add(correaCint);
  // Hebilla
  const hebilla = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, 0.015), MineMaterials.plano(0x8a8a8a, { rough: 0.4, metal: 0.6 }));
  hebilla.position.set(0, yCadera + 0.05, 0.15); S.add(hebilla);
  // Batería de la lámpara (cadera derecha-trasera)
  const bateria = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.09, 0.05), matBat);
  bateria.position.set(0.14, yCadera + 0.02, -0.12); S.add(bateria);
  // Cable espiralado desde la batería subiendo por la espalda hacia la nuca/lámpara
  const curvaCable = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.14, yCadera + 0.06, -0.13),
    new THREE.Vector3(0.10, yCadera + 0.30, -0.16),
    new THREE.Vector3(0.04, yHombro,        -0.15),
    new THREE.Vector3(0.0,  yHombro + 0.18, -0.12)
  ]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curvaCable, 20, 0.007, 6, false), matCuero);
  cable.material = MineMaterials.plano(0x0d0d0d, { rough: 0.7 });
  S.add(cable);

  // PT-TAG (dispositivo de rastreo personal, pecho derecho)
  S = sub(g, 'pt_tag', 'PT-TAG', 'Dispositivo de rastreo personal en el pecho derecho (y=1.30).');
  const bateriaOpts = ['ok', 'ok', 'ok', 'ok', 'baja'];
  const tag = crearPtTag({ bateria: bateriaOpts[Math.floor(Math.random() * bateriaOpts.length)] });
  tag.position.set(0.20, 1.30, 0.14);
  S.add(tag);

  // Autorescatador (dispositivo de auto-rescate en cinturon, cadera derecha)
  if (usarAutorescatador) {
    S = sub(g, 'autorescatador', 'Autorescatador', 'Dispositivo de auto-rescate en el cinturón (cadera derecha).');
    const matAr   = MineMaterials.plano(0x111111, { rough: 0.85 });
    const matClip = MineMaterials.plano(0x666666, { rough: 0.5 });
    const cuerpoAr = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.05), matAr);
    cuerpoAr.position.set(0.24, 0.82, 0.0);
    S.add(cuerpoAr);
    const clipAr = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.055), matClip);
    clipAr.position.set(0.24, 0.96, 0.0);
    S.add(clipAr);
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
 * Aplica un CICLO DE MARCHA biomecánico (no un péndulo rígido). Inspirado en la
 * locomoción de clips de Mixamo que el ejemplo three.js webgpu_animation_retargeting_readyplayer
 * retargetea sobre un avatar realista: cada pierna alterna fase de APOYO (stance, rodilla casi
 * recta, el cuerpo pasa sobre el pie) y fase de BALANCEO (swing, rodilla muy flexionada para
 * librar el suelo). Los brazos contra-balancean en diagonal con el codo flexionado, el tobillo
 * nivela la planta y el torso oscila/rota suavemente con la zancada.
 *
 * Convención de signos (three.js, miembro colgando en -y):
 *   rotation.x > 0  → el extremo va hacia ATRÁS (-z);  < 0 → hacia ADELANTE (+z).
 *
 * @param {THREE.Group} persona  resultado de crear()
 * @param {number} fase   ángulo de la marcha (avanza con el tiempo); una zancada = 2π
 * @param {number} amplitud  amplitud del paso (0.6 caminar, ~0.06 idle, ~0.8 correr)
 */
export function animarMarcha(persona, fase, amplitud = 0.6) {
  const p = persona.userData.partes;
  if (!p) return;

  // La flexión de rodilla/codo escala con la amplitud (idle ≈ recto; correr ≈ máxima).
  const k = Math.min(amplitud / 0.6, 1.25);

  // --- Piernas: apoyo/balanceo con flexión de rodilla y nivelación de tobillo ---
  const pierna = (limb, theta) => {
    const muslo = Math.sin(theta) * amplitud;              // cadera: adelante/atrás
    // Rodilla: solo flexiona durante el BALANCEO (theta∈(π/2,3π/2)); recta en apoyo.
    const rodilla = Math.max(0, -Math.cos(theta)) * 1.35 * k;
    // Tobillo: mantiene la planta ~paralela al suelo y añade despegue de punta.
    const tobillo = -muslo * 0.45 - rodilla * 0.5 + Math.max(0, Math.sin(theta)) * 0.25 * k;
    limb.rotation.x = muslo;
    limb.userData.inferior.rotation.x = rodilla;
    limb.userData.distal.rotation.x = tobillo;
  };
  pierna(p.piernaIzq, fase);
  pierna(p.piernaDer, fase + Math.PI);

  // --- Brazos: contra-balanceo diagonal (opuesto a la pierna del mismo lado) + codo flexionado ---
  const brazo = (limb, theta, sx) => {
    const hombro = -Math.sin(theta) * amplitud * 0.72;     // opuesto a su pierna
    // Codo: flexión base + se cierra más cuando el brazo va hacia adelante.
    const codo = -(0.30 + 0.22 * k) - Math.max(0, -Math.sin(theta)) * 0.35 * k;
    limb.rotation.x = hombro;
    limb.rotation.z = sx * 0.10;
    limb.userData.inferior.rotation.x = codo;
  };
  brazo(p.brazoIzq, fase, -1);          // brazo izq empareja con pierna izq (misma fase → contrario)
  brazo(p.brazoDer, fase + Math.PI, 1);

  // --- Torso y cabeza: oscilación vertical (2×/zancada) y ligera rotación de columna ---
  const bob = Math.abs(Math.cos(fase)) * 0.022 * k;        // sube en cada apoyo medio
  const sway = Math.sin(fase) * 0.05 * k;                  // balanceo lateral de hombros
  if (p.cabeza) {
    p.cabeza.rotation.z = -sway * 0.4;                     // la cabeza se estabiliza (contrario)
    p.cabeza.position.y = p.cabeza.userData.baseY - bob * 0.3;
  }
}
