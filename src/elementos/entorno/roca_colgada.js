import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';

/**
 * ROCA COLGADA / PANEL DE SHOTCRETE POR DESPRENDERSE — la condicion insegura numero uno en
 * labor subterranea: material despegado de la corona que todavia no ha caido.
 *
 * Dos variantes, ambas colgando del techo y visibles desde abajo:
 *  - 'roca'      : cuña de roca desprendida del macizo, separada por una GRIETA abierta que se
 *                  ve como una linea oscura alrededor de la pieza. Las cuñas de la corona caen
 *                  por la interseccion de tres discontinuidades → forma tetraedrica/piramidal.
 *  - 'shotcrete' : panel de hormigon proyectado despegado, ya vencido por su propio peso, con
 *                  la malla electrosoldada asomando por el borde roto.
 *
 * La pieza OSCILA muy levemente (userData.tick): es lo que hace que se lea como "a punto de
 * caer" y no como parte de la roca. Se registra como PELIGRO (userData.hazard, tipo
 * 'desprendimiento'): avisa al acercarse y hiere si el jugador se mete debajo, igual que el
 * resto de peligros de la mina. Se DESATA con barretilla antes de trabajar bajo ella.
 *
 * Origen local: el punto de anclaje en la corona. La pieza cuelga hacia -Y.
 */

export const meta = {
  id: 'roca_colgada',
  nombre: 'Roca / shotcrete por desprenderse',
  descripcion: 'Cuña de roca o panel de shotcrete despegado de la corona, pendiente de desatar.'
};

let _cuna = null, _lasca = null, _panel = null, _mallaColgante = null, _grieta = null;
const _matRoca = new Map();

// Tono medio de cada litologia (mismo criterio que las rampas de `TunnelGeometry.ROCK_RAMPS`):
// la cuña desprendida es de la MISMA caja que la labor, no una piedra gris pegada al techo.
const TONO_ROCA = {
  caliza: 0x6b6459,
  ferruginosa: 0x7a4c2b,
  andesita: 0x525a63,
  cuarcita: 0x9c968a,
  esquisto: 0x4f5d45,
  mineralizada: 0x6f6231
};

/** Material de la pieza segun la litologia de la labor (uno por tipo, cacheado). */
function materialPieza(rockType) {
  const key = rockType in TONO_ROCA ? rockType : 'caliza';
  if (!_matRoca.has(key)) {
    _matRoca.set(key, new THREE.MeshStandardMaterial({
      color: TONO_ROCA[key], roughness: 0.95, metalness: 0.0, flatShading: true
    }));
  }
  return _matRoca.get(key);
}

/** Sombra de la GRIETA: media caña oscura, NO un plano negro (un plano se lee como agujero). */
function materialGrieta() {
  if (!_matRoca.has('__grieta')) {
    _matRoca.set('__grieta', new THREE.MeshStandardMaterial({
      color: 0x14120f, roughness: 1.0, metalness: 0.0
    }));
  }
  return _matRoca.get('__grieta');
}

/** Cuña tetraedrica irregular: la forma tipica de una caida de roca de corona. */
function geoCuna() {
  if (!_cuna) {
    _cuna = new THREE.TetrahedronGeometry(0.5, 0);
    // Achata la cuña: se despega mas ancha que profunda (sigue el plano de la discontinuidad).
    _cuna.scale(1.5, 0.85, 1.15);
  }
  return _cuna;
}

/** Lasca fina (roca laminada) para las piezas menores del entorno de la cuña principal. */
function geoLasca() {
  if (!_lasca) {
    _lasca = new THREE.DodecahedronGeometry(0.28, 0);
    _lasca.scale(1.35, 0.45, 1.0);
  }
  return _lasca;
}

function geoPanel() {
  if (!_panel) _panel = new THREE.BoxGeometry(1.0, 0.09, 0.75, 2, 1, 2);
  return _panel;
}

/** Retazo de malla electrosoldada que asoma por el borde roto del panel de shotcrete. */
function geoMallaColgante() {
  if (!_mallaColgante) {
    const barras = [];
    for (let i = 0; i <= 4; i++) {
      const g = new THREE.BoxGeometry(0.9, 0.012, 0.012);
      g.translate(0, 0, -0.22 + i * 0.11);
      barras.push(g);
    }
    for (let i = 0; i <= 8; i++) {
      const g = new THREE.BoxGeometry(0.012, 0.012, 0.44);
      g.translate(-0.44 + i * 0.11, 0, 0);
      barras.push(g);
    }
    // Fusion manual: evita depender de BufferGeometryUtils para 13 cajas.
    const pos = [];
    for (const g of barras) {
      const p = g.attributes.position;
      const idx = g.index;
      for (let i = 0; i < idx.count; i++) {
        const v = idx.getX(i);
        pos.push(p.getX(v), p.getY(v), p.getZ(v));
      }
      g.dispose();
    }
    _mallaColgante = new THREE.BufferGeometry();
    _mallaColgante.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    _mallaColgante.computeVertexNormals();
  }
  return _mallaColgante;
}

