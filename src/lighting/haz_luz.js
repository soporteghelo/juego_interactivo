import * as THREE from 'three';
import { Settings } from '../core/Settings.js';

/**
 * HAZ DE LUZ VISIBLE — el cono de polvo/vaho que se ve alrededor de cada fuente.
 *
 * `mineria-draw.md` lo pide por tres sitios distintos y hasta ahora no existía en ninguna forma:
 *   - "Headlamp del trabajador: cono de luz duro y dirigido"
 *   - "Bombilla incandescente colgante: halo difuso en neblina"
 *   - ERRORES COMUNES — NO HACER: "omitir polvo/neblina", "dibujar un ambiente seco/fresco:
 *     es caluroso (31-34 °C) y muy húmedo (>90 %) — debe haber vaho, condensación y neblina densa"
 *
 * A 91-92 % de humedad relativa y con polvo en suspensión el haz SE VE. El bloom de `PostFX`
 * daba un halo de PANTALLA alrededor del emisivo, pero no volumen en el espacio: no se veía por
 * dónde pasaba la luz, solo que la lámpara brillaba.
 *
 * ── Cómo, sin volumétricos de verdad ──────────────────────────────────────────
 * Un cono HUECO dibujado con mezcla ADITIVA, cuya opacidad se calcula a partir de
 * `f = |dot(normal, vista)|`, y dibujando las DOS caras (`DoubleSide`) para sumar entrada y
 * salida. Hay dos lecturas de `f` y cada haz elige la suya con `relleno`:
 *
 *   relleno → 1   opacidad = f      NÚCLEO LLENO. `f` aproxima el camino óptico del rayo dentro
 *                                   del cono: máximo donde la superficie encara a la cámara.
 *                                   Es lo correcto para una fuente que se mira DE LADO — la
 *                                   bombilla colgante, la luminaria del cruce.
 *   relleno → 0   opacidad = 1 - f  BORDE DEL CONO. Se enciende en la silueta.
 *                                   Es lo único que funciona cuando se mira POR EL EJE del haz:
 *                                   de frente, TODA la superficie del cono es perpendicular a la
 *                                   vista, así que `f ≈ 0` y con la primera lectura el haz del
 *                                   headlamp desaparecía justo en primera persona, que es la
 *                                   vista por defecto. Con esta se ve el contorno del cono
 *                                   abriéndose en el polvo, que es como se percibe de verdad.
 *
 * En ambos casos el borde nunca es una "pared" de cono opaca, que es como se delata este truco.
 *
 * ── Presupuesto ───────────────────────────────────────────────────────────────
 * Geometría y material se CREAN UNA VEZ y se comparten entre todas las fuentes (el color y la
 * intensidad van por `onBeforeRender`, no por material nuevo). Cada haz son ~64 triángulos y una
 * llamada de dibujo. El coste real no es geometría sino FILL-RATE aditivo, así que va GATEADO:
 *   - `hazLuz`       → el del headlamp (alto/medio/movil)
 *   - `hazLuzFijas`  → los de luminarias y bombillas (solo alto/medio)
 * En 'bajo' no se crea ninguno. Es el mismo motivo por el que `Mist` se apaga en táctil.
 */

const SEGMENTOS_RADIALES = 16;

let _geoCache = null;
let _matCache = null;

/**
 * Cono unitario HUECO con el vértice en el origen y el eje sobre -Z (la misma convención que
 * mira una cámara y que apunta un SpotLight hacia su target). Radio de base 1 y altura 1: cada
 * haz lo escala a su ángulo y su alcance, así que TODOS comparten este único buffer.
 */
function geometriaHaz() {
  if (_geoCache) return _geoCache;
  const geo = new THREE.ConeGeometry(1, 1, SEGMENTOS_RADIALES, 1, true);
  // ConeGeometry nace sobre +Y con el vértice arriba: se tumba sobre -Z y se corre para que el
  // vértice quede exactamente en el origen.
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -0.5);
  _geoCache = geo;
  return geo;
}

