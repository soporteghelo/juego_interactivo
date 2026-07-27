import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import completeMineCsvUrl from '../../../prueba/elementos/_mina_completa.csv?url';
import { Settings } from '../../core/Settings.js';
import { Rng } from '../../procedural/Rng.js';
import { PropScatter } from '../../procedural/PropScatter.js';
import { registerPropSolids } from '../../physics/PropSolids.js';
import { WorldRuntime } from '../WorldRuntime.js';
import { COMPLETE_MINE_PLAN } from './CompleteMinePlan.js';
import {
  carveCompleteMinePortals,
  geometryFromCompleteMineBucket,
  parseCompleteMineCsv
} from './CompleteMineGeometry.js';
import { getCsvIntersectionAsset } from '../grid/CsvIntersectionAsset.js';
import { RoomSegment } from '../grid/RoomSegment.js';
import { MineMaterials } from '../materials/MineMaterials.js';
import { crearVacio as crearNichoPeatonal } from '../../elementos/entorno/nicho_electrico.js';
import { crearSenal } from '../../elementos/senal/senal.js';

const CELL_SIZE = 3;
const MAP_CELL_SIZE = 2.25;
const INTERSECTION_ID = 'interseccion_central';
const INTERSECTION_POSITION = new THREE.Vector3(20, 8, -2);
const LAMP_GEOMETRY = new THREE.BoxGeometry(1.65, 0.10, 0.26);
const CURB_GEOMETRY = new THREE.BoxGeometry(0.12, 0.14, 1);
const DRAIN_GEOMETRY = new THREE.PlaneGeometry(0.52, 1);
const NICHE_WIDTH = 2.2;
const NICHE_HEIGHT = 2.45;
const NICHE_DEPTH = 2.3;
const EMBEDDED_FEATURE_IDS = new Set(['nicho_peatonal']);

const ROOM_TYPES = Object.freeze({
  camara_carguio: 'camara',
  taller_subterraneo: 'taller',
  estacion_bombeo: 'bombeo',
  bombeo_nivel_96: 'bombeo',
  polvorin: 'polvorin',
  refugio_mineros: 'refugio',
  refugio_nivel_96: 'refugio',
  subestacion_electrica: 'subestacion',
  frente_avance: 'frente'
});

function cellKey(x, z) {
  return `${Math.floor(x / CELL_SIZE)},${Math.floor(z / CELL_SIZE)}`;
}

function triangleHeightAt(positions, offset, x, z, tolerance = 0.10) {
  const ax = positions[offset], ay = positions[offset + 1], az = positions[offset + 2];
  const bx = positions[offset + 3], by = positions[offset + 4], bz = positions[offset + 5];
  const cx = positions[offset + 6], cy = positions[offset + 7], cz = positions[offset + 8];
  const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
  if (Math.abs(denominator) < 1e-8) return null;
  const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
  const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
  const w = 1 - u - v;
  if (u < -tolerance || v < -tolerance || w < -tolerance) return null;
  return u * ay + v * by + w * cy;
}

class FloorSpatialIndex {
  constructor() {
    this.cells = new Map();
    this.mapCells = new Map();
    this.positions = [];
    this.triangles = 0;
    this._nearProbe = new THREE.Vector3();
  }

  addPositions(source) {
    for (let sourceOffset = 0; sourceOffset < source.length; sourceOffset += 9) {
      const offset = this.positions.length;
      for (let index = 0; index < 9; index++) this.positions.push(source[sourceOffset + index]);
      const minX = Math.min(this.positions[offset], this.positions[offset + 3], this.positions[offset + 6]);
      const maxX = Math.max(this.positions[offset], this.positions[offset + 3], this.positions[offset + 6]);
      const minZ = Math.min(this.positions[offset + 2], this.positions[offset + 5], this.positions[offset + 8]);
      const maxZ = Math.max(this.positions[offset + 2], this.positions[offset + 5], this.positions[offset + 8]);
      for (let ix = Math.floor(minX / CELL_SIZE); ix <= Math.floor(maxX / CELL_SIZE); ix++) {
        for (let iz = Math.floor(minZ / CELL_SIZE); iz <= Math.floor(maxZ / CELL_SIZE); iz++) {
          const key = `${ix},${iz}`;
          if (!this.cells.has(key)) this.cells.set(key, []);
          this.cells.get(key).push(offset);
        }
      }

      // Huella real para el radar, con mas resolucion que el indice fisico. Se conserva por
      // cota para que labores superpuestas no aparezcan simultaneamente. Solo se pinta una
      // celda si el triangulo realmente la toca; no basta su caja envolvente.
      for (let ix = Math.floor(minX / MAP_CELL_SIZE); ix <= Math.floor(maxX / MAP_CELL_SIZE); ix++) {
        for (let iz = Math.floor(minZ / MAP_CELL_SIZE); iz <= Math.floor(maxZ / MAP_CELL_SIZE); iz++) {
          const centerX = (ix + 0.5) * MAP_CELL_SIZE;
          const centerZ = (iz + 0.5) * MAP_CELL_SIZE;
          const probes = [
            [centerX, centerZ],
            [ix * MAP_CELL_SIZE + 0.03, iz * MAP_CELL_SIZE + 0.03],
            [(ix + 1) * MAP_CELL_SIZE - 0.03, iz * MAP_CELL_SIZE + 0.03],
            [ix * MAP_CELL_SIZE + 0.03, (iz + 1) * MAP_CELL_SIZE - 0.03],
            [(ix + 1) * MAP_CELL_SIZE - 0.03, (iz + 1) * MAP_CELL_SIZE - 0.03]
          ];
          let mapHeight = null;
          for (const [px, pz] of probes) {
            mapHeight = triangleHeightAt(this.positions, offset, px, pz, 0.015);
            if (mapHeight !== null) break;
          }
          if (mapHeight === null) {
            const vertexInside = [0, 3, 6].some(v => {
              const vx = this.positions[offset + v], vz = this.positions[offset + v + 2];
              return Math.floor(vx / MAP_CELL_SIZE) === ix && Math.floor(vz / MAP_CELL_SIZE) === iz;
            });
            if (vertexInside) mapHeight = (
              this.positions[offset + 1] + this.positions[offset + 4] + this.positions[offset + 7]
            ) / 3;
          }
          if (mapHeight !== null) {
            const level = Math.round(mapHeight / 6);
            const mapKey = `${ix},${iz},${level}`;
            const entry = this.mapCells.get(mapKey) || {
              x: centerX, z: centerZ, y: 0, count: 0, size: MAP_CELL_SIZE
            };
            entry.y += mapHeight;
            entry.count++;
            this.mapCells.set(mapKey, entry);
          }
        }
      }
      this.triangles++;
    }
  }

