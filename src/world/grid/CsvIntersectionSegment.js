import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MineMaterials } from '../materials/MineMaterials.js';
import { Settings } from '../../core/Settings.js';
import { crear as crearEspejoConvexo } from '../../elementos/ssoma/espejo_convexo.js';
import { getCsvIntersectionAsset } from './CsvIntersectionAsset.js';
import { CSV_INTERSECTION_HEIGHT, CSV_INTERSECTION_WIDTH } from './CsvIntersectionGeometry.js';
import { createMouthCollarGeo } from '../segments/TunnelGeometry.js';

const DIRECTIONS = [
  { key: 'E', x: 1, z: 0, axisX: true },
  { key: 'W', x: -1, z: 0, axisX: true },
  { key: 'N', x: 0, z: 1, axisX: false },
  { key: 'S', x: 0, z: -1, axisX: false }
];

let sharedRockMaterial = null;
const _backdropCache = new Map();

/**
 * RESPALDO DEL CRUCE — caja de roca que envuelve la interseccion por detras de la malla del CSV.
 *
 * La malla topografica del cruce es la UNION de dos tuneles que se cruzan, y esa union no cierra
 * sola: donde la boveda de una via se encuentra con el hastial de la otra (la "ingle" del cruce),
 * y en los cuatro rincones fuera de la cruz, quedan franjas SIN triangulos. Por ahi se veia el
 * vacio exterior — los huecos negros en las esquinas altas de las bocas.
 *
 * En vez de intentar coser triangulo a triangulo una malla de levantamiento (fragil y distinto en
 * cada nodo), se cierra el volumen POR FUERA: losa de corona, losa de piso y cuatro paneles
 * laterales que dejan libre solo el ancho de paso. Cualquier hueco de la malla del CSV pasa a dar
 * contra roca, nunca contra el vacio. Queda siempre DETRAS de la piel del CSV, asi que no se ve
 * salvo justo por donde antes habia un agujero.
 *
 * La geometria depende solo de (lado, alto, ancho de paso) → se fusiona en UNA malla y se cachea,
 * de modo que las ~60 intersecciones del plano comparten un unico buffer y un solo draw call.
 */
function backdropGeometry(size, height, passWidth) {
  const key = `${size.toFixed(2)}:${height.toFixed(2)}:${passWidth.toFixed(2)}`;
  if (_backdropCache.has(key)) return _backdropCache.get(key);

  const half = size / 2;
  const passHalf = passWidth / 2;
  const outer = half + 0.30;        // los paneles cierran por fuera del borde del bloque
  const top = height + 0.60;        // por encima de la corona del CSV y de todas las bocas
  // Jambas laterales: del borde EXACTO del vano de paso hasta pasado el borde del bloque. Nunca
  // se meten dentro del ancho de paso (si no, asomarian dentro de la via mas ancha).
  const lateral = (outer - passHalf) / 2;
  const centro = passHalf + lateral;

  const piezas = [
    // Corona: tapa la boveda por encima (por aqui se colaba la luz del vacio en las ingles).
    new THREE.BoxGeometry(size + 0.6, 0.3, size + 0.6).translate(0, top + 0.15, 0),
    // Piso: los rincones del bloque no tienen losa en el CSV.
    new THREE.BoxGeometry(size + 0.6, 0.3, size + 0.6).translate(0, -0.16, 0)
  ];
  // Cuatro caras: dos jambas por cara, dejando libre el ancho de paso de la via.
  for (const signo of [-1, 1]) {
    for (const lado of [-1, 1]) {
      piezas.push(new THREE.BoxGeometry(lateral * 2, top, 0.3)
        .translate(lado * centro, top / 2, signo * outer));
      piezas.push(new THREE.BoxGeometry(0.3, top, lateral * 2)
        .translate(signo * outer, top / 2, lado * centro));
    }
  }

  const geo = mergeGeometries(piezas);
  for (const p of piezas) p.dispose();
  // `rocaTunel` pinta con color por vertice: sin el atributo, el respaldo saldria NEGRO (que es
  // justo lo que se quiere evitar). Tono de roca en sombra, un punto mas oscuro que la piel.
  const colores = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < colores.length; i += 3) {
    colores[i] = 0.26; colores[i + 1] = 0.25; colores[i + 2] = 0.23;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3));
  _backdropCache.set(key, geo);
  return geo;
}

