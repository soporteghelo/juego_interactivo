import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '../../world/materials/MineMaterials.js';
import { crear as crearPersonaProcedural, animarMarcha } from './persona.js';
import { crearPtTag } from '../ssoma/pt_tag.js';
import { crearBarretilla } from '../sostenimiento/barretillas.js';

/**
 * MINERO FBX (Mixamo) — reemplaza a la persona procedural por un personaje RIGGED real
 * con animación de esqueleto (caminar / correr / idle), manteniendo los EPP.
 *
 * Modelo: Mixamo "X Bot" (running.fbx, con malla) recoloreado a coverall naranja.
 * Clips:  correr (embebido en running.fbx) + caminar (walk.fbx, sin malla, mismo
 *         esqueleto `mixamorig:` → NO requiere retargeting). Idle = caminar a timeScale bajo.
 *
 * Los EPP (casco por rol, chaleco hi-vis, cinturón) se construyen aparte y SIGUEN a los
 * huesos del esqueleto cada frame (Head / Spine2 / Hips), así se mueven de forma realista
 * con la animación. Sus posiciones se afinan con la tabla EPP_DEFS de abajo.
 *
 * API:
 *   await precargarMinero()               — carga y cachea el FBX (llamar 1 vez al arrancar).
 *   crear({ rol, epp })                   — devuelve un THREE.Group listo para la escena.
 *   actualizar(obj, dt, moviendo, corriendo) — avanza la animación y los EPP cada frame.
 *
 * Si el FBX no cargó (offline / error), crear() cae de vuelta a la persona procedural y
 * actualizar() usa animarMarcha, de modo que el juego NUNCA queda sin personajes.
 */

const CASCO_POR_ROL = {
  operador:    PALETTE.cascoOperario,
  supervisor:  PALETTE.cascoSupervisor,
  geomecanica: PALETTE.cascoGeomecanica,
  ssoma:       0xffffff,
  peaton:      PALETTE.cascoOperario
};

// Velocidad de avance (m/s) a la que cada clip se ve NATURAL con timeScale=1 (calibrado a ojo
// contra el clip Mixamo). La cadencia del clip se escala a la velocidad REAL del NPC para que
// los pies no patinen (footstep sync). Fuera de [0.55, 1.7]× la zancada se ve rara → se acota.
const WALK_CLIP_SPEED = 1.15;
const RUN_CLIP_SPEED  = 3.1;

/**
 * Piezas de EPP que SIGUEN a un hueso.
 *   bone = SUFIJO del nombre del hueso (robusto: FBXLoader quita el ':' de 'mixamorig:X').
 *   pos  = [x, y, z] en CENTÍMETROS, en el espacio LOCAL del hueso.
 *   rot  = [x, y, z] en RADIANES (corrige la orientación de reposo del hueso — ver más abajo).
 *   opt  = clave de `epp` que puede desactivar la pieza (epp[opt] === false → no se coloca).
 *   build(rol) = fábrica de la malla (centrada en el origen del hueso, en metros).
 *
 * Rotaciones correctivas calculadas de la pose de reposo del rig Mixamo:
 *   Pie (Foot) va inclinado 51° → rot [-0.887, 0, π] deja la bota plana y siguiendo el pie.
 *   Espinilla (Leg) tiene +Y hacia abajo → la caña (cilindro simétrico) va con rot [0,0,0].
 */
const EPP_DEFS = [
  { id: 'cara',          bone: 'Head',      pos: [0, 0, 0],  rot: [0, 0, 0],              build: (rol, epp) => crearCara(epp) },
  { id: 'casco',         bone: 'Head',      pos: [0, 9, 2],  rot: [0, 0, 0],              build: (rol) => crearCasco(rol) },
  { id: 'respirador',    bone: 'Head',      pos: [0, -5, 8], rot: [0, 0, 0],              build: () => crearRespirador(),     opt: 'respirador' },
  { id: 'guanteL',       bone: 'LeftHand',  pos: [0, 5, 0],  rot: [0, 0, 0],              build: () => crearGuante() },
  { id: 'guanteR',       bone: 'RightHand', pos: [0, 5, 0],  rot: [0, 0, 0],              build: () => crearGuante() },
  { id: 'chaleco',       bone: 'Spine1',    pos: [0, 3, 1],  rot: [0, 0, 0],              build: () => crearChaleco(),        opt: 'chaleco' },
  { id: 'tag',           bone: 'Spine2',    pos: [-7, 2, 12],rot: [0, 0, 0],              build: () => crearPtTag({ bateria: 'ok' }) },
  { id: 'mangaSupL',     bone: 'LeftArm',   pos: [0, 14, 0], rot: [0, 0, 0],              build: () => crearManga(0.055, 0.072, 0.30, COL_NAVY, { banda: 0.06 }) },
  { id: 'mangaSupR',     bone: 'RightArm',  pos: [0, 14, 0], rot: [0, 0, 0],              build: () => crearManga(0.055, 0.072, 0.30, COL_NAVY, { banda: 0.06 }) },
  { id: 'mangaInfL',     bone: 'LeftForeArm',  pos: [0, 14, 0], rot: [0, 0, 0],           build: () => crearManga(0.042, 0.055, 0.30, COL_NARANJA, { banda: 0.0, puno: COL_NAVY }) },
  { id: 'mangaInfR',     bone: 'RightForeArm', pos: [0, 14, 0], rot: [0, 0, 0],           build: () => crearManga(0.042, 0.055, 0.30, COL_NARANJA, { banda: 0.0, puno: COL_NAVY }) },
  { id: 'pantalonHip',   bone: 'Hips',      pos: [0, -6, 0], rot: [0, 0, 0],              build: () => crearPantalonHip() },
  { id: 'pantalonMusloL',bone: 'LeftUpLeg', pos: [0, 22, 0], rot: [0, 0, 0],              build: () => crearPantalonMuslo() },
  { id: 'pantalonMusloR',bone: 'RightUpLeg',pos: [0, 22, 0], rot: [0, 0, 0],              build: () => crearPantalonMuslo() },
  { id: 'cinturon',      bone: 'Hips',      pos: [0, 2, 0],  rot: [0, 0, 0],              build: () => crearCinturon() },
  { id: 'autorescatador',bone: 'Hips',      pos: [12, -4, 7],rot: [0, 0, 0],              build: () => crearAutorescatador(), opt: 'autorescatador' },
  { id: 'botaCanaL',     bone: 'LeftLeg',   pos: [0, 22, 0], rot: [0, 0, 0],              build: () => crearBotaCana() },
  { id: 'botaCanaR',     bone: 'RightLeg',  pos: [0, 22, 0], rot: [0, 0, 0],              build: () => crearBotaCana() },
  { id: 'botaPieL',      bone: 'LeftFoot',  pos: [0, 0, 0],  rot: [-0.887, 0, Math.PI],   build: () => crearBotaPie() },
  { id: 'botaPieR',      bone: 'RightFoot', pos: [0, 0, 0],  rot: [-0.887, 0, Math.PI],   build: () => crearBotaPie() }
];