function materialHaz() {
  if (_matCache) return _matCache;
  _matCache = new THREE.ShaderMaterial({
    uniforms: {
      colorHaz:   { value: new THREE.Color(0xffffff) },
      intensidad: { value: 0.09 },
      relleno:    { value: 0.85 }
    },
    vertexShader: /* glsl */`
      varying vec3 vNormalVista;
      varying vec3 vHaciaCamara;
      varying float vAvance;          // 0 en el vertice, 1 en la boca del cono
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalVista = normalMatrix * normal;
        vHaciaCamara = -mv.xyz;
        vAvance = -position.z;        // el cono unitario va de z=0 a z=-1
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3  colorHaz;
      uniform float intensidad;
      uniform float relleno;
      varying vec3  vNormalVista;
      varying vec3  vHaciaCamara;
      varying float vAvance;
      void main() {
        float f = abs(dot(normalize(vNormalVista), normalize(vHaciaCamara)));
        // relleno=1 → nucleo lleno (fuente vista de lado); relleno=0 → contorno del cono
        // (fuente vista por su eje, como el headlamp del propio jugador). Ver cabecera.
        float cuerpo = mix(pow(1.0 - f, 1.5), pow(f, 1.6), relleno);
        float t = clamp(vAvance, 0.0, 1.0);
        // Arranque suave (si no, el vertice pegado a la cara del jugador seria un fogonazo) y
        // extincion progresiva: el polvo dispersa y el haz se pierde antes de llegar al alcance.
        float largo = smoothstep(0.0, 0.10, t) * pow(1.0 - t, 1.7);
        float a = cuerpo * largo * intensidad;
        if (a < 0.002) discard;       // la mayoria del cono no llega a dibujarse
        gl_FragColor = vec4(colorHaz * a, a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  return _matCache;
}

/**
 * ¿Se dibujan haces de este tipo con la calidad actual?
 * @param {boolean} fija  true = luminaria/bombilla fija; false = headlamp del jugador
 */
export function hayHaz(fija) {
  const q = Settings.current;
  return fija ? !!q.hazLuzFijas : !!q.hazLuz;
}

/**
 * Crea un haz de luz visible.
 *
 * @param {object}  o
 * @param {number}  o.angulo      semiangulo de apertura (rad) — el mismo del SpotLight
 * @param {number}  o.alcance     longitud del haz (m)
 * @param {number|THREE.Color} o.color
 * @param {number} [o.intensidad] opacidad del nucleo (0..1); mantener BAJA (0.05-0.14)
 * @param {number} [o.relleno]  0 = solo el contorno del cono (fuente mirada POR SU EJE: headlamp);
 *   1 = nucleo lleno (fuente mirada DE LADO: bombilla, luminaria). Ver cabecera del modulo.
 * @param {boolean}[o.siempreVisible] desactiva el frustum culling. Solo para el headlamp: su
 *   vertice va pegado a la camara y casi siempre cae fuera de cuadro, asi que Three descartaria
 *   el haz entero. Las luminarias FIJAS deben conservar el culling.
 * @returns {THREE.Mesh} malla con el vertice en su origen y el eje sobre -Z
 */
export function crearHaz({ angulo, alcance, color = 0xffffff, intensidad = 0.09, relleno = 0.85, siempreVisible = false }) {
  const haz = new THREE.Mesh(geometriaHaz(), materialHaz());
  haz.name = 'haz_luz';
  // El material es COMPARTIDO: color e intensidad se inyectan justo antes de dibujar esta malla,
  // de modo que un haz calido y uno frio conviven sin duplicar material ni recompilar shader.
  haz.userData.colorHaz = new THREE.Color(color);
  haz.userData.intensidadHaz = intensidad;
  haz.userData.rellenoHaz = relleno;
  haz.onBeforeRender = (renderer, scene, camera, geometry, material) => {
    material.uniforms.colorHaz.value.copy(haz.userData.colorHaz);
    material.uniforms.intensidad.value = haz.userData.intensidadHaz;
    material.uniforms.relleno.value = haz.userData.rellenoHaz;
  };
  // El cono unitario tiene radio 1 a distancia 1 → radio = tan(angulo) por metro.
  haz.scale.set(Math.tan(angulo) * alcance, Math.tan(angulo) * alcance, alcance);
  haz.frustumCulled = !siempreVisible;
  haz.renderOrder = 3;         // despues de la roca, antes del HUD
  return haz;
}

// ─────────────────────────────────────────────────────────────────────────────
// VELO DEL HEADLAMP — el polvo encendido delante de la propia lámpara
// ─────────────────────────────────────────────────────────────────────────────

let _geoVelo = null;
let _matVelo = null;

/**
 * Por qué el headlamp NO usa el cono de arriba: el jugador mira siempre POR EL EJE de su propia
 * lámpara, y ahí un cono falla por los dos lados. Su superficie lateral queda perpendicular a la
 * vista (no aporta color), y además con un alcance realista el cono es más ancho que la labor a
 * partir de ~6 m, así que el resto queda ENTERRADO EN LA ROCA y el test de profundidad lo borra.
 * Medido: el cono del headlamp movía menos del 2 % de los píxeles del cuadro.
 *
 * Lo que se ve de verdad en primera persona es el POLVO EN SUSPENSIÓN encendido delante de la
 * cara: un velo denso en el eje que se apaga hacia los bordes del cono. Eso son dos cuadros
 * encarados a la cámara (gratis: la lámpara ya va pegada a ella) con caída radial, a dos
 * distancias, lo bastante cerca para estar SIEMPRE en aire libre dentro del gálibo de la labor.
 * Con `depthTest` activo, si el jugador se pega a un hastial el velo desaparece, como debe.
 */
function veloGeoMat() {
  if (!_geoVelo) _geoVelo = new THREE.PlaneGeometry(2, 2);
  if (!_matVelo) {
    _matVelo = new THREE.ShaderMaterial({
      uniforms: {
        colorHaz:   { value: new THREE.Color(0xffffff) },
        intensidad: { value: 0.1 }
      },
      vertexShader: /* glsl */`
        varying vec2 vUvVelo;
        void main() {
          vUvVelo = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3  colorHaz;
        uniform float intensidad;
        varying vec2  vUvVelo;
        void main() {
          // Caida radial suave desde el eje del haz: nucleo denso, bordes que se disuelven.
          float r = length(vUvVelo * 2.0 - 1.0);
          float a = pow(max(0.0, 1.0 - r), 2.4) * intensidad;
          if (a < 0.002) discard;
          gl_FragColor = vec4(colorHaz * a, a);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
  }
  return { geo: _geoVelo, mat: _matVelo };
}

/**
 * Velo de polvo del headlamp: grupo con el eje sobre -Z, para colocar en la cámara.
 *
 * @param {object}  o
 * @param {number|THREE.Color} [o.color]
 * @param {number} [o.capas] 2 (escritorio) o 1 (celular). Cada lámina cubre buena parte del
 *   cuadro con mezcla aditiva, así que es overdraw de pantalla casi completa: es EL coste de
 *   este efecto, y en GPU móvil de render por tiles conviene pagar solo una vez.
 * @returns {THREE.Group} con `userData.ajustar({ radio, intensidad })`
 */
export function crearVeloHeadlamp({ color = 0xffffff, capas = 2 } = {}) {
  const { geo, mat } = veloGeoMat();
  const grupo = new THREE.Group();
  grupo.name = 'haz_luz';           // mismo nombre: lo protege del batcher y lo hace inspeccionable
  grupo.renderOrder = 3;
  const col = new THREE.Color(color);

  // La lamina cercana da el grueso del polvo; la lejana (solo en escritorio) alarga la sensacion
  // de profundidad. Con una sola capa se sube su peso para no perder densidad.
  const TODAS = [
    { z: -1.7, escala: 1.00, peso: capas > 1 ? 1.00 : 1.25 },
    { z: -3.4, escala: 1.85, peso: 0.55 }
  ];
  for (const capa of TODAS.slice(0, Math.max(1, capas))) {
    const q = new THREE.Mesh(geo, mat);
    q.position.z = capa.z;
    q.userData.peso = capa.peso;
    q.userData.escalaBase = capa.escala;
    q.frustumCulled = false;        // va pegado a la camara: siempre en cuadro
    q.renderOrder = 3;
    q.onBeforeRender = (renderer, scene, camera, geometry, material) => {
      material.uniforms.colorHaz.value.copy(col);
      material.uniforms.intensidad.value = (grupo.userData.intensidad ?? 0.1) * capa.peso;
    };
    grupo.add(q);
  }

  grupo.userData.intensidad = 0.1;
  grupo.userData.ajustar = ({ radio, intensidad }) => {
    if (intensidad !== undefined) grupo.userData.intensidad = intensidad;
    if (radio !== undefined) {
      for (const q of grupo.children) q.scale.setScalar(radio * q.userData.escalaBase);
    }
  };
  return grupo;
}

/** Reajusta un haz ya creado (el headlamp cambia de alcance al cambiar de nivel). */
export function ajustarHaz(haz, { angulo, alcance, intensidad }) {
  if (!haz) return;
  if (intensidad !== undefined) haz.userData.intensidadHaz = intensidad;
  if (angulo !== undefined && alcance !== undefined) {
    haz.scale.set(Math.tan(angulo) * alcance, Math.tan(angulo) * alcance, alcance);
  }
}