  heightAt(position) {
    const candidates = this.cells.get(cellKey(position.x, position.z));
    if (!candidates) return null;
    let best = null;
    let bestDistance = Infinity;
    for (const offset of candidates) {
      const height = triangleHeightAt(this.positions, offset, position.x, position.z);
      if (height === null) continue;
      const distance = Math.abs(height - position.y);
      // Los puntos consultados (jugador/NPC) estan a menos de 2 m sobre el piso. Al hallar
      // una superficie en ese rango no es necesario recorrer los cientos de triangulos de
      // otros niveles que pueden compartir la misma celda XZ.
      if (distance < 2.2) return height;
      if (distance < bestDistance) { best = height; bestDistance = distance; }
    }
    return best;
  }

  /**
   * Busca piso alrededor de una costura pequena sin convertir ese margen en una nueva zona
   * transitable. Rapier sigue siendo la autoridad que impide atravesar el hastial.
   */
  heightNear(position, radius = 0.65) {
    const exact = this.heightAt(position);
    if (exact !== null && Math.abs(exact - position.y) < 3.2) return exact;

    const probe = this._nearProbe;
    const diagonal = radius * Math.SQRT1_2;
    const offsets = [
      [ radius, 0], [-radius, 0], [0, radius], [0, -radius],
      [ diagonal,  diagonal], [-diagonal,  diagonal],
      [ diagonal, -diagonal], [-diagonal, -diagonal]
    ];
    let best = null;
    let bestVertical = Infinity;
    for (const [dx, dz] of offsets) {
      probe.set(position.x + dx, position.y, position.z + dz);
      const height = this.heightAt(probe);
      if (height === null) continue;
      const vertical = Math.abs(height - position.y);
      if (vertical < 3.2 && vertical < bestVertical) {
        best = height;
        bestVertical = vertical;
      }
    }
    return best;
  }

  minimapCells() {
    return [...this.mapCells.values()].map(cell => ({
      x: cell.x, z: cell.z, y: cell.y / cell.count, size: cell.size
    }));
  }
}

function cloneWorldTexture(texture, repeat = 0.7) {
  if (!texture) return null;
  const cloned = texture.clone();
  cloned.repeat.set(repeat, repeat);
  cloned.needsUpdate = true;
  return cloned;
}

function makeMaterial({ service = false, floor = false } = {}) {
  if (floor) {
    const material = MineMaterials.barroMojado().clone();
    material.color.set(0xd8d0c5);
    material.vertexColors = true;
    material.side = THREE.DoubleSide;
    material.map = cloneWorldTexture(material.map, 0.82);
    return material;
  }
  if (!service) {
    // Material exclusivo de la mina completa. Sus UV ya estan expresadas en metros, por eso
    // no se reutiliza el tiling 3x4 de los tuneles procedurales (producía manchas diminutas y
    // un aspecto ruidoso). En calidad baja se conserva color+textura y se eliminan dos
    // muestras PBR costosas por pixel.
    const material = MineMaterials.rocaTunel().clone();
    material.map = cloneWorldTexture(material.map, 0.68);
    material.normalMap = cloneWorldTexture(material.normalMap, 0.68);
    material.roughnessMap = cloneWorldTexture(material.roughnessMap, 0.68);
    if (Settings.current.heavyDetail < 0.5) {
      material.normalMap = null;
      material.roughnessMap = null;
      material.roughness = 0.9;
    } else if (Settings.current.heavyDetail < 0.9) {
      material.roughnessMap = null;
      material.roughness = 0.86;
    }
    return material;
  }
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: service ? 0.64 : 0.94,
    metalness: service ? 0.18 : 0.02,
    flatShading: true,
    side: THREE.DoubleSide
  });
}