// --- Estado de precarga (singleton) ---
let _src = null;        // escena FBX con la SkinnedMesh (fuente para clonar)
let _walkClip = null;   // AnimationClip caminar
let _runClip = null;    // AnimationClip correr
let _cargado = false;
let _fallido = false;
let _promesa = null;

const _loader = new FBXLoader();
const _load = (url) => new Promise((res, rej) => _loader.load(url, res, undefined, rej));

/** Carga y cachea el modelo + clips. Idempotente. */
export function precargarMinero() {
  if (_promesa) return _promesa;
  _promesa = (async () => {
    try {
      const [charFbx, walkFbx] = await Promise.all([
        _load('/models/running.fbx'),
        _load('/models/walk.fbx')
      ]);

      // Recolor de la fuente (los clones comparten materiales → todos coverall naranja)
      charFbx.traverse((o) => {
        if (o.isMesh) {
          o.frustumCulled = false;   // la animación mueve vértices fuera del bounding original
          o.castShadow = false;      // personajes fuera del horneado de sombras (perf + sin blobs pose-T)
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            const isJoint = /joint/i.test(m.name || '');
            // Polo/coverall manga larga: cuerpo y articulaciones en naranja (sin negro robótico).
            m.color = new THREE.Color(isJoint ? 0xb8430c : PALETTE.eppNaranja);
            m.roughness = 0.9; m.metalness = 0.0;
            m.map = null; m.normalMap = null;   // fuera texturas del maniquí
            m.needsUpdate = true;
          });
        }
      });

      _src = charFbx;
      _runClip = charFbx.animations?.[0] || null;
      _walkClip = walkFbx.animations?.[0] || null;
      if (_runClip)  { _runClip.name = 'correr';  neutralizarRootMotion(_runClip); }
      if (_walkClip) { _walkClip.name = 'caminar'; neutralizarRootMotion(_walkClip); }
      _cargado = true;
    } catch (err) {
      console.warn('[minero] No se pudo cargar el FBX; se usa la persona procedural.', err);
      _fallido = true;
    }
  })();
  return _promesa;
}

/** ¿El modelo FBX está disponible? */
export function mineroDisponible() { return _cargado && !!_src; }

/**
 * Quita el desplazamiento HORIZONTAL de la raíz (Hips) del clip, dejando el rebote
 * vertical. Sin esto, las animaciones "con root motion" de Mixamo hacen que el
 * personaje se deslice hacia adelante y "salte" al reiniciar el bucle (el juego ya
 * controla la posición del contenedor, así que la traslación interna sobra).
 */
function neutralizarRootMotion(clip) {
  const t = clip.tracks.find((tr) => /Hips\.position$/i.test(tr.name));
  if (!t) return;
  const x0 = t.values[0], z0 = t.values[2];   // congela X/Z al valor del primer frame
  for (let i = 0; i < t.values.length; i += 3) {
    t.values[i] = x0;
    t.values[i + 2] = z0;
  }
}

// --- Construcción de EPP (centrados en el origen del hueso, en METROS) ---

function matPlano(color, rough = 0.8, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
}

/** Clave visual de un material (para agrupar mallas fusionables que se ven igual). */
function _matKey(m) {
  return [
    m.type, m.color?.getHexString?.() ?? '', m.roughness, m.metalness,
    m.emissive?.getHexString?.() ?? '', m.emissiveIntensity ?? 0,
    m.transparent, m.opacity, m.side, m.map ? m.map.uuid : ''
  ].join('|');
}

/**
 * OPTIMIZACIÓN CLAVE de rendimiento: fusiona todas las mallas de un grupo de EPP que
 * comparten material en UNA sola geometría (BufferGeometryUtils). Un casco/cara/respirador
 * pasa de ~20-30 draw calls a ~4-6. Con 5 personajes esto recorta cientos de draw calls.
 * El grupo conserva su transform (lo mueve el follower), solo cambia su contenido interno.
 */
function fusionarPorMaterial(group) {
  try {
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const mallas = [];
    group.traverse((o) => { if (o.isMesh && o.geometry) mallas.push(o); });
    if (mallas.length <= 1) return;

    const grupos = new Map(); // key -> { mat, geos: [] }
    for (const o of mallas) {
      const key = _matKey(o.material);
      let e = grupos.get(key);
      if (!e) { e = { mat: o.material, geos: [] }; grupos.set(key, e); }
      const g2 = o.geometry.clone();
      // Deja solo atributos comunes (position, normal, uv) para que el merge sea válido.
      for (const attr of Object.keys(g2.attributes)) {
        if (!['position', 'normal', 'uv'].includes(attr)) g2.deleteAttribute(attr);
      }
      if (!g2.attributes.uv && g2.attributes.position) {
        const n = g2.attributes.position.count;
        g2.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      }
      g2.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      e.geos.push(g2);
    }

    for (const o of mallas) o.parent?.remove(o);
    for (const { mat, geos } of grupos.values()) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) { geos.forEach((gg) => group.add(new THREE.Mesh(gg, mat))); continue; }
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = false; mesh.receiveShadow = false;
      group.add(mesh);
    }
  } catch { /* si el merge falla (atributos incompatibles), se deja el grupo original */ }
}