function rockMaterial() {
  if (!sharedRockMaterial) {
    sharedRockMaterial = MineMaterials.rocaTunel().clone();
    sharedRockMaterial.flatShading = true;
    sharedRockMaterial.side = THREE.DoubleSide;
    sharedRockMaterial.needsUpdate = true;
  }
  return sharedRockMaterial;
}

/** Interseccion cuya piel triangular procede de interseccion_4_vias.csv, a escala 1:1. */
export class CsvIntersectionSegment {
  constructor({ size, height, openDirs, lighting, rng = null }) {
    this.type = 'node';
    this.size = size;
    this.width = size;
    this.length = size;
    this.height = Math.max(height, CSV_INTERSECTION_HEIGHT);
    this.openDirs = openDirs || [];
    this.lighting = lighting;
    this.rng = rng;
    this.csvIntersection = true;

    this.group = new THREE.Group();
    this.group.name = 'interseccion_csv_4_vias';
    this.colliders = [];
    this.interactables = [];
    this.hazards = [];
    this.animated = [];
    this.connectors = {
      entry: { position: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1) },
      exit: { position: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1) }
    };
  }

  _rnd() { return this.rng ? this.rng.next() : Math.random(); }
  _isOpen(direction) { return this.openDirs.some(d => d.x * direction.x + d.z * direction.z > 0.7); }

  build() {
    const { geometry, capGeometries, metadata } = getCsvIntersectionAsset();
    const material = rockMaterial();

    // Respaldo PRIMERO: queda por detras de la piel del CSV y cierra el volumen del cruce.
    const backdrop = new THREE.Mesh(
      backdropGeometry(this.size, this.height, CSV_INTERSECTION_WIDTH),
      material
    );
    backdrop.name = 'respaldo_interseccion';
    backdrop.receiveShadow = true;
    this.group.add(backdrop);

    const shell = new THREE.Mesh(geometry, material);
    shell.name = 'malla_interseccion_4_vias_csv';
    shell.receiveShadow = true;
    shell.userData.csvIntersection = metadata;
    this.group.add(shell);
    this.shell = shell;

    this._buildCollidersAndCaps(capGeometries, material);
    this._buildMouthCollars(material);
    this._buildLighting();
    this._buildSafetyDetail();
    return this;
  }

  /**
   * COLLARES DE BOCA: cierran la franja de roca entre la seccion del tunel que llega y la boca
   * del cruce (mas ancha y mas alta). Sin ellos, en cada union tunel→cruce quedaba una rendija
   * abierta al vacio — los huecos negros que se veian en las esquinas altas de las bocas.
   *
   * Se coloca uno por direccion ABIERTA, en el plano exacto de la junta (el borde del bloque),
   * con la seccion REAL del tunel que llega por ahi (`openDirs[].width/height`).
   */
  _buildMouthCollars(material) {
    const half = this.size / 2;
    const passHalf = CSV_INTERSECTION_WIDTH / 2;
    for (const direction of DIRECTIONS) {
      // Tunel que llega por esta cara (el mas ancho si hubiera varios casi paralelos).
      let mouth = null;
      for (const d of this.openDirs) {
        if (d.x * direction.x + d.z * direction.z <= 0.7) continue;
        if (!mouth || (d.width ?? 0) > (mouth.width ?? 0)) mouth = d;
      }
      if (!mouth?.width) continue;

      const collar = new THREE.Mesh(createMouthCollarGeo({
        width: mouth.width,
        height: mouth.height ?? this.height,
        archRatio: mouth.archRatio ?? 0.40,   // la herradura EXACTA del tunel que llega
        // Cubre holgadamente la boca del cruce (ancho de paso y corona) y SOLAPA con las jambas
        // del respaldo, que arrancan justo en el borde del vano: entre ambos no queda rendija.
        spanHalf: Math.max(mouth.width / 2, passHalf) + 0.7,
        topY: Math.max(mouth.height ?? 0, CSV_INTERSECTION_HEIGHT) + 0.7
      }), material);
      collar.name = `collar_boca_${direction.key}`;
      collar.position.set(direction.x * half, 0, direction.z * half);
      // La cara del collar mira a lo largo de la via: +Z local hacia el centro del bloque.
      collar.rotation.y = Math.atan2(-direction.x, -direction.z);
      collar.receiveShadow = true;
      this.group.add(collar);
    }
  }

  _buildCollidersAndCaps(capGeometries, material) {
    const half = this.size / 2;
    const H = this.height;
    // Piso y corona continuos. Las cuatro cajas de esquina dejan libre la cruz del CSV: ambas
    // vias quedan al ancho de paso ampliado (CSV_INTERSECTION_WIDTH), igual que las labores.
    this.colliders.push({ hx: half + 0.5, hy: 0.12, hz: half + 0.5, pos: [0, -0.12, 0] });
    this.colliders.push({ hx: half, hy: 0.12, hz: half, pos: [0, H + 0.12, 0] });
    const clearX = CSV_INTERSECTION_WIDTH / 2;
    const clearZ = CSV_INTERSECTION_WIDTH / 2;
    const cornerHx = (half - clearX) / 2;
    const cornerHz = (half - clearZ) / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      this.colliders.push({
        hx: cornerHx,
        hy: H / 2,
        hz: cornerHz,
        pos: [sx * (clearX + cornerHx), H / 2, sz * (clearZ + cornerHz)]
      });
    }

    // Si el nodo es T, codo o extremo, la boca inexistente se tapa con la cara exacta extraida
    // del mismo CSV (BOCA_REFORZADA para E/W; PORTAL/FRENTE para N/S).
    for (const direction of DIRECTIONS) {
      if (this._isOpen(direction)) continue;
      const cap = new THREE.Mesh(capGeometries[direction.key], material);
      cap.name = `cierre_csv_${direction.key}`;
      this.group.add(cap);
      const passageHalf = direction.axisX ? clearZ : clearX;
      if (direction.axisX) {
        this.colliders.push({ hx: 0.20, hy: H / 2, hz: passageHalf, pos: [direction.x * half, H / 2, 0] });
      } else {
        this.colliders.push({ hx: passageHalf, hy: H / 2, hz: 0.20, pos: [0, H / 2, direction.z * half] });
      }
    }
  }

  _buildLighting() {
    const y = this.height - 0.48;
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.12, 0.30),
      MineMaterials.plano(0x2c2f33, { rough: 0.6, metal: 0.5 })
    );
    housing.position.set(0, y, 0);
    this.group.add(housing);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.2), MineMaterials.ledBlanco());
    panel.position.set(0, y - 0.09, 0);
    panel.name = 'node_luz';
    this.group.add(panel);
    if (this.lighting?.canAddLight?.()) {
      const light = new THREE.PointLight(0xf5f8ff, 30, 20, 2);
      light.position.set(0, y - 0.30, 0);
      this.group.add(light);
      this.lighting.noteLight();
    }
  }

  _buildSafetyDetail() {
    if ((Settings.current.heavyDetail ?? 1) < 0.4 || this.openDirs.length < 3) return;
    try {
      const mirror = crearEspejoConvexo();
      const sx = this._rnd() < 0.5 ? -1 : 1;
      const sz = this._rnd() < 0.5 ? -1 : 1;
      mirror.position.set(sx * 3.75, Math.min(this.height - 1.2, 3.3), sz * 3.55);
      mirror.rotation.y = Math.atan2(-mirror.position.x, -mirror.position.z);
      this.group.add(mirror);
    } catch { /* detalle opcional */ }
  }
}