function closestFloorAnchor(positions, target) {
  let best = null;
  let bestDistance = Infinity;
  for (let offset = 0; offset < positions.length; offset += 9) {
    const center = new THREE.Vector3(
      (positions[offset] + positions[offset + 3] + positions[offset + 6]) / 3,
      (positions[offset + 1] + positions[offset + 4] + positions[offset + 7]) / 3,
      (positions[offset + 2] + positions[offset + 5] + positions[offset + 8]) / 3
    );
    const distance = center.distanceToSquared(target);
    if (distance < bestDistance) { best = center; bestDistance = distance; }
  }
  return best;
}

function optimizeSurfaceGeometry(geometry) {
  if (!geometry) return null;
  // El CSV repite cada vertice por triangulo. Soldarlos conserva exactamente la forma pero
  // reduce memoria/ancho de banda y permite normales continuas en pisos, hastiales y tuberias.
  geometry.deleteAttribute('normal');
  const optimized = mergeVertices(geometry, 1e-4);
  optimized.computeVertexNormals();
  optimized.computeBoundingBox();
  optimized.computeBoundingSphere();
  geometry.dispose();
  return optimized;
}

function addColliderForGeometry(physics, geometry) {
  const position = geometry?.getAttribute('position');
  if (!position?.array?.length) return null;
  const sourceIndex = geometry.getIndex()?.array;
  const indices = sourceIndex
    ? Uint32Array.from(sourceIndex)
    : Uint32Array.from({ length: position.count }, (_, index) => index);
  return physics.addStaticTrimesh({ vertices: position.array, indices });
}

function carveNicheOpenings(positions, colors, specs) {
  if (!specs?.length || !positions.length) return { positions, colors };
  const carvedPositions = [];
  const carvedColors = [];
  for (let offset = 0; offset < positions.length; offset += 9) {
    let remove = false;
    for (const spec of specs) {
      let minAlong = Infinity, maxAlong = -Infinity;
      let minLateral = Infinity, maxLateral = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      for (let vertex = 0; vertex < 3; vertex++) {
        const index = offset + vertex * 3;
        const dx = positions[index] - spec.center.x;
        const dz = positions[index + 2] - spec.center.z;
        const along = dx * spec.axis.x + dz * spec.axis.z;
        const lateral = dx * spec.right.x + dz * spec.right.z;
        minAlong = Math.min(minAlong, along); maxAlong = Math.max(maxAlong, along);
        minLateral = Math.min(minLateral, lateral); maxLateral = Math.max(maxLateral, lateral);
        minY = Math.min(minY, positions[index + 1]); maxY = Math.max(maxY, positions[index + 1]);
      }
      const wall = spec.side * spec.halfWidth;
      if (
        minAlong <= NICHE_WIDTH * 0.57 && maxAlong >= -NICHE_WIDTH * 0.57 &&
        minLateral <= wall + 0.78 && maxLateral >= wall - 0.78 &&
        minY <= spec.floorY + NICHE_HEIGHT + 0.12 && maxY >= spec.floorY + 0.03
      ) {
        remove = true;
        break;
      }
    }
    if (remove) continue;
    for (let index = 0; index < 9; index++) {
      carvedPositions.push(positions[offset + index]);
      carvedColors.push(colors[offset + index]);
    }
  }
  return { positions: carvedPositions, colors: carvedColors };
}

/**
 * Reorienta cada triangulo del PISO para que su normal apunte hacia ARRIBA (+Y). El CSV maestro
 * trae el piso con winding INCONSISTENTE (medido: ~67% de las caras miran hacia abajo). Rapier
 * trata los triangulos de un trimesh como orientados: si la cara apunta hacia abajo, el character
 * controller NO la reconoce como suelo transitable → el jugador nunca queda `grounded`, la
 * gravedad se acumula sin freno y termina ATRAVESANDO el piso (cae y se atasca contra los muros).
 * Voltear el winding a +Y (intercambiando dos vertices cuando la normal da negativa) le da a Rapier
 * una malla de suelo consistente de una sola cara → deteccion de suelo fiable, sin caidas.
 * @param {number[]|Float32Array} positions  triples de vertices (9 floats por triangulo)
 * @returns {Float32Array}
 */
function orientTrianglesUpward(positions) {
  const out = Float32Array.from(positions);
  for (let o = 0; o < out.length; o += 9) {
    const ax = out[o],     ay = out[o + 1], az = out[o + 2];
    const bx = out[o + 3], by = out[o + 4], bz = out[o + 5];
    const cx = out[o + 6], cy = out[o + 7], cz = out[o + 8];
    // Componente Y de (b-a) x (c-a): si es negativa, la cara mira hacia abajo.
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (ny < 0) {                 // voltea el triangulo intercambiando B y C
      out[o + 3] = cx; out[o + 4] = cy; out[o + 5] = cz;
      out[o + 6] = bx; out[o + 7] = by; out[o + 8] = bz;
    }
  }
  return out;
}