// Colores del uniforme minero (según fotos reales de mina)
const COL_NARANJA = PALETTE.eppNaranja; // mameluco naranja
const COL_NAVY    = 0x1b2740;           // azul marino (hombros, mangas sup, puños)
const COL_MARRON  = 0x6e4a25;           // pantalón/chaps de cuero marrón

/** Cinta retrorreflectiva blanca-plateada (levemente emisiva para el look hi-vis). */
function matRefl() { return matPlano(0xe6eaed, 0.3, { emissive: 0x20242a, emissiveIntensity: 0.4 }); }

/**
 * Casco minero MSA V-Gard (color por rol), realista: casquete GLOSSY (clearcoat) alargado
 * con cresta central + costillas y pico frontal; CAP LAMP con bezel cromado, reflector, lente
 * y LED sobre bracket MSA; OREJERAS 3M Optime redondeadas (copa negra glossy + banda roja +
 * cojín de espuma + deslizador de altura); ratchet trasero (Fas-Trac) y barbiquejo con hebilla.
 * Origen ≈ articulación de la cabeza; frente = +Z.
 */
function crearCasco(rol) {
  const g = new THREE.Group();
  // Cáscara semibrillo tipo plástico (MeshStandard — clearcoat es demasiado caro en móvil)
  const matShell  = matPlano(CASCO_POR_ROL[rol] || PALETTE.cascoOperario, 0.34, { metal: 0.05 });
  const matK      = matPlano(0x141414, 0.4, { metal: 0.1 });   // plástico negro semibrillo
  const matRed    = matPlano(0xc42121, 0.45);                  // banda roja Optime
  const matFoam   = matPlano(0x262626, 0.95);                  // cojín de espuma
  const matChrome = matPlano(0xd6dadf, 0.15, { metal: 0.95 }); // bezel/reflector cromado
  const matLampBody = matPlano(0xbfe6a8, 0.28, { transparent: true, opacity: 0.9 }); // verde translúcido
  const matLens   = matPlano(0xffffff, 0.08, { transparent: true, opacity: 0.35 });

  // Casquete (shell) V-Gard: hemisferio algo alargado adelante-atrás
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.115, 28, 20, 0, Math.PI * 2, 0, Math.PI / 2), matShell);
  shell.scale.set(1.0, 0.97, 1.13); g.add(shell);
  // Faldón del casco (cae un poco por los lados/atrás, estilo cap)
  const borde = new THREE.Mesh(new THREE.CylinderGeometry(0.117, 0.122, 0.032, 28), matShell);
  borde.scale.z = 1.13; borde.position.y = -0.01; g.add(borde);

  // Cresta central prominente + 2 costillas laterales (adelante-atrás)
  for (const [sx, tube] of [[-0.052, 0.006], [0, 0.011], [0.052, 0.006]]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.113, tube, 10, 26, Math.PI), matShell);
    rib.position.set(sx, 0.003, 0); rib.rotation.y = Math.PI / 2; g.add(rib);
  }

  // Pico frontal (bill) inclinado con borde redondeado
  const pico = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.015, 0.085), matShell);
  pico.position.set(0, -0.008, 0.118); pico.rotation.x = -0.18; g.add(pico);
  const picoBorde = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.185, 12), matShell);
  picoBorde.rotation.z = Math.PI / 2; picoBorde.position.set(0, -0.018, 0.158); g.add(picoBorde);

  // ── CAP LAMP en bracket MSA negro, al frente ──
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.05, 0.03, 1, 1, 1), matK);
  bracket.position.set(0, 0.016, 0.106); g.add(bracket);
  // Cuerpo redondeado (elipsoide) verde translúcido
  const lampBody = new THREE.Mesh(new THREE.SphereGeometry(0.032, 18, 14), matLampBody);
  lampBody.scale.set(1.25, 0.95, 0.72); lampBody.position.set(0, 0.016, 0.135); g.add(lampBody);
  // Bezel cromado + reflector + lente + LED
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 10, 22), matChrome);
  bezel.position.set(0, 0.016, 0.156); g.add(bezel);
  const reflector = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.012, 0.024, 20), matChrome);
  reflector.rotation.x = -Math.PI / 2; reflector.position.set(0, 0.016, 0.147); g.add(reflector);
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.008, 10, 8),
    matPlano(PALETTE.headlampFrio, 0.2, { emissive: PALETTE.headlampFrio, emissiveIntensity: 6 })
  );
  led.position.set(0, 0.016, 0.15); g.add(led);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.023, 20), matLens);
  lens.position.set(0, 0.016, 0.158); g.add(lens);

  // ── OREJERAS 3M Optime redondeadas a ambos lados ──
  for (const sx of [-1, 1]) {
    // Deslizador/brazo de ajuste de altura (plano, negro)
    const slider = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.095, 0.022), matK);
    slider.position.set(sx * 0.108, -0.008, 0.006); slider.rotation.z = sx * 0.16; g.add(slider);
    // Copa (cilindro, eje X = mira hacia afuera) glossy negra
    const copa = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.056, 0.05, 24), matK);
    copa.rotation.z = Math.PI / 2; copa.position.set(sx * 0.14, -0.05, 0.0); g.add(copa);
    // Tapa exterior redondeada (domo)
    const domo = new THREE.Mesh(new THREE.SphereGeometry(0.052, 18, 14), matK);
    domo.scale.set(0.55, 1.0, 1.0); domo.position.set(sx * 0.164, -0.05, 0.0); g.add(domo);
    // Banda roja alrededor de la copa
    const banda = new THREE.Mesh(new THREE.CylinderGeometry(0.0575, 0.0575, 0.013, 24), matRed);
    banda.rotation.z = Math.PI / 2; banda.position.set(sx * 0.142, -0.05, 0.0); g.add(banda);
    // Cojín de espuma hacia la cabeza (interior)
    const cojin = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.013, 10, 20), matFoam);
    cojin.rotation.y = Math.PI / 2; cojin.position.set(sx * 0.116, -0.05, 0.0); g.add(cojin);
  }

  // ── Ratchet trasero (perilla de la suspensión Fas-Trac) ──
  const ratchet = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.018, 18), matK);
  ratchet.rotation.x = Math.PI / 2; ratchet.position.set(0, -0.028, -0.112); g.add(ratchet);
  const perilla = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.018, 14), matK);
  perilla.rotation.x = Math.PI / 2; perilla.position.set(0, -0.028, -0.126); g.add(perilla);

  // ── Barbiquejo (correa de mentón) con hebilla ──
  const matCorrea = matPlano(0x3a3f46, 0.85);
  for (const sx of [-1, 1]) {
    const correa = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.14, 0.008), matCorrea);
    correa.position.set(sx * 0.086, -0.10, 0.045); correa.rotation.z = sx * 0.18; g.add(correa);
  }
  const hebilla = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.016, 0.008), matPlano(0x888888, 0.5, { metal: 0.5 }));
  hebilla.position.set(0, -0.155, 0.05); g.add(hebilla);

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/**
 * Chaleco hi-vis AJUSTADO al torso: perfil tallado (LatheGeometry) que sigue la silueta
 * cintura→pecho→hombros, aplanado en Z para pegarse al cuerpo (no un barril). Origen ≈ Spine1.
 */