/**
 * @param {object}  o
 * @param {'roca'|'shotcrete'} [o.tipo]      material que esta por desprenderse
 * @param {number}  [o.escala]               tamaño relativo de la pieza (1 ≈ 0.9 m)
 * @param {boolean} [o.mineralizada]         roca con sulfuros (labor de mineral)
 * @param {string}  [o.rockType]             litologia de la labor (color de la pieza)
 * @param {number}  [o.semilla]              variacion determinista de la forma
 * @returns {THREE.Group} con userData.tick (oscilacion) y userData.hazard (peligro)
 */
export function crear({ tipo = 'roca', escala = 1, mineralizada = false, rockType = 'caliza', semilla = 0.5 } = {}) {
  const g = new THREE.Group();
  g.name = `roca_colgada_${tipo}`;

  // Pivote alto: la pieza bascula colgada de su borde aun pegado al macizo, no de su centro.
  const pivote = new THREE.Group();
  pivote.name = 'pivote_desprendimiento';
  g.add(pivote);

  if (tipo === 'shotcrete') {
    const panel = new THREE.Mesh(geoPanel(), MineMaterials.shotcrete(false));
    panel.scale.setScalar(escala);
    panel.position.y = -0.12 * escala;
    // Ya vencido: el panel esta despegado por un lado y basculado.
    panel.rotation.set(0.22 + semilla * 0.18, semilla * 1.4, -0.14 - semilla * 0.2);
    panel.castShadow = true;
    pivote.add(panel);

    const malla = new THREE.Mesh(geoMallaColgante(), MineMaterials.mallaOxidada());
    malla.scale.setScalar(escala);
    malla.position.set(0.16 * escala, -0.22 * escala, 0);
    malla.rotation.copy(panel.rotation);
    pivote.add(malla);
  } else {
    const mat = mineralizada ? MineMaterials.rocaMineralizada() : materialPieza(rockType);
    const cuna = new THREE.Mesh(geoCuna(), mat);
    cuna.scale.setScalar(escala);
    cuna.position.y = -0.24 * escala;
    cuna.rotation.set(semilla * 0.5, semilla * 2.6, 0.2 + semilla * 0.3);
    cuna.castShadow = true;
    pivote.add(cuna);

    // Lascas menores alrededor: el desprendimiento nunca es una pieza limpia y sola.
    const n = 1 + Math.round(semilla * 2);
    for (let i = 0; i < n; i++) {
      const l = new THREE.Mesh(geoLasca(), mat);
      const a = semilla * 6.283 + i * 2.1;
      l.scale.setScalar(escala * (0.5 + ((semilla * 7 + i) % 1) * 0.5));
      l.position.set(Math.cos(a) * 0.42 * escala, -0.12 * escala, Math.sin(a) * 0.36 * escala);
      l.rotation.set(a, a * 1.7, a * 0.6);
      pivote.add(l);
    }
  }

  // GRIETA ABIERTA: la señal que el minero busca al desatar. Es un TORO de roca en sombra
  // pegado a la corona, no un plano oscuro: un plano se lee como un agujero en el techo, que es
  // justo el efecto que hay que evitar en esta mina.
  if (!_grieta) _grieta = new THREE.TorusGeometry(0.46, 0.055, 5, 14);
  const grieta = new THREE.Mesh(_grieta, materialGrieta());
  grieta.rotation.x = Math.PI / 2;
  grieta.scale.setScalar(escala);
  grieta.position.y = -0.03 * escala;
  grieta.name = 'grieta_desprendimiento';
  g.add(grieta);

  // Oscilacion apenas perceptible: la pieza "respira" colgada. Amplitud sub-centimetrica en
  // rotacion — suficiente para que el ojo la lea como inestable, sin parecer un pendulo.
  const fase = semilla * 6.283;
  const amp = 0.012 + semilla * 0.01;
  g.userData.tick = (dt, elapsed) => {
    pivote.rotation.z = Math.sin(elapsed * 0.9 + fase) * amp;
    pivote.rotation.x = Math.cos(elapsed * 0.7 + fase) * amp * 0.6;
  };

  g.userData.hazard = {
    tipo: 'desprendimiento',
    warn: 4.5,
    hurt: 1.6,           // pasar debajo = golpe de roca; no es fatal, pero lesiona
    kill: null,
    aviso: tipo === 'shotcrete'
      ? 'Shotcrete despegado en la corona: no transitar debajo'
      : 'Roca suelta en la corona: desatar antes de continuar',
    reflexion: 'Antes de entrar a la labor: DESATE. Toda roca suelta se baja con barretilla desde zona segura.'
  };

  return g;
}