/** Mundo jugable construido directamente desde las 54 labores del CSV maestro 3D. */
export class CompleteMineWorld extends WorldRuntime {
  constructor({ scene, physics, assets, bus, lighting, seed }) {
    super();
    this.scene = scene;
    this.physics = physics;
    this.assets = assets;
    this.bus = bus;
    this.lighting = lighting;
    this.seed = seed;
    this.segments = [];
    this.interactables = [];
    this.hazards = [];
    this.vehicleRoutes = [];
    this.vehicleFleetLimit = 6;
    this.floorIndex = new FloorSpatialIndex();
    this.nicheVolumes = [];
    this.worldBounds = new THREE.Box3();
    this.spawnPoint = new THREE.Vector3(-128, 20.5, 0);
    this.spawnVehiclePoint = new THREE.Vector3(-112, 17, 0);
    this.spawnVehicleYaw = Math.PI / 2;
    this._playerPos = this.spawnPoint.clone();
    this._tmpBoundsPoint = new THREE.Vector3();
    this.rng = new Rng(seed);
    this.scatter = new PropScatter(this.rng);
    this.bus.on('player:moved', ({ position }) => this._playerPos.copy(position));
  }

  async build(onProgress = () => {}) {
    const response = await fetch(completeMineCsvUrl);
    if (!response.ok) throw new Error(`[Mina completa] No se pudo cargar el CSV (${response.status})`);
    const csvText = await response.text();
    const parsed = await parseCompleteMineCsv(csvText, COMPLETE_MINE_PLAN, {
      onProgress: (done, total) => onProgress(done, total)
    });
    this.worldBounds.copy(parsed.bounds);

    const rockMaterial = makeMaterial();
    const floorMaterial = makeMaterial({ floor: true });
    const serviceMaterial = makeMaterial({ service: true });
    const portalOpenings = this._portalOpenings();
    let portalTrianglesRemoved = 0;
    let built = 0;

    for (const item of COMPLETE_MINE_PLAN) {
      const bucket = parsed.buckets.get(item.id);
      const group = new THREE.Group();
      group.name = `labor_completa_${item.id}`;
      const segment = this._makeSegment(item, bucket, group);

      // Este CSV representa un nicho aislado superpuesto a la via principal. Mantener su shell
      // completo duplicaba paredes y colisionadores dentro del corredor. Se conserva como
      // metadato del plano y su geometria se materializa mediante una excavacion del hastial.
      if (EMBEDDED_FEATURE_IDS.has(item.id)) {
        segment.embeddedFeature = true;
        segment.vertical = true; // evita spawn/patrullaje de NPC sobre el marcador sin shell
        group.visible = false;
        this.segments.push(segment);
        bucket.rockPositions = bucket.rockColors = null;
        bucket.servicePositions = bucket.serviceColors = null;
        bucket.floorVisualPositions = bucket.floorVisualColors = null;
        bucket.floorPositions = null;
        if (++built % 3 === 0) {
          onProgress(built, COMPLETE_MINE_PLAN.length);
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        continue;
      }
      segment.nicheSpecs = this._prepareNicheSpecs(segment, item, bucket.floorPositions);

      // Conserva la topografia del visor y abre solamente los empalmes entre labores.
      const openedRock = carveCompleteMinePortals(
        bucket.rockPositions, bucket.rockColors, portalOpenings
      );
      portalTrianglesRemoved += openedRock.removed;
      const carvedRock = carveNicheOpenings(openedRock.positions, openedRock.colors, segment.nicheSpecs);
      const rockGeometry = optimizeSurfaceGeometry(
        geometryFromCompleteMineBucket(carvedRock.positions, carvedRock.colors)
      );
      if (rockGeometry) {
        const mesh = new THREE.Mesh(rockGeometry, rockMaterial);
        mesh.name = `roca_${item.id}`;
        mesh.receiveShadow = true;
        group.add(mesh);
        if (item.id !== INTERSECTION_ID) {
          segment.physicsColliders.push(addColliderForGeometry(this.physics, rockGeometry));
        }
      }

      const floorGeometry = optimizeSurfaceGeometry(geometryFromCompleteMineBucket(
        bucket.floorVisualPositions, bucket.floorVisualColors
      ));
      if (floorGeometry) {
        const mesh = new THREE.Mesh(floorGeometry, floorMaterial);
        mesh.name = `piso_humedo_${item.id}`;
        mesh.receiveShadow = true;
        group.add(mesh);
        // La colision del piso usa solo PISO_RASANTE/MURO_PISO, no la cuneta detallada. Se
        // reorienta el winding hacia +Y: sin esto el character controller de Rapier no reconoce el
        // suelo (winding invertido del CSV) y el jugador cae/atraviesa el piso (ver orientTrianglesUpward).
        if (item.id !== INTERSECTION_ID && bucket.floorPositions.length) {
          const floorUp = orientTrianglesUpward(bucket.floorPositions);
          const floorCollision = optimizeSurfaceGeometry(geometryFromCompleteMineBucket(
            floorUp, new Float32Array(floorUp.length).fill(1), { withUvs: false }
          ));
          segment.physicsColliders.push(addColliderForGeometry(this.physics, floorCollision));
          floorCollision.dispose();
        }
      }
      const carvedServices = carveNicheOpenings(bucket.servicePositions, bucket.serviceColors, segment.nicheSpecs);
      const serviceGeometry = optimizeSurfaceGeometry(geometryFromCompleteMineBucket(
        carvedServices.positions, carvedServices.colors, { withUvs: false }
      ));
      if (serviceGeometry) {
        const mesh = new THREE.Mesh(serviceGeometry, serviceMaterial);
        mesh.name = `servicios_${item.id}`;
        group.add(mesh);
      }

      if (item.id === INTERSECTION_ID) {
        // La colision usa por separado la union corregida del cruce para que las envolventes
        // internas del archivo no bloqueen al jugador. No modifica la malla visible maestra.
        const collisionGeometry = getCsvIntersectionAsset().geometry.clone();
        collisionGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(
          INTERSECTION_POSITION.x, INTERSECTION_POSITION.y, INTERSECTION_POSITION.z
        ));
        segment.physicsColliders.push(addColliderForGeometry(this.physics, collisionGeometry));
      }

      this.floorIndex.addPositions(bucket.floorPositions);
      for (const spec of segment.nicheSpecs) this.floorIndex.addPositions(this._nicheFloorPositions(spec));
      this._addLighting(segment, bucket.floorPositions);
      this._decorateSegment(segment, item, bucket.floorPositions);
      this._addNiches(segment);
      this.scene.add(group);
      group.updateMatrixWorld(true);
      registerPropSolids(this.physics, segment);
      this.segments.push(segment);

      bucket.rockPositions = bucket.rockColors = null;
      bucket.servicePositions = bucket.serviceColors = null;
      bucket.floorVisualPositions = bucket.floorVisualColors = null;
      bucket.floorPositions = null;
      if (++built % 3 === 0) {
        onProgress(built, COMPLETE_MINE_PLAN.length);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    this.geometryStats = {
      placements: this.segments.length,
      triangles: parsed.triangles,
      floorTriangles: this.floorIndex.triangles,
      portalTrianglesRemoved,
      bounds: parsed.bounds.clone()
    };
    this.minimapCells = this.floorIndex.minimapCells();
    this._configureNavigation();
    this._pinLights();
    onProgress(COMPLETE_MINE_PLAN.length, COMPLETE_MINE_PLAN.length);
  }

  _makeSegment(item, bucket, group) {
    const bounds = bucket.bounds.clone();
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const axisX = size.x >= size.z;
    const vertical = item.type === 'Vertical' || size.y > Math.max(size.x, size.z) * 1.2;
    const floorAnchor = closestFloorAnchor(bucket.floorPositions, center) || center.clone();
    return {
      type: 'completeLabor',
      completeMine: true,
      vertical,
      planType: item.type,
      planId: item.id,
      label: item.label,
      roomType: null,
      group,
      _center: center,
      worldBounds: bounds,
      width: axisX ? Math.max(2, size.z) : Math.max(2, size.x),
      length: axisX ? Math.max(2, size.x) : Math.max(2, size.z),
      height: Math.max(2, size.y),
      minimapYaw: axisX ? Math.PI / 2 : 0,
      navigationAxis: new THREE.Vector3(axisX ? 1 : 0, 0, axisX ? 0 : 1),
      navigationAnchor: floorAnchor,
      patrolRange: Math.min(8, Math.max(2, (axisX ? size.x : size.z) * 0.16)),
      animated: [], interactables: [], hazards: [], physicsColliders: [],
      connectors: {
        entry: { position: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0) },
        exit: { position: new THREE.Vector3(), dir: new THREE.Vector3(-1, 0, 0) }
      }
    };
  }

  _portalOpenings() {
    const unique = new Map();
    for (const item of COMPLETE_MINE_PLAN) {
      const x = item.position[0];
      const y = item.position[2];
      const z = -item.position[1];
      const key = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
      if (!unique.has(key)) unique.set(key, { x, y, z, radius: 5.25, height: 5.4 });
    }
    return [...unique.values()];
  }

  _floorSamples(floorPositions, spacing = 24, maximum = 10) {
    const cells = new Map();
    for (let offset = 0; offset < floorPositions.length; offset += 9) {
      const center = new THREE.Vector3(
        (floorPositions[offset] + floorPositions[offset + 3] + floorPositions[offset + 6]) / 3,
        (floorPositions[offset + 1] + floorPositions[offset + 4] + floorPositions[offset + 7]) / 3,
        (floorPositions[offset + 2] + floorPositions[offset + 5] + floorPositions[offset + 8]) / 3
      );
      const key = `${Math.round(center.x / spacing)},${Math.round(center.z / spacing)},${Math.round(center.y / 10)}`;
      if (!cells.has(key)) cells.set(key, center);
      if (cells.size >= maximum) break;
    }
    return [...cells.values()];
  }

  _decoratorType(item) {
    if (item.type === 'Transporte') return 'mainRoad';
    if (item.type === 'Crucero' || item.type === 'Conexión') return 'crucero';
    if (item.type === 'Acceso') return 'access';
    if (item.type === 'Intersección') return 'intersection';
    return 'gallery';
  }

  _makeOperationalGroup(segment, center, length) {
    const axis = segment.navigationAxis;
    const group = new THREE.Group();
    group.name = 'elementos_operacionales';
    group.position.copy(center).addScaledVector(axis, -length / 2);
    group.rotation.y = Math.atan2(-axis.x, -axis.z);
    segment.group.add(group);
    return group;
  }

  _onSegmentAxis(segment, sample) {
    const axis = segment.navigationAxis;
    const along = (sample.x - segment._center.x) * axis.x +
      (sample.z - segment._center.z) * axis.z;
    return new THREE.Vector3(
      segment._center.x + axis.x * along,
      sample.y,
      segment._center.z + axis.z * along
    );
  }

  _prepareNicheSpecs(segment, item, floorPositions) {
    const allowed = new Set(['Transporte', 'Desarrollo', 'Crucero', 'Acceso', 'ConexiÃ³n', 'Conexión']);
    if (segment.vertical || !allowed.has(item.type) || !floorPositions.length) return [];
    if (/rampa|tajo|ventil|bypass|by-pass|camara|cámara/i.test(item.id)) return [];

    const axis = segment.navigationAxis.clone().normalize();
    const right = new THREE.Vector3(-axis.z, 0, axis.x);
    // Usa el ancho REAL de la labor. El limite antiguo de 6.2 m colocaba los nichos de la
    // via principal (9.34 m) hasta 1.5 m dentro de la calzada.
    const halfWidth = Math.max(2.1, segment.width / 2 - 0.18);
    const specs = this._floorSamples(floorPositions, 46, 3).map((sample, index) => {
      const center = this._onSegmentAxis(segment, sample);
      return {
        center,
        floorY: center.y,
        axis: axis.clone(),
        right: right.clone(),
        side: index % 2 === 0 ? 1 : -1,
        halfWidth,
        seed: this.seed + this.segments.length * 7 + index
      };
    });

    // El antiguo CSV `nicho_peatonal` se ubicaba sobre esta via y cerraba parte del corredor.
    // Se representa en la misma coordenada como un hueco real del hastial, sin shell duplicado.
    if (item.id === 'nivel_160_principal') {
      const target = new THREE.Vector3(190, segment._center.y, -3.35);
      const floor = closestFloorAnchor(floorPositions, target);
      if (floor) {
        const center = this._onSegmentAxis(segment, floor);
        center.x = 190;
        const forced = {
          center,
          floorY: center.y,
          axis: axis.clone(),
          right: right.clone(),
          side: -1,
          halfWidth,
          seed: this.seed + 190
        };
        const overlap = specs.findIndex(spec => spec.center.distanceToSquared(center) < 36);
        if (overlap >= 0) specs[overlap] = forced;
        else specs.push(forced);
      }
    }
    return specs;
  }

  _nicheFloorPositions(spec) {
    const along = spec.axis.clone().multiplyScalar(NICHE_WIDTH / 2);
    const mouth = spec.center.clone().addScaledVector(spec.right, spec.side * (spec.halfWidth - 0.08));
    const back = spec.center.clone().addScaledVector(spec.right, spec.side * (spec.halfWidth + NICHE_DEPTH));
    mouth.y = back.y = spec.floorY + 0.015;
    const a = mouth.clone().sub(along), b = mouth.clone().add(along);
    const c = back.clone().add(along), d = back.clone().sub(along);
    return new Float32Array([
      a.x,a.y,a.z, b.x,b.y,b.z, c.x,c.y,c.z,
      a.x,a.y,a.z, c.x,c.y,c.z, d.x,d.y,d.z
    ]);
  }

  _addNiches(segment) {
    if (!segment.nicheSpecs?.length) return;
    segment.refugeNiches ||= [];
    for (const spec of segment.nicheSpecs) {
      const container = new THREE.Group();
      container.name = 'nicho_refugio_transitable';
      container.position.copy(spec.center);
      container.rotation.y = Math.atan2(-spec.axis.x, -spec.axis.z);

      const niche = crearNichoPeatonal({
        seed: spec.seed, w: NICHE_WIDTH, h: NICHE_HEIGHT, d: NICHE_DEPTH
      });
      niche.position.set(spec.side * (spec.halfWidth + 0.08), 0, 0);
      niche.rotation.y = spec.side > 0 ? -Math.PI / 2 : Math.PI / 2;
      container.add(niche);

      const sign = crearSenal('refugio_peatonal');
      sign.scale.setScalar(0.82);
      sign.position.set(spec.side * (spec.halfWidth + 0.16), 2.25, 0);
      sign.rotation.y = spec.side > 0 ? -Math.PI / 2 : Math.PI / 2;
      container.add(sign);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 8, 6),
        MineMaterials.plano(0x39ff14, { rough: 0.2, emissive: 0x39ff14, emissiveIntensity: 5 })
      );
      beacon.position.set(spec.side * (spec.halfWidth + 0.14), 2.52, 0);
      container.add(beacon);
      segment.group.add(container);

      // Volumen transitable y estable: piso/techo/fondo/laterales, sin una caja en la boca.
      const outward = spec.right.clone().multiplyScalar(spec.side);
      const interior = spec.center.clone().addScaledVector(outward, spec.halfWidth + NICHE_DEPTH / 2);
      const yaw = Math.atan2(-spec.axis.z, spec.axis.x);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
      const addBox = (hx, hy, hz, position) => {
        const collider = this.physics.addStaticCuboid({
          hx, hy, hz,
          pos: [position.x, position.y, position.z],
          rot: { x: q.x, y: q.y, z: q.z, w: q.w }
        });
        segment.physicsColliders.push(collider);
      };
      addBox(NICHE_WIDTH / 2, 0.08, NICHE_DEPTH / 2, new THREE.Vector3(interior.x, spec.floorY - 0.08, interior.z));
      addBox(NICHE_WIDTH / 2, 0.10, NICHE_DEPTH / 2, new THREE.Vector3(interior.x, spec.floorY + NICHE_HEIGHT + 0.10, interior.z));
      const backCenter = spec.center.clone().addScaledVector(outward, spec.halfWidth + NICHE_DEPTH);
      backCenter.y = spec.floorY + NICHE_HEIGHT / 2;
      addBox(NICHE_WIDTH / 2, NICHE_HEIGHT / 2, 0.10, backCenter);
      for (const sideAlong of [-1, 1]) {
        const sideCenter = interior.clone().addScaledVector(spec.axis, sideAlong * NICHE_WIDTH / 2);
        sideCenter.y = spec.floorY + NICHE_HEIGHT / 2;
        addBox(0.10, NICHE_HEIGHT / 2, NICHE_DEPTH / 2, sideCenter);
      }

      const refuge = spec.center.clone().addScaledVector(outward, spec.halfWidth + NICHE_DEPTH * 0.58);
      segment.refugeNiches.push({ x: refuge.x, z: refuge.z });
      this.nicheVolumes.push({
        center: spec.center.clone(), axis: spec.axis.clone(), outward: outward.clone(),
        halfWidth: spec.halfWidth, floorY: spec.floorY
      });
    }
  }

  _addDrainage(proxy) {
    const length = Math.max(4, proxy.length - 0.5);
    const halfWidth = proxy.width / 2;
    for (const side of [-1, 1]) {
      const water = new THREE.Mesh(DRAIN_GEOMETRY, MineMaterials.aguaCorriente());
      water.name = 'cuneta_agua_visible';
      water.rotation.x = -Math.PI / 2;
      water.scale.y = length;
      water.position.set(side * (halfWidth - 0.35), 0.045, -length / 2);
      proxy.group.add(water);

      const curb = new THREE.Mesh(CURB_GEOMETRY, MineMaterials.shotcrete(false));
      curb.name = 'cuneta_bordillo_visible';
      curb.scale.z = length;
      curb.position.set(side * (halfWidth - 0.72), 0.07, -length / 2);
      proxy.group.add(curb);
    }
  }

  _decorateSegment(segment, item, floorPositions) {
    if (segment.vertical || !floorPositions.length || item.type === 'Rampa' || item.type === 'Tajo') return;
    const detail = Settings.current.heavyDetail;
    const maxOperationalZones = detail >= 0.9 ? 3 : (detail >= 0.5 ? 2 : 1);
    const samples = this._floorSamples(floorPositions, 40, maxOperationalZones)
      .map(sample => this._onSegmentAxis(segment, sample));
    const length = Math.min(16, Math.max(10, segment.length));
    const width = THREE.MathUtils.clamp(segment.width, 4, 6.5);
    const height = THREE.MathUtils.clamp(segment.height, 4, 5.8);

    samples.forEach((center, index) => {
      const group = this._makeOperationalGroup(segment, center, length);
      const proxy = {
        type: this._decoratorType(item),
        group,
        width,
        length,
        height,
        shotcrete: true,
        animated: [], interactables: [], hazards: [], colliders: [],
        nichoZones: []
      };
      // El sostenimiento y los servicios longitudinales ya vienen modelados en el CSV. Aqui
      // se recupera la capa operacional que aquel archivo no contiene como objetos del juego.
      this.scatter._debris(proxy, { light: true });
      this.scatter._trash(proxy);
      this.scatter._puddles(proxy);
      this._addDrainage(proxy);
      this.scatter._delineators(proxy);
      if (index === 0) this.scatter._contextSignage(proxy, { signage: true });
      this.scatter._safetyStations(proxy);
      segment.animated.push(...proxy.animated);
      segment.interactables.push(...proxy.interactables);
      segment.hazards.push(...proxy.hazards);
    });

    const roomType = ROOM_TYPES[item.id];
    if (!roomType) return;
    const roomSize = THREE.MathUtils.clamp(Math.max(width, 8), 8, 11);
    const furnishGroup = new THREE.Group();
    furnishGroup.name = `equipamiento_${roomType}`;
    furnishGroup.position.copy(segment.navigationAnchor);
    furnishGroup.rotation.y = Math.atan2(-segment.navigationAxis.x, -segment.navigationAxis.z);
    segment.group.add(furnishGroup);

    const furnishing = new RoomSegment({
      size: roomSize,
      height,
      openDirs: [{ x: 0, z: 1 }],
      roomType,
      label: item.label,
      lighting: this.lighting
    });
    furnishing.group = furnishGroup;
    furnishing._furnish({ x: 0, z: 1 });
    furnishGroup.traverse(object => { if (object.userData?.tick) furnishing.animated.push(object); });

    segment.type = 'room';
    segment.roomType = roomType;
    segment.size = roomSize;
    segment.openDirs = [{ x: 0, z: 1 }];
    segment.animated.push(...furnishing.animated);
    segment.interactables.push(...furnishing.interactables);
    segment.hazards.push(...furnishing.hazards);
  }

  _addLighting(segment, floorPositions) {
    if (segment.vertical || !floorPositions.length) return;
    for (const sample of this._floorSamples(floorPositions, 22, 12)) {
      const floor = this._onSegmentAxis(segment, sample);
      const lampY = floor.y + THREE.MathUtils.clamp(segment.height * 0.72, 3.25, 3.65);
      const fixture = new THREE.Mesh(LAMP_GEOMETRY, MineMaterials.ledBlanco());
      fixture.name = 'luminaria_led_mina_completa';
      fixture.position.set(floor.x, lampY, floor.z);
      fixture.rotation.y = segment.minimapYaw;
      segment.group.add(fixture);
      const light = new THREE.PointLight(0xf3f7ff, 46, 26, 1.8);
      light.position.set(floor.x, lampY - 0.12, floor.z);
      light.castShadow = false;
      segment.group.add(light);
      this.lighting?.noteLight?.();
    }
  }

  _configureNavigation() {
    const at = (x, north, elevation = 8) => {
      const probe = new THREE.Vector3(x, elevation, -north);
      const floor = this.floorIndex.heightAt(probe);
      return new THREE.Vector3(x, floor ?? elevation, -north);
    };
    this.spawnPoint.copy(at(-128, 0, 19)).add(new THREE.Vector3(0, 1.4, 0));
    // Equipo inicial pegado al lado norte; la franja sur queda libre para el jugador.
    this.spawnVehiclePoint.copy(at(-112, 2.5, 17));

    // Circuito de DOS CARRILES sobre el Nivel 160. Antes ida y retorno compartian el mismo
    // eje: los equipos se encontraban de frente, activaban el paro por choque y bloqueaban
    // toda la via. Cada sentido usa ahora su propio carril y solo cruza al girar en los extremos.
    // SEPARACION: el offset de carril del VehicleSystem (0.9 m) empuja AMBOS sentidos hacia el
    // centro, restando 1.8 m a la distancia entre ejes. Con ida=6.0 y retorno=2.4 los vehiculos
    // quedaban a 1.8 m (< 2.4 m del scoop+camioneta) y se traspasaban al cruzarse. El retorno baja
    // a north 1.4 (piso pleno confirmado hasta ~0.8) → 2.8 m entre ejes: el equipo mas ancho ya
    // no clipea al de sentido contrario. El outbound se deja en 6.0 (no acercarlo al hastial N).
    const xs = [-40, -5, 30, 70, 110, 150, 190];
    const outbound = xs.map(x => at(x, 6.0, 8));
    const inbound = [...xs].reverse().map(x => at(x, 1.4, 8));
    this.vehicleRoutes = [outbound.concat(inbound)];
  }

  registerInteractables(interaction) {
    for (const { object, descriptor } of this.interactables) interaction.registerInteractable(object, descriptor);
  }

  boundsCheck(position) {
    if (this._nicheAt(position)) return true;
    const floor = this.floorIndex.heightNear(position);
    return floor !== null && position.y > floor - 2.5 && position.y < floor + 8;
  }

  groundHeight(position) {
    const floor = this.floorIndex.heightNear(position);
    if (floor !== null) return floor;
    return this._nicheAt(position)?.floorY ?? null;
  }

  /**
   * Motivo por el que la red de seguridad SI debe recuperar al jugador. Una costura del
   * indice de piso no basta: solo se repone ante una caida o salida inequivoca.
   */
  recoveryReason(position) {
    if (![position.x, position.y, position.z].every(Number.isFinite)) return 'posicion_no_finita';
    if (this.worldBounds.isEmpty()) return null;

    const marginXZ = 14;
    if (
      position.x < this.worldBounds.min.x - marginXZ ||
      position.x > this.worldBounds.max.x + marginXZ ||
      position.z < this.worldBounds.min.z - marginXZ ||
      position.z > this.worldBounds.max.z + marginXZ
    ) return 'fuera_extension_mina';

    if (position.y < this.worldBounds.min.y - 8) return 'caida_bajo_mina';
    if (position.y > this.worldBounds.max.y + 16) return 'fuera_sobre_mina';

    const floor = this.floorIndex.heightNear(position, 1.1);
    if (floor !== null && position.y < floor - 5) return 'caida_bajo_labor';
    return null;
  }

  _nicheAt(position) {
    for (const niche of this.nicheVolumes) {
      const dx = position.x - niche.center.x;
      const dz = position.z - niche.center.z;
      const along = dx * niche.axis.x + dz * niche.axis.z;
      const depth = dx * niche.outward.x + dz * niche.outward.z;
      if (
        Math.abs(along) <= NICHE_WIDTH / 2 + 0.35 &&
        depth >= niche.halfWidth - 0.35 &&
        depth <= niche.halfWidth + NICHE_DEPTH + 0.35 &&
        position.y >= niche.floorY - 0.6 && position.y <= niche.floorY + NICHE_HEIGHT + 1.2
      ) return niche;
    }
    return null;
  }

  update(dt, elapsed) {
    const enterDistance = Settings.current.drawDistance + 14;
    const exitDistance = Settings.current.drawDistance + 24;
    for (const segment of this.segments) {
      const distance = segment.worldBounds.distanceToPoint(this._playerPos);
      // Histeresis: un tramo cercano al limite no alterna visible/oculto cada pocos frames.
      // Esa alternancia cambiaba bruscamente la carga de render y producia tirones.
      const visible = segment.group.visible
        ? distance < exitDistance
        : distance < enterDistance;
      // `_mostrar` ademas DESENGANCHA de la escena los tramos lejanos: sin eso, Three los
      // recorre igual en cada frame aunque esten invisibles (ver WorldRuntime._mostrar).
      this._mostrar(segment, visible);
      if (!visible) continue;
      for (const object of segment.animated) object.userData.tick?.(dt, elapsed);
    }
    if (this._poolLights?.length) {
      this._lightAccum += dt;
      if (this._lightAccum >= 0.12) { this._lightAccum = 0; this._assignPoolLights(); }
    }
  }
}