function crearChaleco() {
  const g = new THREE.Group();
  const matVest = matPlano(0xc6e600, 0.55, { emissive: 0x3a4a00, emissiveIntensity: 0.25, side: THREE.DoubleSide });
  const matTape = matPlano(0xd7dde2, 0.18, { metalness: 0.35, emissive: 0x2a2f33, emissiveIntensity: 0.25, side: THREE.DoubleSide });
  // Perfil (radio, y) con corte MASCULINO en V: hombros/pecho anchos, cintura estrecha.
  const perfil = [
    new THREE.Vector2(0.142, -0.17),  // cintura (estrecha)
    new THREE.Vector2(0.172, -0.03),
    new THREE.Vector2(0.190,  0.08),  // pecho ancho
    new THREE.Vector2(0.185,  0.16),  // hombros anchos
    new THREE.Vector2(0.105,  0.22)   // cuello
  ];
  const vest = new THREE.Mesh(new THREE.LatheGeometry(perfil, 20), matVest);
  vest.scale.z = 0.60;   // aplana frente-espalda → se pega al cuerpo
  g.add(vest);
  // Cintas retrorreflectivas horizontales (siguen el aplanado del chaleco)
  for (const y of [-0.06, 0.08]) {
    const cinta = new THREE.Mesh(new THREE.CylinderGeometry(0.190, 0.190, 0.04, 20, 1, true), matTape);
    cinta.position.y = y; cinta.scale.z = 0.60; g.add(cinta);
  }
  // Tirantes verticales al frente
  for (const sx of [-1, 1]) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.016), matTape);
    v.position.set(sx * 0.075, 0.02, 0.114); g.add(v);
  }
  // Hombreras: ensanchan los hombros (aspecto masculino)
  for (const sx of [-1, 1]) {
    const hombro = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), matVest);
    hombro.scale.set(1.1, 0.7, 0.85);
    hombro.position.set(sx * 0.17, 0.17, 0);
    g.add(hombro);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/**
 * Manga/segmento de brazo (bíceps o antebrazo) con volumen. Color configurable + opcional
 * banda retrorreflectiva y puño de otro color en el extremo distal (+Y).
 */
function crearManga(rTop, rBot, largo, color = COL_NARANJA, { banda = null, puno = null } = {}) {
  const g = new THREE.Group();
  // Bone +Y apunta hacia el codo/muñeca → radiusTop(+Y)=distal, radiusBottom(-Y)=proximal (más grueso)
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, largo, 16), matPlano(color, 0.9));
  g.add(m);
  const rMid = (rTop + rBot) / 2;
  if (banda !== null) {  // cinta retrorreflectiva alrededor de la manga
    const b = new THREE.Mesh(new THREE.CylinderGeometry(rMid * 1.03, rMid * 1.03, 0.042, 18), matRefl());
    b.position.y = banda; g.add(b);
  }
  if (puno !== null) {   // puño (cuff) de otro color en el extremo distal (muñeca, +Y)
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rTop * 1.05, rTop * 1.02, 0.04, 18), matPlano(puno, 0.9));
    c.position.y = largo / 2 - 0.02; g.add(c);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Segmento de pantalón (muslo): chaps/pantalón de cuero MARRÓN (según fotos reales). */
function crearPantalonMuslo() {
  const g = new THREE.Group();
  // UpLeg +Y hacia la rodilla → radiusTop(+Y)=rodilla, radiusBottom(-Y)=cadera (más ancho, muslo)
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.120, 0.50, 16), matPlano(COL_MARRON, 0.92));
  g.add(m);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Cadera/short del pantalón: cubre la pelvis bajo el cinturón. Origen ≈ Hips. */
function crearPantalonHip() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.135, 0.22, 18, 1), matPlano(PALETTE.eppNaranja, 0.9));
  m.scale.z = 0.74; g.add(m);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/**
 * Respirador de MEDIA CARA (tipo 3M 7502/6200): cuerpo de silicona azul-gris que cubre
 * nariz-boca-mentón, puente nasal, válvula de exhalación frontal, y a cada lado un
 * CARTUCHO bayoneta (gris) + FILTRO P100 (disco rosado) + retenedor con rejilla. Correas atrás.
 * Origen ≈ Head (se coloca al frente de la cara, mirando a +Z).
 */
function crearRespirador() {
  const g = new THREE.Group();
  const matMask = matPlano(0x35485e, 0.6);                       // silicona azul-gris
  const matHard = matPlano(0x242a31, 0.5, { metal: 0.2 }); // plástico gris oscuro
  const matCart = matPlano(0x9498a0, 0.55, { metal: 0.2 });      // cartucho gris
  const matFilt = matPlano(0xd8517e, 0.5);                       // filtro P100 rosado
  const matGrid = matPlano(0x7d838c, 0.5, { metal: 0.2 });       // retenedor/rejilla
  const matStrap = matPlano(0x3a3f46, 0.9);                      // correa elástica

  // Cuerpo de la media máscara (cubre nariz-boca-mentón)
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.072, 18, 14), matMask);
  cuerpo.scale.set(1.15, 1.30, 1.12); cuerpo.position.set(0, 0, 0.008); g.add(cuerpo);
  // Puente nasal (arriba, más angosto)
  const puente = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), matMask);
  puente.scale.set(1.0, 0.85, 1.1); puente.position.set(0, 0.062, 0.02); g.add(puente);
  // Válvula de exhalación (frente-centro-inferior)
  const valv = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.028, 14), matHard);
  valv.rotation.x = Math.PI / 2; valv.position.set(0, -0.052, 0.088); g.add(valv);
  const valvCap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.02, 14), matMask);
  valvCap.rotation.x = Math.PI / 2; valvCap.position.set(0, -0.052, 0.102); g.add(valvCap);

  // Cartucho + filtro P100 a cada lado
  for (const sx of [-1, 1]) {
    const lado = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.02, 14), matHard);
    base.rotation.x = Math.PI / 2; lado.add(base);                                   // bayoneta
    const cart = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.032, 0.035, 16), matCart);
    cart.rotation.x = Math.PI / 2; cart.position.z = 0.028; lado.add(cart);           // cuerpo cartucho
    const filt = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.040, 0.016, 18), matFilt);
    filt.rotation.x = Math.PI / 2; filt.position.z = 0.052; lado.add(filt);           // filtro P100 rosado
    const ret = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.007, 18, 1, true), matGrid);
    ret.rotation.x = Math.PI / 2; ret.position.z = 0.060; lado.add(ret);              // aro retenedor
    for (const rz of [0, Math.PI / 2]) {                                             // rejilla en cruz
      const barra = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.007, 0.004), matGrid);
      barra.position.z = 0.061; barra.rotation.z = rz; lado.add(barra);
    }
    // Orientar hacia afuera + adelante + un poco abajo
    lado.position.set(sx * 0.072, -0.02, 0.03);
    lado.rotation.y = sx * 0.9;
    lado.rotation.x = 0.32;
    lado.rotation.z = -sx * 0.12;
    g.add(lado);
  }

  // Correas elásticas hacia atrás (sujeción a la cabeza)
  for (const sy of [0.035, -0.035]) {
    for (const sx of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.018, 0.11), matStrap);
      strap.position.set(sx * 0.085, sy, -0.04);
      strap.rotation.y = sx * 0.6;
      g.add(strap);
    }
  }

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/**
 * AUTORRESCATADOR de circuito abierto (tipo Steelpro SAFE 1+): carcasa cilíndrica de
 * acero inoxidable (≈100×93×133 mm), CAPUCHA DE JEBE AZUL en la tapa, ETIQUETA AMARILLA
 * "Safe 1+" al frente y ARNÉS/correa azul. Se lleva en el cinturón. Origen ≈ Hips.
 */
function crearAutorescatador() {
  const g = new THREE.Group();
  const matAcero = matPlano(0xc4c8ce, 0.32, { metal: 0.9 });   // caja acero inox 316
  const matAzul  = matPlano(0x1f5fd0, 0.55);                    // capucha de jebe azul
  const matAzulD = matPlano(0x123f8f, 0.6);                     // azul oscuro (arnés)

  // Carcasa cilíndrica de acero (ligeramente ovalada 100×93 mm, alto ~110 mm)
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.11, 22), matAcero);
  can.scale.z = 0.92; g.add(can);
  const aroBase = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.050, 0.012, 22), matAcero);
  aroBase.scale.z = 0.92; aroBase.position.y = -0.056; g.add(aroBase);
  const reborde = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.050, 0.014, 22), matAcero);
  reborde.scale.z = 0.92; reborde.position.y = 0.052; g.add(reborde);

  // Capucha de jebe azul (domo) en la tapa
  const capucha = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), matAzul
  );
  capucha.scale.set(1.0, 1.05, 0.92); capucha.position.y = 0.058; g.add(capucha);

  // Etiqueta amarilla "STEELPRO / Safe 1+" al frente (CanvasTexture)
  const cvs = document.createElement('canvas'); cvs.width = 128; cvs.height = 100;
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = '#f5d000'; ctx.fillRect(0, 0, 128, 100);
  ctx.fillStyle = '#123f8f'; ctx.fillRect(0, 0, 128, 24);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('STEELPRO', 64, 17);
  ctx.fillStyle = '#123f8f'; ctx.font = 'bold 30px sans-serif';
  ctx.fillText('Safe 1+', 64, 64);
  ctx.font = 'bold 9px sans-serif'; ctx.fillText('AUTORRESCATADOR', 64, 88);
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  const etiqueta = new THREE.Mesh(
    new THREE.PlaneGeometry(0.076, 0.06),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 })
  );
  etiqueta.position.set(0, -0.005, 0.045 * 0.92 + 0.002); g.add(etiqueta);

  // Arnés / correa azul (banda elástica de sujeción) por detrás
  for (const sx of [-1, 1]) {
    const banda = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.15, 0.006), matAzulD);
    banda.position.set(sx * 0.03, 0.06, -0.05); banda.rotation.x = 0.25; g.add(banda);
  }
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.02), matAzulD);
  clip.position.set(0, 0.12, -0.03); g.add(clip);

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Caña de bota (cubre la espinilla, hasta la rodilla) con cinta reflectiva. Origen ≈ rodilla. */
function crearBotaCana() {
  const g = new THREE.Group();
  const mat = matPlano(0x111111, 0.8);
  // Bone +Y apunta hacia el tobillo → radiusTop(+Y)=tobillo (estrecho), radiusBottom(-Y)=rodilla (ancho)
  const cana = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.095, 0.45, 16), mat);
  g.add(cana);
  const borde = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.03, 16), matPlano(0x222222, 0.7));
  borde.position.y = -0.22; g.add(borde);   // -Y = lado de la rodilla
  const bandaR = new THREE.Mesh(new THREE.CylinderGeometry(0.081, 0.088, 0.038, 16), matRefl());
  bandaR.position.y = -0.15; g.add(bandaR); // cinta reflectiva sobre la caña
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Pie de la bota (puntera + suela). Se orienta plano con la rot correctiva; geometría en ejes de mundo. */
function crearBotaPie() {
  const g = new THREE.Group();
  const mat = matPlano(0x111111, 0.8);
  const matS = matPlano(0x0a0a0a, 0.95);
  const pie = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.085, 0.20), mat);
  pie.position.set(0, -0.02, 0.06); g.add(pie);
  const puntera = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), mat);
  puntera.scale.set(0.92, 0.72, 1.05); puntera.position.set(0, -0.03, 0.15); g.add(puntera);
  const suela = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.24), matS);
  suela.position.set(0, -0.062, 0.06); g.add(suela);
  // Puntera de color (refuerzo verde-lima, como en las botas de las fotos)
  const punteraCap = new THREE.Mesh(new THREE.SphereGeometry(0.053, 12, 8), matPlano(0x3f8a2e, 0.6));
  punteraCap.scale.set(0.92, 0.6, 0.7); punteraCap.position.set(0, -0.04, 0.16); g.add(punteraCap);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/**
 * ROSTRO: piel sobre la cabeza del maniquí (cubre la cara naranja) + ojos, cejas, orejas.
 * Nariz y boca solo si NO hay respirador (si lo hay, la media máscara las tapa).
 * La cara mira a +Z (misma dirección que el headlamp del casco). Origen ≈ hueso Head.
 */
function crearCara(epp = {}) {
  const g = new THREE.Group();
  const piel = matPlano(0xc98d63, 0.85);

  // Cabeza de piel que envuelve la cabeza del modelo (un pelín más grande para taparla)
  const craneo = new THREE.Mesh(new THREE.SphereGeometry(0.104, 20, 16), piel);
  craneo.scale.set(1.0, 1.16, 1.02);
  craneo.position.set(0, 0.08, 0.008);
  g.add(craneo);
  // Mandíbula / mentón
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 10), piel);
  jaw.scale.set(0.94, 0.72, 0.92); jaw.position.set(0, 0.018, 0.02);
  g.add(jaw);
  // Orejas
  for (const sx of [-1, 1]) {
    const oreja = new THREE.Mesh(new THREE.SphereGeometry(0.023, 8, 6), piel);
    oreja.scale.set(0.5, 1.0, 0.7); oreja.position.set(sx * 0.100, 0.075, 0.0);
    g.add(oreja);
  }

  // Rasgos faciales (polygonOffset anti z-fighting sobre la superficie curva)
  const po = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  const matOjo  = new THREE.MeshStandardMaterial({ color: 0xeeeae3, roughness: 0.6, ...po });
  const matIris = new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.5, ...po });
  const matPup  = new THREE.MeshStandardMaterial({ color: 0x070303, roughness: 0.4, ...po });
  const matCeja = new THREE.MeshStandardMaterial({ color: 0x160f06, roughness: 0.85, ...po });
  const matBoca = new THREE.MeshStandardMaterial({ color: 0x7a2a20, roughness: 0.7, ...po });

  for (const sx of [-1, 1]) {
    const ex = sx * 0.034, ey = 0.082, ez = 0.107;
    const ojo = new THREE.Mesh(new THREE.CircleGeometry(0.019, 14), matOjo);
    ojo.position.set(ex, ey, ez); g.add(ojo);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.011, 12), matIris);
    iris.position.set(ex, ey, ez + 0.001); g.add(iris);
    const pup = new THREE.Mesh(new THREE.CircleGeometry(0.0055, 10), matPup);
    pup.position.set(ex, ey, ez + 0.002); g.add(pup);
    const ceja = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.009, 0.006), matCeja);
    ceja.position.set(ex, 0.104, 0.101); ceja.rotation.z = sx * 0.12; ceja.rotation.x = -0.10;
    g.add(ceja);
  }

  // Nariz y boca: solo visibles si el trabajador NO lleva respirador
  if (epp.respirador === false) {
    const nariz = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), piel);
    nariz.scale.set(1.0, 0.8, 0.78); nariz.position.set(0, 0.056, 0.116); g.add(nariz);
    const boca = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.008, 0.006), matBoca);
    boca.position.set(0, 0.028, 0.107); g.add(boca);
  }

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Guante de trabajo: cubre la mano del maniquí. Origen ≈ hueso Hand; se extiende por +Y (dedos). */
function crearGuante() {
  const g = new THREE.Group();
  const mat = matPlano(0x1b1b1b, 0.82);
  const palma = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.11, 0.05), mat);
  palma.position.y = 0.02; g.add(palma);
  const dedos = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat);
  dedos.scale.set(0.9, 0.7, 0.62); dedos.position.y = 0.085; g.add(dedos);
  const pulgar = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), mat);
  pulgar.scale.set(0.9, 1.2, 0.9); pulgar.position.set(0.038, 0.0, 0.02); g.add(pulgar);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Cinturón minero: correa + hebilla + batería de lámpara. Origen ≈ Hips. */
function crearCinturon() {
  const g = new THREE.Group();
  const matCuero = matPlano(0x241a12, 0.85);
  const correa = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.055, 20, 1, true), matCuero);
  correa.scale.z = 0.72; correa.material.side = THREE.DoubleSide; g.add(correa);
  const hebilla = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.015), matPlano(0x8a8a8a, 0.4, { metalness: 0.6 }));
  hebilla.position.set(0, 0, 0.145); g.add(hebilla);
  const bateria = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.09, 0.05), matPlano(0x161616, 0.6, { metalness: 0.2 }));
  bateria.position.set(0.14, -0.02, -0.12); g.add(bateria);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Registra un EPP como "seguidor" de un hueso, con offset local (cm) + rotación. */
function agregarFollower(followers, container, root, epp, ajuste) {
  let bone = null;
  const suf = ajuste.bone.toLowerCase();
  root.traverse((o) => { if (!bone && o.isBone && o.name.toLowerCase().endsWith(suf)) bone = o; });
  if (!bone) {
    const nombres = [];
    root.traverse((o) => { if (o.isBone) nombres.push(o.name); });
    console.warn(`[minero] hueso "${ajuste.bone}" no encontrado. Huesos disponibles:`, nombres);
    return;
  }
  fusionarPorMaterial(epp);   // ⚡ colapsa las mallas del EPP por material (menos draw calls)
  container.add(epp);
  const offset = new THREE.Matrix4().compose(
    new THREE.Vector3(ajuste.pos[0], ajuste.pos[1], ajuste.pos[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(ajuste.rot[0], ajuste.rot[1], ajuste.rot[2])),
    new THREE.Vector3(100, 100, 100)   // compensa el escalado 0.01 del modelo (cm→m)
  );
  followers.push({ epp, bone, offset });
}

// Scratch reutilizable
const _mInv = new THREE.Matrix4();
const _m = new THREE.Matrix4();

/**
 * @param {{rol?:string, epp?:object}} opts
 * @returns {THREE.Group}
 */
export function crear({ rol = 'operador', epp = {} } = {}) {
  // Fallback a persona procedural si el FBX no está disponible.
  if (!mineroDisponible()) {
    const g = crearPersonaProcedural({ rol, epp });
    g.userData.fallback = true;
    return g;
  }

  const container = new THREE.Group();
  container.name = `minero_${rol}`;

  // Clon independiente (esqueleto propio) del personaje.
  const modelo = cloneSkeleton(_src);
  modelo.scale.setScalar(0.01);   // cm → m
  container.add(modelo);

  // Mixer + acciones
  const mixer = new THREE.AnimationMixer(modelo);
  const actWalk = _walkClip ? mixer.clipAction(_walkClip) : null;
  const actRun  = _runClip  ? mixer.clipAction(_runClip)  : null;
  (actWalk || actRun)?.play();

  // EPP siguiendo huesos (casco, respirador, chaleco, cinturón, autorescatador, botas)
  const followers = [];
  for (const d of EPP_DEFS) {
    if (d.opt && epp[d.opt] === false) continue;   // pieza opcional desactivada
    agregarFollower(followers, container, modelo, d.build(rol, epp), d);
  }

  container.userData.anim = {
    mixer, actWalk, actRun,
    estado: null,
    _prev: null,
    followers,
    modelo,
    setEstado(e) {
      if (e === this.estado) return;
      const target = (e === 'run' && this.actRun) ? this.actRun : this.actWalk;
      if (!target) { this.estado = e; return; }
      target.enabled = true;
      target.setEffectiveWeight(1);
      target.timeScale = (e === 'idle') ? 0.18 : 1.0;
      target.play();
      if (this._prev && this._prev !== target) this._prev.crossFadeTo(target, 0.25, false);
      this._prev = target;
      this.estado = e;
    },
    /**
     * Sincroniza la CADENCIA del clip con la velocidad REAL de avance (m/s) → los pies dejan
     * de patinar. Solo aplica caminando/corriendo; el idle mantiene su timeScale bajo (0.18).
     */
    sincronizarCadencia(moviendo, corriendo, vel) {
      if (!moviendo) return;
      const target = (corriendo && this.actRun) ? this.actRun : this.actWalk;
      if (!target) return;
      const nominal = (target === this.actRun) ? RUN_CLIP_SPEED : WALK_CLIP_SPEED;
      target.timeScale = THREE.MathUtils.clamp(vel / nominal, 0.55, 1.7);
    },
    actualizarEpp() {
      // Refresca matrices de mundo del contenedor y del esqueleto ANTES de leer los huesos.
      container.updateWorldMatrix(true, false);
      this.modelo.updateWorldMatrix(false, true);
      _mInv.copy(container.matrixWorld).invert();
      for (const f of this.followers) {
        _m.multiplyMatrices(_mInv, f.bone.matrixWorld).multiply(f.offset);
        _m.decompose(f.epp.position, f.epp.quaternion, f.epp.scale);
      }
    }
  };
  container.userData.epp = {
    chaleco:        epp.chaleco        !== false,
    respirador:     epp.respirador     !== false,
    autorescatador: epp.autorescatador !== false
  };
  return container;
}

/**
 * Avanza la animación de un minero (o de la persona procedural de fallback).
 * @param {THREE.Group} obj  resultado de crear()
 * @param {number} dt
 * @param {boolean} moviendo
 * @param {boolean} corriendo
 * @param {number} [velocidad] velocidad real de avance (m/s) para sincronizar la cadencia
 */
export function actualizar(obj, dt, moviendo, corriendo, velocidad = 0) {
  const a = obj.userData.anim;
  if (a) {
    // TAREA activa: se mantiene en idle (base con vida) y se superpone un micro-gesto de
    // trabajo sobre los huesos DESPUES del mixer (que reescribe la pose base cada frame,
    // asi que el delta no se acumula). Ver setTarea().
    if (a._tarea) {
      a.setEstado('idle');
      a.mixer.update(dt);
      aplicarGesto(a._tarea, dt);
      a.actualizarEpp();
      return;
    }
    a.setEstado(!moviendo ? 'idle' : (corriendo ? 'run' : 'walk'));
    a.sincronizarCadencia(moviendo, corriendo, velocidad);
    a.mixer.update(dt);
    a.actualizarEpp();
    return;
  }
  // Fallback procedural: la frecuencia de la marcha tambien sigue a la velocidad real.
  const fBase = corriendo ? 4.4 : moviendo ? 7.8 : 1.5;
  const fVel = moviendo ? THREE.MathUtils.clamp(velocidad / (corriendo ? RUN_CLIP_SPEED : WALK_CLIP_SPEED), 0.55, 1.7) : 1;
  obj.userData._ph = (obj.userData._ph || 0) + dt * fBase * fVel;
  animarMarcha(obj, obj.userData._ph, moviendo ? (corriendo ? 0.8 : 0.6) : 0.06);
}

/**
 * Parametros de cada micro-gesto de tarea (rad). `freq`=rad/s del vaiven; `ampFore`=amplitud
 * del vaiven de antebrazo (codo); `offFore`/`offArm`=flexion base de antebrazo/brazo (pose
 * caracteristica); `lean`=inclinacion del torso. Valores CONSERVADORES a proposito: se afinan
 * a ojo en el visor. El realismo tambien lo aportan la posicion junto al equipo, el polvo/spray
 * (WorkFX) y el sonido (WorkSiteSystem).
 */
const GESTOS = {
  perforar:   { freq: 7.0, ampFore: 0.14, offFore: 0.5,  offArm: -0.30, lean: 0.10 }, // manos en controles, vibra
  instalar:   { freq: 3.0, ampFore: 0.20, offFore: 0.75, offArm: -0.55, lean: 0.06 }, // brazos arriba: malla/perno
  operar:     { freq: 2.4, ampFore: 0.10, offFore: 0.5,  offArm: -0.35, lean: 0.08 }, // boquilla/valvula, lento
  observar:   { freq: 1.1, ampFore: 0.03, offFore: 0.0,  offArm: 0.0,   lean: 0.02 }, // vigia: casi quieto
  topografiar:{ freq: 0.8, ampFore: 0.03, offFore: 0.40, offArm: -0.18, lean: 0.24 }, // inclinado sobre la estacion total, ojo al lente
  cargar:     { freq: 1.6, ampFore: 0.05, offFore: 0.95, offArm: -0.28, lean: 0.14 }, // acarrea material (malla/pernos) en brazos
  // DESATADO MANUAL (PETS-CL-OPE-1): barretilla a DOS MANOS (sync) "posición del cazador",
  // palanqueo lento y amplio hacia el techo/hastial. La barretilla la adjunta setTarea a la mano.
  desatar:    { freq: 2.0, ampFore: 0.34, offFore: 0.55, offArm: -0.72, lean: 0.14, sync: true },
  // ALUMBRAR: el ayudante alza el brazo IZQUIERDO apuntando la lámpara al punto de desate
  // (el otro que desata). Cuerpo casi quieto; el faro del casco hace la luz.
  alumbrar:   { freq: 0.6, ampFore: 0.02, offFore: 0.15, offArm: -0.10, offArmL: -1.15, lean: 0.03 }
};

/** Aplica el gesto de tarea a los huesos ya resueltos en `t` (tras mixer.update). */
function aplicarGesto(t, dt) {
  const g = GESTOS[t.gesto] || GESTOS.observar;
  t.t += dt;
  const s = Math.sin(t.t * g.freq);
  // `sync`: ambos antebrazos EN FASE (dos manos a la barra). Por defecto van opuestos.
  const sL = g.sync ? s : -s;
  // Huesos +Y del rig Mixamo miran al codo/muñeca; rotX positivo flexiona hacia adelante.
  if (t.foreR) t.foreR.rotation.x += g.offFore + s  * g.ampFore;
  if (t.foreL) t.foreL.rotation.x += g.offFore + sL * g.ampFore;
  // offArmL/offArmR permiten pose ASIMÉTRICA (un brazo en alto: alumbrar).
  if (t.armR)  t.armR.rotation.x  += (g.offArmR ?? g.offArm);
  if (t.armL)  t.armL.rotation.x  += (g.offArmL ?? g.offArm);
  if (t.spine) t.spine.rotation.x += g.lean;
}

/**
 * Barretilla LISTA PARA LA MANO: la barra centrada se traslada para que el GRIP (manos, cerca
 * de la punta -X) quede en el origen del grupo; la UÑA (+X) es el extremo que sube al techo. La
 * inclinación fina a 45° la aporta el offset del follower en setTarea. Cacheada por longitud.
 */
const _barCache = new Map();
function crearBarretillaEnMano(pies = 8) {
  if (_barCache.has(pies)) return _barCache.get(pies).clone(true);
  const h = new THREE.Group();
  h.name = 'barretilla_mano';
  const bar = crearBarretilla(pies, 0.032);
  const L = pies * 0.3048;
  bar.position.x = L / 2 - 0.25;   // grip a ~0.25 m del extremo punta → en el origen del grupo
  h.add(bar);
  _barCache.set(pies, h);
  return h.clone(true);
}

/**
 * Fija (o limpia) el GESTO de tarea de un minero para que "se vea trabajando" sin clips nuevos.
 * Barato: solo resuelve 2-5 huesos una vez y los rota un delta cada frame. Si el gesto lo
 * requiere (desatar), ADJUNTA una herramienta a la mano (barretilla) que sigue el hueso.
 * @param {THREE.Group} obj    resultado de crear()
 * @param {?string} gesto      'perforar'|'instalar'|'operar'|'observar'|'topografiar'|'cargar'|'desatar'|'alumbrar'|null
 * @param {{pies?:number}} [opts]  parámetros de la herramienta (p.ej. largo de barretilla)
 */
export function setTarea(obj, gesto, opts = {}) {
  const a = obj.userData.anim;
  if (!a) return;                       // persona procedural de fallback: sin esqueleto → quieta

  // Retira la herramienta previa (p.ej. al intercambiar rol desatar↔alumbrar).
  if (a._toolFollower) {
    const i = a.followers.indexOf(a._toolFollower);
    if (i >= 0) a.followers.splice(i, 1);
    a._toolFollower.epp.parent?.remove(a._toolFollower.epp);
    a._toolFollower = null;
  }

  if (!gesto) { a._tarea = null; return; }
  const buscar = (suf) => {
    let b = null;
    a.modelo.traverse((o) => { if (!b && o.isBone && o.name.toLowerCase().endsWith(suf)) b = o; });
    return b;
  };
  a._tarea = {
    gesto,
    t: Math.random() * Math.PI * 2,
    foreL: buscar('leftforearm'), foreR: buscar('rightforearm'),
    armL:  buscar('leftarm'),     armR:  buscar('rightarm'),
    spine: buscar('spine1')
  };

  // Barretilla en la mano derecha para el desatado (sigue el hueso como un EPP).
  if (gesto === 'desatar') {
    const hand = buscar('righthand');
    if (hand) {
      const tool = crearBarretillaEnMano(opts.pies || 8);
      obj.add(tool);
      // pos en cm (espacio del hueso) + rotación que inclina la uña hacia arriba-adelante (45°);
      // escala 100 compensa el 0.01 del modelo. Valores a AFINAR en el visor.
      const offset = new THREE.Matrix4().compose(
        new THREE.Vector3(3, 6, 0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI * 0.25)),
        new THREE.Vector3(100, 100, 100)
      );
      a._toolFollower = { epp: tool, bone: hand, offset };
      a.followers.push(a._toolFollower);
    }
  }
}
